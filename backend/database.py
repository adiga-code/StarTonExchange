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
    #echo=True,  # Set to False in production
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

async def get_db():
    """Dependency to get DB session"""
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()

async def init_default_data():
    """Initialize default settings and tasks"""
    async with AsyncSessionLocal() as session:
        from models import Setting, Task
        from sqlalchemy import select
        
        # Check if settings already exist
        result = await session.execute(select(Setting))
        if result.first():
            return  # Data already initialized
        
        # Initialize default settings
        default_settings = [
            Setting(key="stars_price", value="2.30"),
            Setting(key="ton_price", value="420.50"),
            Setting(key="markup_percentage", value="5"),
        ]
        
        for setting in default_settings:
            session.add(setting)
        
        # Initialize default tasks
        default_tasks = [
            Task(
                title="Ежедневный вход",
                description="Заходите каждый день",
                reward=10,
                type="daily",
                action="daily_login",
                is_active=True,
            ),
            Task(
                title="Поделиться с другом",
                description="Пригласите 1 друга",
                reward=25,
                type="referral",
                action="share_app",
                is_active=True,
            ),
            Task(
                title="Подписаться на канал",
                description="@starsexchange_news",
                reward=50,
                type="social",
                action="follow_channel",
                is_active=True,
            ),
        ]
        
        for task in default_tasks:
            session.add(task)
        
        await session.commit()
        print("Default data initialized")