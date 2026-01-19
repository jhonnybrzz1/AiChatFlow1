import { Demand } from '@shared/schema';
import { repoService } from './repo-service';
import { gitHubService } from './github';

/**
 * Agent insight for context evolution
 */
interface AgentInsight {
  agentName: string;
  insight: string;
  timestamp: string;
}

/**
 * Reality constraints from project analysis
 */
interface RealityConstraints {
  maturityLevel: string;
  allowedTechnologies: string[];
  forbiddenTechnologies: string[];
  maxEffortDays: number;
  minROI: string;
}

/**
 * Evolving context that grows with agent contributions
 */
interface EvolvingContext {
  baseContext: string;
  repoContext: string;
  agentInsights: AgentInsight[];
  realityConstraints: RealityConstraints | null;
  lastUpdated: string;
}

/**
 * Context Builder - Creates structured context for agents with anti-overengineering constraints
 * Now supports context evolution where insights from each agent enrich the context for subsequent agents
 */
export class ContextBuilder {

  private evolvingContexts: Map<number, EvolvingContext> = new Map();

  /**
   * Creates a comprehensive context with project constraints and real data
   * @param demand - The demand being processed
   * @returns Structured context string
   */
  async buildContext(demand: Demand): Promise<string> {
    const baseContext = this.createBaseContext();
    const repoContext = await this.createRepositoryContext(demand);

    // Initialize evolving context for this demand
    this.evolvingContexts.set(demand.id, {
      baseContext,
      repoContext,
      agentInsights: [],
      realityConstraints: null,
      lastUpdated: new Date().toISOString()
    });

    return `${baseContext}\n\n${repoContext}`.trim();
  }

  /**
   * Gets the evolved context for a demand, including all agent insights collected so far
   * @param demandId - The demand ID
   * @returns The current evolved context string
   */
  getEvolvedContext(demandId: number): string {
    const ctx = this.evolvingContexts.get(demandId);
    if (!ctx) {
      return this.createBaseContext();
    }

    let evolvedContext = `${ctx.baseContext}\n\n${ctx.repoContext}`;

    // Add reality constraints if available
    if (ctx.realityConstraints) {
      evolvedContext += `\n\n--- REALITY CONSTRAINTS (MANDATORY) ---
Maturity Level: ${ctx.realityConstraints.maturityLevel}
Allowed Technologies: ${ctx.realityConstraints.allowedTechnologies.join(', ')}
Forbidden Technologies: ${ctx.realityConstraints.forbiddenTechnologies.join(', ')}
Max Effort: ${ctx.realityConstraints.maxEffortDays} days
Min ROI: ${ctx.realityConstraints.minROI}

IMPORTANTE: Todas as recomendações DEVEM respeitar estas constraints.`;
    }

    // Add accumulated agent insights
    if (ctx.agentInsights.length > 0) {
      evolvedContext += '\n\n--- INSIGHTS ACUMULADOS DOS AGENTES ---\n';
      evolvedContext += 'Use estes insights dos agentes anteriores para enriquecer sua análise:\n\n';

      for (const insight of ctx.agentInsights) {
        evolvedContext += `**${insight.agentName.toUpperCase()}** (${insight.timestamp}):\n`;
        evolvedContext += `${this.extractKeyInsights(insight.insight)}\n\n`;
      }
    }

    return evolvedContext.trim();
  }

  /**
   * Adds an agent's insight to the evolving context
   * This is the core of the Context Evolution Loop
   * @param demandId - The demand ID
   * @param agentName - Name of the agent providing the insight
   * @param insight - The agent's response/insight
   */
  addAgentInsight(demandId: number, agentName: string, insight: string): void {
    const ctx = this.evolvingContexts.get(demandId);
    if (!ctx) {
      console.warn(`No evolving context found for demand ${demandId}`);
      return;
    }

    ctx.agentInsights.push({
      agentName,
      insight,
      timestamp: new Date().toLocaleTimeString('pt-BR')
    });

    ctx.lastUpdated = new Date().toISOString();
    this.evolvingContexts.set(demandId, ctx);

    console.log(`Context evolved: Added insight from ${agentName} for demand ${demandId} (${ctx.agentInsights.length} insights total)`);
  }

