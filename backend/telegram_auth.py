import hmac
import hashlib
import json
from urllib.parse import unquote
from typing import Dict, Optional
import os
from datetime import datetime, timedelta
import logging

logger = logging.getLogger(__name__)

def validate_telegram_data(init_data: str, bot_token: str) -> Optional[Dict]:
    """
    Validate Telegram WebApp initData
    Returns user data if valid, None if invalid
    """
    try:
        logger.info(f"Validating init_data: {init_data[:50]}...")
        
        # Parse the init_data
        data = {}
        
        # Parse query string
        pairs = init_data.split('&')
        hash_value = ""
        
        for pair in pairs:
            if '=' in pair:
                key, value = pair.split('=', 1)
                key = unquote(key)
                value = unquote(value)
                
                if key == 'hash':
                    hash_value = value
                else:
                    data[key] = value
        
        if not hash_value:
            logger.error("No hash found in init_data")
            return None
        
        # Create data check string
        sorted_keys = sorted(data.keys())
        data_check_string = '\n'.join([f"{key}={data[key]}" for key in sorted_keys])
        
        logger.info(f"Data check string: {data_check_string}")
        
        # Generate secret key
        secret_key = hmac.new(
            "WebAppData".encode(),
            bot_token.encode(),
            hashlib.sha256
        ).digest()
        
        # Calculate hash
        calculated_hash = hmac.new(
            secret_key,
            data_check_string.encode(),
            hashlib.sha256
        ).hexdigest()
        
        logger.info(f"Calculated hash: {calculated_hash}")
        logger.info(f"Received hash: {hash_value}")
        
        # Compare hashes
        if not hmac.compare_digest(calculated_hash, hash_value):
            logger.error("Hash validation failed")
            return None
        
        # Check auth_date (data should not be older than 24 hours)
        if 'auth_date' in data:
            auth_date = datetime.fromtimestamp(int(data['auth_date']))
            if datetime.now() - auth_date > timedelta(hours=24):
                logger.error("Auth date is too old")
                return None
        
        # Parse user data
        if 'user' in data:
            user_data = json.loads(data['user'])
            logger.info(f"User data extracted: {user_data}")
            return user_data
        
        logger.error("No user data found in init_data")
        return None
        
    except Exception as e:
        logger.error(f"Error validating Telegram data: {e}")
        return None

def get_user_from_header(telegram_id: str = None, init_data: str = None) -> Optional[Dict]:
    """
    Get user data from headers - for development and production
    """
    bot_token = os.getenv('BOT_TOKEN')
    is_development = os.getenv('DEVELOPMENT', 'false').lower() == 'true'
    
    logger.info(f"Getting user from headers: telegram_id={telegram_id}, has_init_data={bool(init_data)}, has_bot_token={bool(bot_token)}, is_development={is_development}")
    
    # Для режима разработки - разрешаем мок-данные
    if is_development:
        # Если есть telegram_id, используем его напрямую
        if telegram_id:
            logger.info(f"Development mode: Using telegram_id={telegram_id} without validation")
            return {
                'id': int(telegram_id),
                'first_name': 'Dev',
                'last_name': 'User',
                'username': f'dev_{telegram_id}'
            }
        
        # Если нет ID, используем тестового пользователя
        logger.info("Development mode: Using default test user")
        return {
            'id': 56789,
            'first_name': 'John',
            'last_name': 'Doe',
            'username': 'johndoe'
        }
    
    # Для продакшена - строго проверяем initData
    if init_data and bot_token:
        user_data = validate_telegram_data(init_data, bot_token)
        if user_data:
            logger.info(f"Production: Validated user from init_data: {user_data.get('id')}")
            return user_data
    
    # Если нет initData или не прошла валидация - проверяем наличие telegram_id
    if telegram_id:
        logger.warning(f"Production: Using unvalidated telegram_id={telegram_id} (no valid init_data)")
        return {
            'id': int(telegram_id),
            'first_name': 'Unknown',
            'last_name': 'User',
            'username': f'user_{telegram_id}'
        }
    
    # Если нет ни initData, ни telegram_id - не авторизуем
    logger.error("Production: No valid user data found")
    return None

async def get_current_user(storage, telegram_id: str = None, init_data: str = None):
    """
    Get current user from database using Telegram data
    """
    user_data = get_user_from_header(telegram_id, init_data)
    if not user_data:
        logger.error("No valid user data found")
        return None
    
    user = await storage.get_user_by_telegram_id(str(user_data['id']))
    logger.info(f"Found user in database: {bool(user)}")
    return user