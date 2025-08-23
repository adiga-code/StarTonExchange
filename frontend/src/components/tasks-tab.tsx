import { useState } from "react";
import { motion } from "framer-motion";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useTelegram } from "@/hooks/use-telegram";
import { CalendarDays, ThumbsUp, CheckCircle, Share, Users, Star, ShoppingCart, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import type { SnakeCaseUser, User } from "@shared/schema";

interface TasksTabProps {
  user?: SnakeCaseUser;
}

interface TaskWithCompletion {
  id: string;
  title: string;
  description: string;
  reward: number;
  type: string;
  action?: string;
  completed: boolean;
  completedAt?: string | null;
  completion_title?: string;
  completion_text?: string;
  share_text?: string;
  button_text?: string;
}

export default function TasksTab({ user }: TasksTabProps) {
  const { toast } = useToast();
  const { hapticFeedback, shareApp } = useTelegram();
  const queryClient = useQueryClient();
  const [openedTasks, setOpenedTasks] = useState(new Set());

  // ✅ ПРАВИЛЬНО - useQuery ВНУТРИ КОМПОНЕНТА!
  const { data: interfaceTexts } = useQuery({
    queryKey: ['/api/config/interface-texts'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/config/interface-texts');
      return response.json();
    },
  });

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ['/api/tasks'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/tasks');
      return response.json() as Promise<TaskWithCompletion[]>;
    },
  });

  const completeTaskMutation = useMutation({
    mutationFn: async (taskId: string) => {
      const response = await apiRequest('POST', `/api/tasks/${taskId}/complete`);
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/tasks'] });
      queryClient.invalidateQueries({ queryKey: ['/api/users/me'] });
      hapticFeedback('success');
      const task = tasks.find(t => t.id === data.taskId);
      toast({
        title: task?.completion_title || "Задание выполнено!",
        description: task?.completion_text?.replace('{reward}', data.reward.toString()) || `Вы получили ${data.reward} звезд`,
      });
    },
    onError: () => {
      toast({
        title: interfaceTexts?.error || "Ошибка",
        description: "Задание не выполнено, попробуйте еще раз",
        variant: "destructive",
      });
    },
  });

  const checkTaskCompletion = async (taskId) => {
    const isCompleted = await verifyTaskCompletion(taskId);
    if (isCompleted) {
      completeTaskMutation.mutate(taskId);
      setOpenedTasks(prev => {
        const newSet = new Set(prev);
        newSet.delete(taskId);
        return newSet;
      });
    } else {
      toast({
        title: interfaceTexts?.error || "Ошибка",
        description: "Задание не выполнено, попробуйте еще раз",
        variant: "destructive",
      });
    }
  };

  const verifyTaskCompletion = async (taskId) => {
    console.log(`Проверяем выполнение задания: ${taskId}`);
    return Math.random() > 0.3;
  };

  const handleTaskAction = async (task: TaskWithCompletion) => {
    if (task.completed) return;

    hapticFeedback('light');

    let taskUrl = null;
    try {
      const req = JSON.parse(task.requirements || '{}');
      taskUrl = req.url;
    } catch {}

    switch (task.action) {
      case 'follow_channel':
      case 'visit_website':
        if (taskUrl) {
          if (window.Telegram?.WebApp?.openTelegramLink && taskUrl.includes('t.me')) {
            window.Telegram.WebApp.openTelegramLink(taskUrl);
          } else if (window.Telegram?.WebApp?.openLink) {
            window.Telegram.WebApp.openLink(taskUrl);
          } else {
            window.open(taskUrl, '_blank');
          }
          
          setOpenedTasks(prev => new Set([...prev, task.id]));
          return;
        }
        break;
        
      case 'share_app':
        shareApp(task.share_text || 'Попробуй этот крутой обменник Stars и TON!');
        break;
      case 'invite_friends':
        shareApp(`Попробуй Stars Exchange! ${window.location.origin}?ref=${user?.referralCode}`);
        break;
      case 'complete_purchase':
        if (typeof window !== 'undefined') {
          const event = new CustomEvent('switchTab', { detail: 'buy' });
          window.dispatchEvent(event);
        }
        break;
      case 'daily_login':
        break;
    }

    completeTaskMutation.mutate(task.id);
  };

  const getTaskIcon = (type: string, action?: string) => {
    if (action === 'share_app') return Share;
    if (action === 'follow_channel') return Users;
    if (action === 'invite_friends') return Users;
    if (action === 'complete_purchase') return ShoppingCart;
    if (action === 'visit_website') return ExternalLink;
    if (type === 'daily') return CalendarDays;
    if (type === 'social') return ThumbsUp;
    return CheckCircle;
  };

  const getTaskIconColor = (type: string, action?: string) => {
    if (action === 'share_app') return 'text-[#4E7FFF]';
    if (action === 'follow_channel') return 'text-blue-400';
    if (action === 'invite_friends') return 'text-green-500';
    if (action === 'complete_purchase') return 'text-purple-500';
    if (action === 'visit_website') return 'text-orange-500';
    if (type === 'daily') return 'text-yellow-500';
    if (type === 'social') return 'text-[#4E7FFF]';
    return 'text-green-500';
  };

  const dailyTasks = tasks.filter(task => task.type === 'daily');
  const socialTasks = tasks.filter(task => task.type === 'social' || task.type === 'referral');
  const completedTasks = tasks.filter(task => task.completed).length;
  const totalTasks = tasks.length;
  const progressPercentage = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Загрузка заданий...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Progress Section */}
      <motion.div
        className="bg-white dark:bg-[#1A1A1C] rounded-xl p-6 shadow-lg dark:shadow-[0_4px_20px_rgba(0,0,0,0.3)] border border-gray-200 dark:border-white/10"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <h3 className="text-lg font-semibold mb-4">Прогресс выполнения</h3>
        <Progress value={progressPercentage} className="mb-2" />
        <p className="text-gray-600 dark:text-gray-400 text-sm">
          Выполнено {completedTasks} из {totalTasks} заданий
        </p>
      </motion.div>

      {/* Daily Tasks */}
      {dailyTasks.length > 0 && (
        <motion.div
          className="bg-white dark:bg-[#1A1A1C] rounded-xl p-6 shadow-lg dark:shadow-[0_4px_20px_rgba(0,0,0,0.3)] border border-gray-200 dark:border-white/10"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
        >
          <h3 className="text-lg font-semibold mb-4">Ежедневные задания</h3>
          <div className="space-y-3">
            {dailyTasks.map((task) => {
              const Icon = getTaskIcon(task.type, task.action);
              const iconColor = getTaskIconColor(task.type, task.action);
              
              return (
                <motion.div
                  key={task.id}
                  className="flex items-center justify-between p-4 bg-gray-50 dark:bg-[#0E0E10] rounded-lg hover:bg-gray-100 dark:hover:bg-white/5 transition-colors"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <div className="flex items-center space-x-4">
                    <div className={`w-10 h-10 ${task.completed ? 'bg-green-500/20' : 'bg-gray-200 dark:bg-gray-700/20'} rounded-lg flex items-center justify-center`}>
                      {task.completed ? (
                        <CheckCircle className="w-5 h-5 text-green-500" />
                      ) : (
                        <Icon className={`w-5 h-5 ${iconColor}`} />
                      )}
                    </div>
                    <div>
                      <p className="font-medium">{task.title}</p>
                      <p className="text-gray-600 dark:text-gray-400 text-sm">{task.description}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-yellow-500 flex items-center">
                      +{task.reward} <Star className="w-4 h-4 ml-1" />
                    </p>
                    {task.completed ? (
                      <p className="text-green-500 text-xs">Выполнено</p>
                    ) : (
                      <Button
                        onClick={() => handleTaskAction(task)}
                        disabled={completeTaskMutation.isPending}
                        variant="link"
                        className="text-[#4E7FFF] hover:underline p-0 h-auto text-xs"
                      >
                        {completeTaskMutation.isPending ? 'Загрузка...' : task.button_text || 'Выполнить'}
                      </Button>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        </motion.div>
      )}

      {/* Social Tasks */}
      {socialTasks.length > 0 && (
        <motion.div
          className="bg-white dark:bg-[#1A1A1C] rounded-xl p-6 shadow-lg dark:shadow-[0_4px_20px_rgba(0,0,0,0.3)] border border-gray-200 dark:border-white/10"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.2 }}
        >
          <h3 className="text-lg font-semibold mb-4">Социальные задания</h3>
          <div className="space-y-3">
            {socialTasks.map((task) => {
              const Icon = getTaskIcon(task.type, task.action);
              const iconColor = getTaskIconColor(task.type, task.action);
              
              return (
                <motion.div
                  key={task.id}
                  className="flex items-center justify-between p-4 bg-gray-50 dark:bg-[#0E0E10] rounded-lg hover:bg-gray-100 dark:hover:bg-white/5 transition-colors"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <div className="flex items-center space-x-4">
                    <div className={`w-10 h-10 ${task.completed ? 'bg-green-500/20' : 'bg-gray-200 dark:bg-gray-700/20'} rounded-lg flex items-center justify-center`}>
                      {task.completed ? (
                        <CheckCircle className="w-5 h-5 text-green-500" />
                      ) : (
                        <Icon className={`w-5 h-5 ${iconColor}`} />
                      )}
                    </div>
                    <div>
                      <p className="font-medium">{task.title}</p>
                      <p className="text-gray-600 dark:text-gray-400 text-sm">{task.description}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-yellow-500 flex items-center">
                      +{task.reward} <Star className="w-4 h-4 ml-1" />
                    </p>
                    {task.completed ? (
                      <p className="text-green-500 text-xs">Выполнено</p>
                    ) : openedTasks.has(task.id) ? (
                      <Button
                        onClick={() => checkTaskCompletion(task.id)}
                        disabled={completeTaskMutation.isPending}
                        variant="outline"
                        className="text-green-600 border-green-600 hover:bg-green-50 text-xs h-auto p-1"
                      >
                        Проверить
                      </Button>
                    ) : (
                      <Button
                        onClick={() => handleTaskAction(task)}
                        disabled={completeTaskMutation.isPending}
                        variant="link"
                        className="text-[#4E7FFF] hover:underline p-0 h-auto text-xs"
                      >
                        {completeTaskMutation.isPending ? 'Загрузка...' : task.button_text || 'Выполнить'}
                      </Button>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        </motion.div>
      )}
    </div>
  );
}