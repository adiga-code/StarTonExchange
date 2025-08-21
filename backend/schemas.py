from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
from decimal import Decimal

# User schemas
class UserCreate(BaseModel):
    telegram_id: str
    username: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None

class UserUpdate(BaseModel):
    username: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    notifications_enabled: Optional[bool] = None

class UserResponse(BaseModel):
    id: str
    telegram_id: str
    username: Optional[str]
    first_name: Optional[str]
    last_name: Optional[str]
    stars_balance: int
    ton_balance: Decimal
    referral_code: Optional[str]
    referred_by: Optional[str]
    total_stars_earned: int
    total_referral_earnings: int
    tasks_completed: int
    daily_earnings: int
    notifications_enabled: bool
    created_at: datetime
    
    class Config:
        from_attributes = True

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
    id: str
    user_id: str
    type: str
    currency: str
    amount: Decimal
    rub_amount: Optional[Decimal]
    status: str
    description: Optional[str]
    payment_system: Optional[str]
    payment_url: Optional[str]
    invoice_id: Optional[str]
    created_at: datetime
    paid_at: Optional[datetime]
    
    class Config:
        from_attributes = True

# Task schemas
class TaskCreate(BaseModel):
    title: str
    description: str
    reward: int
    type: str
    action: Optional[str] = None
    is_active: Optional[bool] = True

class TaskResponse(BaseModel):
    id: str
    title: str
    description: str
    reward: int
    type: str
    action: Optional[str]
    is_active: bool
    
    # ✅ ДОБАВИТЬ ЭТИ ПОЛЯ:
    status: Optional[str] = "active"
    deadline: Optional[datetime] = None
    max_completions: Optional[int] = None
    requirements: Optional[str] = None
    completed_count: Optional[int] = 0
    
    created_at: datetime
    completed: Optional[bool] = False
    completed_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True

# UserTask schemas
class UserTaskCreate(BaseModel):
    user_id: str
    task_id: str
    completed: Optional[bool] = False

class UserTaskResponse(BaseModel):
    id: str
    user_id: str
    task_id: str
    completed: bool
    completed_at: Optional[datetime]
    created_at: datetime
    
    class Config:
        from_attributes = True

# Setting schemas
class SettingCreate(BaseModel):
    key: str
    value: str

class SettingUpdate(BaseModel):
    value: str

class SettingResponse(BaseModel):
    id: str
    key: str
    value: str
    updated_at: datetime
    
    class Config:
        from_attributes = True

# Purchase schemas
class PurchaseCalculate(BaseModel):
    currency: str  # Will validate in endpoint logic
    amount: float = Field(..., gt=0)

class PurchaseCalculateResponse(BaseModel):
    base_price: str
    markup_amount: str
    total_price: str
    currency: str
    amount: float

class PurchaseRequest(BaseModel):
    currency: str
    amount: float = Field(..., gt=0)
    rub_amount: float = Field(..., gt=0)
    username: Optional[str] = None  # ← ДОБАВЬ ЭТУ СТРОКУ

class PurchaseResponse(BaseModel):
    transaction: TransactionResponse
    status: str

# Referral schemas
class ReferralStats(BaseModel):
    total_referrals: int
    total_earnings: int
    referral_code: Optional[str]
    referrals: list

# Admin schemas
class AdminStats(BaseModel):
    total_users: int
    today_sales: str
    active_referrals: int
    recent_transactions: list

class AdminSettingsUpdate(BaseModel):
    stars_price: Optional[str] = None
    ton_price: Optional[str] = None
    markup_percentage: Optional[str] = None

# Payment schemas
class PaymentCreateResponse(BaseModel):
    transaction_id: str
    payment_url: str
    invoice_id: str
    amount: str
    status: str

class PaymentWebhookData(BaseModel):
    OutSum: str
    InvId: str
    SignatureValue: str
    
class PaymentStatusResponse(BaseModel):
    transaction_id: str
    status: str
    paid_at: Optional[datetime] = None