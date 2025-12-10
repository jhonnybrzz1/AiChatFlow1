import { pgTable, text, serial, timestamp, jsonb, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const demands = pgTable("demands", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  type: text("type").notNull(), // 'nova_funcionalidade', 'melhoria', 'bug', 'discovery', 'analise_exploratoria'
  priority: text("priority").notNull(), // 'baixa', 'media', 'alta', 'critica'
  status: text("status").notNull().default('processing'), // 'processing', 'completed', 'error', 'stopped'
  progress: serial("progress").notNull().default(0), // Progress percentage 0-100
  chatMessages: jsonb("chat_messages").$type<ChatMessage[]>().default([]),
  prdUrl: text("prd_url"),
  tasksUrl: text("tasks_url"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const files = pgTable("files", {
  id: serial("id").primaryKey(),
  demandId: serial("demand_id").references(() => demands.id),
  filename: text("filename").notNull(),
  originalName: text("original_name").notNull(),
  mimeType: text("mime_type").notNull(),
  size: serial("size").notNull(),
  path: text("path").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export type ChatMessage = {
  id: string;
  agent: string;
  message: string;
  timestamp: string;
  type: 'processing' | 'completed' | 'error';
  progress?: number; // Progress percentage 0-100
};

export const insertDemandSchema = createInsertSchema(demands).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  chatMessages: true,
  prdUrl: true,
  tasksUrl: true,
  status: true,
  progress: true,
});

export const insertFileSchema = createInsertSchema(files).omit({
  id: true,
  createdAt: true,
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertDemand = z.infer<typeof insertDemandSchema>;
export type InsertFile = z.infer<typeof insertFileSchema>;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type Demand = typeof demands.$inferSelect;
export type File = typeof files.$inferSelect;
export type User = typeof users.$inferSelect;
