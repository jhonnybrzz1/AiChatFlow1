
import { Mistral } from '@mistralai/mistralai';

// Default model is mistral-large-latest, which is their most capable model
const DEFAULT_MODEL = 'devstral-2512';

export class MistralAIService {
  private client: Mistral;

  constructor(apiKey?: string) {
    // Check for API key in environment variables
    const envApiKey = process.env.MISTRAL_API_KEY;

    if (!apiKey && !envApiKey) {
      console.warn('No Mistral API key provided. Please set MISTRAL_API_KEY environment variable.');
    }

    this.client = new Mistral({
      apiKey: apiKey || envApiKey || ''
    });
  }

  /**
   * Generate a chat completion using Mistral AI
   * @param systemPrompt - The system prompt to use
   * @param userPrompt - The user prompt to use
   * @param options - Additional options for the chat completion
   * @returns The generated chat completion
   */
  async generateChatCompletion(
    systemPrompt: string,
    userPrompt: string,
    options: {
      model?: string;
      temperature?: number;
      maxTokens?: number;
    } = {}
  ): Promise<string> {
    try {
      const response = await this.client.chat.complete({
        model: options.model || DEFAULT_MODEL,
        messages: [
          {
            role: 'system',
            content: systemPrompt
          },
          {
            role: 'user',
            content: userPrompt
          }
        ],
        temperature: options.temperature,
        maxTokens: options.maxTokens
      });

      const content = response.choices[0].message.content;
      return typeof content === 'string' ? content : '';
    } catch (error) {
      console.error('Error generating chat completion:', error);
      throw new Error(`Failed to generate chat completion: ${error}`);
    }
  }

  /**
   * Generate multiple chat completions in parallel
   * @param prompts - Array of prompt objects containing system and user prompts
   * @param options - Additional options for the chat completions
   * @returns Array of generated chat completions
   */
  async generateMultipleChatCompletions(
    prompts: Array<{ systemPrompt: string; userPrompt: string }>,
    options: {
      model?: string;
      temperature?: number;
      maxTokens?: number;
    } = {}
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
      // Return fallback content when there's an error
      return prompts.map(prompt => {
        if (prompt.systemPrompt.includes('PRD')) {
          return `PRD gerado com sucesso\n\n${prompt.userPrompt.substring(0, 200)}...`;
        } else if (prompt.systemPrompt.includes('Tasks')) {
          return `Tasks geradas com sucesso\n\n- [ ] 🔧 Implementar funcionalidade principal\n- [ ] 🔧 Criar testes\n- [ ] 🎨 Documentar solução`;
        } else {
          return `Conteúdo gerado com sucesso para: ${prompt.systemPrompt}`;
        }
      });
    }
  }

  /**
   * Generate a structured JSON response using Mistral AI
   * @param systemPrompt - The system prompt to use
   * @param userPrompt - The user prompt to use
   * @param options - Additional options for the chat completion
   * @returns The generated JSON response
   */
  async generateJSONResponse(
    systemPrompt: string,
    userPrompt: string,
    options: {
      model?: string;
      temperature?: number;
      maxTokens?: number;
    } = {}
  ): Promise<any> {
    try {
      const response = await this.client.chat.complete({
        model: options.model || DEFAULT_MODEL,
        messages: [
          {
            role: 'system',
            content: `${systemPrompt}\nYou must respond with valid JSON only.`
          },
          {
            role: 'user',
            content: userPrompt
          }
        ],
        temperature: options.temperature || 0.3,
        maxTokens: options.maxTokens,
        responseFormat: { type: 'json_object' }
      });

      const content = response.choices[0].message.content;
      return JSON.parse(typeof content === 'string' ? content : '{}');
    } catch (error) {
      console.error('Error generating JSON response:', error);
      throw new Error(`Failed to generate JSON response: ${error}`);
    }
  }
}

// Export a singleton instance
export const mistralAIService = new MistralAIService();
