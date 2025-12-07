
import { mistralAIService } from './mistral-ai';

class CodeAnalysisService {
  async analyzeRepo(indexedContent: string, userPrompt: string): Promise<string> {
    const systemPrompt = `You are an expert code reviewer. Analyze the following code from a GitHub repository and provide insights based on the user's request.

Here is the repository content:
${indexedContent}`;

    try {
      const analysis = await mistralAIService.generateChatCompletion(
        systemPrompt,
        userPrompt,
        { model: 'codestral-latest' }
      );
      return analysis;
    } catch (error) {
      console.error('Error analyzing repository:', error);
      throw new Error(`Failed to analyze repository: ${error}`);
    }
  }
}

export const codeAnalysisService = new CodeAnalysisService();