  /**
   * Sets reality constraints for a demand's context
   * @param demandId - The demand ID
   * @param constraints - Reality constraints from project analysis
   */
  setRealityConstraints(demandId: number, constraints: RealityConstraints): void {
    const ctx = this.evolvingContexts.get(demandId);
    if (!ctx) {
      console.warn(`No evolving context found for demand ${demandId}`);
      return;
    }

    ctx.realityConstraints = constraints;
    ctx.lastUpdated = new Date().toISOString();
    this.evolvingContexts.set(demandId, ctx);

    console.log(`Reality constraints applied to demand ${demandId}`);
  }

  /**
   * Extracts key insights from an agent's response for context enrichment
   * Focuses on actionable items, decisions, and important findings
   */
  private extractKeyInsights(response: string): string {
    const lines = response.split('\n');
    const keyLines: string[] = [];

    for (const line of lines) {
      const trimmed = line.trim();
      // Extract lines with key markers
      if (trimmed.startsWith('**') ||
          trimmed.startsWith('- ') ||
          trimmed.match(/^(Análise|Recomendação|Problema|Impacto|ROI|Esforço|Prioridade):/i) ||
          trimmed.match(/\d+:\d+/) || // ROI pattern
          trimmed.match(/\d+\s*(dia|semana)/i)) { // Effort pattern
        keyLines.push(trimmed);
      }
    }

    // Return summary if we found key lines, otherwise return truncated original
    if (keyLines.length > 0) {
      return keyLines.slice(0, 8).join('\n');
    }

    // Fallback: return first 300 chars
    return response.substring(0, 300) + (response.length > 300 ? '...' : '');
  }

  /**
   * Clears the evolving context for a demand (call after processing completes)
   */
  clearEvolvingContext(demandId: number): void {
    this.evolvingContexts.delete(demandId);
  }

  /**
   * Gets summary of all agent insights for document generation
   */
  getInsightsSummary(demandId: number): string {
    const ctx = this.evolvingContexts.get(demandId);
    if (!ctx || ctx.agentInsights.length === 0) {
      return '';
    }

    let summary = '--- RESUMO DOS INSIGHTS DA SQUAD ---\n\n';

    for (const insight of ctx.agentInsights) {
      summary += `### ${insight.agentName.toUpperCase()}\n`;
      summary += `${insight.insight}\n\n`;
    }

    return summary;
  }
  
  /**
   * Creates base context with project constraints and anti-overengineering rules
   */
  private createBaseContext(): string {
    return `--- AICHATFLOW CORE CONSTRAINTS ---
1. Stack atual: TypeScript, React, Node.js, Vite
2. Arquitetura: Monolítico com Cognitive Core
3. Banco de dados: Storage local (SQLite)
4. Agentes disponíveis: refinador, scrum_master, qa, ux, analista_de_dados, tech_lead
5. Limites: Sem novas tecnologias, ROI mínimo 3:1, esforço < 2 semanas

--- ANTI-OVERENGINEERING RULES ---
1. Baseie TODAS as recomendações em dados concretos
2. NÃO sugira tecnologias fora do stack atual
3. Priorize soluções com ROI > 3:1
4. Considere limites reais de tempo e orçamento
5. Seja específico e prático nas respostas

--- CURRENT PROJECT METRICS ---
- Frontend: 15 componentes React principais
- Backend: 8 serviços Node.js
- Cognitive Core: 6 módulos de IA
- Roteamento: ML-based com 3 plugins
- Storage: Interface assíncrona local

--- QUALITY CHECKLIST ---
Para cada recomendação, valide:
- [ ] Baseado em dados reais do projeto?
- [ ] Alinhado com stack atual?
- [ ] ROI > 3:1?
- [ ] Esforço < 2 semanas?
- [ ] Impacto mensurável?
- [ ] Priorizado corretamente?

--- REFINEMENT GUIDELINES ---
1. Seja específico: "Adicionar cache LRU no MLRouter" ✅
2. Evite generalizações: "Melhorar performance" ❌
3. Use métricas reais: "Reduzir tempo de 2.3s para 0.8s" ✅
4. Priorize: Crítico > Importante > Desejável
5. Seja prático: Soluções implementáveis em < 2 semanas

--- OUTPUT FORMAT REQUIREMENTS ---
TODAS as respostas devem seguir este formato:

**Análise:** [Análise específica baseada em dados]
**Problema Identificado:** [Problema concreto com evidência]
**Impacto:** [Métrica de impacto mensurável]
**Recomendação:** [Solução específica e prática]
**ROI:** [Cálculo realista de retorno]
**Esforço:** [Tempo estimado em dias]
**Prioridade:** [Crítico/Importante/Desejável]

Exemplo:
**Análise:** O arquivo ai-squad.ts tem 927 linhas com múltiplas responsabilidades
**Problema Identificado:** Alto acoplamento entre lógica de SSE e processamento de demandas
**Impacto:** Dificuldade de manutenção e teste, risco de bugs
**Recomendação:** Extrair lógica de SSE para serviço separado (SSEService)
**ROI:** 4:1 (reduz complexidade em 30%, melhora testabilidade)
**Esforço:** 3 dias
**Prioridade:** Importante`;
  }
  
