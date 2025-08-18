import asyncio
import logging
import os
from aiogram import Bot, Dispatcher, Router, F
from aiogram.types import Message, InlineKeyboardMarkup, InlineKeyboardButton, WebAppInfo
from aiogram.filters import CommandStart
from aiogram.fsm.storage.memory import MemoryStorage
from dotenv import load_dotenv

from database import AsyncSessionLocal, init_db, init_default_data
from storage import Storage
from schemas import UserCreate

# Load environment variables
load_dotenv()

# Bot configuration
BOT_TOKEN = os.getenv('BOT_TOKEN')
WEBAPP_URL = os.getenv('WEBAPP_URL', 'https://your-app.com')

if not BOT_TOKEN:
    raise ValueError("BOT_TOKEN not found in environment variables")

# Initialize bot and dispatcher
bot = Bot(token=BOT_TOKEN)
storage = MemoryStorage()
dp = Dispatcher(storage=storage)
router = Router()
dp.include_router(router)

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

async def get_or_create_user(telegram_user) -> bool:
    """Get or create user in database"""
    async with AsyncSessionLocal() as session:
        storage_instance = Storage(session)
        
        # Check if user exists
        existing_user = await storage_instance.get_user_by_telegram_id(str(telegram_user.id))
        
        if not existing_user:
            # Create new user
            user_data = UserCreate(
                telegram_id=str(telegram_user.id),
                username=telegram_user.username,
                first_name=telegram_user.first_name,
                last_name=telegram_user.last_name,
            )
            
            try:
                new_user = await storage_instance.create_user(user_data)
                logger.info(f"Created new user: {new_user.id} (Telegram ID: {telegram_user.id})")
                return True
            except Exception as e:
                logger.error(f"Error creating user: {e}")
                return False
        else:
            logger.info(f"User already exists: {existing_user.id} (Telegram ID: {telegram_user.id})")
            return True

@router.message(CommandStart())
async def start_command(message: Message):
    """Handle /start command"""
    user = message.from_user
    
    # Create or get user
    user_created = await get_or_create_user(user)
    
    if not user_created:
        await message.answer(
            "❌ Произошла ошибка при регистрации. Попробуйте позже."
        )
        return
    
    # Create inline keyboard with Web App button
    keyboard = InlineKeyboardMarkup(
        inline_keyboard=[
            [
                InlineKeyboardButton(
                    text="🚀 Открыть Stars Exchange",
                    web_app=WebAppInfo(url=WEBAPP_URL)
                )
            ],
            [
                InlineKeyboardButton(
                    text="📢 Новости",
                    url="https://t.me/starsexchange_news"
                )
            ]
        ]
    )
    
    welcome_text = f"""
🌟 <b>Добро пожаловать в Stars Exchange!</b>

Привет, {user.first_name}! 👋

🔥 <b>У нас вы можете:</b>
⭐ Покупать Telegram Stars
💎 Обменивать TON Coin
🎁 Выполнять задания за награды
👥 Зарабатывать на рефералах

💰 <b>Специальные предложения:</b>
• Бонус +10 звезд за ежедневный вход
• 25 звезд за каждого приглашенного друга
• 50 звезд за подписку на наш канал

🚀 <b>Нажмите кнопку ниже, чтобы начать!</b>
    """
    
    await message.answer(
        welcome_text,
        reply_markup=keyboard,
        parse_mode="HTML"
    )

