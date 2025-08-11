
import { useTelegram } from "@/hooks/use-telegram";
import { motion } from "framer-motion";
import { MessageCircle, Smartphone, Monitor } from "lucide-react";

interface TelegramGuardProps {
  children: React.ReactNode;
}

export default function TelegramGuard({ children }: TelegramGuardProps) {
  const { isAvailable, user } = useTelegram();

  if (!isAvailable || !user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 text-center"
        >
          <div className="flex justify-center mb-6">
            <div className="relative">
              <div className="w-20 h-20 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
                <MessageCircle className="w-10 h-10 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="absolute -top-2 -right-2 w-8 h-8 bg-red-100 dark:bg-red-900 rounded-full flex items-center justify-center">
                <span className="text-red-600 dark:text-red-400 text-xl">!</span>
              </div>
            </div>
          </div>
          
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
            Доступ только через Telegram
          </h1>
          
          <p className="text-gray-600 dark:text-gray-300 mb-6 leading-relaxed">
            Это приложение работает только внутри Telegram. 
            Пожалуйста, откройте его через Telegram бота.
          </p>
          
          <div className="space-y-4">
            <div className="flex items-center justify-center space-x-4 text-sm text-gray-500 dark:text-gray-400">
              <div className="flex items-center space-x-2">
                <Smartphone className="w-4 h-4" />
                <span>Мобильный</span>
              </div>
              <div className="w-1 h-1 bg-gray-400 rounded-full"></div>
              <div className="flex items-center space-x-2">
                <Monitor className="w-4 h-4" />
                <span>Десктоп</span>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  return <>{children}</>;
}
