import { Demand } from '@shared/schema';
import { openAIService } from './openai-ai';
import { mistralService } from './mistral-ai';
import { MODEL_NANO } from './model-routing';

const USE_MISTRAL_FOR_CLASSIFICATION = process.env.MISTRAL_API_KEY ? true : false;

/**
 * Extended Router Agent Classification Contract
 * Follows the hybrid model routing specification for GPT-5.4 nano/mini
 */
export interface RouterClassificationContract {
  tipo_demanda: 'bug' | 'feature' | 'melhoria' | 'debito_tecnico' | 'discovery' | 'documentacao' | 'analise_tecnica' | 'spike';
  area_responsavel?: string;
  complexidade: 'baixa' | 'media' | 'alta';
  risco: 'baixo' | 'medio' | 'alto';
  clareza_da_demanda: 'baixa' | 'media' | 'alta';
  impacto_negocio: 'baixo' | 'medio' | 'alto' | 'critico';
  necessita_codigo: boolean;
  necessita_arquitetura: boolean;
  necessita_ux: boolean;
  necessita_qa: boolean;
  necessita_prd: boolean;
  necessita_dados: boolean;
  modelo_recomendado: 'gpt-5.4-nano-2026-03-17' | 'gpt-5.4-mini-2026-03-17';
  agentes_recomendados: string[];
  justificativa: string;
}

/**
 * Classification result for a demand
 * Extended with RouterClassificationContract for hybrid model routing
 */
export interface DemandClassification {
  type: string;
  complexity: 'low' | 'medium' | 'high';
  requiredAgents: string[];
  estimatedInputTokens: number;
  estimatedOutputTokens: number;
  confidence: number;
  reasoning: string;

  // Extended router contract (populated by AI classification)
  routerContract?: RouterClassificationContract;
}

/**
 * Agent relevance matrix - defines which agents are needed for each demand type
 */
/**
 * Agent relevance matrix - defines which agents are needed for each demand type
 * Refinador removed - clarification is done by classifier and PO
 */
const AGENT_RELEVANCE_MATRIX: Record<string, {
  required: string[];
  optional: string[];
  complexity: Record<string, string[]>;
}> = {
  bug: {
    required: ['qa', 'tech_lead'],
    optional: ['ux'],
    complexity: {
      low: ['qa'],
      medium: ['qa', 'tech_lead'],
      high: ['qa', 'tech_lead', 'ux']
    }
  },
  feature: {
    required: ['ux', 'tech_lead'],
    optional: ['qa', 'analista_de_dados', 'scrum_master'],
    complexity: {
      low: ['ux', 'tech_lead'],
      medium: ['ux', 'tech_lead', 'qa'],
      high: ['scrum_master', 'qa', 'ux', 'analista_de_dados', 'tech_lead']
    }
  },
  melhoria: {
    required: ['qa', 'analista_de_dados'],
    optional: ['tech_lead', 'ux'],
    complexity: {
      low: ['qa'],
      medium: ['qa', 'analista_de_dados'],
      high: ['qa', 'analista_de_dados', 'tech_lead']
    }
  },
  discovery: {
    required: ['ux', 'analista_de_dados'],
    optional: ['scrum_master', 'tech_lead'],
    complexity: {
      low: ['ux'],
      medium: ['ux', 'analista_de_dados'],
      high: ['ux', 'analista_de_dados', 'scrum_master']
    }
  },
  spike: {
    required: ['tech_lead'],
    optional: ['analista_de_dados'],
    complexity: {
      low: ['tech_lead'],
      medium: ['tech_lead', 'analista_de_dados'],
      high: ['tech_lead', 'analista_de_dados', 'qa']
    }
  }
};

/**
 * Token estimation per agent (average)
 */
const AGENT_TOKEN_ESTIMATES = {
  input: {
    refinador: 2000,
    scrum_master: 1500,
    qa: 1500,
    ux: 1500,
    analista_de_dados: 1800,
    tech_lead: 2500
  },
  output: {
    refinador: 1500,
    scrum_master: 800,
    qa: 1000,
    ux: 800,
    analista_de_dados: 800,
    tech_lead: 1200
  }
};

/**
 * Demand Classifier - Determines optimal agent subset for a demand
 * Uses lightweight model (nano) for fast classification
 */
