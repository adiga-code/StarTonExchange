import os
import logging
import hashlib
import hmac
from typing import Dict, Any
from datetime import datetime
from decimal import Decimal

from fastapi import APIRouter, HTTPException, Request, Depends
from pydantic import BaseModel

from database import AsyncSessionLocal
from storage import Storage
from schemas import FragmentWebhookData, RobokassaWebhookData

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/webhooks")

async def get_storage():
    async with AsyncSessionLocal() as session:
        yield Storage(session)

def verify_robokassa_signature(out_sum: str, inv_id: str, password: str, signature: str) -> bool:
    """Проверить подпись Robokassa"""
    try:
        # Создать строку для подписи
        sign_string = f"{out_sum}:{inv_id}:{password}"
        # Вычислить MD5 хеш
        calculated_signature = hashlib.md5(sign_string.encode()).hexdigest().upper()
        return calculated_signature == signature.upper()
    except Exception as e:
        logger.error(f"Error verifying Robokassa signature: {e}")
        return False

def verify_fragment_signature(data: Dict[str, Any], bot_token: str) -> bool:
    """Проверить подпись Fragment API"""
    try:
        # Fragment API использует HMAC-SHA256 с bot token
        # Конкретная реализация зависит от документации Fragment API
        # Здесь пример проверки
        message = "|".join([str(v) for v in sorted(data.values()) if v is not None])
        expected_signature = hmac.new(
            bot_token.encode(),
            message.encode(),
            hashlib.sha256
        ).hexdigest()
        return expected_signature == data.get("signature", "")
    except Exception as e:
        logger.error(f"Error verifying Fragment signature: {e}")
        return False

