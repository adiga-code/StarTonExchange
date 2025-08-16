import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { 
  Shield, 
  BarChart3, 
  Tag, 
  History, 
  Users, 
  DollarSign, 
  Activity,
  CheckSquare,
  Plus,
  Edit,
  PauseCircle,
  PlayCircle,
  Trash2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface AdminPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

interface NewTask {
  title: string;
  description: string;
  reward: number;
  type: string;
  action: string;
  isActive: boolean;
}

export default function AdminPanel({ isOpen, onClose }: AdminPanelProps) {
  const [starsPrice, setStarsPrice] = useState('2.30');
  const [tonPrice, setTonPrice] = useState('420.50');
  const [markupPercentage, setMarkupPercentage] = useState('5');
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [editingTask, setEditingTask] = useState<string | null>(null);
  const [newTask, setNewTask] = useState<NewTask>({
    title: '',
    description: '',
    reward: 0,
    type: 'daily',
    action: '',
    isActive: true
  });
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Получение статистики админа
  const { data: adminStats } = useQuery({
    queryKey: ['/api/admin/stats'],
    enabled: isOpen,
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/admin/stats');
      return response.json();
    },
  });

  // Получение списка задач
  const { data: tasks = [] } = useQuery({
    queryKey: ['/api/admin/tasks'],
    enabled: isOpen,
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/admin/tasks');
      return response.json();
    },
  });

  // Мутация для обновления настроек
  const updateSettingsMutation = useMutation({
    mutationFn: async (settings: { starsPrice: string; tonPrice: string; markupPercentage: string }) => {
      const response = await apiRequest('PUT', '/api/admin/settings', settings);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Настройки обновлены",
        description: "Цены успешно обновлены",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/stats'] });
    },
    onError: () => {
      toast({
        title: "Ошибка",
        description: "Не удалось обновить настройки",
        variant: "destructive",
      });
    },
  });

  // Мутация для создания задач
  const createTaskMutation = useMutation({
    mutationFn: async (taskData: NewTask) => {
      const response = await apiRequest('POST', '/api/admin/tasks', {
        title: taskData.title,
        description: taskData.description,
        reward: taskData.reward,
        type: taskData.type,
        action: taskData.action,
        is_active: taskData.isActive
      });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Задание создано",
        description: "Новое задание успешно добавлено",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/tasks'] });
      setShowTaskForm(false);
      setNewTask({
        title: '',
        description: '',
        reward: 0,
        type: 'daily',
        action: '',
        isActive: true
      });
    },
    onError: () => {
      toast({
        title: "Ошибка",
        description: "Не удалось создать задание",
        variant: "destructive",
      });
    },
  });

  // Мутация для обновления задач
  const updateTaskMutation = useMutation({
    mutationFn: async ({ taskId, updates }: { taskId: string, updates: any }) => {
      const response = await apiRequest('PUT', `/api/admin/tasks/${taskId}`, updates);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Задание обновлено",
        description: "Изменения сохранены",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/tasks'] });
      setEditingTask(null);
    },
    onError: () => {
      toast({
        title: "Ошибка",
        description: "Не удалось обновить задание",
        variant: "destructive",
      });
    },
  });

  // Мутация для удаления задач
  const deleteTaskMutation = useMutation({
    mutationFn: async (taskId: string) => {
      const response = await apiRequest('DELETE', `/api/admin/tasks/${taskId}`);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Задание удалено",
        description: "Задание успешно удалено",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/tasks'] });
    },
    onError: () => {
      toast({
        title: "Ошибка",
        description: "Не удалось удалить задание",
        variant: "destructive",
      });
    },
  });

  const handleUpdatePrices = () => {
    updateSettingsMutation.mutate({
      starsPrice,
      tonPrice,
      markupPercentage,
    });
  };

  const handleCreateTask = () => {
    if (!newTask.title || !newTask.description || newTask.reward <= 0) {
      toast({
        title: "Ошибка",
        description: "Заполните все обязательные поля",
        variant: "destructive",
      });
      return;
    }
    createTaskMutation.mutate(newTask);
  };

  const handleToggleTaskActive = (taskId: string, isActive: boolean) => {
    updateTaskMutation.mutate({
      taskId,
      updates: { is_active: !isActive }
    });
  };

  const handleDeleteTask = (taskId: string) => {
    if (confirm('Вы уверены, что хотите удалить это задание?')) {
      deleteTaskMutation.mutate(taskId);
    }
  };

  return (
    <div className="min-h-screen bg-white dark:bg-[#0E0E10] text-gray-900 dark:text-white">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/80 dark:bg-[#0E0E10]/80 backdrop-blur-lg border-b border-gray-200 dark:border-white/10">
        <div className="flex items-center justify-between p-4">
          <Button onClick={onClose} variant="ghost" size="icon">
            ←
          </Button>
          <h1 className="text-lg font-bold flex items-center">
            <Shield className="w-5 h-5 text-[#4E7FFF] mr-2" />
            Админ панель
          </h1>
          <div></div>
        </div>
      </header>

      <main className="p-4 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Статистика */}
          <motion.div 
            className="bg-white dark:bg-[#1A1A1C] rounded-xl p-4 shadow-lg"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <h3 className="font-semibold mb-3 flex items-center">
              <BarChart3 className="w-4 h-4 text-[#4E7FFF] mr-2" />
              Статистика
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="text-center p-3 bg-gray-50 dark:bg-[#0E0E10] rounded-lg">
                <div className="text-2xl font-bold text-[#4E7FFF]">
                  {adminStats?.totalUsers || 0}
                </div>
                <div className="text-xs text-gray-600 dark:text-gray-400">Пользователей</div>
              </div>
              <div className="text-center p-3 bg-gray-50 dark:bg-[#0E0E10] rounded-lg">
                <div className="text-2xl font-bold text-green-500">
                  ₽{adminStats?.todaySales || '0.00'}
                </div>
                <div className="text-xs text-gray-600 dark:text-gray-400">Продажи сегодня</div>
              </div>
              <div className="text-center p-3 bg-gray-50 dark:bg-[#0E0E10] rounded-lg">
                <div className="text-2xl font-bold text-purple-500">
                  {adminStats?.activeReferrals || 0}
                </div>
                <div className="text-xs text-gray-600 dark:text-gray-400">Активных рефералов</div>
              </div>
              <div className="text-center p-3 bg-gray-50 dark:bg-[#0E0E10] rounded-lg">
                <div className="text-2xl font-bold text-yellow-500">
                  {tasks.length || 0}
                </div>
                <div className="text-xs text-gray-600 dark:text-gray-400">Всего заданий</div>
              </div>
            </div>
          </motion.div>

          {/* Управление ценами */}
          <motion.div 
            className="bg-white dark:bg-[#1A1A1C] rounded-xl p-4 shadow-lg"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <h3 className="font-semibold mb-3 flex items-center">
              <Tag className="w-4 h-4 text-yellow-500 mr-2" />
              Управление ценами
            </h3>
            <div className="space-y-3">
              <div>
                <Label className="text-sm text-gray-600 dark:text-gray-400">
                  Цена за звезду (₽)
                </Label>
                <Input
                  type="number"
                  value={starsPrice}
                  onChange={(e) => setStarsPrice(e.target.value)}
                  step="0.01"
                  className="mt-1 bg-gray-50 dark:bg-[#0E0E10] border-gray-200 dark:border-white/20"
                />
              </div>
              <div>
                <Label className="text-sm text-gray-600 dark:text-gray-400">
                  Цена за TON (₽)
                </Label>
                <Input
                  type="number"
                  value={tonPrice}
                  onChange={(e) => setTonPrice(e.target.value)}
                  step="0.01"
                  className="mt-1 bg-gray-50 dark:bg-[#0E0E10] border-gray-200 dark:border-white/20"
                />
              </div>
              <div>
                <Label className="text-sm text-gray-600 dark:text-gray-400">
                  Наценка (%)
                </Label>
                <Input
                  type="number"
                  value={markupPercentage}
                  onChange={(e) => setMarkupPercentage(e.target.value)}
                  step="0.1"
                  className="mt-1 bg-gray-50 dark:bg-[#0E0E10] border-gray-200 dark:border-white/20"
                />
              </div>
              <Button
                onClick={handleUpdatePrices}
                disabled={updateSettingsMutation.isPending}
                className="w-full bg-[#4E7FFF] hover:bg-[#3D6FFF] text-white"
              >
                {updateSettingsMutation.isPending ? 'Обновляется...' : 'Обновить цены'}
              </Button>
            </div>
          </motion.div>
        </div>

        {/* Управление задачами */}
        <motion.div 
          className="bg-white dark:bg-[#1A1A1C] rounded-xl p-4 shadow-lg"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold flex items-center">
              <CheckSquare className="w-4 h-4 text-green-500 mr-2" />
              Управление заданиями
            </h3>
            <Button
              onClick={() => setShowTaskForm(!showTaskForm)}
              className="bg-green-500 hover:bg-green-600 text-white"
              size="sm"
            >
              <Plus className="w-4 h-4 mr-1" />
              Добавить задание
            </Button>
          </div>

          {/* Форма создания задания */}
          <AnimatePresence>
            {showTaskForm && (
              <motion.div 
                className="bg-gray-50 dark:bg-[#0E0E10] rounded-lg p-4 mb-4 border border-gray-200 dark:border-white/10"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <Label className="text-sm text-gray-600 dark:text-gray-400">Название</Label>
                    <Input
                      value={newTask.title}
                      onChange={(e) => setNewTask({...newTask, title: e.target.value})}
                      placeholder="Название задания"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-sm text-gray-600 dark:text-gray-400">Награда (звезды)</Label>
                    <Input
                      type="number"
                      value={newTask.reward}
                      onChange={(e) => setNewTask({...newTask, reward: parseInt(e.target.value) || 0})}
                      placeholder="10"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-sm text-gray-600 dark:text-gray-400">Тип</Label>
                    <Select value={newTask.type} onValueChange={(value) => setNewTask({...newTask, type: value})}>
                      <SelectTrigger className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="daily">Ежедневное</SelectItem>
                        <SelectItem value="social">Социальное</SelectItem>
                        <SelectItem value="referral">Реферальное</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-sm text-gray-600 dark:text-gray-400">Действие</Label>
                    <Select value={newTask.action} onValueChange={(value) => setNewTask({...newTask, action: value})}>
                      <SelectTrigger className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">Без действия</SelectItem>
                        <SelectItem value="daily_login">Ежедневный вход</SelectItem>
                        <SelectItem value="share_app">Поделиться приложением</SelectItem>
                        <SelectItem value="follow_channel">Подписаться на канал</SelectItem>
                        <SelectItem value="join_group">Вступить в группу</SelectItem>
                        <SelectItem value="invite_friends">Пригласить друзей</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="md:col-span-2">
                    <Label className="text-sm text-gray-600 dark:text-gray-400">Описание</Label>
                    <Textarea
                      value={newTask.description}
                      onChange={(e) => setNewTask({...newTask, description: e.target.value})}
                      placeholder="Описание задания..."
                      className="mt-1"
                      rows={3}
                    />
                  </div>
                </div>
                <div className="flex items-center justify-between mt-4">
                  <div className="flex items-center space-x-2">
                    <Switch
                      checked={newTask.isActive}
                      onCheckedChange={(checked) => setNewTask({...newTask, isActive: checked})}
                    />
                    <Label className="text-sm">Активное задание</Label>
                  </div>
                  <div className="space-x-2">
                    <Button
                      onClick={() => setShowTaskForm(false)}
                      variant="outline"
                      size="sm"
                    >
                      Отмена
                    </Button>
                    <Button
                      onClick={handleCreateTask}
                      disabled={createTaskMutation.isPending}
                      className="bg-green-500 hover:bg-green-600 text-white"
                      size="sm"
                    >
                      {createTaskMutation.isPending ? 'Создание...' : 'Создать'}
                    </Button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Список существующих задач */}
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {tasks.map((task: any) => (
              <div
                key={task.id}
                className="flex items-center justify-between p-3 bg-gray-50 dark:bg-[#0E0E10] rounded-lg border border-gray-200 dark:border-white/10"
              >
                <div className="flex-1">
                  <div className="flex items-center space-x-2">
                    <h4 className="font-medium">{task.title}</h4>
                    <span className={`px-2 py-1 text-xs rounded-full ${
                      task.is_active 
                        ? 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400' 
                        : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                    }`}>
                      {task.is_active ? 'Активно' : 'Неактивно'}
                    </span>
                    <span className="px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
                      {task.type}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{task.description}</p>
                  <div className="flex items-center space-x-3 mt-2 text-xs text-gray-500">
                    <span>+{task.reward} ⭐</span>
                    {task.action && <span>Действие: {task.action}</span>}
                    <span>Создано: {new Date(task.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Button
                    onClick={() => handleToggleTaskActive(task.id, task.is_active)}
                    variant="outline"
                    size="sm"
                    className={task.is_active ? 'text-orange-600 hover:text-orange-700' : 'text-green-600 hover:text-green-700'}
                  >
                    {task.is_active ? <PauseCircle className="w-4 h-4" /> : <PlayCircle className="w-4 h-4" />}
                  </Button>
                  <Button
                    onClick={() => handleDeleteTask(task.id)}
                    variant="outline"
                    size="sm"
                    className="text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
            {tasks.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                <CheckSquare className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>Заданий пока нет</p>
              </div>
            )}
          </div>
        </motion.div>

        {/* Последние транзакции */}
        <motion.div 
          className="bg-white dark:bg-[#1A1A1C] rounded-xl p-4 shadow-lg"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <h3 className="font-semibold mb-3 flex items-center">
            <History className="w-4 h-4 text-[#4E7FFF] mr-2" />
            Последние транзакции
          </h3>
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {adminStats?.recentTransactions?.length ? (
              adminStats.recentTransactions.map((transaction: any) => (
                <div
                  key={transaction.id}
                  className="flex items-center justify-between p-3 bg-gray-50 dark:bg-[#0E0E10] rounded-lg border border-gray-200 dark:border-white/10"
                >
                  <div>
                    <p className="font-medium">{transaction.username}</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">{transaction.description}</p>
                  </div>
                  <div className="text-right">
                    <p className={`font-semibold ${
                      transaction.status === 'completed' ? 'text-green-500' : 
                      transaction.status === 'failed' ? 'text-red-500' : 'text-yellow-500'
                    }`}>
                      {transaction.status}
                    </p>
                    <p className="text-xs text-gray-500">
                      {new Date(transaction.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-gray-500">
                <Activity className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>Транзакций пока нет</p>
              </div>
            )}
          </div>
        </motion.div>
      </main>
    </div>
  );
}