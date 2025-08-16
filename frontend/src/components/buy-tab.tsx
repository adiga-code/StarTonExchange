import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useTelegram } from "@/hooks/use-telegram";
import { 
  Star, 
  Bitcoin, 
  Calculator, 
  Copy, 
  User, 
  X, 
  Search,
  UserCheck,
  UserX,
  Loader2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Currency = 'stars' | 'ton';

interface BuyTabProps {
  user: any;
  onShowLoading: () => void;
  onHideLoading: () => void;
}

interface TargetUser {
  telegram_id: string;
  username?: string;
  first_name: string;
  last_name?: string;
  profile_photo?: string;
}

export default function BuyTab({ user, onShowLoading, onHideLoading }: BuyTabProps) {
  const [selectedCurrency, setSelectedCurrency] = useState<Currency>('stars');
  const [amount, setAmount] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [targetUsername, setTargetUsername] = useState('');
  const [targetUser, setTargetUser] = useState<TargetUser | null>(null);
  const [isSearchingUser, setIsSearchingUser] = useState(false);
  const [userSearchError, setUserSearchError] = useState('');
  
  const { toast } = useToast();
  const { hapticFeedback } = useTelegram();
  const queryClient = useQueryClient();

  // Получение цен
  const { data: priceCalculation } = useQuery({
    queryKey: ['/api/purchase/calculate', selectedCurrency, amount],
    queryFn: async () => {
      if (!amount || parseFloat(amount) <= 0) return null;
      const response = await apiRequest('POST', '/api/purchase/calculate', {
        currency: selectedCurrency,
        amount: parseFloat(amount),
      });
      return response.json();
    },
    enabled: !!amount && parseFloat(amount) > 0,
  });

  // Мутация для покупки
  const purchaseMutation = useMutation({
    mutationFn: async (purchaseData: {
      currency: Currency;
      amount: number;
      rub_amount: number;
      target_user_id?: string;
    }) => {
      const response = await apiRequest('POST', '/api/purchase', purchaseData);
      return response.json();
    },
    onSuccess: (data) => {
      if (data.payment_url) {
        setIsProcessing(true);
        onShowLoading();
        
        // Открыть окно оплаты
        window.open(data.payment_url, '_blank');
        
        // Начать проверку статуса
        startStatusPolling(data.transaction.id);
      } else {
        // Мгновенная покупка (например, тестовый режим)
        hapticFeedback('success');
        toast({
          title: "Покупка успешна!",
          description: `${selectedCurrency === 'stars' ? 'Звезды' : 'TON'} добавлены на счет`,
        });
        queryClient.invalidateQueries({ queryKey: ['/api/users/me'] });
      }
    },
    onError: (error: any) => {
      hapticFeedback('error');
      toast({
        title: "Ошибка покупки",
        description: error.message || "Не удалось создать заказ",
        variant: "destructive",
      });
    },
  });

  // Поиск пользователя по username
  const searchUserMutation = useMutation({
    mutationFn: async (username: string) => {
      const response = await apiRequest('GET', `/api/users/search/${username}`);
      if (!response.ok) {
        throw new Error('Пользователь не найден');
      }
      return response.json();
    },
    onSuccess: (userData: TargetUser) => {
      setTargetUser(userData);
      setUserSearchError('');
      hapticFeedback('success');
      toast({
        title: "Пользователь найден",
        description: `${userData.first_name} (@${userData.username})`,
      });
    },
    onError: () => {
      setTargetUser(null);
      setUserSearchError('Пользователь не найден');
      hapticFeedback('error');
    },
  });

  // Проверка статуса платежа
  const startStatusPolling = (transactionId: string) => {
    let attempts = 0;
    const maxAttempts = 30; // 5 минут максимум

    const checkStatus = async () => {
      try {
        const response = await apiRequest('GET', `/api/purchase/status/${transactionId}`);
        const statusData = await response.json();

        if (statusData.status === 'completed') {
          // Успешная оплата
          onHideLoading();
          setIsProcessing(false);
          setAmount('');

          hapticFeedback('success');
          queryClient.invalidateQueries({ queryKey: ['/api/users/me'] });
          toast({
            title: "Покупка завершена!",
            description: `${selectedCurrency === 'stars' ? 'Звезды' : 'TON'} добавлены на счет`,
          });
          return;
        }

        if (statusData.status === 'failed' || statusData.status === 'cancelled') {
          // Неудачная оплата
          onHideLoading();
          setIsProcessing(false);

          hapticFeedback('error');
          toast({
            title: "Оплата отменена",
            description: "Платеж был отменен или не удался",
            variant: "destructive",
          });
          return;
        }

        // Продолжать опрос
        attempts++;
        if (attempts < maxAttempts) {
          setTimeout(checkStatus, 10000); // Проверять каждые 10 секунд
        } else {
          // Таймаут
          onHideLoading();
          setIsProcessing(false);
          toast({
            title: "Время ожидания истекло",
            description: "Проверьте статус платежа позже",
            variant: "destructive",
          });
        }

      } catch (error) {
        console.error('Error checking payment status:', error);
        attempts++;
        if (attempts < maxAttempts) {
          setTimeout(checkStatus, 10000);
        } else {
          onHideLoading();
          setIsProcessing(false);
        }
      }
    };

    // Начать проверку через 5 секунд
    setTimeout(checkStatus, 5000);
  };

  const handleCurrencySelect = (currency: Currency) => {
    hapticFeedback('light');
    setSelectedCurrency(currency);
  };

  const handleQuickBuy = (quickAmount: number) => {
    hapticFeedback('light');
    setAmount(quickAmount.toString());
  };

  const handleSearchUser = () => {
    if (!targetUsername.trim()) {
      setUserSearchError('Введите username');
      return;
    }
    
    const cleanUsername = targetUsername.replace('@', '').trim();
    setIsSearchingUser(true);
    searchUserMutation.mutate(cleanUsername);
    setIsSearchingUser(false);
  };

  const handleAutoFillCurrentUser = () => {
    if (user?.username) {
      setTargetUsername(user.username);
      setTargetUser({
        telegram_id: user.telegram_id,
        username: user.username,
        first_name: user.first_name,
        last_name: user.last_name,
      });
      setUserSearchError('');
      hapticFeedback('light');
    }
  };

  const handleClearTargetUser = () => {
    setTargetUser(null);
    setTargetUsername('');
    setUserSearchError('');
    hapticFeedback('light');
  };

  const handlePurchase = async () => {
    if (!amount || parseFloat(amount) <= 0 || !priceCalculation || isProcessing) return;
    
    if (!targetUser) {
      toast({
        title: "Ошибка",
        description: "Выберите пользователя для покупки",
        variant: "destructive",
      });
      return;
    }

    hapticFeedback('medium');

    try {
      await purchaseMutation.mutateAsync({
        currency: selectedCurrency,
        amount: parseFloat(amount),
        rub_amount: parseFloat(priceCalculation.total_price),
        target_user_id: targetUser.telegram_id,
      });
    } catch (error) {
      // Обработка ошибок в onError callback
    }
  };

  const prices = {
    stars: 2.30,
    ton: 420.50,
  };

  const quickBuyOptions = selectedCurrency === 'stars'
    ? [100, 500, 1000, 2500]
    : [0.1, 0.5, 1, 2.5];

  return (
    <div className="space-y-4">
      {/* Выбор получателя */}
      <motion.div
        className="bg-white dark:bg-[#1A1A1C] rounded-xl p-4 shadow-lg dark:shadow-[0_4px_20px_rgba(0,0,0,0.3)] border border-gray-200 dark:border-white/10"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <h3 className="text-lg font-semibold mb-4 flex items-center">
          <User className="w-5 h-5 mr-2 text-[#4E7FFF]" />
          Получатель покупки
        </h3>

        {!targetUser ? (
          <div className="space-y-3">
            <div>
              <Label htmlFor="username" className="text-gray-600 dark:text-gray-400">
                Username пользователя
              </Label>
              <div className="flex mt-2 space-x-2">
                <div className="relative flex-1">
                  <Input
                    id="username"
                    type="text"
                    placeholder="@username или username"
                    value={targetUsername}
                    onChange={(e) => setTargetUsername(e.target.value)}
                    className="pr-10 bg-gray-50 dark:bg-[#0E0E10] border-gray-200 dark:border-white/20 focus:border-[#4E7FFF] focus:ring-[#4E7FFF]"
                    disabled={isSearchingUser}
                    onKeyPress={(e) => e.key === 'Enter' && handleSearchUser()}
                  />
                  {isSearchingUser && (
                    <Loader2 className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 animate-spin text-gray-400" />
                  )}
                </div>
                <Button
                  onClick={handleSearchUser}
                  disabled={isSearchingUser || !targetUsername.trim()}
                  className="bg-[#4E7FFF] hover:bg-[#3D6FFF] text-white"
                >
                  <Search className="w-4 h-4" />
                </Button>
              </div>
              {userSearchError && (
                <p className="text-red-500 text-sm mt-1 flex items-center">
                  <UserX className="w-4 h-4 mr-1" />
                  {userSearchError}
                </p>
              )}
            </div>

            <Button
              onClick={handleAutoFillCurrentUser}
              variant="outline"
              className="w-full border-gray-200 dark:border-white/20 hover:bg-[#4E7FFF]/10"
              disabled={!user?.username}
            >
              <UserCheck className="w-4 h-4 mr-2" />
              Купить для себя {user?.username ? `(@${user.username})` : ''}
            </Button>
          </div>
        ) : (
          <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-[#0E0E10] rounded-lg border border-gray-200 dark:border-white/10">
            <div className="flex items-center space-x-3">
              {targetUser.profile_photo ? (
                <img
                  src={targetUser.profile_photo}
                  alt="Avatar"
                  className="w-10 h-10 rounded-full"
                />
              ) : (
                <div className="w-10 h-10 bg-gradient-to-br from-[#4E7FFF] to-purple-500 rounded-full flex items-center justify-center">
                  <span className="text-white font-bold text-sm">
                    {targetUser.first_name?.[0] || '?'}
                  </span>
                </div>
              )}
              <div>
                <p className="font-medium">
                  {targetUser.first_name} {targetUser.last_name || ''}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {targetUser.username ? `@${targetUser.username}` : 'Без username'}
                </p>
              </div>
            </div>
            <Button
              onClick={handleClearTargetUser}
              variant="ghost"
              size="sm"
              className="text-gray-500 hover:text-red-500"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        )}
      </motion.div>

      {/* Выбор валюты */}
      <motion.div
        className="bg-white dark:bg-[#1A1A1C] rounded-xl p-4 shadow-lg dark:shadow-[0_4px_20px_rgba(0,0,0,0.3)] border border-gray-200 dark:border-white/10"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.1 }}
      >
        <h3 className="text-lg font-semibold mb-4 flex items-center">
          <Calculator className="w-5 h-5 mr-2 text-[#4E7FFF]" />
          Выберите валюту
        </h3>
        <div className="grid grid-cols-2 gap-3">
          <motion.button
            onClick={() => handleCurrencySelect('stars')}
            className={`p-4 rounded-xl border-2 transition-all ${selectedCurrency === 'stars'
                ? 'border-[#4E7FFF] bg-[#4E7FFF]/10'
                : 'border-gray-200 dark:border-white/10 hover:border-[#4E7FFF]/50'
              }`}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            disabled={isProcessing}
          >
            <Star className="w-8 h-8 text-yellow-500 mx-auto mb-2" />
            <p className="font-semibold">Telegram Stars</p>
            <p className="text-gray-600 dark:text-gray-400 text-xs">₽{prices.stars} за звезду</p>
          </motion.button>
          <motion.button
            onClick={() => handleCurrencySelect('ton')}
            className={`p-4 rounded-xl border-2 transition-all ${selectedCurrency === 'ton'
                ? 'border-[#4E7FFF] bg-[#4E7FFF]/10'
                : 'border-gray-200 dark:border-white/10 hover:border-[#4E7FFF]/50'
              }`}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            disabled={isProcessing}
          >
            <Bitcoin className="w-8 h-8 text-[#4E7FFF] mx-auto mb-2" />
            <p className="font-semibold">TON Coin</p>
            <p className="text-gray-600 dark:text-gray-400 text-xs">₽{prices.ton} за TON</p>
          </motion.button>
        </div>
      </motion.div>

      {/* Калькулятор покупки */}
      <motion.div
        className="bg-white dark:bg-[#1A1A1C] rounded-xl p-4 shadow-lg dark:shadow-[0_4px_20px_rgba(0,0,0,0.3)] border border-gray-200 dark:border-white/10"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.2 }}
      >
        <h3 className="text-lg font-semibold mb-4">Калькулятор покупки</h3>
        <div className="space-y-4">
          <div>
            <Label htmlFor="amount" className="text-gray-600 dark:text-gray-400">
              Количество
            </Label>
            <div className="relative mt-2">
              <Input
                id="amount"
                type="number"
                placeholder="Введите количество"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="pr-12 bg-gray-50 dark:bg-[#0E0E10] border-gray-200 dark:border-white/20 focus:border-[#4E7FFF] focus:ring-[#4E7FFF]"
                disabled={isProcessing}
              />
              <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400">
                {selectedCurrency === 'stars' ? '⭐' : 'TON'}
              </div>
            </div>
          </div>

          {/* Быстрые кнопки */}
          <div>
            <Label className="text-gray-600 dark:text-gray-400 mb-2 block">
              Быстрый выбор
            </Label>
            <div className="grid grid-cols-4 gap-2">
              {quickBuyOptions.map((option) => (
                <Button
                  key={option}
                  onClick={() => handleQuickBuy(option)}
                  variant="outline"
                  size="sm"
                  className="border-gray-200 dark:border-white/20 hover:border-[#4E7FFF] hover:bg-[#4E7FFF]/10"
                  disabled={isProcessing}
                >
                  {option}{selectedCurrency === 'stars' ? '⭐' : ' TON'}
                </Button>
              ))}
            </div>
          </div>

          {/* Расчет цены */}
          {priceCalculation && (
            <motion.div
              className="p-3 bg-gray-50 dark:bg-[#0E0E10] rounded-lg border border-gray-200 dark:border-white/10"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Базовая цена:</span>
                  <span>₽{priceCalculation.base_price}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Наценка:</span>
                  <span>₽{priceCalculation.markup_amount}</span>
                </div>
                <div className="flex justify-between font-semibold text-lg border-t border-gray-200 dark:border-white/20 pt-2">
                  <span>Итого:</span>
                  <span className="text-[#4E7FFF]">₽{priceCalculation.total_price}</span>
                </div>
              </div>
            </motion.div>
          )}

          {/* Кнопка покупки */}
          <Button
            onClick={handlePurchase}
            disabled={!amount || !priceCalculation || isProcessing || !targetUser}
            className="w-full bg-gradient-to-r from-[#4E7FFF] to-purple-500 text-white font-semibold py-3 rounded-lg glow-button disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Обработка...
              </>
            ) : (
              <>
                Купить {amount} {selectedCurrency === 'stars' ? 'звезд' : 'TON'}
                {priceCalculation && ` за ₽${priceCalculation.total_price}`}
              </>
            )}
          </Button>

          {!targetUser && (
            <p className="text-center text-sm text-gray-500 dark:text-gray-400">
              Выберите получателя для активации кнопки покупки
            </p>
          )}
        </div>
      </motion.div>
    </div>
  );
}