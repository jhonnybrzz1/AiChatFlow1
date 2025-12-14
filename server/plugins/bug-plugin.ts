import { BasePlugin, PluginResult, DemandContext } from './base-plugin';
import { mistralAIService } from '../services/mistral-ai';

export class BugPlugin extends BasePlugin {
  readonly name = 'BugPlugin';
  readonly description = 'Analyzes bug reports and provides prioritization and resolution suggestions';
  readonly type = ['bug'];

  canProcess(context: DemandContext): boolean {
    return this.isEnabled() &&
           this.getSupportedTypes().includes(context.demand.type) &&
           (context.demand.description.toLowerCase().includes('bug') ||
           context.demand.description.toLowerCase().includes('error') ||
           context.demand.description.toLowerCase().includes('issue') ||
           context.demand.description.toLowerCase().includes('problem') ||
           context.demand.type === 'bug');
  }

  async process(context: DemandContext): Promise<PluginResult> {
    try {
      // Analyze the bug report and provide prioritization
      const analysis = await this.analyzeBugReport(context.demand);
      
      return {
        success: true,
        message: 'Bug analysis completed successfully',
        data: {
          analysis,
          priority: analysis.priority,
          suggestedFixes: analysis.suggestedFixes
        },
        metadata: {
          plugin: this.name,
          processedAt: new Date().toISOString()
        }
      };
    } catch (error) {
      console.error(`Error in BugPlugin:`, error);
      return {
        success: false,
        message: `Failed to process bug demand: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  private async analyzeBugReport(demand: any): Promise<any> {
    const systemPrompt = `Você é um especialista em QA e resolução de bugs.
Analise o relatório de bug fornecido e responda com:
1. Nível de prioridade (crítica, alta, média, baixa) baseado no impacto
2. Possíveis causas do bug
3. Sugestões para reprodução do problema
4. Possíveis soluções técnicas
5. Componentes do sistema que podem estar envolvidos

Considere os seguintes fatores:
- Frequência do bug
- Impacto nos usuários
- Gravidade do problema
- Complexidade da correção`;

    const userPrompt = `Título do Bug: ${demand.title}
Descrição: ${demand.description}
Tipo: ${demand.type}
Prioridade Atual: ${demand.priority}

Por favor, forneça uma análise detalhada do bug com foco em priorização e sugestões de resolução.`;

    try {
      const response = await mistralAIService.generateChatCompletion(
        systemPrompt,
        userPrompt,
        {
          temperature: 0.5,
          maxTokens: 1200
        }
      );

      // Parse the response to extract structured information
      if (response) {
        const parsedAnalysis = this.parseBugAnalysis(response);
        return parsedAnalysis;
      } else {
        // Fallback analysis
        return {
          priority: 'media',
          possibleCauses: ['Erro de lógica', 'Condição de corrida', 'Validação de entrada'],
          reproductionSteps: ['Reproduzir o cenário descrito', 'Verificar logs', 'Validar entradas'],
          suggestedFixes: ['Corrigir validação', 'Adicionar tratamento de erro', 'Revisar lógica'],
          impactedComponents: ['Frontend', 'Backend']
        };
      }
    } catch (error) {
      console.error('Error analyzing bug report:', error);
      return {
        priority: 'media',
        possibleCauses: ['Erro de lógica', 'Condição de corrida', 'Validação de entrada'],
        reproductionSteps: ['Reproduzir o cenário descrito', 'Verificar logs', 'Validar entradas'],
        suggestedFixes: ['Corrigir validação', 'Adicionar tratamento de erro', 'Revisar lógica'],
        impactedComponents: ['Frontend', 'Backend']
      };
    }
  }

  private parseBugAnalysis(response: string): any {
    // This is a simplified parser - in a real system, you'd want more robust parsing
    const lines = response.split('\n');
    let priority = 'media';
    const possibleCauses: string[] = [];
    const reproductionSteps: string[] = [];
    const suggestedFixes: string[] = [];
    const impactedComponents: string[] = [];

    let currentSection = '';
    
    for (const line of lines) {
      const trimmedLine = line.trim().toLowerCase();
      
      if (trimmedLine.includes('prioridade') || trimmedLine.includes('criticidade')) {
        if (trimmedLine.includes('crítica') || trimmedLine.includes('critica')) priority = 'critica';
        else if (trimmedLine.includes('alta')) priority = 'alta';
        else if (trimmedLine.includes('baixa')) priority = 'baixa';
        else priority = 'media';
      }
      
      if (trimmedLine.includes('possível causa') || trimmedLine.includes('possiveis causas') || 
          trimmedLine.includes('causa provável') || trimmedLine.includes('causas provaveis')) {
        currentSection = 'causes';
      } else if (trimmedLine.includes('reprodução') || trimmedLine.includes('reproducao') || 
                 trimmedLine.includes('passos para reproduzir')) {
        currentSection = 'reproduction';
      } else if (trimmedLine.includes('solução') || trimmedLine.includes('solucao') || 
                 trimmedLine.includes('sugestão') || trimmedLine.includes('sugestao')) {
        currentSection = 'fixes';
      } else if (trimmedLine.includes('componente') || trimmedLine.includes('módulo') || 
                 trimmedLine.includes('modulo')) {
        currentSection = 'components';
      } else if (trimmedLine.match(/^\d+\./) || trimmedLine.match(/^\d+\)/)) {
        // Extract list items
        const item = line.replace(/^\d+[.\)]\s*/, '').trim();
        if (item && item !== line.trim()) { // Make sure we extracted something
          switch (currentSection) {
            case 'causes':
              possibleCauses.push(item);
              break;
            case 'reproduction':
              reproductionSteps.push(item);
              break;
            case 'fixes':
              suggestedFixes.push(item);
              break;
            case 'components':
              impactedComponents.push(item);
              break;
          }
        }
      }
    }

    // If we couldn't parse properly, return defaults
    if (possibleCauses.length === 0) {
      possibleCauses.push('Erro de lógica', 'Condição de corrida', 'Validação de entrada');
    }
    if (reproductionSteps.length === 0) {
      reproductionSteps.push('Reproduzir o cenário descrito', 'Verificar logs', 'Validar entradas');
    }
    if (suggestedFixes.length === 0) {
      suggestedFixes.push('Corrigir validação', 'Adicionar tratamento de erro', 'Revisar lógica');
    }
    if (impactedComponents.length === 0) {
      impactedComponents.push('Frontend', 'Backend');
    }

    return {
      priority,
      possibleCauses,
      reproductionSteps,
      suggestedFixes,
      impactedComponents
    };
  }
}