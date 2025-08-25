import httpx
import logging
from datetime import datetime, timedelta
from typing import Optional

logger = logging.getLogger(__name__)

class TONPriceService:
    def __init__(self):
        self.last_price: Optional[float] = None
        self.last_update: Optional[datetime] = None

    async def get_current_ton_price_rub(self, storage) -> float:
        """Получить текущую цену TON в рублях с наценкой"""
        try:
            # Получаем настройки с обработкой пустых значений
            cache_minutes_str = await storage.get_cached_setting("ton_price_cache_minutes")
            cache_minutes = float(cache_minutes_str) if cache_minutes_str and cache_minutes_str.strip() else 15.0
            
            markup_str = await storage.get_cached_setting("ton_markup_percentage") 
            markup = float(markup_str) if markup_str and markup_str.strip() else 5.0
            
            fallback_str = await storage.get_cached_setting("ton_fallback_price")
            fallback = float(fallback_str) if fallback_str and fallback_str.strip() else 420.0
            
            logger.info(f"🔧 TON настройки: cache_minutes={cache_minutes}, markup={markup}%, fallback={fallback}")
            
            # Проверяем нужно ли обновление кэша
            cache_expiry = timedelta(minutes=cache_minutes)
            need_update = (
                self.last_price is None or 
                self.last_update is None or 
                datetime.utcnow() - self.last_update > cache_expiry
            )
            
            if need_update:
                logger.info("🔄 Обновляем курс TON...")
                await self._update_price_from_api(markup, fallback)
            else:
                logger.info(f"📊 Используем кэшированную цену TON: {self.last_price:.2f} RUB")
            
            return self.last_price if self.last_price else fallback
            
        except Exception as e:
            logger.error(f"❌ Ошибка получения цены TON: {e}")
            fallback_str = await storage.get_cached_setting("ton_fallback_price")
            fallback = float(fallback_str) if fallback_str and fallback_str.strip() else 420.0
            return fallback

    async def force_update_price(self, storage):
        """Принудительно обновить цену TON"""
        markup_str = await storage.get_cached_setting("ton_markup_percentage") 
        markup = float(markup_str) if markup_str and markup_str.strip() else 5.0
        
        fallback_str = await storage.get_cached_setting("ton_fallback_price")
        fallback = float(fallback_str) if fallback_str and fallback_str.strip() else 420.0
        
        await self._update_price_from_api(markup, fallback)
        return self.last_price

    async def _update_price_from_api(self, markup: float, fallback: float):
        """Обновить цену с внешних API"""
        try:
            async with httpx.AsyncClient() as client:
                # Получаем курс TON/USD с Binance
                logger.info("📡 Запрос курса TON/USD...")
                ton_response = await client.get(
                    "https://api.binance.com/api/v3/ticker/price?symbol=TONUSDT", 
                    timeout=10
                )
                
                if ton_response.status_code != 200:
                    raise Exception(f"Binance API error: {ton_response.status_code}")
                    
                ton_usd = float(ton_response.json()["price"])
                logger.info(f"📈 TON/USD: ${ton_usd}")
                
                # Получаем курс USD/RUB
                logger.info("📡 Запрос курса USD/RUB...")
                usd_response = await client.get(
                    "https://api.exchangerate-api.com/v4/latest/USD", 
                    timeout=10
                )
                
                if usd_response.status_code != 200:
                    raise Exception(f"Exchange rate API error: {usd_response.status_code}")
                    
                usd_rub = usd_response.json()["rates"]["RUB"]
                logger.info(f"💱 USD/RUB: {usd_rub}")
                
                # Считаем цену с наценкой
                base_price = ton_usd * usd_rub
                final_price = base_price * (1 + markup / 100)
                
                self.last_price = final_price
                self.last_update = datetime.utcnow()
                
                logger.info(f"✅ TON цена обновлена: {base_price:.2f} RUB + {markup}% = {final_price:.2f} RUB")
                return final_price
                
        except Exception as e:
            logger.error(f"❌ Ошибка обновления курса TON: {e}")
            # В случае ошибки используем fallback, но не обновляем кэш
            if not self.last_price:
                self.last_price = fallback
                logger.info(f"🔄 Используем fallback цену: {fallback} RUB")

# Глобальный экземпляр
ton_price_service = TONPriceService()