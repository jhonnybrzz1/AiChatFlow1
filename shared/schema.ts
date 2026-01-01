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
  classification: jsonb("classification").$type<any>(), // Cognitive Core classification
  orchestration: jsonb("orchestration").$type<any>(), // Cognitive Core orchestration
  currentAgent: text("current_agent"), // Current agent being executed
  errorMessage: text("error_message"), // Error message if any
  validationNotes: text("validation_notes"), // Validation notes
  completedAt: timestamp("completed_at"), // When demand was completed
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const repos = pgTable("repos", {
  id: serial("id").primaryKey(),
  owner: text("owner").notNull(),
  name: text("name").notNull(),
  fullName: text("full_name").notNull().unique(),
  description: text("description"),
  url: text("url").notNull(),
  cloneUrl: text("clone_url"),
  sshUrl: text("ssh_url"),
  htmlUrl: text("html_url"),
  defaultBranch: text("default_branch"),
  language: text("language"),
  size: serial("size"), // Size in KB
  stars: serial("stars").default(0),
  forks: serial("forks").default(0),
  isPrivate: boolean("is_private").default(false),
  isFork: boolean("is_fork").default(false),
  indexedContent: text("indexed_content"),
  indexedAt: timestamp("indexed_at"),
  briefing: text("briefing"),
  briefingGeneratedAt: timestamp("briefing_generated_at"),
  systemMap: text("system_map"),
  systemMapGeneratedAt: timestamp("system_map_generated_at"),
  lastCommit: text("last_commit"),
  lastCommitDate: timestamp("last_commit_date"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const repoFiles = pgTable("repo_files", {
  id: serial("id").primaryKey(),
  repoId: serial("repo_id").references(() => repos.id, { onDelete: 'cascade' }),
  path: text("path").notNull(),
  filename: text("filename").notNull(),
  content: text("content"),
  language: text("language"),
  size: serial("size"), // Size in bytes
  sha: text("sha"),
  url: text("url"),
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

export type MessageCategory = 'question' | 'answer' | 'alert' | 'error' | 'system';

export type ChatMessage = {
  id: string;
  agent: string;
  message: string;
  timestamp: string;
  type: 'processing' | 'completed' | 'error';
  category?: MessageCategory; // Visual category for message styling
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

export const insertRepoSchema = createInsertSchema(repos).omit({
  id: true,
  indexedAt: true,
  lastCommitDate: true,
  createdAt: true,
  updatedAt: true,
});

export const insertRepoFileSchema = createInsertSchema(repoFiles).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertDemand = z.infer<typeof insertDemandSchema>;
export type InsertFile = z.infer<typeof insertFileSchema>;
export type InsertRepo = z.infer<typeof insertRepoSchema>;
export type InsertRepoFile = z.infer<typeof insertRepoFileSchema>;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type Demand = typeof demands.$inferSelect & {
  frameworkExecution?: any;
};
export type Repo = typeof repos.$inferSelect;
export type RepoFile = typeof repoFiles.$inferSelect;
export type File = typeof files.$inferSelect;
export type User = typeof users.$inferSelect;
