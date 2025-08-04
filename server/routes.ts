import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertUserSchema, insertTransactionSchema, insertUserTaskSchema } from "@shared/schema";
import { z } from "zod";

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth middleware - simplified for demo
  const getCurrentUser = async (req: any) => {
    const telegramId = req.headers['x-telegram-id'] || '123456789';
    return await storage.getUserByTelegramId(String(telegramId));
  };

  // User routes
  app.post("/api/users", async (req, res) => {
    try {
      const userData = insertUserSchema.parse(req.body);
      const existingUser = await storage.getUserByTelegramId(userData.telegramId);
      
      if (existingUser) {
        res.json(existingUser);
        return;
      }
      
      const user = await storage.createUser(userData);
      console.log('Created user:', user.id, 'telegramId:', user.telegramId);
      res.json(user);
    } catch (error) {
      console.error('Error creating user:', error);
      res.status(400).json({ error: "Invalid user data" });
    }
  });

  app.get("/api/users/me", async (req, res) => {
    try {
      const telegramId = req.headers['x-telegram-id'] || '123456789';
      console.log('Looking for user with telegramId:', telegramId);
      const user = await storage.getUserByTelegramId(String(telegramId));
      if (!user) {
        console.log('User not found with telegramId:', telegramId);
        res.status(404).json({ error: "User not found" });
        return;
      }
      console.log('Found user:', user.id);
      res.json(user);
    } catch (error) {
      console.error('Error getting user:', error);
      res.status(500).json({ error: "Failed to get user" });
    }
  });

  app.put("/api/users/me", async (req, res) => {
    try {
      const user = await getCurrentUser(req);
      if (!user) {
        res.status(404).json({ error: "User not found" });
        return;
      }
      
      const updatedUser = await storage.updateUser(user.id, req.body);
      res.json(updatedUser);
    } catch (error) {
      res.status(500).json({ error: "Failed to update user" });
    }
  });

  // Purchase routes
  app.post("/api/purchase/calculate", async (req, res) => {
    try {
      const { currency, amount } = req.body;
      
      const starsPrice = await storage.getSetting("stars_price");
      const tonPrice = await storage.getSetting("ton_price");
      const markupPercentage = await storage.getSetting("markup_percentage");
      
      const prices = {
        stars: parseFloat(starsPrice?.value || "2.30"),
        ton: parseFloat(tonPrice?.value || "420.50"),
      };
      
      const markup = parseFloat(markupPercentage?.value || "5") / 100;
      
      const basePrice = amount * prices[currency as keyof typeof prices];
      const markupAmount = basePrice * markup;
      const totalPrice = basePrice + markupAmount;
      
      res.json({
        basePrice: basePrice.toFixed(2),
        markupAmount: markupAmount.toFixed(2),
        totalPrice: totalPrice.toFixed(2),
        currency,
        amount,
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to calculate price" });
    }
  });

  app.post("/api/purchase", async (req, res) => {
    try {
      const { currency, amount, rubAmount } = req.body;
      const user = await getCurrentUser(req);
      
      if (!user) {
        res.status(404).json({ error: "User not found" });
        return;
      }
      
      // Create transaction
      const transaction = await storage.createTransaction({
        userId: user.id,
        type: currency === 'stars' ? 'buy_stars' : 'buy_ton',
        currency,
        amount: amount.toString(),
        rubAmount: rubAmount.toString(),
        status: "pending",
        description: `Purchase ${amount} ${currency}`,
      });
      
      // Simulate payment processing
      setTimeout(async () => {
        // Update transaction status
        await storage.updateTransaction(transaction.id, { status: "completed" });
        
        // Update user balance
        if (currency === 'stars') {
          await storage.updateUser(user.id, {
            starsBalance: (user.starsBalance || 0) + parseInt(amount),
            totalStarsEarned: (user.totalStarsEarned || 0) + parseInt(amount),
          });
        } else if (currency === 'ton') {
          // TON is sent directly to user's Telegram wallet
          // We don't store TON balance in our app
          console.log(`Sending ${amount} TON to Telegram wallet of user ${user.telegramId}`);
          // Here would be the integration with Fragment API or TON wallet
        }
      }, 2000);
      
      res.json({ transaction, status: "processing" });
    } catch (error) {
      res.status(500).json({ error: "Failed to process purchase" });
    }
  });

  // Tasks routes
  app.get("/api/tasks", async (req, res) => {
    try {
      const tasks = await storage.getActiveTasks();
      const user = await getCurrentUser(req);
      
      if (!user) {
        res.json(tasks);
        return;
      }
      
      const userTasks = await storage.getUserTasks(user.id);
      const tasksWithCompletion = tasks.map(task => {
        const userTask = userTasks.find(ut => ut.taskId === task.id);
        return {
          ...task,
          completed: userTask?.completed || false,
          completedAt: userTask?.completedAt || null,
        };
      });
      
      res.json(tasksWithCompletion);
    } catch (error) {
      res.status(500).json({ error: "Failed to get tasks" });
    }
  });

  app.post("/api/tasks/:taskId/complete", async (req, res) => {
    try {
      const { taskId } = req.params;
      const user = await getCurrentUser(req);
      
      if (!user) {
        res.status(404).json({ error: "User not found" });
        return;
      }
      
      const task = await storage.getTask(taskId);
      if (!task) {
        res.status(404).json({ error: "Task not found" });
        return;
      }
      
      // Check if task already completed
      const existingUserTask = await storage.getUserTask(user.id, taskId);
      if (existingUserTask?.completed) {
        res.status(400).json({ error: "Task already completed" });
        return;
      }
      
      // Create or update user task
      if (!existingUserTask) {
        await storage.createUserTask({
          userId: user.id,
          taskId,
          completed: false,
        });
      }
      
      // Complete the task
      const completedTask = await storage.completeUserTask(user.id, taskId);
      if (!completedTask) {
        res.status(500).json({ error: "Failed to complete task" });
        return;
      }
      
      // Reward user
      await storage.updateUser(user.id, {
        starsBalance: (user.starsBalance || 0) + task.reward,
        totalStarsEarned: (user.totalStarsEarned || 0) + task.reward,
        tasksCompleted: (user.tasksCompleted || 0) + 1,
        dailyEarnings: (user.dailyEarnings || 0) + task.reward,
      });
      
      // Create reward transaction
      await storage.createTransaction({
        userId: user.id,
        type: "task_reward",
        currency: "stars",
        amount: task.reward.toString(),
        status: "completed",
        description: `Task reward: ${task.title}`,
      });
      
      res.json({ success: true, reward: task.reward });
    } catch (error) {
      res.status(500).json({ error: "Failed to complete task" });
    }
  });

  // Referral routes
  app.get("/api/referrals/stats", async (req, res) => {
    try {
      const user = await getCurrentUser(req);
      if (!user) {
        res.status(404).json({ error: "User not found" });
        return;
      }
      
      const allUsers = await storage.getAllUsers();
      const referrals = allUsers.filter(u => u.referredBy === user.id);
      
      res.json({
        totalReferrals: referrals.length,
        totalEarnings: user.totalReferralEarnings || 0,
        referralCode: user.referralCode,
        referrals: referrals.map(r => ({
          id: r.id,
          username: r.username,
          firstName: r.firstName,
          createdAt: r.createdAt,
        })),
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to get referral stats" });
    }
  });

  // Admin routes
  app.get("/api/admin/stats", async (req, res) => {
    try {
      const users = await storage.getAllUsers();
      const transactions = await storage.getRecentTransactions(50);
      const completedTransactions = transactions.filter(t => t.status === "completed");
      
      const todaySales = completedTransactions
        .filter(t => {
          const today = new Date();
          const transactionDate = new Date(t.createdAt!);
          return transactionDate.toDateString() === today.toDateString();
        })
        .reduce((sum, t) => sum + parseFloat(t.rubAmount || "0"), 0);
      
      const activeReferrals = users.filter(u => u.referredBy).length;
      
      res.json({
        totalUsers: users.length,
        todaySales: todaySales.toFixed(2),
        activeReferrals,
        recentTransactions: transactions.slice(0, 10).map(t => ({
          id: t.id,
          username: users.find(u => u.id === t.userId)?.username || 'Unknown',
          description: t.description,
          status: t.status,
          createdAt: t.createdAt,
        })),
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to get admin stats" });
    }
  });

  app.put("/api/admin/settings", async (req, res) => {
    try {
      const { starsPrice, tonPrice, markupPercentage } = req.body;
      
      if (starsPrice) {
        await storage.updateSetting("stars_price", starsPrice.toString());
      }
      if (tonPrice) {
        await storage.updateSetting("ton_price", tonPrice.toString());
      }
      if (markupPercentage) {
        await storage.updateSetting("markup_percentage", markupPercentage.toString());
      }
      
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to update settings" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
