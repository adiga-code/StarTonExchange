// frontend/src/hooks/use-preload-avatar.ts
import { useState, useEffect } from 'react';
import type { SnakeCaseUser } from "../../shared/schema";

interface AvatarData {
  photo_url: string;
  first_name: string;
}

interface UsePreloadAvatarResult {
  avatar: AvatarData | null;
  isLoading: boolean;
  error: string | null;
}

// Кеш для хранения фото в памяти во время сессии
const avatarCache = new Map<string, AvatarData>();

export function usePreloadAvatar(user?: SnakeCaseUser | null): UsePreloadAvatarResult {
  const [avatar, setAvatar] = useState<AvatarData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.username?.trim()) {
      setAvatar(null);
      setIsLoading(false);
      return;
    }

    const username = user.username.trim();
    
    // Проверяем кеш
    if (avatarCache.has(username)) {
      setAvatar(avatarCache.get(username)!);
      setIsLoading(false);
      return;
    }

    // Загружаем фото
    const fetchAvatar = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        const response = await fetch(`/api/getPhoto?username=${username}`);
        const data = await response.json();
        
        if (data.success) {
          // Сохраняем в кеш
          avatarCache.set(username, data);
          setAvatar(data);
        } else {
          setError(data.error || 'Failed to load avatar');
          setAvatar(null);
        }
      } catch (e) {
        setError('Network error');
        setAvatar(null);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAvatar();
  }, [user?.username]);

  return { avatar, isLoading, error };
}