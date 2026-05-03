import { aiUsageTracker, estimateTextTokens } from './ai-usage-tracker';

const MISTRAL_API_URL = 'https://api.mistral.ai/v1/chat/completions';
const MISTRAL_MODEL = process.env.MISTRAL_MODEL || 'mistral-medium-latest';

interface MistralMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface MistralResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

interface MistralGenerateOptions {
  temperature?: number;
  maxTokens?: number;
  model?: string;
  operation?: string;
}

/**
 * Mistral AI Service - Used for classification and routing tasks
 * More cost-effective than GPT for simple classification tasks
 */
export class MistralService {
  private apiKey: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.MISTRAL_API_KEY || '';

    if (!this.apiKey) {
      console.warn('No Mistral API key provided. Classification will fall back to OpenAI.');
    }
  }

  isAvailable(): boolean {
    return !!this.apiKey;
  }

  async generateChatCompletion(
    systemPrompt: string,
    userPrompt: string,
    options: MistralGenerateOptions = {}
  ): Promise<string> {
    if (!this.apiKey) {
      throw new Error('Mistral API key not configured');
    }

    const startedAt = Date.now();
    const model = options.model || MISTRAL_MODEL;
    const operation = options.operation || 'mistral_chat';

    const messages: MistralMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ];

    try {
      const response = await fetch(MISTRAL_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          model,
          messages,
          temperature: options.temperature ?? 0.3,
          max_tokens: options.maxTokens ?? 500
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Mistral API error: ${response.status} - ${errorText}`);
      }

      const data: MistralResponse = await response.json();
      const content = data.choices[0]?.message?.content || '';

      const promptTokens = data.usage?.prompt_tokens ?? estimateTextTokens(systemPrompt) + estimateTextTokens(userPrompt);
      const completionTokens = data.usage?.completion_tokens ?? estimateTextTokens(content);
      const totalTokens = data.usage?.total_tokens ?? promptTokens + completionTokens;

      // Mistral Medium pricing: $2.75/1M input, $8.10/1M output (estimated)
      const inputCost = (promptTokens / 1_000_000) * 2.75;
      const outputCost = (completionTokens / 1_000_000) * 8.10;
      const estimatedCostUsd = Number((inputCost + outputCost).toFixed(8));

      aiUsageTracker.record({
        timestamp: new Date().toISOString(),
        operation,
        model,
        promptTokens,
        completionTokens,
        totalTokens,
        estimatedCostUsd,
        cacheHit: false,
        estimatedTokensSaved: 0,
        estimatedCostSavedUsd: null,
        latencyMs: Date.now() - startedAt
      });

      return content;
    } catch (error) {
      console.error('Mistral API error:', error);
      throw error;
    }
  }

  async generateJSONResponse<T = Record<string, unknown>>(
    systemPrompt: string,
    userPrompt: string,
    options: MistralGenerateOptions = {}
  ): Promise<T> {
    const content = await this.generateChatCompletion(
      `${systemPrompt}\nYou must respond with valid JSON only.`,
      userPrompt,
      {
        ...options,
        temperature: options.temperature ?? 0.2
      }
    );

    try {
      return JSON.parse(content) as T;
    } catch {
      // Try to extract JSON from response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]) as T;
      }
      throw new Error(`Failed to parse Mistral response as JSON: ${content}`);
    }
  }
}

export const mistralService = new MistralService();
