// frontend/src/components/ui/custom-icons.tsx

import React, { useState } from 'react';
import { 
  Star as LucideStar, 
  Bitcoin as LucideBitcoin,
  Coins as LucideCoins,
  Shield as LucideShield,
  BarChart3 as LucideBarChart3,
  Share as LucideShare,
  // Импортируем все остальные иконки из lucide-react
  ShoppingCart,
  Calculator,
  ExternalLink,
  CalendarDays,
  ThumbsUp,
  CheckCircle,
  Users,
  Copy,
  Tag,
  History,
  Moon,
  Sun,
  User,
  TrendingUp,
  ChevronRight,
  MoreHorizontal,
  DollarSign,
  Activity,
  ArrowLeft,
} from "lucide-react";

// Конфигурация кастомных иконок с более надежными источниками
const ICON_URLS = {
  star: "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTEyIDJMMTUuMDkgOC4yNkwyMiA5TDE3IDEzLjc0TDE4LjE4IDIxTDEyIDE3Ljc3TDUuODIgMjFMNyAxMy43NEwyIDlMOC45MSA4LjI2TDEyIDJaIiBmaWxsPSIjRkZENzAwIi8+Cjwvc3ZnPgo=",
  bitcoin: "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iMTIiIGN5PSIxMiIgcj0iMTAiIGZpbGw9IiNGNzk0MUEiLz4KPHA+dGggZD0iTTEzLjUgNy41VjZIMTJWNy41SDEwLjVWOUgxMlY2SDEzLjVaTTEwLjUgOS4ySDEyVjEySDEzLjVWMTRIMTJWMTVIMTAuNVYxNEg5VjEySDEwLjVWOS4yWiIgZmlsbD0iI0ZGRkZGRiIvPgo8L3N2Zz4K",
  ton: "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iMTIiIGN5PSIxMiIgcj0iMTAiIGZpbGw9IiMwMDg4Q0MiLz4KPHRleHQgeD0iMTIiIHk9IjE2IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmaWxsPSJ3aGl0ZSIgZm9udC1zaXplPSIxMiIgZm9udC13ZWlnaHQ9ImJvbGQiPlQ8L3RleHQ+Cjwvc3ZnPgo=",
  telegram: "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iMTIiIGN5PSIxMiIgcj0iMTAiIGZpbGw9IiMyQUFCRUUiLz4KPHBhdGggZD0iTTEwIDEzLjVMOS41IDE3TDggMTZMMTYgOEw5IDEzSDEwVjEzLjVaIiBmaWxsPSJ3aGl0ZSIvPgo8L3N2Zz4K",
  shield: "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTEyIDJMMTMuMDkgOC4yNkwyMiA5TDE3IDEzLjc0TDE4LjE4IDIxTDEyIDE3Ljc3TDUuODIgMjFMNyAxMy43NEwyIDlMOC45MSA4LjI2TDEyIDJaIiBmaWxsPSIjNEY0NkU1Ii8+Cjwvc3ZnPgo=",
  chart: "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTMgM1YyMUgyMVYxOUg1VjNIM1oiIHN0cm9rZT0iIzRGNDZFNSIgc3Ryb2tlLXdpZHRoPSIyIi8+CjxwYXRoIGQ9Ik05IDlWMTVIMTFWOUg5WiIgZmlsbD0iIzRGNDZFNSIvPgo8cGF0aCBkPSJNMTMgNVYxNUgxNVY1SDEzWiIgZmlsbD0iIzRGNDZFNSIvPgo8cGF0aCBkPSJNMTcgMTNWMTVIMTlWMTNIMTdaIiBmaWxsPSIjNEY0NkU1Ii8+Cjwvc3ZnPgo=",
  wallet: "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTIwIDdIMTdWNkMxNyA0LjkgMTYuMSA0IDE1IDRINUMzLjkgNCAzIDQuOSAzIDZWMThDMyAxOS4xIDMuOSAyMCA1IDIwSDE5QzIwLjEgMjAgMjEgMTkuMSAyMSAxOFY4QzIxIDcuNCAyMC42IDcgMjAgN1oiIGZpbGw9IiM0RjQ2RTUiLz4KPC9zdmc+Cg==",
};

// Универсальный компонент иконки
interface CustomIconProps {
  className?: string;
  onClick?: () => void;
  [key: string]: any;
}

// Замена Star
export const Star: React.FC<CustomIconProps> = ({ className = "w-4 h-4", ...props }) => {
  const [error, setError] = useState(false);
  
  if (error) {
    return <LucideStar className={className} {...props} />;
  }
  
  return (
    <img 
      src={ICON_URLS.star}
      alt="Star"
      className={className}
      onError={() => setError(true)}
      {...props}
    />
  );
};

// Замена Bitcoin  
export const Bitcoin: React.FC<CustomIconProps> = ({ className = "w-4 h-4", ...props }) => {
  const [error, setError] = useState(false);
  
  if (error) {
    return <LucideBitcoin className={className} {...props} />;
  }
  
  return (
    <img 
      src={ICON_URLS.bitcoin}
      alt="Bitcoin"
      className={className}
      onError={() => setError(true)}
      {...props}
    />
  );
};

// Замена Coins (для TON)
export const Coins: React.FC<CustomIconProps> = ({ className = "w-4 h-4", ...props }) => {
  const [error, setError] = useState(false);
  
  if (error) {
    return <LucideCoins className={className} {...props} />;
  }
  
  return (
    <img 
      src={ICON_URLS.ton}
      alt="TON"
      className={className}
      onError={() => setError(true)}
      {...props}
    />
  );
};

// Замена Shield
export const Shield: React.FC<CustomIconProps> = ({ className = "w-4 h-4", ...props }) => {
  const [error, setError] = useState(false);
  
  if (error) {
    return <LucideShield className={className} {...props} />;
  }
  
  return (
    <img 
      src={ICON_URLS.shield}
      alt="Shield"
      className={className}
      onError={() => setError(true)}
      {...props}
    />
  );
};

// Замена BarChart3
export const BarChart3: React.FC<CustomIconProps> = ({ className = "w-4 h-4", ...props }) => {
  const [error, setError] = useState(false);
  
  if (error) {
    return <LucideBarChart3 className={className} {...props} />;
  }
  
  return (
    <img 
      src={ICON_URLS.chart}
      alt="Chart"
      className={className}
      onError={() => setError(true)}
      {...props}
    />
  );
};

// Замена Share (для Telegram)
export const Share: React.FC<CustomIconProps> = ({ className = "w-4 h-4", ...props }) => {
  const [error, setError] = useState(false);
  
  if (error) {
    return <LucideShare className={className} {...props} />;
  }
  
  return (
    <img 
      src={ICON_URLS.telegram}
      alt="Telegram"
      className={className}
      onError={() => setError(true)}
      {...props}
    />
  );
};

// Экспортируем остальные иконки из lucide-react БЕЗ ИЗМЕНЕНИЙ
export { 
  ShoppingCart,
  Calculator,
  ExternalLink, // ← Эта иконка теперь должна работать
  CalendarDays,
  ThumbsUp,
  CheckCircle,
  Users,
  Copy,
  Tag,
  History,
  Moon,
  Sun,
  User,
  TrendingUp,
  ChevronRight,
  MoreHorizontal,
  DollarSign,
  Activity,
  ArrowLeft,
};