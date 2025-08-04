import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useTelegram } from "@/hooks/use-telegram";
import { useTheme } from "@/hooks/use-theme";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import BalanceCard from "./balance-card";
import BuyTab from "./buy-tab";
import TasksTab from "./tasks-tab";
import ProfileTab from "./profile-tab";
import AdminPanel from "./admin-panel";
import LoadingModal from "./loading-modal";
import { Star, Moon, Sun, User, ShoppingCart, CheckSquare, Shield } from "lucide-react";

type TabType = 'buy' | 'tasks' | 'profile';

export default function TelegramApp() {
  const [currentTab, setCurrentTab] = useState<TabType>('buy');
  const [showAdminPanel, setShowAdminPanel] = useState(false);
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
  const { data: currentUser, isLoading: userLoading } = useQuery({
    queryKey: ['/api/users/me'],
    enabled: !!user,
  });

  useEffect(() => {
    if (user && !currentUser && !userLoading) {
      createUserMutation.mutate({
        telegramId: user.id.toString(),
        username: user.username || null,
        firstName: user.first_name,
        lastName: user.last_name || null,
      });
    }
  }, [user, currentUser, userLoading]);

  const handleTabChange = (tab: TabType) => {
    hapticFeedback('light');
    setCurrentTab(tab);
  };

  const handleAdminPanelToggle = () => {
    hapticFeedback('medium');
    setShowAdminPanel(!showAdminPanel);
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
            <motion.div 
              className="w-8 h-8 bg-gradient-to-br from-[#4E7FFF] to-purple-500 rounded-full flex items-center justify-center cursor-pointer"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <span className="text-xs font-bold text-white">{getUserInitials()}</span>
            </motion.div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="pb-20">
        <BalanceCard user={currentUser} />

        {/* Navigation Tabs */}
        <div className="px-4 mb-6">
          <div className="flex bg-gray-100 dark:bg-[#1A1A1C] rounded-xl p-1 shadow-lg dark:shadow-[0_4px_20px_rgba(0,0,0,0.3)]">
            {[
              { id: 'buy', icon: ShoppingCart, label: 'Купить' },
              { id: 'tasks', icon: CheckSquare, label: 'Задания' },
              { id: 'profile', icon: User, label: 'Профиль' },
            ].map((tab) => (
              <motion.button
                key={tab.id}
                onClick={() => handleTabChange(tab.id as TabType)}
                className={`flex-1 py-3 px-4 rounded-lg text-sm font-medium transition-all flex items-center justify-center space-x-2 ${
                  currentTab === tab.id
                    ? 'bg-[#4E7FFF] text-white shadow-lg'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                }`}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <tab.icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </motion.button>
            ))}
          </div>
        </div>

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
            {currentTab === 'tasks' && <TasksTab user={currentUser} />}
            {currentTab === 'profile' && <ProfileTab user={currentUser} />}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white/80 dark:bg-[#1A1A1C]/80 backdrop-blur-lg border-t border-gray-200 dark:border-white/10">
        <div className="flex items-center justify-around py-2">
          {[
            { id: 'buy', icon: ShoppingCart, label: 'Купить' },
            { id: 'tasks', icon: CheckSquare, label: 'Задания' },
            { id: 'profile', icon: User, label: 'Профиль' },
          ].map((tab) => (
            <motion.button
              key={tab.id}
              onClick={() => handleTabChange(tab.id as TabType)}
              className={`flex flex-col items-center py-2 px-4 transition-colors ${
                currentTab === tab.id 
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
          <motion.button
            onClick={handleAdminPanelToggle}
            className="flex flex-col items-center py-2 px-4 transition-colors text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <Shield className="w-5 h-5 mb-1" />
            <span className="text-xs">Admin</span>
          </motion.button>
        </div>
      </nav>

      {/* Admin Panel */}
      <AdminPanel 
        isOpen={showAdminPanel} 
        onClose={() => setShowAdminPanel(false)} 
      />

      {/* Loading Modal */}
      <LoadingModal 
        isOpen={isLoading} 
        message={loadingMessage} 
      />
    </div>
  );
}
