import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useTelegram } from "@/hooks/use-telegram";
import { useTheme } from "@/hooks/use-theme";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useUserAvatar } from "@/hooks/use-user-avatar";
import BalanceCard from "./balance-card";
import BuyTab from "./buy-tab";
import TasksTab from "./tasks-tab";
import ProfileTab from "./profile-tab";
import LoadingModal from "./loading-modal";
import TelegramGuard from "./telegram-guard";
import { Star, Moon, Sun, User, ShoppingCart, CheckSquare, Coins, TrendingUp } from "@/components/ui/custom-icons";
import type { SnakeCaseUser, User as UserType } from "../../shared/schema";

type TabType = 'buy' | 'earn' | 'sell' | 'profile';

export default function TelegramApp() {
  const [currentTab, setCurrentTab] = useState<TabType>('buy');
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');

  const { user, isAvailable, hapticFeedback } = useTelegram();
  const { theme, toggleTheme, isDark } = useTheme();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Initialize user
  const createUserMutation = useMutation({
    mutationFn: async (userData: any) => {
      const response = await apiRequest('POST', '/api/users', userData);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/users/me'] });
    },
  });

  // Get current user data
  const { data: currentUser, isLoading: userLoading } = useQuery<SnakeCaseUser>({
    queryKey: ['/api/users/me'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/users/me');
      return response.json();
    },
    enabled: !!user,
  });
  const userAvatar = useUserAvatar(currentUser?.username);

  useEffect(() => {
    if (user && !currentUser && !userLoading) {
      createUserMutation.mutate({
        telegram_id: user.id.toString(),
        username: user.username || null,
        first_name: user.first_name,
        last_name: user.last_name || null,
      });
    }
  }, [user, currentUser, userLoading]);

  const handleTabChange = (tab: TabType) => {
    hapticFeedback('light');
    setCurrentTab(tab);
  };


  const showLoadingModal = (message: string) => {
    setLoadingMessage(message);
    setIsLoading(true);
  };

  const hideLoadingModal = () => {
    setIsLoading(false);
    setLoadingMessage('');
  };

  const getUserInitials = () => {
    if (!user) return 'JD';
    const first = user.first_name?.[0] || '';
    const last = user.last_name?.[0] || '';
    return (first + last).toUpperCase() || user.username?.[0]?.toUpperCase() || 'U';
  };

  if (userLoading) {
    return (
      <div className="min-h-screen bg-dark-bg dark:bg-dark-bg flex items-center justify-center">
        <div className="animate-spin w-12 h-12 border-4 border-accent-blue border-t-transparent rounded-full"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white dark:bg-[#0E0E10] text-gray-900 dark:text-white transition-colors duration-200">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/80 dark:bg-[#0E0E10]/80 backdrop-blur-lg border-b border-gray-200 dark:border-white/10">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center space-x-3">
            <motion.div
              className="w-8 h-8 bg-[#4E7FFF] rounded-lg flex items-center justify-center"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <Star className="w-4 h-4 text-white" />
            </motion.div>
            <h1 className="text-lg font-bold">Stars Exchange</h1>
          </div>
          <div className="flex items-center space-x-3">
            <motion.button
              onClick={toggleTheme}
              className="p-2 rounded-lg bg-gray-100 dark:bg-[#1A1A1C] hover:bg-gray-200 dark:hover:bg-white/10 transition-colors"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </motion.button>
            {userAvatar?.photo_url ? (
              <img 
                src={userAvatar.photo_url} 
                alt="Avatar" 
                className="w-8 h-8 rounded-full"
              />
            ) : (
              <motion.div
                className="w-8 h-8 bg-gradient-to-br from-[#4E7FFF] to-purple-500 rounded-full flex items-center justify-center cursor-pointer"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <span className="text-xs font-bold text-white">{getUserInitials()}</span>
              </motion.div>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="pb-20">
        <BalanceCard user={currentUser} />


        {/* Tab Content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={currentTab}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="px-4"
          >
            {currentTab === 'buy' && (
              <BuyTab
                user={currentUser}
                onShowLoading={showLoadingModal}
                onHideLoading={hideLoadingModal}
              />
            )}
            {currentTab === 'earn' && <TasksTab user={currentUser} />}
            {currentTab === 'sell' && (
              <div className="bg-white dark:bg-[#1A1A1C] rounded-xl p-6 shadow-lg text-center">
                <TrendingUp className="w-12 h-12 text-[#4E7FFF] mx-auto mb-4" />
                <h3 className="text-xl font-bold mb-2">Продажа</h3>
                <p className="text-gray-600 dark:text-gray-400 mb-4">
                  Функция продажи криптовалюты находится в разработке
                </p>
                <div className="text-sm text-gray-500 dark:text-gray-500">
                  Скоро будет доступна возможность продать ваши TON и Stars
                </div>
              </div>
            )}
            {currentTab === 'profile' && <ProfileTab user={currentUser} onTabChange={handleTabChange} />}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white/80 dark:bg-[#1A1A1C]/80 backdrop-blur-lg border-t border-gray-200 dark:border-white/10">
        <div className="flex items-center justify-around py-2">
          {[
            { id: 'buy', icon: ShoppingCart, label: 'Купить' },
            { id: 'earn', icon: Coins, label: 'Заработать' },
            { id: 'sell', icon: TrendingUp, label: 'Продать' },
            { id: 'profile', icon: User, label: 'Профиль' },
          ].map((tab) => (
            <motion.button
              key={tab.id}
              onClick={() => handleTabChange(tab.id as TabType)}
              className={`flex flex-col items-center py-2 px-4 transition-colors ${currentTab === tab.id
                ? 'text-[#4E7FFF]'
                : 'text-gray-500 dark:text-gray-400'
                }`}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <tab.icon className="w-5 h-5 mb-1" />
              <span className="text-xs">{tab.label}</span>
            </motion.button>
          ))}
        </div>
      </nav>


      {/* Loading Modal */}
      <LoadingModal
        isOpen={isLoading}
        message={loadingMessage}
      />
    </div>
  );
}
