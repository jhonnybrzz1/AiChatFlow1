import { BasePlugin, PluginResult, DemandContext } from './base-plugin';
import { mistralAIService } from '../services/mistral-ai';

export class ImprovementPlugin extends BasePlugin {
  readonly name = 'ImprovementPlugin';
  readonly description = 'Provides performance optimization and improvement suggestions for demands';
  readonly type = ['melhoria', 'performance'];

  canProcess(context: DemandContext): boolean {
    return this.isEnabled() &&
           this.getSupportedTypes().includes(context.demand.type) &&
           (context.demand.description.toLowerCase().includes('melhoria') ||
           context.demand.description.toLowerCase().includes('performance') ||
           context.demand.description.toLowerCase().includes('otimização') ||
           context.demand.description.toLowerCase().includes('otimizacao') ||
           context.demand.description.toLowerCase().includes('refinamento') ||
           context.demand.type === 'melhoria');
  }

  async process(context: DemandContext): Promise<PluginResult> {
    try {
      // Generate performance optimization suggestions
      const suggestions = await this.generateImprovementSuggestions(context.demand);
      
      return {
        success: true,
        message: 'Improvement analysis completed successfully',
        data: {
          suggestions,
          optimization: 'Performance optimization suggestions generated'
        },
        metadata: {
          plugin: this.name,
          processedAt: new Date().toISOString()
        }
      };
    } catch (error) {
      console.error(`Error in ImprovementPlugin:`, error);
      return {
        success: false,
        message: `Failed to process improvement demand: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  private async generateImprovementSuggestions(demand: any): Promise<any> {
    const systemPrompt = `Você é um especialista em performance e otimização de sistemas.
Forneça sugestões práticas e relevantes para melhorar o desempenho e a qualidade do sistema.
Considere:
1. Otimização de código
2. Melhoria de arquitetura
3. Otimização de banco de dados
4. Melhoria de experiência do usuário
5. Estratégias de cache
6. Monitoramento e métricas`;

    const userPrompt = `Demanda: ${demand.title}
Descrição: ${demand.description}
Tipo: ${demand.type}
Prioridade: ${demand.priority}

Por favor, forneça sugestões específicas para melhorar o desempenho ou a qualidade do sistema com base nesta demanda de melhoria.`;

    try {
      const response = await mistralAIService.generateChatCompletion(
        systemPrompt,
        userPrompt,
        {
          temperature: 0.6,
          maxTokens: 1000
        }
      );

      if (response) {
        const parsedSuggestions = this.parseImprovementSuggestions(response);
        return parsedSuggestions;
      } else {
        // Fallback suggestions
        return {
          codeOptimization: [
            'Revisar algoritmos para otimizar complexidade',
            'Implementar lazy loading para recursos pesados',
            'Minificar e comprimir assets'
          ],
          architecture: [
            'Considerar implementação de cache em camada de aplicação',
            'Avaliar necessidade de CDN para conteúdo estático',
            'Revisar estrutura de microsserviços, se aplicável'
          ],
          database: [
            'Adicionar índices em consultas frequentes',
            'Otimizar queries com JOINs desnecessários',
            'Considerar implementação de cache de consultas'
          ],
          userExperience: [
            'Adicionar loading states para operações assíncronas',
            'Implementar lazy loading para listas longas',
            'Melhorar tempos de resposta na interface'
          ],
          monitoring: [
            'Implementar métricas de performance',
            'Adicionar logs de desempenho',
            'Configurar alertas para degradação de performance'
          ]
        };
      }
    } catch (error) {
      console.error('Error generating improvement suggestions:', error);
      return {
        codeOptimization: [
          'Revisar algoritmos para otimizar complexidade',
          'Implementar lazy loading para recursos pesados',
          'Minificar e comprimir assets'
        ],
        architecture: [
          'Considerar implementação de cache em camada de aplicação',
          'Avaliar necessidade de CDN para conteúdo estático',
          'Revisar estrutura de microsserviços, se aplicável'
        ],
        database: [
          'Adicionar índices em consultas frequentes',
          'Otimizar queries com JOINs desnecessários',
          'Considerar implementação de cache de consultas'
        ],
        userExperience: [
          'Adicionar loading states para operações assíncronas',
          'Implementar lazy loading para listas longas',
          'Melhorar tempos de resposta na interface'
        ],
        monitoring: [
          'Implementar métricas de performance',
          'Adicionar logs de desempenho',
          'Configurar alertas para degradação de performance'
        ]
      };
    }
  }

  private parseImprovementSuggestions(response: string): any {
    // This is a simplified parser - in a real system, you'd want more robust parsing
    const lines = response.split('\n');
    const codeOptimization: string[] = [];
    const architecture: string[] = [];
    const database: string[] = [];
    const userExperience: string[] = [];
    const monitoring: string[] = [];

    let currentSection = '';
    
    for (const line of lines) {
      const trimmedLine = line.trim().toLowerCase();
      
      if (trimmedLine.includes('código') || trimmedLine.includes('code') || 
          trimmedLine.includes('otimização de código') || trimmedLine.includes('otimizacao de codigo')) {
        currentSection = 'code';
      } else if (trimmedLine.includes('arquitetura') || trimmedLine.includes('architecture')) {
        currentSection = 'architecture';
      } else if (trimmedLine.includes('banco') || trimmedLine.includes('database') || 
                 trimmedLine.includes('consulta') || trimmedLine.includes('query')) {
        currentSection = 'database';
      } else if (trimmedLine.includes('usuário') || trimmedLine.includes('usuario') || 
                 trimmedLine.includes('experiência') || trimmedLine.includes('experiencia') || 
                 trimmedLine.includes('ui') || trimmedLine.includes('ux')) {
        currentSection = 'ux';
      } else if (trimmedLine.includes('monitoramento') || trimmedLine.includes('monitoring') || 
                 trimmedLine.includes('métricas') || trimmedLine.includes('metricas') || 
                 trimmedLine.includes('logs')) {
        currentSection = 'monitoring';
      } else if (trimmedLine.match(/^\d+\./) || trimmedLine.match(/^\d+\)/) || 
                 trimmedLine.match(/^\*\s/) || trimmedLine.match(/^-+\s/)) {
        // Extract list items
        const item = line.replace(/^\d+[.\)]\s*|^[\*\-]\s*/, '').trim();
        if (item && item !== line.trim()) { // Make sure we extracted something
          switch (currentSection) {
            case 'code':
              codeOptimization.push(item);
              break;
            case 'architecture':
              architecture.push(item);
              break;
            case 'database':
              database.push(item);
              break;
            case 'ux':
              userExperience.push(item);
              break;
            case 'monitoring':
              monitoring.push(item);
              break;
          }
        }
      }
    }

    // Return the suggestions, using defaults if parsing failed
    return {
      codeOptimization: codeOptimization.length > 0 ? codeOptimization : [
        'Revisar algoritmos para otimizar complexidade',
        'Implementar lazy loading para recursos pesados',
        'Minificar e comprimir assets'
      ],
      architecture: architecture.length > 0 ? architecture : [
        'Considerar implementação de cache em camada de aplicação',
        'Avaliar necessidade de CDN para conteúdo estático',
        'Revisar estrutura de microsserviços, se aplicável'
      ],
      database: database.length > 0 ? database : [
        'Adicionar índices em consultas frequentes',
        'Otimizar queries com JOINs desnecessários',
        'Considerar implementação de cache de consultas'
      ],
      userExperience: userExperience.length > 0 ? userExperience : [
        'Adicionar loading states para operações assíncronas',
        'Implementar lazy loading para listas longas',
        'Melhorar tempos de resposta na interface'
      ],
      monitoring: monitoring.length > 0 ? monitoring : [
        'Implementar métricas de performance',
        'Adicionar logs de desempenho',
        'Configurar alertas para degradação de performance'
      ]
    };
  }
}