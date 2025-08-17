// frontend/src/components/buy-tab.tsx (полная версия с предзагрузкой аватарок)
import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useTelegram } from "@/hooks/use-telegram";
import { usePreloadAvatar } from "@/hooks/use-preload-avatar";
import { Star, Bitcoin, ShoppingCart, Calculator, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { SnakeCaseUser, User } from "@shared/schema";

interface BuyTabProps {
  user?: SnakeCaseUser;
  onShowLoading: (message: string) => void;
  onHideLoading: () => void;
}

type Currency = 'stars' | 'ton';

interface PaymentResponse {
  transaction_id: string;
  payment_url: string;
  invoice_id: string;
  amount: string;
  status: string;
}

interface PriceData {
  base_price: string;
  markup_amount: string;
  total_price: string;
  currency: string;
  amount: number;
}

export default function BuyTab({ user, onShowLoading, onHideLoading }: BuyTabProps) {
  const [selectedCurrency, setSelectedCurrency] = useState<Currency>('stars');
  const [amount, setAmount] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [recipientUsername, setRecipientUsername] = useState('');
  const [userError, setUserError] = useState('');
  const { toast } = useToast();
  const { hapticFeedback } = useTelegram();
  const queryClient = useQueryClient();

  // ← НОВОЕ: Используем улучшенный хук для получателя
  const { 
    avatar: recipientAvatar, 
    isLoading: isLoadingRecipient, 
    error: recipientError 
  } = usePreloadAvatar(
    recipientUsername.trim() ? { username: recipientUsername.trim() } as SnakeCaseUser : null
  );

  // Calculate price query
  const { data: priceData, isLoading: isPriceLoading } = useQuery<PriceData>({
    queryKey: ['/api/purchase/calculate', selectedCurrency, amount],
    queryFn: async () => {
      const response = await apiRequest('POST', '/api/purchase/calculate', {
        currency: selectedCurrency,
        amount: parseFloat(amount),
      });
      return response.json();
    },
    enabled: !!amount && parseFloat(amount) > 0,
  });

  // Purchase mutation
  const purchaseMutation = useMutation({
    mutationFn: async (purchaseData: any) => {
      const response = await apiRequest('POST', '/api/purchase', purchaseData);
      return response.json();
    },
    onSuccess: (data: PaymentResponse) => {
      onHideLoading();
      hapticFeedback('success');
      
      if (data.payment_url) {
        // Открываем платежную ссылку
        window.open(data.payment_url, '_blank');
        
        toast({
          title: "Платеж создан!",
          description: "Завершите оплату в открывшемся окне",
        });
      }
      
      // Очищаем форму
      setAmount('');
      setRecipientUsername('');
      setUserError('');
      
      // Обновляем данные пользователя
      queryClient.invalidateQueries({ queryKey: ['/api/users/me'] });
    },
    onError: (error: any) => {
      onHideLoading();
      hapticFeedback('error');
      
      toast({
        title: "Ошибка создания платежа",
        description: error.message || "Попробуйте позже",
        variant: "destructive",
      });
    },
  });

  const handleCurrencyChange = (currency: Currency) => {
    hapticFeedback('light');
    setSelectedCurrency(currency);
    setAmount(''); // Очищаем сумму при смене валюты
  };

  const handlePurchase = async () => {
    if (!amount || parseFloat(amount) <= 0) {
      toast({
        title: "Ошибка",
        description: "Введите корректную сумму",
        variant: "destructive",
      });
      return;
    }

    if (!recipientUsername.trim()) {
      toast({
        title: "Ошибка", 
        description: "Введите username получателя",
        variant: "destructive",
      });
      return;
    }

    if (recipientError) {
      toast({
        title: "Ошибка",
        description: "Пользователь не найден",
        variant: "destructive",
      });
      return;
    }

    if (!priceData) {
      toast({
        title: "Ошибка",
        description: "Не удалось рассчитать стоимость",
        variant: "destructive",
      });
      return;
    }

    const minAmount = selectedCurrency === 'stars' ? 50 : 0.1;
    if (parseFloat(amount) < minAmount) {
      toast({
        title: "Ошибка",
        description: `Минимальная сумма: ${minAmount} ${selectedCurrency === 'stars' ? 'звезд' : 'TON'}`,
        variant: "destructive",
      });
      return;
    }

    hapticFeedback('medium');
    onShowLoading('Создание платежа...');
    setIsProcessing(true);

    try {
      await purchaseMutation.mutateAsync({
        currency: selectedCurrency,
        amount: parseFloat(amount),
        rub_amount: parseFloat(priceData.total_price),
        username: recipientUsername.trim(),
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // Очистка ошибок при изменении получателя
  useEffect(() => {
    if (recipientUsername.trim()) {
      setUserError('');
    }
  }, [recipientUsername]);

  return (
    <div className="space-y-6">
      {/* Currency Selection */}
      <motion.div
        className="bg-white dark:bg-[#1A1A1C] rounded-xl p-6 shadow-lg border border-gray-200 dark:border-white/10"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <h3 className="text-xl font-bold mb-4 flex items-center">
          <ShoppingCart className="w-6 h-6 mr-3 text-[#4E7FFF]" />
          Купить криптовалюту
        </h3>

        <div className="grid grid-cols-2 gap-3 mb-6">
          <motion.button
            onClick={() => handleCurrencyChange('stars')}
            className={`p-4 rounded-xl border-2 transition-all ${
              selectedCurrency === 'stars'
                ? 'border-[#4E7FFF] bg-[#4E7FFF]/10'
                : 'border-gray-200 dark:border-white/20 hover:border-[#4E7FFF]/50'
            }`}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <Star className={`w-8 h-8 mx-auto mb-2 ${
              selectedCurrency === 'stars' ? 'text-[#4E7FFF]' : 'text-gray-500'
            }`} />
            <p className="font-semibold">Telegram Stars</p>
            <p className="text-sm text-gray-500">Внутренняя валюта</p>
          </motion.button>

          <motion.button
            onClick={() => handleCurrencyChange('ton')}
            className={`p-4 rounded-xl border-2 transition-all ${
              selectedCurrency === 'ton'
                ? 'border-[#4E7FFF] bg-[#4E7FFF]/10'
                : 'border-gray-200 dark:border-white/20 hover:border-[#4E7FFF]/50'
            }`}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <Bitcoin className={`w-8 h-8 mx-auto mb-2 ${
              selectedCurrency === 'ton' ? 'text-[#4E7FFF]' : 'text-gray-500'
            }`} />
            <p className="font-semibold">TON</p>
            <p className="text-sm text-gray-500">Криптовалюта</p>
          </motion.button>
        </div>

        {/* Recipient Input */}
        <div className="mb-6">
          <Label className="text-gray-600 dark:text-gray-400 mb-2 block">
            Получатель
          </Label>
          
          {recipientAvatar ? (
            <motion.div 
              className="flex items-center p-3 bg-gray-50 dark:bg-[#0E0E10] rounded-lg border"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.2 }}
            >
              <motion.img 
                src={recipientAvatar.photo_url} 
                alt="Avatar" 
                className="w-8 h-8 rounded-full mr-3 object-cover"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.2 }}
              />
              <span className="font-medium">{recipientAvatar.first_name}</span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setRecipientUsername('');
                  setUserError('');
                }}
                className="ml-auto text-xs h-6 px-2 hover:bg-red-100 hover:text-red-600"
              >
                ×
              </Button>
            </motion.div>
          ) : (
            <div>
              <Input
                value={recipientUsername}
                onChange={(e) => {
                  setRecipientUsername(e.target.value);
                  setUserError('');
                }}
                placeholder="Введите @username получателя"
                className={`bg-white dark:bg-[#1A1A1C] border-gray-200 dark:border-white/20 ${
                  recipientError || userError ? 'border-red-500' : ''
                }`}
              />
              {(recipientError || userError || isLoadingRecipient) && (
                <motion.p 
                  className={`text-sm mt-1 ${isLoadingRecipient ? 'text-blue-500' : 'text-red-500'}`}
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  {isLoadingRecipient ? 'Поиск пользователя...' : recipientError || userError}
                </motion.p>
              )}
            </div>
          )}
        </div>

        {/* Amount Input */}
        <div className="mb-6">
          <Label className="text-gray-600 dark:text-gray-400 mb-2 block">
            Количество {selectedCurrency === 'stars' ? 'звезд' : 'TON'}
          </Label>
          <Input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder={`От ${selectedCurrency === 'stars' ? '50' : '0.1'}`}
            min={selectedCurrency === 'stars' ? 50 : 0.1}
            step={selectedCurrency === 'stars' ? 1 : 0.01}
            className="bg-white dark:bg-[#1A1A1C] border-gray-200 dark:border-white/20"
          />
          <p className="text-xs text-gray-500 mt-1">
            Минимум: {selectedCurrency === 'stars' ? '50 звезд' : '0.1 TON'}
          </p>
        </div>

        {/* Price Calculation */}
        {amount && parseFloat(amount) > 0 && (
          <motion.div
            className="bg-gradient-to-r from-[#4E7FFF]/10 to-purple-500/10 rounded-lg p-4 border border-[#4E7FFF]/20 mb-6"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            transition={{ duration: 0.3 }}
          >
            <div className="flex items-center mb-3">
              <Calculator className="w-5 h-5 text-[#4E7FFF] mr-2" />
              <h4 className="font-semibold">Расчет стоимости</h4>
            </div>
            
            {isPriceLoading ? (
              <div className="flex items-center justify-center py-4">
                <div className="animate-spin w-6 h-6 border-2 border-[#4E7FFF] border-t-transparent rounded-full"></div>
                <span className="ml-2 text-sm">Расчет стоимости...</span>
              </div>
            ) : priceData ? (
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Базовая стоимость:</span>
                  <span>{priceData.base_price} ₽</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Комиссия сервиса:</span>
                  <span>{priceData.markup_amount} ₽</span>
                </div>
                <div className="border-t border-gray-200 dark:border-white/20 pt-2">
                  <div className="flex justify-between font-bold text-lg">
                    <span>Итого к оплате:</span>
                    <span className="text-[#4E7FFF]">{priceData.total_price} ₽</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-4 text-red-500">
                Ошибка расчета стоимости
              </div>
            )}
          </motion.div>
        )}

        {/* Purchase Button */}
        <Button
          onClick={handlePurchase}
          disabled={
            isProcessing || 
            !amount || 
            parseFloat(amount) <= 0 || 
            !recipientUsername.trim() || 
            isLoadingRecipient ||
            !!recipientError ||
            !priceData
          }
          className="w-full bg-[#4E7FFF] hover:bg-blue-600 text-white py-3 text-lg font-semibold"
        >
          {isProcessing ? (
            <div className="flex items-center">
              <div className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full mr-2"></div>
              Создание платежа...
            </div>
          ) : (
            <div className="flex items-center justify-center">
              <ShoppingCart className="w-5 h-5 mr-2" />
              Купить {selectedCurrency === 'stars' ? 'Stars' : 'TON'}
            </div>
          )}
        </Button>

        {/* Info */}
        <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
          <p className="text-sm text-blue-800 dark:text-blue-200">
            💡 <strong>Как это работает:</strong> После оплаты {selectedCurrency === 'stars' ? 'звезды' : 'TON'} будут автоматически переданы указанному получателю.
          </p>
        </div>
      </motion.div>

      {/* Recent Transactions */}
      <motion.div
        className="bg-white dark:bg-[#1A1A1C] rounded-xl p-6 shadow-lg border border-gray-200 dark:border-white/10"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.1 }}
      >
        <h3 className="text-lg font-semibold mb-4">Недавние покупки</h3>
        <div className="text-center py-8 text-gray-500">
          <ShoppingCart className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>Здесь будут отображаться ваши недавние покупки</p>
        </div>
      </motion.div>
    </div>
  );
}