export class DemandClassifier {
  /**
   * Classifies a demand and determines which agents should participate
   * @param demand - The demand to classify
   * @returns Classification result with required agents
   */
  async classify(demand: Demand): Promise<DemandClassification> {
    // Quick heuristic-based classification for known types
    const heuristicResult = this.heuristicClassification(demand);
    
    if (heuristicResult.confidence >= 0.9) {
      console.log(`Demand ${demand.id} classified via heuristics: ${heuristicResult.complexity} complexity, ${heuristicResult.requiredAgents.length} agents`);
      return heuristicResult;
    }

    // Use AI for complex or ambiguous cases
    try {
      const aiResult = await this.aiClassification(demand);
      console.log(`Demand ${demand.id} classified via AI: ${aiResult.complexity} complexity, ${aiResult.requiredAgents.length} agents`);
      return aiResult;
    } catch (error) {
      console.error('AI classification failed, falling back to heuristics:', error);
      return heuristicResult;
    }
  }

  /**
   * Fast heuristic-based classification using rules
   * Generates routerContract for hybrid model routing
   */
  private heuristicClassification(demand: Demand): DemandClassification {
    const type = demand.type.toLowerCase();
    const description = demand.description.toLowerCase();

    // Determine complexity based on keywords and length
    let complexity: 'low' | 'medium' | 'high' = 'medium';
    let complexidadePt: 'baixa' | 'media' | 'alta' = 'media';
    let confidence = 0.7;

    // Low complexity indicators
    if (
      description.length < 200 ||
      description.includes('simples') ||
      description.includes('pequeno') ||
      description.includes('rápido') ||
      (type === 'bug' && !description.includes('crítico'))
    ) {
      complexity = 'low';
      complexidadePt = 'baixa';
      confidence = 0.85;
    }

    // High complexity indicators
    if (
      description.length > 800 ||
      description.includes('complexo') ||
      description.includes('arquitetura') ||
      description.includes('refatoração') ||
      description.includes('integração') ||
      description.includes('múltiplos') ||
      description.includes('vários') ||
      demand.priority === 'alta'
    ) {
      complexity = 'high';
      complexidadePt = 'alta';
      confidence = 0.85;
    }

    // Determine risk based on keywords
    let risco: 'baixo' | 'medio' | 'alto' = 'medio';
    if (
      description.includes('crítico') ||
      description.includes('segurança') ||
      description.includes('financeiro') ||
      description.includes('pagamento') ||
      description.includes('jurídico') ||
      description.includes('compliance') ||
      demand.priority === 'critica'
    ) {
      risco = 'alto';
    } else if (description.length < 150 && type === 'bug') {
      risco = 'baixo';
    }

    // Determine clarity based on description quality
    let clareza: 'baixa' | 'media' | 'alta' = 'media';
    if (description.length > 300 && (description.includes('quando') || description.includes('para que'))) {
      clareza = 'alta';
    } else if (description.length < 100 || description.split(' ').length < 15) {
      clareza = 'baixa';
    }

    // Determine business impact
    let impacto: 'baixo' | 'medio' | 'alto' | 'critico' = 'medio';
    if (demand.priority === 'critica' || description.includes('urgente') || description.includes('produção')) {
      impacto = 'critico';
    } else if (demand.priority === 'alta' || risco === 'alto') {
      impacto = 'alto';
    } else if (complexity === 'low' && risco === 'baixo') {
      impacto = 'baixo';
    }

    // Determine flags based on content analysis
    const necessita_arquitetura = description.includes('arquitetura') || description.includes('refatoração') || complexity === 'high';
    const necessita_ux = description.includes('usuário') || description.includes('interface') || description.includes('tela') || description.includes('fluxo') || type === 'feature';
    const necessita_qa = true; // Always need QA
    const necessita_prd = type !== 'bug' || complexity === 'high';
    const necessita_dados = description.includes('dados') || description.includes('relatório') || description.includes('análise') || description.includes('integração');

    // Get agents based on type and complexity
    const matrix = AGENT_RELEVANCE_MATRIX[type] || AGENT_RELEVANCE_MATRIX.feature;
    const requiredAgents = matrix.complexity[complexity] || matrix.required;

    // Determine recommended model based on rules
    const modelo_recomendado: 'gpt-5.4-nano-2026-03-17' | 'gpt-5.4-mini-2026-03-17' =
      (complexity === 'low' && risco === 'baixo' && clareza === 'alta')
        ? 'gpt-5.4-nano-2026-03-17'
        : 'gpt-5.4-mini-2026-03-17';

    // Estimate tokens
    const { estimatedInputTokens, estimatedOutputTokens } = this.estimateTokens(requiredAgents);

    // Build router contract
    const routerContract: RouterClassificationContract = {
      tipo_demanda: this.mapTypeToTipoDemanda(type),
      complexidade: complexidadePt,
      risco,
      clareza_da_demanda: clareza,
      impacto_negocio: impacto,
      necessita_codigo: type !== 'discovery' && type !== 'documentacao',
      necessita_arquitetura,
      necessita_ux,
      necessita_qa,
      necessita_prd,
      necessita_dados,
      modelo_recomendado,
      agentes_recomendados: requiredAgents,
      justificativa: `Classificação heurística: ${complexidadePt} complexidade, ${risco} risco, ${clareza} clareza. Modelo ${modelo_recomendado} recomendado.`
    };

    return {
      type,
      complexity,
      requiredAgents,
      estimatedInputTokens,
      estimatedOutputTokens,
      confidence,
      reasoning: `Heuristic classification based on type=${type}, length=${description.length}, keywords`,
      routerContract
    };
  }

