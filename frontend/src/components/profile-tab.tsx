import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useTelegram } from "@/hooks/use-telegram";
import { useUserAvatar } from "@/hooks/use-user-avatar";
import { useToast } from "@/hooks/use-toast";
import { Users, Copy, Share, Star, Bell, Palette, Plus, Minus, Wallet, CreditCard, History, Receipt } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import type { SnakeCaseUser, User } from "@shared/schema";


interface ProfileTabProps {
  user?: SnakeCaseUser;
}

export default function ProfileTab({ user }: ProfileTabProps) {
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

  const getUserInitials = () => {
    if (!user) return 'JD';
    const first = user.first_name?.[0] || '';
    const last = user.last_name?.[0] || '';
    return (first + last).toUpperCase() || user.username?.[0]?.toUpperCase() || 'U';
  };

  const copyReferralLink = async () => {
    const referralLink = `https://t.me/starsexchange_bot?start=ref${user?.referral_code || '12345678'}`;

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
    shareApp('Попробуй этот крутой обменник Stars и TON! 🚀');
  };
  console.log("user", user)
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
              className="w-16 h-16 rounded-full object-cover"
            />
          ) : (
            <motion.div
              className="w-16 h-16 bg-gradient-to-br from-[#4E7FFF] to-purple-500 rounded-full flex items-center justify-center"
              whileHover={{ scale: 1.05 }}
            >
              <span className="text-xl font-bold text-white">{getUserInitials()}</span>
            </motion.div>
          )}
          <div>
            <h3 className="text-xl font-bold">
              {user?.first_name} {user?.last_name}
            </h3>
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
          <p className="font-semibold mb-2">Зарабатывайте 10% с каждой покупки!</p>
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
                value={`https://t.me/starsexchange_bot?start=ref${user?.referral_code || '12345678'}`}
                readOnly
                className="flex-1 bg-gray-50 dark:bg-[#0E0E10] border-gray-200 dark:border-white/20 text-sm text-gray-600 dark:text-gray-400"
              />
              <Button
                onClick={copyReferralLink}
                variant="outline"
                size="icon"
                className="ml-2 border-gray-200 dark:border-white/20 hover:bg-[#4E7FFF] hover:text-white"
              >
                <Copy className="w-4 h-4" />
              </Button>
            </div>
          </div>

          <Button
            onClick={shareReferralLink}
            className="w-full bg-gradient-to-r from-[#4E7FFF] to-purple-500 text-white font-semibold py-3 rounded-lg glow-button"
          >
            <Share className="w-4 h-4 mr-2" />
            Поделиться ссылкой
          </Button>
        </div>

        {/* Referral Stats */}
        <div className="mt-4 space-y-3">
          <h4 className="font-semibold">Статистика рефералов</h4>
          <div className="space-y-2">
            <div className="flex justify-between items-center py-2 border-b border-gray-200 dark:border-white/10 last:border-b-0">
              <span className="text-gray-600 dark:text-gray-400">За все время</span>
              <span className="font-semibold text-yellow-500 flex items-center">
                +{referralStats?.totalEarnings || 0} <Star className="w-4 h-4 ml-1" />
              </span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-gray-200 dark:border-white/10 last:border-b-0">
              <span className="text-gray-600 dark:text-gray-400">Активных рефералов</span>
              <span className="font-semibold text-[#4E7FFF]">
                {referralStats?.totalReferrals || 0}
              </span>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Wallet Management */}
      <motion.div
        className="bg-white dark:bg-[#1A1A1C] rounded-xl p-4 shadow-lg dark:shadow-[0_4px_20px_rgba(0,0,0,0.3)] border border-gray-200 dark:border-white/10"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.2 }}
      >
        <h3 className="text-lg font-semibold mb-4 flex items-center">
          <Wallet className="w-5 h-5 text-[#4E7FFF] mr-2" />
          Управление балансом
        </h3>

        <div className="grid grid-cols-2 gap-3 mb-4">
          <Button
            onClick={() => hapticFeedback('light')}
            className="bg-green-500 hover:bg-green-600 text-white py-3 rounded-lg flex items-center justify-center space-x-2"
          >
            <Plus className="w-4 h-4" />
            <span>Пополнить</span>
          </Button>
          <Button
            onClick={() => hapticFeedback('light')}
            variant="outline"
            className="border-red-500 text-red-500 hover:bg-red-50 dark:hover:bg-red-950 py-3 rounded-lg flex items-center justify-center space-x-2"
          >
            <Minus className="w-4 h-4" />
            <span>Вывести</span>
          </Button>
        </div>

        <div className="bg-gradient-to-r from-blue-500/20 to-purple-500/20 rounded-lg p-4 border border-white/10">
          <div className="flex items-center space-x-2 mb-2">
            <CreditCard className="w-4 h-4 text-[#4E7FFF]" />
            <span className="font-semibold">Связанный кошелек</span>
          </div>
          <p className="text-gray-600 dark:text-gray-400 text-sm">
            TON покупки автоматически отправляются в ваш Telegram кошелек
          </p>
          <div className="mt-2 text-xs text-gray-500 dark:text-gray-500">
            ID: {user?.telegram_id || '123456789'}
          </div>
        </div>
      </motion.div>

      {/* Transaction History */}
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

        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-[#0E0E10] rounded-lg border border-gray-200 dark:border-white/10">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-green-500/20 rounded-lg flex items-center justify-center">
                <Star className="w-5 h-5 text-yellow-500" />
              </div>
              <div>
                <p className="font-medium">Покупка 100 звезд</p>
                <p className="text-gray-600 dark:text-gray-400 text-sm">15 янв 2025, 14:30</p>
              </div>
            </div>
            <div className="text-right">
              <p className="font-semibold text-green-500">Успешно</p>
              <p className="text-gray-600 dark:text-gray-400 text-sm">₽241.50</p>
            </div>
          </div>

          <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-[#0E0E10] rounded-lg border border-gray-200 dark:border-white/10">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center">
                <Receipt className="w-5 h-5 text-[#4E7FFF]" />
              </div>
              <div>
                <p className="font-medium">Покупка 0.5 TON</p>
                <p className="text-gray-600 dark:text-gray-400 text-sm">14 янв 2025, 10:15</p>
              </div>
            </div>
            <div className="text-right">
              <p className="font-semibold text-green-500">Успешно</p>
              <p className="text-gray-600 dark:text-gray-400 text-sm">₽220.76</p>
            </div>
          </div>

          <Button
            onClick={() => hapticFeedback('light')}
            variant="outline"
            className="w-full mt-3 border-gray-200 dark:border-white/20 hover:bg-gray-50 dark:hover:bg-white/5"
          >
            <History className="w-4 h-4 mr-2" />
            Показать всю историю
          </Button>
        </div>
      </motion.div>

      {/* Settings */}
      <motion.div
        className="bg-white dark:bg-[#1A1A1C] rounded-xl p-4 shadow-lg dark:shadow-[0_4px_20px_rgba(0,0,0,0.3)] border border-gray-200 dark:border-white/10"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.3 }}
      >
        <h3 className="text-lg font-semibold mb-4 flex items-center">
          <Palette className="w-5 h-5 text-gray-500 mr-2" />
          Настройки
        </h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Bell className="w-4 h-4 text-gray-500" />
              <span>Уведомления</span>
            </div>
            <Switch defaultChecked />
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Palette className="w-4 h-4 text-gray-500" />
              <span>Темная тема</span>
            </div>
            <Switch defaultChecked />
          </div>
        </div>
      </motion.div>
    </div>
  );
}