from sqlalchemy import Column, String, Integer, Numeric, Boolean, DateTime, Text, ForeignKey
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid

Base = declarative_base()

def generate_uuid():
    return str(uuid.uuid4())

class User(Base):
    __tablename__ = "users"
    
    id = Column(String, primary_key=True, default=generate_uuid)
    telegram_id = Column(String, nullable=False, unique=True)
    username = Column(String, nullable=True)
    first_name = Column(String, nullable=True)
    last_name = Column(String, nullable=True)
    stars_balance = Column(Integer, default=0)
    ton_balance = Column(Numeric(18, 8), default=0)
    referral_code = Column(String, unique=True, nullable=True)
    referred_by = Column(String, nullable=True)
    total_stars_earned = Column(Integer, default=0)
    total_referral_earnings = Column(Integer, default=0)
    tasks_completed = Column(Integer, default=0)
    daily_earnings = Column(Integer, default=0)
    notifications_enabled = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    transactions = relationship("Transaction", back_populates="user")
    user_tasks = relationship("UserTask", back_populates="user")

class Transaction(Base):
    __tablename__ = "transactions"
    
    id = Column(String, primary_key=True, default=generate_uuid)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    type = Column(String, nullable=False)  # 'buy_stars', 'buy_ton', 'referral_bonus', 'task_reward'
    currency = Column(String, nullable=False)  # 'stars', 'ton', 'rub'
    amount = Column(Numeric(18, 8), nullable=False)
    rub_amount = Column(Numeric(10, 2), nullable=True)
    status = Column(String, default="pending")  # 'pending', 'completed', 'failed', 'cancelled'
    description = Column(Text, nullable=True)
    
    # 🚀 НОВОЕ ПОЛЕ для правильного расчета прибыли от TON
    ton_price_at_purchase = Column(Numeric(10, 2), nullable=True)  # Цена TON на момент покупки
    
    # Payment system fields
    payment_system = Column(String, nullable=True)  # 'robokassa', 'manual'
    payment_url = Column(Text, nullable=True)  # URL для оплаты
    invoice_id = Column(String, nullable=True, unique=True)  # ID в платежной системе
    payment_data = Column(Text, nullable=True)  # JSON данные от платежной системы
    
    created_at = Column(DateTime, default=datetime.utcnow)
    paid_at = Column(DateTime, nullable=True)  # Время оплаты
    
    # Relationships
    user = relationship("User", back_populates="transactions")
 
class Task(Base):
    __tablename__ = "tasks"
    
    id = Column(String, primary_key=True, default=generate_uuid)
    title = Column(Text, nullable=False)
    description = Column(Text, nullable=False)
    reward = Column(Integer, nullable=False)
    type = Column(String, nullable=False)  # 'daily', 'social', 'referral'
    action = Column(String, nullable=True)  # 'daily_login', 'share_app', etc.
    is_active = Column(Boolean, default=True)
    completion_title = Column(String, nullable=True)
    completion_text = Column(String, nullable=True)
    share_text = Column(String, nullable=True)
    button_text = Column(String, nullable=True)
    
    # ✅ ДОБАВИТЬ ЭТИ ПОЛЯ:
    status = Column(String, default="active")  # 'draft', 'active', 'paused', 'expired'
    deadline = Column(DateTime, nullable=True)
    max_completions = Column(Integer, nullable=True)
    requirements = Column(Text, nullable=True)
    completed_count = Column(Integer, default=0)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    user_tasks = relationship("UserTask", back_populates="task")

class UserTask(Base):
    __tablename__ = "user_tasks"
    
    id = Column(String, primary_key=True, default=generate_uuid)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    task_id = Column(String, ForeignKey("tasks.id"), nullable=False)
    completed = Column(Boolean, default=False)
    completed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    user = relationship("User", back_populates="user_tasks")
    task = relationship("Task", back_populates="user_tasks")

class Setting(Base):
    __tablename__ = "settings"
    
    id = Column(String, primary_key=True, default=generate_uuid)
    key = Column(String, nullable=False, unique=True)
    value = Column(Text, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow)