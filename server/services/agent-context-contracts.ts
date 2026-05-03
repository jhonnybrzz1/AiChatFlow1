import { Demand } from '@shared/schema';

/**
 * Defines the context contract for an agent
 * Specifies what information the agent needs and token limits
 */
export interface AgentContextContract {
  agentName: string;
  maxContextTokens: number;
  requiredSections: ContextSection[];
  optionalSections: ContextSection[];
  responseMaxTokens: number;
  responseFormat: 'structured' | 'markdown' | 'json';
}

/**
 * Context sections that can be included
 */
export type ContextSection = 
  | 'demand'              // Basic demand info (title, description, type)
  | 'constraints'         // Reality constraints and anti-overengineering rules
  | 'repo_briefing'       // Repository briefing
  | 'repo_context'        // Full repository context
  | 'system_map'          // System architecture map
  | 'previous_insights'   // Insights from previous agents (summarized)
  | 'conversation_history' // Full conversation history
  | 'metrics'             // Project metrics
  | 'quality_checklist';  // Quality validation checklist

/**
 * Token estimates per section (approximate)
 */
const SECTION_TOKEN_ESTIMATES: Record<ContextSection, number> = {
  demand: 200,
  constraints: 800,
  repo_briefing: 500,
  repo_context: 2000,
  system_map: 1000,
  previous_insights: 500,
  conversation_history: 1500,
  metrics: 300,
  quality_checklist: 400
};

/**
 * Agent context contracts - defines what each agent needs
 */
export const AGENT_CONTEXT_CONTRACTS: Record<string, AgentContextContract> = {
  refinador: {
    agentName: 'refinador',
    maxContextTokens: 2500,
    requiredSections: ['demand', 'constraints'],
    optionalSections: ['repo_briefing', 'metrics'],
    responseMaxTokens: 1500,
    responseFormat: 'markdown'
  },
  
  scrum_master: {
    agentName: 'scrum_master',
    maxContextTokens: 2000,
    requiredSections: ['demand', 'constraints', 'previous_insights'],
    optionalSections: ['metrics'],
    responseMaxTokens: 800,
    responseFormat: 'structured'
  },
  
  qa: {
    agentName: 'qa',
    maxContextTokens: 2000,
    requiredSections: ['demand', 'constraints', 'previous_insights'],
    optionalSections: ['quality_checklist'],
    responseMaxTokens: 1000,
    responseFormat: 'structured'
  },
  
  ux: {
    agentName: 'ux',
    maxContextTokens: 1800,
    requiredSections: ['demand', 'constraints', 'previous_insights'],
    optionalSections: ['repo_briefing'],
    responseMaxTokens: 800,
    responseFormat: 'structured'
  },
  
  analista_de_dados: {
    agentName: 'analista_de_dados',
    maxContextTokens: 2200,
    requiredSections: ['demand', 'constraints', 'previous_insights'],
    optionalSections: ['system_map', 'repo_context'],
    responseMaxTokens: 800,
    responseFormat: 'structured'
  },
  
  tech_lead: {
    agentName: 'tech_lead',
    maxContextTokens: 3500,
    requiredSections: ['demand', 'constraints', 'repo_context', 'previous_insights'],
    optionalSections: ['system_map', 'metrics'],
    responseMaxTokens: 1200,
    responseFormat: 'structured'
  },
  
  product_manager: {
    agentName: 'product_manager',
    maxContextTokens: 4000,
    requiredSections: ['demand', 'constraints', 'previous_insights'],
    optionalSections: ['repo_briefing', 'metrics'],
    responseMaxTokens: 4000,
    responseFormat: 'markdown'
  }
};

/**
 * Structured response template for agents
 */
export const STRUCTURED_RESPONSE_TEMPLATE = `
Responda em formato estruturado seguindo EXATAMENTE este template:

**Análise:** [Análise específica baseada em dados - máx 200 caracteres]
**Problema Identificado:** [Problema concreto com evidência - máx 200 caracteres]
**Impacto:** [Métrica de impacto mensurável - máx 100 caracteres]
**Recomendação:** [Solução específica e prática - máx 200 caracteres]
**ROI:** [Cálculo realista de retorno, formato X:1]
**Esforço:** [Tempo estimado em dias, ex: "3 dias"]
**Prioridade:** [Crítico|Importante|Desejável]

IMPORTANTE:
- Seja conciso e objetivo
- Use dados concretos quando possível
- Não repita informações de outros agentes
- Foque no seu domínio de expertise
`;

/**
 * JSON response template for structured agents
 */
export const JSON_RESPONSE_TEMPLATE = `
Responda APENAS com JSON válido no seguinte formato:

{
  "analysis": "string (max 200 chars)",
  "problem": "string (max 200 chars)",
  "impact": "string (max 100 chars)",
  "recommendation": "string (max 200 chars)",
  "roi": "string (formato X:1)",
  "effort": "string (ex: 3 dias)",
  "priority": "Crítico|Importante|Desejável"
}

NÃO adicione texto antes ou depois do JSON.
`;

/**
 * Context Builder with Contracts
 * Builds optimized context for each agent based on their contract
 */
export class AgentContextBuilder {
  /**
   * Builds context for a specific agent based on their contract
   */
  buildAgentContext(
    agentName: string,
    demand: Demand,
    availableSections: Partial<Record<ContextSection, string>>,
    previousInsightsSummary?: string
  ): string {
    const contract = AGENT_CONTEXT_CONTRACTS[agentName];
    if (!contract) {
      // Fallback for unknown agents
      return this.buildDefaultContext(demand, availableSections);
    }

    let context = '';
    let currentTokens = 0;

    // Add required sections first
    for (const section of contract.requiredSections) {
      const sectionContent = this.getSectionContent(section, demand, availableSections, previousInsightsSummary);
      if (sectionContent) {
        const sectionTokens = this.estimateTokens(sectionContent);
        if (currentTokens + sectionTokens <= contract.maxContextTokens) {
          context += sectionContent + '\n\n';
          currentTokens += sectionTokens;
        }
      }
    }

    // Add optional sections if we have token budget
    for (const section of contract.optionalSections) {
      const sectionContent = this.getSectionContent(section, demand, availableSections, previousInsightsSummary);
      if (sectionContent) {
        const sectionTokens = this.estimateTokens(sectionContent);
        if (currentTokens + sectionTokens <= contract.maxContextTokens) {
          context += sectionContent + '\n\n';
          currentTokens += sectionTokens;
        } else {
          // Truncate if needed
          const remainingTokens = contract.maxContextTokens - currentTokens;
          if (remainingTokens > 100) {
            const truncated = this.truncateToTokens(sectionContent, remainingTokens);
            context += truncated + '\n\n';
            break; // Stop adding more sections
          }
        }
      }
    }

    // Add response format instructions
    context += this.getResponseFormatInstructions(contract);

    return context.trim();
  }

  /**
   * Gets content for a specific section
   */
  private getSectionContent(
    section: ContextSection,
    demand: Demand,
    availableSections: Partial<Record<ContextSection, string>>,
    previousInsightsSummary?: string
  ): string {
    switch (section) {
      case 'demand':
        return `--- DEMANDA ---
Título: ${demand.title}
Descrição: ${demand.description}
Tipo: ${demand.type}
Prioridade: ${demand.priority}`;

      case 'previous_insights':
        if (previousInsightsSummary) {
          return `--- INSIGHTS DOS AGENTES ANTERIORES ---
${previousInsightsSummary}

IMPORTANTE: Use estes insights para enriquecer sua análise. NÃO repita o que já foi dito.`;
        }
        return '';

      default:
        return availableSections[section] || '';
    }
  }

  /**
   * Gets response format instructions based on contract
   */
  private getResponseFormatInstructions(contract: AgentContextContract): string {
    let instructions = `\n--- FORMATO DE RESPOSTA ---\n`;
    instructions += `Limite máximo: ${contract.responseMaxTokens} tokens\n\n`;

    switch (contract.responseFormat) {
      case 'structured':
        instructions += STRUCTURED_RESPONSE_TEMPLATE;
        break;
      case 'json':
        instructions += JSON_RESPONSE_TEMPLATE;
        break;
      case 'markdown':
        instructions += `Responda em Markdown bem estruturado com seções claras.`;
        break;
    }

    return instructions;
  }

  /**
   * Builds default context for unknown agents
   */
  private buildDefaultContext(
    demand: Demand,
    availableSections: Partial<Record<ContextSection, string>>
  ): string {
    let context = `--- DEMANDA ---
Título: ${demand.title}
Descrição: ${demand.description}
Tipo: ${demand.type}
Prioridade: ${demand.priority}\n\n`;

    if (availableSections.constraints) {
      context += availableSections.constraints + '\n\n';
    }

    return context;
  }

  /**
   * Estimates tokens in text (rough approximation)
   */
  private estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }

  /**
   * Truncates text to approximately fit token limit
   */
  private truncateToTokens(text: string, maxTokens: number): string {
    const maxChars = maxTokens * 4;
    if (text.length <= maxChars) {
      return text;
    }
    return text.substring(0, maxChars) + '\n\n[... conteúdo truncado para respeitar limite de tokens ...]';
  }

  /**
   * Gets the contract for an agent
   */
  getContract(agentName: string): AgentContextContract | null {
    return AGENT_CONTEXT_CONTRACTS[agentName] || null;
  }

  /**
   * Estimates total tokens for an agent's context
   */
  estimateAgentTokens(agentName: string, sections: ContextSection[]): number {
    let total = 0;
    for (const section of sections) {
      total += SECTION_TOKEN_ESTIMATES[section] || 0;
    }
    return total;
  }

  /**
   * Gets all available agents with contracts
   */
  getAvailableAgents(): string[] {
    return Object.keys(AGENT_CONTEXT_CONTRACTS);
  }
}

export const agentContextBuilder = new AgentContextBuilder();
