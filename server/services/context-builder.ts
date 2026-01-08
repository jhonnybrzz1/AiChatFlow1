import { Demand } from '@shared/schema';
import { repoService } from './repo-service';
import { gitHubService } from './github';

/**
 * Context Builder - Creates structured context for agents with anti-overengineering constraints
 */
export class ContextBuilder {
  
  /**
   * Creates a comprehensive context with project constraints and real data
   * @param demand - The demand being processed
   * @returns Structured context string
   */
  async buildContext(demand: Demand): Promise<string> {
    const baseContext = this.createBaseContext();
    const repoContext = await this.createRepositoryContext(demand);
    
    return `${baseContext}\n\n${repoContext}`.trim();
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
            if (content && content.encoding === 'base64') {
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