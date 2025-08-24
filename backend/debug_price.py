#!/usr/bin/env python3
"""
Debug script для исправления настроек TON и проверки курса
Запускается перед main.py для инициализации базы данных
"""

import asyncio
import sys
import os
import logging

# Добавляем путь к модулям
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from database import AsyncSessionLocal, init_db, init_default_data
from models import Setting
from storage import Storage
from ton_price_service import ton_price_service
from sqlalchemy import select

# Настройка логирования
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

async def fix_ton_settings():
    """Исправить или добавить настройки TON"""
    
    # Настройки TON которые должны быть в базе
    ton_settings = {
        "ton_markup_percentage": "5.0",
        "ton_price_cache_minutes": "15", 
        "ton_fallback_price": "420.0",
        "referral_registration_bonus": "25.0"
    }
    
    async with AsyncSessionLocal() as session:
        logger.info("🔍 Проверяем настройки TON в базе данных...")
        
        fixed_count = 0
        for key, default_value in ton_settings.items():
            # Проверяем, существует ли настройка
            result = await session.execute(
                select(Setting).where(Setting.key == key)
            )
            existing_setting = result.scalar_one_or_none()
            
            if existing_setting:
                if not existing_setting.value or existing_setting.value.strip() == "":
                    # Обновляем пустое значение
                    existing_setting.value = default_value
                    fixed_count += 1
                    logger.info(f"✅ Исправлено пустое значение {key}: {default_value}")
                else:
                    logger.info(f"ℹ️  {key} уже существует: {existing_setting.value}")
            else:
                # Создаем новую настройку
                new_setting = Setting(key=key, value=default_value)
                session.add(new_setting)
                fixed_count += 1
                logger.info(f"✅ Добавлена настройка {key}: {default_value}")
        
        if fixed_count > 0:
            # Сохраняем изменения
            await session.commit()
            logger.info(f"💾 Сохранено {fixed_count} изменений в базе данных")
        else:
            logger.info("ℹ️  Все настройки TON уже корректны")
        
        return fixed_count

async def test_ton_price():
    """Тестируем получение курса TON"""
    try:
        async with AsyncSessionLocal() as session:
            storage = Storage(session)
            
            logger.info("🧪 Тестируем получение курса TON...")
            
            # Получаем текущий курс
            price = await ton_price_service.get_current_ton_price_rub(storage)
            logger.info(f"💰 Текущий курс TON: {price:.2f} RUB")
            
            # Проверяем настройки
            markup = await storage.get_cached_setting("ton_markup_percentage")
            cache_minutes = await storage.get_cached_setting("ton_price_cache_minutes")
            fallback = await storage.get_cached_setting("ton_fallback_price")
            
            logger.info(f"⚙️  Настройки TON:")
            logger.info(f"   - Наценка: {markup}%")
            logger.info(f"   - Кэш: {cache_minutes} минут")
            logger.info(f"   - Резервная цена: {fallback} RUB")
            
            return price > 0
            
    except Exception as e:
        logger.error(f"❌ Ошибка тестирования курса TON: {e}")
        return False

async def main():
    """Основная функция debug скрипта"""
    logger.info("🚀 Запуск debug_price.py...")
    
    try:
        # 1. Инициализируем базу данных
        logger.info("📊 Инициализация базы данных...")
        await init_db()
        await init_default_data()
        
        # 2. Исправляем настройки TON
        fixed_count = await fix_ton_settings()
        
        # 3. Тестируем курс TON
        ton_working = await test_ton_price()
        
        # 4. Итоговый отчет
        logger.info("📋 Итоговый отчет:")
        logger.info(f"   ✅ База данных: инициализирована")
        logger.info(f"   ✅ Настройки TON: исправлено {fixed_count} настроек")
        logger.info(f"   {'✅' if ton_working else '❌'} Курс TON: {'работает' if ton_working else 'не работает'}")
        
        if fixed_count > 0:
            logger.info("🔄 Рекомендуется перезапустить приложение для применения изменений")
        
        logger.info("✅ Debug скрипт завершен успешно!")
        return 0
        
    except Exception as e:
        logger.error(f"❌ Критическая ошибка: {e}")
        import traceback
        logger.error(traceback.format_exc())
        return 1

if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)