import { useState, useEffect } from 'react';
import { useTelegram } from './use-telegram';

export function useTheme() {
  const { colorScheme } = useTelegram();
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');

  useEffect(() => {
    // Initialize theme based on Telegram's color scheme or localStorage
    const savedTheme = localStorage.getItem('theme') as 'light' | 'dark' | null;
    const initialTheme = savedTheme || colorScheme || 'dark';
    setTheme(initialTheme);
    updateDocumentTheme(initialTheme);
  }, [colorScheme]);

  const updateDocumentTheme = (newTheme: 'light' | 'dark') => {
    const root = document.documentElement;
    
    if (newTheme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  };

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
    updateDocumentTheme(newTheme);
  };

  return {
    theme,
    toggleTheme,
    isDark: theme === 'dark',
  };
}
