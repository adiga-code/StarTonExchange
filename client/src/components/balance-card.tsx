import { motion } from "framer-motion";
import { Star } from "lucide-react";
import type { User } from "@shared/schema";

interface BalanceCardProps {
  user?: User;
}

export default function BalanceCard({ user }: BalanceCardProps) {
  const starsBalance = user?.starsBalance || 0;
  // TON balance is not stored locally, only shown for reference
  const totalRubValue = starsBalance * 2.30;

  return (
    <motion.div 
      className="p-4 animate-fade-in"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="bg-gradient-to-br from-[#4E7FFF]/20 to-purple-500/20 rounded-2xl p-6 shadow-lg dark:shadow-[0_4px_20px_rgba(0,0,0,0.3)] backdrop-blur-sm border border-white/10 mb-6">
        <div className="text-center">
          <p className="text-gray-600 dark:text-gray-400 text-sm mb-2">Ваш баланс</p>
          <div className="flex items-center justify-center">
            <motion.div 
              className="text-center"
              whileHover={{ scale: 1.05 }}
            >
              <div className="flex items-center justify-center space-x-2 mb-1">
                <Star className="w-6 h-6 text-yellow-500" />
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
              <p className="text-gray-600 dark:text-gray-400 text-sm">Telegram Stars</p>
            </motion.div>
          </div>
          <motion.div 
            className="mt-4 pt-4 border-t border-white/10"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
          >
            <p className="text-gray-600 dark:text-gray-400 text-xs">Стоимость звезд</p>
            <motion.p 
              className="text-lg font-semibold"
              key={totalRubValue}
              initial={{ scale: 1 }}
              animate={{ scale: [1, 1.05, 1] }}
              transition={{ duration: 0.3 }}
            >
              ₽{totalRubValue.toLocaleString()}
            </motion.p>
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
}
