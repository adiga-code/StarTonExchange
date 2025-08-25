from fastapi import FastAPI, Depends, HTTPException, Header, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime, timedelta
from sqlalchemy import func, and_, select
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
from ton_price_service import ton_price_service

# Load environment variables
load_dotenv()

from database import get_db, init_db, init_default_data, AsyncSessionLocal
from api import AsyncFragmentAPIClient
from storage import Storage
from telegram_auth import get_current_user
from robokassa import get_robokassa
from schemas import *
from models import User, Transaction
import json

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Stars Exchange API", version="1.0.0")
# CORS middleware for development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173", "https://app1.hezh-digital.ru", ],  # Vite dev server
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
    try:
        yield Storage(db)
        await db.commit()
    except:
        await db.rollback()
        raise
    finally:
        await db.close()

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
    user_data: UserUpdate,
    current_user: User = Depends(get_authenticated_user),
    storage: Storage = Depends(get_storage)
):
    """Обновить данные текущего пользователя"""
    try:
        # Создаем словарь только с переданными данными (не None)
        update_data = {}
        if user_data.username is not None:
            update_data["username"] = user_data.username
        if user_data.first_name is not None:
            update_data["first_name"] = user_data.first_name
        if user_data.last_name is not None:
            update_data["last_name"] = user_data.last_name  
        if user_data.notifications_enabled is not None:
            update_data["notifications_enabled"] = user_data.notifications_enabled
            
        if not update_data:
            # Если нет данных для обновления, просто возвращаем текущего пользователя
            return current_user
            
        # Обновляем пользователя
        updated_user = await storage.update_user(current_user.id, update_data)
        
        if not updated_user:
            raise HTTPException(status_code=404, detail="User not found")
            
        logger.info(f"User {current_user.telegram_id} updated: {update_data}")
        return updated_user
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating user: {e}")
        raise HTTPException(status_code=500, detail="Failed to update user")

@app.get("/api/transactions/history", response_model=TransactionHistoryResponse)
async def get_user_transactions_history(
    current_user: User = Depends(get_authenticated_user),
    storage: Storage = Depends(get_storage)
):
    """Получить историю транзакций пользователя"""
    try:
        logger.info(f"Getting transaction history for user: {current_user.id}")
        
        # Получаем все транзакции пользователя
        transactions = await storage.get_transactions_by_user_id(current_user.id)
        logger.info(f"Found {len(transactions)} transactions for user")
        
        # Фильтруем только покупки (тип "purchase" или "buy_stars"/"buy_ton")
        purchase_transactions = [
            t for t in transactions 
            if t.type in ["purchase", "buy_stars", "buy_ton"]
        ]
        
        # Преобразуем в нужный формат для фронтенда
        transaction_history = []
        
        for transaction in purchase_transactions:
            try:
                # Определяем тип транзакции и иконку
                if transaction.currency == "stars":
                    icon_type = "stars"
                    currency_symbol = "⭐"
                    description = f"Покупка {int(transaction.amount)} звезд"
                elif transaction.currency == "ton":
                    icon_type = "ton"  
                    currency_symbol = "💎"
                    description = f"Покупка {float(transaction.amount)} TON"
                else:
                    icon_type = "purchase"
                    currency_symbol = "💰"
                    description = transaction.description or "Покупка"
                
                # Определяем статус и его цвет
                status_map = {
                    "pending": {"text": "Ожидание", "color": "#F59E0B"},
                    "completed": {"text": "Завершено", "color": "#10B981"},
                    "failed": {"text": "Ошибка", "color": "#EF4444"},
                    "cancelled": {"text": "Отменено", "color": "#6B7280"}
                }
                
                status_info = status_map.get(transaction.status, {
                    "text": transaction.status.capitalize(), 
                    "color": "#6B7280"
                })
                
                # Форматируем дату с русскими месяцами
                month_names = {
                    1: "янв", 2: "фев", 3: "мар", 4: "апр", 5: "май", 6: "июн",
                    7: "июл", 8: "авг", 9: "сен", 10: "окт", 11: "ноя", 12: "дек"
                }
                
                created_date = transaction.created_at
                if created_date:
                    formatted_date = f"{created_date.day} {month_names[created_date.month]} {created_date.year}, {created_date.strftime('%H:%M')}"
                    iso_date = created_date.isoformat()
                else:
                    formatted_date = "Дата неизвестна"
                    iso_date = "1970-01-01T00:00:00"
                
                # Безопасное преобразование сумм
                amount = float(transaction.amount) if transaction.amount else 0.0
                rub_amount = float(transaction.rub_amount) if transaction.rub_amount else None
                
                transaction_item = {
                    "id": transaction.id,
                    "description": description,
                    "amount": amount,
                    "currency": transaction.currency,
                    "rub_amount": rub_amount,
                    "status": transaction.status,
                    "status_text": status_info["text"],
                    "status_color": status_info["color"],
                    "icon_type": icon_type,
                    "created_at": iso_date,
                    "created_at_formatted": formatted_date
                }
                
                transaction_history.append(transaction_item)
                
            except Exception as e:
                logger.error(f"Error processing transaction {transaction.id}: {e}")
                # Пропускаем проблемные транзакции, но не падаем
                continue
        
        # Сортируем по дате создания (новые сверху)
        transaction_history.sort(key=lambda x: x["created_at"], reverse=True)
        
        result = {
            "success": True, 
            "transactions": transaction_history,
            "count": len(transaction_history)
        }
        
        logger.info(f"Returning {len(transaction_history)} transactions for user")
        return result
        
    except Exception as e:
        logger.error(f"Error getting transactions history for user {current_user.id}: {e}", exc_info=True)
        # Возвращаем пустую историю вместо ошибки
        return {
            "success": False,
            "transactions": [],
            "count": 0
        }