  /**
   * Creates repository-specific context if available
   */
  private async createRepositoryContext(demand: Demand): Promise<string> {
    const description = demand.description;
    const repoMatch = description.match(/Repositório:\s*([^\/\s]+\/[^\s]+)/);
    
    if (!repoMatch || !repoMatch[1]) {
      return "--- REPOSITORY CONTEXT ---\nNenhum repositório especificado na demanda.";
    }
    
    const [owner, repoName] = repoMatch[1].split('/');
    if (!owner || !repoName) {
      return "--- REPOSITORY CONTEXT ---\nFormato de repositório inválido.";
    }
    
    try {
      const repo = await repoService.getOrCreateRepo(owner, repoName);
      if (!repo) {
        return "--- REPOSITORY CONTEXT ---\nRepositório não encontrado.";
      }

      const briefing = repo.briefing ? `--- REPOSITORY BRIEFING ---\n${repo.briefing}\n\n` : "";
      const systemMap = repo.systemMap ? `--- SYSTEM MAP ---\n${repo.systemMap}\n\n` : "";
      
      let specificFilesContext = "";
      const userOnlyDescription = description.split('---')[0].trim();
      const searchQuery = `${demand.title} ${userOnlyDescription}`.trim();
      const searchResults = await gitHubService.searchRepo(owner, repoName, searchQuery);
      
      if (searchResults.length > 0) {
        const topFiles = searchResults.slice(0, 5);
        specificFilesContext += "--- DEMAND-SPECIFIC FILE CONTEXT ---\n";
        for (const filePath of topFiles) {
          try {
            const content = await gitHubService.getRepoContent(owner, repoName, filePath);
            // Type guard: check if content is a file (not array/dir) with encoding
            if (content && !Array.isArray(content) && 'encoding' in content && content.encoding === 'base64' && 'content' in content && content.content) {
              const decodedContent = Buffer.from(content.content, 'base64').toString('utf8');
              specificFilesContext += `--- FILE: ${filePath} ---\n${decodedContent}\n\n`;
            }
          } catch (error) {
            console.warn(`Could not read file ${filePath}:`, error);
          }
        }
      }
      
      return `${briefing}${systemMap}${specificFilesContext}`.trim();
    } catch (error) {
      console.error(`Error assembling repository context for ${owner}/${repoName}:`, error);
      return "--- REPOSITORY CONTEXT ---\nFalha ao carregar contexto do repositório. Prosseguindo com cuidado.";
    }
  }
  
  /**
   * Validates agent response against anti-overengineering rules
   * @param response - Agent response to validate
   * @returns Validation result with score
   */
  validateResponse(response: string): { isValid: boolean; score: number; issues: string[] } {
    const issues: string[] = [];
    let score = 100;
    
    // Check for specificity
    if (!response.includes("**Análise:**") || !response.includes("**Recomendação:**")) {
      issues.push("Formato de resposta incorreto - falta estrutura requerida");
      score -= 30;
    }
    
    // Check for ROI mention
    if (!response.includes("**ROI:**") || !response.match(/\d+:\d+/)) {
      issues.push("ROI não especificado ou formato incorreto");
      score -= 20;
    }
    
    // Check for effort estimation
    if (!response.includes("**Esforço:**") || !response.match(/\d+\s*(dia|semana)/i)) {
      issues.push("Esforço não estimado ou formato incorreto");
      score -= 20;
    }
    
    // Check for priority
    if (!response.includes("**Prioridade:**") || 
        !response.match(/(crítico|importante|desejável)/i)) {
      issues.push("Prioridade não especificada ou inválida");
      score -= 15;
    }
    
    // Check for concrete data
    if (!response.match(/\d+\s*(linha|arquivo|módulo|serviço|componente)/i)) {
      issues.push("Falta referência a dados concretos do projeto");
      score -= 15;
    }
    
    return {
      isValid: score >= 80,
      score,
      issues
    };
  }
}

export const contextBuilder = new ContextBuilder();