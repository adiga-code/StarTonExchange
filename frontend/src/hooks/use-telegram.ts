import { useState, useEffect } from 'react';
import { telegramWebApp, type TelegramUser } from '@/lib/telegram';
import { useLaunchParams } from '@telegram-apps/sdk-react';

export function useTelegram() {
  const [user, setUser] = useState<TelegramUser | null>(null);
  const [isAvailable, setIsAvailable] = useState(false);

  let params: any
  try {
    params = useLaunchParams(true)
  } catch (e) {
    console.log(e)
  }
  const [colorScheme, setColorScheme] = useState<'light' | 'dark'>('dark');

  useEffect(() => {
    if (params) {
      setIsAvailable(true)
      setUser(params.tgWebAppData.user);
      setColorScheme(telegramWebApp.getColorScheme());
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
    showAlert,
    showConfirm,
    hapticFeedback,
    close,
    shareApp,
  }
}
