import { randomUUID } from 'crypto';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { and, eq, sql } from 'drizzle-orm';
import { db as defaultDb } from '../db';
import { logger } from '../utils/logger';
import { modelRoutingStageRuns, type Demand } from '@shared/schema';
import type { DemandClassification } from '../cognitive-core/demand-classifier';

export const MODEL_ROUTING_CONFIG_VERSION = 'model-routing-pilot-v1';
export const MODEL_NANO = process.env.OPENAI_MODEL_NANO || process.env.OPENAI_MODEL_FAST || 'gpt-5.4-nano-2026-03-17';
export const MODEL_MINI = process.env.OPENAI_MODEL_MINI || process.env.OPENAI_MODEL_CAPABLE || 'gpt-5.4-mini-2026-03-17';

export type ModelRoutingStageName = 'router' | 'template_validator' | 'qa' | `agent:${string}`;
export type ModelRoutingStatus = 'processing' | 'completed' | 'failed' | 'fallback_triggered' | 'failed_after_retries';
export type ModelRoutingFailureReason =
  | 'schema_failed'
  | 'schema_parse_failed'
  | 'validation_failed'
  | 'qa_failed_critical'
  | 'budget_exhausted';

export interface StageRunInput {
  demandId: number;
  executionId?: string | null;
  stageName: ModelRoutingStageName;
  modelUsed: string;
  attemptIndex: number;
  status: ModelRoutingStatus;
  validationPassed?: boolean | null;
  validationErrorsCount?: number | null;
  qaPassed?: boolean | null;
  qaBlockersCount?: number | null;
  failureReason?: ModelRoutingFailureReason | null;
  finalArtifactAccepted?: boolean | null;
  metadata?: Record<string, unknown>;
}

export interface StageDecisionContext {
  demand: Pick<Demand, 'priority' | 'type'>;
  classification?: DemandClassification | null;
  stageName: ModelRoutingStageName;
  /** Confidence score from Router Agent classification (0-1) */
  classificationConfidence?: number;
}

export interface StageDecision {
  stageName: ModelRoutingStageName;
  model: string;
  reason: string;
  complexity: number;
  risk: number;
  clarity: number;
  criticality: number;
  /** Whether fallback to mini was triggered due to low confidence */
  confidenceFallback?: boolean;
  /** Original confidence score if fallback was triggered */
  originalConfidence?: number;
}

export interface RetryBudgetState {
  maxAttemptsPerStage: number;
  maxFallbacksPerDemand: number;
  fallbackCount: number;
}

type DbClient = BetterSQLite3Database<any>;

const FALLBACK_REASONS = new Set<ModelRoutingFailureReason>([
  'schema_failed',
  'schema_parse_failed',
  'validation_failed',
  'qa_failed_critical',
  'budget_exhausted',
]);

export function isModelRoutingFailureReason(value: unknown): value is ModelRoutingFailureReason {
  return typeof value === 'string' && FALLBACK_REASONS.has(value as ModelRoutingFailureReason);
}

export class ModelRoutingService {
  private readonly budgets = new Map<string, RetryBudgetState>();

  constructor(private readonly database: DbClient = defaultDb) {
    this.ensureSchema();
  }

  getRetryBudget(demandId: number, executionId?: string | null): RetryBudgetState {
    const key = this.getBudgetKey(demandId, executionId);
    const current = this.budgets.get(key);
    if (current) return current;

    const budget = {
      maxAttemptsPerStage: this.parsePositiveInt(process.env.MODEL_ROUTING_MAX_ATTEMPTS_PER_STAGE, 2),
      maxFallbacksPerDemand: this.parsePositiveInt(process.env.MODEL_ROUTING_MAX_FALLBACKS_PER_DEMAND, 3),
      fallbackCount: 0,
    };
    this.budgets.set(key, budget);
    return budget;
  }

  classifyRouterModel(): string {
    // Classification now uses Mistral Medium when available
    const useMistral = !!process.env.MISTRAL_API_KEY;
    return useMistral ? 'mistral-medium-latest' : MODEL_NANO;
  }

  /**
   * Minimum confidence threshold for using nano model (scale 0-1)
   * Below this, fallback to mini is triggered
   */
  private readonly CONFIDENCE_THRESHOLD = 0.7;

