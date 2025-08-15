import { motion } from "framer-motion";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useTelegram } from "@/hooks/use-telegram";
import { CalendarDays, ThumbsUp, CheckCircle, Share, Users, Star } from "lucide-react";
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
}

export default function TasksTab({ user }: TasksTabProps) {
  const { toast } = useToast();
  const { hapticFeedback, shareApp } = useTelegram();
  const queryClient = useQueryClient();

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
      toast({
        title: "Задание выполнено!",
        description: `Вы получили ${data.reward} звезд`,
      });
    },
    onError: () => {
      toast({
        title: "Ошибка",
        description: "Не удалось выполнить задание",
        variant: "destructive",
      });
    },
  });

  const handleTaskAction = async (task: TaskWithCompletion) => {
    if (task.completed) return;

    hapticFeedback('light');

    switch (task.action) {
      case 'share_app':
        shareApp('Попробуй этот крутой обменник Stars и TON!');
        break;
      case 'follow_channel':
        window.open('https://t.me/starsexchange_news', '_blank');
        break;
      case 'daily_login':
        // Daily login is automatically handled
        break;
    }

    // Complete the task
    completeTaskMutation.mutate(task.id);
  };

  const getTaskIcon = (type: string, action?: string) => {
    if (action === 'share_app') return Share;
    if (action === 'follow_channel') return Users;
    if (type === 'daily') return CalendarDays;
    if (type === 'social') return ThumbsUp;
    return CheckCircle;
  };

  const getTaskIconColor = (type: string, action?: string) => {
    if (action === 'share_app') return 'text-[#4E7FFF]';
    if (action === 'follow_channel') return 'text-blue-400';
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
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-white dark:bg-[#1A1A1C] rounded-xl p-4 shadow-lg animate-pulse">
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-2"></div>
            <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Daily Tasks */}
      {dailyTasks.length > 0 && (
        <motion.div
          className="bg-white dark:bg-[#1A1A1C] rounded-xl p-4 shadow-lg dark:shadow-[0_4px_20px_rgba(0,0,0,0.3)] border border-gray-200 dark:border-white/10"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <h3 className="text-lg font-semibold mb-4 flex items-center">
            <CalendarDays className="w-5 h-5 text-yellow-500 mr-2" />
            Ежедневные задания
          </h3>
          <div className="space-y-3">
            {dailyTasks.map((task) => {
              const Icon = getTaskIcon(task.type, task.action);
              const iconColor = getTaskIconColor(task.type, task.action);

              return (
                <motion.div
                  key={task.id}
                  className="flex items-center justify-between p-3 bg-gray-50 dark:bg-[#0E0E10] rounded-lg"
                  whileHover={{ scale: 1.01 }}
                >
                  <div className="flex items-center space-x-3">
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
                        {completeTaskMutation.isPending ? 'Выполняется...' : 'Выполнить'}
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
          className="bg-white dark:bg-[#1A1A1C] rounded-xl p-4 shadow-lg dark:shadow-[0_4px_20px_rgba(0,0,0,0.3)] border border-gray-200 dark:border-white/10"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
        >
          <h3 className="text-lg font-semibold mb-4 flex items-center">
            <ThumbsUp className="w-5 h-5 text-[#4E7FFF] mr-2" />
            Социальные задания
          </h3>
          <div className="space-y-3">
            {socialTasks.map((task) => {
              const Icon = getTaskIcon(task.type, task.action);
              const iconColor = getTaskIconColor(task.type, task.action);

              return (
                <motion.div
                  key={task.id}
                  className="flex items-center justify-between p-3 bg-gray-50 dark:bg-[#0E0E10] rounded-lg"
                  whileHover={{ scale: 1.01 }}
                >
                  <div className="flex items-center space-x-3">
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
                        {completeTaskMutation.isPending ? 'Выполняется...' : 'Выполнить'}
                      </Button>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        </motion.div>
      )}

      {/* Progress */}
      <motion.div
        className="bg-gradient-to-r from-[#4E7FFF]/20 to-purple-500/20 rounded-xl p-4 shadow-lg dark:shadow-[0_4px_20px_rgba(0,0,0,0.3)] border border-white/10"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.2 }}
      >
        <h3 className="text-lg font-semibold mb-3">Дневной прогресс</h3>
        <div className="space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600 dark:text-gray-400">Выполнено заданий</span>
            <span className="font-semibold">{completedTasks}/{totalTasks}</span>
          </div>
          <Progress value={progressPercentage} className="h-2" />
          <div className="flex justify-between text-sm">
            <span className="text-gray-600 dark:text-gray-400">Заработано сегодня</span>
            <span className="font-semibold text-yellow-500 flex items-center">
              +{user?.daily_earnings || 0} <Star className="w-4 h-4 ml-1" />
            </span>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
