import os
import json
import logging
from datetime import date, datetime, timedelta
from typing import Optional, List, Dict, Any
from decimal import Decimal

from fastapi import FastAPI, HTTPException, Depends, Request
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import uvicorn

from database import AsyncSessionLocal, init_db, init_default_data
from storage import Storage
from schemas import *
from auth import get_current_user
from models import User

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Create FastAPI app
app = FastAPI()

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Dependency to get database session
async def get_storage():
    async with AsyncSessionLocal() as session:
        yield Storage(session)

# Новые схемы для задач
class TaskCreateRequest(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    description: str = Field(..., min_length=1, max_length=1000)
    reward: int = Field(..., gt=0, le=10000)
    type: str = Field(..., pattern="^(daily|social|referral)$")  # Заменили regex на pattern
    action: Optional[str] = Field(None, max_length=100)
    is_active: bool = True

class TaskUpdateRequest(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=200)
    description: Optional[str] = Field(None, min_length=1, max_length=1000)
    reward: Optional[int] = Field(None, gt=0, le=10000)
    type: Optional[str] = Field(None, pattern="^(daily|social|referral)$")  # Заменили regex на pattern
    action: Optional[str] = Field(None, max_length=100)
    is_active: Optional[bool] = None

# Схема для поиска пользователя
class UserProfileResponse(BaseModel):
    telegram_id: str
    username: Optional[str]
    first_name: str
    last_name: Optional[str]
    profile_photo: Optional[str]

# Обновленная схема покупки
class PurchaseRequest(BaseModel):
    currency: str
    amount: float = Field(..., gt=0)
    rub_amount: float = Field(..., gt=0)
    target_user_id: Optional[str] = None  # ID получателя

# Health check
@app.get("/health")
async def health_check():
    return {"status": "ok"}

# User endpoints
@app.get("/api/users/me")
async def get_current_user_profile(storage: Storage = Depends(get_storage)):
    try:
        # В тестовом режиме возвращаем mock пользователя
        if os.getenv("DEVELOPMENT"):
            return {
                "id": "test-user-id",
                "telegram_id": "123456789",
                "username": "testuser",
                "first_name": "Test",
                "last_name": "User",
                "stars_balance": 100,
                "ton_balance": "0.5",
                "referral_code": "TEST123",
                "total_stars_earned": 250,
                "total_referral_earnings": 50,
                "tasks_completed": 5,
            }
        
        # TODO: Получить пользователя из Telegram headers
        # user = await get_current_user(storage, telegram_id, init_data)
        # return user if user else HTTPException(401, "Unauthorized")
        
        raise HTTPException(status_code=501, detail="Not implemented")
    except Exception as e:
        logger.error(f"Error getting user profile: {e}")
        raise HTTPException(status_code=500, detail="Failed to get user profile")

@app.get("/api/users/search/{username}")
async def search_user_by_username(
    username: str,
    storage: Storage = Depends(get_storage)
):
    """Поиск пользователя по username и получение его аватарки"""
    try:
        # Получить пользователя из базы данных
        user = await storage.get_user_by_username(username)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Получить фото профиля через Telegram Bot API
        profile_photo_url = None
        try:
            bot_token = os.getenv('BOT_TOKEN')
            if bot_token:
                import aiohttp
                async with aiohttp.ClientSession() as session:
                    # Получить фото профиля пользователя
                    async with session.get(
                        f"https://api.telegram.org/bot{bot_token}/getUserProfilePhotos",
                        params={"user_id": user.telegram_id, "limit": 1}
                    ) as response:
                        if response.status == 200:
                            data = await response.json()
                            if data.get("ok") and data.get("result", {}).get("photos"):
                                # Получить file_id первого фото
                                file_id = data["result"]["photos"][0][0]["file_id"]
                                
                                # Получить file_path
                                async with session.get(
                                    f"https://api.telegram.org/bot{bot_token}/getFile",
                                    params={"file_id": file_id}
                                ) as file_response:
                                    if file_response.status == 200:
                                        file_data = await file_response.json()
                                        if file_data.get("ok"):
                                            file_path = file_data["result"]["file_path"]
                                            profile_photo_url = f"https://api.telegram.org/file/bot{bot_token}/{file_path}"
        except Exception as e:
            logger.error(f"Error getting profile photo: {e}")
        
        return UserProfileResponse(
            telegram_id=user.telegram_id,
            username=user.username,
            first_name=user.first_name,
            last_name=user.last_name,
            profile_photo=profile_photo_url
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error searching user: {e}")
        raise HTTPException(status_code=500, detail="Failed to search user")

# Task endpoints
@app.get("/api/tasks")
async def get_user_tasks(storage: Storage = Depends(get_storage)):
    try:
        # TODO: Получить текущего пользователя
        # user = await get_current_user(storage, ...)
        # В тестовом режиме возвращаем mock задачи
        if os.getenv("DEVELOPMENT"):
            return [
                {
                    "id": "task-1",
                    "title": "Ежедневный вход",
                    "description": "Заходите в приложение каждый день",
                    "reward": 10,
                    "type": "daily",
                    "action": "daily_login",
                    "completed": False,
                    "completedAt": None,
                },
                {
                    "id": "task-2",
                    "title": "Поделиться приложением",
                    "description": "Поделитесь приложением с друзьями",
                    "reward": 25,
                    "type": "social",
                    "action": "share_app",
                    "completed": True,
                    "completedAt": "2025-01-15T10:30:00Z",
                },
            ]
        
        tasks = await storage.get_active_tasks()
        # TODO: Добавить информацию о выполнении для текущего пользователя
        return tasks
    except Exception as e:
        logger.error(f"Error getting tasks: {e}")
        raise HTTPException(status_code=500, detail="Failed to get tasks")

@app.post("/api/tasks/{task_id}/complete")
async def complete_task(task_id: str, storage: Storage = Depends(get_storage)):
    try:
        # TODO: Получить текущего пользователя и выполнить задание
        # user = await get_current_user(storage, ...)
        # task = await storage.get_task(task_id)
        # await storage.complete_user_task(user.id, task_id)
        # await storage.add_user_stars(user.id, task.reward)
        
        # В тестовом режиме возвращаем успех
        if os.getenv("DEVELOPMENT"):
            return {"success": True, "reward": 25}
        
        raise HTTPException(status_code=501, detail="Not implemented")
    except Exception as e:
        logger.error(f"Error completing task: {e}")
        raise HTTPException(status_code=500, detail="Failed to complete task")

# Purchase endpoints
@app.post("/api/purchase/calculate")
async def calculate_purchase_price(
    request: PurchaseCalculate,
    storage: Storage = Depends(get_storage)
):
    try:
        # Получить настройки цен
        stars_price_setting = await storage.get_setting("stars_price")
        ton_price_setting = await storage.get_setting("ton_price")
        markup_setting = await storage.get_setting("markup_percentage")
        
        stars_price = float(stars_price_setting.value) if stars_price_setting else 2.30
        ton_price = float(ton_price_setting.value) if ton_price_setting else 420.50
        markup_percentage = float(markup_setting.value) if markup_setting else 5.0
        
        # Рассчитать цену
        if request.currency == "stars":
            base_price = stars_price * request.amount
        elif request.currency == "ton":
            base_price = ton_price * request.amount
        else:
            raise HTTPException(status_code=400, detail="Invalid currency")
        
        markup_amount = base_price * (markup_percentage / 100)
        total_price = base_price + markup_amount
        
        return PurchaseCalculateResponse(
            base_price=f"{base_price:.2f}",
            markup_amount=f"{markup_amount:.2f}",
            total_price=f"{total_price:.2f}",
            currency=request.currency,
            amount=request.amount
        )
    except Exception as e:
        logger.error(f"Error calculating price: {e}")
        raise HTTPException(status_code=500, detail="Failed to calculate price")

@app.post("/api/purchase")
async def create_purchase(
    request: PurchaseRequest,
    storage: Storage = Depends(get_storage)
):
    """Создать покупку для указанного пользователя"""
    try:
        # Валидация валюты
        if request.currency not in ["stars", "ton"]:
            raise HTTPException(status_code=400, detail="Invalid currency")
        
        # Получить целевого пользователя (получателя)
        target_user = None
        if request.target_user_id:
            target_user = await storage.get_user_by_telegram_id(request.target_user_id)
            if not target_user:
                raise HTTPException(status_code=404, detail="Target user not found")
        else:
            # Если не указан получатель, использовать текущего пользователя
            # TODO: получить из текущего контекста
            raise HTTPException(status_code=400, detail="Target user required")
        
        # Создать транзакцию
        transaction_data = TransactionCreate(
            user_id=target_user.id,
            type=f"buy_{request.currency}",
            currency=request.currency,
            amount=Decimal(str(request.amount)),
            rub_amount=Decimal(str(request.rub_amount)),
            status="pending",
            description=f"Покупка {request.amount} {request.currency}",
            payment_system="fragment_api" if request.currency == "stars" else "robokassa"
        )
        
        transaction = await storage.create_transaction(transaction_data)
        
        # Для звезд - использовать Fragment API
        if request.currency == "stars":
            # TODO: Интеграция с Fragment API
            # payment_url = await create_fragment_payment(transaction.id, request.amount, request.rub_amount)
            payment_url = f"https://fragment.com/pay?amount={request.rub_amount}&stars={request.amount}&invoice_id={transaction.id}"
        else:
            # Для TON - использовать Робокассу
            # TODO: Интеграция с Робокассой
            payment_url = f"https://robokassa.com/pay?amount={request.rub_amount}&invoice_id={transaction.id}"
        
        # Обновить транзакцию с URL платежа
        await storage.update_transaction(transaction.id, {
            "payment_url": payment_url,
            "invoice_id": transaction.id
        })
        
        return PurchaseResponse(
            transaction=TransactionResponse.from_orm(transaction),
            status="created",
            payment_url=payment_url
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating purchase: {e}")
        raise HTTPException(status_code=500, detail="Failed to create purchase")

@app.get("/api/purchase/status/{transaction_id}")
async def get_purchase_status(
    transaction_id: str,
    storage: Storage = Depends(get_storage)
):
    try:
        transaction = await storage.get_transaction(transaction_id)
        if not transaction:
            raise HTTPException(status_code=404, detail="Transaction not found")
        
        return {
            "transaction_id": transaction.id,
            "status": transaction.status,
            "created_at": transaction.created_at.isoformat(),
            "paid_at": transaction.paid_at.isoformat() if transaction.paid_at else None
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting purchase status: {e}")
        raise HTTPException(status_code=500, detail="Failed to get purchase status")

# Referral endpoints
@app.get("/api/referrals/stats")
async def get_referral_stats(storage: Storage = Depends(get_storage)):
    try:
        # TODO: Получить статистику рефералов для текущего пользователя
        return ReferralStats(
            total_referrals=0,
            total_earnings=0,
            referral_code="TEST123"
        )
    except Exception as e:
        logger.error(f"Error getting referral stats: {e}")
        raise HTTPException(status_code=500, detail="Failed to get referral stats")

# Admin endpoints
@app.get("/api/admin/stats")
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

# Новые эндпоинты для управления задачами
@app.get("/api/admin/tasks")
async def get_admin_tasks(storage: Storage = Depends(get_storage)):
    """Получить все задачи для админ панели"""
    try:
        tasks = await storage.get_all_tasks()
        return [
            {
                "id": task.id,
                "title": task.title,
                "description": task.description,
                "reward": task.reward,
                "type": task.type,
                "action": task.action,
                "is_active": task.is_active,
                "created_at": task.created_at.isoformat()
            }
            for task in tasks
        ]
    except Exception as e:
        logger.error(f"Error getting admin tasks: {e}")
        raise HTTPException(status_code=500, detail="Failed to get tasks")

@app.post("/api/admin/tasks")
async def create_admin_task(
    task_data: TaskCreateRequest,
    storage: Storage = Depends(get_storage)
):
    """Создать новое задание"""
    try:
        task = await storage.create_task({
            "title": task_data.title,
            "description": task_data.description,
            "reward": task_data.reward,
            "type": task_data.type,
            "action": task_data.action,
            "is_active": task_data.is_active
        })
        
        return {
            "id": task.id,
            "title": task.title,
            "description": task.description,
            "reward": task.reward,
            "type": task.type,
            "action": task.action,
            "is_active": task.is_active,
            "created_at": task.created_at.isoformat()
        }
    except Exception as e:
        logger.error(f"Error creating task: {e}")
        raise HTTPException(status_code=500, detail="Failed to create task")

@app.put("/api/admin/tasks/{task_id}")
async def update_admin_task(
    task_id: str,
    task_data: TaskUpdateRequest,
    storage: Storage = Depends(get_storage)
):
    """Обновить задание"""
    try:
        # Получить существующее задание
        existing_task = await storage.get_task(task_id)
        if not existing_task:
            raise HTTPException(status_code=404, detail="Task not found")
        
        # Подготовить данные для обновления
        updates = {}
        if task_data.title is not None:
            updates["title"] = task_data.title
        if task_data.description is not None:
            updates["description"] = task_data.description
        if task_data.reward is not None:
            updates["reward"] = task_data.reward
        if task_data.type is not None:
            updates["type"] = task_data.type
        if task_data.action is not None:
            updates["action"] = task_data.action
        if task_data.is_active is not None:
            updates["is_active"] = task_data.is_active
        
        updated_task = await storage.update_task(task_id, updates)
        
        return {
            "id": updated_task.id,
            "title": updated_task.title,
            "description": updated_task.description,
            "reward": updated_task.reward,
            "type": updated_task.type,
            "action": updated_task.action,
            "is_active": updated_task.is_active,
            "created_at": updated_task.created_at.isoformat()
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating task: {e}")
        raise HTTPException(status_code=500, detail="Failed to update task")

@app.delete("/api/admin/tasks/{task_id}")
async def delete_admin_task(
    task_id: str,
    storage: Storage = Depends(get_storage)
):
    """Удалить задание"""
    try:
        task = await storage.get_task(task_id)
        if not task:
            raise HTTPException(status_code=404, detail="Task not found")
        
        success = await storage.delete_task(task_id)
        if not success:
            raise HTTPException(status_code=500, detail="Failed to delete task")
        
        return {"success": True}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting task: {e}")
        raise HTTPException(status_code=500, detail="Failed to delete task")

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
    port = int(os.getenv("PORT", 8000))
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=port,
        reload=True if os.getenv("DEVELOPMENT") else False
    )