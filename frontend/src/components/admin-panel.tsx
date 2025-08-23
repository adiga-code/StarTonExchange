import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Shield, X, BarChart3, Tag, History, Users, DollarSign, Activity } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface AdminPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function AdminPanel({ isOpen, onClose }: AdminPanelProps) {
  const [starsPrice, setStarsPrice] = useState('');
  const [tonPrice, setTonPrice] = useState('');
  const [markupPercentage, setMarkupPercentage] = useState('');
  const [botBaseUrl, setBotBaseUrl] = useState('');
  const [referralPrefix, setReferralPrefix] = useState('');
  const [referralBonusPercentage, setReferralBonusPercentage] = useState('');
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: adminStats } = useQuery({
    queryKey: ['/api/admin/stats'],
    enabled: isOpen,
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/admin/stats');
      return response.json();
    },
  });
  const { data: currentSettings } = useQuery({
    queryKey: ['/api/admin/settings/current'],
    enabled: isOpen,
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/admin/settings/current');
      return response.json();
    },
  });

  useEffect(() => {
    if (currentSettings) {
      setStarsPrice(currentSettings.stars_price);
      setTonPrice(currentSettings.ton_price);
      setMarkupPercentage(currentSettings.markup_percentage);
      setBotBaseUrl(currentSettings.bot_base_url);
      setReferralPrefix(currentSettings.referral_prefix);
      setReferralBonusPercentage(currentSettings.referral_bonus_percentage);
    }
  }, [currentSettings]);

  const updateSettingsMutation = useMutation({
    mutationFn: async (settings: { 
      starsPrice: string; 
      tonPrice: string; 
      markupPercentage: string;
      botBaseUrl: string;
      referralPrefix: string;
      referralBonusPercentage: string;
    }) => {
      const response = await apiRequest('PUT', '/api/admin/settings', {
        stars_price: settings.starsPrice,
        ton_price: settings.tonPrice,
        markup_percentage: settings.markupPercentage,
        bot_base_url: settings.botBaseUrl,
        referral_prefix: settings.referralPrefix,
        referral_bonus_percentage: settings.referralBonusPercentage
      });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Настройки обновлены",
        description: "Цены успешно обновлены",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/stats'] });
    },
    onError: () => {
      toast({
        title: "Ошибка",
        description: "Не удалось обновить настройки",
        variant: "destructive",
      });
    },
  });

  const handleUpdatePrices = () => {
  updateSettingsMutation.mutate({
    starsPrice,
    tonPrice,
    markupPercentage,
    botBaseUrl,
    referralPrefix,
    referralBonusPercentage,
  });
};

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50">
          <motion.div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            className="absolute bottom-0 left-0 right-0 bg-white dark:bg-[#1A1A1C] rounded-t-2xl p-6 max-h-[80vh] overflow-y-auto shadow-2xl"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 500 }}
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold flex items-center">
                <Shield className="w-5 h-5 text-[#4E7FFF] mr-2" />
                Админ панель
              </h2>
              <Button
                onClick={onClose}
                variant="ghost"
                size="icon"
                className="hover:bg-gray-100 dark:hover:bg-white/10"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Statistics */}
              <motion.div 
                className="bg-gray-50 dark:bg-[#0E0E10] rounded-xl p-4"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
              >
                <h3 className="font-semibold mb-3 flex items-center">
                  <BarChart3 className="w-4 h-4 text-green-500 mr-2" />
                  Статистика
                </h3>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400 flex items-center">
                      <Users className="w-4 h-4 mr-1" />
                      Пользователей
                    </span>
                    <span className="font-semibold">{adminStats?.totalUsers || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400 flex items-center">
                      <DollarSign className="w-4 h-4 mr-1" />
                      Продаж сегодня
                    </span>
                    <span className="font-semibold text-green-500">
                      ₽{adminStats?.todaySales || 0}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400 flex items-center">
                      <Activity className="w-4 h-4 mr-1" />
                      Активных рефералов
                    </span>
                    <span className="font-semibold">{adminStats?.activeReferrals || 0}</span>
                  </div>
                </div>
              </motion.div>

              {/* Price Management */}
              <motion.div 
                className="bg-gray-50 dark:bg-[#0E0E10] rounded-xl p-4"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
              >
                <h3 className="font-semibold mb-3 flex items-center">
                  <Tag className="w-4 h-4 text-yellow-500 mr-2" />
                  Управление ценами
                </h3>
                <div className="space-y-3">
                  <div>
                    <Label className="text-sm text-gray-600 dark:text-gray-400">
                      Цена за звезду (₽)
                    </Label>
                    <Input
                      type="number"
                      value={starsPrice}
                      onChange={(e) => setStarsPrice(e.target.value)}
                      step="0.01"
                      className="mt-1 bg-white dark:bg-[#1A1A1C] border-gray-200 dark:border-white/20"
                    />
                  </div>
                  <div>
                    <Label className="text-sm text-gray-600 dark:text-gray-400">
                      Цена за TON (₽)
                    </Label>
                    <Input
                      type="number"
                      value={tonPrice}
                      onChange={(e) => setTonPrice(e.target.value)}
                      step="0.01"
                      className="mt-1 bg-white dark:bg-[#1A1A1C] border-gray-200 dark:border-white/20"
                    />
                  </div>
                  <div>
                    <Label className="text-sm text-gray-600 dark:text-gray-400">
                      Наценка (%)
                    </Label>
                    <Input
                      type="number"
                      value={markupPercentage}
                      onChange={(e) => setMarkupPercentage(e.target.value)}
                      step="0.1"
                      className="mt-1 bg-white dark:bg-[#1A1A1C] border-gray-200 dark:border-white/20"
                    />
                  </div>
                  <Button
                    onClick={handleUpdatePrices}
                    disabled={updateSettingsMutation.isPending}
                    className="w-full bg-[#4E7FFF] hover:bg-[#3D6FFF] text-white"
                  >
                    {updateSettingsMutation.isPending ? 'Обновляется...' : 'Обновить цены'}
                  </Button>
                </div>
              </motion.div>
              {/* Новые поля для реферальной системы */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>URL бота</Label>
                  <Input
                    value={botBaseUrl}
                    onChange={(e) => setBotBaseUrl(e.target.value)}
                    placeholder="https://t.me/bot_name"
                  />
                </div>
                <div>
                  <Label>Префикс реферальных ссылок</Label>
                  <Input
                    value={referralPrefix}
                    onChange={(e) => setReferralPrefix(e.target.value)}
                    placeholder="ref"
                  />
                </div>
              </div>
              <div>
                <Label>Процент реферального бонуса (%)</Label>
                <Input
                  type="number"
                  value={referralBonusPercentage}
                  onChange={(e) => setReferralBonusPercentage(e.target.value)}
                  placeholder="10"
                />
              </div>
              {/* Recent Transactions */}
              <motion.div 
                className="bg-gray-50 dark:bg-[#0E0E10] rounded-xl p-4 md:col-span-2"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
              >
                <h3 className="font-semibold mb-3 flex items-center">
                  <History className="w-4 h-4 text-[#4E7FFF] mr-2" />
                  Последние транзакции
                </h3>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {adminStats?.recentTransactions?.length ? (
                    adminStats.recentTransactions.map((transaction: any) => (
                      <div
                        key={transaction.id}
                        className="flex items-center justify-between py-2 border-b border-gray-200 dark:border-white/10 last:border-b-0"
                      >
                        <div>
                          <p className="font-medium">{transaction.username}</p>
                          <p className="text-gray-600 dark:text-gray-400 text-sm">
                            {transaction.description}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className={`font-medium ${
                            transaction.status === 'completed' 
                              ? 'text-green-500' 
                              : transaction.status === 'failed'
                              ? 'text-red-500'
                              : 'text-yellow-500'
                          }`}>
                            {transaction.status === 'completed' ? 'Успешно' : 
                             transaction.status === 'failed' ? 'Ошибка' : 'В обработке'}
                          </p>
                          <p className="text-gray-600 dark:text-gray-400 text-xs">
                            {new Date(transaction.createdAt).toLocaleTimeString('ru-RU', { 
                              hour: '2-digit', 
                              minute: '2-digit' 
                            })}
                          </p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-gray-500 dark:text-gray-400 text-center py-4">
                      Транзакций пока нет
                    </p>
                  )}
                </div>
              </motion.div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
