import httpx
import asyncio
from datetime import datetime, timedelta
from typing import Optional
import logging

logger = logging.getLogger(__name__)

class TONPriceService:
    def __init__(self):
        self.last_price: Optional[float] = None
        self.last_update: Optional[datetime] = None
        
    async def get_current_ton_price_rub(self, storage) -> float:
        """Получить цену TON в рублях с наценкой"""
        cache_minutes = int(await storage.get_cached_setting("ton_price_cache_minutes") or "15")
        
        # Проверяем кэш
        if (self.last_price is None or 
            self.last_update is None or 
            datetime.utcnow() - self.last_update > timedelta(minutes=cache_minutes)):
            
            try:
                # Получаем цену TON/USDT с Binance (бесплатно)
                async with httpx.AsyncClient() as client:
                    response = await client.get("https://api.binance.com/api/v3/ticker/price?symbol=TONUSDT", timeout=10)
                    if response.status_code == 200:
                        ton_usd = float(response.json()["price"])
                        
                        # Получаем курс USD/RUB
                        usd_response = await client.get("https://api.exchangerate-api.com/v4/latest/USD", timeout=10)
                        if usd_response.status_code == 200:
                            usd_rub = usd_response.json()["rates"]["RUB"]
                            
                            # Считаем цену с наценкой
                            base_price = ton_usd * usd_rub
                            markup = float(await storage.get_cached_setting("ton_markup_percentage") or "5")
                            final_price = base_price * (1 + markup / 100)
                            
                            self.last_price = final_price
                            self.last_update = datetime.utcnow()
                            
                            logger.info(f"TON price updated: {final_price:.2f} RUB")
                            return final_price
                            
            except Exception as e:
                logger.error(f"Error updating TON price: {e}")
        
        # Возвращаем кэш или fallback
        if self.last_price:
            return self.last_price
        
        fallback = float(await storage.get_cached_setting("ton_fallback_price") or "420")
        return fallback

# Глобальный экземпляр
ton_price_service = TONPriceService()