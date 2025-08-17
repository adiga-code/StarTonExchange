import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Plus, Edit, Trash2, Eye } from 'lucide-react';

const TaskAdminPage = () => {
  const [token, setToken] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [tasks, setTasks] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    reward: 10,
    type: 'daily',
    action: '',
    status: 'active',
    deadline: '',
    maxCompletions: '',
    requirements: '',
    isActive: true
  });

  // Проверка токена из URL
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const urlToken = urlParams.get('token') || window.location.pathname.split('/admin')[1];
    if (urlToken) {
      setToken(urlToken);
      checkAuth(urlToken);
    }
  }, []);

  const checkAuth = async (authToken) => {
    try {
      const response = await fetch(`/api/admin/tasks/list?token=${authToken}`);
      if (response.ok) {
        setIsAuthenticated(true);
        loadTasks(authToken);
      }
    } catch (error) {
      console.error('Auth failed:', error);
    }
  };

  const loadTasks = async (authToken) => {
    try {
      const response = await fetch(`/api/admin/tasks/list?token=${authToken}`);
      const data = await response.json();
      setTasks(data);
    } catch (error) {
      console.error('Failed to load tasks:', error);
    }
  };

  const handleSubmit = async () => {
    
    try {
      const url = editingTask 
        ? `/api/admin/tasks/${editingTask.id}` 
        : '/api/admin/tasks/create';
      
      const method = editingTask ? 'PUT' : 'POST';
      
      const response = await fetch(`${url}?token=${token}`, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        resetForm();
        loadTasks(token);
        alert(editingTask ? 'Задание обновлено!' : 'Задание создано!');
      }
    } catch (error) {
      alert('Ошибка: ' + error.message);
    }
  };

  const resetForm = () => {
    setFormData({
      title: '', description: '', reward: 10, type: 'daily', action: '',
      status: 'active', deadline: '', maxCompletions: '', requirements: '', isActive: true
    });
    setShowForm(false);
    setEditingTask(null);
  };

  const editTask = (task) => {
    setFormData(task);
    setEditingTask(task);
    setShowForm(true);
  };

  const deleteTask = async (taskId) => {
    if (confirm('Архивировать задание?')) {
      try {
        await fetch(`/api/admin/tasks/${taskId}?token=${token}`, { method: 'DELETE' });
        loadTasks(token);
        alert('Задание архивировано!');
      } catch (error) {
        alert('Ошибка удаления');
      }
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="w-96">
          <CardHeader>
            <CardTitle>Доступ запрещен</CardTitle>
            <CardDescription>Неверный токен доступа</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold">Админка заданий</h1>
          <Button onClick={() => setShowForm(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Новое задание
          </Button>
        </div>

        {/* Форма создания/редактирования */}
        {showForm && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>{editingTask ? 'Редактировать задание' : 'Новое задание'}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Название</Label>
                    <Input 
                      value={formData.title}
                      onChange={(e) => setFormData({...formData, title: e.target.value})}
                      required
                    />
                  </div>
                  <div>
                    <Label>Награда (звезды)</Label>
                    <Input 
                      type="number"
                      value={formData.reward}
                      onChange={(e) => setFormData({...formData, reward: parseInt(e.target.value)})}
                      required
                    />
                  </div>
                </div>

                <div>
                  <Label>Описание</Label>
                  <Textarea 
                    value={formData.description}
                    onChange={(e) => setFormData({...formData, description: e.target.value})}
                    maxLength={200}
                    required
                  />
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label>Тип</Label>
                    <Select value={formData.type} onValueChange={(value) => setFormData({...formData, type: value})}>
                      <SelectTrigger>
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
                    <Label>Действие</Label>
                    <Select value={formData.action} onValueChange={(value) => setFormData({...formData, action: value})}>
                      <SelectTrigger>
                        <SelectValue placeholder="Выберите действие" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="daily_login">Ежедневный вход</SelectItem>
                        <SelectItem value="share_app">Поделиться приложением</SelectItem>
                        <SelectItem value="follow_channel">Подписаться на канал</SelectItem>
                        <SelectItem value="invite_friends">Пригласить друзей</SelectItem>
                        <SelectItem value="complete_purchase">Совершить покупку</SelectItem>
                        <SelectItem value="visit_website">Посетить сайт</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Статус</Label>
                    <Select value={formData.status} onValueChange={(value) => setFormData({...formData, status: value})}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="draft">Черновик</SelectItem>
                        <SelectItem value="active">Активное</SelectItem>
                        <SelectItem value="paused">Приостановлено</SelectItem>
                        <SelectItem value="expired">Истекло</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Дедлайн (опционально)</Label>
                    <Input 
                      type="datetime-local"
                      value={formData.deadline}
                      onChange={(e) => setFormData({...formData, deadline: e.target.value})}
                    />
                  </div>
                  <div>
                    <Label>Макс. выполнений (опционально)</Label>
                    <Input 
                      type="number"
                      value={formData.maxCompletions}
                      onChange={(e) => setFormData({...formData, maxCompletions: e.target.value})}
                    />
                  </div>
                </div>

                <div>
                  <Label>Требования (JSON, опционально)</Label>
                  <Textarea 
                    value={formData.requirements}
                    onChange={(e) => setFormData({...formData, requirements: e.target.value})}
                    placeholder='{"minLevel": 1, "completedTasks": []}'
                  />
                </div>

                <div className="flex items-center space-x-2">
                  <Switch 
                    checked={formData.isActive}
                    onCheckedChange={(checked) => setFormData({...formData, isActive: checked})}
                  />
                  <Label>Активное</Label>
                </div>

                <div className="flex gap-2">
                  <Button onClick={handleSubmit}>{editingTask ? 'Обновить' : 'Создать'}</Button>
                  <Button variant="outline" onClick={resetForm}>Отмена</Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Список заданий */}
        <Card>
          <CardHeader>
            <CardTitle>Список заданий ({tasks.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2">Название</th>
                    <th className="text-left p-2">Тип</th>
                    <th className="text-left p-2">Награда</th>
                    <th className="text-left p-2">Статус</th>
                    <th className="text-left p-2">Выполнено</th>
                    <th className="text-left p-2">Действия</th>
                  </tr>
                </thead>
                <tbody>
                  {tasks.map(task => (
                    <tr key={task.id} className="border-b hover:bg-gray-50">
                      <td className="p-2 font-medium">{task.title}</td>
                      <td className="p-2">{task.type}</td>
                      <td className="p-2">{task.reward} ⭐</td>
                      <td className="p-2">
                        <span className={`px-2 py-1 rounded text-xs ${
                          task.status === 'active' ? 'bg-green-100 text-green-800' :
                          task.status === 'draft' ? 'bg-gray-100 text-gray-800' :
                          task.status === 'paused' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {task.status}
                        </span>
                      </td>
                      <td className="p-2">{task.completedCount || 0}</td>
                      <td className="p-2">
                        <div className="flex gap-1">
                          <Button size="sm" variant="outline" onClick={() => editTask(task)}>
                            <Edit className="w-3 h-3" />
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => deleteTask(task.id)}>
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default TaskAdminPage;