interface ModelPricing {
  inputUsdPer1M: number;
  outputUsdPer1M: number;
}

export interface AIUsageRecord {
  timestamp: string;
  operation: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimatedCostUsd: number | null;
  cacheHit: boolean;
  estimatedTokensSaved: number;
  estimatedCostSavedUsd: number | null;
  latencyMs: number;
}

export interface AIUsageSummary {
  requestCount: number;
  cacheHits: number;
  cacheMisses: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimatedCostUsd: number;
  unpricedTokens: number;
  estimatedTokensSaved: number;
  estimatedCostSavedUsd: number;
  byModel: Record<string, {
    requestCount: number;
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    estimatedCostUsd: number;
    unpricedTokens: number;
  }>;
  recent: AIUsageRecord[];
}

// Pricing baseado nos modelos OpenAI documentados (maio 2026):
// - gpt-5.4-nano: $0.20 input / $1.25 output per 1M tokens
// - gpt-5.4-mini: $0.75 input / $4.50 output per 1M tokens
// Ref: https://developers.openai.com/api/docs/models/gpt-5.4-nano
const DEFAULT_MODEL_PRICING: Record<string, ModelPricing> = {
  'gpt-4o-mini': { inputUsdPer1M: 0.15, outputUsdPer1M: 0.6 },
  'gpt-4o': { inputUsdPer1M: 2.5, outputUsdPer1M: 10 },
  'gpt-4.1-mini': { inputUsdPer1M: 0.4, outputUsdPer1M: 1.6 },
  'gpt-4.1': { inputUsdPer1M: 2, outputUsdPer1M: 8 },
  'gpt-5.4-nano': { inputUsdPer1M: 0.20, outputUsdPer1M: 1.25 },
  'gpt-5.4-mini': { inputUsdPer1M: 0.75, outputUsdPer1M: 4.50 },
  'gpt-5.4-nano-2026-03-17': { inputUsdPer1M: 0.20, outputUsdPer1M: 1.25 },
  'gpt-5.4-mini-2026-03-17': { inputUsdPer1M: 0.75, outputUsdPer1M: 4.50 },
  // Mistral Models
  'mistral-medium-latest': { inputUsdPer1M: 2.75, outputUsdPer1M: 8.10 },
  'mistral-small-latest': { inputUsdPer1M: 0.20, outputUsdPer1M: 0.60 },
  'mistral-large-latest': { inputUsdPer1M: 4.00, outputUsdPer1M: 12.00 }
};

const parsePositiveNumber = (value: string | undefined): number | null => {
  const parsed = Number.parseFloat(value || '');
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
};

