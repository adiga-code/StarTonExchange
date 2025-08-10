import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Типизация для Telegram WebApp
interface TelegramWebApp {
  initData: string;
  initDataUnsafe: Record<string, any>;
  version: string;
  platform: string;
  colorScheme: 'light' | 'dark';
  themeParams: Record<string, string>;
  isExpanded: boolean;
  viewportHeight: number;
  viewportStableHeight: number;
  ready(): void;
  expand(): void;
  close(): void;
}

declare global {
  interface Window {
    Telegram?: {
      WebApp: TelegramWebApp;
    };
  }
}

// Проверка, находимся ли мы в настоящем Telegram WebApp
const isTelegramWebApp = (): boolean => {
  try {
    const tg = window.Telegram?.WebApp;
    
    if (!tg) return false;
    
    // Проверяем наличие ключевых методов и свойств
    const hasRequiredMethods = typeof tg.ready === 'function' &&
                              typeof tg.expand === 'function' &&
                              typeof tg.close === 'function';
    
    const hasRequiredProps = typeof tg.version === 'string' &&
                            typeof tg.platform === 'string' &&
                            typeof tg.initData === 'string';
    
    // Дополнительная проверка на подлинность через initData
    const hasValidInitData = tg.initData && tg.initData.length > 0;
    
    return hasRequiredMethods && hasRequiredProps && hasValidInitData;
  } catch (error) {
    console.warn('Ошибка при проверке Telegram WebApp:', error);
    return false;
  }
};

// Показать сообщение об ошибке доступа
const showAccessDeniedMessage = (): void => {
  document.body.innerHTML = `
    <div style="
      display: flex; 
      flex-direction: column; 
      align-items: center; 
      justify-content: center; 
      height: 100vh; 
      text-align: center; 
      padding: 20px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
    ">
      <div style="
        background: rgba(255, 255, 255, 0.1);
        border-radius: 20px;
        padding: 40px;
        backdrop-filter: blur(10px);
        border: 1px solid rgba(255, 255, 255, 0.2);
        max-width: 400px;
      ">
        <h1 style="margin-bottom: 20px; font-size: 24px; font-weight: 600;">
          🤖 Только для Telegram
        </h1>
        <p style="margin-bottom: 30px; font-size: 16px; line-height: 1.5; opacity: 0.9;">
          Это приложение работает только внутри Telegram WebApp
        </p>
        <a 
          href="https://t.me/your_bot_username" 
          style="
            display: inline-block;
            background: #4E7FFF;
            color: white;
            text-decoration: none;
            padding: 12px 24px;
            border-radius: 12px;
            font-weight: 500;
            transition: background 0.3s;
          "
          onmouseover="this.style.background='#3d6ce8'"
          onmouseout="this.style.background='#4E7FFF'"
        >
          Открыть в Telegram
        </a>
      </div>
    </div>
  `;
};

// Инициализация приложения
const initializeApp = (): void => {
  try {
    const rootElement = document.getElementById("root");
    
    if (!rootElement) {
      throw new Error("Элемент с id 'root' не найден");
    }

    // В development режиме разрешаем доступ без Telegram
    if (process.env.NODE_ENV === 'development') {
      console.warn('🚧 Development режим: приложение запущено без проверки Telegram WebApp');
      createRoot(rootElement).render(<App />);
      return;
    }

    // В production проверяем Telegram WebApp
    if (!isTelegramWebApp()) {
      showAccessDeniedMessage();
      return;
    }

    // Инициализируем Telegram WebApp
    window.Telegram!.WebApp.ready();
    window.Telegram!.WebApp.expand();
    
    // Применяем тему Telegram
    if (window.Telegram!.WebApp.colorScheme === 'dark') {
      document.documentElement.classList.add('dark');
    }

    // Запускаем React приложение
    createRoot(rootElement).render(<App />);
    
  } catch (error) {
    console.error('Критическая ошибка при инициализации приложения:', error);
    
    document.body.innerHTML = `
      <div style="
        display: flex; 
        flex-direction: column; 
        align-items: center; 
        justify-content: center; 
        height: 100vh; 
        text-align: center; 
        padding: 20px;
        font-family: monospace;
        background: #1a1a1a;
        color: #ff6b6b;
      ">
        <h1>❌ Ошибка инициализации</h1>
        <p>Произошла критическая ошибка при запуске приложения</p>
        <details style="margin-top: 20px; color: #888;">
          <summary>Подробности</summary>
          <pre style="margin-top: 10px; font-size: 12px;">${error.message}</pre>
        </details>
      </div>
    `;
  }
};

// Запуск приложения
initializeApp();