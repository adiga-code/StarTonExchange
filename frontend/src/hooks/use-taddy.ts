// src/hooks/use-taddy.ts

import { useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

// Расширяем глобальный объект Window
declare global {
  interface Window {
    Taddy?: {
      init(pubId: string): void;
      ready(): void;
      exchange(): {
        feed(params: {
          limit?: number;
          imageFormat?: 'png' | 'webp' | 'jpg';
          autoImpressions?: boolean;
          showCompleted?: boolean;
        }): Promise<any[]>;
        impressions(items: any[]): void;
        open(item: any, autoCheck?: boolean): Promise<void>;
        check(item: any): Promise<boolean>;
      };
      ads(): {
        interstitial(params?: {
          onClosed?: () => void;
          onViewThrough?: (id: string) => void;
        }): Promise<boolean>;
      };
    };
  }
}

interface TaddySettings {
  enabled: boolean;
  pubId: string;
}

export function useTaddy() {
  const initRef = useRef(false);
  
  // Получаем настройки Taddy из админки
  const { data: settings, isLoading } = useQuery({
    queryKey: ['/api/admin/settings/current'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/admin/settings/current');
      const data = await response.json();
      return {
        enabled: data.taddy_enabled === 'true',
        pubId: data.taddy_pub_id || '',
      } as TaddySettings;
    },
    staleTime: 5 * 60 * 1000, // 5 минут кэша
    refetchOnWindowFocus: false,
  });

  // Инициализация Taddy SDK
  useEffect(() => {
    if (isLoading || !settings?.enabled || !settings?.pubId || initRef.current) {
      return;
    }

    const initTaddy = () => {
      if (window.Taddy) {
        try {
          console.log('🎯 Initializing Taddy SDK with pubId:', settings.pubId);
          
          // Инициализируем Taddy
          window.Taddy.init(settings.pubId);
          
          // Отправляем ready event для регистрации запуска
          window.Taddy.ready();
          
          initRef.current = true;
          console.log('✅ Taddy SDK initialized successfully');
          
        } catch (error) {
          console.error('❌ Taddy initialization failed:', error);
        }
      } else {
        console.warn('⚠️ Taddy SDK not loaded');
      }
    };

    // Если Taddy уже загружен
    if (window.Taddy) {
      initTaddy();
    } else {
      // Ждем загрузки SDK
      const checkTaddy = setInterval(() => {
        if (window.Taddy) {
          initTaddy();
          clearInterval(checkTaddy);
        }
      }, 100);

      // Таймаут на 5 секунд
      setTimeout(() => {
        clearInterval(checkTaddy);
        if (!initRef.current) {
          console.error('❌ Taddy SDK failed to load within 5 seconds');
        }
      }, 5000);
    }
  }, [settings?.enabled, settings?.pubId, isLoading]);

  return {
    isEnabled: settings?.enabled ?? false,
    isInitialized: initRef.current,
    taddy: window.Taddy || null,
    settings,
    isLoading,
  };
}