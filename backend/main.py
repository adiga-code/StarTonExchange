from fastapi import FastAPI, Depends, HTTPException, Header, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional, List
import asyncio
import os
import httpx
import logging
from datetime import datetime, date
from decimal import Decimal
from dotenv import load_dotenv
import base64
from pyrogram import Client
from pyrogram.errors import UsernameNotOccupied, UsernameInvalid, FloodWait, AuthKeyUnregistered


# Load environment variables
load_dotenv()

from database import get_db, init_db, init_default_data, AsyncSessionLocal
from storage import Storage
from telegram_auth import get_current_user
from robokassa import get_robokassa
from schemas import *
from models import User
import json

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Stars Exchange API", version="1.0.0")

# CORS middleware for development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173"],  # Vite dev server
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Request logging middleware
@app.middleware("http")
async def log_requests(request: Request, call_next):
    start_time = datetime.now()
    
    response = await call_next(request)
    
    duration = (datetime.now() - start_time).total_seconds() * 1000
    
    if request.url.path.startswith("/api"):
        logger.info(f"{request.method} {request.url.path} {response.status_code} in {duration:.0f}ms")
    
    return response

# Dependency to get storage
async def get_storage(db: AsyncSession = Depends(get_db)):
    return Storage(db)

# Dependency to get current user
async def get_authenticated_user(
    storage: Storage = Depends(get_storage),
    x_telegram_init_data: Optional[str] = Header(None)
) -> User:
    user = await get_current_user(storage, None, x_telegram_init_data)
    if not user:
        raise HTTPException(status_code=403, detail="Invalid or missing Telegram authentication data")
    return user

telegram_client = None
connected_client = None

async def ensure_telegram_connection():
    global connected_client
    logger.info(f"Current connected_client state: {connected_client}")
    
    if connected_client is None:
        logger.info("Creating new telegram connection...")
        session_string = os.getenv('TELEGRAM_SESSION_STRING')
        if session_string:
            connected_client = Client("my_account", session_string=session_string)
            await connected_client.start()
            logger.info("Global telegram session started")
        else:
            logger.error("No session string found")
            return None
    else:
        logger.info("Using existing telegram connection")
    
    return connected_client

# User routes
@app.post("/api/users", response_model=UserResponse)
async def create_user(
    user_data: UserCreate,
    storage: Storage = Depends(get_storage)
):
    try:
        existing_user = await storage.get_user_by_telegram_id(user_data.telegram_id)
        if existing_user:
            return existing_user
        
        user = await storage.create_user(user_data)
        logger.info(f"Created user: {user.id} telegramId: {user.telegram_id}")
        return user
    except Exception as e:
        logger.error(f"Error creating user: {e}")
        raise HTTPException(status_code=400, detail="Invalid user data")

@app.get("/api/users/me", response_model=UserResponse)
async def get_current_user_info(
    current_user: User = Depends(get_authenticated_user)
):
    return current_user

@app.put("/api/users/me", response_model=UserResponse)
async def update_current_user(
    updates: UserUpdate,
    current_user: User = Depends(get_authenticated_user),
    storage: Storage = Depends(get_storage)
):
    update_dict = {k: v for k, v in updates.dict().items() if v is not None}
    updated_user = await storage.update_user(current_user.id, update_dict)
    return updated_user



