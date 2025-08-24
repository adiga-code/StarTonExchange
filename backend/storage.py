from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, and_, func
from sqlalchemy.orm import selectinload
from models import User, Transaction, Task, UserTask, Setting
from schemas import UserCreate, TransactionCreate, UserTaskCreate, SettingCreate
from typing import Optional, List
from datetime import datetime
import random
import string
from cachetools import TTLCache

class Storage:
    def __init__(self, db: AsyncSession):
        self.db = db
        self._settings_cache = TTLCache(maxsize=100, ttl=3600)
    # User methods
    async def get_user(self, user_id: str) -> Optional[User]:
        result = await self.db.execute(select(User).where(User.id == user_id))
        return result.scalar_one_or_none()

    async def get_user_by_telegram_id(self, telegram_id: str) -> Optional[User]:
        result = await self.db.execute(
            select(User).where(User.telegram_id == telegram_id)
        )
        return result.scalar_one_or_none()
    
    async def get_user_by_username(self, username: str) -> Optional[User]:
        result = await self.db.execute(
            select(User).where(User.username == username)
        )
        return result.scalar_one_or_none()
    
    async def get_user_referrals(self, user_id: str) -> List[User]:
        """Получить всех рефералов конкретного пользователя"""
        import logging
        logger = logging.getLogger(__name__)
        try:
            logger.info(f"Getting referrals for user_id: {user_id}")
            
            result = await self.db.execute(
                select(User)
                .where(User.referred_by == user_id)
                .order_by(User.created_at.desc())  # Сортируем по дате создания
            )
            referrals = result.scalars().all()
            
            logger.info(f"Found {len(referrals)} referrals for user {user_id}")
            
            # Дополнительная отладка - покажем ID рефералов
            if referrals:
                referral_ids = [r.id for r in referrals]
                logger.info(f"Referral IDs: {referral_ids}")
            
            return referrals
            
        except Exception as e:
            logger.error(f"Error getting user referrals for {user_id}: {e}", exc_info=True)
            return []
        
    async def create_user(self, user_data: UserCreate) -> User:
        # Генерируем уникальный код (до 10 попыток)
        for _ in range(10):
            referral_code = ''.join(random.choices(string.ascii_uppercase + string.digits, k=10))
            if not await self.get_user_by_referral_code(referral_code):
                break
        else:
            # Fallback на UUID если не получилось
            import uuid
            referral_code = str(uuid.uuid4())[:10].upper()
        
        user = User(
            telegram_id=user_data.telegram_id,
            username=user_data.username,
            first_name=user_data.first_name,
            last_name=user_data.last_name,
            referral_code=referral_code,
            referred_by=user_data.referred_by
        )
        
        self.db.add(user)
        await self.db.commit()
        await self.db.refresh(user)
        return user

    async def update_user(self, user_id: str, updates: dict) -> Optional[User]:
        await self.db.execute(
            update(User).where(User.id == user_id).values(**updates)
        )
        await self.db.commit()
        return await self.get_user(user_id)

    async def get_all_users(self) -> List[User]:
        """Получить всех пользователей из базы данных"""
        try:
            result = await self.db.execute(select(User))
            users = result.scalars().all()
            
            # Убедимся, что возвращаем список объектов User
            # Проверяем, что каждый элемент - это объект User
            validated_users = []
            for user in users:
                if isinstance(user, User):
                    validated_users.append(user)
                else:
                    # Если по какой-то причине получили не объект User, логируем
                    import logging
                    logger = logging.getLogger(__name__)
                    logger.warning(f"Unexpected type in get_all_users: {type(user)}")
            
            return validated_users
        except Exception as e:
            import logging
            logger = logging.getLogger(__name__)
            logger.error(f"Error in get_all_users: {e}", exc_info=True)
            raise

    # Transaction methods
    async def get_transaction(self, transaction_id: str) -> Optional[Transaction]:
        result = await self.db.execute(
            select(Transaction).where(Transaction.id == transaction_id)
        )
        return result.scalar_one_or_none()

    async def get_transactions_by_user_id(self, user_id: str) -> List[Transaction]:
        result = await self.db.execute(
            select(Transaction).where(Transaction.user_id == user_id)
        )
        return result.scalars().all()

    async def create_transaction(self, transaction_data: TransactionCreate) -> Transaction:
        transaction = Transaction(**transaction_data.dict())
        self.db.add(transaction)
        await self.db.commit()
        await self.db.refresh(transaction)
        return transaction

    async def update_transaction(self, transaction_id: str, updates: dict) -> Optional[Transaction]:
        await self.db.execute(
            update(Transaction).where(Transaction.id == transaction_id).values(**updates)
        )
        await self.db.commit()
        return await self.get_transaction(transaction_id)

    async def get_recent_transactions(self, limit: int = 10) -> List[Transaction]:
        result = await self.db.execute(
            select(Transaction)
            .options(selectinload(Transaction.user))
            .order_by(Transaction.created_at.desc())
            .limit(limit)
        )
        return result.scalars().all()

    # Task methods
    async def get_task(self, task_id: str) -> Optional[Task]:
        result = await self.db.execute(
            select(Task).where(Task.id == task_id)
        )
        return result.scalar_one_or_none()

    async def get_all_tasks(self) -> List[Task]:
        result = await self.db.execute(select(Task))
        return result.scalars().all()

    async def get_active_tasks(self) -> List[Task]:
        result = await self.db.execute(select(Task).where(Task.is_active == True))
        return result.scalars().all()

    # ОБНОВИТЬ метод create_task в storage.py:

    async def create_task(self, task_data: dict):
        """Создать новое задание"""
        # ✅ ФИЛЬТРУЕМ И ОЧИЩАЕМ ДАННЫЕ
        clean_data = {}
        
        # Обязательные поля
        clean_data["title"] = task_data["title"]
        clean_data["description"] = task_data["description"]
        clean_data["reward"] = task_data["reward"]
        clean_data["type"] = task_data["type"]
        clean_data["is_active"] = task_data.get("is_active", True)
        
        # Опциональные строковые поля
        if task_data.get("action"):
            clean_data["action"] = task_data["action"]
        if task_data.get("status"):
            clean_data["status"] = task_data["status"]
        if task_data.get("requirements"):
            clean_data["requirements"] = task_data["requirements"]
            
        # Опциональные специальные поля
        if task_data.get("deadline") is not None:
            clean_data["deadline"] = task_data["deadline"]
        if task_data.get("max_completions") is not None:
            clean_data["max_completions"] = task_data["max_completions"]
        if task_data.get("completed_count") is not None:
            clean_data["completed_count"] = task_data["completed_count"]
        
        task = Task(**clean_data)
        self.db.add(task)
        await self.db.commit()
        await self.db.refresh(task)
        return task

    # ТАКЖЕ ОБНОВИТЬ метод update_task:
    async def update_task(self, task_id: str, updates: dict):
        """Обновить задание"""
        # ✅ ФИЛЬТРУЕМ ДАННЫЕ
        clean_updates = {}
        
        # Список разрешенных полей
        allowed_fields = [
            'title', 'description', 'reward', 'type', 'action', 
            'is_active', 'status', 'deadline', 'max_completions', 
            'requirements', 'completed_count'
        ]
        
        for key, value in updates.items():
            if key in allowed_fields:
                # Не добавляем пустые строки для опциональных полей
                if key in ['deadline', 'max_completions', 'requirements', 'action'] and value == "":
                    clean_updates[key] = None
                else:
                    clean_updates[key] = value
        
        if clean_updates:  # Обновляем только если есть валидные поля
            await self.db.execute(
                update(Task).where(Task.id == task_id).values(**clean_updates)
            )
            await self.db.commit()
        
        return await self.get_task(task_id)

    # UserTask methods
    async def get_user_task(self, user_id: str, task_id: str) -> Optional[UserTask]:
        result = await self.db.execute(
            select(UserTask).where(
                and_(UserTask.user_id == user_id, UserTask.task_id == task_id)
            )
        )
        return result.scalar_one_or_none()

    async def get_user_tasks(self, user_id: str) -> List[UserTask]:
        result = await self.db.execute(
            select(UserTask).where(UserTask.user_id == user_id)
        )
        return result.scalars().all()

    async def create_user_task(self, user_task_data: UserTaskCreate) -> UserTask:
        user_task = UserTask(**user_task_data.dict())
        self.db.add(user_task)
        await self.db.commit()
        await self.db.refresh(user_task)
        return user_task

    async def update_user_task(self, user_task_id: str, updates: dict) -> Optional[UserTask]:
        await self.db.execute(
            update(UserTask).where(UserTask.id == user_task_id).values(**updates)
        )
        await self.db.commit()
        result = await self.db.execute(select(UserTask).where(UserTask.id == user_task_id))
        return result.scalar_one_or_none()

    async def complete_user_task(self, user_id: str, task_id: str) -> Optional[UserTask]:
        user_task = await self.get_user_task(user_id, task_id)
        if not user_task or user_task.completed:
            return None

        updates = {
            "completed": True,
            "completed_at": datetime.utcnow()
        }
        
        await self.db.execute(
            update(UserTask)
            .where(and_(UserTask.user_id == user_id, UserTask.task_id == task_id))
            .values(**updates)
        )
        await self.db.commit()
        return await self.get_user_task(user_id, task_id)

    async def get_user_by_referral_code(self, referral_code: str) -> Optional[User]:
        """Найти пользователя по реферальному коду"""
        try:
            result = await self.db.execute(
                select(User).where(User.referral_code == referral_code)
            )
            return result.scalar_one_or_none()
        except Exception as e:
            return None

    async def add_user_stars(self, user_id: str, stars_amount: int) -> Optional[User]:
        """Начислить звезды пользователю"""
        try:
            user = await self.get_user(user_id)
            if not user:
                return None
            
            updates = {
                "stars_balance": user.stars_balance + stars_amount,
                "total_stars_earned": user.total_stars_earned + stars_amount
            }
            
            updated_user = await self.update_user(user_id, updates)
            return updated_user
            
        except Exception as e:
            return None

    async def process_referral_bonus(self, referrer_user_id: str, bonus_amount: int):
        """Начислить реферальный бонус за покупку друга"""
        try:
            referrer = await self.get_user(referrer_user_id)
            if not referrer:
                return
            
            # Начисляем бонус
            updates = {
                "stars_balance": referrer.stars_balance + bonus_amount,
                "total_referral_earnings": referrer.total_referral_earnings + bonus_amount,
                "total_stars_earned": referrer.total_stars_earned + bonus_amount
            }
            
            await self.update_user(referrer_user_id, updates)
            from decimal import Decimal; 
            # Создаем транзакцию для истории
            from schemas import TransactionCreate
            transaction_data = TransactionCreate(
                user_id=referrer_user_id,
                type="referral_bonus",
                currency="stars",
                amount=Decimal(str(bonus_amount)),
                status="completed",
                description=f"Реферальный бонус: {bonus_amount} звезд с покупки друга"
            )
            await self.create_transaction(transaction_data)
            
            
        except Exception as e:
            None
    async def process_referral_registration(self, referrer_user_id: str, new_user_id: str):
        """Обработать регистрацию нового пользователя по реферальной ссылке"""
        try:
            # Получаем бонус за приглашение из настроек
            registration_bonus = await self.get_cached_setting("referral_registration_bonus")
            if not registration_bonus:
                registration_bonus = "25"  # Значение по умолчанию
            
            bonus_amount = int(registration_bonus)
            
            # Начисляем бонус за приглашение
            await self.process_referral_bonus(referrer_user_id, bonus_amount)
            
            
        except Exception as e:
            pass

    async def get_completed_user_tasks(self, user_id: str) -> List[UserTask]:
        """Получить все выполненные задания пользователя"""
        result = await self.db.execute(
            select(UserTask)
            .where(
                and_(
                    UserTask.user_id == user_id,
                    UserTask.completed == True
                )
            )
            .order_by(UserTask.completed_at.desc())
        )
        return result.scalars().all()

    # Setting methods
    async def get_setting(self, key: str) -> Optional[Setting]:
        result = await self.db.execute(select(Setting).where(Setting.key == key))
        return result.scalar_one_or_none()

    async def get_all_settings(self) -> List[Setting]:
        result = await self.db.execute(select(Setting))
        return result.scalars().all()

    async def set_setting(self, setting_data: SettingCreate) -> Setting:
        setting = Setting(**setting_data.dict())
        self.db.add(setting)
        await self.db.commit()
        await self.db.refresh(setting)
        return setting

    async def update_setting(self, key: str, value: str) -> Optional[Setting]:
        await self.db.execute(
            update(Setting)
            .where(Setting.key == key)
            .values(value=value, updated_at=datetime.utcnow())
        )
        await self.db.commit()
        return await self.get_setting(key)
    
    async def get_all_tasks_with_stats(self):
        """Получить все задания со статистикой"""
        result = await self.db.execute(
            select(Task).order_by(Task.created_at.desc())
        )
        tasks = result.scalars().all()
        
        # Добавляем статистику выполнений
        for task in tasks:
            completed_count = await self.db.execute(
                select(func.count(UserTask.id)).where(
                    UserTask.task_id == task.id,
                    UserTask.completed == True
                )
            )
            task.completed_count = completed_count.scalar() or 0
            
        return tasks
    
    async def create_task(self, task_data: dict):
        """Создать новое задание"""
        task = Task(**task_data)
        self.db.add(task)
        await self.db.commit()
        await self.db.refresh(task)
        return task
    
    async def update_task(self, task_id: str, updates: dict):
        """Обновить задание"""
        await self.db.execute(
            update(Task).where(Task.id == task_id).values(**updates)
        )
        await self.db.commit()
        return await self.get_task(task_id)

    async def increment_task_completion_count(self, task_id: str):
        """Увеличить счетчик выполнений задания"""
        await self.db.execute(
            update(Task)
            .where(Task.id == task_id)
            .values(completed_count=Task.completed_count + 1)
        )
        await self.db.commit()

    async def get_cached_setting(self, key: str) -> str:
        if key in self._settings_cache:
            import logging
            logging.info(f"Cache hit for key: {key} with value: {self._settings_cache[key]}")
            return self._settings_cache[key]
            
        setting = await self.get_setting(key)
        value = setting.value if setting else ""
        import logging
        logging.info(f"Cache miss for key: {key}, loading value: {value}")
        self._settings_cache[key] = value
        return value
    
    async def update_setting(self, key: str, value: str):
        import logging
        logging.info(f"Updating setting key: {key} with value: {value}")
        # Найти или создать setting
        result = await self.db.execute(
            select(Setting).where(Setting.key == key)
        )
        setting = result.scalar_one_or_none()
        
        if setting:
            setting.value = value
            setting.updated_at = datetime.utcnow()
        else:
            setting = Setting(key=key, value=value)
            self.db.add(setting)
        
        await self.db.commit()
        
        # Инвалидировать кэш
        if key in self._settings_cache:
            logging.info(f"Invalidating cache for key: {key}")
            del self._settings_cache[key]
