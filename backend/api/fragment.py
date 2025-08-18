import aiohttp
import asyncio
import base64
import logging
from typing import Optional, Dict, Any
from dataclasses import dataclass

logger = logging.getLogger(__name__)

@dataclass
class BuyStarsRequest:
    username: str
    amount: int
    fragment_cookies: str
    seed: str
    show_sender: Optional[bool] = False

@dataclass
class BuyStarsWithoutKYCRequest:
    username: str
    amount: int
    seed: str

@dataclass
class BuyPremiumRequest:
    username: str
    fragment_cookies: str
    seed: str
    duration: int = 3
    show_sender: Optional[bool] = False

@dataclass
class BuyPremiumWithoutKYCRequest:
    username: str
    seed: str
    duration: int = 3

@dataclass
class GetOrdersRequest:
    seed: str
    limit: int = 10
    offset: int = 0

class FragmentAPIError(Exception):
    """Raised when the Fragment API returns an error response."""

    def __init__(self, message):
        self.message = str(message)
        super().__init__(self.message)

    def __str__(self):
        return self.message

class AsyncFragmentAPIClient:
    def __init__(self, seed: str = None, fragment_cookies: str = None, base_url="https://api.fragment-api.net"):
        self.base_url = base_url.rstrip("/")
        self.default_seed = seed
        self.default_fragment_cookies = fragment_cookies
        self._session = None

    async def __aenter__(self):
        """Async context manager entry"""
        timeout = aiohttp.ClientTimeout(total=30, connect=10)
        self._session = aiohttp.ClientSession(timeout=timeout)
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async context manager exit"""
        if self._session:
            await self._session.close()
            self._session = None

    def _get_session(self):
        """Get or create session for standalone usage"""
        if self._session is None:
            timeout = aiohttp.ClientTimeout(total=30, connect=10)
            self._session = aiohttp.ClientSession(timeout=timeout)
        return self._session

    async def close(self):
        """Manually close session"""
        if self._session:
            await self._session.close()
            self._session = None

    async def _get(self, path: str) -> Dict[str, Any]:
        session = self._get_session()
        url = f"{self.base_url}{path}"
        
        try:
            async with session.get(url) as response:
                text = await response.text()
                
                if not response.ok:
                    logger.error(f"GET {url} failed with status {response.status}: {text}")
                    raise FragmentAPIError(f"{response.status} | {text}")
                
                try:
                    return await response.json()
                except Exception as json_error:
                    logger.error(f"Failed to parse JSON response: {json_error}")
                    raise FragmentAPIError(f"Invalid JSON response: {text}")
                    
        except aiohttp.ClientError as e:
            logger.error(f"Network error for GET {url}: {e}")
            raise FragmentAPIError(f"Network error: {str(e)}")
        except asyncio.TimeoutError:
            logger.error(f"Timeout for GET {url}")
            raise FragmentAPIError("Request timeout")

    async def _post(self, path: str, data: Dict[str, Any]) -> Dict[str, Any]:
        session = self._get_session()
        url = f"{self.base_url}{path}"
        
        try:
            # Логируем отправляемые данные (без чувствительной информации)
            safe_data = {k: ("***" if "cookie" in k.lower() or "seed" in k.lower() else v) 
                        for k, v in data.items()}
            logger.debug(f"POST {url} with data: {safe_data}")
            
            async with session.post(url, json=data) as response:
                text = await response.text()
                
                if not response.ok:
                    logger.error(f"POST {url} failed with status {response.status}: {text}")
                    raise FragmentAPIError(f"{response.status} | {text}")
                
                try:
                    json_response = await response.json()
                    logger.debug(f"Response from {url}: {json_response}")
                    return json_response
                except Exception as json_error:
                    logger.error(f"Failed to parse JSON response: {json_error}")
                    raise FragmentAPIError(f"Invalid JSON response: {text}")
                    
        except aiohttp.ClientError as e:
            logger.error(f"Network error for POST {url}: {e}")
            raise FragmentAPIError(f"Network error: {str(e)}")
        except asyncio.TimeoutError:
            logger.error(f"Timeout for POST {url}")
            raise FragmentAPIError("Request timeout")
    
    def _base64_encode(self, data: str) -> str:
        """Безопасное кодирование в base64"""
        try:
            if not isinstance(data, str):
                data = str(data)
            return base64.b64encode(data.encode('utf-8')).decode('utf-8')
        except Exception as e:
            logger.error(f"Error encoding data to base64: {e}")
            raise FragmentAPIError(f"Failed to encode data: {str(e)}")

    def _get_seed(self, seed: str = None) -> str:
        """Получить и валидировать seed"""
        try:
            if seed is None:
                if self.default_seed is None:
                    raise FragmentAPIError("Seed not provided and no default seed set.")
                seed = self.default_seed
            
            if not isinstance(seed, str):
                raise FragmentAPIError("Seed must be a string.")
            
            seed = seed.strip()
            seed_words = seed.split()
            
            if len(seed_words) not in [12, 24]:
                raise FragmentAPIError("Seed must be 12 or 24 space-separated words.")
            
            return self._base64_encode(seed)
            
        except FragmentAPIError:
            raise
        except Exception as e:
            logger.error(f"Error processing seed: {e}")
            raise FragmentAPIError(f"Invalid seed format: {str(e)}")

    def _get_fragment_cookies(self, fragment_cookies: str = None) -> str:
        """Получить и валидировать fragment cookies"""
        try:
            if fragment_cookies is None:
                if self.default_fragment_cookies is None:
                    raise FragmentAPIError("Fragment cookies not provided and no default set.")
                fragment_cookies = self.default_fragment_cookies
            
            if not isinstance(fragment_cookies, str):
                raise FragmentAPIError("Fragment cookies must be a string.")
            
            fragment_cookies = fragment_cookies.strip()
            
            if "stel_ssid=" not in fragment_cookies:
                raise FragmentAPIError("Fragment cookies must contain stel_ssid parameter")
            
            return self._base64_encode(fragment_cookies)
            
        except FragmentAPIError:
            raise
        except Exception as e:
            logger.error(f"Error processing fragment cookies: {e}")
            raise FragmentAPIError(f"Invalid fragment cookies format: {str(e)}")

    async def ping(self) -> Dict[str, Any]:
        """Проверить доступность API"""
        try:
            return await self._get("/ping")
        except Exception as e:
            logger.error(f"Ping failed: {e}")
            raise

    async def get_balance(self, seed: str = None) -> Dict[str, Any]:
        """Получить баланс кошелька"""
        try:
            data = {"seed": self._get_seed(seed)}
            return await self._post("/getBalance", data)
        except Exception as e:
            logger.error(f"Get balance failed: {e}")
            raise

    async def get_user_info(self, username: str, fragment_cookies: str = None) -> Dict[str, Any]:
        """Получить информацию о пользователе"""
        try:
            if not username or not isinstance(username, str):
                raise FragmentAPIError("Username must be a non-empty string")
            
            username = username.strip()
            if not username:
                raise FragmentAPIError("Username cannot be empty")
            
            # Удаляем @ если есть
            if username.startswith('@'):
                username = username[1:]
            
            data = {
                "username": username,
                "fragment_cookies": self._get_fragment_cookies(fragment_cookies)
            }
            
            logger.info(f"Getting user info for username: {username}")
            result = await self._post("/getUserInfo", data)
            
            # Дополнительная валидация ответа
            if not isinstance(result, dict):
                logger.error(f"Invalid response type: {type(result)}")
                raise FragmentAPIError("Invalid response format from API")
            
            return result
            
        except FragmentAPIError:
            raise
        except Exception as e:
            logger.error(f"Get user info failed for {username}: {e}")
            raise FragmentAPIError(f"Failed to get user info: {str(e)}")

    async def buy_stars(self, username: str, amount: int, show_sender: bool = False, 
                       fragment_cookies: str = None, seed: str = None) -> Dict[str, Any]:
        """Купить звезды пользователю (с KYC)"""
        try:
            req_data = {
                "username": username,
                "amount": amount,
                "fragment_cookies": self._get_fragment_cookies(fragment_cookies),
                "seed": self._get_seed(seed),
                "show_sender": show_sender
            }
            return await self._post("/buyStars", req_data)
        except Exception as e:
            logger.error(f"Buy stars failed: {e}")
            raise

    async def buy_stars_without_kyc(self, username: str, amount: int, seed: str = None) -> Dict[str, Any]:
        """Купить звезды пользователю (без KYC)"""
        try:
            req_data = {
                "username": username,
                "amount": amount,
                "seed": self._get_seed(seed)
            }
            return await self._post("/buyStarsWithoutKYC", req_data)
        except Exception as e:
            logger.error(f"Buy stars without KYC failed: {e}")
            raise

    async def buy_premium(self, username: str, duration: int = 3, show_sender: bool = False,
                         fragment_cookies: str = None, seed: str = None) -> Dict[str, Any]:
        """Купить премиум пользователю (с KYC)"""
        try:
            req_data = {
                "username": username,
                "fragment_cookies": self._get_fragment_cookies(fragment_cookies),
                "seed": self._get_seed(seed),
                "duration": duration,
                "show_sender": show_sender
            }
            return await self._post("/buyPremium", req_data)
        except Exception as e:
            logger.error(f"Buy premium failed: {e}")
            raise

    async def buy_premium_without_kyc(self, username: str, duration: int = 3, seed: str = None) -> Dict[str, Any]:
        """Купить премиум пользователю (без KYC)"""
        try:
            if duration not in [3, 6, 12]:
                raise FragmentAPIError("Duration must be 3, 6, or 12 months")
                
            req_data = {
                "username": username,
                "seed": self._get_seed(seed),
                "duration": duration
            }
            return await self._post("/buyPremiumWithoutKYC", req_data)
        except Exception as e:
            logger.error(f"Buy premium without KYC failed: {e}")
            raise

    async def get_orders(self, seed: str = None, limit: int = 10, offset: int = 0) -> Dict[str, Any]:
        """Получить список заказов"""
        try:
            req_data = {
                "seed": self._get_seed(seed),
                "limit": limit,
                "offset": offset
            }
            return await self._post("/getOrders", req_data)
        except Exception as e:
            logger.error(f"Get orders failed: {e}")
            raise