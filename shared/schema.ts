import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const demands = sqliteTable("demands", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull(),
  description: text("description").notNull(),
  type: text("type").notNull(), // 'nova_funcionalidade', 'melhoria', 'bug', 'discovery', 'analise_exploratoria'
  priority: text("priority").notNull(), // 'baixa', 'media', 'alta', 'critica'
  status: text("status").notNull().default('processing'), // 'processing', 'completed', 'error', 'stopped'
  progress: integer("progress").notNull().default(0), // Progress percentage 0-100
  chatMessages: text("chat_messages", { mode: "json" }).$type<ChatMessage[]>().default([]),
  prdUrl: text("prd_url"),
  tasksUrl: text("tasks_url"),
  classification: text("classification", { mode: "json" }).$type<any>(), // Cognitive Core classification
  orchestration: text("orchestration", { mode: "json" }).$type<any>(), // Cognitive Core orchestration
  currentAgent: text("current_agent"), // Current agent being executed
  errorMessage: text("error_message"), // Error message if any
  validationNotes: text("validation_notes"), // Validation notes
  completedAt: integer("completed_at", { mode: "timestamp" }), // When demand was completed
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

export const repos = sqliteTable("repos", {
  id: integer("id").primaryKey({ autoIncrement: true }),
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
  size: integer("size"), // Size in KB
  stars: integer("stars").default(0),
  forks: integer("forks").default(0),
  isPrivate: integer("is_private", { mode: "boolean" }).default(false),
  isFork: integer("is_fork", { mode: "boolean" }).default(false),
  indexedContent: text("indexed_content"),
  indexedAt: integer("indexed_at", { mode: "timestamp" }),
  briefing: text("briefing"),
  briefingGeneratedAt: integer("briefing_generated_at", { mode: "timestamp" }),
  systemMap: text("system_map"),
  systemMapGeneratedAt: integer("system_map_generated_at", { mode: "timestamp" }),
  lastCommit: text("last_commit"),
  lastCommitDate: integer("last_commit_date", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

export const repoFiles = sqliteTable("repo_files", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  repoId: integer("repo_id").references(() => repos.id, { onDelete: 'cascade' }),
  path: text("path").notNull(),
  filename: text("filename").notNull(),
  content: text("content"),
  language: text("language"),
  size: integer("size"), // Size in bytes
  sha: text("sha"),
  url: text("url"),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

export const files = sqliteTable("files", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  demandId: integer("demand_id").references(() => demands.id),
  filename: text("filename").notNull(),
  originalName: text("original_name").notNull(),
  mimeType: text("mime_type").notNull(),
  size: integer("size").notNull(),
  path: text("path").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
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
