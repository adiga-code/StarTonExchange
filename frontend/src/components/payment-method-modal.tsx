import React from 'react';
import { motion } from 'framer-motion';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Smartphone, CreditCard, Bitcoin, ArrowLeft } from 'lucide-react';

interface PaymentMethodModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectSBP: () => void;
  isLoading?: boolean;
}

export function PaymentMethodModal({ isOpen, onClose, onSelectSBP, isLoading = false }: PaymentMethodModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md bg-white dark:bg-[#1A1A1C] border-gray-200 dark:border-white/10">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold text-center">
            Выберите способ оплаты
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-3 mt-4">
          {/* СБП */}
          <motion.button
            onClick={onSelectSBP}
            disabled={isLoading}
            className="w-full p-4 rounded-xl border-2 border-[#4E7FFF] bg-[#4E7FFF]/10 hover:bg-[#4E7FFF]/20 transition-all flex items-center space-x-4"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <div className="w-12 h-12 bg-[#4E7FFF] rounded-lg flex items-center justify-center">
              <Smartphone className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1 text-left">
              <h3 className="font-semibold">Система быстрых платежей</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">Мгновенный перевод через банк</p>
            </div>
          </motion.button>

          {/* Банковская карта */}
          <motion.div
            className="w-full p-4 rounded-xl border-2 border-gray-300 dark:border-white/20 bg-gray-100 dark:bg-gray-800/50 opacity-60 flex items-center space-x-4"
            whileHover={{ scale: 1.01 }}
          >
            <div className="w-12 h-12 bg-gray-400 rounded-lg flex items-center justify-center">
              <CreditCard className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1 text-left">
              <h3 className="font-semibold">Банковская карта</h3>
              <p className="text-sm text-gray-500">Скоро будет доступно</p>
            </div>
          </motion.div>

          {/* Криптовалюта */}
          <motion.div
            className="w-full p-4 rounded-xl border-2 border-gray-300 dark:border-white/20 bg-gray-100 dark:bg-gray-800/50 opacity-60 flex items-center space-x-4"
            whileHover={{ scale: 1.01 }}
          >
            <div className="w-12 h-12 bg-gray-400 rounded-lg flex items-center justify-center">
              <Bitcoin className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1 text-left">
              <h3 className="font-semibold">Криптовалюта</h3>
              <p className="text-sm text-gray-500">Скоро будет доступно</p>
            </div>
          </motion.div>
        </div>

        {/* Кнопка назад */}
        <Button
          variant="outline"
          onClick={onClose}
          className="w-full mt-4"
          disabled={isLoading}
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Назад
        </Button>
      </DialogContent>
    </Dialog>
  );
}