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
};

export default function AdminPage(): JSX.Element {
  const [starsPrice, setStarsPrice] = useState<string>("");
  const [tonPrice, setTonPrice] = useState<string>("");
  const [botBaseUrl, setBotBaseUrl] = useState<string>("");
  const [referralPrefix, setReferralPrefix] = useState<string>("");
  const [referralBonusPercentage, setReferralBonusPercentage] = useState<string>("");

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
    setTonPrice(normalizeToStringNumber(currentSettings.ton_price, "420.50"));
    setBotBaseUrl(currentSettings.bot_base_url || "");
    setReferralPrefix(currentSettings.referral_prefix || "");
    setReferralBonusPercentage(normalizeToStringNumber(currentSettings.referral_bonus_percentage, ""));
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
    if (!starsPrice || !tonPrice || !botBaseUrl || !referralPrefix || !referralBonusPercentage) {
      toast({ title: "Ошибка валидации", description: "Все поля должны быть заполнены", variant: "destructive" });
      return;
    }

    const s = parseNumberOrNaN(starsPrice);
    const t = parseNumberOrNaN(tonPrice);
    const rbp = parseNumberOrNaN(referralBonusPercentage);

    if (Number.isNaN(s) || Number.isNaN(t) || Number.isNaN(rbp)) {
      toast({ title: "Ошибка валидации", description: "Пожалуйста, введите корректные числовые значения.", variant: "destructive" });
      return;
    }
    if (s <= 0 || t <= 0 || rbp < 0) {
      toast({ title: "Ошибка валидации", description: "Цены и проценты должны быть положительными числами.", variant: "destructive" });
      return;
    }

    const payload: Record<string, string> = {
      stars_price: String(s),
      ton_price: String(t),
      bot_base_url: botBaseUrl,
      referral_prefix: referralPrefix,
      referral_bonus_percentage: String(rbp),
    };

    console.log("🔥 Frontend prepared payload (string values):", payload, "stringified:", JSON.stringify(payload));
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

          <motion.div className="bg-white dark:bg-[#1A1A1C] rounded-xl p-4 shadow-lg" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <h3 className="font-semibold mb-3 flex items-center"><Tag className="w-4 h-4 text-yellow-500 mr-2" />Управление ценами</h3>
            <div className="space-y-3">
              <div>
                <Label className="text-sm text-gray-600 dark:text-gray-400">Цена за звезду (₽)</Label>
                <Input type="text" value={starsPrice} onChange={(e) => setStarsPrice(e.target.value)} placeholder="1.50" className="mt-1 bg-gray-50 dark:bg-[#0E0E10]" />
              </div>
              <div>
                <Label className="text-sm text-gray-600 dark:text-gray-400">Цена за TON (₽)</Label>
                <Input type="text" value={tonPrice} onChange={(e) => setTonPrice(e.target.value)} placeholder="420.50" className="mt-1 bg-gray-50 dark:bg-[#0E0E10]" />
              </div>
            </div>
          </motion.div>

          <motion.div className="bg-white dark:bg-[#1A1A1C] rounded-xl p-4 shadow-lg md:col-span-2" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <h3 className="font-semibold mb-3 flex items-center"><Tag className="w-4 h-4 text-blue-500 mr-2" />Реферальные настройки</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm text-gray-600 dark:text-gray-400">URL бота</Label>
                <Input type="text" value={botBaseUrl} onChange={(e) => setBotBaseUrl(e.target.value)} placeholder="https://t.me/bot_name" className="mt-1 bg-gray-50 dark:bg-[#0E0E10]" />
              </div>
              <div>
                <Label className="text-sm text-gray-600 dark:text-gray-400">Префикс рефералки</Label>
                <Input type="text" value={referralPrefix} onChange={(e) => setReferralPrefix(e.target.value)} placeholder="startapp" className="mt-1 bg-gray-50 dark:bg-[#0E0E10]" />
              </div>
              <div>
                <Label className="text-sm text-gray-600 dark:text-gray-400">Процент бонуса (%)</Label>
                <Input type="text" value={referralBonusPercentage} onChange={(e) => setReferralBonusPercentage(e.target.value)} placeholder="5" className="mt-1 bg-gray-50 dark:bg-[#0E0E10]" />
              </div>
            </div>
          </motion.div>
        </div>

        <motion.div className="bg-white dark:bg-[#1A1A1C] rounded-xl p-4 shadow-lg" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Button
            onClick={handleUpdatePrices}
            disabled={updateSettingsMutation.isPending}
            className="w-full bg-[#4E7FFF] hover:bg-[#3D6FFF] text-white font-semibold py-3"
            size="lg"
          >
            {updateSettingsMutation.isPending ? (
              <>
                <div className="animate-spin w-4 h-4 mr-2 border-2 border-white border-t-transparent rounded-full" />
                Сохраняем...
              </>
            ) : (
              "Сохранить настройки"
            )}
          </Button>
        </motion.div>

        {/* Recent Transactions */}
        {adminStats?.recentTransactions && adminStats.recentTransactions.length > 0 && (
          <motion.div className="bg-white dark:bg-[#1A1A1C] rounded-xl p-4 shadow-lg" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <h3 className="font-semibold mb-3 flex items-center">
              <History className="w-4 h-4 text-purple-500 mr-2" />
              Последние транзакции
            </h3>
            <div className="space-y-2">
              {adminStats.recentTransactions.slice(0, 5).map((transaction) => (
                <div key={transaction.id} className="flex justify-between items-center p-3 bg-gray-50 dark:bg-[#0E0E10] rounded-lg">
                  <div className="flex-1">
                    <p className="font-medium text-sm">{transaction.username || 'Неизвестный пользователь'}</p>
                    <p className="text-xs text-gray-600 dark:text-gray-400">{transaction.description || 'Нет описания'}</p>
                  </div>
                  <div className="text-right">
                    <span className={`inline-block px-2 py-1 text-xs rounded-full ${
                      transaction.status === 'completed' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
                      transaction.status === 'pending' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' :
                      'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                    }`}>
                      {transaction.status === 'completed' ? 'Успешно' : 
                       transaction.status === 'pending' ? 'В обработке' : 'Ошибка'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </main>
    </div>
  );
}