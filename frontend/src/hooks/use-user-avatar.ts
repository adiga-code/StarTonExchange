import { useState, useEffect } from 'react';

export function useUserAvatar(username?: string | null) {
  const [avatar, setAvatar] = useState<{photo_url: string, first_name: string} | null>(null);

  useEffect(() => {
    if (!username?.trim()) return;

    const fetchAvatar = async () => {
      try {
        const response = await fetch(`/api/getPhoto?username=${username.trim()}`);
        const data = await response.json();
        if (data.success) setAvatar(data);
      } catch (e) {}
    };

    fetchAvatar();
  }, [username]);

  return avatar;
}