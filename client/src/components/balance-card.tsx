import { motion } from "framer-motion";
import { Star, Bitcoin } from "lucide-react";
import type { User } from "@shared/schema";

interface BalanceCardProps {
  user?: User;
}

export default function BalanceCard({ user }: BalanceCardProps) {
  const starsBalance = user?.starsBalance || 0;
  const tonBalance = parseFloat(user?.tonBalance || "0");
  const totalRubValue = (starsBalance * 2.30) + (tonBalance * 420.50);

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
          <div className="flex items-center justify-center space-x-6">
            <motion.div 
              className="text-center"
              whileHover={{ scale: 1.05 }}
            >
              <div className="flex items-center justify-center space-x-2 mb-1">
                <Star className="w-5 h-5 text-yellow-500" />
                <motion.span 
                  className="text-2xl font-bold"
                  key={starsBalance}
                  initial={{ scale: 1 }}
                  animate={{ scale: [1, 1.1, 1] }}
                  transition={{ duration: 0.3 }}
                >
                  {starsBalance.toLocaleString()}
                </motion.span>
              </div>
              <p className="text-gray-600 dark:text-gray-400 text-xs">Stars</p>
            </motion.div>
            <motion.div 
              className="text-center"
              whileHover={{ scale: 1.05 }}
            >
              <div className="flex items-center justify-center space-x-2 mb-1">
                <Bitcoin className="w-5 h-5 text-[#4E7FFF]" />
                <motion.span 
                  className="text-2xl font-bold"
                  key={tonBalance}
                  initial={{ scale: 1 }}
                  animate={{ scale: [1, 1.1, 1] }}
                  transition={{ duration: 0.3 }}
                >
                  {tonBalance.toFixed(2)}
                </motion.span>
              </div>
              <p className="text-gray-600 dark:text-gray-400 text-xs">TON</p>
            </motion.div>
          </div>
          <motion.div 
            className="mt-4 pt-4 border-t border-white/10"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
          >
            <p className="text-gray-600 dark:text-gray-400 text-xs">Общая стоимость</p>
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
