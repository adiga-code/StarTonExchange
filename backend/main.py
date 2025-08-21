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
from api import AsyncFragmentAPIClient
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
    allow_origins=["http://localhost:3000", "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Логирование в файл
def log_event(event_type: str, details: str):
    """Записать событие в лог файл"""
    try:
        os.makedirs("logs", exist_ok=True)
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        log_entry = f"{timestamp} - {event_type} - {details}\n"
        
        with open("logs/admin.log", "a", encoding="utf-8") as f:
            f.write(log_entry)
            f.flush()
    except Exception as e:
        logger.error(f"Failed to write log: {e}")

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
        user = await storage.create_user(user_data)
        
        # Логируем регистрацию пользователя
        log_event("USER_REGISTERED", 
                 f"telegram_id: {user.telegram_id} username: {user.username or 'None'} referrer: {user.referred_by or 'None'}")
        
        return user
    except Exception as e:
        logger.error(f"Error creating user: {e}")
        raise HTTPException(status_code=500, detail="Failed to create user")

@app.get("/api/users/me", response_model=UserResponse)
async def get_current_user_info(current_user: User = Depends(get_authenticated_user)):
    return current_user

# Purchase calculation route
@app.post("/api/purchase/calculate", response_model=PurchaseCalculateResponse)
async def calculate_purchase_price(
    purchase_data: PurchaseCalculate,
    storage: Storage = Depends(get_storage)
):
    try:
        if purchase_data.currency not in ['stars', 'ton']:
            raise HTTPException(status_code=400, detail="Invalid currency")
        
        # Получаем настройки
        stars_price_setting = await storage.get_setting("stars_price")
        ton_price_setting = await storage.get_setting("ton_price")
        ton_markup_setting = await storage.get_setting("ton_markup_percentage")
        official_stars_price_setting = await storage.get_setting("telegram_stars_official_price")
        
        stars_price = float(stars_price_setting.value if stars_price_setting else "2.30")
        ton_price = float(ton_price_setting.value if ton_price_setting else "420.50")
        ton_markup = float(ton_markup_setting.value if ton_markup_setting else "5") / 100
        official_stars_price = float(official_stars_price_setting.value if official_stars_price_setting else "180")
        
        if purchase_data.currency == 'stars':
            # Для звезд: без наценки, с экономией
            base_price = purchase_data.amount * stars_price
            total_price = base_price
            savings_percentage = round(((official_stars_price - stars_price) / official_stars_price) * 100)
            
            return PurchaseCalculateResponse(
                base_price=f"{base_price:.2f}",
                savings_percentage=savings_percentage,
                total_price=f"{total_price:.2f}",
                currency=purchase_data.currency,
                amount=purchase_data.amount
            )
        else:
            # Для TON: только итоговая цена с наценкой
            base_price = purchase_data.amount * ton_price
            total_price = base_price * (1 + ton_markup)
            
            return PurchaseCalculateResponse(
                total_price=f"{total_price:.2f}",
                currency=purchase_data.currency,
                amount=purchase_data.amount
            )
            
    except Exception as e:
        logger.error(f"Error calculating price: {e}")
        raise HTTPException(status_code=500, detail="Failed to calculate price")

# Публичные настройки
@app.get("/api/settings/public", response_model=PublicSettings)
async def get_public_settings(storage: Storage = Depends(get_storage)):
    try:
        referral_setting = await storage.get_setting("referral_percentage")
        official_price_setting = await storage.get_setting("telegram_stars_official_price")
        
        return PublicSettings(
            telegram_stars_official_price=int(official_price_setting.value if official_price_setting else "180"),
            referral_percentage=int(referral_setting.value if referral_setting else "10")
        )
    except Exception as e:
        logger.error(f"Error getting public settings: {e}")
        raise HTTPException(status_code=500, detail="Failed to get settings")

# Purchase route
@app.post("/api/purchase", response_model=PaymentCreateResponse)
async def make_purchase(
    purchase_data: PurchaseRequest,
    current_user: User = Depends(get_authenticated_user),
    storage: Storage = Depends(get_storage)
):
    try:
        # Validate currency
        if purchase_data.currency not in ['stars', 'ton']:
            raise HTTPException(status_code=400, detail="Invalid currency")
        
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
        
        # Логируем создание транзакции
        log_event("TRANSACTION_CREATED", 
                 f"user: {current_user.telegram_id} type: {transaction.type} amount: {transaction.amount} {transaction.currency}")
        
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

# Payment status route
@app.get("/api/payment/status/{transaction_id}", response_model=PaymentStatusResponse)
async def get_payment_status(
    transaction_id: str,
    current_user: User = Depends(get_authenticated_user),
    storage: Storage = Depends(get_storage)
):
    try:
        transaction = await storage.get_transaction(transaction_id)
        if not transaction or transaction.user_id != current_user.id:
            raise HTTPException(status_code=404, detail="Transaction not found")
        
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
        # Получаем задание для логирования
        task = await storage.get_task(task_id)
        if not task:
            raise HTTPException(status_code=404, detail="Task not found")
        
        # Check if user already completed this task
        user_task = await storage.get_user_task(current_user.id, task_id)
        if user_task and user_task.completed:
            raise HTTPException(status_code=400, detail="Task already completed")
        
        # Complete the task
        if not user_task:
            user_task_data = UserTaskCreate(user_id=current_user.id, task_id=task_id, completed=True)
            await storage.create_user_task(user_task_data)
        else:
            await storage.complete_user_task(current_user.id, task_id)
        
        # Add reward to user balance
        await storage.update_user(current_user.id, {
            "stars_balance": current_user.stars_balance + task.reward,
            "total_stars_earned": current_user.total_stars_earned + task.reward,
            "tasks_completed": current_user.tasks_completed + 1,
            "daily_earnings": current_user.daily_earnings + task.reward
        })
        
        # Логируем выполнение задания
        log_event("TASK_COMPLETED", 
                 f"user: {current_user.telegram_id} task: \"{task.title}\" reward: {task.reward}")
        
        return {"success": True, "reward": task.reward}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error completing task: {e}")
        raise HTTPException(status_code=500, detail="Failed to complete task")

# Referrals route
@app.get("/api/referrals/stats", response_model=ReferralStats)
async def get_referral_stats(
    current_user: User = Depends(get_authenticated_user),
    storage: Storage = Depends(get_storage)
):
    try:
        # This would be implemented to get actual referral stats
        # For now, return basic data
        return ReferralStats(
            total_referrals=0,
            total_earnings=current_user.total_referral_earnings,
            referral_code=current_user.referral_code,
            referrals=[]
        )
    except Exception as e:
        logger.error(f"Error getting referral stats: {e}")
        raise HTTPException(status_code=500, detail="Failed to get referral stats")

# Admin routes
@app.get("/api/admin/stats", response_model=AdminStats)
async def get_admin_stats(storage: Storage = Depends(get_storage)):
    try:
        users = await storage.get_all_users()
        transactions = await storage.get_recent_transactions(limit=10)
        
        # Calculate today's sales
        today = date.today()
        today_sales = sum(
            float(t.rub_amount or 0) for t in transactions 
            if t.created_at.date() == today and t.status == "completed"
        )
        
        # Count active referrals (users with referrals)
        active_referrals = sum(1 for user in users if user.total_referral_earnings > 0)
        
        # Format recent transactions for display
        recent_transactions = [
            {
                "id": t.id,
                "amount": str(t.amount),
                "currency": t.currency,
                "status": t.status,
                "created_at": t.created_at.isoformat(),
                "user": {"telegram_id": t.user.telegram_id if hasattr(t, 'user') and t.user else None}
            }
            for t in transactions[:5]
        ]
        
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
        changes = []
        
        if settings.stars_price:
            old_val = await storage.get_setting("stars_price")
            await storage.update_setting("stars_price", settings.stars_price)
            changes.append(f"stars_price: {old_val.value if old_val else 'None'}->{settings.stars_price}")
        
        if settings.ton_price:
            old_val = await storage.get_setting("ton_price")
            await storage.update_setting("ton_price", settings.ton_price)
            changes.append(f"ton_price: {old_val.value if old_val else 'None'}->{settings.ton_price}")
        
        if settings.ton_markup_percentage:
            old_val = await storage.get_setting("ton_markup_percentage")
            await storage.update_setting("ton_markup_percentage", settings.ton_markup_percentage)
            changes.append(f"ton_markup_percentage: {old_val.value if old_val else 'None'}->{settings.ton_markup_percentage}")
        
        if settings.referral_percentage:
            old_val = await storage.get_setting("referral_percentage")
            await storage.update_setting("referral_percentage", settings.referral_percentage)
            changes.append(f"referral_percentage: {old_val.value if old_val else 'None'}->{settings.referral_percentage}")
        
        if changes:
            log_event("SETTINGS_UPDATE", ", ".join(changes))
        
        return {"success": True}
    except Exception as e:
        logger.error(f"Error updating settings: {e}")
        raise HTTPException(status_code=500, detail="Failed to update settings")

def verify_task_admin(token: str) -> bool:
    """Проверка токена администратора заданий из .env"""
    admin_tokens = os.getenv('ADMIN_TOKENS', '').split(',')
    admin_tokens = [t.strip() for t in admin_tokens if t.strip()]
    return token in admin_tokens

# Admin tasks endpoints
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
        new_task = await storage.create_task(task_data)
        
        # Логируем создание задания
        log_event("TASK_CREATED", 
                 f'"{new_task.title}" reward: {new_task.reward} type: {new_task.type} action: {new_task.action or "None"}')
        
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
    
    try:
        updated_task = await storage.update_task(task_id, task_data)
        return {"success": True, "task": updated_task}
    except Exception as e:
        logger.error(f"Error updating task: {e}")
        raise HTTPException(status_code=500, detail="Failed to update task")

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

# Завершение транзакции с логированием
async def complete_transaction(transaction_id: str, payment_data: dict):
    """Завершить транзакцию и обновить баланс пользователя"""
    async with AsyncSessionLocal() as session:
        storage_instance = Storage(session)
        
        transaction = await storage_instance.get_transaction(transaction_id)
        if not transaction or transaction.status == "completed":
            return
        
        # Обновляем статус транзакции
        await storage_instance.update_transaction(transaction_id, {
            "status": "completed",
            "paid_at": datetime.utcnow(),
            "payment_data": str(payment_data)
        })
        
        # Обновляем баланс пользователя
        user = await storage_instance.get_user(transaction.user_id)
        if user:
            if transaction.currency == "stars":
                new_balance = user.stars_balance + int(transaction.amount)
                await storage_instance.update_user(user.id, {"stars_balance": new_balance})
            elif transaction.currency == "ton":
                new_balance = user.ton_balance + transaction.amount
                await storage_instance.update_user(user.id, {"ton_balance": new_balance})
        
        # Логируем завершение транзакции
        log_event("TRANSACTION_COMPLETED", 
                 f"user: {user.telegram_id if user else 'Unknown'} type: {transaction.type} amount: {transaction.amount} {transaction.currency}")

# Health check endpoint
@app.get("/api/health")
async def health_check():
    return {"status": "healthy", "timestamp": datetime.now().isoformat()}

# Photo API route
@app.get("/api/getPhoto")
async def get_photo(username: str):
    try:
        client = await ensure_telegram_connection()
        if not client:
            return {"success": False, "error": "Service temporarily unavailable"}
        
        user = await client.get_users(username)
        if user.photo:
            photo_url = f"https://t.me/i/userpic/160/{user.id}.jpg"
            return {
                "success": True,
                "photo_url": photo_url,
                "first_name": user.first_name or "User"
            }
        else:
            return {"success": False, "error": "No photo"}
    except (UsernameNotOccupied, UsernameInvalid):
        return {"success": False, "error": "User not found"}
    except Exception as e:
        logger.error(f"Error getting photo for {username}: {e}")
        return {"success": False, "error": "Service temporarily unavailable"}

# Static files for production
if not os.getenv("DEVELOPMENT"):
    app.mount("/", StaticFiles(directory="dist/public", html=True), name="static")
    
    @app.get("/{path:path}")
    async def serve_spa(path: str):
        return FileResponse("dist/public/index.html")

@app.on_event("startup")
async def startup_event():
    await init_db()
    await init_default_data()
    logger.info("Database initialized")
    
    # Инициализация Fragment API клиента
    logger.info("Starting Fragment API initialization...")
    fragment_seed = os.getenv("FRAGMENT_SEED")
    fragment_cookies = os.getenv("FRAGMENT_COOKIE")
    
    logger.info(f"FRAGMENT_SEED length: {len(fragment_seed) if fragment_seed else 'None'}")
    logger.info(f"FRAGMENT_COOKIE length: {len(fragment_cookies) if fragment_cookies else 'None'}")
    
    try:
        if fragment_seed and fragment_cookies:
            logger.info("Creating Fragment API client...")
            app.state.fragment_api_client = AsyncFragmentAPIClient(
                seed=fragment_seed,
                fragment_cookies=fragment_cookies
            )
            logger.info("Fragment API client initialized successfully")
              
            balance = await app.state.fragment_api_client.get_balance()
            logger.info(f"Fragment API balance: {balance}")
        else:
            logger.warning("Fragment API credentials not found, client not initialized")
            app.state.fragment_api_client = None
            
    except Exception as e:
        logger.error(f"Failed to initialize Fragment API client: {e}", exc_info=True)
        app.state.fragment_api_client = None

@app.on_event("shutdown")
async def shutdown_event():
    # Правильное закрытие Fragment API клиента
    if hasattr(app.state, 'fragment_api_client') and app.state.fragment_api_client:
        try:
            await app.state.fragment_api_client.close()
            logger.info("Fragment API client closed")
        except Exception as e:
            logger.error(f"Error closing Fragment API client: {e}")
    
    # Close database session
    try:
        await AsyncSessionLocal().close()
        logger.info("Database session closed")
    except Exception as e:
        logger.error(f"Error closing database session: {e}")

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=port,
        reload=True if os.getenv("DEVELOPMENT") else False
    )