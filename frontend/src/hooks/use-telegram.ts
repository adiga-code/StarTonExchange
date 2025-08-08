import { useState, useEffect } from 'react';
import { telegramWebApp, type TelegramUser } from '@/lib/telegram';

export function useTelegram() {
  const [user, setUser] = useState<TelegramUser | null>(null);
  const [isAvailable, setIsAvailable] = useState(false);
  const [colorScheme, setColorScheme] = useState<'light' | 'dark'>('dark');
  const [initData, setInitData] = useState<string | null>(null);

  useEffect(() => {
    const available = telegramWebApp.isAvailable();
    setIsAvailable(available);
    
    if (available) {
      setUser(telegramWebApp.getUser());
      setColorScheme(telegramWebApp.getColorScheme());
      setInitData(telegramWebApp.webApp?.initData || null);
    } else {
      // Mock user for development
      setUser({
        id: 56789,
        first_name: 'John',
        last_name: 'Doe',
        username: 'johndoe',
        language_code: 'en',
      });
      setInitData(null);
    }
  }, []);

  const showAlert = (message: string) => {
    telegramWebApp.showAlert(message);
  };

  const showConfirm = (message: string, callback: (confirmed: boolean) => void) => {
    telegramWebApp.showConfirm(message, callback);
  };

  const hapticFeedback = (type?: 'light' | 'medium' | 'heavy' | 'success' | 'error' | 'warning') => {
    telegramWebApp.hapticFeedback(type);
  };

  const close = () => {
    telegramWebApp.close();
  };

  const shareApp = (message: string = 'Попробуй этот крутой обменник Stars и TON!') => {
    telegramWebApp.switchInlineQuery(message, ['users']);
  };

  return {
    user,
    isAvailable,
    colorScheme,
    initData,
    showAlert,
    showConfirm,
    hapticFeedback,
    close,
    shareApp,
  };
}