@app.get("/api/getPhoto")
async def get_photo(username: str):
    logger.info(f"Getting photo for username: {username}")
    try:
        client = await ensure_telegram_connection()
        if not client:
            return {"error": "Service temporarily unavailable", "success": False}
        
        clean_username = username.lstrip('@')
        
        # БЕЗ async with - используем уже подключенного клиента
        user = await client.get_users(clean_username)
        logger.info(f"Found user: {user.first_name}, has_photo: {bool(user.photo)}")
        
        if user.photo:
            photo_bytes = await client.download_media(user.photo.big_file_id, in_memory=True)
            photo_base64 = base64.b64encode(photo_bytes.getvalue()).decode()
            photo_url = f"data:image/jpeg;base64,{photo_base64}"
            
            return {
                "photo_url": photo_url,
                "first_name": user.first_name or clean_username,
                "success": True
            }
        else:
            avatar_url = f"https://ui-avatars.com/api/?name={clean_username}&size=128&background=4E7FFF&color=fff"
            return {
                "photo_url": avatar_url,
                "first_name": user.first_name or clean_username,
                "success": True
            }
    except (UsernameNotOccupied, UsernameInvalid):
        return {"error": "User not found", "success": False}
    except Exception as e:
        logger.error(f"Error: {e}")
        return {"error": "User not found", "success": False}


# Purchase routes
@app.post("/api/purchase/calculate", response_model=PurchaseCalculateResponse)
async def calculate_purchase(
    purchase_data: PurchaseCalculate,
    storage: Storage = Depends(get_storage)
):
    try:
        # Validate currency
        if purchase_data.currency not in ['stars', 'ton']:
            raise HTTPException(status_code=400, detail="Invalid currency. Must be 'stars' or 'ton'")
        
        stars_price_setting = await storage.get_setting("stars_price")
        ton_price_setting = await storage.get_setting("ton_price")
        markup_setting = await storage.get_setting("markup_percentage")
        
        prices = {
            "stars": float(stars_price_setting.value if stars_price_setting else "2.30"),
            "ton": float(ton_price_setting.value if ton_price_setting else "420.50"),
        }
        
        markup = float(markup_setting.value if markup_setting else "5") / 100
        
        base_price = purchase_data.amount * prices[purchase_data.currency]
        markup_amount = base_price * markup
        total_price = base_price + markup_amount
        
        return PurchaseCalculateResponse(
            base_price=f"{base_price:.2f}",
            markup_amount=f"{markup_amount:.2f}",
            total_price=f"{total_price:.2f}",
            currency=purchase_data.currency,
            amount=purchase_data.amount
        )
    except Exception as e:
        logger.error(f"Error calculating price: {e}")
        raise HTTPException(status_code=500, detail="Failed to calculate price")

