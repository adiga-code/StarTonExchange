import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Shield, Star, Bitcoin, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface AdminPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function AdminPanel({ isOpen, onClose }: AdminPanelProps) {
  // Stars settings
  const [starsPrice, setStarsPrice] = useState('2.30');
  const [savingsPercentage, setSavingsPercentage] = useState(0);
  
  // TON settings
  const [tonPrice, setTonPrice] = useState('420.50');
  const [tonMarkupPercentage, setTonMarkupPercentage] = useState('5');
  
  // Referral settings
  const [referralPercentage, setReferralPercentage] = useState('10');
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Получаем текущие настройки
  const { data: adminStats } = useQuery({
    queryKey: ['/api/admin/stats'],
    enabled: isOpen,
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/admin/stats');
      return response.json();
    },
  });

  // Расчет экономии для звезд
  useEffect(() => {
    const officialPrice = 180;
    const currentPrice = parseFloat(starsPrice);
    if (currentPrice > 0) {
      const savings = Math.round(((officialPrice - currentPrice) / officialPrice) * 100);
      setSavingsPercentage(Math.max(0, savings));
    }
  }, [starsPrice]);

  const updateSettingsMutation = useMutation({
    mutationFn: async (settings: any) => {
      const response = await apiRequest('PUT', '/api/admin/settings', settings);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Настройки обновлены",
        description: "Изменения сохранены",
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

  const handleUpdateSettings = () => {
    updateSettingsMutation.mutate({
      starsPrice,
      tonPrice,
      tonMarkupPercentage,
      referralPercentage,
    });
  };

  if (!isOpen) return null;

  return (
    <motion.div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        className="bg-white dark:bg-[#1A1A1C] rounded-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto"
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold flex items-center">
            <Shield className="w-5 h-5 text-[#4E7FFF] mr-2" />
            Админ панель
          </h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            ×
          </Button>
        </div>

        <div className="space-y-6">
          {/* Настройки Telegram Stars */}
          <motion.div 
            className="bg-gradient-to-r from-yellow-50 to-yellow-100 dark:from-yellow-900/20 dark:to-yellow-800/20 rounded-xl p-4 border border-yellow-200 dark:border-yellow-700"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <h3 className="font-semibold mb-3 flex items-center">
              <Star className="w-4 h-4 text-yellow-500 mr-2" />
              Настройки Telegram Stars
            </h3>
            <div className="space-y-3">
              <div>
                <Label className="text-sm">Ваша цена за звезду (₽)</Label>
                <Input
                  type="number"
                  value={starsPrice}
                  onChange={(e) => setStarsPrice(e.target.value)}
                  step="0.01"
                  className="mt-1"
                />
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="bg-white/50 dark:bg-black/20 rounded-lg p-3">
                  <div className="text-gray-600 dark:text-gray-400">Официальная цена</div>
                  <div className="font-semibold">180 ₽</div>
                </div>
                <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3">
                  <div className="text-gray-600 dark:text-gray-400">Экономия клиентов</div>
                  <div className="font-semibold text-green-600">{savingsPercentage}%</div>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Настройки TON */}
          <motion.div 
            className="bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 rounded-xl p-4 border border-blue-200 dark:border-blue-700"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <h3 className="font-semibold mb-3 flex items-center">
              <Bitcoin className="w-4 h-4 text-blue-500 mr-2" />
              Настройки TON Coin
            </h3>
            <div className="space-y-3">
              <div>
                <Label className="text-sm">Цена за TON (₽)</Label>
                <Input
                  type="number"
                  value={tonPrice}
                  onChange={(e) => setTonPrice(e.target.value)}
                  step="0.01"
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-sm">Наценка (%)</Label>
                <Input
                  type="number"
                  value={tonMarkupPercentage}
                  onChange={(e) => setTonMarkupPercentage(e.target.value)}
                  step="0.1"
                  className="mt-1"
                />
              </div>
            </div>
          </motion.div>

          {/* Реферальная система */}
          <motion.div 
            className="bg-gradient-to-r from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 rounded-xl p-4 border border-purple-200 dark:border-purple-700"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <h3 className="font-semibold mb-3 flex items-center">
              <Users className="w-4 h-4 text-purple-500 mr-2" />
              Реферальная система
            </h3>
            <div>
              <Label className="text-sm">Процент с покупок (%)</Label>
              <Input
                type="number"
                value={referralPercentage}
                onChange={(e) => setReferralPercentage(e.target.value)}
                step="1"
                className="mt-1"
              />
            </div>
          </motion.div>

          {/* Кнопка сохранения */}
          <Button
            onClick={handleUpdateSettings}
            disabled={updateSettingsMutation.isPending}
            className="w-full bg-[#4E7FFF] hover:bg-[#3D6FFF] text-white py-3"
            size="lg"
          >
            {updateSettingsMutation.isPending ? 'Сохраняется...' : 'Сохранить изменения'}
          </Button>
        </div>
      </motion.div>
    </motion.div>
  );
}