  decideStageModel(context: StageDecisionContext): StageDecision {
    const criteria = context.classification?.criteria;
    const routerContract = context.classification?.routerContract;

    // Use router contract values if available, otherwise use criteria or defaults
    const complexity = routerContract
      ? this.complexidadeToNumber(routerContract.complexidade)
      : (criteria?.complexity ?? this.defaultComplexity(context.demand.type));

    const risk = routerContract
      ? this.riscoToNumber(routerContract.risco)
      : Math.max(criteria?.interpretationRisk ?? 0, criteria?.urgency ?? 0);

    const clarity = routerContract
      ? this.clarezaToNumber(routerContract.clareza_da_demanda)
      : (100 - (criteria?.ambiguity ?? 35));

    const criticality = routerContract
      ? this.impactoToNumber(routerContract.impacto_negocio)
      : this.priorityCriticality(context.demand.priority);

    // Check for low confidence fallback
    // Normalize confidence to 0-1 scale (cognitive-core uses 0-100, services use 0-1)
    const rawConfidence = context.classificationConfidence ?? context.classification?.confidence ?? 100;
    const normalizedConfidence = rawConfidence > 1 ? rawConfidence / 100 : rawConfidence;
    const lowConfidenceFallback = normalizedConfidence < this.CONFIDENCE_THRESHOLD;

    // Check if stage requires mini based on router contract flags
    const requiresMiniByFlags = routerContract && (
      (context.stageName.startsWith('agent:tech_lead') && routerContract.necessita_arquitetura) ||
      (context.stageName.startsWith('agent:ux') && routerContract.necessita_ux) ||
      (context.stageName.startsWith('agent:qa') && routerContract.necessita_qa) ||
      (context.stageName.startsWith('agent:product_manager') && routerContract.necessita_prd) ||
      (context.stageName.startsWith('agent:analista_de_dados') && routerContract.necessita_dados)
    );

    // Determine if mini is required
    const requiresMini =
      lowConfidenceFallback ||
      requiresMiniByFlags ||
      context.stageName === 'qa' ||
      context.stageName === 'template_validator' ||
      complexity >= 70 ||
      risk >= 70 ||
      criticality >= 80 ||
      clarity <= 35;

    // Build reason string
    let reason = 'low_risk_operational_stage';
    if (lowConfidenceFallback) {
      reason = `confidence_fallback (${(normalizedConfidence * 100).toFixed(0)}% < ${(this.CONFIDENCE_THRESHOLD * 100).toFixed(0)}%)`;
    } else if (requiresMiniByFlags) {
      reason = 'router_contract_flag';
    } else if (requiresMini) {
      reason = 'critical_or_validation_stage';
    }

    return {
      stageName: context.stageName,
      model: requiresMini ? MODEL_MINI : MODEL_NANO,
      reason,
      complexity,
      risk,
      clarity,
      criticality,
      confidenceFallback: lowConfidenceFallback,
      originalConfidence: lowConfidenceFallback ? normalizedConfidence : undefined,
    };
  }

  /**
   * Converts Portuguese complexidade to numeric score (0-100)
   */
  private complexidadeToNumber(complexidade: string): number {
    switch (complexidade) {
      case 'baixa': return 30;
      case 'media': return 55;
      case 'alta': return 80;
      default: return 55;
    }
  }

  /**
   * Converts Portuguese risco to numeric score (0-100)
   */
  private riscoToNumber(risco: string): number {
    switch (risco) {
      case 'baixo': return 25;
      case 'medio': return 50;
      case 'alto': return 80;
      default: return 50;
    }
  }

  /**
   * Converts Portuguese clareza to numeric score (0-100)
   */
  private clarezaToNumber(clareza: string): number {
    switch (clareza) {
      case 'baixa': return 30;
      case 'media': return 60;
      case 'alta': return 90;
      default: return 60;
    }
  }

  /**
   * Converts Portuguese impacto_negocio to numeric criticality score (0-100)
   */
  private impactoToNumber(impacto: string): number {
    switch (impacto) {
      case 'baixo': return 25;
      case 'medio': return 50;
      case 'alto': return 75;
      case 'critico': return 95;
      default: return 50;
    }
  }

