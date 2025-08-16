from sqlalchemy import create_engine
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from models import Base
import os

# Database URL for SQLite
DATABASE_URL = "sqlite+aiosqlite:///./app.db"

# Create async engine
engine = create_async_engine(
    DATABASE_URL,
    echo=True,  # Set to False in production
    future=True
)

# Create async session factory
AsyncSessionLocal = sessionmaker(
    engine, class_=AsyncSession, expire_on_commit=False
)

async def init_db():
    """Initialize database tables"""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

async def init_default_data():
    """Initialize default data (settings, default tasks)"""
    from storage import Storage
    
    async with AsyncSessionLocal() as session:
        storage = Storage(session)
        
        # Создать базовые настройки если их нет
        settings_to_create = [
            ("stars_price", "2.30"),
            ("ton_price", "420.50"),
            ("markup_percentage", "5.0"),
        ]
        
        for key, value in settings_to_create:
            existing = await storage.get_setting(key)
            if not existing:
                await storage.create_setting(key, value)
        
        # Создать базовые задания если их нет
        existing_tasks = await storage.get_all_tasks()
        if not existing_tasks:
            default_tasks = [
                {
                    "title": "Ежедневный вход",
                    "description": "Заходите в приложение каждый день и получайте награду",
                    "reward": 10,
                    "type": "daily",
                    "action": "daily_login",
                    "is_active": True
                },
                {
                    "title": "Поделиться приложением",
                    "description": "Поделитесь приложением с друзьями",
                    "reward": 25,
                    "type": "social",
                    "action": "share_app",
                    "is_active": True
                },
                {
                    "title": "Подписаться на канал",
                    "description": "Подпишитесь на наш новостной канал в Telegram",
                    "reward": 50,
                    "type": "social",
                    "action": "follow_channel",
                    "is_active": True
                },
                {
                    "title": "Пригласить друга",
                    "description": "Пригласите друга и получите бонус",
                    "reward": 100,
                    "type": "referral",
                    "action": "invite_friends",
                    "is_active": True
                }
            ]
            
            for task_data in default_tasks:
                await storage.create_task(task_data)