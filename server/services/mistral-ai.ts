import { OpenAIService, openAIService } from './openai-ai';

export { OpenAIService };

/**
 * @deprecated Use openAIService from ./openai-ai.
 * Kept as a thin alias so older local scripts keep running.
 */
export const mistralAIService = openAIService;