const parsePositiveInt = (value: string | undefined, fallback: number): number => {
  const parsed = Number.parseInt(value || '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

export function estimateTextTokens(text: string): number {
  if (!text) {
    return 0;
  }

  return Math.max(1, Math.ceil(text.length / 4));
}

export function getModelPricing(model: string): ModelPricing | null {
  const envInput = parsePositiveNumber(process.env.OPENAI_INPUT_COST_USD_PER_1M);
  const envOutput = parsePositiveNumber(process.env.OPENAI_OUTPUT_COST_USD_PER_1M);

  if (envInput !== null && envOutput !== null) {
    return {
      inputUsdPer1M: envInput,
      outputUsdPer1M: envOutput
    };
  }

  return DEFAULT_MODEL_PRICING[model] || null;
}

export function estimateCostUsd(
  model: string,
  promptTokens: number,
  completionTokens: number
): number | null {
  const pricing = getModelPricing(model);
  if (!pricing) {
    return null;
  }

  const inputCost = (promptTokens / 1_000_000) * pricing.inputUsdPer1M;
  const outputCost = (completionTokens / 1_000_000) * pricing.outputUsdPer1M;
  return Number((inputCost + outputCost).toFixed(8));
}

export class AIUsageTracker {
  private readonly records: AIUsageRecord[] = [];
  private readonly maxRecords = parsePositiveInt(process.env.AI_USAGE_MAX_RECORDS, 1000);

  record(record: AIUsageRecord): void {
    this.records.push(record);

    if (this.records.length > this.maxRecords) {
      this.records.splice(0, this.records.length - this.maxRecords);
    }
  }

  getSummary(): AIUsageSummary {
    const summary: AIUsageSummary = {
      requestCount: this.records.length,
      cacheHits: 0,
      cacheMisses: 0,
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      estimatedCostUsd: 0,
      unpricedTokens: 0,
      estimatedTokensSaved: 0,
      estimatedCostSavedUsd: 0,
      byModel: {},
      recent: this.records.slice(-25)
    };

    for (const record of this.records) {
      if (record.cacheHit) {
        summary.cacheHits += 1;
      } else {
        summary.cacheMisses += 1;
      }

      summary.promptTokens += record.promptTokens;
      summary.completionTokens += record.completionTokens;
      summary.totalTokens += record.totalTokens;
      summary.estimatedTokensSaved += record.estimatedTokensSaved;

      if (record.estimatedCostUsd === null) {
        summary.unpricedTokens += record.totalTokens;
      } else {
        summary.estimatedCostUsd += record.estimatedCostUsd;
      }

      if (record.estimatedCostSavedUsd !== null) {
        summary.estimatedCostSavedUsd += record.estimatedCostSavedUsd;
      }

      if (!summary.byModel[record.model]) {
        summary.byModel[record.model] = {
          requestCount: 0,
          promptTokens: 0,
          completionTokens: 0,
          totalTokens: 0,
          estimatedCostUsd: 0,
          unpricedTokens: 0
        };
      }

      const modelSummary = summary.byModel[record.model];
      modelSummary.requestCount += 1;
      modelSummary.promptTokens += record.promptTokens;
      modelSummary.completionTokens += record.completionTokens;
      modelSummary.totalTokens += record.totalTokens;

      if (record.estimatedCostUsd === null) {
        modelSummary.unpricedTokens += record.totalTokens;
      } else {
        modelSummary.estimatedCostUsd += record.estimatedCostUsd;
      }
    }

    summary.estimatedCostUsd = Number(summary.estimatedCostUsd.toFixed(8));
    summary.estimatedCostSavedUsd = Number(summary.estimatedCostSavedUsd.toFixed(8));

    for (const modelSummary of Object.values(summary.byModel)) {
      modelSummary.estimatedCostUsd = Number(modelSummary.estimatedCostUsd.toFixed(8));
    }

    return summary;
  }

  reset(): void {
    this.records.splice(0, this.records.length);
  }
}

export const aiUsageTracker = new AIUsageTracker();



/**
 * Extended metrics for token optimization tracking
 */
export interface TokenOptimizationMetrics {
  demandId: number;
  stage: 'classification' | 'agent_execution' | 'summary' | 'document_generation';
  agentName?: string;
  tokensUsed: number;
  tokensSaved: number;
  savingsSource: 'classification' | 'context_contract' | 'summary' | 'cache';
  timestamp: string;
}

export class OptimizationTracker {
  private metrics: TokenOptimizationMetrics[] = [];
  private readonly maxMetrics = 1000;

  recordOptimization(metric: TokenOptimizationMetrics): void {
    this.metrics.push(metric);

    if (this.metrics.length > this.maxMetrics) {
      this.metrics.splice(0, this.metrics.length - this.maxMetrics);
    }

    console.log(`[TOKEN OPT] Saved ${metric.tokensSaved} tokens via ${metric.savingsSource} at ${metric.stage}`);
  }

  getDemandOptimizations(demandId: number): TokenOptimizationMetrics[] {
    return this.metrics.filter(m => m.demandId === demandId);
  }

  getTotalSavings(): {
    totalSaved: number;
    bySource: Record<string, number>;
    byStage: Record<string, number>;
  } {
    const totalSaved = this.metrics.reduce((sum, m) => sum + m.tokensSaved, 0);
    
    const bySource: Record<string, number> = {};
    const byStage: Record<string, number> = {};

    for (const metric of this.metrics) {
      bySource[metric.savingsSource] = (bySource[metric.savingsSource] || 0) + metric.tokensSaved;
      byStage[metric.stage] = (byStage[metric.stage] || 0) + metric.tokensSaved;
    }

    return { totalSaved, bySource, byStage };
  }

  getOptimizationReport(): string {
    const savings = this.getTotalSavings();
    
    let report = `## Token Optimization Report\n\n`;
    report += `**Total Tokens Saved**: ${savings.totalSaved.toLocaleString()}\n\n`;
    
    report += `### Savings by Source\n`;
    for (const [source, amount] of Object.entries(savings.bySource)) {
      report += `- ${source}: ${amount.toLocaleString()} tokens\n`;
    }
    
    report += `\n### Savings by Stage\n`;
    for (const [stage, amount] of Object.entries(savings.byStage)) {
      report += `- ${stage}: ${amount.toLocaleString()} tokens\n`;
    }

    return report;
  }

  reset(): void {
    this.metrics.splice(0, this.metrics.length);
  }
}

export const optimizationTracker = new OptimizationTracker();
