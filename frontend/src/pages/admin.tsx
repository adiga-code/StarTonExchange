import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
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
} from "@/components/ui/custom-icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link } from "wouter";

type AdminStats = {
  totalUsers?: number;
  todaySales?: number;
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
  ton_price?: string | number;
  bot_base_url?: string;
  referral_prefix?: string;
  referral_bonus_percentage?: string | number;
  referral_registration_bonus?: string | number;
};

export default function AdminPage(): JSX.Element {
  const [starsPrice, setStarsPrice] = useState<string>("");
  const [tonMarkupPercentage, setTonMarkupPercentage] = useState<string>("");
  const [tonCacheMinutes, setTonCacheMinutes] = useState<string>("");
  const [tonFallbackPrice, setTonFallbackPrice] = useState<string>("");
  const [referralRegistrationBonus, setReferralRegistrationBonus] = useState<string>("");
  const [botBaseUrl, setBotBaseUrl] = useState<string>("");
  const [referralPrefix, setReferralPrefix] = useState<string>("");
  const [referralBonusPercentage, setReferralBonusPercentage] = useState<string>("");
  const [referralRegistrationBonus, setReferralRegistrationBonus] = useState<string>("");
  const { toast } = useToast();
  const { hapticFeedback } = useTelegram();
  const queryClient = useQueryClient();

  const normalizeToStringNumber = (v: any, fallback = ""): string => {
    if (v === null || v === undefined) return fallback;
    const s = String(v).trim();
    if (!s) return fallback;
    if (s.toLowerCase() === "none") return fallback;
    const n = Number(String(s).replace(",", "."));
    return Number.isFinite(n) ? String(n) : fallback;
  };

  const parseNumberOrNaN = (s: string) => {
    if (typeof s !== "string") return NaN;
    const cleaned = s.trim().replace(",", ".");
    const n = parseFloat(cleaned);
    return Number.isFinite(n) ? n : NaN;
  };

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

  useEffect(() => {
    if (!currentSettings) return;
    setStarsPrice(normalizeToStringNumber(currentSettings.stars_price, "1.50"));
    setTonMarkupPercentage(normalizeToStringNumber(currentSettings.ton_markup_percentage, "5"));
  setTonCacheMinutes(normalizeToStringNumber(currentSettings.ton_price_cache_minutes, "15"));
  setTonFallbackPrice(normalizeToStringNumber(currentSettings.ton_fallback_price, "420"));
  setReferralRegistrationBonus(normalizeToStringNumber(currentSettings.referral_registration_bonus, "25"));
    setBotBaseUrl(currentSettings.bot_base_url || "");
    setReferralPrefix(currentSettings.referral_prefix || "");
    setReferralBonusPercentage(normalizeToStringNumber(currentSettings.referral_bonus_percentage, ""));
    setReferralRegistrationBonus(normalizeToStringNumber(currentSettings.referral_registration_bonus, "25"));
  }, [currentSettings]);

  const { data: adminStats } = useQuery<AdminStats, Error>({
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
  });

  const updateSettingsMutation = useMutation({
    mutationFn: async (payload: Record<string, any>) => {
      console.log("🔥 [mutationFn] sending payload:", payload);
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
        console.error("❌ Response (non-ok):", res.status, json);
        throw new Error(`Update failed: ${res.status} ${JSON.stringify(json)}`);
      }
      return json;
    },
    onSuccess: () => {
      hapticFeedback("success");
      toast({ title: "Настройки обновлены", description: "Цены успешно обновлены" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/settings/current"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      queryClient.refetchQueries({ queryKey: ["/api/admin/settings/current"] });
      queryClient.refetchQueries({ queryKey: ["/api/admin/stats"] });
    },
    onError: (err: any) => {
      console.error("❌ Update settings error:", err);
      hapticFeedback("error");
      toast({ title: "Ошибка", description: "Не удалось обновить настройки", variant: "destructive" });
    },
  });

  const handleUpdatePrices = () => {
    if (!starsPrice || !botBaseUrl || !referralPrefix || !referralBonusPercentage || !tonMarkupPercentage || !referralRegistrationBonus) {
      toast({ title: "Ошибка валидации", description: "Все поля должны быть заполнены", variant: "destructive" });
      return;
    }

    const s = parseNumberOrNaN(starsPrice);
    const t = parseNumberOrNaN(tonPrice);
    const rbp = parseNumberOrNaN(referralBonusPercentage);
    const rrb = parseNumberOrNaN(referralRegistrationBonus); // ← НОВОЕ

    if (Number.isNaN(s) || Number.isNaN(t) || Number.isNaN(rbp) || Number.isNaN(rrb)) {
      toast({ title: "Ошибка валидации", description: "Пожалуйста, введите корректные числовые значения.", variant: "destructive" });
      return;
    }
    
    if (s <= 0 || t <= 0 || rbp < 0 || rrb < 0) {
      toast({ title: "Ошибка валидации", description: "Цены и проценты должны быть положительными числами.", variant: "destructive" });
      return;
    }

    const payload: Record<string, string> = {
      stars_price: String(s),
      ton_markup_percentage: String(parseNumberOrNaN(tonMarkupPercentage)),
      ton_price_cache_minutes: String(parseNumberOrNaN(tonCacheMinutes)), 
      ton_fallback_price: String(parseNumberOrNaN(tonFallbackPrice)),
      referral_registration_bonus: String(parseNumberOrNaN(referralRegistrationBonus)),
      bot_base_url: botBaseUrl,
      referral_prefix: referralPrefix,
      referral_bonus_percentage: String(rbp),
      referral_registration_bonus: String(rrb), // ← НОВОЕ
    };

    updateSettingsMutation.mutate(payload);
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <motion.div className="bg-white dark:bg-[#1A1A1C] rounded-xl p-4 shadow-lg" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <h3 className="font-semibold mb-3 flex items-center"><BarChart3 className="w-4 h-4 text-green-500 mr-2" />Статистика</h3>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400 flex items-center"><Users className="w-4 h-4 mr-1" />Пользователей</span>
                <span className="font-semibold">{adminStats?.totalUsers ?? 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400 flex items-center"><DollarSign className="w-4 h-4 mr-1" />Продаж сегодня</span>
                <span className="font-semibold text-green-500">₽{adminStats?.todaySales ?? 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400 flex items-center"><Activity className="w-4 h-4 mr-1" />Активных рефералов</span>
                <span className="font-semibold">{adminStats?.activeReferrals ?? 0}</span>
              </div>
            </div>
          </motion.div>

          {/* Price Settings */}
          <motion.div
            className="bg-gray-50 dark:bg-[#0E0E10] rounded-xl p-4"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
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
            className="bg-gray-50 dark:bg-[#0E0E10] rounded-xl p-4 md:col-span-2"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <h3 className="font-semibold mb-3 flex items-center">
              🚀 Динамическое ценообразование TON
            </h3>
            <div className="grid grid-cols-3 gap-4">
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
                <Label>Обновление (мин)</Label>
                <Input
                  type="number"
                  value={tonCacheMinutes}
                  onChange={(e) => setTonCacheMinutes(e.target.value)}
                  placeholder="15"
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

          {/* Referral Settings */}
          <motion.div
            className="bg-gray-50 dark:bg-[#0E0E10] rounded-xl p-4 md:col-span-2"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
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
                <Label>Награда за приглашение (звезды) 🎁</Label>
                <Input
                  type="number"
                  value={referralRegistrationBonus}
                  onChange={(e) => setReferralRegistrationBonus(e.target.value)}
                  placeholder="25"
                />
              </div>
            </div>
          </motion.div>

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
                adminStats.recentTransactions.map((transaction, index) => (
                  <div
                    key={`${transaction.id}-${index}`}
                    className="flex justify-between items-center p-2 bg-white dark:bg-[#1A1A1C] rounded-lg"
                  >
                    <div>
                      <p className="font-medium">{transaction.username || 'Неизвестный'}</p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {transaction.description || 'Транзакция'}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className={`text-sm font-semibold ${
                        transaction.status === 'completed' ? 'text-green-500' : 
                        transaction.status === 'failed' ? 'text-red-500' : 'text-yellow-500'
                      }`}>
                        {transaction.status === 'completed' ? 'Завершено' : 
                        transaction.status === 'failed' ? 'Не удалось' : 'В процессе'}
                      </p>
                      <p className="text-xs text-gray-500">
                        {transaction.createdAt ? new Date(transaction.createdAt).toLocaleDateString() : ''}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-gray-500 text-center py-4">Нет последних транзакций</p>
              )}
            </div>
          </motion.div>
        </div>
      </main>
    </div>
  );}