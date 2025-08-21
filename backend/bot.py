import asyncio
import logging
import os
import sys
from datetime import datetime
from dotenv import load_dotenv

from aiogram import Bot, Dispatcher, Router, F
from aiogram.filters import Command, CommandStart
from aiogram.types import Message, InlineKeyboardMarkup, InlineKeyboardButton, WebAppInfo
from aiogram.enums import ParseMode

# Load environment variables
load_dotenv()

# Add backend directory to path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from database import AsyncSessionLocal, init_db, init_default_data
from storage import Storage
from models import User
from schemas import UserCreate

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Bot token and webapp URL from environment
BOT_TOKEN = os.getenv('BOT_TOKEN')
WEBAPP_URL = os.getenv('WEBAPP_URL', 'https://your-app.com')

if not BOT_TOKEN:
    logger.error("BOT_TOKEN not found in environment variables")
    sys.exit(1)

# Initialize bot and dispatcher
bot = Bot(token=BOT_TOKEN, parse_mode=ParseMode.HTML)
dp = Dispatcher()
router = Router()
dp.include_router(router)

# Логирование в файл
def log_event(event_type: str, details: str):
    """Записать событие в лог файл"""
    try:
        os.makedirs("logs", exist_ok=True)
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        log_entry = f"{timestamp} - {event_type} - {details}\n"
        
        with open("logs/admin.log", "a", encoding="utf-8") as f:
            f.write(log_entry)
            f.flush()
    except Exception as e:
        logger.error(f"Failed to write log: {e}")

async def get_or_create_user(telegram_user) -> User:
    """Получить или создать пользователя в БД"""
    async with AsyncSessionLocal() as session:
        storage = Storage(session)
        
        # Проверяем, есть ли пользователь
        db_user = await storage.get_user_by_telegram_id(str(telegram_user.id))
        
        if not db_user:
            # Создаем нового пользователя
            user_data = UserCreate(
                telegram_id=str(telegram_user.id),
                username=telegram_user.username,
                first_name=telegram_user.first_name,
                last_name=telegram_user.last_name
            )
            db_user = await storage.create_user(user_data)
            
            # Логируем регистрацию
            log_event("USER_REGISTERED", 
                     f"telegram_id: {telegram_user.id} username: {telegram_user.username or 'None'}")
            
            logger.info(f"New user registered: {telegram_user.id}")
        
        return db_user

async def get_dynamic_settings():
    """Получить динамические настройки из БД"""
    async with AsyncSessionLocal() as session:
        storage = Storage(session)
        
        # Получаем настройки
        referral_setting = await storage.get_setting("referral_percentage")
        news_channel_setting = await storage.get_setting("news_channel_url")
        
        return {
            "referral_percentage": referral_setting.value if referral_setting else "10",
            "news_channel_url": news_channel_setting.value if news_channel_setting else "https://t.me/starsexchange_news"
        }

@router.message(CommandStart())
async def start_command(message: Message):
    """Handle /start command"""
    user = message.from_user
    
    if not user:
        logger.error("No user information in start command")
        await message.answer("❌ Ошибка получения данных пользователя. Попробуйте позже.")
        return
    
    try:
        # Получаем или создаем пользователя
        db_user = await get_or_create_user(user)
        
        # Получаем динамические настройки
        settings = await get_dynamic_settings()
        
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
                        url=settings["news_channel_url"]
                    )
                ]
            ]
        )
        
        welcome_text = f"""
🌟 <b>Добро пожаловать в Stars Exchange!</b>

Привет, {user.first_name}! 👋

🔥 <b>У нас вы можете:</b>
⭐ Покупать Telegram Stars со скидкой
💎 Обменивать TON Coin
🎁 Выполнять простые задания за награды
👥 Зарабатывать на рефералах

🚀 <b>Нажмите кнопку ниже, чтобы начать!</b>
        """
        
        await message.answer(
            welcome_text,
            reply_markup=keyboard
        )
        
    except Exception as e:
        logger.error(f"Error in start command: {e}")
        await message.answer("❌ Произошла ошибка. Попробуйте позже.")

@router.message(F.text == "💰 Баланс")
async def balance_command(message: Message):
    """Handle balance inquiry"""
    user = message.from_user
    
    try:
        db_user = await get_or_create_user(user)
        
        balance_text = f"""
💰 <b>Ваш баланс:</b>

⭐ Telegram Stars: <b>{db_user.stars_balance}</b>
💎 TON Balance: <b>{db_user.ton_balance}</b>

📊 <b>Статистика:</b>
🎯 Заданий выполнено: <b>{db_user.tasks_completed}</b>
👥 Рефералов: <b>0</b>
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
        
        await message.answer(balance_text, reply_markup=keyboard)
        
    except Exception as e:
        logger.error(f"Error in balance command: {e}")
        await message.answer("❌ Произошла ошибка. Попробуйте позже.")

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

💡 <b>Выполняйте простые задания и зарабатывайте звезды!</b>

Открыйте приложение для просмотра всех доступных заданий.
    """
    
    await message.answer(tasks_text, reply_markup=keyboard)

@router.message(F.text == "👥 Рефералы")
async def referrals_command(message: Message):
    """Handle referrals inquiry"""
    user = message.from_user
    
    try:
        db_user = await get_or_create_user(user)
        
        # Получаем настройки
        settings = await get_dynamic_settings()
        referral_percentage = settings["referral_percentage"]
        
        # Формируем реферальную ссылку
        bot_info = await bot.get_me()
        referral_link = f"https://t.me/{bot_info.username}?start=ref{db_user.referral_code}"
        
        referrals_text = f"""
👥 <b>Реферальная программа</b>

💰 <b>Зарабатывайте {referral_percentage}% с каждой покупки друзей!</b>

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
        
        await message.answer(referrals_text, reply_markup=keyboard)
        
    except Exception as e:
        logger.error(f"Error in referrals command: {e}")
        await message.answer("❌ Произошла ошибка. Попробуйте позже.")

@router.message(Command("help"))
async def help_command(message: Message):
    """Handle /help command"""
    help_text = """
🤖 <b>Помощь по боту Stars Exchange</b>

<b>Доступные команды:</b>
/start - Начать работу с ботом
/help - Показать это сообщение
💰 Баланс - Проверить баланс
📈 Задания - Просмотр заданий
👥 Рефералы - Реферальная программа

<b>Функции:</b>
• Покупка Telegram Stars со скидкой
• Обмен TON Coin
• Выполнение заданий за награды
• Реферальная программа

💡 Используйте веб-приложение для полного функционала!
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
    
    await message.answer(help_text, reply_markup=keyboard)

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

async def setup_bot():
    """Initialize bot database and settings"""
    try:
        await init_db()
        await init_default_data()
        logger.info("Bot database initialized")
    except Exception as e:
        logger.error(f"Error initializing bot database: {e}")
        raise

async def main():
    """Main function to run the bot"""
    try:
        # Setup bot
        await setup_bot()
        
        # Start polling
        logger.info("Starting bot...")
        await dp.start_polling(bot)
        
    except Exception as e:
        logger.error(f"Error running bot: {e}")
        raise
    finally:
        await bot.session.close()

if __name__ == "__main__":
    asyncio.run(main())