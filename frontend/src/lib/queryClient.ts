import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { telegramWebApp } from "./telegram";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

function getTelegramHeaders(): Record<string, string> {
  const headers: Record<string, string> = {};
  
  // Получаем пользователя
  const user = telegramWebApp.getUser();
  if (user?.id) {
    headers['x-telegram-id'] = user.id.toString();
    console.log('Using Telegram ID:', user.id);
  }
  
  // Передаем initData в заголовке - это самый важный параметр!
  const initData = telegramWebApp.getInitData();
  if (initData) {
    headers['x-telegram-init-data'] = initData;
    console.log('Using initData with length:', initData.length);
  }
  
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
  
  console.log(`API ${method} ${url} headers:`, { 
    telegramId: headers['x-telegram-id'] || '-', 
    initDataLength: headers['x-telegram-init-data']?.length || 0 
  });
  
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