import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { demandTypeSchema, prioritySchema, type DemandPriority, type DemandType } from "./demand-types";

// Tipos de refinamento disponíveis
export type RefinementType = 'technical' | 'business' | null;
export const demandDomainSchema = z.enum(['padrao', 'fintech', 'healthtech', 'ecommerce']);
export type DemandDomain = z.infer<typeof demandDomainSchema>;

// Token optimization classification
export interface TokenOptimizationClassification {
  complexity: 'low' | 'medium' | 'high';
  requiredAgents: string[];
  estimatedInputTokens: number;
  estimatedOutputTokens: number;
  confidence: number;
  reasoning: string;
}

export const demands = sqliteTable("demands", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull(),
  description: text("description").notNull(),
  type: text("type").$type<DemandType>().notNull(), // 'nova_funcionalidade', 'melhoria', 'bug', 'discovery', 'analise_exploratoria'
  priority: text("priority").$type<DemandPriority>().notNull(), // 'baixa', 'media', 'alta', 'critica'
  refinementType: text("refinement_type").$type<RefinementType>(), // 'technical', 'business', or null for legacy
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
  typeAdherence: text("type_adherence", { mode: "json" }).$type<TypeAdherenceResult>(), // Type contract validation result
  completedAt: integer("completed_at", { mode: "timestamp" }), // When demand was completed

  // Governance fields (Human Review)
  requiresApproval: integer("requires_approval", { mode: "boolean" }).default(false),
  requiresHumanReview: integer("requires_human_review", { mode: "boolean" }).default(false),
  documentState: text("document_state", {
    enum: ["DRAFT", "UNDER_REVIEW", "APPROVED", "FINAL", "APPROVAL_REQUIRED"]
  }).default("DRAFT"),
  reviewSnapshotId: text("review_snapshot_id"),
  approvedSnapshotId: text("approved_snapshot_id"),
  approvedSnapshotHash: text("approved_snapshot_hash"),
  finalSnapshotId: text("final_snapshot_id"),
  finalizedFromHash: text("finalized_from_hash"),
  approvalSessionId: text("approval_session_id"),
  revisionNumber: integer("revision_number").notNull().default(0),
  reviewRequestedAt: integer("review_requested_at", { mode: "timestamp" }),
  approvedAt: integer("approved_at", { mode: "timestamp" }),

  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

// Document Snapshots - Immutable versions for review/approval
export const documentSnapshots = sqliteTable("document_snapshots", {
  snapshotId: text("snapshot_id").primaryKey(),
  demandId: integer("demand_id").notNull().references(() => demands.id),
  snapshotType: text("snapshot_type", { enum: ["REVIEW", "APPROVED"] }).notNull(),
  payloadJson: text("payload_json").notNull(), // Immutable rendered content
  snapshotHash: text("snapshot_hash").notNull(), // Deterministic hash
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

// Approval Comments - Feedback linked to snapshots
export const approvalComments = sqliteTable("approval_comments", {
  commentId: integer("comment_id").primaryKey({ autoIncrement: true }),
  demandId: integer("demand_id").notNull().references(() => demands.id),
  reviewSnapshotId: text("review_snapshot_id"),
  approvedSnapshotId: text("approved_snapshot_id"),
  author: text("author"),
  content: text("content").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

// Document Lifecycle Events - Metrics and audit trail
export const documentLifecycleEvents = sqliteTable("document_lifecycle_events", {
  eventId: integer("event_id").primaryKey({ autoIncrement: true }),
  demandId: integer("demand_id").notNull().references(() => demands.id),
  requiresApproval: integer("requires_approval", { mode: "boolean" }).notNull(),
  approvalSessionId: text("approval_session_id"),
  eventType: text("event_type", {
    enum: [
      "DRAFT_TO_APPROVAL_REQUIRED",
      "APPROVAL_REQUIRED_TO_APPROVED",
      "APPROVED_TO_FINAL",
      "DRAFT_TO_UNDER_REVIEW",
      "UNDER_REVIEW_TO_APPROVED",
      "UNDER_REVIEW_TO_DRAFT",
      "APPROVE_ATTEMPT",
      "FINALIZE_ATTEMPT",
      "SNAPSHOT_OUTDATED",
      "FINALIZE_PAYLOAD_REJECTED"
    ]
  }).notNull(),
  reviewSnapshotId: text("review_snapshot_id"),
  approvedSnapshotId: text("approved_snapshot_id"),
  finalSnapshotId: text("final_snapshot_id"),
  finalizedFromHash: text("finalized_from_hash"),
  resultCode: text("result_code"), // SUCCESS, ERROR, REJECTED
  errorMessage: text("error_message"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

export const operationAttempts = sqliteTable("operation_attempts", {
  attemptId: text("attempt_id").primaryKey(),
  operationId: text("operation_id").notNull(),
  operationType: text("operation_type").notNull(),
  demandId: integer("demand_id").references(() => demands.id),
  status: text("status", {
    enum: ["blocked", "processing", "completed", "error"]
  }).notNull(),
  gateStatus: text("gate_status", {
    enum: ["ready", "blocked"]
  }).notNull(),
  missingFields: text("missing_fields", { mode: "json" }).$type<string[]>().notNull(),
  errorCode: text("error_code"),
  errorMessage: text("error_message"),
  metadata: text("metadata", { mode: "json" }).$type<Record<string, unknown>>(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  completedAt: integer("completed_at", { mode: "timestamp" }),
});

export const modelRoutingStageRuns = sqliteTable("model_routing_stage_runs", {
  runId: text("run_id").primaryKey(),
  demandId: integer("demand_id").notNull().references(() => demands.id, { onDelete: "cascade" }),
  executionId: text("execution_id"),
  stageName: text("stage_name").notNull(),
  modelUsed: text("model_used").notNull(),
  attemptIndex: integer("attempt_index").notNull(),
  status: text("status", {
    enum: ["processing", "completed", "failed", "fallback_triggered", "failed_after_retries"]
  }).notNull(),
  validationPassed: integer("validation_passed", { mode: "boolean" }),
  validationErrorsCount: integer("validation_errors_count"),
  qaPassed: integer("qa_passed", { mode: "boolean" }),
  qaBlockersCount: integer("qa_blockers_count"),
  failureReason: text("failure_reason", {
    enum: [
      "schema_failed",
      "schema_parse_failed",
      "validation_failed",
      "qa_failed_critical",
      "budget_exhausted"
    ]
  }),
  finalArtifactAccepted: integer("final_artifact_accepted", { mode: "boolean" }),
  metadata: text("metadata", { mode: "json" }).$type<Record<string, unknown>>(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
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

// Contrato de tipo para refinamentos
export interface TypeContract {
  type: RefinementType;
  requiredSections: string[];
  minSectionsRequired: number;
  description: string;
}

// Contratos de tipo definidos
export const TYPE_CONTRACTS: Record<'technical' | 'business', TypeContract> = {
  technical: {
    type: 'technical',
    requiredSections: [
      'arquitetura',
      'componentes',
      'dependências',
      'integrações',
      'trade-offs',
      'riscos técnicos',
      'stack',
      'implementação'
    ],
    minSectionsRequired: 2,
    description: 'Refinamento técnico: foco em arquitetura, componentes, dependências e trade-offs'
  },
  business: {
    type: 'business',
    requiredSections: [
      'objetivo',
      'benefício',
      'valor',
      'impacto',
      'prioridade',
      'roi',
      'métrica',
      'usuário',
      'problema',
      'resultado'
    ],
    minSectionsRequired: 2,
    description: 'Refinamento de negócios: foco em objetivo, valor, impacto e prioridade'
  }
};

// Resultado da validação de aderência ao tipo
export interface TypeAdherenceResult {
  isAdherent: boolean;
  type: RefinementType;
  sectionsFound: string[];
  sectionsRequired: number;
  sectionsMet: number;
  score: number; // 0-100
  feedback: string;
}

export type ChatMessage = {
  id: string;
  agent: string;
  message: string;
  timestamp: string;
  type: 'processing' | 'completed' | 'error';
  category?: MessageCategory; // Visual category for message styling
  progress?: number; // Progress percentage 0-100
  metadata?: Record<string, unknown>;
};

// Schema específico para criação de demanda via API
// Só aceita campos que o cliente pode definir
export const insertDemandSchema = createInsertSchema(demands).pick({
  title: true,
  description: true,
  type: true,
  priority: true,
  refinementType: true,
  requiresApproval: true,
  requiresHumanReview: true,
}).extend({
  type: demandTypeSchema,
  priority: prioritySchema,
  domain: demandDomainSchema.default('padrao').optional(),
});

// Schema interno completo (para uso no servidor)
export const internalDemandSchema = createInsertSchema(demands).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
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
  domain?: DemandDomain;
  executionId?: string | null;
  executionConfig?: Record<string, unknown> | null;
  qualityPassed?: boolean | null;
  missingSections?: string[] | null;
  fallbackUsed?: boolean;
  fallbackReason?: string | null;
  tokenOptimization?: TokenOptimizationClassification;
};
export type Repo = typeof repos.$inferSelect;
export type RepoFile = typeof repoFiles.$inferSelect;
export type File = typeof files.$inferSelect;
export type User = typeof users.$inferSelect;
