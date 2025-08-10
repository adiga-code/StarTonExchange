import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Проверка, находимся ли мы в Telegram WebApp
const isTelegramWebApp = (): boolean => {
  return window.Telegram && window.Telegram.WebApp ? true : false;
};

// В производственной среде блокируем доступ не из Telegram WebApp
if (process.env.NODE_ENV === 'production' && !isTelegramWebApp()) {
  document.body.innerHTML = `
    <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; text-align: center; padding: 20px;">
      <h1 style="margin-bottom: 20px;">Это приложение доступно только через Telegram</h1>
      <p>Пожалуйста, откройте приложение через бота <a href="https://t.me/your_bot_username" style="color: #4E7FFF;">@your_bot_username</a></p>
    </div>
  `;
} else {
  createRoot(document.getElementById("root")!).render(<App />);
}