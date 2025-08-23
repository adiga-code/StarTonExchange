import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useTelegram } from "@/hooks/use-telegram";
import { useUserAvatar } from "@/hooks/use-user-avatar";
import { useToast } from "@/hooks/use-toast";
import { Users, Copy, Share, Star, Bell, Palette, Plus, Minus, Wallet, CreditCard, History, Receipt, ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import type { SnakeCaseUser, User } from "@shared/schema";

interface ProfileTabProps {
  user?: SnakeCaseUser;
  onTabChange?: (tab: 'buy' | 'earn' | 'sell' | 'profile') => void;
}

interface TransactionHistoryItem {
  id: string;
  description: string;
  amount: number;
  currency: string;
  rub_amount?: number;
  status: string;
  status_text: string;
  status_color: string;
  icon_type: string;
  created_at: string;
  created_at_formatted: string;
}

export default function ProfileTab({ user, onTabChange }: ProfileTabProps) {
  const { toast } = useToast();
  const { hapticFeedback, shareApp } = useTelegram();
  const userAvatar = useUserAvatar(user?.username);

  const { data: referralStats } = useQuery({
    queryKey: ['/api/referrals/stats'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/referrals/stats');
      return response.json();
    },
  });

  const { data: referralConfig } = useQuery({
    queryKey: ['/api/config/referral'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/config/referral');
      return response.json();
    },
  });

  // Запрос истории транзакций
  const { data: transactionsData, isLoading: transactionsLoading, error: transactionsError } = useQuery({
    queryKey: ['/api/transactions/history'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/transactions/history');
      return response.json();
    },
    refetchOnWindowFocus: false,
    refetchOnMount: true,
  });

  const getUserInitials = () => {
    if (!user) return 'JD';
    const first = user.first_name?.[0] || '';
    const last = user.last_name?.[0] || '';
    return (first + last).toUpperCase() || user.username?.[0]?.toUpperCase() || 'U';
  };

  const copyReferralLink = async () => {
    const referralLink = `${referralConfig?.bot_base_url}?start=${referralConfig?.referral_prefix}${user?.referral_code || '12345678'}`;

    try {
      await navigator.clipboard.writeText(referralLink);
      hapticFeedback('success');
      toast({
        title: "Ссылка скопирована!",
        description: "Реферальная ссылка успешно скопирована в буфер обмена",
      });
    } catch (error) {
      toast({
        title: "Ошибка",
        description: "Не удалось скопировать ссылку",
        variant: "destructive",
      });
    }
  };

  const shareReferralLink = () => {
    hapticFeedback('medium');
    shareApp(referralConfig?.default_share_text || 'Попробуй этот крутой обменник Stars и TON!');
  };

  const handleGoToBuy = () => {
    if (onTabChange) {
      hapticFeedback('light');
      onTabChange('buy');
    }
  };

  const getTransactionIcon = (iconType: string) => {
    switch (iconType) {
      case 'star':
        return <Star className="w-5 h-5 text-yellow-500" />;
      case 'ton':
        return <Receipt className="w-5 h-5 text-[#4E7FFF]" />;
      default:
        return <Receipt className="w-5 h-5 text-gray-500" />;
    }
  };

  const getStatusColor = (statusColor: string) => {
    switch (statusColor) {
      case 'green':
        return 'text-green-500';
      case 'yellow':
        return 'text-yellow-500';
      case 'red':
        return 'text-red-500';
      case 'gray':
        return 'text-gray-500';
      default:
        return 'text-gray-500';
    }
  };

  return (
    <div className="space-y-4">
      {/* User Info */}
      <motion.div
        className="bg-white dark:bg-[#1A1A1C] rounded-xl p-4 shadow-lg dark:shadow-[0_4px_20px_rgba(0,0,0,0.3)] border border-gray-200 dark:border-white/10"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <div className="flex items-center space-x-4 mb-4">
          {userAvatar?.photo_url ? (
            <img 
              src={userAvatar.photo_url} 
              alt="Avatar" 
              className="w-16 h-16 rounded-full"
            />
          ) : (
            <motion.div
              className="w-16 h-16 bg-gradient-to-br from-[#4E7FFF] to-purple-500 rounded-full flex items-center justify-center"
              whileHover={{ scale: 1.05 }}
            >
              <span className="text-lg font-bold text-white">{getUserInitials()}</span>
            </motion.div>
          )}
          <div>
            <h2 className="text-xl font-bold">
              {user?.first_name} {user?.last_name}
            </h2>
            <p className="text-gray-600 dark:text-gray-400">
              {user?.username ? `@${user.username}` : 'Пользователь'}
            </p>
            <p className="text-gray-600 dark:text-gray-400 text-sm">
              ID: {user?.telegram_id || '12345678'}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <motion.div
            className="bg-gray-50 dark:bg-[#0E0E10] rounded-lg p-3 text-center"
            whileHover={{ scale: 1.02 }}
          >
            <p className="text-2xl font-bold text-yellow-500 flex items-center justify-center">
              {user?.total_stars_earned || 0} <Star className="w-5 h-5 ml-1" />
            </p>
            <p className="text-gray-600 dark:text-gray-400 text-sm">Всего звезд</p>
          </motion.div>
          <motion.div
            className="bg-gray-50 dark:bg-[#0E0E10] rounded-lg p-3 text-center"
            whileHover={{ scale: 1.02 }}
          >
            <p className="text-2xl font-bold text-[#4E7FFF]">
              {referralStats?.totalReferrals || 0}
            </p>
            <p className="text-gray-600 dark:text-gray-400 text-sm">Рефералов</p>
          </motion.div>
        </div>
      </motion.div>

      {/* Referral System */}
      <motion.div
        className="bg-white dark:bg-[#1A1A1C] rounded-xl p-4 shadow-lg dark:shadow-[0_4px_20px_rgba(0,0,0,0.3)] border border-gray-200 dark:border-white/10"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.1 }}
      >
        <h3 className="text-lg font-semibold mb-4 flex items-center">
          <Users className="w-5 h-5 text-[#4E7FFF] mr-2" />
          Реферальная программа
        </h3>

        <div className="bg-gradient-to-r from-[#4E7FFF]/20 to-purple-500/20 rounded-lg p-4 mb-4 border border-white/10">
          <p className="font-semibold mb-2">Зарабатывайте {referralConfig?.referral_bonus_percentage || 10}% с каждой покупки!</p>
          <p className="text-gray-600 dark:text-gray-400 text-sm">
            Приглашайте друзей и получайте бонусы за их покупки
          </p>
        </div>

        <div className="space-y-3">
          <div>
            <Label className="text-gray-600 dark:text-gray-400">
              Ваша реферальная ссылка
            </Label>
            <div className="flex mt-2">
              <Input
                value={referralConfig ? `${referralConfig.bot_base_url}?start=${referralConfig.referral_prefix}${user?.referral_code || '12345678'}` : ''}
                readOnly
                className="flex-1 bg-gray-50 dark:bg-[#0E0E10]"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={copyReferralLink}
                className="ml-2"
              >
                <Copy className="w-4 h-4" />
              </Button>
            </div>
          </div>

          <Button
            onClick={shareReferralLink}
            className="w-full bg-[#4E7FFF] hover:bg-[#3D6FFF] text-white"
          >
            <Share className="w-4 h-4 mr-2" />
            Поделиться ссылкой
          </Button>
        </div>
      </motion.div>

      {/* Settings */}
      <motion.div
        className="bg-white dark:bg-[#1A1A1C] rounded-xl p-4 shadow-lg dark:shadow-[0_4px_20px_rgba(0,0,0,0.3)] border border-gray-200 dark:border-white/10"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.2 }}
      >
        <h3 className="text-lg font-semibold mb-4 flex items-center">
          <Palette className="w-5 h-5 text-purple-500 mr-2" />
          Настройки
        </h3>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Bell className="w-4 h-4 text-gray-500" />
              <Label>Уведомления</Label>
            </div>
            <Switch
              checked={user?.notifications_enabled ?? true}
              onCheckedChange={(checked) => {
                // TODO: Update user notifications preference
                hapticFeedback('light');
              }}
            />
          </div>
        </div>
      </motion.div>

      {/* Purchase History */}
      <motion.div
        className="bg-white dark:bg-[#1A1A1C] rounded-xl p-4 shadow-lg dark:shadow-[0_4px_20px_rgba(0,0,0,0.3)] border border-gray-200 dark:border-white/10"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.3 }}
      >
        <h3 className="text-lg font-semibold mb-4 flex items-center">
          <History className="w-5 h-5 text-purple-500 mr-2" />
          История покупок
        </h3>

        {transactionsLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#4E7FFF]"></div>
          </div>
        ) : transactionsError ? (
          <div className="text-center py-8">
            <p className="text-gray-500 dark:text-gray-400 mb-4">
              Ошибка загрузки истории покупок
            </p>
            <Button
              variant="outline"
              onClick={() => window.location.reload()}
              className="mx-auto"
            >
              Обновить
            </Button>
          </div>
        ) : transactionsData?.transactions && transactionsData.transactions.length > 0 ? (
          <div className="space-y-3">
            {transactionsData.transactions.map((transaction: TransactionHistoryItem) => (
              <div
                key={transaction.id}
                className="flex items-center justify-between p-3 bg-gray-50 dark:bg-[#0E0E10] rounded-lg border border-gray-200 dark:border-white/10"
              >
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-green-500/20 rounded-lg flex items-center justify-center">
                    {getTransactionIcon(transaction.icon_type)}
                  </div>
                  <div>
                    <p className="font-medium">{transaction.description}</p>
                    <p className="text-gray-600 dark:text-gray-400 text-sm">
                      {transaction.created_at_formatted}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={`font-semibold ${getStatusColor(transaction.status_color)}`}>
                    {transaction.status_text}
                  </p>
                  {transaction.rub_amount && (
                    <p className="text-gray-600 dark:text-gray-400 text-sm">
                      ₽{transaction.rub_amount.toFixed(2)}
                    </p>
                  )}
                </div>
              </div>
            ))}
            
            {transactionsData.transactions.length > 5 && (
              <div className="text-center pt-2">
                <p className="text-gray-500 dark:text-gray-400 text-sm">
                  Показаны последние {Math.min(transactionsData.transactions.length, 10)} транзакций
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-gray-100 dark:bg-[#0E0E10] rounded-full flex items-center justify-center mx-auto mb-4">
              <ShoppingCart className="w-8 h-8 text-gray-400" />
            </div>
            <h4 className="text-lg font-semibold mb-2">Покупок пока нет</h4>
            <p className="text-gray-500 dark:text-gray-400 text-sm mb-4">
              Совершите первую покупку Stars или TON
            </p>
            <Button
              onClick={handleGoToBuy}
              className="bg-[#4E7FFF] hover:bg-[#3D6FFF] text-white"
            >
              <ShoppingCart className="w-4 h-4 mr-2" />
              За покупками
            </Button>
          </div>
        )}
      </motion.div>
    </div>
  );
}