  /**
   * AI-based classification for complex cases
   * Generates full RouterClassificationContract for hybrid model routing
   */
  private async aiClassification(demand: Demand): Promise<DemandClassification> {
    const systemPrompt = `Você é o Router Agent do AiChatFlow, especializado em classificar demandas e determinar o roteamento híbrido de modelos GPT-5.4 nano/mini.

AGENTES DISPONÍVEIS:
- refinador: Reformula e estrutura a demanda (mini para exploração)
- scrum_master: Analisa impacto no processo e define incrementos (nano para fluxo, mini para diagnóstico)
- qa: Identifica critérios de aceite e cenários de teste (mini)
- ux: Avalia experiência do usuário e fluxo de interação (mini)
- analista_de_dados: Verifica estrutura de dados e integrações (nano para extração, mini para análise)
- tech_lead: Avalia viabilidade técnica e arquitetura (mini)
- product_manager: Gera PRD, objetivos, escopo e métricas (mini)
- product_owner: User stories, regras de negócio e critérios de aceite (mini)

REGRAS DE ROTEAMENTO DE MODELOS:
1. GPT-5.4 nano: classificação, extração, validação estrutural, tagging, deduplicação
2. GPT-5.4 mini: PRD, arquitetura, trade-offs, QA extensivo, UX, análise de dados, consolidação

CRITÉRIOS DE DECISÃO:
- Demandas simples (baixa complexidade + baixo risco + alta clareza): majoritariamente nano
- Demandas médias ou complexas: obrigatório pelo menos um agente com mini
- Alto risco (técnico, jurídico, financeiro, arquitetural): obrigatório Tech Lead com mini
- Geração de PRD: sempre mini
- Validações estruturais: sempre nano

Responda APENAS com JSON válido no formato:
{
  "tipo_demanda": "bug|feature|melhoria|debito_tecnico|discovery|documentacao|analise_tecnica|spike",
  "area_responsavel": "área ou módulo afetado",
  "complexidade": "baixa|media|alta",
  "risco": "baixo|medio|alto",
  "clareza_da_demanda": "baixa|media|alta",
  "impacto_negocio": "baixo|medio|alto|critico",
  "necessita_codigo": true/false,
  "necessita_arquitetura": true/false,
  "necessita_ux": true/false,
  "necessita_qa": true/false,
  "necessita_prd": true/false,
  "necessita_dados": true/false,
  "modelo_recomendado": "gpt-5.4-nano|gpt-5.4-mini",
  "agentes_recomendados": ["agent1", "agent2"],
  "justificativa": "breve explicação da decisão de roteamento",
  "confidence": 0.0-1.0
}`;

    const userPrompt = `Classifique esta demanda para roteamento híbrido:

Tipo: ${demand.type}
Título: ${demand.title}
Descrição: ${demand.description}
Prioridade: ${demand.priority}
Domínio: ${demand.domain || 'não especificado'}

Determine o contrato completo de roteamento.`;

    try {
      // Use Mistral Medium for classification (more cost-effective)
      let response: string;

      if (USE_MISTRAL_FOR_CLASSIFICATION && mistralService.isAvailable()) {
        console.log('[CLASSIFIER] Using Mistral Medium for classification');
        response = await mistralService.generateChatCompletion(
          systemPrompt,
          userPrompt,
          {
            temperature: 0.3,
            maxTokens: 500,
            operation: 'router_classification_mistral'
          }
        );
      } else {
        console.log('[CLASSIFIER] Using GPT nano for classification');
        response = await openAIService.generateChatCompletion(
          systemPrompt,
          userPrompt,
          {
            temperature: 0.3,
            maxTokens: 500,
            model: MODEL_NANO,
            taskType: 'classification',
            operation: 'router_classification'
          }
        );
      }

      // Parse JSON response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('Invalid JSON response from Router Agent');
      }

      const parsed = JSON.parse(jsonMatch[0]);

      // Map complexidade to complexity
      const complexityMap: Record<string, 'low' | 'medium' | 'high'> = {
        'baixa': 'low',
        'media': 'medium',
        'alta': 'high'
      };
      const complexity = complexityMap[parsed.complexidade] || 'medium';

      // Validate and sanitize agents
      const validAgents = ['refinador', 'scrum_master', 'qa', 'ux', 'analista_de_dados', 'tech_lead', 'product_manager', 'product_owner'];
      const requiredAgents = Array.isArray(parsed.agentes_recomendados)
        ? parsed.agentes_recomendados.filter((a: string) => validAgents.includes(a))
        : AGENT_RELEVANCE_MATRIX[demand.type]?.required || ['refinador', 'tech_lead'];

      const confidence = typeof parsed.confidence === 'number'
        ? Math.min(1, Math.max(0, parsed.confidence))
        : 0.8;

      const { estimatedInputTokens, estimatedOutputTokens } = this.estimateTokens(requiredAgents);

      // Build router contract
      const routerContract: RouterClassificationContract = {
        tipo_demanda: parsed.tipo_demanda || this.mapTypeToTipoDemanda(demand.type),
        area_responsavel: parsed.area_responsavel,
        complexidade: parsed.complexidade || 'media',
        risco: parsed.risco || 'medio',
        clareza_da_demanda: parsed.clareza_da_demanda || 'media',
        impacto_negocio: parsed.impacto_negocio || 'medio',
        necessita_codigo: parsed.necessita_codigo ?? true,
        necessita_arquitetura: parsed.necessita_arquitetura ?? (complexity === 'high'),
        necessita_ux: parsed.necessita_ux ?? requiredAgents.includes('ux'),
        necessita_qa: parsed.necessita_qa ?? true,
        necessita_prd: parsed.necessita_prd ?? true,
        necessita_dados: parsed.necessita_dados ?? requiredAgents.includes('analista_de_dados'),
        modelo_recomendado: parsed.modelo_recomendado || (complexity === 'low' ? 'gpt-5.4-nano-2026-03-17' : 'gpt-5.4-mini-2026-03-17'),
        agentes_recomendados: requiredAgents,
        justificativa: parsed.justificativa || 'Classificação baseada em tipo e complexidade'
      };

      return {
        type: demand.type,
        complexity,
        requiredAgents,
        estimatedInputTokens,
        estimatedOutputTokens,
        confidence,
        reasoning: parsed.justificativa || 'Router Agent classification',
        routerContract
      };
    } catch (error) {
      console.error('Error in AI classification:', error);
      throw error;
    }
  }

  /**
   * Maps demand type to tipo_demanda enum
   */
  private mapTypeToTipoDemanda(type: string): RouterClassificationContract['tipo_demanda'] {
    const map: Record<string, RouterClassificationContract['tipo_demanda']> = {
      'bug': 'bug',
      'feature': 'feature',
      'melhoria': 'melhoria',
      'improvement': 'melhoria',
      'discovery': 'discovery',
      'spike': 'spike',
      'debito': 'debito_tecnico',
      'debt': 'debito_tecnico',
      'doc': 'documentacao',
      'documentation': 'documentacao',
      'analysis': 'analise_tecnica'
    };
    return map[type.toLowerCase()] || 'feature';
  }

  /**
   * Estimates token consumption for a set of agents
   */
  private estimateTokens(agents: string[]): {
    estimatedInputTokens: number;
    estimatedOutputTokens: number;
  } {
    let inputTokens = 0;
    let outputTokens = 0;

    for (const agent of agents) {
      inputTokens += AGENT_TOKEN_ESTIMATES.input[agent as keyof typeof AGENT_TOKEN_ESTIMATES.input] || 1500;
      outputTokens += AGENT_TOKEN_ESTIMATES.output[agent as keyof typeof AGENT_TOKEN_ESTIMATES.output] || 800;
    }

    // Add overhead for context, routing, documents
    inputTokens += 5000; // Base context + routing + documents
    outputTokens += 6000; // PRD + Tasks

    return { 
      estimatedInputTokens: inputTokens, 
      estimatedOutputTokens: outputTokens 
    };
  }

  /**
   * Gets the default agents for a demand type (fallback)
   */
  getDefaultAgents(type: string): string[] {
    const matrix = AGENT_RELEVANCE_MATRIX[type.toLowerCase()];
    return matrix ? matrix.required : ['tech_lead', 'qa'];
  }

  /**
   * Validates if an agent is relevant for a demand type
   */
  isAgentRelevant(agentName: string, demandType: string, complexity: 'low' | 'medium' | 'high'): boolean {
    const matrix = AGENT_RELEVANCE_MATRIX[demandType.toLowerCase()];
    if (!matrix) return true; // If unknown type, include all agents

    const requiredForComplexity = matrix.complexity[complexity] || matrix.required;
    return requiredForComplexity.includes(agentName) || matrix.optional.includes(agentName);
  }
}

export const demandClassifier = new DemandClassifier();
