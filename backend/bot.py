import asyncio
import logging
import os
import re
from datetime import date
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

async def get_or_create_user(telegram_user, referral_code=None) -> bool:
    """Get or create user in database"""
    async with AsyncSessionLocal() as session:
        storage_instance = Storage(session)
        
        # Check if user exists
        existing_user = await storage_instance.get_user_by_telegram_id(str(telegram_user.id))
        
        if not existing_user:
            # Generate referral code for new user
            import random
            import string
            new_referral_code = ''.join(random.choices(string.ascii_uppercase + string.digits, k=8))
            
            # Create new user
            user_data = UserCreate(
                telegram_id=str(telegram_user.id),
                username=telegram_user.username,
                first_name=telegram_user.first_name,
                last_name=telegram_user.last_name,
                referral_code=new_referral_code,
                referred_by=referral_code
            )
            
            try:
                new_user = await storage_instance.create_user(user_data)
                logger.info(f"Created new user: {new_user.id} (Telegram ID: {telegram_user.id})")
                
                # Обработать ежедневный вход для нового пользователя
                await handle_daily_login(new_user.id)
                
                # Если есть реферер, дать ему бонус
                if referral_code:
                    await storage_instance.process_referral_bonus(referral_code, 25)
                
                return True
            except Exception as e:
                logger.error(f"Error creating user: {e}")
                return False
        else:
            logger.info(f"User already exists: {existing_user.id} (Telegram ID: {telegram_user.id})")
            
            # Обработать ежедневный вход для существующего пользователя
            await handle_daily_login(existing_user.id)
            
            return True

async def handle_daily_login(user_id: str):
    """Обработка ежедневного входа"""
    async with AsyncSessionLocal() as session:
        storage_instance = Storage(session)
        
        # Найти задание ежедневного входа
        daily_login_task = await storage_instance.get_daily_login_task()
        
        if daily_login_task:
            # Убедиться, что запись UserTask существует
            await storage_instance.ensure_user_task_exists(user_id, daily_login_task.id)
            
            # Проверить, выполнял ли пользователь сегодня
            completed_today = await storage_instance.check_daily_task_completion(
                user_id, daily_login_task.id
            )
            
            if not completed_today:
                # Выполнить задание
                await storage_instance.complete_user_task(user_id, daily_login_task.id)
                await storage_instance.add_user_stars(user_id, daily_login_task.reward)
                
                logger.info(f"Daily login completed for user {user_id}, reward: {daily_login_task.reward}")

@router.message(CommandStart())
async def start_command(message: Message):
    """Handle /start command"""
    user = message.from_user
    
    # Извлечь реферальный код из команды
    referral_code = None
    if message.text and len(message.text.split()) > 1:
        start_param = message.text.split()[1]
        if start_param.startswith('ref'):
            referral_code = start_param[3:]  # Убрать префикс 'ref'
    
    # Create or get user
    user_created = await get_or_create_user(user, referral_code)
    
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
    
    if referral_code:
        welcome_text += f"\n\n🎉 <b>Вы пришли по реферальной ссылке!</b>\nВаш друг получит бонус за ваше приглашение."
    
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
👥 Рефералов: <b>{len(await storage_instance.get_user_referrals(db_user.id))}</b>
🏆 Всего заработано: <b>{db_user.total_stars_earned} звезд</b>
💰 Заработок с рефералов: <b>{db_user.total_referral_earnings} звезд</b>
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
    user = message.from_user
    
    async with AsyncSessionLocal() as session:
        storage_instance = Storage(session)
        db_user = await storage_instance.get_user_by_telegram_id(str(user.id))
        
        if not db_user:
            await message.answer("❌ Пользователь не найден. Отправьте /start для регистрации.")
            return
        
        # Получить задания с информацией о выполнении
        user_tasks = await storage_instance.get_user_tasks_with_task_info(db_user.id)
        active_tasks = await storage_instance.get_active_tasks()
        
        tasks_text = "🎯 <b>Доступные задания:</b>\n\n"
        
        daily_tasks = [t for t in user_tasks if t.get('type') == 'daily']
        social_tasks = [t for t in user_tasks if t.get('type') == 'social']
        referral_tasks = [t for t in user_tasks if t.get('type') == 'referral']
        
        if daily_tasks:
            tasks_text += "⭐ <b>Ежедневные:</b>\n"
            for task in daily_tasks:
                status = "✅" if task['completed'] else "⏰"
                tasks_text += f"{status} {task['title']}: +{task['reward']} звезд\n"
            tasks_text += "\n"
        
        if social_tasks:
            tasks_text += "🎁 <b>Социальные:</b>\n"
            for task in social_tasks:
                status = "✅" if task['completed'] else "⏰"
                tasks_text += f"{status} {task['title']}: +{task['reward']} звезд\n"
            tasks_text += "\n"
        
        if referral_tasks:
            tasks_text += "👥 <b>Реферальные:</b>\n"
            for task in referral_tasks:
                status = "✅" if task['completed'] else "⏰"
                tasks_text += f"{status} {task['title']}: +{task['reward']} звезд\n"
            tasks_text += "\n"
        
        tasks_text += "💡 <b>Выполняйте задания каждый день и зарабатывайте больше звезд!</b>"
    
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
        
        referrals = await storage_instance.get_user_referrals(db_user.id)
        referral_link = f"https://t.me/{(await bot.get_me()).username}?start=ref{db_user.referral_code}"
        
        referrals_text = f"""
👥 <b>Реферальная программа</b>

💰 <b>Зарабатывайте 10% с каждой покупки друзей!</b>

🔗 <b>Ваша реферальная ссылка:</b>
<code>{referral_link}</code>

📊 <b>Статистика:</b>
👥 Приглашено друзей: <b>{len(referrals)}</b>
💰 Заработано с рефералов: <b>{db_user.total_referral_earnings} звезд</b>

💡 <b>Поделитесь ссылкой с друзьями и зарабатывайте вместе!</b>
        """
        
        # Показать информацию о рефералах
        if referrals:
            referrals_text += "\n\n👥 <b>Ваши рефералы:</b>\n"
            for ref in referrals[:10]:  # Показать только первых 10
                ref_name = ref.first_name or "Неизвестно"
                if ref.username:
                    ref_name += f" (@{ref.username})"
                referrals_text += f"• {ref_name}\n"
            
            if len(referrals) > 10:
                referrals_text += f"... и еще {len(referrals) - 10}\n"
        
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

