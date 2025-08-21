import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useTelegram } from "@/hooks/use-telegram";
import { useUserAvatar } from "@/hooks/use-user-avatar";
import { Star, Users, Copy, Share } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { SnakeCaseUser } from "@shared/schema";

interface ProfileTabProps {
  user?: SnakeCaseUser;
}

export default function ProfileTab({ user }: ProfileTabProps) {
  const { toast } = useToast();
  const { hapticFeedback, shareApp } = useTelegram();
  const userAvatar = useUserAvatar(user?.username);

  // Получаем публичные настройки для реферального процента
  const { data: publicSettings } = useQuery({
    queryKey: ['/api/settings/public'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/settings/public');
      return response.json();
    },
  });

  const { data: referralStats } = useQuery({
    queryKey: ['/api/referrals/stats'],
    enabled: !!user,
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/referrals/stats');
      return response.json();
    },
  });

  const getUserInitials = () => {
    const firstName = user?.first_name || '';
    const lastName = user?.last_name || '';
    return (firstName.charAt(0) + lastName.charAt(0)).toUpperCase() || 'U';
  };

  const copyReferralLink = async () => {
    const referralLink = `${window.location.origin}?ref=${user?.referral_code}`;
    
    try {
      await navigator.clipboard.writeText(referralLink);
      hapticFeedback('medium');
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

  // Получаем реферальный процент из настроек
  const referralPercentage = publicSettings?.referral_percentage || 10;

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
          <p className="font-semibold mb-2">Зарабатывайте {referralPercentage}% с каждой покупки!</p>
          <p className="text-gray-600 dark:text-gray-400 text-sm">
            Приглашайте друзей и получайте бонусы за их покупки
          </p>
        </div>

        <div className="space-y-3">
          <div className="bg-gray-50 dark:bg-[#0E0E10] rounded-lg p-3">
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Ваша реферальная ссылка:</p>
            <p className="font-mono text-sm break-all bg-white dark:bg-[#1A1A1C] p-2 rounded border">
              {window.location.origin}?ref={user?.referral_code || 'XXXXX'}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Button
              onClick={copyReferralLink}
              variant="outline"
              className="flex items-center space-x-2"
            >
              <Copy className="w-4 h-4" />
              <span>Копировать</span>
            </Button>
            <Button
              onClick={shareReferralLink}
              className="bg-[#4E7FFF] hover:bg-[#3D6FFF] text-white flex items-center space-x-2"
            >
              <Share className="w-4 h-4" />
              <span>Поделиться</span>
            </Button>
          </div>
        </div>

        <div className="mt-4 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-700">
          <div className="flex justify-between items-center">
            <span className="text-green-700 dark:text-green-300 font-medium">Заработано с рефералов:</span>
            <span className="text-green-700 dark:text-green-300 font-bold flex items-center">
              {user?.total_referral_earnings || 0} <Star className="w-4 h-4 ml-1" />
            </span>
          </div>
        </div>
      </motion.div>
    </div>
  );
}