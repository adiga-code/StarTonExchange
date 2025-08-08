import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { telegramWebApp } from "./telegram";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

// Функция для получения реального ID пользователя Telegram
function getTelegramUserId(): string {
  const user = telegramWebApp.getUser();
  if (user?.id) {
    return user.id.toString();
  }
  
  // Fallback для разработки
  console.warn('No Telegram user found, using demo ID');
  return '123456789';
}

// Функция для получения заголовков с реальными данными Telegram
function getTelegramHeaders(): Record<string, string> {
  const headers: Record<string, string> = {};
  
  // Получаем реальный ID пользователя
  const telegramId = getTelegramUserId();
  headers['x-telegram-id'] = telegramId;
  
  // Если доступны initData, добавляем их тоже
  if (telegramWebApp.webApp?.initData) {
    headers['x-telegram-init-data'] = telegramWebApp.webApp.initData;
  }
  
  console.log('Telegram headers:', headers); // Для отладки
  
  return headers;
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const telegramHeaders = getTelegramHeaders();
  
  const headers: Record<string, string> = {
    ...telegramHeaders,
  };
  
  if (data) {
    headers['Content-Type'] = 'application/json';
  }
  
  console.log(`API ${method} ${url}`, { headers, data }); // Для отладки
  
  const res = await fetch(url, {
    method,
    headers,
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const telegramHeaders = getTelegramHeaders();
    
    const res = await fetch(queryKey.join("/") as string, {
      headers: telegramHeaders,
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});