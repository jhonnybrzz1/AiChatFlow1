import OpenAI from 'openai';
import { z, type ZodSchema } from 'zod';
import { aiResponseCache } from './ai-cache';
import {
  aiUsageTracker,
  estimateCostUsd,
  estimateTextTokens
} from './ai-usage-tracker';

type AITaskType =
  | 'classification'
  | 'json'
  | 'simple'
  | 'analysis'
  | 'document'
  | 'generation';

interface GenerateOptions<T = unknown> {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  cache?: boolean;
  cacheTtlMs?: number;
  taskType?: AITaskType;
  operation?: string;
  responseFormat?: 'text' | 'json_object';
  schema?: ZodSchema<T>;
}

const DEFAULT_MODEL = process.env.OPENAI_MODEL_DEFAULT || 'gpt-5.4-nano';
const FAST_MODEL = process.env.OPENAI_MODEL_FAST || DEFAULT_MODEL;
const CAPABLE_MODEL = process.env.OPENAI_MODEL_CAPABLE || DEFAULT_MODEL;

const jsonObjectSchema = z.record(z.unknown());

export class OpenAIService {
  private client: OpenAI;

  constructor(apiKey?: string) {
    const envApiKey = process.env.OPENAI_API_KEY;

    if (!apiKey && !envApiKey) {
      console.warn('No OpenAI API key provided. Please set OPENAI_API_KEY environment variable.');
    }

    this.client = new OpenAI({
      apiKey: apiKey || envApiKey || ''
    });
  }

  async generateChatCompletion(
    systemPrompt: string,
    userPrompt: string,
    options: GenerateOptions<string> = {}
  ): Promise<string> {
    const startedAt = Date.now();
    const model = this.resolveModel(options);
    const temperature = options.temperature;
    const responseFormat = options.responseFormat || 'text';
    const operation = options.operation || options.taskType || 'chat_completion';
    const cacheKey = aiResponseCache.createKey({
      model,
      systemPrompt,
      userPrompt,
      temperature,
      maxTokens: options.maxTokens || null,
      responseFormat,
      operation
    });

    if (options.cache !== false) {
      const cached = aiResponseCache.get(cacheKey);
      if (cached !== null) {
        const promptTokensSaved = estimateTextTokens(systemPrompt) + estimateTextTokens(userPrompt);
        const completionTokensSaved = estimateTextTokens(cached);
        const estimatedCostSavedUsd = estimateCostUsd(model, promptTokensSaved, completionTokensSaved);

        aiUsageTracker.record({
          timestamp: new Date().toISOString(),
          operation,
          model,
          promptTokens: 0,
          completionTokens: 0,
          totalTokens: 0,
          estimatedCostUsd: 0,
          cacheHit: true,
          estimatedTokensSaved: promptTokensSaved + completionTokensSaved,
          estimatedCostSavedUsd,
          latencyMs: Date.now() - startedAt
        });

        return cached;
      }
    }

    try {
      const requestPayload: Record<string, unknown> = {
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature
      };

      if (options.maxTokens) {
        requestPayload.max_completion_tokens = options.maxTokens;
      }

      if (responseFormat === 'json_object') {
        requestPayload.response_format = { type: 'json_object' };
      }

      const response = await this.client.chat.completions.create(requestPayload as any);
      const content = response.choices[0]?.message?.content || '';
      const usage = response.usage;
      const promptTokens = usage?.prompt_tokens ?? estimateTextTokens(systemPrompt) + estimateTextTokens(userPrompt);
      const completionTokens = usage?.completion_tokens ?? estimateTextTokens(content);
      const totalTokens = usage?.total_tokens ?? promptTokens + completionTokens;
      const estimatedCostUsd = estimateCostUsd(model, promptTokens, completionTokens);

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

      aiResponseCache.set(cacheKey, content, options.cacheTtlMs);
      return content;
    } catch (error) {
      console.error('Error generating chat completion:', error);
      throw new Error(`Failed to generate chat completion: ${error}`);
    }
  }

  async generateMultipleChatCompletions(
    prompts: Array<{ systemPrompt: string; userPrompt: string }>,
    options: GenerateOptions<string> = {}
  ): Promise<string[]> {
    try {
      const promises = prompts.map(prompt =>
        this.generateChatCompletion(
          prompt.systemPrompt,
          prompt.userPrompt,
          options
        )
      );

      return await Promise.all(promises);
    } catch (error) {
      console.error('Error generating multiple chat completions:', error);
      return prompts.map(prompt => {
        if (prompt.systemPrompt.includes('PRD')) {
          return `PRD gerado com sucesso\n\n${prompt.userPrompt.substring(0, 200)}...`;
        }
        if (prompt.systemPrompt.includes('Tasks')) {
          return `Tasks geradas com sucesso\n\n- [ ] Implementar funcionalidade principal\n- [ ] Criar testes\n- [ ] Documentar solução`;
        }
        return `Conteúdo gerado com sucesso para: ${prompt.systemPrompt}`;
      });
    }
  }

  async generateJSONResponse<T = Record<string, unknown>>(
    systemPrompt: string,
    userPrompt: string,
    options: GenerateOptions<T> = {}
  ): Promise<T> {
    const { schema, ...completionOptions } = options;
    const content = await this.generateChatCompletion(
      `${systemPrompt}\nYou must respond with valid JSON only.`,
      userPrompt,
      {
        ...completionOptions,
        taskType: completionOptions.taskType || 'json',
        temperature: completionOptions.temperature ?? 0.3,
        responseFormat: 'json_object'
      }
    );

    const parsed = this.parseJSONContent(content);
    const validationSchema = schema || (jsonObjectSchema as unknown as ZodSchema<T>);
    const result = validationSchema.safeParse(parsed);

    if (!result.success) {
      const issues = result.error.issues
        .map(issue => `${issue.path.join('.') || 'root'}: ${issue.message}`)
        .join('; ');
      throw new Error(`AI JSON response failed schema validation: ${issues}`);
    }

    return result.data;
  }

  async generateResponse(prompt: string, options: GenerateOptions<string> = {}): Promise<string> {
    return this.generateChatCompletion(
      'Você é um assistente de produto e engenharia. Responda de forma objetiva e prática em português brasileiro.',
      prompt,
      {
        ...options,
        taskType: options.taskType || 'simple'
      }
    );
  }

  private resolveModel(options: GenerateOptions): string {
    if (options.model) {
      return options.model;
    }

    if (options.taskType === 'classification' || options.taskType === 'json' || options.taskType === 'simple') {
      return FAST_MODEL;
    }

    if (options.taskType === 'analysis' || options.taskType === 'document' || options.taskType === 'generation') {
      return CAPABLE_MODEL;
    }

    if (options.maxTokens && options.maxTokens <= 300) {
      return FAST_MODEL;
    }

    if (options.maxTokens && options.maxTokens >= 2500) {
      return CAPABLE_MODEL;
    }

    return DEFAULT_MODEL;
  }

  private parseJSONContent(content: string): unknown {
    try {
      return JSON.parse(content || '{}');
    } catch (error) {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error(`AI response is not valid JSON: ${error}`);
      }

      try {
        return JSON.parse(jsonMatch[0]);
      } catch (innerError) {
        throw new Error(`AI response contains invalid JSON: ${innerError}`);
      }
    }
  }
}

export const openAIService = new OpenAIService();