@router.message(F.text == "⚙️ Настройки")
async def settings_command(message: Message):
    """Handle settings inquiry"""
    user = message.from_user
    
    async with AsyncSessionLocal() as session:
        storage_instance = Storage(session)
        db_user = await storage_instance.get_user_by_telegram_id(str(user.id))
        
        if not db_user:
            await message.answer("❌ Пользователь не найден. Отправьте /start для регистрации.")
            return
        
        settings_text = f"""
⚙️ <b>Настройки профиля</b>

👤 <b>Информация:</b>
• Имя: {db_user.first_name or 'Не указано'}
• Username: @{db_user.username or 'Не указано'}
• ID: <code>{db_user.telegram_id}</code>
• Дата регистрации: {db_user.created_at.strftime('%d.%m.%Y')}

🔔 <b>Уведомления:</b>
{"✅ Включены" if db_user.notifications_enabled else "❌ Отключены"}

📊 <b>Статистика:</b>
• Дней в системе: {(date.today() - db_user.created_at.date()).days}
• Активность: {'Высокая' if db_user.tasks_completed > 10 else 'Средняя' if db_user.tasks_completed > 5 else 'Низкая'}
        """
        
        keyboard = InlineKeyboardMarkup(
            inline_keyboard=[
                [
                    InlineKeyboardButton(
                        text="🚀 Открыть приложение",
                        web_app=WebAppInfo(url=f"{WEBAPP_URL}#profile")
                    )
                ]
            ]
        )
        
        await message.answer(settings_text, reply_markup=keyboard, parse_mode="HTML")

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
    
    help_text = """
👋 <b>Добро пожаловать в Stars Exchange!</b>

<b>Доступные команды:</b>
/start - Начать работу
💰 Баланс - Посмотреть баланс
📈 Задания - Список заданий
👥 Рефералы - Реферальная программа
⚙️ Настройки - Настройки профиля

Или используйте кнопку ниже для доступа к полному функционалу:
    """
    
    await message.answer(
        help_text,
        reply_markup=keyboard,
        parse_mode="HTML"
    )

async def setup_bot_commands():
    """Настроить команды бота"""
    from aiogram.types import BotCommand
    
    commands = [
        BotCommand(command="start", description="Начать работу с ботом"),
        BotCommand(command="balance", description="Показать баланс"),
        BotCommand(command="tasks", description="Список заданий"),
        BotCommand(command="referrals", description="Реферальная программа"),
        BotCommand(command="settings", description="Настройки профиля"),
    ]
    
    await bot.set_my_commands(commands)

async def main():
    """Main function to run the bot"""
    try:
        # Initialize database
        await init_db()
        await init_default_data()
        logger.info("Database initialized")
        
        # Setup bot commands
        await setup_bot_commands()
        logger.info("Bot commands set up")
        
        # Start polling
        logger.info("Starting bot...")
        await dp.start_polling(bot)
        
    except Exception as e:
        logger.error(f"Error running bot: {e}")
    finally:
        await bot.session.close()

if __name__ == "__main__":
    asyncio.run(main())