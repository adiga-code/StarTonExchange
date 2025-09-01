import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Mail, ArrowLeft, CreditCard } from 'lucide-react';

interface EmailModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (email: string) => void;
  isLoading?: boolean;
}

export function EmailModal({ 
  isOpen, 
  onClose, 
  onConfirm, 
  isLoading = false
}: EmailModalProps) {
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState('');

  // Reset email when modal opens  
  React.useEffect(() => {
    if (isOpen) {
      setEmail(''); // ← ИЗМЕНЕНО: всегда пустое поле
      setEmailError('');
    }
  }, [isOpen]);

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setEmail(value);
    
    if (emailError && value && validateEmail(value)) {
      setEmailError('');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !email.trim()) {
      setEmailError('Введите email адрес');
      return;
    }
    
    if (!validateEmail(email.trim())) {
      setEmailError('Введите корректный email адрес');
      return;
    }
    
    onConfirm(email.trim());
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md bg-white dark:bg-[#1A1A1C] border-gray-200 dark:border-white/10">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold text-center">
            Подтвердите оплату
          </DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          {/* Email Input */}
          <div className="space-y-2">
            <Label htmlFor="email" className="text-sm font-medium">
              Email для чека
            </Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-500" />
              <Input
                id="email"
                type="email"
                value={email}
                onChange={handleEmailChange}
                placeholder="your@email.com"
                className={`pl-10 ${emailError ? 'border-red-500' : ''}`}
                disabled={isLoading}
                autoFocus
              />
            </div>
            {emailError && (
              <motion.p 
                className="text-red-500 text-sm"
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
              >
                {emailError}
              </motion.p>
            )}
          </div>

          {/* Info */}
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
            <div className="flex items-start space-x-2">
              <CreditCard className="w-4 h-4 text-blue-500 mt-0.5" />
              <div className="text-sm text-blue-700 dark:text-blue-300">
                <p className="font-medium">Вы будете перенаправлены на страницу оплаты FreeKassa</p>
                <p className="text-xs mt-1">Доступны: карты, СБП, криптовалюты и другие способы</p>
              </div>
            </div>
          </div>

          {/* Buttons */}
          <div className="flex space-x-3 pt-2">
            <Button
              type="button"
              onClick={onClose}
              variant="outline"
              className="flex-1"
              disabled={isLoading}
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Назад
            </Button>
            <Button
              type="submit"
              className="flex-1 bg-[#4E7FFF] hover:bg-[#3D6FFF]"
              disabled={isLoading || !email || !validateEmail(email)}
            >
              {isLoading ? (
                <>
                  <div className="animate-spin w-4 h-4 mr-2 border-2 border-white border-t-transparent rounded-full" />
                  Создание...
                </>
              ) : (
                <>
                  <CreditCard className="w-4 h-4 mr-2" />
                  Перейти к оплате
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}