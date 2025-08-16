from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, and_
from sqlalchemy.orm import selectinload
from models import User, Transaction, Task, UserTask, Setting
from schemas import UserCreate, TransactionCreate, UserTaskCreate, SettingCreate
from typing import Optional, List
from datetime import datetime
import random
import string

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
        result = await self.db.execute(
            select(User).where(User.username == username)
        )
        return result.scalar_one_or_none()
    
    async def create_user(self, user_data: UserCreate) -> User:
        # Generate referral code
        referral_code = ''.join(random.choices(string.ascii_letters + string.digits, k=8))
        
        user = User(
            telegram_id=user_data.telegram_id,
            username=user_data.username,
            first_name=user_data.first_name,
            last_name=user_data.last_name,
            referral_code=referral_code,
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
        result = await self.db.execute(select(Task))
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