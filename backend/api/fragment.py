import aiohttp
import asyncio
import base64
from typing import Optional
from dataclasses import dataclass

# Модели остаются те же
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
        self._session = aiohttp.ClientSession()
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async context manager exit"""
        if self._session:
            await self._session.close()

    def _get_session(self):
        """Get or create session for standalone usage"""
        if self._session is None:
            self._session = aiohttp.ClientSession()
        return self._session

    async def close(self):
        """Manually close session"""
        if self._session:
            await self._session.close()
            self._session = None

    async def _get(self, path):
        session = self._get_session()
        url = f"{self.base_url}{path}"
        
        async with session.get(url) as response:
            if not response.ok:
                text = await response.text()
                raise FragmentAPIError(f"{response.status} | {text}")
            return await response.json()

    async def _post(self, path, data):
        session = self._get_session()
        url = f"{self.base_url}{path}"
        
        async with session.post(url, json=data) as response:
            if not response.ok:
                text = await response.text()
                raise FragmentAPIError(f"{response.status} | {text}")
            return await response.json()
    
    def _base64_encode(self, data):
        return base64.b64encode(data.encode()).decode()

    def _get_seed(self, seed: str = None) -> str:
        if seed is None:
            if self.default_seed is None:
                raise FragmentAPIError("Seed not provided and no default seed set.")
            seed = self.default_seed
        else: 
            if not isinstance(seed, str):
                raise FragmentAPIError("Seed must be a string.")
            
            seed = seed.strip()
            if len(seed.split(" ")) not in [12, 24]:
                raise FragmentAPIError("Seed must be 12 or 24 space-separated words.")
            
        return self._base64_encode(seed)

    def _get_fragment_cookies(self, fragment_cookies: str = None) -> str:
        if fragment_cookies is None:
            if self.default_fragment_cookies is None:
                raise FragmentAPIError("Fragment cookies not provided and no default set.")
            fragment_cookies = self.default_fragment_cookies
        else:
            if not isinstance(fragment_cookies, str):
                raise FragmentAPIError("Fragment cookies must be a string.")
            
            fragment_cookies = fragment_cookies.strip()
            if "stel_ssid=" not in fragment_cookies:
                raise FragmentAPIError("Fragment cookies must be in Header String format exported from Cookie-Editor extension: https://chromewebstore.google.com/detail/cookie-editor/hlkenndednhfkekhgcdicdfddnkalmdm")
        return self._base64_encode(fragment_cookies)

    async def ping(self):
        return await self._get("/ping")

    async def get_balance(self, seed: str = None):
        return await self._post("/getBalance", {"seed": self._get_seed(seed)})

    async def get_user_info(self, username: str, fragment_cookies: str = None):
        data = {"username": username}
        data["fragment_cookies"] = self._get_fragment_cookies(fragment_cookies)
        return await self._post("/getUserInfo", data)

    async def buy_stars(self, username: str, amount: int, show_sender: bool = False, fragment_cookies: str = None, seed: str = None):
        req = BuyStarsRequest(
            username=username,
            amount=amount,
            fragment_cookies=self._get_fragment_cookies(fragment_cookies),
            seed=self._get_seed(seed),
            show_sender=show_sender
        )
        return await self._post("/buyStars", req.__dict__)

    async def buy_stars_without_kyc(self, username: str, amount: int, seed: str = None):
        req = BuyStarsWithoutKYCRequest(
            username=username,
            amount=amount,
            seed=self._get_seed(seed)
        )
        return await self._post("/buyStarsWithoutKYC", req.__dict__)

    async def buy_premium(self, username: str, duration: int = 3, show_sender: bool = False, fragment_cookies: str = None, seed: str = None):
        req = BuyPremiumRequest(
            username=username,
            fragment_cookies=self._get_fragment_cookies(fragment_cookies),
            seed=self._get_seed(seed),
            duration=duration,
            show_sender=show_sender
        )
        return await self._post("/buyPremium", req.__dict__)

    async def buy_premium_without_kyc(self, username: str, duration: int = 3, seed: str = None):
        req = BuyPremiumWithoutKYCRequest(
            username=username,
            seed=self._get_seed(seed),
            duration=duration
        )
        return await self._post("/buyPremiumWithoutKYC", req.__dict__)

    async def get_orders(self, seed: str = None, limit: int = 10, offset: int = 0):
        req = GetOrdersRequest(
            seed=self._get_seed(seed),
            limit=limit,
            offset=offset
        )
        return await self._post("/getOrders", req.__dict__)