@app.post("/api/purchase", response_model=PaymentCreateResponse)
async def make_purchase(
    purchase_data: PurchaseRequest,
    current_user: User = Depends(get_authenticated_user),
    storage: Storage = Depends(get_storage)
):
    try:
        # Validate currency
        if purchase_data.currency not in ['stars', 'ton']:
            raise HTTPException(status_code=400, detail="Invalid currency. Must be 'stars' or 'ton'")
        
        robokassa = get_robokassa()
        if not robokassa:
            raise HTTPException(status_code=500, detail="Payment system not configured")
        
        # Generate unique invoice ID
        import uuid
        invoice_id = str(uuid.uuid4())
        
        # Create transaction record
        transaction_data = TransactionCreate(
            user_id=current_user.id,
            type="buy_stars" if purchase_data.currency == "stars" else "buy_ton",
            currency=purchase_data.currency,
            amount=Decimal(str(purchase_data.amount)),
            rub_amount=Decimal(str(purchase_data.rub_amount)),
            status="pending",
            description=f"Purchase {purchase_data.amount} {purchase_data.currency}",
            payment_system="robokassa",
            invoice_id=invoice_id
        )
        
        transaction = await storage.create_transaction(transaction_data)
        
        # Create payment URL
        payment_url = robokassa.create_payment_url(
            invoice_id=invoice_id,
            amount=Decimal(str(purchase_data.rub_amount)),
            description=f"Purchase {purchase_data.amount} {purchase_data.currency}",
            user_email=f"{current_user.telegram_id}@telegram.user"
        )
        
        # Update transaction with payment URL
        await storage.update_transaction(transaction.id, {"payment_url": payment_url})
        
        logger.info(f"Created payment for user {current_user.telegram_id}: {purchase_data.rub_amount} RUB")
        
        return PaymentCreateResponse(
            transaction_id=transaction.id,
            payment_url=payment_url,
            invoice_id=invoice_id,
            amount=str(purchase_data.rub_amount),
            status="pending"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating payment: {e}")
        raise HTTPException(status_code=500, detail="Failed to create payment")

# Tasks routes
@app.get("/api/tasks", response_model=List[TaskResponse])
async def get_tasks(
    current_user: User = Depends(get_authenticated_user),
    storage: Storage = Depends(get_storage)
):
    try:
        tasks = await storage.get_active_tasks()
        user_tasks = await storage.get_user_tasks(current_user.id)
        user_task_map = {ut.task_id: ut for ut in user_tasks}

        tasks_with_completion = []
        for task in tasks:
            user_task = user_task_map.get(task.id)
            task_dict = task.__dict__
            task_dict['completed'] = user_task.completed if user_task else False
            task_dict['completed_at'] = user_task.completed_at if user_task else None
            tasks_with_completion.append(TaskResponse(**task_dict))

        return tasks_with_completion
    except Exception as e:
        logger.error(f"Error getting tasks: {e}")
        raise HTTPException(status_code=500, detail="Failed to get tasks")

@app.post("/api/tasks/{task_id}/complete")
async def complete_task(
    task_id: str,
    current_user: User = Depends(get_authenticated_user),
    storage: Storage = Depends(get_storage)
):
    try:
        task = await storage.get_task(task_id)
        if not task:
            raise HTTPException(status_code=404, detail="Task not found")
        
        # Проверяем статус задания
        if task.status != "active" or not task.is_active:
            raise HTTPException(status_code=400, detail="Task is not available")
            
        # Проверяем дедлайн
        if task.deadline and datetime.now() > task.deadline:
            raise HTTPException(status_code=400, detail="Task deadline passed")
            
        # Проверяем максимум выполнений
        if task.max_completions and task.completed_count >= task.max_completions:
            raise HTTPException(status_code=400, detail="Task completion limit reached")

        # Проверяем уже выполненное задание
        existing_user_task = await storage.get_user_task(current_user.id, task_id)
        if existing_user_task and existing_user_task.completed:
            raise HTTPException(status_code=400, detail="Task already completed")
        
        # Проверяем требования (если есть)
        if task.requirements:
            requirements_met = await check_task_requirements(current_user, task.requirements, storage)
            if not requirements_met:
                raise HTTPException(status_code=400, detail="Requirements not met")
        
        # Заглушка проверки выполнения действия
        action_verified = await verify_task_action(task.action, current_user)
        if not action_verified:
            raise HTTPException(status_code=400, detail="Action not verified")
        
        # Создаем user_task если не существует
        if not existing_user_task:
            user_task_data = UserTaskCreate(user_id=current_user.id, task_id=task_id)
            await storage.create_user_task(user_task_data)
        
        # Выполняем задание
        completed_task = await storage.complete_user_task(current_user.id, task_id)
        
        # Начисляем награду
        updates = {
            "stars_balance": current_user.stars_balance + task.reward,
            "total_stars_earned": current_user.total_stars_earned + task.reward,
            "tasks_completed": current_user.tasks_completed + 1,
            "daily_earnings": current_user.daily_earnings + task.reward
        }
        await storage.update_user(current_user.id, updates)
        
        # Увеличиваем счетчик выполнений задания
        await storage.increment_task_completion_count(task_id)
        
        # Создаем транзакцию награды
        transaction_data = TransactionCreate(
            user_id=current_user.id,
            type="task_reward",
            currency="stars",
            amount=Decimal(str(task.reward)),
            status="completed",
            description=f"Task reward: {task.title}"
        )
        await storage.create_transaction(transaction_data)
        
        return {"success": True, "reward": task.reward}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error completing task: {e}")
        raise HTTPException(status_code=500, detail="Failed to complete task")

# Заглушки для проверки
async def verify_task_action(action: str, user: User) -> bool:
    """Заглушка проверки выполнения действия"""
    # TODO: реализовать проверки для каждого типа действия
    action_handlers = {
        'daily_login': lambda: True,
        'share_app': lambda: True,
        'follow_channel': lambda: True,
        'invite_friends': lambda: True,
        'complete_purchase': lambda: True,
        'visit_website': lambda: True,
    }
    
    handler = action_handlers.get(action)
    return handler() if handler else True

async def check_task_requirements(user: User, requirements_json: str, storage: Storage) -> bool:
    """Проверка требований для выполнения задания"""
    try:
        if not requirements_json:
            return True
            
        requirements = json.loads(requirements_json)
        
        # Проверка минимального уровня (по количеству выполненных заданий)
        if 'minLevel' in requirements:
            if user.tasks_completed < requirements['minLevel']:
                return False
                
        # Проверка выполненных заданий
        if 'completedTasks' in requirements:
            for required_task_id in requirements['completedTasks']:
                user_task = await storage.get_user_task(user.id, required_task_id)
                if not user_task or not user_task.completed:
                    return False
                    
        return True
    except json.JSONDecodeError:
        return True  # Если JSON невалидный, разрешаем выполнение

# Referral routes
@app.get("/api/referrals/stats", response_model=ReferralStats)
async def get_referral_stats(
    current_user: User = Depends(get_authenticated_user),
    storage: Storage = Depends(get_storage)
):
    try:
        all_users = await storage.get_all_users()
        referrals = [u for u in all_users if u.referred_by == current_user.id]
        
        referral_list = []
        for r in referrals:
            referral_list.append({
                "id": r.id,
                "username": r.username,
                "first_name": r.first_name,
                "created_at": r.created_at.isoformat()
            })
        
        return ReferralStats(
            total_referrals=len(referrals),
            total_earnings=current_user.total_referral_earnings or 0,
            referral_code=current_user.referral_code,
            referrals=referral_list
        )
    except Exception as e:
        logger.error(f"Error getting referral stats: {e}")
        raise HTTPException(status_code=500, detail="Failed to get referral stats")

# Payment webhook and status routes
@app.post("/api/payment/webhook/robokassa")
async def robokassa_webhook(
    request: Request,
    storage: Storage = Depends(get_storage)
):
    """Handle Robokassa payment webhook"""
    try:
        robokassa = get_robokassa()
        if not robokassa:
            raise HTTPException(status_code=500, detail="Payment system not configured")
        
        # Parse form data
        form_data = await request.form()
        webhook_data = dict(form_data)
        
        logger.info(f"Received Robokassa webhook: {webhook_data}")
        
        # Verify signature
        if not robokassa.verify_payment_result(webhook_data):
            logger.error("Invalid Robokassa signature")
            raise HTTPException(status_code=400, detail="Invalid signature")
        
        invoice_id = webhook_data.get('InvId')
        out_sum = webhook_data.get('OutSum')
        
        if not invoice_id:
            raise HTTPException(status_code=400, detail="Missing InvId")
        
        # Find transaction by invoice_id
        from sqlalchemy import select
        from models import Transaction
        
        result = await storage.db.execute(
            select(Transaction).where(Transaction.invoice_id == invoice_id)
        )
        transaction = result.scalar_one_or_none()
        
        if not transaction:
            logger.error(f"Transaction not found for invoice_id: {invoice_id}")
            raise HTTPException(status_code=404, detail="Transaction not found")
        
        # Update transaction status
        updates = {
            "status": "completed",
            "paid_at": datetime.utcnow(),
            "payment_data": json.dumps(webhook_data)
        }
        
        await storage.update_transaction(transaction.id, updates)
        
        # Update user balance
        user = await storage.get_user(transaction.user_id)
        if user and transaction.type in ["buy_stars", "buy_ton"]:
            if transaction.currency == "stars":
                user_updates = {
                    "stars_balance": user.stars_balance + int(transaction.amount),
                    "total_stars_earned": user.total_stars_earned + int(transaction.amount)
                }
                await storage.update_user(user.id, user_updates)
                logger.info(f"Added {transaction.amount} stars to user {user.telegram_id}")
            elif transaction.currency == "ton":
                logger.info(f"TON purchase completed for user {user.telegram_id}: {transaction.amount} TON")
                # TON is sent to Telegram wallet - no balance update needed
            
            logger.info(f"Payment completed for invoice {invoice_id}, amount: {out_sum} RUB")
        
        return {"status": "OK"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error processing webhook: {e}")
        raise HTTPException(status_code=500, detail="Webhook processing failed")

@app.get("/api/payment/status/{transaction_id}", response_model=PaymentStatusResponse)
async def get_payment_status(
    transaction_id: str,
    current_user: User = Depends(get_authenticated_user),
    storage: Storage = Depends(get_storage)
):
    """Get payment status for transaction"""
    try:
        transaction = await storage.get_transaction(transaction_id)
        
        if not transaction:
            raise HTTPException(status_code=404, detail="Transaction not found")
        
        # Check if transaction belongs to current user
        if transaction.user_id != current_user.id:
            raise HTTPException(status_code=403, detail="Access denied")
        
        # If pending and has invoice_id, check with payment system
        if transaction.status == "pending" and transaction.invoice_id:
            robokassa = get_robokassa()
            if robokassa:
                payment_status = await robokassa.check_payment_status(transaction.invoice_id)
                
                if payment_status and payment_status['status'] == 'paid':
                    # Update transaction status
                    updates = {
                        "status": "completed",
                        "paid_at": datetime.utcnow(),
                        "payment_data": payment_status['response']
                    }
                    await storage.update_transaction(transaction.id, updates)
                    
                    # Update user balance
                    if transaction.currency == "stars":
                        user_updates = {
                            "stars_balance": current_user.stars_balance + int(transaction.amount),
                            "total_stars_earned": current_user.total_stars_earned + int(transaction.amount)
                        }
                        await storage.update_user(current_user.id, user_updates)
                    
                    transaction.status = "completed"
                    transaction.paid_at = datetime.utcnow()
        
        return PaymentStatusResponse(
            transaction_id=transaction.id,
            status=transaction.status,
            paid_at=transaction.paid_at
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting payment status: {e}")
        raise HTTPException(status_code=500, detail="Failed to get payment status")

# Admin routes
@app.get("/api/admin/stats", response_model=AdminStats)
async def get_admin_stats(storage: Storage = Depends(get_storage)):
    try:
        users = await storage.get_all_users()
        transactions = await storage.get_recent_transactions(50)
        completed_transactions = [t for t in transactions if t.status == "completed"]
        
        # Calculate today's sales
        today = date.today()
        today_sales = sum(
            float(t.rub_amount or 0) 
            for t in completed_transactions 
            if t.created_at.date() == today
        )
        
        active_referrals = len([u for u in users if u.referred_by])
        
        # Recent transactions with user info
        recent_transactions = []
        for t in transactions[:10]:
            user = next((u for u in users if u.id == t.user_id), None)
            recent_transactions.append({
                "id": t.id,
                "username": user.username if user else "Unknown",
                "description": t.description,
                "status": t.status,
                "created_at": t.created_at.isoformat()
            })
        
        return AdminStats(
            total_users=len(users),
            today_sales=f"{today_sales:.2f}",
            active_referrals=active_referrals,
            recent_transactions=recent_transactions
        )
    except Exception as e:
        logger.error(f"Error getting admin stats: {e}")
        raise HTTPException(status_code=500, detail="Failed to get admin stats")

@app.put("/api/admin/settings")
async def update_admin_settings(
    settings: AdminSettingsUpdate,
    storage: Storage = Depends(get_storage)
):
    try:
        if settings.stars_price:
            await storage.update_setting("stars_price", settings.stars_price)
        if settings.ton_price:
            await storage.update_setting("ton_price", settings.ton_price)
        if settings.markup_percentage:
            await storage.update_setting("markup_percentage", settings.markup_percentage)
        
        return {"success": True}
    except Exception as e:
        logger.error(f"Error updating settings: {e}")
        raise HTTPException(status_code=500, detail="Failed to update settings")


def verify_task_admin(token: str) -> bool:
    """Проверка токена администратора заданий из .env"""
    admin_tokens = os.getenv('ADMIN_TOKENS', '').split(',')
    admin_tokens = [t.strip() for t in admin_tokens if t.strip()]  # Убираем пробелы
    return token in admin_tokens

# НОВЫЕ ENDPOINTS для админки заданий:

@app.post("/api/admin/tasks/create")
async def create_task_admin(
    task_data: dict,
    token: str,
    storage: Storage = Depends(get_storage)
):
    """Создание нового задания администратором"""
    if not verify_task_admin(token):
        raise HTTPException(status_code=403, detail="Access denied")
    
    try:
        # Заглушка для проверки выполнения
        def verify_task_completion():
            return True
        
        new_task = await storage.create_task({
            "title": task_data["title"],
            "description": task_data["description"], 
            "reward": task_data["reward"],
            "type": task_data["type"],
            "action": task_data.get("action"),
            "status": task_data.get("status", "active"),
            "deadline": task_data.get("deadline"),
            "max_completions": task_data.get("maxCompletions"),
            "requirements": task_data.get("requirements"),
            "is_active": task_data.get("isActive", True)
        })
        
        # Уведомляем пользователей о новом задании
        if new_task.status == "active":
            await notify_users_new_task(new_task)
        
        return {"success": True, "task": new_task}
    except Exception as e:
        logger.error(f"Error creating task: {e}")
        raise HTTPException(status_code=500, detail="Failed to create task")

@app.get("/api/admin/tasks/list")
async def list_tasks_admin(
    token: str,
    storage: Storage = Depends(get_storage)
):
    """Получение списка всех заданий для админки"""
    if not verify_task_admin(token):
        raise HTTPException(status_code=403, detail="Access denied")
    
    tasks = await storage.get_all_tasks_with_stats()
    return tasks

@app.put("/api/admin/tasks/{task_id}")
async def update_task_admin(
    task_id: str,
    task_data: dict,
    token: str,
    storage: Storage = Depends(get_storage)
):
    """Обновление задания"""
    if not verify_task_admin(token):
        raise HTTPException(status_code=403, detail="Access denied")
    
    updated_task = await storage.update_task(task_id, task_data)
    return {"success": True, "task": updated_task}

@app.delete("/api/admin/tasks/{task_id}")
async def delete_task_admin(
    task_id: str,
    token: str,
    storage: Storage = Depends(get_storage)
):
    """Архивация задания"""
    if not verify_task_admin(token):
        raise HTTPException(status_code=403, detail="Access denied")
    
    await storage.update_task(task_id, {"status": "expired", "is_active": False})
    return {"success": True}

# Функция уведомлений (заглушка)
async def notify_users_new_task(task):
    """Уведомление пользователей о новом задании"""
    # TODO: реализовать уведомления через Telegram бота
    logger.info(f"New task created: {task.title}")
    pass


# Static files for production
if not os.getenv("DEVELOPMENT"):
    app.mount("/", StaticFiles(directory="dist/public", html=True), name="static")
    
    @app.get("/{path:path}")
    async def serve_spa(path: str):
        return FileResponse("dist/public/index.html")

# Startup event
@app.on_event("startup")
async def startup_event():
    await init_db()
    await init_default_data()
    logger.info("Database initialized")

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=port,
        reload=True if os.getenv("DEVELOPMENT") else False
    )