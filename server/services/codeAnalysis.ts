
import { openAIService } from './openai-ai';

class CodeAnalysisService {
  async analyzeRepo(indexedContent: string, demandDescription: string, userPrompt: string): Promise<string> {
    const systemPrompt = `You are an expert code reviewer. Analyze the following code from a GitHub repository focusing on the user's demand.

User's Demand: ${demandDescription}

Here is the repository content:
${indexedContent}`;

    try {
      const analysis = await openAIService.generateChatCompletion(
        systemPrompt,
        userPrompt,
        {
          model: process.env.OPENAI_MODEL_CODE,
          taskType: 'analysis',
          operation: 'code_analysis'
        }
      );
      return analysis;
    } catch (error) {
      console.error('Error analyzing repository:', error);
      // Provide more specific error information
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to analyze repository: ${errorMessage}`);
    }
  }
}

export const codeAnalysisService = new CodeAnalysisService();
