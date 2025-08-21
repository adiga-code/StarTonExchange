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
            Setting(key="markup_percentage", value="5"),  # Для обратной совместимости
            Setting(key="ton_markup_percentage", value="5"),
            Setting(key="referral_percentage", value="10"),
            Setting(key="telegram_stars_official_price", value="180"),
            Setting(key="news_channel_url", value="https://t.me/starsexchange_news"),
            Setting(key="news_channel_username", value="@starsexchange_news"),
            Setting(key="sharing_text", value="Попробуй этот крутой обменник Stars и TON!"),
            Setting(key="referral_sharing_text", value="Попробуй этот крутой обменник Stars и TON! 🚀"),
        ]
        
        for setting in default_settings:
            session.add(setting)
        
        # Не добавляем дефолтные задания - админ создаст сам
        await session.commit()
        print("Default data initialized")