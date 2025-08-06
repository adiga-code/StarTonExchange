import { useState } from "react";
import { motion } from "framer-motion";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useTelegram } from "@/hooks/use-telegram";
import { Shield, BarChart3, Tag, History, Users, DollarSign, Activity, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link } from "wouter";

export default function AdminPage() {
  const [starsPrice, setStarsPrice] = useState('2.30');
  const [tonPrice, setTonPrice] = useState('420.50');
  const [markupPercentage, setMarkupPercentage] = useState('5');
  const { toast } = useToast();
  const { hapticFeedback } = useTelegram();
  const queryClient = useQueryClient();

  const { data: adminStats } = useQuery({
    queryKey: ['/api/admin/stats'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/admin/stats');
      return response.json();
    },
  });

  const updateSettingsMutation = useMutation({
    mutationFn: async (settings: { starsPrice: string; tonPrice: string; markupPercentage: string }) => {
      const response = await apiRequest('PUT', '/api/admin/settings', settings);
      return response.json();
    },
    onSuccess: () => {
      hapticFeedback('success');
      toast({
        title: "Настройки обновлены",
        description: "Цены успешно обновлены",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/stats'] });
    },
    onError: () => {
      hapticFeedback('error');
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
    });
  };

  return (
    <div className="min-h-screen bg-white dark:bg-[#0E0E10] text-gray-900 dark:text-white">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/80 dark:bg-[#0E0E10]/80 backdrop-blur-lg border-b border-gray-200 dark:border-white/10">
        <div className="flex items-center justify-between p-4">
          <Link href="/">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <h1 className="text-lg font-bold flex items-center">
            <Shield className="w-5 h-5 text-[#4E7FFF] mr-2" />
            Админ панель
          </h1>
          <div></div>
        </div>
      </header>

      <main className="p-4 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Statistics */}
          <motion.div 
            className="bg-white dark:bg-[#1A1A1C] rounded-xl p-4 shadow-lg"
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
            className="bg-white dark:bg-[#1A1A1C] rounded-xl p-4 shadow-lg"
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
                  className="mt-1 bg-gray-50 dark:bg-[#0E0E10] border-gray-200 dark:border-white/20"
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
                  className="mt-1 bg-gray-50 dark:bg-[#0E0E10] border-gray-200 dark:border-white/20"
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
                  className="mt-1 bg-gray-50 dark:bg-[#0E0E10] border-gray-200 dark:border-white/20"
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

          {/* Recent Transactions */}
          <motion.div 
            className="bg-white dark:bg-[#1A1A1C] rounded-xl p-4 shadow-lg md:col-span-2"
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
      </main>
    </div>
  );
}