  shouldFallback(input: {
    demandId: number;
    executionId?: string | null;
    stageName: ModelRoutingStageName;
    attemptIndex: number;
    failureReason?: ModelRoutingFailureReason | null;
  }): { allowed: boolean; failureReason: ModelRoutingFailureReason; nextAttemptIndex: number; budget: RetryBudgetState } {
    const budget = this.getRetryBudget(input.demandId, input.executionId);
    const requestedReason = input.failureReason || 'validation_failed';

    if (input.attemptIndex >= budget.maxAttemptsPerStage || budget.fallbackCount >= budget.maxFallbacksPerDemand) {
      return {
        allowed: false,
        failureReason: 'budget_exhausted',
        nextAttemptIndex: input.attemptIndex,
        budget,
      };
    }

    budget.fallbackCount += 1;
    return {
      allowed: true,
      failureReason: requestedReason,
      nextAttemptIndex: input.attemptIndex + 1,
      budget,
    };
  }

  async recordStageRun(input: StageRunInput): Promise<void> {
    const failureReason = input.failureReason ?? null;
    if (failureReason && !isModelRoutingFailureReason(failureReason)) {
      throw new Error(`Invalid model routing failure reason: ${failureReason}`);
    }

    const runId = randomUUID();
    const now = new Date();
    await this.database.insert(modelRoutingStageRuns).values({
      runId,
      demandId: input.demandId,
      executionId: input.executionId ?? null,
      stageName: input.stageName,
      modelUsed: input.modelUsed,
      attemptIndex: input.attemptIndex,
      status: input.status,
      validationPassed: input.validationPassed ?? null,
      validationErrorsCount: input.validationErrorsCount ?? null,
      qaPassed: input.qaPassed ?? null,
      qaBlockersCount: input.qaBlockersCount ?? null,
      failureReason,
      finalArtifactAccepted: input.finalArtifactAccepted ?? null,
      metadata: {
        configVersion: MODEL_ROUTING_CONFIG_VERSION,
        ...(input.metadata || {}),
      },
      createdAt: now,
    });

    logger.logBusinessEvent('model_routing_stage_run', input.stageName, runId, {
      demandId: input.demandId,
      executionId: input.executionId,
      modelUsed: input.modelUsed,
      attemptIndex: input.attemptIndex,
      status: input.status,
      failureReason,
    });
  }

  async getDemandStageRuns(demandId: number, executionId?: string | null) {
    const filters = [eq(modelRoutingStageRuns.demandId, demandId)];
    if (executionId) {
      filters.push(eq(modelRoutingStageRuns.executionId, executionId));
    }

    return this.database
      .select()
      .from(modelRoutingStageRuns)
      .where(and(...filters));
  }

  private defaultComplexity(type: string): number {
    return type === 'bug' ? 45 : type === 'melhoria' ? 60 : 55;
  }

  private priorityCriticality(priority: string): number {
    if (priority === 'critica') return 95;
    if (priority === 'alta') return 75;
    if (priority === 'media') return 50;
    return 25;
  }

  private getBudgetKey(demandId: number, executionId?: string | null): string {
    return `${demandId}:${executionId || 'default'}`;
  }

  private parsePositiveInt(value: string | undefined, fallback: number): number {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
  }

  private ensureSchema(): void {
    try {
      this.database.run(sql`
        CREATE TABLE IF NOT EXISTS model_routing_stage_runs (
          run_id TEXT PRIMARY KEY NOT NULL,
          demand_id INTEGER NOT NULL,
          execution_id TEXT,
          stage_name TEXT NOT NULL,
          model_used TEXT NOT NULL,
          attempt_index INTEGER NOT NULL,
          status TEXT NOT NULL CHECK(status IN ('processing', 'completed', 'failed', 'fallback_triggered', 'failed_after_retries')),
          validation_passed INTEGER,
          validation_errors_count INTEGER,
          qa_passed INTEGER,
          qa_blockers_count INTEGER,
          failure_reason TEXT CHECK(failure_reason IN ('schema_failed', 'schema_parse_failed', 'validation_failed', 'qa_failed_critical', 'budget_exhausted')),
          final_artifact_accepted INTEGER,
          metadata TEXT,
          created_at INTEGER NOT NULL
        )
      `);
    } catch (error) {
      console.warn('Could not ensure model_routing_stage_runs schema:', error);
    }
  }
}

export const modelRoutingService = new ModelRoutingService();
