from typing import List, Optional, Dict, Any
from datetime import datetime
from sqlalchemy import select, update, delete, and_
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from models import User, Transaction, Task, UserTask, Setting
from schemas import UserCreate, TransactionCreate, UserTaskCreate


class Storage:
    def __init__(self, db: AsyncSession):
        self.db = db

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
        """Получить пользователя по username"""
        result = await self.db.execute(
            select(User).where(User.username == username)
        )
        return result.scalar_one_or_none()

    async def create_user(self, user_data: UserCreate) -> User:
        user = User(**user_data.dict())
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

    async def add_user_stars(self, user_id: str, amount: int) -> Optional[User]:
        """Добавить звезды пользователю"""
        user = await self.get_user(user_id)
        if not user:
            return None
        
        new_balance = user.stars_balance + amount
        new_total = user.total_stars_earned + amount
        
        await self.db.execute(
            update(User)
            .where(User.id == user_id)
            .values(
                stars_balance=new_balance,
                total_stars_earned=new_total
            )
        )
        await self.db.commit()
        return await self.get_user(user_id)

    async def get_all_users(self) -> List[User]:
        result = await self.db.execute(select(User))
        return result.scalars().all()

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
        result = await self.db.execute(select(Task).where(Task.id == task_id))
        return result.scalar_one_or_none()

    async def get_all_tasks(self) -> List[Task]:
        result = await self.db.execute(select(Task).order_by(Task.created_at.desc()))
        return result.scalars().all()

    async def get_active_tasks(self) -> List[Task]:
        result = await self.db.execute(select(Task).where(Task.is_active == True))
        return result.scalars().all()

    async def create_task(self, task_data: dict) -> Task:
        task = Task(**task_data)
        self.db.add(task)
        await self.db.commit()
        await self.db.refresh(task)
        return task

    async def update_task(self, task_id: str, updates: dict) -> Optional[Task]:
        await self.db.execute(
            update(Task).where(Task.id == task_id).values(**updates)
        )
        await self.db.commit()
        return await self.get_task(task_id)

    async def delete_task(self, task_id: str) -> bool:
        """Удалить задание и все связанные записи"""
        try:
            # Сначала удаляем все связанные user_tasks
            await self.db.execute(
                delete(UserTask).where(UserTask.task_id == task_id)
            )
            
            # Затем удаляем само задание
            result = await self.db.execute(
                delete(Task).where(Task.id == task_id)
            )
            
            await self.db.commit()
            return result.rowcount > 0
        except Exception as e:
            await self.db.rollback()
            raise e

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

    async def get_user_tasks_with_task_info(self, user_id: str) -> List[Dict[str, Any]]:
        """Получить задания пользователя с информацией о самих заданиях"""
        result = await self.db.execute(
            select(UserTask, Task)
            .join(Task, UserTask.task_id == Task.id)
            .where(UserTask.user_id == user_id)
        )
        
        tasks_with_completion = []
        for user_task, task in result.all():
            tasks_with_completion.append({
                "id": task.id,
                "title": task.title,
                "description": task.description,
                "reward": task.reward,
                "type": task.type,
                "action": task.action,
                "completed": user_task.completed,
                "completed_at": user_task.completed_at.isoformat() if user_task.completed_at else None,
            })
        
        return tasks_with_completion

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
        """Отметить задание как выполненное"""
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
        
        # Обновляем счетчик выполненных заданий у пользователя
        await self.db.execute(
            update(User)
            .where(User.id == user_id)
            .values(tasks_completed=User.tasks_completed + 1)
        )
        
        await self.db.commit()
        return await self.get_user_task(user_id, task_id)

    # Setting methods
    async def get_setting(self, key: str) -> Optional[Setting]:
        result = await self.db.execute(select(Setting).where(Setting.key == key))
        return result.scalar_one_or_none()

    async def get_all_settings(self) -> List[Setting]:
        result = await self.db.execute(select(Setting))
        return result.scalars().all()

    async def create_setting(self, key: str, value: str) -> Setting:
        setting = Setting(key=key, value=value)
        self.db.add(setting)
        await self.db.commit()
        await self.db.refresh(setting)
        return setting

    async def update_setting(self, key: str, value: str) -> Setting:
        """Обновить или создать настройку"""
        existing_setting = await self.get_setting(key)
        
        if existing_setting:
            await self.db.execute(
                update(Setting)
                .where(Setting.key == key)
                .values(value=value, updated_at=datetime.utcnow())
            )
            await self.db.commit()
            return await self.get_setting(key)
        else:
            return await self.create_setting(key, value)

    async def delete_setting(self, key: str) -> bool:
        result = await self.db.execute(delete(Setting).where(Setting.key == key))
        await self.db.commit()
        return result.rowcount > 0

    # Referral methods
    async def get_user_referrals(self, user_id: str) -> List[User]:
        """Получить всех рефералов пользователя"""
        user = await self.get_user(user_id)
        if not user or not user.referral_code:
            return []
        
        result = await self.db.execute(
            select(User).where(User.referred_by == user.referral_code)
        )
        return result.scalars().all()

    async def get_referral_earnings(self, user_id: str) -> int:
        """Получить общий заработок с рефералов"""
        user = await self.get_user(user_id)
        if not user:
            return 0
        return user.total_referral_earnings

    async def add_referral_earnings(self, user_id: str, amount: int) -> Optional[User]:
        """Добавить заработок с рефералов"""
        await self.db.execute(
            update(User)
            .where(User.id == user_id)
            .values(total_referral_earnings=User.total_referral_earnings + amount)
        )
        await self.db.commit()
        return await self.get_user(user_id)

    # Analytics methods
    async def get_users_count(self) -> int:
        """Получить общее количество пользователей"""
        result = await self.db.execute(select(User).count())
        return result.scalar()

    async def get_completed_transactions_today(self) -> List[Transaction]:
        """Получить завершенные транзакции за сегодня"""
        today = datetime.utcnow().date()
        result = await self.db.execute(
            select(Transaction)
            .where(
                and_(
                    Transaction.status == "completed",
                    Transaction.created_at >= today
                )
            )
        )
        return result.scalars().all()

    async def get_active_referrals_count(self) -> int:
        """Получить количество пользователей с рефералом"""
        result = await self.db.execute(
            select(User)
            .where(User.referred_by.isnot(None))
        )
        return len(result.scalars().all())

    # Daily task automation
    async def get_daily_login_task(self) -> Optional[Task]:
        """Получить задание ежедневного входа"""
        result = await self.db.execute(
            select(Task).where(
                and_(
                    Task.action == "daily_login",
                    Task.is_active == True
                )
            )
        )
        return result.scalar_one_or_none()

    async def check_daily_task_completion(self, user_id: str, task_id: str) -> bool:
        """Проверить, выполнял ли пользователь задание сегодня"""
        today = datetime.utcnow().date()
        result = await self.db.execute(
            select(UserTask).where(
                and_(
                    UserTask.user_id == user_id,
                    UserTask.task_id == task_id,
                    UserTask.completed == True,
                    UserTask.completed_at >= today
                )
            )
        )
        return result.scalar_one_or_none() is not None

    async def ensure_user_task_exists(self, user_id: str, task_id: str) -> UserTask:
        """Убедиться, что запись UserTask существует"""
        user_task = await self.get_user_task(user_id, task_id)
        if not user_task:
            user_task_data = UserTaskCreate(user_id=user_id, task_id=task_id)
            user_task = await self.create_user_task(user_task_data)
        return user_task

    # Batch operations
    async def create_user_tasks_for_new_task(self, task_id: str) -> int:
        """Создать записи UserTask для всех пользователей при создании нового задания"""
        users = await self.get_all_users()
        count = 0
        
        for user in users:
            existing = await self.get_user_task(user.id, task_id)
            if not existing:
                user_task_data = UserTaskCreate(user_id=user.id, task_id=task_id)
                await self.create_user_task(user_task_data)
                count += 1
        
        return count

    async def process_referral_bonus(self, referrer_code: str, bonus_amount: int) -> bool:
        """Обработать бонус реферера"""
        try:
            result = await self.db.execute(
                select(User).where(User.referral_code == referrer_code)
            )
            referrer = result.scalar_one_or_none()
            
            if referrer:
                await self.add_user_stars(referrer.id, bonus_amount)
                await self.add_referral_earnings(referrer.id, bonus_amount)
                
                # Создать транзакцию бонуса
                bonus_transaction = TransactionCreate(
                    user_id=referrer.id,
                    type="referral_bonus",
                    currency="stars",
                    amount=bonus_amount,
                    status="completed",
                    description=f"Бонус с реферала: {bonus_amount} звезд"
                )
                await self.create_transaction(bonus_transaction)
                return True
            
            return False
        except Exception as e:
            await self.db.rollback()
            raise e