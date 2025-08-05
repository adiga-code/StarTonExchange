import hashlib
import hmac
import urllib.parse
from typing import Dict, Optional
from decimal import Decimal
import httpx
import os

class RobokassaPayment:
    def __init__(self):
        self.merchant_login = os.getenv('ROBOKASSA_MERCHANT_LOGIN')
        self.password1 = os.getenv('ROBOKASSA_PASSWORD1')  # Для создания платежей
        self.password2 = os.getenv('ROBOKASSA_PASSWORD2')  # Для проверки результата
        self.test_mode = os.getenv('ROBOKASSA_TEST_MODE', 'true').lower() == 'true'
        
        if not all([self.merchant_login, self.password1, self.password2]):
            raise ValueError("Robokassa credentials not configured")
        
        # URLs
        if self.test_mode:
            self.payment_url = "https://auth.robokassa.ru/Merchant/Index.aspx"
            self.api_url = "https://auth.robokassa.ru/Merchant/WebService/Service.asmx"
        else:
            self.payment_url = "https://merchant.roboxchange.com/Index.aspx"
            self.api_url = "https://merchant.roboxchange.com/WebService/Service.asmx"

    def generate_signature(self, values: list, password: str) -> str:
        """Generate MD5 signature for Robokassa"""
        signature_string = ':'.join(str(v) for v in values)
        return hashlib.md5(f"{signature_string}:{password}".encode('utf-8')).hexdigest().lower()

    def create_payment_url(
        self, 
        invoice_id: str, 
        amount: Decimal, 
        description: str,
        user_email: Optional[str] = None,
        currency: str = "RUB"
    ) -> str:
        """Create payment URL for Robokassa"""
        
        # Required parameters
        params = {
            'MerchantLogin': self.merchant_login,
            'OutSum': str(amount),
            'InvId': invoice_id,
            'Description': description,
            'Culture': 'ru'
        }
        
        # Optional parameters
        if user_email:
            params['Email'] = user_email
            
        if self.test_mode:
            params['IsTest'] = '1'
        
        # Generate signature
        signature_values = [
            self.merchant_login,
            amount,
            invoice_id,
            self.password1
        ]
        
        params['SignatureValue'] = self.generate_signature(signature_values, "")
        
        # Build URL
        query_string = urllib.parse.urlencode(params)
        return f"{self.payment_url}?{query_string}"

    def verify_payment_result(self, data: Dict) -> bool:
        """Verify payment result from Robokassa webhook"""
        try:
            out_sum = data.get('OutSum')
            inv_id = data.get('InvId')
            signature = data.get('SignatureValue', '').lower()
            
            # Generate expected signature
            signature_values = [out_sum, inv_id, self.password2]
            expected_signature = self.generate_signature(signature_values, "")
            
            return hmac.compare_digest(signature, expected_signature)
            
        except Exception as e:
            print(f"Error verifying payment: {e}")
            return False

    async def check_payment_status(self, invoice_id: str) -> Optional[Dict]:
        """Check payment status via Robokassa API"""
        try:
            signature_values = [self.merchant_login, invoice_id, self.password2]
            signature = self.generate_signature(signature_values, "")
            
            params = {
                'MerchantLogin': self.merchant_login,
                'InvoiceID': invoice_id,
                'Signature': signature
            }
            
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{self.api_url}/OpStateExt",
                    data=params,
                    timeout=30
                )
                
                if response.status_code == 200:
                    # Parse XML response (simplified)
                    content = response.text
                    if 'State>5<' in content:  # Status 5 = paid
                        return {'status': 'paid', 'response': content}
                    elif 'State>10<' in content:  # Status 10 = cancelled  
                        return {'status': 'cancelled', 'response': content}
                    else:
                        return {'status': 'pending', 'response': content}
                        
            return None
            
        except Exception as e:
            print(f"Error checking payment status: {e}")
            return None

    def get_available_payment_methods(self) -> list:
        """Get available payment methods"""
        return [
            {'code': 'BankCard', 'name': 'Банковская карта'},
            {'code': 'QIWI', 'name': 'QIWI Кошелек'},
            {'code': 'WebMoney', 'name': 'WebMoney'},
            {'code': 'YandexMoney', 'name': 'ЮMoney'},
            {'code': 'Tinkoff', 'name': 'Тинькофф'},
            {'code': 'SberBank', 'name': 'Сбербанк Онлайн'},
        ]

# Global instance
robokassa = None

def get_robokassa():
    """Get Robokassa instance"""
    global robokassa
    if robokassa is None:
        try:
            robokassa = RobokassaPayment()
        except ValueError as e:
            print(f"Warning: Robokassa not configured: {e}")
            robokassa = None
    return robokassa