from pydantic import BaseModel, Field, ConfigDict
from typing import Optional
from datetime import datetime
from decimal import Decimal
import json

class UserCreate(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    
    telegram_id: Optional[str] = Field(None, alias="telegramId")
    username: Optional[str] = None
    first_name: Optional[str] = Field(None, alias="firstName")
    last_name: Optional[str] = Field(None, alias="lastName")
    init_data: Optional[str] = Field(None, alias="init_data")

    def validate_init_data(self, bot_token: str):
        from backend.telegram_auth import validate_telegram_data
        if self.init_data:
            user_data = validate_telegram_data(self.init_data, bot_token)
            if not user_data:
                raise ValueError("Invalid Telegram init_data")
            self.telegram_id = str(user_data.get("id"))
            self.username = user_data.get("username")
            self.first_name = user_data.get("first_name")
            self.last_name = user_data.get("last_name")
        elif not self.telegram_id:
            raise ValueError("telegram_id or init_data must be provided")

class UserUpdate(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    
    username: Optional[str] = None
    first_name: Optional[str] = Field(None, alias="firstName")
    last_name: Optional[str] = Field(None, alias="lastName")
    notifications_enabled: Optional[bool] = Field(None, alias="notificationsEnabled")

class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)
    
    id: str
    telegram_id: str = Field(alias="telegramId")
    username: Optional[str]
    first_name: Optional[str] = Field(alias="firstName")
    last_name: Optional[str] = Field(alias="lastName")
    stars_balance: int = Field(alias="starsBalance")
    ton_balance: Decimal = Field(alias="tonBalance")
    referral_code: Optional[str] = Field(alias="referralCode")
    referred_by: Optional[str] = Field(alias="referredBy")
    total_stars_earned: int = Field(alias="totalStarsEarned")
    total_referral_earnings: int = Field(alias="totalReferralEarnings")
    tasks_completed: int = Field(alias="tasksCompleted")
    daily_earnings: int = Field(alias="dailyEarnings")
    notifications_enabled: bool = Field(alias="notificationsEnabled")
    created_at: datetime = Field(alias="createdAt")

# Transaction schemas
class TransactionCreate(BaseModel):
    user_id: str
    type: str
    currency: str
    amount: Decimal
    rub_amount: Optional[Decimal] = None
    status: Optional[str] = "pending"
    description: Optional[str] = None
    payment_system: Optional[str] = None
    payment_url: Optional[str] = None
    invoice_id: Optional[str] = None

class TransactionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)
    
    id: str
    user_id: str = Field(alias="userId")
    type: str
    currency: str
    amount: Decimal
    rub_amount: Optional[Decimal] = Field(None, alias="rubAmount")
    status: str
    description: Optional[str]
    payment_system: Optional[str] = Field(None, alias="paymentSystem")
    payment_url: Optional[str] = Field(None, alias="paymentUrl")
    invoice_id: Optional[str] = Field(None, alias="invoiceId")
    created_at: datetime = Field(alias="createdAt")
    paid_at: Optional[datetime] = Field(None, alias="paidAt")

# Task schemas
class TaskCreate(BaseModel):
    title: str
    description: str
    reward: int
    type: str
    action: Optional[str] = None
    is_active: Optional[bool] = True

class TaskResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)
    
    id: str
    title: str
    description: str
    reward: int
    type: str
    action: Optional[str]
    is_active: bool = Field(alias="isActive")
    created_at: datetime = Field(alias="createdAt")
    completed: Optional[bool] = False
    completed_at: Optional[datetime] = Field(None, alias="completedAt")

# UserTask schemas
class UserTaskCreate(BaseModel):
    user_id: str
    task_id: str
    completed: Optional[bool] = False

class UserTaskResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)
    
    id: str
    user_id: str = Field(alias="userId")
    task_id: str = Field(alias="taskId")
    completed: bool
    completed_at: Optional[datetime] = Field(None, alias="completedAt")
    created_at: datetime = Field(alias="createdAt")

# Setting schemas
class SettingCreate(BaseModel):
    key: str
    value: str

class SettingUpdate(BaseModel):
    value: str

class SettingResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)
    
    id: str
    key: str
    value: str
    updated_at: datetime = Field(alias="updatedAt")

# Purchase schemas
class PurchaseCalculate(BaseModel):
    currency: str  # Will validate in endpoint logic
    amount: float = Field(..., gt=0)

class PurchaseCalculateResponse(BaseModel):
    base_price: str = Field(alias="basePrice")
    markup_amount: str = Field(alias="markupAmount")
    total_price: str = Field(alias="totalPrice")
    currency: str
    amount: float

class PurchaseRequest(BaseModel):
    currency: str  # Will validate in endpoint logic
    amount: float = Field(..., gt=0)
    rub_amount: float = Field(..., gt=0, alias="rubAmount")

class PurchaseResponse(BaseModel):
    transaction: TransactionResponse
    status: str

# Referral schemas
class ReferralStats(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    
    total_referrals: int = Field(alias="totalReferrals")
    total_earnings: int = Field(alias="totalEarnings")
    referral_code: Optional[str] = Field(alias="referralCode")
    referrals: list

# Admin schemas
class AdminStats(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    
    total_users: int = Field(alias="totalUsers")
    today_sales: str = Field(alias="todaySales")
    active_referrals: int = Field(alias="activeReferrals")
    recent_transactions: list = Field(alias="recentTransactions")

class AdminSettingsUpdate(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    
    stars_price: Optional[str] = Field(None, alias="starsPrice")
    ton_price: Optional[str] = Field(None, alias="tonPrice")
    markup_percentage: Optional[str] = Field(None, alias="markupPercentage")

# Payment schemas
class PaymentCreateResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    
    transaction_id: str = Field(alias="transactionId")
    payment_url: str = Field(alias="paymentUrl")
    invoice_id: str = Field(alias="invoiceId")
    amount: str
    status: str

class PaymentWebhookData(BaseModel):
    OutSum: str
    InvId: str
    SignatureValue: str
    
class PaymentStatusResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    
    transaction_id: str = Field(alias="transactionId")
    status: str
    paid_at: Optional[datetime] = Field(None, alias="paidAt")