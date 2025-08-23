import React from "react";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Star } from "@/components/ui/custom-icons";
import ButtonWithdrawal from "./ui/button-withdrawal"; // Обновленный импорт
import { useToast } from "@/hooks/use-toast";
import type { SnakeCaseUser } from "@shared/schema";

interface BalanceCardProps {
  user?: SnakeCaseUser;
}

export default function BalanceCard({ user }: BalanceCardProps) {
  const { toast } = useToast();
  const starsBalance = user?.stars_balance ?? 0;

  // ✅ Получаем актуальные цены из API
  const { data: adminSettings } = useQuery({
    queryKey: ['/api/admin/settings/current'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/admin/settings/current');
      return response.json();
    },
    refetchOnWindowFocus: true,
    refetchOnMount: true,
    refetchInterval: 10000, // Каждые 10 секунд
  });

  // ✅ Динамический расчет с fallback
  const starsPrice = adminSettings?.stars_price ? parseFloat(adminSettings.stars_price) : 2.30;
  const totalRubValue = starsBalance * starsPrice;

  return (
    <motion.div
      className="mx-4 mb-6"
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <div className="bg-gradient-to-br from-[#4E7FFF] to-purple-500 rounded-2xl p-6 text-white shadow-xl">
        <motion.h2
          className="text-lg font-semibold mb-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
        >
          Мой баланс
        </motion.h2>
        
        <div className="space-y-4">
          <div className="flex items-center justify-center">
            <div className="flex items-center">
              <Star className="w-6 h-6 text-yellow-300 mr-3" />
              <div>
                <motion.span
                  className="text-3xl font-bold"
                  key={starsBalance}
                  initial={{ scale: 1 }}
                  animate={{ scale: [1, 1.1, 1] }}
                  transition={{ duration: 0.3 }}
                >
                  {starsBalance.toLocaleString()}
                </motion.span>
              </div>
              {/* <p className="text-gray-200 text-sm ml-2">Telegram Stars</p> */}
            </div>
          </div>
          
          <motion.div
            className="mt-4 pt-4 border-t border-white/10 flex items-center justify-between"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
          >
            <div className="text-center">
              <p className="text-gray-200 text-xs">Стоимость звезд</p>
              <motion.p
                className="text-lg font-semibold"
                key={totalRubValue}
                initial={{ scale: 1 }}
                animate={{ scale: [1, 1.05, 1] }}
                transition={{ duration: 0.3 }}
              >
                ₽{totalRubValue.toLocaleString()}
              </motion.p>
              {/* <div className="text-xs text-gray-200 mt-1">
                {starsBalance.toLocaleString()} × ₽{starsPrice} за звезду
              </div> */}
            </div>
            <ButtonWithdrawal
              onClick={() => {
                toast({
                  title: "Вывод",
                  description: "Функция вывода звезд в разработке",
                });
              }}
            />
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
}