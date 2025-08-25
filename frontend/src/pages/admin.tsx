import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useTelegram } from "@/hooks/use-telegram";
import {
  Shield,
  BarChart3,
  Tag,
  History,
  Users,
  DollarSign,
  Activity,
  ArrowLeft,
  TrendingUp,
  ChevronDown,
  ChevronUp,
} from "@/components/ui/custom-icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link } from "wouter";

type AdminStats = {
  totalUsers?: number;
  todaySales?: string;
  activeReferrals?: number;
  recentTransactions?: Array<{
    id: string | number;
    username: string;
    description?: string;
    status?: "completed" | "failed" | "pending" | string;
    createdAt?: string;
  }>;
};

type CurrentSettings = {
  stars_price?: string | number;
  ton_markup_percentage?: string | number;
  ton_price_cache_minutes?: string | number;
  ton_fallback_price?: string | number;
  bot_base_url?: string;
  referral_prefix?: string;
  referral_bonus_percentage?: string | number;
  referral_registration_bonus?: string | number;
};

type TONPriceData = {
  price: string;
};

export default function AdminPage(): JSX.Element {
  const [starsPrice, setStarsPrice] = useState<string>("");
  const [tonMarkupPercentage, setTonMarkupPercentage] = useState<string>("");
  const [tonCacheMinutes, setTonCacheMinutes] = useState<string>("");
  const [tonFallbackPrice, setTonFallbackPrice] = useState<string>("");
  const [botBaseUrl, setBotBaseUrl] = useState<string>("");
  const [referralPrefix, setReferralPrefix] = useState<string>("");
  const [referralBonusPercentage, setReferralBonusPercentage] = useState<string>("");
  const [referralRegistrationBonus, setReferralRegistrationBonus] = useState<string>("");
  const [showTransactions, setShowTransactions] = useState<boolean>(false);
  
  const { toast } = useToast();
  const { hapticFeedback } = useTelegram();
  const queryClient = useQueryClient();

  const normalizeToStringNumber = (value: any, fallback: string = ""): string => {
    if (value === null || value === undefined || value === "") {
      return fallback;
    }
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (trimmed === "") return fallback;
      const num = parseFloat(trimmed.replace(",", "."));
      return Number.isFinite(num) ? trimmed : fallback;
    }
    if (typeof value === "number" && Number.isFinite(value)) {
      return String(value);
    }
    return fallback;
  };

  const parseNumberOrNaN = (s: string) => {
    if (typeof s !== "string") return NaN;
    const cleaned = s.trim().replace(",", ".");
    const n = parseFloat(cleaned);
    return Number.isFinite(n) ? n : NaN;
  };

  // Запрос текущих настроек
  const { data: currentSettings } = useQuery<CurrentSettings, Error>({
    queryKey: ["/api/admin/settings/current"],
    queryFn: async () => {
      const res = await fetch("/api/admin/settings/current", {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) throw new Error(`Failed to fetch current settings: ${res.status}`);
      return res.json();
    },
    staleTime: 1000 * 60 * 5,
  });

  // 🚀 Запрос цены TON
  const { data: tonPriceData, isLoading: isTonPriceLoading } = useQuery<TONPriceData, Error>({
    queryKey: ["/api/ton-price"],
    queryFn: async () => {
      const res = await fetch("/api/ton-price", {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) throw new Error(`Failed to fetch TON price: ${res.status}`);
      return res.json();
    },
    refetchInterval: 60000,
    staleTime: 30000,
    refetchOnWindowFocus: true,
  });

  // 🚀 Запрос реальной статистики
  const { data: adminStats, isLoading: isStatsLoading } = useQuery<AdminStats, Error>({
    queryKey: ["/api/admin/stats"],
    queryFn: async () => {
      const res = await fetch("/api/admin/stats", {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) throw new Error(`Failed to fetch admin stats: ${res.status}`);
      return res.json() as Promise<AdminStats>;
    },
    staleTime: 1000 * 30,
    refetchInterval: 60000, // Обновляем каждую минуту
  });

  useEffect(() => {
    if (!currentSettings) return;
    
    setStarsPrice(normalizeToStringNumber(currentSettings.stars_price, "1.50"));
    setTonMarkupPercentage(normalizeToStringNumber(currentSettings.ton_markup_percentage, "5.0"));
    setTonCacheMinutes(normalizeToStringNumber(currentSettings.ton_price_cache_minutes, "15"));
    setTonFallbackPrice(normalizeToStringNumber(currentSettings.ton_fallback_price, "420.0"));
    setReferralRegistrationBonus(normalizeToStringNumber(currentSettings.referral_registration_bonus, "25.0"));
    
    setBotBaseUrl(currentSettings.bot_base_url || "https://t.me/starsguru_official_bot");
    setReferralPrefix(currentSettings.referral_prefix || "ref");
    setReferralBonusPercentage(normalizeToStringNumber(currentSettings.referral_bonus_percentage, "5.0"));
  }, [currentSettings]);

  const updateSettingsMutation = useMutation({
    mutationFn: async (payload: Record<string, any>) => {
      const res = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      
      const text = await res.text().catch(() => "");
      let json;
      try {
        json = text ? JSON.parse(text) : null;
      } catch {
        json = text;
      }
      
      if (!res.ok) {
        throw new Error(`Ошибка обновления: ${res.status} ${JSON.stringify(json)}`);
      }
      
      return json;
    },
    onSuccess: (data) => {
      hapticFeedback("success");
      
      let description = "Настройки успешно обновлены";
      if (data?.ton_price_updated && data?.new_ton_price) {
        description = `Настройки обновлены. Новая цена TON: ₽${data.new_ton_price}`;
      }
      
      toast({ 
        title: "Настройки обновлены", 
        description: description
      });
      
      queryClient.invalidateQueries({ queryKey: ["/api/admin/settings/current"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      
      if (data?.ton_price_updated) {
        queryClient.invalidateQueries({ queryKey: ["/api/ton-price"] });
      }
    },
    onError: (err: any) => {
      hapticFeedback("error");
      toast({ 
        title: "Ошибка", 
        description: `Не удалось обновить настройки: ${err.message}`, 
        variant: "destructive" 
      });
    },
  });

  const handleUpdatePrices = () => {
    if (!starsPrice || !botBaseUrl || !referralPrefix || !referralBonusPercentage || 
        !tonMarkupPercentage || !referralRegistrationBonus || 
        !tonCacheMinutes || !tonFallbackPrice) {
      toast({ 
        title: "Ошибка валидации", 
        description: "Все поля должны быть заполнены", 
        variant: "destructive" 
      });
      return;
    }

    const s = parseNumberOrNaN(starsPrice);
    const rbp = parseNumberOrNaN(referralBonusPercentage);
    const tmp = parseNumberOrNaN(tonMarkupPercentage);
    const tcm = parseNumberOrNaN(tonCacheMinutes);
    const tfp = parseNumberOrNaN(tonFallbackPrice);
    const rrb = parseNumberOrNaN(referralRegistrationBonus);

    if (Number.isNaN(s) || Number.isNaN(rbp) || Number.isNaN(tmp) || 
        Number.isNaN(tcm) || Number.isNaN(tfp) || Number.isNaN(rrb)) {
      toast({ 
        title: "Ошибка валидации", 
        description: "Пожалуйста, введите корректные числовые значения.", 
        variant: "destructive" 
      });
      return;
    }
    
    if (s <= 0 || rbp < 0 || tmp < 0 || tcm <= 0 || tfp <= 0 || rrb < 0) {
      toast({ 
        title: "Ошибка валидации", 
        description: "Все значения должны быть положительными.", 
        variant: "destructive" 
      });
      return;
    }

    updateSettingsMutation.mutate({
      stars_price: starsPrice,
      ton_markup_percentage: tonMarkupPercentage,
      ton_price_cache_minutes: tonCacheMinutes,
      ton_fallback_price: tonFallbackPrice,
      referral_registration_bonus: referralRegistrationBonus,
      bot_base_url: botBaseUrl,
      referral_prefix: referralPrefix,
      referral_bonus_percentage: referralBonusPercentage,
    });
  };

  return (
    <div className="min-h-screen bg-white dark:bg-[#0E0E10] text-gray-900 dark:text-white">
      <header className="sticky top-0 z-50 bg-white/80 dark:bg-[#0E0E10]/80 backdrop-blur-lg border-b border-gray-200 dark:border-white/10">
        <div className="flex items-center justify-between p-4">
          <Link href="/">
            <Button variant="ghost" size="icon" aria-label="Back">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <h1 className="text-lg font-bold flex items-center">
            <Shield className="w-5 h-5 text-[#4E7FFF] mr-2" /> Админ панель
          </h1>
          <div style={{ width: 36 }} />
        </div>
      </header>

      <main className="p-4 space-y-6">
        {/* 🚀 УЛУЧШЕННАЯ СТАТИСТИКА */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <motion.div 
            className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 rounded-xl p-4 border border-blue-200 dark:border-blue-700"
            initial={{ opacity: 0, y: 20 }} 
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0 }}
          >
            <div className="flex items-center justify-between mb-2">
              <Users className="w-8 h-8 text-blue-500" />
              {isStatsLoading && <div className="w-4 h-4 animate-spin border-2 border-blue-500 border-t-transparent rounded-full" />}
            </div>
            <h3 className="text-2xl font-bold text-blue-600 dark:text-blue-400">
              {adminStats?.totalUsers?.toLocaleString() || 0}
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">Всего пользователей</p>
          </motion.div>

          <motion.div 
            className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 rounded-xl p-4 border border-green-200 dark:border-green-700"
            initial={{ opacity: 0, y: 20 }} 
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <div className="flex items-center justify-between mb-2">
              <DollarSign className="w-8 h-8 text-green-500" />
              <TrendingUp className="w-5 h-5 text-green-400" />
            </div>
            <h3 className="text-2xl font-bold text-green-600 dark:text-green-400">
              ₽{adminStats?.todaySales ? parseFloat(adminStats.todaySales).toLocaleString() : '0'}
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">Продаж сегодня</p>
          </motion.div>

          <motion.div 
            className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 rounded-xl p-4 border border-purple-200 dark:border-purple-700"
            initial={{ opacity: 0, y: 20 }} 
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <div className="flex items-center justify-between mb-2">
              <Activity className="w-8 h-8 text-purple-500" />
            </div>
            <h3 className="text-2xl font-bold text-purple-600 dark:text-purple-400">
              {adminStats?.activeReferrals || 0}
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">Активных рефералов</p>
          </motion.div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Price Settings */}
          <motion.div
            className="bg-gray-50 dark:bg-[#0E0E10] rounded-xl p-4"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <h3 className="font-semibold mb-3 flex items-center">
              <Tag className="w-4 h-4 text-green-500 mr-2" />
              Цены
            </h3>
            <div className="space-y-4">
              <div>
                <Label>Цена Stars (₽)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={starsPrice}
                  onChange={(e) => setStarsPrice(e.target.value)}
                  placeholder="1.50"
                />
              </div>
              <Button
                onClick={handleUpdatePrices}
                disabled={updateSettingsMutation.isPending}
                className="w-full"
              >
                {updateSettingsMutation.isPending
                  ? "Обновляется..."
                  : "Обновить настройки"}
              </Button>
            </div>
          </motion.div>

          {/* TON Dynamic Pricing */}
          <motion.div
            className="bg-gray-50 dark:bg-[#0E0E10] rounded-xl p-4"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <h3 className="font-semibold mb-3 flex items-center">
              🚀 TON ценообразование
              {updateSettingsMutation.isPending && (
                <div className="ml-2 animate-spin w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full" />
              )}
            </h3>
            
            {/* Текущая цена TON */}
            {tonPriceData?.price && (
              <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Текущая цена:</span>
                  <span className="font-bold text-lg text-blue-600">
                    {isTonPriceLoading ? (
                      <span className="animate-pulse">Обновляется...</span>
                    ) : (
                      `₽${parseFloat(tonPriceData.price).toFixed(2)}`
                    )}
                  </span>
                </div>
              </div>
            )}
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Наценка (%)</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={tonMarkupPercentage}
                  onChange={(e) => setTonMarkupPercentage(e.target.value)}
                  placeholder="5"
                />
              </div>
              <div>
                <Label>Резервная цена (₽)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={tonFallbackPrice}
                  onChange={(e) => setTonFallbackPrice(e.target.value)}
                  placeholder="420"
                />
              </div>
            </div>
          </motion.div>
        </div>

        {/* Referral Settings */}
        <motion.div
          className="bg-gray-50 dark:bg-[#0E0E10] rounded-xl p-4"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <h3 className="font-semibold mb-3 flex items-center">
            <Shield className="w-4 h-4 text-blue-500 mr-2" />
            Реферальные настройки
          </h3>
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
            <div>
              <Label>Процент с покупок (%)</Label>
              <Input
                type="number"
                step="0.1"
                value={referralBonusPercentage}
                onChange={(e) => setReferralBonusPercentage(e.target.value)}
                placeholder="5"
              />
            </div>
            <div>
              <Label>Награда за приглашение 🎁</Label>
              <Input
                type="number"
                value={referralRegistrationBonus}
                onChange={(e) => setReferralRegistrationBonus(e.target.value)}
                placeholder="25"
              />
            </div>
          </div>
        </motion.div>

        {/* 🚀 УЛУЧШЕННЫЕ ТРАНЗАКЦИИ */}
        <motion.div
          className="bg-gray-50 dark:bg-[#0E0E10] rounded-xl p-4"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
        >
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold flex items-center">
              <History className="w-4 h-4 text-[#4E7FFF] mr-2" />
              Последние транзакции
            </h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowTransactions(!showTransactions)}
              className="flex items-center gap-1"
            >
              {showTransactions ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              {showTransactions ? 'Свернуть' : 'Развернуть'}
            </Button>
          </div>
          
          <AnimatePresence>
            <motion.div 
              className="space-y-2 max-h-80 overflow-y-auto"
              initial={false}
              animate={{ height: showTransactions ? 'auto' : '200px' }}
              transition={{ duration: 0.3 }}
            >
              {adminStats?.recentTransactions?.length ? (
                adminStats.recentTransactions
                  .slice(0, showTransactions ? adminStats.recentTransactions.length : 3)
                  .map((transaction, index) => (
                    <motion.div
                      key={`${transaction.id}-${index}`}
                      className="flex justify-between items-center p-3 bg-white dark:bg-[#1A1A1C] rounded-lg border border-gray-200 dark:border-white/10"
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.1 }}
                    >
                      <div className="flex-1">
                        <p className="font-medium text-sm">{transaction.username}</p>
                        <p className="text-xs text-gray-600 dark:text-gray-400">
                          {transaction.description}
                        </p>
                      </div>
                      <div className="text-right">
                        <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
                          transaction.status === 'completed' ? 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400' : 
                          transaction.status === 'failed' ? 'bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400' : 
                          'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400'
                        }`}>
                          {transaction.status === 'completed' ? '✓' : 
                          transaction.status === 'failed' ? '✗' : '⏳'}
                        </span>
                        <p className="text-xs text-gray-500 mt-1">
                          {transaction.createdAt ? new Date(transaction.createdAt).toLocaleDateString('ru') : ''}
                        </p>
                      </div>
                    </motion.div>
                  ))
              ) : (
                <p className="text-gray-500 text-center py-8">Нет транзакций</p>
              )}
            </motion.div>
          </AnimatePresence>
        </motion.div>
      </main>
    </div>
  );
}