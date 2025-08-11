import hmac
import hashlib
import json
from urllib.parse import unquote
from typing import Dict, Optional
import os
from datetime import datetime, timedelta

def validate_telegram_data(init_data: str, bot_token: str) -> Optional[Dict]:
    """
    Validate Telegram WebApp initData
    Returns user data if valid, None if invalid
    """
    try:
        # Parse the init_data
        data_check_string = ""
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
        
        # Create data check string
        sorted_keys = sorted(data.keys())
        data_check_string = '\n'.join([f"{key}={data[key]}" for key in sorted_keys])
        
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
        
        # Compare hashes
        if not hmac.compare_digest(calculated_hash, hash_value):
            return None
        
        # Check auth_date (data should not be older than 24 hours)
        if 'auth_date' in data:
            auth_date = datetime.fromtimestamp(int(data['auth_date']))
            if datetime.now() - auth_date > timedelta(hours=24):
                return None
        
        # Parse user data
        if 'user' in data:
            user_data = json.loads(data['user'])
            return user_data
        
        return None
        
    except Exception as e:
        print(f"Error validating Telegram data: {e}")
        return None

def get_user_from_header(telegram_id: str = None, init_data: str = None) -> Optional[Dict]:
    """
    Get user data from headers - for development and production
    """
    bot_token = os.getenv('BOT_TOKEN')
    
    # Development mode - use simple telegram_id
    if not bot_token or not init_data:
        if telegram_id:
            return {
                'id': int(telegram_id),
                'first_name': 'Dev',
                'last_name': 'User',
                'username': 'devuser'
            }
        return None
    
    # Production mode - validate init_data
    return validate_telegram_data(init_data, bot_token)

async def get_current_user(storage, telegram_id: str = None, init_data: str = None):
    """
    Get current user from database using Telegram data
    """
    user_data = get_user_from_header(telegram_id, init_data)
    if not user_data:
        return None
    
    user = await storage.get_user_by_telegram_id(str(user_data['id']))
    return user