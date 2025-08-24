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
        
        if not existing_user:
            # Создаем нового пользователя
            user_data = UserCreate(
                telegram_id=str(telegram_user.id),
                username=telegram_user.username,
                first_name=telegram_user.first_name,
                last_name=telegram_user.last_name,
                referred_by=referrer_user_id  # ВАЖНО: устанавливаем реферера
            )
            
            try:
                new_user = await storage_instance.create_user(user_data)
                logger.info(f"Created new user: {new_user.id} (Telegram ID: {telegram_user.id})")
                
                # Если есть реферер, начисляем ему бонус за приглашение
                if referrer_user_id:
                    await storage_instance.process_referral_registration(referrer_user_id, new_user.id)
                    logger.info(f"Processed referral registration bonus for referrer: {referrer_user_id}")
                
                return True
            except Exception as e:
                logger.error(f"Error creating user: {e}")
                return False
        else:
            logger.info(f"User already exists: {existing_user.id} (Telegram ID: {telegram_user.id})")
            return True

@router.message(CommandStart())
async def start_command(message: Message):
    """Handle /start command with referral support"""
    user = message.from_user
    
    # Извлекаем аргументы команды /start (реферальный код)
    command_args = message.text.split()[1:] if message.text and len(message.text.split()) > 1 else []
    referrer_user_id = None
    
    if command_args:
        referral_param = command_args[0]
        logger.info(f"Start command with parameter: {referral_param}")
        
        # Получаем префикс из настроек для проверки
        async with AsyncSessionLocal() as session:
            storage_instance = Storage(session)
            prefix = await storage_instance.get_cached_setting("referral_prefix")
            
            # Проверяем, что параметр начинается с нашего префикса
            if referral_param.startswith(prefix):
                referral_code = referral_param[len(prefix):]
                logger.info(f"Extracted referral code: {referral_code}")
                
                # Ищем пользователя-реферера по коду
                referrer_user = await storage_instance.get_user_by_referral_code(referral_code)
                if referrer_user:
                    referrer_user_id = referrer_user.id
                    logger.info(f"Found referrer: {referrer_user.telegram_id} for new user: {user.id}")
                else:
                    logger.warning(f"Referrer not found for code: {referral_code}")
    
    # Создаем или получаем пользователя с реферером
    user_created = await get_or_create_user(user, referrer_user_id)
    
    if not user_created:
        await message.answer("❌ Произошла ошибка при регистрации.")
        return
    
    # Формируем приветственное сообщение
    welcome_text = "🎉 <b>Добро пожаловать в Stars Exchange!</b>\n\n"
    welcome_text += "💫 Обменивайте Telegram Stars на TON и обратно с лучшими курсами!\n\n"
    
    if referrer_user_id:
        welcome_text += "🎁 <b>Вы пришли по реферальной ссылке!</b>\n"
        welcome_text += "Ваш друг получит бонус за приглашение, а вы - за активность!\n\n"
    
    welcome_text += "🚀 Нажмите кнопку ниже, чтобы начать:"
    
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
                    text="👥 Рефералы",
                    callback_data="referrals"
                ),
                InlineKeyboardButton(
                    text="💰 Баланс", 
                    callback_data="balance"
                )
            ]
        ]
    )
    
    await message.answer(welcome_text, reply_markup=keyboard, parse_mode="HTML")
        
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
        
        storage_instance = Storage(session)
        bot_url = await storage_instance.get_cached_setting("bot_base_url")
        prefix = await storage_instance.get_cached_setting("referral_prefix")
        referral_link = f"{bot_url}?start={prefix}{db_user.referral_code}"
        
        bonus_percent = await storage_instance.get_cached_setting("referral_bonus_percentage")
        referrals_text = f"""
👥 <b>Реферальная программа</b>

💰 <b>Зарабатывайте {bonus_percent}% с каждой покупки друзей!</b>

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