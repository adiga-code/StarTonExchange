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

// Инициализация приложения
const initializeApp = (): void => {
  try {
    const rootElement = document.getElementById("root");
    
    if (!rootElement) {
      throw new Error("Элемент с id 'root' не найден");
    }

    const isDevelopment = import.meta.env.DEV;

    // В development режиме разрешаем доступ без Telegram
    if (isDevelopment) {
      console.warn('🚧 Development режим: приложение запущено без проверки Telegram WebApp');
      createRoot(rootElement).render(<App />);
      return;
    }

    // В production проверяем Telegram WebApp
    if (!isTelegramWebApp()) {
      console.error('❌ Production режим: доступ только через Telegram WebApp');
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
      <div style="...">
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