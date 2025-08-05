import { type User, type InsertUser, type Transaction, type InsertTransaction, type Task, type InsertTask, type UserTask, type InsertUserTask, type Setting, type InsertSetting } from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByTelegramId(telegramId: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, updates: Partial<User>): Promise<User | undefined>;
  getAllUsers(): Promise<User[]>;

  // Transactions
  getTransaction(id: string): Promise<Transaction | undefined>;
  getTransactionsByUserId(userId: string): Promise<Transaction[]>;
  createTransaction(transaction: InsertTransaction): Promise<Transaction>;
  updateTransaction(id: string, updates: Partial<Transaction>): Promise<Transaction | undefined>;
  getRecentTransactions(limit?: number): Promise<Transaction[]>;

  // Tasks
  getTask(id: string): Promise<Task | undefined>;
  getAllTasks(): Promise<Task[]>;
  getActiveTasks(): Promise<Task[]>;
  createTask(task: InsertTask): Promise<Task>;
  updateTask(id: string, updates: Partial<Task>): Promise<Task | undefined>;

  // User Tasks
  getUserTask(userId: string, taskId: string): Promise<UserTask | undefined>;
  getUserTasks(userId: string): Promise<UserTask[]>;
  createUserTask(userTask: InsertUserTask): Promise<UserTask>;
  updateUserTask(id: string, updates: Partial<UserTask>): Promise<UserTask | undefined>;
  completeUserTask(userId: string, taskId: string): Promise<UserTask | undefined>;

  // Settings
  getSetting(key: string): Promise<Setting | undefined>;
  getAllSettings(): Promise<Setting[]>;
  setSetting(setting: InsertSetting): Promise<Setting>;
  updateSetting(key: string, value: string): Promise<Setting | undefined>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private transactions: Map<string, Transaction>;
  private tasks: Map<string, Task>;
  private userTasks: Map<string, UserTask>;
  private settings: Map<string, Setting>;

  constructor() {
    this.users = new Map();
    this.transactions = new Map();
    this.tasks = new Map();
    this.userTasks = new Map();
    this.settings = new Map();
    
    this.initializeDefaultData();
  }

  private initializeDefaultData() {
    // Initialize default settings
    const defaultSettings = [
      { key: "stars_price", value: "2.30" },
      { key: "ton_price", value: "420.50" },
      { key: "markup_percentage", value: "5" },
    ];

    defaultSettings.forEach(setting => {
      const id = randomUUID();
      this.settings.set(setting.key, {
        id,
        key: setting.key,
        value: setting.value,
        updatedAt: new Date(),
      });
    });

    // Initialize default tasks
    const defaultTasks = [
      {
        title: "Ежедневный вход",
        description: "Заходите каждый день",
        reward: 10,
        type: "daily",
        action: "daily_login",
        isActive: true,
      },
      {
        title: "Поделиться с другом",
        description: "Пригласите 1 друга",
        reward: 25,
        type: "referral",
        action: "share_app",
        isActive: true,
      },
      {
        title: "Подписаться на канал",
        description: "@starsexchange_news",
        reward: 50,
        type: "social",
        action: "follow_channel",
        isActive: true,
      },
    ];

    defaultTasks.forEach(task => {
      const id = randomUUID();
      this.tasks.set(id, {
        id,
        ...task,
        createdAt: new Date(),
      });
    });
  }

  // Users
  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByTelegramId(telegramId: string): Promise<User | undefined> {
    const user = Array.from(this.users.values()).find(user => user.telegramId === telegramId);
    console.log('getUserByTelegramId:', telegramId, 'found:', !!user, 'total users:', this.users.size);
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const referralCode = Math.random().toString(36).substring(2, 10);
    const user: User = {
      ...insertUser,
      id,
      referralCode,
      starsBalance: 0,
      tonBalance: "0",
      totalStarsEarned: 0,
      totalReferralEarnings: 0,
      tasksCompleted: 0,
      dailyEarnings: 0,
      notificationsEnabled: true,
      createdAt: new Date(),
    };
    this.users.set(id, user);
    console.log('Created and stored user:', id, 'telegramId:', user.telegramId, 'total users:', this.users.size);
    return user;
  }

  async updateUser(id: string, updates: Partial<User>): Promise<User | undefined> {
    const user = this.users.get(id);
    if (!user) return undefined;
    
    const updatedUser = { ...user, ...updates };
    this.users.set(id, updatedUser);
    return updatedUser;
  }

  async getAllUsers(): Promise<User[]> {
    return Array.from(this.users.values());
  }

  // Transactions
  async getTransaction(id: string): Promise<Transaction | undefined> {
    return this.transactions.get(id);
  }

  async getTransactionsByUserId(userId: string): Promise<Transaction[]> {
    return Array.from(this.transactions.values()).filter(t => t.userId === userId);
  }

  async createTransaction(insertTransaction: InsertTransaction): Promise<Transaction> {
    const id = randomUUID();
    const transaction: Transaction = {
      ...insertTransaction,
      id,
      status: insertTransaction.status || "pending",
      createdAt: new Date(),
    };
    this.transactions.set(id, transaction);
    return transaction;
  }

  async updateTransaction(id: string, updates: Partial<Transaction>): Promise<Transaction | undefined> {
    const transaction = this.transactions.get(id);
    if (!transaction) return undefined;
    
    const updatedTransaction = { ...transaction, ...updates };
    this.transactions.set(id, updatedTransaction);
    return updatedTransaction;
  }

  async getRecentTransactions(limit: number = 10): Promise<Transaction[]> {
    return Array.from(this.transactions.values())
      .sort((a, b) => b.createdAt!.getTime() - a.createdAt!.getTime())
      .slice(0, limit);
  }

  // Tasks
  async getTask(id: string): Promise<Task | undefined> {
    return this.tasks.get(id);
  }

  async getAllTasks(): Promise<Task[]> {
    return Array.from(this.tasks.values());
  }

  async getActiveTasks(): Promise<Task[]> {
    return Array.from(this.tasks.values()).filter(task => task.isActive);
  }

  async createTask(insertTask: InsertTask): Promise<Task> {
    const id = randomUUID();
    const task: Task = {
      ...insertTask,
      id,
      isActive: insertTask.isActive ?? true,
      createdAt: new Date(),
    };
    this.tasks.set(id, task);
    return task;
  }

  async updateTask(id: string, updates: Partial<Task>): Promise<Task | undefined> {
    const task = this.tasks.get(id);
    if (!task) return undefined;
    
    const updatedTask = { ...task, ...updates };
    this.tasks.set(id, updatedTask);
    return updatedTask;
  }

  // User Tasks
  async getUserTask(userId: string, taskId: string): Promise<UserTask | undefined> {
    return Array.from(this.userTasks.values()).find(ut => ut.userId === userId && ut.taskId === taskId);
  }

  async getUserTasks(userId: string): Promise<UserTask[]> {
    return Array.from(this.userTasks.values()).filter(ut => ut.userId === userId);
  }

  async createUserTask(insertUserTask: InsertUserTask): Promise<UserTask> {
    const id = randomUUID();
    const userTask: UserTask = {
      ...insertUserTask,
      id,
      completed: false,
      completedAt: null,
      createdAt: new Date(),
    };
    this.userTasks.set(id, userTask);
    return userTask;
  }

  async updateUserTask(id: string, updates: Partial<UserTask>): Promise<UserTask | undefined> {
    const userTask = this.userTasks.get(id);
    if (!userTask) return undefined;
    
    const updatedUserTask = { ...userTask, ...updates };
    this.userTasks.set(id, updatedUserTask);
    return updatedUserTask;
  }

  async completeUserTask(userId: string, taskId: string): Promise<UserTask | undefined> {
    const userTask = await this.getUserTask(userId, taskId);
    if (!userTask || userTask.completed) return undefined;

    const updatedUserTask = {
      ...userTask,
      completed: true,
      completedAt: new Date(),
    };
    this.userTasks.set(userTask.id, updatedUserTask);
    return updatedUserTask;
  }

  // Settings
  async getSetting(key: string): Promise<Setting | undefined> {
    return this.settings.get(key);
  }

  async getAllSettings(): Promise<Setting[]> {
    return Array.from(this.settings.values());
  }

  async setSetting(insertSetting: InsertSetting): Promise<Setting> {
    const id = randomUUID();
    const setting: Setting = {
      ...insertSetting,
      id,
      updatedAt: new Date(),
    };
    this.settings.set(setting.key, setting);
    return setting;
  }

  async updateSetting(key: string, value: string): Promise<Setting | undefined> {
    const setting = this.settings.get(key);
    if (!setting) return undefined;
    
    const updatedSetting = {
      ...setting,
      value,
      updatedAt: new Date(),
    };
    this.settings.set(key, updatedSetting);
    return updatedSetting;
  }
}

export const storage = new MemStorage();
