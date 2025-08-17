// frontend/src/components/profile-tab.tsx (обновленная версия)
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useTelegram } from "@/hooks/use-telegram";
import { useToast } from "@/hooks/use-toast";
import { Users, Copy, Share, Star, Bell, Palette, Plus, Minus, Wallet, CreditCard, History, Receipt } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import type { SnakeCaseUser, User } from "@shared/schema";

interface AvatarData {
  photo_url: string;
  first_name: string;
}

interface ProfileTabProps {
  user?: SnakeCaseUser;
  userAvatar?: AvatarData | null; // ← НОВЫЙ ПРОПС для предзагруженной аватарки
}

export default function ProfileTab({ user, userAvatar }: ProfileTabProps) {
  const { toast } = useToast();
  const { hapticFeedback, shareApp } = useTelegram();

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

  console.log("user", user);
  console.log("userAvatar", userAvatar);

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
          {/* ← ИЗМЕНЕННОЕ: Используем предзагруженную аватарку с анимацией */}
          {userAvatar?.photo_url ? (
            <motion.img 
              src={userAvatar.photo_url} 
              alt="Avatar" 
              className="w-16 h-16 rounded-full object-cover"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3 }}
              whileHover={{ scale: 1.05 }}
            />
          ) : (
            <motion.div
              className="w-16 h-16 bg-gradient-to-br from-[#4E7FFF] to-purple-500 rounded-full flex items-center justify-center"
              whileHover={{ scale: 1.05 }}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3 }}
            >
              <span className="text-xl font-bold text-white">{getUserInitials()}</span>
            </motion.div>
          )}
          <div>
            <h3 className="text-xl font-bold">
              {user?.first_name} {user?.last_name}
            </h3>
            <p className="text-gray-600 dark:text-gray-400">
              {user?.username ? `@${user.username}` : 'No username'}
            </p>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-4">
          <div className="text-center p-3 bg-gray-50 dark:bg-[#0E0E10] rounded-lg">
            <p className="text-2xl font-bold text-[#4E7FFF]">{user?.stars_balance || 0}</p>
            <p className="text-sm text-gray-600 dark:text-gray-400">Stars</p>
          </div>
          <div className="text-center p-3 bg-gray-50 dark:bg-[#0E0E10] rounded-lg">
            <p className="text-2xl font-bold text-[#4E7FFF]">{user?.ton_balance || '0.00'}</p>
            <p className="text-sm text-gray-600 dark:text-gray-400">TON</p>
          </div>
        </div>
      </motion.div>

      {/* Referral Section */}
      <motion.div
        className="bg-white dark:bg-[#1A1A1C] rounded-xl p-4 shadow-lg border border-gray-200 dark:border-white/10"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.1 }}
      >
        <div className="flex items-center space-x-3 mb-4">
          <Users className="w-6 h-6 text-[#4E7FFF]" />
          <h3 className="text-lg font-semibold">Рефералы</h3>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="text-center p-3 bg-gray-50 dark:bg-[#0E0E10] rounded-lg">
            <p className="text-xl font-bold">{referralStats?.total_referrals || 0}</p>
            <p className="text-sm text-gray-600 dark:text-gray-400">Приглашено</p>
          </div>
          <div className="text-center p-3 bg-gray-50 dark:bg-[#0E0E10] rounded-lg">
            <p className="text-xl font-bold">{referralStats?.total_earnings || 0}</p>
            <p className="text-sm text-gray-600 dark:text-gray-400">Заработано</p>
          </div>
        </div>

        <div className="space-y-2">
          <Button
            onClick={copyReferralLink}
            className="w-full bg-[#4E7FFF] hover:bg-blue-600 text-white"
          >
            <Copy className="w-4 h-4 mr-2" />
            Скопировать ссылку
          </Button>
          <Button
            onClick={shareReferralLink}
            variant="outline"
            className="w-full"
          >
            <Share className="w-4 h-4 mr-2" />
            Поделиться
          </Button>
        </div>
      </motion.div>

      {/* Settings Section */}
      <motion.div
        className="bg-white dark:bg-[#1A1A1C] rounded-xl p-4 shadow-lg border border-gray-200 dark:border-white/10"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.2 }}
      >
        <div className="flex items-center space-x-3 mb-4">
          <Bell className="w-6 h-6 text-[#4E7FFF]" />
          <h3 className="text-lg font-semibold">Настройки</h3>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-base">Уведомления</Label>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Получать уведомления о новых заданиях
              </p>
            </div>
            <Switch
              checked={user?.notifications_enabled || false}
              // onCheckedChange={handleNotificationToggle}
            />
          </div>
        </div>
      </motion.div>

      {/* Statistics */}
      <motion.div
        className="bg-white dark:bg-[#1A1A1C] rounded-xl p-4 shadow-lg border border-gray-200 dark:border-white/10"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.3 }}
      >
        <h3 className="text-lg font-semibold mb-4">Статистика</h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="text-center p-3 bg-gray-50 dark:bg-[#0E0E10] rounded-lg">
            <p className="text-xl font-bold">{user?.tasks_completed || 0}</p>
            <p className="text-sm text-gray-600 dark:text-gray-400">Заданий выполнено</p>
          </div>
          <div className="text-center p-3 bg-gray-50 dark:bg-[#0E0E10] rounded-lg">
            <p className="text-xl font-bold">{user?.total_stars_earned || 0}</p>
            <p className="text-sm text-gray-600 dark:text-gray-400">Всего Stars заработано</p>
          </div>
        </div>
        
        <div className="mt-4 p-3 bg-gradient-to-r from-[#4E7FFF]/10 to-purple-500/10 rounded-lg border border-[#4E7FFF]/20">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Ежедневный бонус</span>
            <span className="flex items-center">
              +{user?.daily_earnings || 0} <Star className="w-4 h-4 ml-1" />
            </span>
          </div>
        </div>
      </motion.div>
    </div>
  );
}