@router.post("/robokassa")
async def robokassa_webhook(
    request: Request,
    storage: Storage = Depends(get_storage)
):
    """Обработка webhook от Robokassa"""
    try:
        # Получить данные из формы
        form_data = await request.form()
        webhook_data = RobokassaWebhookData(
            OutSum=form_data.get("OutSum", ""),
            InvId=form_data.get("InvId", ""),
            SignatureValue=form_data.get("SignatureValue", ""),
            PaymentMethod=form_data.get("PaymentMethod"),
            IncCurrLabel=form_data.get("IncCurrLabel")
        )
        
        logger.info(f"Received Robokassa webhook: {webhook_data}")
        
        # Проверить подпись
        password = os.getenv("ROBOKASSA_PASSWORD2", "")
        if not verify_robokassa_signature(
            webhook_data.OutSum,
            webhook_data.InvId,
            password,
            webhook_data.SignatureValue
        ):
            logger.error("Invalid Robokassa signature")
            raise HTTPException(status_code=400, detail="Invalid signature")
        
        # Найти транзакцию
        transaction = await storage.get_transaction(webhook_data.InvId)
        if not transaction:
            logger.error(f"Transaction not found: {webhook_data.InvId}")
            raise HTTPException(status_code=404, detail="Transaction not found")
        
        # Проверить сумму
        expected_amount = float(transaction.rub_amount or 0)
        received_amount = float(webhook_data.OutSum)
        
        if abs(expected_amount - received_amount) > 0.01:  # Допуск 1 копейка
            logger.error(f"Amount mismatch: expected {expected_amount}, received {received_amount}")
            raise HTTPException(status_code=400, detail="Amount mismatch")
        
        # Обновить статус транзакции
        if transaction.status != "completed":
            await storage.update_transaction(transaction.id, {
                "status": "completed",
                "paid_at": datetime.utcnow(),
                "payment_data": webhook_data.dict()
            })
            
            # Начислить валюту пользователю
            if transaction.currency == "ton":
                # Обновить баланс TON
                user = await storage.get_user(transaction.user_id)
                if user:
                    new_balance = user.ton_balance + transaction.amount
                    await storage.update_user(user.id, {"ton_balance": new_balance})
            elif transaction.currency == "stars":
                # Начислить звезды
                await storage.add_user_stars(transaction.user_id, int(transaction.amount))
            
            # Обработать реферальный бонус
            user = await storage.get_user(transaction.user_id)
            if user and user.referred_by:
                bonus_amount = int(float(transaction.amount) * 0.1)  # 10% бонус
                await storage.process_referral_bonus(user.referred_by, bonus_amount)
            
            logger.info(f"Transaction {transaction.id} completed successfully")
        
        return {"status": "OK"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error processing Robokassa webhook: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.post("/fragment")
async def fragment_webhook(
    webhook_data: FragmentWebhookData,
    storage: Storage = Depends(get_storage)
):
    """Обработка webhook от Fragment API"""
    try:
        logger.info(f"Received Fragment webhook: {webhook_data}")
        
        # Проверить подпись (если требуется)
        bot_token = os.getenv("BOT_TOKEN", "")
        # if bot_token and not verify_fragment_signature(webhook_data.dict(), bot_token):
        #     logger.error("Invalid Fragment signature")
        #     raise HTTPException(status_code=400, detail="Invalid signature")
        
        # Найти транзакцию
        transaction = await storage.get_transaction(webhook_data.payment_id)
        if not transaction:
            logger.error(f"Transaction not found: {webhook_data.payment_id}")
            raise HTTPException(status_code=404, detail="Transaction not found")
        
        # Обработать статус платежа
        if webhook_data.status == "completed" and transaction.status != "completed":
            # Проверить количество звезд
            expected_stars = int(transaction.amount)
            received_stars = webhook_data.stars
            
            if expected_stars != received_stars:
                logger.error(f"Stars mismatch: expected {expected_stars}, received {received_stars}")
                raise HTTPException(status_code=400, detail="Stars amount mismatch")
            
            # Обновить статус транзакции
            await storage.update_transaction(transaction.id, {
                "status": "completed",
                "paid_at": datetime.utcnow(),
                "payment_data": webhook_data.dict()
            })
            
            # Начислить звезды пользователю
            await storage.add_user_stars(transaction.user_id, webhook_data.stars)
            
            # Обработать реферальный бонус
            user = await storage.get_user(transaction.user_id)
            if user and user.referred_by:
                bonus_amount = int(webhook_data.stars * 0.1)  # 10% бонус
                await storage.process_referral_bonus(user.referred_by, bonus_amount)
            
            logger.info(f"Fragment transaction {transaction.id} completed successfully")
            
        elif webhook_data.status in ["failed", "cancelled"]:
            # Обновить статус как неудачный
            await storage.update_transaction(transaction.id, {
                "status": webhook_data.status,
                "payment_data": webhook_data.dict()
            })
            logger.info(f"Fragment transaction {transaction.id} {webhook_data.status}")
        
        return {"status": "OK"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error processing Fragment webhook: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.get("/test")
async def test_webhook():
    """Тестовый endpoint для проверки работы webhook'ов"""
    return {"status": "Webhook service is running"}

# Функции для создания платежей (будут использованы в main.py)

async def create_robokassa_payment(
    amount: Decimal,
    description: str,
    invoice_id: str
) -> str:
    """Создать платеж в Robokassa и вернуть URL"""
    try:
        # Параметры Robokassa
        merchant_login = os.getenv("ROBOKASSA_LOGIN", "")
        password1 = os.getenv("ROBOKASSA_PASSWORD1", "")
        
        if not merchant_login or not password1:
            raise ValueError("Robokassa credentials not configured")
        
        # Создать подпись
        sign_string = f"{merchant_login}:{amount}:{invoice_id}:{password1}"
        signature = hashlib.md5(sign_string.encode()).hexdigest()
        
        # Создать URL для оплаты
        base_url = "https://auth.robokassa.ru/Merchant/Index.aspx"
        params = {
            "MerchantLogin": merchant_login,
            "OutSum": str(amount),
            "InvId": invoice_id,
            "Description": description,
            "SignatureValue": signature,
            "IsTest": "1" if os.getenv("DEVELOPMENT") else "0"
        }
        
        query_string = "&".join([f"{k}={v}" for k, v in params.items()])
        payment_url = f"{base_url}?{query_string}"
        
        return payment_url
        
    except Exception as e:
        logger.error(f"Error creating Robokassa payment: {e}")
        raise

async def create_fragment_payment(
    stars: int,
    amount: Decimal,
    description: str,
    invoice_id: str
) -> str:
    """Создать платеж в Fragment API и вернуть URL"""
    try:
        # Это упрощенная версия - реальная интеграция потребует API ключи Fragment
        bot_token = os.getenv("BOT_TOKEN", "")
        
        if not bot_token:
            raise ValueError("Bot token not configured")
        
        # В реальной версии здесь будет вызов Fragment API
        # Пока возвращаем тестовый URL
        fragment_url = f"https://fragment.com/pay?stars={stars}&amount={amount}&invoice={invoice_id}"
        
        return fragment_url
        
    except Exception as e:
        logger.error(f"Error creating Fragment payment: {e}")
        raise