import { BasePlugin, PluginResult, DemandContext } from './base-plugin';
import { openAIService } from '../services/openai-ai';

export class DiscoveryPlugin extends BasePlugin {
  readonly name = 'DiscoveryPlugin';
  readonly description = 'Provides market research suggestions and discovery insights for demands';
  readonly type = ['discovery', 'analise_exploratoria'];

  canProcess(context: DemandContext): boolean {
    return this.isEnabled() &&
           this.getSupportedTypes().includes(context.demand.type) &&
           (context.demand.description.toLowerCase().includes('discovery') ||
           context.demand.description.toLowerCase().includes('research') ||
           context.demand.description.toLowerCase().includes('analysis') ||
           context.demand.type === 'discovery' ||
           context.demand.type === 'analise_exploratoria');
  }

  async process(context: DemandContext): Promise<PluginResult> {
    try {
      // Generate market research suggestions using OpenAI
      const suggestions = await this.generateDiscoverySuggestions(context.demand);
      
      return {
        success: true,
        message: 'Discovery analysis completed successfully',
        data: {
          suggestions,
          analysis: 'Market research and discovery insights generated'
        },
        metadata: {
          plugin: this.name,
          processedAt: new Date().toISOString()
        }
      };
    } catch (error) {
      console.error(`Error in DiscoveryPlugin:`, error);
      return {
        success: false,
        message: `Failed to process discovery demand: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  private async generateDiscoverySuggestions(demand: any): Promise<string[]> {
    const systemPrompt = `Você é um especialista em pesquisa de mercado e discovery. 
Forneça sugestões práticas e relevantes para a demanda de discovery ou análise exploratória.
Retorne uma lista de sugestões com foco em:
1. Pesquisa de usuário
2. Análise de concorrentes
3. Validacão de hipóteses
4. Métricas para acompanhar
5. Próximos passos`;

    const userPrompt = `Demanda: ${demand.title}
Descrição: ${demand.description}
Tipo: ${demand.type}
Prioridade: ${demand.priority}

Forneça 5 sugestões específicas para esta demanda de discovery ou análise exploratória.`;

    try {
      const response = await openAIService.generateChatCompletion(
        systemPrompt,
        userPrompt,
        {
          temperature: 0.7,
          maxTokens: 1000,
          taskType: 'analysis',
          operation: 'plugin:discovery'
        }
      );

      // Parse response to extract suggestions
      if (response) {
        // Simple parsing to extract suggestions
        const suggestions = this.parseSuggestions(response);
        return suggestions;
      } else {
        return [
          'Realizar entrevistas com usuários para entender necessidades',
          'Analisar concorrentes diretos e indiretos',
          'Validar hipóteses com protótipos rápidos',
          'Definir KPIs relevantes para medir sucesso',
          'Criar roadmap de discovery com milestones claras'
        ];
      }
    } catch (error) {
      console.error('Error generating discovery suggestions:', error);
      return [
        'Realizar entrevistas com usuários para entender necessidades',
        'Analisar concorrentes diretos e indiretos',
        'Validar hipóteses com protótipos rápidos',
        'Definir KPIs relevantes para medir sucesso',
        'Criar roadmap de discovery com milestones claras'
      ];
    }
  }

  private parseSuggestions(response: string): string[] {
    // Simple parsing to extract numbered or bullet points
    const lines = response.split('\n');
    const suggestions: string[] = [];
    
    for (const line of lines) {
      const trimmedLine = line.trim();
      // Match numbered lists or bullet points
      if (trimmedLine.match(/^\d+\.\s/) || 
          trimmedLine.match(/^\d+\)\s/) || 
          trimmedLine.match(/^\*\s/) || 
          trimmedLine.match(/^-+\s/) ||
          trimmedLine.match(/^-\s/)) {
        // Extract the suggestion text after the number/bullet
        const suggestion = trimmedLine.replace(/^\d+[.\)]\s*|^[\*\-]\s*/, '').trim();
        if (suggestion) {
          suggestions.push(suggestion);
        }
      }
    }
    
    // If we couldn't parse suggestions properly, return a default set
    if (suggestions.length < 3) {
      return [
        'Realizar entrevistas com usuários para entender necessidades',
        'Analisar concorrentes diretos e indiretos',
        'Validar hipóteses com protótipos rápidos',
        'Definir KPIs relevantes para medir sucesso',
        'Criar roadmap de discovery com milestones claras'
      ];
    }
    
    return suggestions;
  }
}
