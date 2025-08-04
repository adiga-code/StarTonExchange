import { useState } from "react";
import { motion } from "framer-motion";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useTelegram } from "@/hooks/use-telegram";
import { Star, Bitcoin, ShoppingCart, Calculator } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { User } from "@shared/schema";

interface BuyTabProps {
  user?: User;
  onShowLoading: (message: string) => void;
  onHideLoading: () => void;
}

type Currency = 'stars' | 'ton';

export default function BuyTab({ user, onShowLoading, onHideLoading }: BuyTabProps) {
  const [selectedCurrency, setSelectedCurrency] = useState<Currency>('stars');
  const [amount, setAmount] = useState('');
  const { toast } = useToast();
  const { hapticFeedback } = useTelegram();
  const queryClient = useQueryClient();

  // Calculate price
  const { data: priceCalculation } = useQuery({
    queryKey: ['/api/purchase/calculate', selectedCurrency, amount],
    enabled: !!amount && parseFloat(amount) > 0,
    queryFn: async () => {
      const response = await apiRequest('POST', '/api/purchase/calculate', {
        currency: selectedCurrency,
        amount: parseFloat(amount),
      });
      return response.json();
    },
  });

  // Purchase mutation
  const purchaseMutation = useMutation({
    mutationFn: async (data: { currency: string; amount: number; rubAmount: number }) => {
      const response = await apiRequest('POST', '/api/purchase', data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/users/me'] });
      setAmount('');
      toast({
        title: "Покупка успешна!",
        description: `Успешно приобретено ${amount} ${selectedCurrency === 'stars' ? 'звезд' : 'TON'}`,
      });
    },
    onError: () => {
      toast({
        title: "Ошибка покупки",
        description: "Произошла ошибка при обработке платежа",
        variant: "destructive",
      });
    },
  });

  const handleCurrencySelect = (currency: Currency) => {
    hapticFeedback('light');
    setSelectedCurrency(currency);
  };

  const handleQuickBuy = (quickAmount: number) => {
    hapticFeedback('light');
    setAmount(quickAmount.toString());
  };

  const handlePurchase = async () => {
    if (!amount || parseFloat(amount) <= 0 || !priceCalculation) return;

    hapticFeedback('success');
    
    onShowLoading('Подключение к платежной системе...');
    
    setTimeout(() => {
      onShowLoading('Проверка платежа...');
    }, 1500);

    setTimeout(() => {
      onShowLoading('Перевод валюты...');
    }, 3000);

    setTimeout(async () => {
      try {
        await purchaseMutation.mutateAsync({
          currency: selectedCurrency,
          amount: parseFloat(amount),
          rubAmount: parseFloat(priceCalculation.totalPrice),
        });
        onHideLoading();
      } catch (error) {
        onHideLoading();
      }
    }, 4500);
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
      {/* Currency Selector */}
      <motion.div 
        className="bg-white dark:bg-[#1A1A1C] rounded-xl p-4 shadow-lg dark:shadow-[0_4px_20px_rgba(0,0,0,0.3)] border border-gray-200 dark:border-white/10"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <h3 className="text-lg font-semibold mb-4 flex items-center">
          <Calculator className="w-5 h-5 mr-2 text-[#4E7FFF]" />
          Выберите валюту
        </h3>
        <div className="grid grid-cols-2 gap-3">
          <motion.button
            onClick={() => handleCurrencySelect('stars')}
            className={`p-4 rounded-xl border-2 transition-all ${
              selectedCurrency === 'stars'
                ? 'border-[#4E7FFF] bg-[#4E7FFF]/10'
                : 'border-gray-200 dark:border-white/10 hover:border-[#4E7FFF]/50'
            }`}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <Star className="w-8 h-8 text-yellow-500 mx-auto mb-2" />
            <p className="font-semibold">Telegram Stars</p>
            <p className="text-gray-600 dark:text-gray-400 text-xs">₽{prices.stars} за звезду</p>
          </motion.button>
          <motion.button
            onClick={() => handleCurrencySelect('ton')}
            className={`p-4 rounded-xl border-2 transition-all ${
              selectedCurrency === 'ton'
                ? 'border-[#4E7FFF] bg-[#4E7FFF]/10'
                : 'border-gray-200 dark:border-white/10 hover:border-[#4E7FFF]/50'
            }`}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <Bitcoin className="w-8 h-8 text-[#4E7FFF] mx-auto mb-2" />
            <p className="font-semibold">TON Coin</p>
            <p className="text-gray-600 dark:text-gray-400 text-xs">₽{prices.ton} за TON</p>
          </motion.button>
        </div>
      </motion.div>

      {/* Purchase Calculator */}
      <motion.div 
        className="bg-white dark:bg-[#1A1A1C] rounded-xl p-4 shadow-lg dark:shadow-[0_4px_20px_rgba(0,0,0,0.3)] border border-gray-200 dark:border-white/10"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.1 }}
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
              />
              <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400">
                {selectedCurrency === 'stars' ? '⭐' : '₿'}
              </div>
            </div>
          </div>
          
          {priceCalculation && (
            <motion.div 
              className="bg-gray-50 dark:bg-[#0E0E10] rounded-lg p-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3 }}
            >
              <div className="flex justify-between items-center mb-2">
                <span className="text-gray-600 dark:text-gray-400">Стоимость:</span>
                <span className="font-semibold">₽{priceCalculation.basePrice}</span>
              </div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-gray-600 dark:text-gray-400">Наценка (5%):</span>
                <span className="font-semibold text-yellow-500">₽{priceCalculation.markupAmount}</span>
              </div>
              <div className="border-t border-gray-200 dark:border-white/10 pt-2">
                <div className="flex justify-between items-center">
                  <span className="font-semibold">Итого:</span>
                  <span className="text-xl font-bold text-[#4E7FFF]">₽{priceCalculation.totalPrice}</span>
                </div>
              </div>
            </motion.div>
          )}

          <Button
            onClick={handlePurchase}
            disabled={!amount || parseFloat(amount) <= 0 || purchaseMutation.isPending}
            className="w-full bg-[#4E7FFF] hover:bg-[#3D6FFF] text-white font-semibold py-4 rounded-xl glow-button disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ShoppingCart className="w-4 h-4 mr-2" />
            {purchaseMutation.isPending ? 'Обработка...' : 'Купить'}
          </Button>
        </div>
      </motion.div>

      {/* Quick Buy Options */}
      <motion.div 
        className="bg-white dark:bg-[#1A1A1C] rounded-xl p-4 shadow-lg dark:shadow-[0_4px_20px_rgba(0,0,0,0.3)] border border-gray-200 dark:border-white/10"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.2 }}
      >
        <h3 className="text-lg font-semibold mb-4">Быстрая покупка</h3>
        <div className="grid grid-cols-2 gap-3">
          {quickBuyOptions.map((optionAmount) => (
            <motion.button
              key={optionAmount}
              onClick={() => handleQuickBuy(optionAmount)}
              className="p-3 rounded-lg bg-gray-50 dark:bg-[#0E0E10] hover:bg-[#4E7FFF]/20 border border-gray-200 dark:border-white/10 hover:border-[#4E7FFF] transition-all"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <div className="text-center">
                <p className="font-semibold">
                  {optionAmount} {selectedCurrency === 'stars' ? '⭐' : '₿'}
                </p>
                <p className="text-gray-600 dark:text-gray-400 text-sm">
                  ₽{(optionAmount * prices[selectedCurrency] * 1.05).toLocaleString()}
                </p>
              </div>
            </motion.button>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
