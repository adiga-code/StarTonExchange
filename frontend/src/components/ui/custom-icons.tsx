// Создай файл: frontend/src/components/ui/custom-icons.tsx

import React, { useState } from 'react';
import { 
  Star as LucideStar, 
  Bitcoin as LucideBitcoin,
  Coins as LucideCoins,
  Shield as LucideShield,
  BarChart3 as LucideBarChart3,
  Share as LucideShare
} from "lucide-react";

// Конфигурация кастомных иконок
const ICON_URLS = {
  star: "https://cdn-icons-png.flaticon.com/512/1828/1828884.png",
  bitcoin: "https://cryptologos.cc/logos/bitcoin-btc-logo.png",
  ton: "https://cryptologos.cc/logos/toncoin-ton-logo.png", 
  telegram: "https://cdn-icons-png.flaticon.com/512/2111/2111646.png",
  shield: "https://cdn-icons-png.flaticon.com/512/9308/9308992.png",
  chart: "https://cdn-icons-png.flaticon.com/512/2920/2920277.png",
  wallet: "https://cdn-icons-png.flaticon.com/512/1611/1611179.png",
};

// Универсальный компонент иконки
interface CustomIconProps {
  className?: string;
  onClick?: () => void;
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

// Экспортируем остальные без изменений
export { 
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