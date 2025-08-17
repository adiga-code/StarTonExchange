import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, decimal, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  telegramId: varchar("telegram_id").notNull().unique(),
  username: text("username"),
  firstName: text("first_name"),
  lastName: text("last_name"),
  starsBalance: integer("stars_balance").default(0),
  tonBalance: decimal("ton_balance", { precision: 18, scale: 8 }).default("0"),
  referralCode: varchar("referral_code").unique(),
  referredBy: varchar("referred_by"),
  totalStarsEarned: integer("total_stars_earned").default(0),
  totalReferralEarnings: integer("total_referral_earnings").default(0),
  tasksCompleted: integer("tasks_completed").default(0),
  dailyEarnings: integer("daily_earnings").default(0),
  notificationsEnabled: boolean("notifications_enabled").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

// Add foreign key after table definition
export const usersRelations = {
  referredBy: users.referredBy
};

export const transactions = pgTable("transactions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  type: varchar("type").notNull(), // 'buy_stars', 'buy_ton', 'referral_bonus', 'task_reward'
  currency: varchar("currency").notNull(), // 'stars', 'ton', 'rub'
  amount: decimal("amount", { precision: 18, scale: 8 }).notNull(),
  rubAmount: decimal("rub_amount", { precision: 10, scale: 2 }),
  status: varchar("status").default("pending"), // 'pending', 'completed', 'failed'
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const tasks = pgTable("tasks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  description: text("description").notNull(),
  reward: integer("reward").notNull(),
  type: varchar("type").notNull(), // 'daily', 'social', 'referral'
  action: varchar("action"), // + новые: 'invite_friends', 'complete_purchase', 'visit_website'
  isActive: boolean("is_active").default(true),
  
  // НОВЫЕ ПОЛЯ:
  status: varchar("status").default("active"), // 'draft', 'active', 'paused', 'expired'
  deadline: timestamp("deadline"), // срок выполнения (опционально)
  maxCompletions: integer("max_completions"), // максимум выполнений (опционально)
  requirements: text("requirements"), // требования в JSON формате (опционально)
  completedCount: integer("completed_count").default(0), // счетчик выполнений
  
  createdAt: timestamp("created_at").defaultNow(),
});

export const userTasks = pgTable("user_tasks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  taskId: varchar("task_id").references(() => tasks.id).notNull(),
  completed: boolean("completed").default(false),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const settings = pgTable("settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  key: varchar("key").notNull().unique(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
});

export const insertTransactionSchema = createInsertSchema(transactions).omit({
  id: true,
  createdAt: true,
});

export const insertTaskSchema = createInsertSchema(tasks).omit({
  id: true,
  createdAt: true,
});

export const insertUserTaskSchema = createInsertSchema(userTasks).omit({
  id: true,
  createdAt: true,
  completedAt: true,
});

export const insertSettingSchema = createInsertSchema(settings).omit({
  id: true,
  updatedAt: true,
});

export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type Transaction = typeof transactions.$inferSelect;
export type InsertTransaction = z.infer<typeof insertTransactionSchema>;
export type Task = typeof tasks.$inferSelect;
export type InsertTask = z.infer<typeof insertTaskSchema>;
export type UserTask = typeof userTasks.$inferSelect;
export type InsertUserTask = z.infer<typeof insertUserTaskSchema>;
export type Setting = typeof settings.$inferSelect;
export type InsertSetting = z.infer<typeof insertSettingSchema>;
