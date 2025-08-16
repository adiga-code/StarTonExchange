from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from decimal import Decimal

# User schemas
class UserCreate(BaseModel):
    telegram_id: str
    username: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    referral_code: Optional[str] = None
    referred_by: Optional[str] = None

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

class UserUpdate(BaseModel):
    username: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    notifications_enabled: Optional[bool] = None

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
    currency: str = Field(..., pattern="^(stars|ton)$")  # Заменили regex на pattern
    amount: float = Field(..., gt=0)

class PurchaseCalculateResponse(BaseModel):
    base_price: str
    markup_amount: str
    total_price: str
    currency: str
    amount: float

class PurchaseRequest(BaseModel):
    currency: str = Field(..., pattern="^(stars|ton)$")  # Заменили regex на pattern
    amount: float = Field(..., gt=0)
    rub_amount: float = Field(..., gt=0)
    target_user_id: Optional[str] = None

class PurchaseResponse(BaseModel):
    transaction: TransactionResponse
    status: str
    payment_url: Optional[str] = None

# Referral schemas
class ReferralStats(BaseModel):
    total_referrals: int
    total_earnings: int
    referral_code: Optional[str]

class ReferralUser(BaseModel):
    id: str
    username: Optional[str]
    first_name: Optional[str]
    created_at: datetime
    total_spent: Decimal

# Admin schemas
class AdminStats(BaseModel):
    total_users: int
    today_sales: str
    active_referrals: int
    recent_transactions: List[dict]

class AdminSettingsUpdate(BaseModel):
    stars_price: Optional[str] = None
    ton_price: Optional[str] = None
    markup_percentage: Optional[str] = None

# Analytics schemas
class UserAnalytics(BaseModel):
    total_users: int
    new_users_today: int
    active_users_today: int
    total_transactions: int
    total_revenue: Decimal
    completed_tasks_today: int

class TransactionAnalytics(BaseModel):
    total_transactions: int
    completed_transactions: int
    pending_transactions: int
    failed_transactions: int
    total_revenue: Decimal
    average_transaction_amount: Decimal

class TaskAnalytics(BaseModel):
    total_tasks: int
    active_tasks: int
    completed_tasks_today: int
    most_popular_task: Optional[str]
    task_completion_rate: float

# Fragment API schemas
class FragmentPaymentRequest(BaseModel):
    amount: float
    stars: int
    description: str
    webhook_url: Optional[str] = None

class FragmentPaymentResponse(BaseModel):
    payment_id: str
    payment_url: str
    status: str
    expires_at: datetime

class FragmentWebhookData(BaseModel):
    payment_id: str
    status: str
    amount: float
    stars: int
    user_id: Optional[str] = None
    transaction_hash: Optional[str] = None

# Robokassa schemas
class RobokassaPaymentRequest(BaseModel):
    amount: Decimal
    description: str
    invoice_id: str
    user_email: Optional[str] = None

class RobokassaPaymentResponse(BaseModel):
    payment_url: str
    invoice_id: str

class RobokassaWebhookData(BaseModel):
    OutSum: str
    InvId: str
    SignatureValue: str
    PaymentMethod: Optional[str] = None
    IncCurrLabel: Optional[str] = None

# Bot integration schemas
class TelegramUser(BaseModel):
    id: int
    first_name: str
    last_name: Optional[str] = None
    username: Optional[str] = None
    language_code: Optional[str] = None

class BotUserRegistration(BaseModel):
    telegram_user: TelegramUser
    referral_code: Optional[str] = None

# Notification schemas
class NotificationCreate(BaseModel):
    user_id: str
    type: str
    title: str
    message: str
    data: Optional[dict] = None

class NotificationResponse(BaseModel):
    id: str
    user_id: str
    type: str
    title: str
    message: str
    data: Optional[dict]
    read: bool
    created_at: datetime
    
    class Config:
        from_attributes = True

# WebApp authentication schemas
class WebAppUser(BaseModel):
    id: int
    first_name: str
    last_name: Optional[str] = None
    username: Optional[str] = None
    language_code: Optional[str] = None
    is_premium: Optional[bool] = None

class WebAppInitData(BaseModel):
    query_id: Optional[str] = None
    user: Optional[WebAppUser] = None
    receiver: Optional[WebAppUser] = None
    start_param: Optional[str] = None
    auth_date: int
    hash: str

# Task completion schemas
class TaskCompletionRequest(BaseModel):
    action_data: Optional[dict] = None

class TaskCompletionResponse(BaseModel):
    success: bool
    reward: int
    message: str
    new_balance: int

# Batch operation schemas
class BatchUserTaskCreate(BaseModel):
    task_id: str
    user_ids: List[str]

class BatchTaskUpdate(BaseModel):
    task_ids: List[str]
    updates: dict

# Statistics schemas
class DailyStats(BaseModel):
    date: str
    new_users: int
    active_users: int
    completed_transactions: int
    total_revenue: Decimal
    completed_tasks: int

class WeeklyStats(BaseModel):
    week_start: str
    total_users: int
    new_users: int
    total_revenue: Decimal
    popular_tasks: List[dict]

class MonthlyStats(BaseModel):
    month: str
    total_users: int
    new_users: int
    total_revenue: Decimal
    top_referrers: List[dict]

# Search schemas
class UserSearchResponse(BaseModel):
    telegram_id: str
    username: Optional[str]
    first_name: str
    last_name: Optional[str]
    profile_photo: Optional[str]

class UserSearchQuery(BaseModel):
    query: str
    limit: Optional[int] = 10

# Configuration schemas
class AppConfig(BaseModel):
    stars_price: float
    ton_price: float
    markup_percentage: float
    min_purchase_amount: float
    max_purchase_amount: float
    referral_bonus_percentage: float
    daily_login_reward: int
    bot_token: str
    webapp_url: str
    
# Error schemas
class ErrorResponse(BaseModel):
    error: str
    message: str
    details: Optional[dict] = None

class ValidationErrorResponse(BaseModel):
    error: str
    message: str
    field_errors: List[dict]

# Success schemas
class SuccessResponse(BaseModel):
    success: bool
    message: str
    data: Optional[dict] = None