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
  Calendar,
  Download,
  Filter,
  Trophy,
  PieChart,
  RefreshCw
} from "@/components/ui/custom-icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link } from "wouter";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';
import { ru } from 'date-fns/locale';

// Типы данных
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

type PeriodFilter = 'today' | 'week' | 'month' | 'all' | 'custom';

type ProfitStats = {
  ton_profit: number;
  stars_profit: number;
  total_profit: number;
  margin_percentage: number;
  period?: string;
};

type ReferralLeader = {
  id: string;
  username: string;
  referral_count: number;
  total_earnings: number;
  rank: number;
};

type SalesData = {
  date: string;
  sales: number;
  count: number;
  formatted_date: string;
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

export default function AdminPage(): JSX.Element {
  // Существующие состояния
  const [starsPrice, setStarsPrice] = useState<string>("");
  const [tonMarkupPercentage, setTonMarkupPercentage] = useState<string>("");
  const [tonCacheMinutes, setTonCacheMinutes] = useState<string>("");
  const [tonFallbackPrice, setTonFallbackPrice] = useState<string>("");
  const [botBaseUrl, setBotBaseUrl] = useState<string>("");
  const [referralPrefix, setReferralPrefix] = useState<string>("");
  const [referralBonusPercentage, setReferralBonusPercentage] = useState<string>("");
  const [referralRegistrationBonus, setReferralRegistrationBonus] = useState<string>("");
  const [showTransactions, setShowTransactions] = useState<boolean>(false);

  // Новые состояния для аналитики
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodFilter>('all');
  const [customDateFrom, setCustomDateFrom] = useState<Date>();
  const [customDateTo, setCustomDateTo] = useState<Date>();
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [transactionStatusFilter, setTransactionStatusFilter] = useState<string>('completed');
  const [transactionCurrencyFilter, setTransactionCurrencyFilter] = useState<string>('all');
  const [showReferralLeaders, setShowReferralLeaders] = useState(false);
  const [conversionPeriod, setConversionPeriod] = useState<PeriodFilter>('month');

  const { toast } = useToast();
  const { hapticFeedback } = useTelegram();
  const queryClient = useQueryClient();

  // Функции для работы с датами
  const getPeriodDates = (period: PeriodFilter) => {
    const now = new Date();
    switch (period) {
      case 'today':
        return { from: startOfDay(now), to: endOfDay(now) };
      case 'week':
        return { from: startOfDay(subDays(now, 7)), to: endOfDay(now) };
      case 'month':
        return { from: startOfDay(subDays(now, 30)), to: endOfDay(now) };
      case 'custom':
        return { from: customDateFrom, to: customDateTo };
      default:
        return { from: null, to: null };
    }
  };

  const periodLabels = {
    'today': 'За сегодня',
    'week': 'За неделю', 
    'month': 'За месяц',
    'all': 'За всё время',
    'custom': 'Произвольный'
  };

  // Нормализация значений
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

  // API запросы
  const { data: adminStats, isLoading: isStatsLoading } = useQuery({
    queryKey: ["/api/admin/stats"],
    queryFn: async () => {
      const response = await fetch("/api/admin/stats");
      return response.json() as Promise<AdminStats>;
    },
    refetchInterval: 30000,
  });

  const { data: currentSettings, isLoading: isSettingsLoading } = useQuery({
    queryKey: ["/api/admin/settings/current"],
    queryFn: async () => {
      const response = await fetch("/api/admin/settings/current");
      return response.json() as Promise<CurrentSettings>;
    },
  });

  // API запросы для расширенной аналитики
  const { data: profitStats, isLoading: isProfitLoading } = useQuery({
    queryKey: ["/api/admin/profit-stats", selectedPeriod, customDateFrom, customDateTo],
    queryFn: async () => {
      const { from, to } = getPeriodDates(selectedPeriod);
      const params = new URLSearchParams({
        period: selectedPeriod
      });
      
      if (from && to) {
        params.append('date_from', from.toISOString());
        params.append('date_to', to.toISOString());
      }
      
      const response = await fetch(`/api/admin/profit-stats?${params}`);
      if (!response.ok) throw new Error('Failed to fetch profit stats');
      return response.json() as Promise<ProfitStats>;
    }
  });

  const { data: referralLeadersResponse, isLoading: isLeadersLoading } = useQuery({
    queryKey: ["/api/admin/referral-leaders"],
    queryFn: async () => {
      const response = await fetch("/api/admin/referral-leaders?limit=10&sort_by=referral_count");
      if (!response.ok) throw new Error('Failed to fetch referral leaders');
      return response.json();
    }
  });

  const { data: salesChartResponse, isLoading: isChartLoading } = useQuery({
    queryKey: ["/api/admin/sales-chart", selectedPeriod],
    queryFn: async () => {
      const days = selectedPeriod === 'week' ? 7 : 
                   selectedPeriod === 'month' ? 30 : 
                   selectedPeriod === 'today' ? 7 : 30; // Минимум неделя для графика
      
      const response = await fetch(`/api/admin/sales-chart?days=${days}`);
      if (!response.ok) throw new Error('Failed to fetch sales chart data');
      return response.json();
    }
  });

  // Извлекаем данные из ответов API
  const referralLeaders = referralLeadersResponse?.leaders || [];
  const salesChartData = salesChartResponse?.chart_data || [];

  // Мутации
  const updateSettingsMutation = useMutation({
    mutationFn: async (settings: Partial<CurrentSettings>) => {
      const response = await fetch("/api/admin/settings/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      if (!response.ok) throw new Error("Failed to update settings");
      return response.json();
    },
    onSuccess: () => {
      hapticFeedback?.notificationOccurred("success");
      toast({ title: "Настройки обновлены", variant: "default" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/settings/current"] });
    },
    onError: () => {
      hapticFeedback?.notificationOccurred("error");
      toast({ 
        title: "Ошибка обновления", 
        description: "Не удалось сохранить настройки.", 
        variant: "destructive" 
      });
    },
  });

  // Эффекты
  useEffect(() => {
    if (currentSettings) {
      setStarsPrice(normalizeToStringNumber(currentSettings.stars_price, "1.3"));
      setTonMarkupPercentage(normalizeToStringNumber(currentSettings.ton_markup_percentage, "5"));
      setTonCacheMinutes(normalizeToStringNumber(currentSettings.ton_price_cache_minutes, "30"));
      setTonFallbackPrice(normalizeToStringNumber(currentSettings.ton_fallback_price, "400"));
      setBotBaseUrl(String(currentSettings.bot_base_url || ""));
      setReferralPrefix(String(currentSettings.referral_prefix || "ref"));
      setReferralBonusPercentage(normalizeToStringNumber(currentSettings.referral_bonus_percentage, "10"));
      setReferralRegistrationBonus(normalizeToStringNumber(currentSettings.referral_registration_bonus, "25"));
    }
  }, [currentSettings]);

  // Обработчики
  const handleUpdateSettings = () => {
    const s = parseNumberOrNaN(starsPrice);
    const tmp = parseNumberOrNaN(tonMarkupPercentage);
    const tcm = parseNumberOrNaN(tonCacheMinutes);
    const tfp = parseNumberOrNaN(tonFallbackPrice);
    const rbp = parseNumberOrNaN(referralBonusPercentage);
    const rrb = parseNumberOrNaN(referralRegistrationBonus);

    if (isNaN(s) || isNaN(tmp) || isNaN(tcm) || isNaN(tfp) || isNaN(rbp) || isNaN(rrb)) {
      toast({ 
        title: "Ошибка валидации", 
        description: "Все числовые поля должны содержать корректные значения.", 
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

  const handleExport = (format: 'csv' | 'excel' | 'pdf') => {
    // TODO: Реализовать экспорт
    toast({ 
      title: `Экспорт ${format.toUpperCase()}`, 
      description: "Функция экспорта будет доступна скоро" 
    });
  };

  const refreshProfitStats = async () => {
    try {
      const response = await fetch("/api/admin/profit-stats/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      
      if (response.ok) {
        queryClient.invalidateQueries({ queryKey: ["/api/admin/profit-stats"] });
        toast({ title: "Статистика прибыли обновлена" });
      } else {
        throw new Error('Failed to refresh');
      }
    } catch (error) {
      toast({ 
        title: "Ошибка обновления", 
        description: "Не удалось обновить статистику",
        variant: "destructive" 
      });
    }
  };

  // Вычисляемые значения
  const conversionRate = adminStats?.totalUsers && adminStats.todaySales 
    ? ((parseFloat(adminStats.todaySales) > 0 ? 1 : 0) / adminStats.totalUsers * 100).toFixed(1)
    : "0.0";

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
          
          {/* Кнопка экспорта */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <Download className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => handleExport('csv')}>
                Экспорт CSV
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport('excel')}>
                Экспорт Excel
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport('pdf')}>
                Экспорт PDF
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <main className="p-4 space-y-6">
        {/* Выбор периода */}
        <motion.div 
          className="bg-gray-50 dark:bg-[#1A1A1C] rounded-xl p-4"
          initial={{ opacity: 0, y: 20 }} 
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="flex flex-wrap gap-4 items-center">
            <div className="flex items-center space-x-2">
              <Calendar className="w-4 h-4 text-[#4E7FFF]" />
              <Label className="text-sm font-medium">Период:</Label>
            </div>
            
            <Select value={selectedPeriod} onValueChange={(value: PeriodFilter) => setSelectedPeriod(value)}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Выберите период" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(periodLabels).map(([key, label]) => (
                  <SelectItem key={key} value={key}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {selectedPeriod === 'custom' && (
              <Popover open={showDatePicker} onOpenChange={setShowDatePicker}>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="text-sm">
                    {customDateFrom && customDateTo ? 
                      `${format(customDateFrom, 'dd.MM.yyyy')} - ${format(customDateTo, 'dd.MM.yyyy')}` : 
                      'Выберите даты'
                    }
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <div className="p-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label className="text-xs text-gray-500">От</Label>
                        <CalendarComponent
                          mode="single"
                          selected={customDateFrom}
                          onSelect={setCustomDateFrom}
                          locale={ru}
                          className="w-full"
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-gray-500">До</Label>
                        <CalendarComponent
                          mode="single"
                          selected={customDateTo}
                          onSelect={setCustomDateTo}
                          locale={ru}
                          className="w-full"
                        />
                      </div>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            )}
          </div>
        </motion.div>

        {/* Основная статистика */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
              ₽{adminStats?.todaySales ? 
                parseFloat(adminStats.todaySales).toLocaleString("ru-RU", { maximumFractionDigits: 0 }) : 
                "0"
              }
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">Продаж за сегодня</p>
          </motion.div>

          <motion.div 
            className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 rounded-xl p-4 border border-purple-200 dark:border-purple-700"
            initial={{ opacity: 0, y: 20 }} 
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <div className="flex items-center justify-between mb-2">
              <Users className="w-8 h-8 text-purple-500" />
            </div>
            <h3 className="text-2xl font-bold text-purple-600 dark:text-purple-400">
              {adminStats?.activeReferrals || 0}
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">Активных рефералов</p>
          </motion.div>

          <motion.div 
            className="bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-900/20 dark:to-orange-800/20 rounded-xl p-4 border border-orange-200 dark:border-orange-700"
            initial={{ opacity: 0, y: 20 }} 
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <div className="flex items-center justify-between mb-2">
              <PieChart className="w-8 h-8 text-orange-500" />
            </div>
            <h3 className="text-2xl font-bold text-orange-600 dark:text-orange-400">
              {conversionRate}%
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">Конверсия (месяц)</p>
          </motion.div>
        </div>

        {/* Статистика прибыли */}
        <motion.div
          className="bg-gray-50 dark:bg-[#1A1A1C] rounded-xl p-4"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold flex items-center">
              <BarChart3 className="w-5 h-5 text-green-500 mr-2" />
              Статистика прибыли {periodLabels[selectedPeriod].toLowerCase()}
            </h3>
            <Button variant="ghost" size="sm" onClick={refreshProfitStats}>
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-[#0E0E10] rounded-lg p-3">
              <p className="text-sm text-gray-600 dark:text-gray-400">TON прибыль</p>
              <p className="text-xl font-bold text-blue-600">
                {isProfitLoading ? (
                  <div className="h-6 bg-gray-200 rounded animate-pulse"></div>
                ) : (
                  `₽${profitStats?.ton_profit?.toLocaleString() || "0"}`
                )}
              </p>
            </div>
            <div className="bg-white dark:bg-[#0E0E10] rounded-lg p-3">
              <p className="text-sm text-gray-600 dark:text-gray-400">Stars прибыль</p>
              <p className="text-xl font-bold text-yellow-600">
                {isProfitLoading ? (
                  <div className="h-6 bg-gray-200 rounded animate-pulse"></div>
                ) : (
                  `₽${profitStats?.stars_profit?.toLocaleString() || "0"}`
                )}
              </p>
            </div>
            <div className="bg-white dark:bg-[#0E0E10] rounded-lg p-3">
              <p className="text-sm text-gray-600 dark:text-gray-400">Общая прибыль</p>
              <p className="text-xl font-bold text-green-600">
                {isProfitLoading ? (
                  <div className="h-6 bg-gray-200 rounded animate-pulse"></div>
                ) : (
                  `₽${profitStats?.total_profit?.toLocaleString() || "0"}`
                )}
              </p>
            </div>
            <div className="bg-white dark:bg-[#0E0E10] rounded-lg p-3">
              <p className="text-sm text-gray-600 dark:text-gray-400">Маржинальность</p>
              <p className="text-xl font-bold text-purple-600">
                {isProfitLoading ? (
                  <div className="h-6 bg-gray-200 rounded animate-pulse"></div>
                ) : (
                  `${profitStats?.margin_percentage || "0"}%`
                )}
              </p>
            </div>
          </div>
        </motion.div>

        {/* График продаж */}
        <motion.div
          className="bg-gray-50 dark:bg-[#1A1A1C] rounded-xl p-4"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <h3 className="font-semibold mb-4 flex items-center">
            <Activity className="w-5 h-5 text-blue-500 mr-2" />
            График продаж (последние 30 дней)
          </h3>
          
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={salesChartData || []}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip 
                  formatter={(value, name) => [
                    `₽${Number(value).toLocaleString()}`,
                    name === 'sales' ? 'Продажи' : 'Количество'
                  ]}
                />
                <Area 
                  type="monotone" 
                  dataKey="sales" 
                  stroke="#4E7FFF" 
                  fill="#4E7FFF" 
                  fillOpacity={0.3}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Лидеры рефералов */}
        <motion.div
          className="bg-gray-50 dark:bg-[#1A1A1C] rounded-xl p-4"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold flex items-center">
              <Trophy className="w-5 h-5 text-yellow-500 mr-2" />
              Топ-10 рефералов
            </h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowReferralLeaders(!showReferralLeaders)}
            >
              {showReferralLeaders ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </Button>
          </div>

          <AnimatePresence>
            {showReferralLeaders && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="overflow-hidden"
              >
                <div className="space-y-2">
                  {isLeadersLoading ? (
                    // Скелетон загрузки
                    Array.from({ length: 10 }, (_, i) => (
                      <div key={i} className="flex items-center justify-between bg-white dark:bg-[#0E0E10] rounded-lg p-3">
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 bg-gray-200 rounded-full animate-pulse"></div>
                          <div>
                            <div className="h-4 bg-gray-200 rounded w-24 animate-pulse mb-1"></div>
                            <div className="h-3 bg-gray-200 rounded w-16 animate-pulse"></div>
                          </div>
                        </div>
                        <div className="h-6 bg-gray-200 rounded w-20 animate-pulse"></div>
                      </div>
                    ))
                  ) : referralLeaders?.length > 0 ? (
                    referralLeaders.map((leader, index) => (
                      <div key={leader.id} className="flex items-center justify-between bg-white dark:bg-[#0E0E10] rounded-lg p-3">
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 bg-gradient-to-r from-yellow-400 to-orange-500 rounded-full flex items-center justify-center text-white font-bold text-sm">
                            {leader.rank || index + 1}
                          </div>
                          <div>
                            <p className="font-medium">{leader.username}</p>
                            <p className="text-sm text-gray-500">{leader.referral_count} рефералов</p>
                          </div>
                        </div>
                        <Badge variant="secondary">
                          {leader.total_earnings.toLocaleString()} ⭐
                        </Badge>
                      </div>
                    ))
                  ) : (
                    <p className="text-center text-gray-500 py-8">Лидеров нет</p>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Настройки цен */}
        <motion.div
          className="bg-gray-50 dark:bg-[#1A1A1C] rounded-xl p-4"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
        >
          <h3 className="font-semibold mb-3 flex items-center">
            <Tag className="w-4 h-4 text-orange-500 mr-2" />
            Настройки цен
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Цена Stars (₽)</Label>
              <Input
                value={starsPrice}
                onChange={(e) => setStarsPrice(e.target.value)}
                placeholder="1.3"
              />
            </div>
            <div>
              <Label>Наценка TON (%)</Label>
              <Input
                value={tonMarkupPercentage}
                onChange={(e) => setTonMarkupPercentage(e.target.value)}
                placeholder="5"
              />
            </div>
            <div>
              <Label>Кэш TON (минуты)</Label>
              <Input
                value={tonCacheMinutes}
                onChange={(e) => setTonCacheMinutes(e.target.value)}
                placeholder="30"
              />
            </div>
            <div>
              <Label>Резервная цена TON (₽)</Label>
              <Input
                value={tonFallbackPrice}
                onChange={(e) => setTonFallbackPrice(e.target.value)}
                placeholder="400"
              />
            </div>
            <div>
              <Label>Бонус за регистрацию (⭐)</Label>
              <Input
                value={referralRegistrationBonus}
                onChange={(e) => setReferralRegistrationBonus(e.target.value)}
                placeholder="25"
              />
            </div>
            <div className="flex items-end">
              <Button 
                onClick={handleUpdateSettings} 
                className="w-full"
                disabled={updateSettingsMutation.isPending}
              >
                {updateSettingsMutation.isPending ? "Обновляется..." : "Обновить цены"}
              </Button>
            </div>
          </div>
        </motion.div>

        {/* Реферальные настройки */}
        <motion.div
          className="bg-gray-50 dark:bg-[#1A1A1C] rounded-xl p-4"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
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
            <div className="col-span-2">
              <Label>Процент реферального бонуса (%)</Label>
              <Input
                type="number"
                value={referralBonusPercentage}
                onChange={(e) => setReferralBonusPercentage(e.target.value)}
                placeholder="10"
              />
            </div>
          </div>
        </motion.div>

        {/* Фильтрованные транзакции */}
        <motion.div
          className="bg-gray-50 dark:bg-[#1A1A1C] rounded-xl p-4"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.9 }}
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold flex items-center">
              <History className="w-4 h-4 text-[#4E7FFF] mr-2" />
              Последние транзакции
            </h3>
            <div className="flex items-center space-x-2">
              <Select value={transactionStatusFilter} onValueChange={setTransactionStatusFilter}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Все</SelectItem>
                  <SelectItem value="completed">Завершено</SelectItem>
                  <SelectItem value="pending">Ожидание</SelectItem>
                  <SelectItem value="failed">Ошибка</SelectItem>
                </SelectContent>
              </Select>
              
              <Select value={transactionCurrencyFilter} onValueChange={setTransactionCurrencyFilter}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Все валюты</SelectItem>
                  <SelectItem value="stars">Stars</SelectItem>
                  <SelectItem value="ton">TON</SelectItem>
                </SelectContent>
              </Select>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowTransactions(!showTransactions)}
              >
                {showTransactions ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </Button>
            </div>
          </div>

          <AnimatePresence>
            {showTransactions && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="overflow-hidden"
              >
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {adminStats?.recentTransactions?.length ? 
                    adminStats.recentTransactions
                      .filter(tx => 
                        (transactionStatusFilter === 'all' || tx.status === transactionStatusFilter) &&
                        (transactionCurrencyFilter === 'all' || tx.description?.toLowerCase().includes(transactionCurrencyFilter))
                      )
                      .slice(0, 20)
                      .map((transaction, index) => (
                      <motion.div
                        key={transaction.id}
                        className="flex items-center justify-between bg-white dark:bg-[#0E0E10] rounded-lg p-3"
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.1 }}
                      >
                        <div>
                          <p className="font-medium text-sm">{transaction.username}</p>
                          <p className="text-xs text-gray-500">{transaction.description}</p>
                          {transaction.createdAt && (
                            <p className="text-xs text-gray-400">
                              {new Date(transaction.createdAt).toLocaleDateString('ru-RU')}
                            </p>
                          )}
                        </div>
                        <Badge 
                          variant={transaction.status === 'completed' ? 'default' : 
                                   transaction.status === 'failed' ? 'destructive' : 'secondary'}
                        >
                          {transaction.status === 'completed' ? 'Завершено' :
                           transaction.status === 'failed' ? 'Ошибка' :
                           transaction.status === 'pending' ? 'Ожидание' : 
                           transaction.status}
                        </Badge>
                      </motion.div>
                    )) : (
                      <p className="text-center text-gray-500 py-8">Транзакций нет</p>
                    )
                  }
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </main>
    </div>
  );
}