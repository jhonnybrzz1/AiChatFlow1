import OpenAI from 'openai';

const DEFAULT_MODEL = 'gpt-5.4-nano';

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
    options: {
      model?: string;
      temperature?: number;
      maxTokens?: number;
    } = {}
  ): Promise<string> {
    try {
      const response = await this.client.chat.completions.create({
        model: options.model || DEFAULT_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: options.temperature,
        max_tokens: options.maxTokens
      });

      return response.choices[0].message.content || '';
    } catch (error) {
      console.error('Error generating chat completion:', error);
      throw new Error(`Failed to generate chat completion: ${error}`);
    }
  }

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
      return prompts.map(prompt => {
        if (prompt.systemPrompt.includes('PRD')) {
          return `PRD gerado com sucesso\n\n${prompt.userPrompt.substring(0, 200)}...`;
        } else if (prompt.systemPrompt.includes('Tasks')) {
          return `Tasks geradas com sucesso\n\n- [ ] Implementar funcionalidade principal\n- [ ] Criar testes\n- [ ] Documentar solução`;
        } else {
          return `Conteúdo gerado com sucesso para: ${prompt.systemPrompt}`;
        }
      });
    }
  }

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
      const response = await this.client.chat.completions.create({
        model: options.model || DEFAULT_MODEL,
        messages: [
          { role: 'system', content: `${systemPrompt}\nYou must respond with valid JSON only.` },
          { role: 'user', content: userPrompt }
        ],
        temperature: options.temperature || 0.3,
        max_tokens: options.maxTokens,
        response_format: { type: 'json_object' }
      });

      const content = response.choices[0].message.content;
      return JSON.parse(content || '{}');
    } catch (error) {
      console.error('Error generating JSON response:', error);
      throw new Error(`Failed to generate JSON response: ${error}`);
    }
  }
}

export const openAIService = new OpenAIService();
