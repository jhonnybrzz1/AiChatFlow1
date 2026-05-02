import { BasePlugin, PluginResult, DemandContext } from './base-plugin';
import { openAIService } from '../services/openai-ai';

interface FeatureAnalysis {
  impactedModules: string[];
  dependencies: string[];
  userStories: string[];
  rolloutPlan: string[];
  successMetrics: string[];
  risks: string[];
  effortEstimate: string;
}

export class FeaturePlugin extends BasePlugin {
  readonly name = 'FeaturePlugin';
  readonly description = 'Analyzes new feature demands with impact, dependencies, rollout, and user stories';
  readonly type = ['nova_funcionalidade'];

  canProcess(context: DemandContext): boolean {
    return this.isEnabled() && this.getSupportedTypes().includes(context.demand.type);
  }

  async process(context: DemandContext): Promise<PluginResult> {
    try {
      const analysis = await this.analyzeFeatureDemand(context.demand);

      return {
        success: true,
        message: 'Feature analysis completed successfully',
        data: {
          analysis,
          impactedModules: analysis.impactedModules,
          dependencies: analysis.dependencies,
          userStories: analysis.userStories,
          rolloutPlan: analysis.rolloutPlan,
          successMetrics: analysis.successMetrics,
          risks: analysis.risks,
          effortEstimate: analysis.effortEstimate
        },
        metadata: {
          plugin: this.name,
          processedAt: new Date().toISOString()
        }
      };
    } catch (error) {
      console.error(`Error in FeaturePlugin:`, error);
      return {
        success: false,
        message: `Failed to process feature demand: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  private async analyzeFeatureDemand(demand: any): Promise<FeatureAnalysis> {
    const systemPrompt = `Você é um Product Engineer avaliando uma nova funcionalidade.
Gere uma análise prática e incremental, respeitando o stack atual do projeto.

Responda em seções com bullets:
1. Módulos Impactados
2. Dependências
3. User Stories
4. Plano de Rollout
5. Métricas de Sucesso
6. Riscos
7. Estimativa de Esforço

Regras:
- Não proponha troca de framework ou arquitetura.
- Prefira mudanças pequenas e compatíveis com o código existente.
- Inclua critérios verificáveis para implementação e rollout.
- Mantenha o esforço total em até 14 dias.`;

    const userPrompt = `Demanda: ${demand.title}
Descrição: ${demand.description}
Tipo: ${demand.type}
Prioridade: ${demand.priority}

Analise esta nova funcionalidade com foco em impacto, dependências, rollout e histórias de usuário.`;

    try {
      const response = await openAIService.generateChatCompletion(
        systemPrompt,
        userPrompt,
        {
          temperature: 0.5,
          maxTokens: 1400,
          taskType: 'analysis',
          operation: 'plugin:feature'
        }
      );

      return response ? this.parseFeatureAnalysis(response) : this.getFallbackAnalysis();
    } catch (error) {
      console.error('Error analyzing feature demand:', error);
      return this.getFallbackAnalysis();
    }
  }

  private parseFeatureAnalysis(response: string): FeatureAnalysis {
    const sections: Record<keyof Omit<FeatureAnalysis, 'effortEstimate'>, string[]> = {
      impactedModules: [],
      dependencies: [],
      userStories: [],
      rolloutPlan: [],
      successMetrics: [],
      risks: []
    };
    let effortEstimate = '';
    let currentSection: keyof typeof sections | 'effortEstimate' | '' = '';

    for (const line of response.split('\n')) {
      const trimmedLine = line.trim();
      const lowerLine = trimmedLine.toLowerCase();

      if (lowerLine.includes('módulos impactados') || lowerLine.includes('modulos impactados')) {
        currentSection = 'impactedModules';
        continue;
      }
      if (lowerLine.includes('dependências') || lowerLine.includes('dependencias')) {
        currentSection = 'dependencies';
        continue;
      }
      if (lowerLine.includes('user stories') || lowerLine.includes('histórias') || lowerLine.includes('historias')) {
        currentSection = 'userStories';
        continue;
      }
      if (lowerLine.includes('rollout')) {
        currentSection = 'rolloutPlan';
        continue;
      }
      if (lowerLine.includes('métricas') || lowerLine.includes('metricas') || lowerLine.includes('sucesso')) {
        currentSection = 'successMetrics';
        continue;
      }
      if (lowerLine.includes('riscos')) {
        currentSection = 'risks';
        continue;
      }
      if (lowerLine.includes('estimativa') || lowerLine.includes('esforço') || lowerLine.includes('esforco')) {
        currentSection = 'effortEstimate';
        const inlineEstimate = trimmedLine.replace(/^#+\s*/, '').replace(/^\d+[.)]\s*/, '').trim();
        if (inlineEstimate && !inlineEstimate.toLowerCase().includes('estimativa de esforço')) {
          effortEstimate = inlineEstimate;
        }
        continue;
      }

      const listItem = trimmedLine.replace(/^\d+[.)]\s*|^[*-]\s*/, '').trim();
      const isListItem = listItem && listItem !== trimmedLine;
      if (!isListItem) {
        if (currentSection === 'effortEstimate' && trimmedLine) {
          effortEstimate = trimmedLine;
        }
        continue;
      }

      if (currentSection && currentSection !== 'effortEstimate') {
        sections[currentSection].push(listItem);
      } else if (currentSection === 'effortEstimate') {
        effortEstimate = listItem;
      }
    }

    const fallback = this.getFallbackAnalysis();
    return {
      impactedModules: sections.impactedModules.length ? sections.impactedModules : fallback.impactedModules,
      dependencies: sections.dependencies.length ? sections.dependencies : fallback.dependencies,
      userStories: sections.userStories.length ? sections.userStories : fallback.userStories,
      rolloutPlan: sections.rolloutPlan.length ? sections.rolloutPlan : fallback.rolloutPlan,
      successMetrics: sections.successMetrics.length ? sections.successMetrics : fallback.successMetrics,
      risks: sections.risks.length ? sections.risks : fallback.risks,
      effortEstimate: effortEstimate || fallback.effortEstimate
    };
  }

  private getFallbackAnalysis(): FeatureAnalysis {
    return {
      impactedModules: ['Frontend', 'Backend', 'Schema compartilhado'],
      dependencies: ['Validar contrato de dados existente', 'Reutilizar componentes e serviços atuais'],
      userStories: [
        'Como usuário, quero acessar a nova funcionalidade para resolver a necessidade descrita',
        'Como operador, quero critérios claros para validar a entrega'
      ],
      rolloutPlan: [
        'Implementar em incremento pequeno',
        'Validar com testes e fluxo local',
        'Liberar após confirmação dos critérios de aceite'
      ],
      successMetrics: [
        'Taxa de uso da funcionalidade',
        'Redução do tempo ou esforço no fluxo afetado',
        'Quantidade de erros reportados após release'
      ],
      risks: [
        'Escopo crescer além do necessário',
        'Integração impactar fluxo existente',
        'Critérios de aceite ficarem subjetivos'
      ],
      effortEstimate: 'Até 14 dias, dividido em implementação, testes e validação de rollout'
    };
  }
}
