import hashlib
import hmac
import urllib.parse
import time
import json
from typing import Dict, Optional, List
from decimal import Decimal
import httpx
import os
import logging

logger = logging.getLogger(__name__)

class FreekassaPayment:
    def __init__(self):
        self.shop_id = os.getenv('FREEKASSA_SHOP_ID', '65315')
        self.secret_word1 = os.getenv('FREEKASSA_SECRET_WORD1', ')_-@SU=A702VVQZ')  # Для создания платежей
        self.secret_word2 = os.getenv('FREEKASSA_SECRET_WORD2', 'g!J1s76+BUgmrp(')  # Для проверки webhook'ов
        self.api_key = os.getenv('FREEKASSA_API_KEY', '49ef5bbcaf1f12224129336e2c4f863b')  # Для API запросов
        self.test_mode = os.getenv('FREEKASSA_TEST_MODE', 'true').lower() == 'true'
        
        if not all([self.shop_id, self.secret_word1, self.secret_word2]):
            raise ValueError("FreeKassa credentials not configured")
        
        # URLs
        self.payment_url = "https://pay.fk.money/"
        self.api_url = "https://api.fk.life/v1/"
        
        # Allowed FreeKassa IPs for security
        self.allowed_ips = ['168.119.157.136', '168.119.60.227', '178.154.197.79', '51.250.54.238']

    def generate_sci_signature(self, shop_id: str, amount: str, secret: str, currency: str, order_id: str) -> str:
        """Generate MD5 signature for SCI payment form"""
        signature_string = f"{shop_id}:{amount}:{secret}:{currency}:{order_id}"
        return hashlib.md5(signature_string.encode('utf-8')).hexdigest()

    def generate_webhook_signature(self, merchant_id: str, amount: str, secret: str, order_id: str) -> str:
        """Generate MD5 signature for webhook verification"""
        signature_string = f"{merchant_id}:{amount}:{secret}:{order_id}"
        return hashlib.md5(signature_string.encode('utf-8')).hexdigest()

    def generate_api_signature(self, data: Dict) -> str:
        """Generate HMAC-SHA256 signature for API requests"""
        if not self.api_key:
            raise ValueError("API key not configured")
            
        # Sort data by keys and create string
        sorted_data = sorted(data.items())
        signature_string = "|".join(str(value) for key, value in sorted_data)
        
        return hmac.new(
            self.api_key.encode(),
            signature_string.encode(),
            hashlib.sha256
        ).hexdigest()

    def create_payment_url(
        self, 
        order_id: str, 
        amount: Decimal, 
        description: str,
        user_email: Optional[str] = None,
        currency: str = "RUB",
        payment_method_id: Optional[int] = None
    ) -> str:
        """Create payment URL using SCI method"""
        try:
            # Convert amount to string
            amount_str = str(amount)
            
            # Generate signature
            signature = self.generate_sci_signature(
                self.shop_id,
                amount_str,
                self.secret_word1,
                currency,
                order_id
            )
            
            # Required parameters
            params = {
                'm': self.shop_id,           # merchant ID
                'oa': amount_str,            # order amount
                'o': order_id,               # order ID
                's': signature,              # signature
                'currency': currency,        # currency
                #'i': '1',                   # interface language (1 = auto)
                'lang': 'ru'                # language
            }
            
            # Optional parameters
            if user_email:
                params['email'] = user_email
                
            if payment_method_id:
                params['method'] = str(payment_method_id)
                
            if description:
                params['desc'] = description[:255]  # Limit description length
                
            # Build URL
            query_string = urllib.parse.urlencode(params, quote_via=urllib.parse.quote)
            payment_url = f"{self.payment_url}?{query_string}"
            
            logger.info(f"Created FreeKassa payment URL for order {order_id}: {amount} {currency}")
            return payment_url
            
        except Exception as e:
            logger.error(f"Error creating FreeKassa payment URL: {e}")
            raise

    async def create_api_payment(
        self,
        order_id: str,
        amount: Decimal,
        user_email: Optional[str],
        user_ip: str,
        payment_method_id: int = 4,  # Default to VISA RUB
        currency: str = "RUB",
        description: Optional[str] = None,
        phone: Optional[str] = None
    ) -> Dict:
        """Create payment using API method"""
        try:
            if not self.api_key:
                raise ValueError("API key not configured for API payments")
                
            # Prepare request data
            data = {
                'shopId': int(self.shop_id),
                'nonce': int(time.time()),
                'paymentId': order_id,
                'i': payment_method_id,
                'email': user_email,
                'ip': user_ip,
                'amount': float(amount),
                'currency': currency
            }
            
            # Add optional parameters
            if phone:
                data['tel'] = phone
                
            # Generate signature
            data['signature'] = self.generate_api_signature(data)
            
            # Make API request
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{self.api_url}orders/create",
                    json=data,
                    timeout=30,
                    headers={'Content-Type': 'application/json'}
                )
                
                if response.status_code == 200:
                    result = response.json()
                    logger.info(f"Created FreeKassa API payment for order {order_id}: {result}")
                    return result
                else:
                    logger.error(f"FreeKassa API error: {response.status_code} - {response.text}")
                    raise Exception(f"API request failed: {response.status_code}")
                    
        except Exception as e:
            logger.error(f"Error creating FreeKassa API payment: {e}")
            raise

    def verify_payment_result(self, data: Dict, client_ip: Optional[str] = None) -> bool:
        """Verify payment result from FreeKassa webhook"""
        try:
            # Security: Check IP (optional but recommended)
            if client_ip and client_ip not in self.allowed_ips:
                logger.warning(f"Webhook from unauthorized IP: {client_ip}")
                # Uncomment next line for strict IP checking
                # return False
            
            # Get required fields
            merchant_id = data.get('MERCHANT_ID')
            amount = data.get('AMOUNT')
            order_id = data.get('MERCHANT_ORDER_ID')
            signature = data.get('SIGN', '').lower()
            
            if not all([merchant_id, amount, order_id, signature]):
                logger.error("Missing required webhook fields")
                return False
                
            # Verify merchant ID
            if str(merchant_id) != str(self.shop_id):
                logger.error(f"Merchant ID mismatch: expected {self.shop_id}, got {merchant_id}")
                return False
            
            # Generate expected signature
            expected_signature = self.generate_webhook_signature(
                str(merchant_id),
                str(amount),
                self.secret_word2,
                str(order_id)
            )
            
            # Compare signatures
            is_valid = hmac.compare_digest(signature, expected_signature)
            
            if not is_valid:
                logger.error(f"Invalid FreeKassa signature. Expected: {expected_signature}, Got: {signature}")
                
            return is_valid
            
        except Exception as e:
            logger.error(f"Error verifying FreeKassa payment: {e}")
            return False

    async def check_payment_status(self, order_id: str) -> Optional[Dict]:
        """Check payment status via FreeKassa API"""
        try:
            if not self.api_key:
                logger.warning("API key not configured, cannot check payment status")
                return None
                
            data = {
                'shopId': int(self.shop_id),
                'nonce': int(time.time()),
                'paymentId': order_id
            }
            
            data['signature'] = self.generate_api_signature(data)
            
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{self.api_url}orders",
                    json=data,
                    timeout=30,
                    headers={'Content-Type': 'application/json'}
                )
                
                if response.status_code == 200:
                    result = response.json()
                    logger.info(f"FreeKassa payment status for {order_id}: {result}")
                    
                    # Parse status
                    if result.get('type') == 'success' and result.get('orders'):
                        order_data = result['orders'][0]
                        status = order_data.get('status', 0)
                        
                        if status == 1:
                            return {'status': 'paid', 'response': result}
                        elif status in [2, 8, 9]:  # cancelled, error, expired
                            return {'status': 'cancelled', 'response': result}
                        else:
                            return {'status': 'pending', 'response': result}
                    
                return None
                
        except Exception as e:
            logger.error(f"Error checking FreeKassa payment status: {e}")
            return None

    async def get_balance(self) -> Optional[List[Dict]]:
        """Get account balance via API"""
        try:
            if not self.api_key:
                raise ValueError("API key not configured")
                
            data = {
                'shopId': int(self.shop_id),
                'nonce': int(time.time())
            }
            
            data['signature'] = self.generate_api_signature(data)
            
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{self.api_url}balance",
                    json=data,
                    timeout=30,
                    headers={'Content-Type': 'application/json'}
                )
                
                if response.status_code == 200:
                    result = response.json()
                    if result.get('type') == 'success':
                        return result.get('balance', [])
                        
                return None
                
        except Exception as e:
            logger.error(f"Error getting FreeKassa balance: {e}")
            return None

    def get_available_payment_methods(self) -> List[Dict]:
        """Get available payment methods (from documentation)"""
        return [
            {'id': 4, 'name': 'VISA RUB', 'currency': 'RUB'},
            {'id': 8, 'name': 'MasterCard RUB', 'currency': 'RUB'},
            {'id': 12, 'name': 'МИР', 'currency': 'RUB'},
            {'id': 13, 'name': 'Онлайн банк', 'currency': 'RUB'},
            {'id': 42, 'name': 'СБП', 'currency': 'RUB'},
            {'id': 44, 'name': 'СБП (API)', 'currency': 'RUB'},
            {'id': 6, 'name': 'Yoomoney', 'currency': 'RUB'},
            {'id': 10, 'name': 'Qiwi', 'currency': 'RUB'},
            {'id': 35, 'name': 'QIWI API', 'currency': 'RUB'},
            {'id': 24, 'name': 'Bitcoin', 'currency': 'BTC'},
            {'id': 26, 'name': 'Ethereum', 'currency': 'ETH'},
            {'id': 14, 'name': 'USDT (ERC20)', 'currency': 'USDT'},
            {'id': 15, 'name': 'USDT (TRC20)', 'currency': 'USDT'},
        ]

# Global instance
freekassa = None

def get_freekassa():
    """Get FreeKassa instance"""
    global freekassa
    if freekassa is None:
        try:
            freekassa = FreekassaPayment()
        except ValueError as e:
            logger.error(f"Failed to initialize FreeKassa: {e}")
            return None
    return freekassa