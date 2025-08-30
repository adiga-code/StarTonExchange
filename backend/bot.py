import asyncio
import logging
import os
from aiogram import Bot, Dispatcher, Router, F
from aiogram.types import Message, InlineKeyboardMarkup, InlineKeyboardButton, WebAppInfo, CallbackQuery
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
WEBAPP_URL = os.getenv('WEBAPP_URL', 'https://app1.hezh-digital.ru')

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

async def get_or_create_user(telegram_user, referrer_user_id=None) -> bool:
    """Get or create user in database with referral support"""
    async with AsyncSessionLocal() as session:
        storage_instance = Storage(session)
        
        # Проверяем, существует ли пользователь
        existing_user = await storage_instance.get_user_by_telegram_id(str(telegram_user.id))
        
        if existing_user:
            return False  # Пользователь уже существует
        
        # Создаем нового пользователя
        user_data = UserCreate(
            telegram_id=str(telegram_user.id),
            first_name=telegram_user.first_name,
            last_name=telegram_user.last_name,
            username=telegram_user.username,
            referrer_user_id=referrer_user_id
        )
        
        await storage_instance.create_user(user_data)
        return True  # Новый пользователь создан

@router.message(CommandStart())
async def start_command(message: Message):
    """Handle /start command with referral support"""
    user = message.from_user
    referrer_user_id = None
    
    # Проверяем наличие реферального кода
    if message.text and len(message.text.split()) > 1:
        start_param = message.text.split()[1]
        if start_param.startswith('ref'):
            referral_code = start_param[3:]  # Убираем префикс 'ref'
            async with AsyncSessionLocal() as session:
                storage_instance = Storage(session)
                referrer = await storage_instance.get_user_by_referral_code(referral_code)
                if referrer:
                    referrer_user_id = referrer.id
    
    # Создаем или получаем пользователя
    is_new_user = await get_or_create_user(user, referrer_user_id)
    
    welcome_text = "🎉 <b>Добро пожаловать в StarsGuru!</b>\n\n"
    welcome_text += "💫 Покупайте Telegram Stars и TON для себя или других пользователей!\n\n"
    
    if referrer_user_id and is_new_user:
        welcome_text += "🎁 <b>Вы пришли по реферальной ссылке!</b>\n"
        welcome_text += "Ваш друг получит бонус за приглашение!\n\n"
    
    welcome_text += "🚀 Выберите действие:"
    
    keyboard = InlineKeyboardMarkup(
        inline_keyboard=[
            [
                InlineKeyboardButton(
                    text="🚀 Открыть StarsGuru",
                    web_app=WebAppInfo(url=WEBAPP_URL)
                )
            ],
            [
                InlineKeyboardButton(
                    text="📄 Документы",
                    callback_data="documents"
                )
            ]
        ]
    )
    
    await message.answer(welcome_text, reply_markup=keyboard, parse_mode="HTML")

@router.callback_query(F.data == "documents")
async def documents_callback(callback_query: CallbackQuery):
    """Handle documents button press"""
    documents_text = """
📄 <b>Юридические документы StarsGuru</b>

Ознакомьтесь с документами, регулирующими использование платформы:
    """
    
    keyboard = InlineKeyboardMarkup(
        inline_keyboard=[
            [
                InlineKeyboardButton(
                    text="🔒 Политика конфиденциальности",
                    url="https://telegra.ph/POLITIKA-KONFIDENCIALNOSTI-08-30-42"
                )
            ],
            [
                InlineKeyboardButton(
                    text="📋 Пользовательское соглашение",
                    url="https://telegra.ph/POLZOVATELSKOE-SOGLASHENIE-08-30-21"
                )
            ],
            [
                InlineKeyboardButton(
                    text="📞 Контактные данные поддержки",
                    url="https://telegra.ph/KONTAKTNYE-DANNYE-SLUZHBY-PODDERZHKI-08-30"
                )
            ],
            [
                InlineKeyboardButton(
                    text="⬅️ Назад",
                    callback_data="back_to_main"
                )
            ]
        ]
    )
    
    await callback_query.message.edit_text(
        documents_text, 
        reply_markup=keyboard, 
        parse_mode="HTML"
    )
    await callback_query.answer()

@router.callback_query(F.data == "back_to_main")
async def back_to_main_callback(callback_query: CallbackQuery):
    """Handle back to main menu"""
    welcome_text = "🎉 <b>Добро пожаловать в StarsGuru!</b>\n\n"
    welcome_text += "💫 Покупайте Telegram Stars и TON для себя или других пользователей!\n\n"
    welcome_text += "🚀 Выберите действие:"
    
    keyboard = InlineKeyboardMarkup(
        inline_keyboard=[
            [
                InlineKeyboardButton(
                    text="🚀 Открыть StarsGuru",
                    web_app=WebAppInfo(url=WEBAPP_URL)
                )
            ],
            [
                InlineKeyboardButton(
                    text="📄 Документы",
                    callback_data="documents"
                )
            ]
        ]
    )
    
    await callback_query.message.edit_text(
        welcome_text, 
        reply_markup=keyboard, 
        parse_mode="HTML"
    )
    await callback_query.answer()

@router.message()
async def default_handler(message: Message):
    """Handle all other messages"""
    keyboard = InlineKeyboardMarkup(
        inline_keyboard=[
            [
                InlineKeyboardButton(
                    text="🚀 Открыть StarsGuru",
                    web_app=WebAppInfo(url=WEBAPP_URL)
                )
            ],
            [
                InlineKeyboardButton(
                    text="📄 Документы",
                    callback_data="documents"
                )
            ]
        ]
    )
    
    await message.answer(
        "👋 Используйте кнопки ниже для работы с платформой:",
        reply_markup=keyboard
    )

async def main():
    """Main function to run the bot"""
    try:
        # Initialize database
        await init_db()
        await init_default_data()
        
        # Start polling
        logger.info("Starting bot...")
        await dp.start_polling(bot)
        
    except Exception as e:
        logger.error(f"Error running bot: {e}")
    finally:
        await bot.session.close()

if __name__ == "__main__":
    asyncio.run(main()) 