@app.get("/api/getPhoto")
async def get_photo(username: str):
    logger.info(f"Getting photo for username: {username}")
    
    try:
        logger.info(f"Getting photo for username: {username}")
        # Добавляем проверку на существование fragment_api_client
        if not hasattr(app.state, 'fragment_api_client') or app.state.fragment_api_client is None:
            logger.warning("Fragment API client not initialized")
            # Возвращаем аватар по умолчанию
            avatar_url = f"https://ui-avatars.com/api/?name={username}&size=128&background=4E7FFF&color=fff"
            return {
                "photo_url": avatar_url,
                "first_name": username,
                "success": True
            }
        
        # Вызываем get_user_info с обработкой ошибок
        user_info = await app.state.fragment_api_client.get_user_info(username)
        
        # Проверяем результат
        if not user_info or not isinstance(user_info, dict):
            logger.warning(f"Invalid response from Fragment API for user {username}")
            raise Exception("Invalid API response")
            
        if not user_info.get('success') or not user_info.get('found'):
            logger.warning(f"User {username} not found in Fragment API")
            # Возвращаем аватар по умолчанию
            avatar_url = f"https://ui-avatars.com/api/?name={username}&size=128&background=4E7FFF&color=fff"
            return {
                "photo_url": avatar_url,
                "first_name": username,
                "success": True
            }
        
        # Получаем данные пользователя из ответа API
        user_name = user_info.get('name') or user_info.get('username') or username
        photo_html = user_info.get('photo', '')
        
        logger.info(f"Found user: {user_name}, has_photo: {bool(photo_html)}")
        
        # Пытаемся извлечь URL фото из HTML
        if photo_html and photo_html.strip():
            try:
                import re
                src_match = re.search(r'src="([^"]*)"', photo_html)
                if src_match:
                    photo_url = src_match.group(1)
                    return {
                        "photo_url": photo_url,
                        "first_name": user_name,
                        "success": True
                    }
                else:
                    logger.warning(f"Could not extract src from photo HTML: {photo_html}")
            except Exception as photo_error:
                logger.error(f"Error extracting photo URL: {photo_error}")
        
        # Если фото нет или произошла ошибка, используем аватар по умолчанию
        avatar_url = f"https://ui-avatars.com/api/?name={user_name}&size=128&background=4E7FFF&color=fff"
        return {
            "photo_url": avatar_url,
            "first_name": user_name,
            "success": True
        }
            
    except Exception as e:
        # Логируем полную ошибку для отладки
        logger.error(f"Error getting photo for {username}: {str(e)}", exc_info=True)
        
        # Возвращаем аватар по умолчанию даже при ошибке
        avatar_url = f"https://ui-avatars.com/api/?name={username}&size=128&background=4E7FFF&color=fff"
        return {
            "photo_url": avatar_url,
            "first_name": username,
            "success": True
        }

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
        
        prices = {
            "stars": float(await storage.get_cached_setting("stars_price")),
            "ton": await ton_price_service.get_current_ton_price_rub(storage),
        }
        
        # Рассчитываем цену без наценки
        total_price = purchase_data.amount * prices[purchase_data.currency]
        
        # Для звезд добавляем информацию об экономии
        if purchase_data.currency == "stars":
            OFFICIAL_STARS_PRICE = 1.8  # Константа официальной цены
            official_total = purchase_data.amount * OFFICIAL_STARS_PRICE
            savings = official_total - total_price
            savings_percentage = (savings / official_total) * 100 if official_total > 0 else 0
            
            return PurchaseCalculateResponse(
                base_price=f"{total_price:.2f}",
                currency=purchase_data.currency,
                amount=purchase_data.amount,
                official_price=f"{official_total:.2f}",
                savings_amount=f"{savings:.2f}",
                savings_percentage=f"{savings_percentage:.1f}"
            )
        else:
            # Для TON только базовая цена
            return PurchaseCalculateResponse(
                base_price=f"{total_price:.2f}",
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
        
        # Validate minimum amounts
        min_amounts = {"stars": 50, "ton": 0.1}
        if purchase_data.amount < min_amounts[purchase_data.currency]:
            raise HTTPException(
                status_code=400, 
                detail=f"Minimum amount for {purchase_data.currency} is {min_amounts[purchase_data.currency]}"
            )
        
        robokassa = get_robokassa()
        if not robokassa:
            raise HTTPException(status_code=500, detail="Payment system not configured")
        
        # Get current prices without markup
        prices = {
            "stars": float(await storage.get_cached_setting("stars_price")),
            "ton": await ton_price_service.get_current_ton_price_rub(storage),
        }
        
        # Calculate total price without markup
        calculated_total = purchase_data.amount * prices[purchase_data.currency]
        
        # Verify that the sent rub_amount matches our calculation
        if abs(calculated_total - purchase_data.rub_amount) > 0.01:  # Allow 1 kopeck difference
            raise HTTPException(
                status_code=400, 
                detail=f"Price mismatch. Expected: {calculated_total:.2f}, got: {purchase_data.rub_amount:.2f}"
            )
        
        # Generate unique invoice ID
        import uuid
        invoice_id = str(uuid.uuid4())
        
        # Create transaction record
        transaction_data = TransactionCreate(
            user_id=current_user.id,
            type="purchase",
            currency=purchase_data.currency,
            amount=Decimal(str(purchase_data.amount)),
            rub_amount=Decimal(str(purchase_data.rub_amount)),
            status="pending",
            description=f"Покупка {purchase_data.amount} {purchase_data.currency}",
            payment_system="robokassa",
            invoice_id=invoice_id,
            recipient_username=purchase_data.username,
            ton_price_at_purchase=Decimal(str(prices["ton"])) if purchase_data.currency == "ton" else None
        )
        
        transaction = await storage.create_transaction(transaction_data)
        
        # Create payment URL
        payment_url = robokassa.create_payment_url(
            invoice_id=invoice_id,
            amount=Decimal(str(purchase_data.rub_amount)),
            description=f"Покупка {purchase_data.amount} {purchase_data.currency}",
            user_email=f"{current_user.telegram_id}@telegram.user"
        )
        
        # Update transaction with payment URL
        await storage.update_transaction(transaction.id, {"payment_url": payment_url})
        
        logger.info(f"Created payment for user {current_user.telegram_id}: {purchase_data.rub_amount} RUB for {purchase_data.amount} {purchase_data.currency}")
        
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
        
        # ✅ ДОБАВИТЬ ПРОВЕРКИ НОВЫХ ПОЛЕЙ (с fallback):
        task_status = getattr(task, 'status', 'active')
        if task_status != "active" or not task.is_active:
            raise HTTPException(status_code=400, detail="Task is not available")
            
        # Проверяем дедлайн (если есть)
        task_deadline = getattr(task, 'deadline', None)
        if task_deadline and datetime.now() > task_deadline:
            raise HTTPException(status_code=400, detail="Task deadline passed")
            
        # Проверяем максимум выполнений (если есть)
        task_max_completions = getattr(task, 'max_completions', None)
        task_completed_count = getattr(task, 'completed_count', 0)
        if task_max_completions and task_completed_count >= task_max_completions:
            raise HTTPException(status_code=400, detail="Task completion limit reached")

        # Проверяем уже выполненное задание
        existing_user_task = await storage.get_user_task(current_user.id, task_id)
        if existing_user_task and existing_user_task.completed:
            raise HTTPException(status_code=400, detail="Task already completed")
        
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
        
        # Увеличиваем счетчик выполнений задания (если метод существует)
        try:
            await storage.increment_task_completion_count(task_id)
        except:
            pass  # Игнорируем если метод не существует
        
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

@app.get("/api/referrals/stats", response_model=ReferralStats)
@app.get("/api/referrals/stats", response_model=ReferralStats)
async def get_referral_stats_v2(
    current_user: User = Depends(get_authenticated_user),
    storage: Storage = Depends(get_storage)
):
    try:
        logger.info(f"🎯 Getting referral stats for user: {current_user.id} (telegram: {current_user.telegram_id})")
        
        # Получаем всех рефералов пользователя
        referrals = await storage.get_user_referrals(current_user.id)
        
        logger.info(f"🎯 get_user_referrals returned: {len(referrals)} items")
        
        # Формируем список рефералов для ответа
        referral_list = []
        for referral in referrals:
            referral_data = {
                "id": referral.id,
                "username": referral.username or "",
                "first_name": referral.first_name or "",
                "created_at": referral.created_at.isoformat() if referral.created_at else None
            }
            referral_list.append(referral_data)
            logger.info(f"  📋 Added referral: {referral.id} ({referral.username})")
        
        result = ReferralStats(
            total_referrals=len(referral_list),  # Правильный подсчет
            total_earnings=current_user.total_referral_earnings or 0,
            referral_code=current_user.referral_code,
            referrals=referral_list
        )
        
        logger.info(f"🎯 Final result: total_referrals={result.total_referrals}")
        return result
        
    except Exception as e:
        logger.error(f"❌ Error getting referral stats for user {current_user.id}: {e}", exc_info=True)
        
        # Возвращаем пустые данные вместо ошибки
        fallback_result = ReferralStats(
            total_referrals=0,
            total_earnings=current_user.total_referral_earnings or 0,
            referral_code=current_user.referral_code,
            referrals=[]
        )
        logger.info(f"🎯 Returning fallback result: {fallback_result}")
        return fallback_result
    
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

@app.get("/api/admin/stats")
async def get_admin_stats(storage: Storage = Depends(get_storage)):
    try:
        logger.info("🚀 Starting admin stats collection...")
        
        # Сегодняшняя дата
        today = datetime.utcnow().date()
        today_start = datetime.combine(today, datetime.min.time())
        today_end = datetime.combine(today, datetime.max.time())
        logger.info(f"📅 Date range: {today_start} to {today_end}")
        
        # 1. Всего пользователей
        logger.info("👥 Getting total users...")
        total_users_result = await storage.db.execute(
            select(func.count(User.id))
        )
        total_users = total_users_result.scalar() or 0
        logger.info(f"👥 Total users: {total_users}")
        
        # 2. Продажи за сегодня
        logger.info("💰 Getting today sales...")
        today_sales_result = await storage.db.execute(
            select(func.coalesce(func.sum(Transaction.rub_amount), 0))
            .where(and_(
                Transaction.status == "completed",
                Transaction.created_at >= today_start,
                Transaction.created_at <= today_end,
                Transaction.type.in_(["buy_stars", "buy_ton"])
            ))
        )
        today_sales = float(today_sales_result.scalar() or 0)
        logger.info(f"💰 Today sales: {today_sales}")
        
        # 3. Активные рефералы
        logger.info("🔗 Getting active referrals...")
        active_referrals_result = await storage.db.execute(
            select(func.count(func.distinct(User.referred_by)))
            .where(User.referred_by.isnot(None))
        )
        active_referrals = active_referrals_result.scalar() or 0
        logger.info(f"🔗 Active referrals: {active_referrals}")
        
        # 4. Последние транзакции
        logger.info("📋 Getting recent transactions...")
        recent_transactions_result = await storage.db.execute(
            select(Transaction, User.username)
            .join(User, Transaction.user_id == User.id)
            .where(Transaction.type.in_(["buy_stars", "buy_ton", "referral_bonus"]))
            .order_by(Transaction.created_at.desc())
            .limit(10)
        )
        
        recent_transactions = []
        for transaction, username in recent_transactions_result.all():
            if transaction.type == "buy_stars":
                desc = f"Купил {int(transaction.amount)} звезд за ₽{transaction.rub_amount}"
            elif transaction.type == "buy_ton":
                desc = f"Купил {float(transaction.amount)} TON за ₽{transaction.rub_amount}"
            elif transaction.type == "referral_bonus":
                desc = f"Реферальный бонус: {int(transaction.amount)} звезд"
            else:
                desc = transaction.description or "Транзакция"
            
            recent_transactions.append({
                "id": transaction.id,
                "username": username or "Пользователь",
                "description": desc,
                "status": transaction.status,
                "createdAt": transaction.created_at.isoformat()
            })
        
        logger.info(f"📋 Found {len(recent_transactions)} recent transactions")
        
        result = {
            "totalUsers": total_users,
            "todaySales": f"{today_sales:.0f}",
            "activeReferrals": active_referrals,
            "recentTransactions": recent_transactions
        }
        
        logger.info(f"✅ Admin stats result: {result}")
        return result
        
    except Exception as e:
        logger.error(f"❌ Error getting admin stats: {e}", exc_info=True)
        # Более детальная информация об ошибке
        error_details = {
            "error_type": type(e).__name__,
            "error_message": str(e),
            "total_users_fallback": 0,
            "today_sales_fallback": "0",
            "active_referrals_fallback": 0,
            "recent_transactions_fallback": []
        }
        logger.error(f"❌ Error details: {error_details}")
        
        # В development режиме возвращаем детали ошибки
        if os.getenv("ENVIRONMENT") == "development":
            return error_details
        
        # В production возвращаем безопасные fallback значения
        return {
            "totalUsers": 0,
            "todaySales": "0",
            "activeReferrals": 0,
            "recentTransactions": []
        }

@app.get("/api/ton-price")
async def get_ton_price(storage: Storage = Depends(get_storage)):
    """Получить текущую цену TON в рублях"""
    try:
        price = await ton_price_service.get_current_ton_price_rub(storage)
        return {"price": f"{price:.2f}"}
    except Exception as e:
        logger.error(f"Error getting TON price: {e}")
        # Возвращаем fallback цену в случае ошибки
        fallback_price = await storage.get_cached_setting("ton_fallback_price")
        fallback = float(fallback_price) if fallback_price and fallback_price.strip() else 420.0
        return {"price": f"{fallback:.2f}"}

@app.put("/api/admin/settings")
async def update_admin_settings(
    settings: AdminSettingsUpdate,
    storage: Storage = Depends(get_storage)
):
    try:
        logger.info(f"🔥 Received settings update: {settings}")
        
        # Флаг для отслеживания изменений TON настроек
        ton_settings_changed = False
        
        # Обновляем только те настройки, которые переданы
        if settings.stars_price:
            logger.info(f"✅ Updating stars_price to: {settings.stars_price}")
            await storage.update_setting("stars_price", settings.stars_price)
            
        if settings.bot_base_url:
            logger.info(f"✅ Updating bot_base_url to: {settings.bot_base_url}")
            await storage.update_setting("bot_base_url", settings.bot_base_url)
            
        if settings.referral_prefix:
            logger.info(f"✅ Updating referral_prefix to: {settings.referral_prefix}")
            await storage.update_setting("referral_prefix", settings.referral_prefix)
            
        if settings.referral_bonus_percentage:
            logger.info(f"✅ Updating referral_bonus_percentage to: {settings.referral_bonus_percentage}")
            await storage.update_setting("referral_bonus_percentage", settings.referral_bonus_percentage)
            
        if settings.referral_registration_bonus:
            logger.info(f"✅ Updating referral_registration_bonus to: {settings.referral_registration_bonus}")
            await storage.update_setting("referral_registration_bonus", settings.referral_registration_bonus)
            
        # TON настройки - отслеживаем изменения
        if settings.ton_markup_percentage:
            logger.info(f"✅ Updating ton_markup_percentage to: {settings.ton_markup_percentage}")
            await storage.update_setting("ton_markup_percentage", settings.ton_markup_percentage)
            ton_settings_changed = True
            
        if settings.ton_price_cache_minutes:
            logger.info(f"✅ Updating ton_price_cache_minutes to: {settings.ton_price_cache_minutes}")
            await storage.update_setting("ton_price_cache_minutes", settings.ton_price_cache_minutes)
            ton_settings_changed = True
            
        if settings.ton_fallback_price:
            logger.info(f"✅ Updating ton_fallback_price to: {settings.ton_fallback_price}")
            await storage.update_setting("ton_fallback_price", settings.ton_fallback_price)
            ton_settings_changed = True
        
        # 🚀 АВТООБНОВЛЕНИЕ TON ЦЕНЫ ПРИ ИЗМЕНЕНИИ НАСТРОЕК
        updated_ton_price = None
        if ton_settings_changed:
            try:
                logger.info("🔄 TON settings changed, forcing price update...")
                
                # Очищаем кэш настроек в storage, чтобы получить новые значения
                if hasattr(storage, '_settings_cache'):
                    storage._settings_cache.clear()
                
                # Принудительно обновляем цену TON с новыми настройками
                updated_ton_price = await ton_price_service.force_update_price(storage)
                logger.info(f"✅ TON price auto-updated: {updated_ton_price:.2f} RUB")
                
            except Exception as price_update_error:
                logger.error(f"❌ Failed to auto-update TON price: {price_update_error}")
                # Не прерываем выполнение, так как основные настройки уже сохранены
        
        logger.info("✅ All settings updated successfully")
        
        # Возвращаем результат с информацией об обновлении цены
        result = {"success": True}
        if updated_ton_price is not None:
            result["ton_price_updated"] = True
            result["new_ton_price"] = f"{updated_ton_price:.2f}"
        
        return result
        
    except Exception as e:
        logger.error(f"❌ Error updating settings: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to update settings: {str(e)}")


def verify_task_admin(token: str) -> bool:
    """Проверка токена администратора заданий из .env"""
    admin_tokens = os.getenv('ADMIN_TOKENS', '').split(',')
    logger.info(f"Admin tokens: {admin_tokens}")
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
        # ✅ ПРАВИЛЬНАЯ ОБРАБОТКА ДАННЫХ:
        
        # Конвертируем пустые строки в None для опциональных полей
        deadline = task_data.get("deadline")
        if deadline == "" or deadline is None:
            deadline = None
        elif isinstance(deadline, str):
            try:
                # Пытаемся распарсить datetime из строки
                from datetime import datetime
                deadline = datetime.fromisoformat(deadline.replace('Z', '+00:00'))
            except:
                deadline = None
        
        max_completions = task_data.get("maxCompletions")
        if max_completions == "" or max_completions is None:
            max_completions = None
        else:
            try:
                max_completions = int(max_completions)
            except:
                max_completions = None
        
        requirements = task_data.get("requirements") or "{}"
        url = task_data.get("url")
        if url:
            import json
            try:
                req_data = json.loads(requirements) if requirements else {}
            except:
                req_data = {}
            req_data["url"] = url
            requirements = json.dumps(req_data)
        elif requirements == "":
            requirements = None
        # Создаем задание с правильными типами данных
        new_task = await storage.create_task({
            "title": task_data["title"],
            "description": task_data["description"], 
            "reward": int(task_data["reward"]),
            "type": task_data["type"],
            "action": task_data.get("action") or None,
            "status": task_data.get("status", "active"),
            "deadline": deadline,  # None или datetime объект
            "max_completions": max_completions,  # None или int
            "requirements": requirements,  # None или string
            "is_active": bool(task_data.get("isActive", True))
        })
        
        logger.info(f"New task created: {new_task.title}")
        return {"success": True, "task": new_task}
    except Exception as e:
        logger.error(f"Error creating task: {e}")
        raise HTTPException(status_code=500, detail="Failed to create task")

@app.get("/api/tasks/completed")
async def get_user_completed_tasks(
    current_user: User = Depends(get_authenticated_user),
    storage: Storage = Depends(get_storage)
):
    """Получить историю выполненных заданий пользователя"""
    try:
        # Получаем все выполненные задания пользователя
        completed_user_tasks = await storage.get_completed_user_tasks(current_user.id)
        
        # Преобразуем в нужный формат для фронтенда
        completed_tasks_history = []
        for user_task in completed_user_tasks:
            task = await storage.get_task(user_task.task_id)
            if not task:
                continue
                
            # Определяем тип задания на русском
            task_type_map = {
                "daily": "Ежедневное",
                "social": "Социальное", 
                "purchase": "Покупка",
                "referral": "Реферальное",
                "special": "Специальное"
            }
            task_type_text = task_type_map.get(task.type, task.type.capitalize())
            
            # Форматирование даты с русскими месяцами
            month_names = {
                1: "янв", 2: "фев", 3: "мар", 4: "апр", 5: "май", 6: "июн",
                7: "июл", 8: "авг", 9: "сен", 10: "окт", 11: "ноя", 12: "дек"
            }
            completed_date = user_task.completed_at
            formatted_date = f"{completed_date.day} {month_names[completed_date.month]} {completed_date.year}, {completed_date.strftime('%H:%M')}"
            
            completed_tasks_history.append({
                "id": user_task.id,
                "task_id": task.id,
                "title": task.title,
                "description": task.description,
                "reward": task.reward,
                "task_type": task.type,
                "task_type_text": task_type_text,
                "completed_at": user_task.completed_at.isoformat(),
                "completed_at_formatted": formatted_date
            })
        
        # Сортируем по дате выполнения (новые сверху)
        completed_tasks_history.sort(key=lambda x: x["completed_at"], reverse=True)
        
        return {
            "success": True, 
            "completed_tasks": completed_tasks_history,
            "count": len(completed_tasks_history)
        }
        
    except Exception as e:
        logger.error(f"Error getting completed tasks history: {e}")
        raise HTTPException(status_code=500, detail="Failed to get completed tasks history")
    
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
        # ✅ ПРАВИЛЬНАЯ ОБРАБОТКА ДАННЫХ:
        
        # Конвертируем пустые строки в None
        deadline = task_data.get("deadline")
        if deadline == "" or deadline is None:
            deadline = None
        elif isinstance(deadline, str):
            try:
                from datetime import datetime
                deadline = datetime.fromisoformat(deadline.replace('Z', '+00:00'))
            except:
                deadline = None
        
        max_completions = task_data.get("maxCompletions")
        if max_completions == "" or max_completions is None:
            max_completions = None
        else:
            try:
                max_completions = int(max_completions)
            except:
                max_completions = None
        
        requirements = task_data.get("requirements") or "{}"
        url = task_data.get("url")

        # Если есть URL, добавляем в requirements как JSON
        if url:
            import json
            try:
                req_data = json.loads(requirements) if requirements else {}
            except:
                req_data = {}
            req_data["url"] = url
            requirements = json.dumps(req_data)
        elif requirements == "":
            requirements = None
            
        # Подготавливаем данные для обновления
        update_data = {
            "title": task_data["title"],
            "description": task_data["description"], 
            "reward": int(task_data["reward"]),
            "type": task_data["type"],
            "action": task_data.get("action") or None,
            "status": task_data.get("status", "active"),
            "deadline": deadline,
            "max_completions": max_completions,
            "requirements": requirements,
            "is_active": bool(task_data.get("isActive", True))
        }
        
        updated_task = await storage.update_task(task_id, update_data)
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

@app.get("/api/admin/settings/current")
async def get_admin_settings(storage: Storage = Depends(get_storage)):
    return {
        "stars_price": await storage.get_cached_setting("stars_price"),
        "ton_markup_percentage": await storage.get_cached_setting("ton_markup_percentage"),
        "ton_price_cache_minutes": await storage.get_cached_setting("ton_price_cache_minutes"), 
        "ton_fallback_price": await storage.get_cached_setting("ton_fallback_price"),
        "referral_registration_bonus": await storage.get_cached_setting("referral_registration_bonus"),
        "bot_base_url": await storage.get_cached_setting("bot_base_url"),
        "referral_prefix": await storage.get_cached_setting("referral_prefix"),
        "referral_bonus_percentage": await storage.get_cached_setting("referral_bonus_percentage"),
    }

@app.get("/api/admin/ton-diagnostics")
async def ton_diagnostics(storage: Storage = Depends(get_storage)):
    """Диагностика TON Price Service"""
    try:
        # Получаем настройки
        cache_minutes = await storage.get_cached_setting("ton_price_cache_minutes")
        markup = await storage.get_cached_setting("ton_markup_percentage") 
        fallback = await storage.get_cached_setting("ton_fallback_price")
        
        # Статус сервиса
        service_status = {
            "last_price": ton_price_service.last_price,
            "last_update": ton_price_service.last_update.isoformat() if ton_price_service.last_update else None,
            "settings": {
                "cache_minutes": cache_minutes,
                "markup_percentage": markup,
                "fallback_price": fallback
            }
        }
        
        # Тестовый запрос цены
        current_price = await ton_price_service.get_current_ton_price_rub(storage)
        
        return {
            "success": True,
            "current_price": current_price,
            "service_status": service_status
        }
        
    except Exception as e:
        logger.error(f"TON diagnostics error: {e}", exc_info=True)
        return {
            "success": False,
            "error": str(e),
            "service_status": {
                "last_price": ton_price_service.last_price,
                "last_update": ton_price_service.last_update.isoformat() if ton_price_service.last_update else None,
            }
        }

@app.post("/api/admin/update-ton-price")
async def force_update_ton_price(storage: Storage = Depends(get_storage)):
    """Принудительно обновить цену TON"""
    try:
        new_price = await ton_price_service.force_update_price(storage)
        logger.info(f"✅ TON price manually updated: {new_price:.2f} RUB")
        return {
            "success": True,
            "new_price": f"{new_price:.2f}",
            "updated_at": datetime.utcnow().isoformat()
        }
    except Exception as e:
        logger.error(f"❌ Failed to update TON price: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to update TON price: {str(e)}")

@app.get("/api/config/referral")
async def get_referral_config(storage: Storage = Depends(get_storage)):
    return {
        "bot_base_url": await storage.get_cached_setting("bot_base_url"),
        "referral_prefix": await storage.get_cached_setting("referral_prefix"),
        "referral_bonus_percentage": int(await storage.get_cached_setting("referral_bonus_percentage"))
    }

@app.get("/api/config/interface-texts")
async def get_interface_texts(storage: Storage = Depends(get_storage)):
    return {
        "copy_success": await storage.get_cached_setting("copy_success"),
        "copy_error": await storage.get_cached_setting("copy_error"),
        "loading": await storage.get_cached_setting("loading"),
        "error": await storage.get_cached_setting("error")
    }

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

@app.on_event("startup")
async def startup_event():
    await init_db()
    await init_default_data()
    logger.info("Database initialized")
    # Инициализация Fragment API клиента
    logger.info("Starting Fragment API initialization...")
        # Диагностика переменных окружения
    fragment_seed = os.getenv("FRAGMENT_SEED")
    fragment_cookies = os.getenv("FRAGMENT_COOKIE")
    
    logger.info(f"FRAGMENT_SEED length: {len(fragment_seed) if fragment_seed else 'None'}")
    logger.info(f"FRAGMENT_COOKIE length: {len(fragment_cookies) if fragment_cookies else 'None'}")
    try:
        logger.info("🚀 Initializing TON Price Service...")
        async with AsyncSessionLocal() as session:
            storage = Storage(session)
            initial_price = await ton_price_service.get_current_ton_price_rub(storage)
            logger.info(f"✅ TON Price Service initialized with price: {initial_price:.2f} RUB")
    except Exception as e:
        logger.error(f"❌ Failed to initialize TON Price Service: {e}")
    try:
        fragment_seed = os.getenv("FRAGMENT_SEED")
        fragment_cookies = os.getenv("FRAGMENT_COOKIE")
        
        logger.info(f"Fragment seed exists: {bool(fragment_seed)}")
        logger.info(f"Fragment cookies exist: {bool(fragment_cookies)}")
         
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
    # from bot import main as bot_main
    # # Запуск бота в фоновом режиме
    # await bot_main()
    

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
