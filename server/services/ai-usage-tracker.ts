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

const DEFAULT_MODEL_PRICING: Record<string, ModelPricing> = {
  'gpt-4o-mini': { inputUsdPer1M: 0.15, outputUsdPer1M: 0.6 },
  'gpt-4o': { inputUsdPer1M: 2.5, outputUsdPer1M: 10 },
  'gpt-4.1-mini': { inputUsdPer1M: 0.4, outputUsdPer1M: 1.6 },
  'gpt-4.1': { inputUsdPer1M: 2, outputUsdPer1M: 8 },
  'gpt-5.4-nano': { inputUsdPer1M: 0, outputUsdPer1M: 0 },
  'gpt-5.4-mini': { inputUsdPer1M: 0, outputUsdPer1M: 0 }
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