@router.message(F.text == "💰 Баланс")
async def balance_command(message: Message):
    """Handle balance inquiry"""
    user = message.from_user
    
    async with AsyncSessionLocal() as session:
        storage_instance = Storage(session)
        db_user = await storage_instance.get_user_by_telegram_id(str(user.id))
        
        if not db_user:
            await message.answer("❌ Пользователь не найден. Отправьте /start для регистрации.")
            return
        
        balance_text = f"""
💰 <b>Ваш баланс:</b>

⭐ Telegram Stars: <b>{db_user.stars_balance}</b>
💎 TON Balance: <b>{db_user.ton_balance}</b>

📊 <b>Статистика:</b>
🎯 Заданий выполнено: <b>{db_user.tasks_completed}</b>
👥 Рефералов: <b>{db_user.total_referral_earnings}</b>
🏆 Всего заработано: <b>{db_user.total_stars_earned} звезд</b>
        """
        
        keyboard = InlineKeyboardMarkup(
            inline_keyboard=[
                [
                    InlineKeyboardButton(
                        text="🚀 Открыть приложение",
                        web_app=WebAppInfo(url=WEBAPP_URL)
                    )
                ]
            ]
        )
        
        await message.answer(balance_text, reply_markup=keyboard, parse_mode="HTML")

@router.message(F.text == "📈 Задания")
async def tasks_command(message: Message):
    """Handle tasks inquiry"""
    keyboard = InlineKeyboardMarkup(
        inline_keyboard=[
            [
                InlineKeyboardButton(
                    text="🎯 Выполнить задания",
                    web_app=WebAppInfo(url=f"{WEBAPP_URL}#tasks")
                )
            ]
        ]
    )
    
    tasks_text = """
🎯 <b>Доступные задания:</b>

⭐ <b>Ежедневные:</b>
• Ежедневный вход: +10 звезд

🎁 <b>Социальные:</b>
• Пригласить друга: +25 звезд
• Подписаться на канал: +50 звезд

💡 <b>Выполняйте задания каждый день и зарабатывайте больше звезд!</b>
    """
    
    await message.answer(tasks_text, reply_markup=keyboard, parse_mode="HTML")

@router.message(F.text == "👥 Рефералы")
async def referrals_command(message: Message):
    """Handle referrals inquiry"""
    user = message.from_user
    
    async with AsyncSessionLocal() as session:
        storage_instance = Storage(session)
        db_user = await storage_instance.get_user_by_telegram_id(str(user.id))
        
        if not db_user:
            await message.answer("❌ Пользователь не найден. Отправьте /start для регистрации.")
            return
        
        referral_link = f"https://t.me/{(await bot.get_me()).username}?start=ref{db_user.referral_code}"
        
        referrals_text = f"""
👥 <b>Реферальная программа</b>

💰 <b>Зарабатывайте 10% с каждой покупки друзей!</b>

🔗 <b>Ваша реферальная ссылка:</b>
<code>{referral_link}</code>

📊 <b>Статистика:</b>
👥 Приглашено друзей: <b>0</b>
💰 Заработано с рефералов: <b>{db_user.total_referral_earnings} звезд</b>

💡 <b>Поделитесь ссылкой с друзьями и зарабатывайте вместе!</b>
        """
        
        keyboard = InlineKeyboardMarkup(
            inline_keyboard=[
                [
                    InlineKeyboardButton(
                        text="📤 Поделиться ссылкой",
                        switch_inline_query=f"Попробуй этот крутой обменник Stars и TON! {referral_link}"
                    )
                ]
            ]
        )
        
        await message.answer(referrals_text, reply_markup=keyboard, parse_mode="HTML")

@router.message()
async def default_handler(message: Message):
    """Handle all other messages"""
    keyboard = InlineKeyboardMarkup(
        inline_keyboard=[
            [
                InlineKeyboardButton(
                    text="🚀 Открыть Stars Exchange",
                    web_app=WebAppInfo(url=WEBAPP_URL)
                )
            ]
        ]
    )
    
    await message.answer(
        "👋 Используйте кнопку ниже для доступа к Stars Exchange:",
        reply_markup=keyboard
    )

async def main():
    """Main function to run the bot"""
    try:
        # Start polling
        logger.info("Starting bot...")
        await dp.start_polling(bot)
        
    except Exception as e:
        logger.error(f"Error running bot: {e}")
    finally:
        await bot.session.close()

if __name__ == "__main__":
    asyncio.run(main())