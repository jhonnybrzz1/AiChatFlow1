# Guia de Implementação - Otimização de Tokens

## Visão Geral

Este guia detalha como integrar os novos serviços de otimização de tokens no fluxo existente do AiChatFlow.

**Novos Serviços Criados:**
1. `demand-classifier.ts` - Classificação inteligente de demandas
2. `agent-context-contracts.ts` - Contratos de contexto por agente
3. `structured-summary.ts` - Resumos estruturados de insights

---

## Fase 1: Integração do Classificador de Demandas

### 1.1 Modificar `ai-squad.ts`

**Localização**: `server/services/ai-squad.ts`

**Mudanças necessárias:**

```typescript
// Adicionar import no topo do arquivo
import { demandClassifier, DemandClassification } from './demand-classifier';

// No método processDemand, ANTES do loop de agentes:
async processDemand(demandId: number, onProgress?: (message: ChatMessage) => void): Promise<void> {
  const demand = await storage.getDemand(demandId);
  if (!demand) throw new Error("Demand not found");

  // ... código existente de context e reality check ...

  // NOVO: Classificar demanda para determinar agentes necessários
  let classification: DemandClassification;
  try {
    classification = await demandClassifier.classify(demand);
    
    console.log(`Demand ${demandId} classified:`, {
      complexity: classification.complexity,
      requiredAgents: classification.requiredAgents,
      estimatedTokens: classification.estimatedInputTokens + classification.estimatedOutputTokens,
      confidence: classification.confidence
    });

    // Atualizar progresso
    if (onProgress) {
      onProgress({
        id: `${demandId}-classification`,
        agent: 'classifier',
        message: `Demanda classificada: ${classification.complexity} complexidade, ${classification.requiredAgents.length} agentes necessários (${classification.requiredAgents.join(', ')})`,
        timestamp: new Date().toISOString(),
        type: 'completed',
        progress: 8
      });
    }

    // Salvar classificação na demanda
    await storage.updateDemand(demandId, {
      classification: {
        complexity: classification.complexity,
        requiredAgents: classification.requiredAgents,
        estimatedTokens: classification.estimatedInputTokens + classification.estimatedOutputTokens
      }
    });

  } catch (error) {
    console.error('Classification failed, using all agents:', error);
    // Fallback: usar todos os agentes
    classification = {
      type: demand.type,
      complexity: 'medium',
      requiredAgents: this.agents.map(a => a.name),
      estimatedInputTokens: 50000,
      estimatedOutputTokens: 15000,
      confidence: 0.5,
      reasoning: 'Fallback to all agents due to classification error'
    };
  }

  // MODIFICAR: Filtrar agentes baseado na classificação
  const activeAgents = this.agents.filter(agent => 
    classification.requiredAgents.includes(agent.name)
  );

  console.log(`Using ${activeAgents.length} of ${this.agents.length} agents for demand ${demandId}`);

  // Usar activeAgents ao invés de this.agents no loop
  for (let i = 0; i < activeAgents.length; i++) {
    const agent = activeAgents[i];
    // ... resto do código do loop ...
  }
}
```

### 1.2 Atualizar Schema da Demanda

**Localização**: `shared/schema.ts`

```typescript
// Adicionar ao tipo Demand:
export interface Demand {
  // ... campos existentes ...
  classification?: {
    complexity: 'low' | 'medium' | 'high';
    requiredAgents: string[];
    estimatedTokens: number;
  };
}
```

### 1.3 Testar Classificação

```bash
# Criar demanda simples (bug)
# Verificar logs: deve usar apenas 2-3 agentes

# Criar demanda complexa (feature)
# Verificar logs: deve usar 5-6 agentes
```

---

## Fase 2: Integração de Contratos de Contexto

### 2.1 Modificar `context-builder.ts`

**Localização**: `server/services/context-builder.ts`

**Mudanças necessárias:**

```typescript
// Adicionar import
import { agentContextBuilder, AGENT_CONTEXT_CONTRACTS } from './agent-context-contracts';

// Adicionar novo método à classe ContextBuilder:
/**
 * Builds optimized context for a specific agent based on their contract
 */
buildAgentSpecificContext(
  demandId: number,
  agentName: string,
  demand: Demand
): string {
  const ctx = this.evolvingContexts.get(demandId);
  if (!ctx) {
    return this.createBaseContext();
  }

  // Prepare available sections
  const availableSections = {
    constraints: ctx.realityConstraints ? this.formatRealityConstraints(ctx.realityConstraints) : '',
    repo_briefing: ctx.repoContext.includes('BRIEFING') ? ctx.repoContext : '',
    repo_context: ctx.repoContext,
    metrics: this.formatMetrics(),
    quality_checklist: this.formatQualityChecklist()
  };

  // Get summary of previous insights
  const previousInsightsSummary = this.getInsightsSummaryForAgent(demandId, agentName);

  // Use agent context builder to create optimized context
  return agentContextBuilder.buildAgentContext(
    agentName,
    demand,
    availableSections,
    previousInsightsSummary
  );
}

private formatRealityConstraints(constraints: RealityConstraints): string {
  return `--- REALITY CONSTRAINTS ---
Maturity Level: ${constraints.maturityLevel}
Allowed Technologies: ${constraints.allowedTechnologies.join(', ')}
Forbidden Technologies: ${constraints.forbiddenTechnologies.join(', ')}
Max Effort: ${constraints.maxEffortDays} days
Min ROI: ${constraints.minROI}`;
}

private formatMetrics(): string {
  return `--- PROJECT METRICS ---
- Frontend: 15 componentes React principais
- Backend: 8 serviços Node.js
- Cognitive Core: 6 módulos de IA`;
}

private formatQualityChecklist(): string {
  return `--- QUALITY CHECKLIST ---
- [ ] Baseado em dados reais do projeto?
- [ ] Alinhado com stack atual?
- [ ] ROI > 3:1?
- [ ] Esforço < 2 semanas?`;
}

private getInsightsSummaryForAgent(demandId: number, agentName: string): string {
  const ctx = this.evolvingContexts.get(demandId);
  if (!ctx || ctx.agentInsights.length === 0) {
    return '';
  }

  // Get insights from agents that ran before this one
  const previousInsights = ctx.agentInsights
    .filter(insight => insight.agentName !== agentName)
    .slice(-5); // Last 5 insights

  if (previousInsights.length === 0) {
    return '';
  }

  return previousInsights
    .map(insight => `**${insight.agentName}**: ${this.extractKeyInsights(insight.insight)}`)
    .join('\n\n');
}
```

### 2.2 Modificar `ai-squad.ts` para usar contexto otimizado

```typescript
// No método processWithAgent:
private async processWithAgent(
  agentName: string,
  demand: Demand,
  refinementLevels: number,
  internalContext: string, // Este parâmetro não será mais usado diretamente
): Promise<string> {
  const intensityLevel = this.getIntensityByType(demand.type);
  const agentConfig = this.agentConfigs[agentName];

  // NOVO: Usar contexto otimizado baseado no contrato do agente
  const optimizedContext = contextBuilder.buildAgentSpecificContext(
    demand.id,
    agentName,
    demand
  );

  // NOVO: Obter contrato do agente para limites de resposta
  const contract = agentContextBuilder.getContract(agentName);
  const maxTokens = contract ? contract.responseMaxTokens : 1500;

  const systemPrompt = agentConfig?.system_prompt
    ? `${optimizedContext}\n\n${agentConfig.system_prompt}`
    : `${optimizedContext}\n\nVocê é um ${agentName} experiente em uma squad de desenvolvimento.`;

  const userPrompt = agentConfig?.description
    ? `Para esta ${demand.type}, ${agentConfig.description.toLowerCase()}: ${demand.description}`
    : `Analise a demanda: ${demand.description}`;

  try {
    const model = agentConfig?.model || undefined;

    const response = await openAIService.generateChatCompletion(
      systemPrompt,
      userPrompt,
      {
        temperature: 0.7,
        maxTokens: maxTokens, // Usar limite do contrato
        model: model,
        taskType: 'analysis',
        operation: `agent:${agentName}`
      }
    );

    const finalResponse = response || `${agentName} processou a demanda com sucesso.`;

    // Validação existente...
    const validation = contextBuilder.validateResponse(finalResponse);

    if (!validation.isValid) {
      console.warn(`Agent ${agentName} response validation failed (score: ${validation.score}):`, validation.issues);
      return this.createStructuredResponse(agentName, finalResponse, validation);
    }

    return finalResponse;
  } catch (error) {
    console.error(`Error processing with ${agentName}:`, error);
    return `${agentName} encontrou um erro durante o processamento, mas o fluxo continua.`;
  }
}
```

---

## Fase 3: Integração de Resumos Estruturados

### 3.1 Modificar `agent-interaction.ts`

**Localização**: `server/services/agent-interaction.ts`

**Mudanças necessárias:**

```typescript
// Adicionar import
import { summaryBuilder, StructuredSummary } from './structured-summary';

// Adicionar propriedade à classe
export class AgentInteractionService {
  private summaries: Map<number, StructuredSummary> = new Map();

  // Modificar método conductMultiAgentInteraction
  async conductMultiAgentInteraction(
    demand: Demand,
    agentConfigs: Record<string, { system_prompt: string, description: string, model?: string }>,
    internalContext: string,
    onProgress?: (message: ChatMessage) => void,
    options: AgentInteractionOptions = {}
  ): Promise<AgentInteractionResult> {
    // ... código existente até o loop de rounds ...

    for (let round = 0; round < interactionRounds; round++) {
      // ... código existente do round ...

      // NOVO: Após cada round, criar resumo estruturado
      if (round < interactionRounds - 1) { // Não no último round
        const insights = conversationHistory
          .filter(msg => msg.agent !== 'system')
          .map(msg => ({
            agentName: msg.agent,
            insight: msg.message,
            timestamp: msg.timestamp
          }));

        const summary = await summaryBuilder.buildStructuredSummary(insights, false);
        this.summaries.set(demand.id, summary);

        console.log(`Round ${round + 1} summary created: ${summary.metadata.compressionRatio.toFixed(1)}x compression`);

        // Enviar resumo como progresso
        if (onProgress) {
          onProgress({
            id: `${demand.id}-round-${round}-summary`,
            agent: 'system',
            message: summaryBuilder.formatAsMarkdown(summary),
            timestamp: new Date().toISOString(),
            type: 'completed',
            category: 'system',
            progress: 10 + Math.round((round + 1) * 70 / interactionRounds)
          });
        }
      }

      // ... resto do código ...
    }

    // Limpar resumo após conclusão
    this.summaries.delete(demand.id);

    // ... resto do método ...
  }

  // Modificar buildConversationContext para usar resumo
  private buildConversationContext(conversationHistory: AgentMessage[], demandId?: number): string {
    // Se temos um resumo, usar ele ao invés do histórico completo
    if (demandId && this.summaries.has(demandId)) {
      const summary = this.summaries.get(demandId)!;
      return summaryBuilder.formatAsCompactText(summary);
    }

    // Fallback: usar últimas 10 mensagens (reduzido de 20)
    return conversationHistory
      .slice(-10)
      .map(msg => `[${msg.agent}]: ${msg.message}`)
      .join('\n\n');
  }
}
```

### 3.2 Modificar geração de PRD para usar resumo

**Localização**: `server/services/ai-squad.ts`

```typescript
// No método generatePRDWithPM:
private async generatePRDWithPM(
  demand: Demand,
  refinementMessages: ChatMessage[],
  model?: string,
): Promise<string> {
  // NOVO: Criar resumo estruturado ao invés de concatenar tudo
  const insights = refinementMessages
    .filter(msg => msg.type === 'completed')
    .map(msg => ({
      agentName: msg.agent,
      insight: msg.message,
      timestamp: msg.timestamp
    }));

  const summary = await summaryBuilder.buildStructuredSummary(insights, false);
  const refinementSummary = summaryBuilder.formatAsMarkdown(summary);

  console.log(`PRD generation using summary: ${summary.metadata.compressionRatio.toFixed(1)}x compression`);

  // Usar insightsSummary do context builder também
  const insightsSummary = contextBuilder.getInsightsSummary(demand.id);

  // ... resto do código usa refinementSummary ...
}
```

---

## Fase 4: Melhorar Rastreamento de Tokens

### 4.1 Estender `ai-usage-tracker.ts`

**Localização**: `server/services/ai-usage-tracker.ts`

**Adicionar ao final do arquivo:**

```typescript
/**
 * Extended metrics for token optimization tracking
 */
export interface TokenOptimizationMetrics {
  demandId: number;
  stage: 'classification' | 'agent_execution' | 'summary' | 'document_generation';
  agentName?: string;
  tokensUsed: number;
  tokensSaved: number;
  savingsSource: 'classification' | 'context_contract' | 'summary' | 'cache';
  timestamp: string;
}

export class OptimizationTracker {
  private metrics: TokenOptimizationMetrics[] = [];
  private readonly maxMetrics = 1000;

  recordOptimization(metric: TokenOptimizationMetrics): void {
    this.metrics.push(metric);

    if (this.metrics.length > this.maxMetrics) {
      this.metrics.splice(0, this.metrics.length - this.maxMetrics);
    }
  }

  getDemandOptimizations(demandId: number): TokenOptimizationMetrics[] {
    return this.metrics.filter(m => m.demandId === demandId);
  }

  getTotalSavings(): {
    totalSaved: number;
    bySource: Record<string, number>;
    byStage: Record<string, number>;
  } {
    const totalSaved = this.metrics.reduce((sum, m) => sum + m.tokensSaved, 0);
    
    const bySource: Record<string, number> = {};
    const byStage: Record<string, number> = {};

    for (const metric of this.metrics) {
      bySource[metric.savingsSource] = (bySource[metric.savingsSource] || 0) + metric.tokensSaved;
      byStage[metric.stage] = (byStage[metric.stage] || 0) + metric.tokensSaved;
    }

    return { totalSaved, bySource, byStage };
  }

  getOptimizationReport(): string {
    const savings = this.getTotalSavings();
    
    let report = `## Token Optimization Report\n\n`;
    report += `**Total Tokens Saved**: ${savings.totalSaved.toLocaleString()}\n\n`;
    
    report += `### Savings by Source\n`;
    for (const [source, amount] of Object.entries(savings.bySource)) {
      report += `- ${source}: ${amount.toLocaleString()} tokens\n`;
    }
    
    report += `\n### Savings by Stage\n`;
    for (const [stage, amount] of Object.entries(savings.byStage)) {
      report += `- ${stage}: ${amount.toLocaleString()} tokens\n`;
    }

    return report;
  }

  reset(): void {
    this.metrics.splice(0, this.metrics.length);
  }
}

export const optimizationTracker = new OptimizationTracker();
```

### 4.2 Registrar otimizações no fluxo

```typescript
// Em ai-squad.ts, após classificação:
import { optimizationTracker } from './ai-usage-tracker';

// Após classificação bem-sucedida:
const allAgentsTokens = this.agents.length * 3500; // Estimativa
const classifiedAgentsTokens = classification.estimatedInputTokens;
const tokensSaved = allAgentsTokens - classifiedAgentsTokens;

optimizationTracker.recordOptimization({
  demandId: demand.id,
  stage: 'classification',
  tokensUsed: classifiedAgentsTokens,
  tokensSaved: tokensSaved,
  savingsSource: 'classification',
  timestamp: new Date().toISOString()
});

// Após usar resumo estruturado:
optimizationTracker.recordOptimization({
  demandId: demand.id,
  stage: 'summary',
  tokensUsed: summaryTokens,
  tokensSaved: originalTokens - summaryTokens,
  savingsSource: 'summary',
  timestamp: new Date().toISOString()
});

// Após usar contrato de contexto:
optimizationTracker.recordOptimization({
  demandId: demand.id,
  stage: 'agent_execution',
  agentName: agentName,
  tokensUsed: optimizedContextTokens,
  tokensSaved: fullContextTokens - optimizedContextTokens,
  savingsSource: 'context_contract',
  timestamp: new Date().toISOString()
});
```

---

## Fase 5: Testes e Validação

### 5.1 Testes Unitários

Criar arquivo: `tests/token-optimization.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { demandClassifier } from '../server/services/demand-classifier';
import { agentContextBuilder } from '../server/services/agent-context-contracts';
import { summaryBuilder } from '../server/services/structured-summary';

describe('Token Optimization', () => {
  describe('Demand Classifier', () => {
    it('should classify simple bug as low complexity', async () => {
      const demand = {
        id: 1,
        type: 'bug',
        title: 'Botão não funciona',
        description: 'O botão de salvar não está funcionando',
        priority: 'media'
      };

      const classification = await demandClassifier.classify(demand);
      
      expect(classification.complexity).toBe('low');
      expect(classification.requiredAgents.length).toBeLessThan(4);
      expect(classification.requiredAgents).toContain('qa');
    });

    it('should classify complex feature as high complexity', async () => {
      const demand = {
        id: 2,
        type: 'feature',
        title: 'Sistema de autenticação',
        description: 'Implementar sistema completo de autenticação com OAuth, 2FA, recuperação de senha, e integração com múltiplos provedores',
        priority: 'alta'
      };

      const classification = await demandClassifier.classify(demand);
      
      expect(classification.complexity).toBe('high');
      expect(classification.requiredAgents.length).toBeGreaterThan(4);
    });
  });

  describe('Agent Context Contracts', () => {
    it('should build context within token limits', () => {
      const demand = {
        id: 1,
        type: 'bug',
        title: 'Test',
        description: 'Test description',
        priority: 'media'
      };

      const context = agentContextBuilder.buildAgentContext(
        'qa',
        demand,
        {
          constraints: '--- CONSTRAINTS ---\nTest constraints',
          previous_insights: 'Previous insights here'
        }
      );

      const estimatedTokens = Math.ceil(context.length / 4);
      const contract = agentContextBuilder.getContract('qa');
      
      expect(estimatedTokens).toBeLessThanOrEqual(contract!.maxContextTokens);
    });
  });

  describe('Structured Summary', () => {
    it('should compress insights significantly', async () => {
      const insights = [
        {
          agentName: 'qa',
          insight: '**Análise:** O bug afeta o fluxo principal. **Problema Identificado:** Validação incorreta. **Impacto:** Alto. **Recomendação:** Corrigir validação. **ROI:** 5:1. **Esforço:** 2 dias. **Prioridade:** Crítico',
          timestamp: new Date().toISOString()
        },
        {
          agentName: 'tech_lead',
          insight: '**Análise:** Problema no componente Button. **Problema Identificado:** Event handler não registrado. **Impacto:** Médio. **Recomendação:** Adicionar handler. **ROI:** 4:1. **Esforço:** 1 dia. **Prioridade:** Importante',
          timestamp: new Date().toISOString()
        }
      ];

      const summary = await summaryBuilder.buildStructuredSummary(insights, false);

      expect(summary.metadata.compressionRatio).toBeGreaterThan(2);
      expect(summary.decisions.length).toBeGreaterThan(0);
      expect(summary.estimates.effort).not.toBe('não estimado');
    });
  });
});
```

### 5.2 Teste de Integração

```bash
# 1. Criar demanda simples
curl -X POST http://localhost:5000/api/demands \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Corrigir botão de salvar",
    "description": "O botão de salvar não está funcionando na tela de perfil",
    "type": "bug",
    "priority": "media"
  }'

# 2. Verificar logs para:
# - Classificação: deve usar 2-3 agentes
# - Contexto: deve mostrar tokens reduzidos
# - Resumo: deve mostrar compressão

# 3. Comparar com demanda anterior (sem otimização)
# - Tokens de entrada: deve ser ~60% menor
# - Tokens de saída: deve ser ~40% menor
# - Tempo de execução: deve ser similar ou menor
```

### 5.3 Métricas de Validação

Criar endpoint para visualizar métricas:

```typescript
// Em routes.ts
app.get('/api/optimization/metrics', async (req, res) => {
  const report = optimizationTracker.getOptimizationReport();
  const usageSummary = aiUsageTracker.getSummary();
  
  res.json({
    optimization: report,
    usage: usageSummary,
    savings: optimizationTracker.getTotalSavings()
  });
});
```

---

## Checklist de Implementação

### Fase 1: Classificador ✅
- [ ] Adicionar import em ai-squad.ts
- [ ] Implementar classificação antes do loop de agentes
- [ ] Filtrar agentes baseado na classificação
- [ ] Atualizar schema da demanda
- [ ] Testar com demandas simples e complexas
- [ ] Validar logs de classificação

### Fase 2: Contratos de Contexto ✅
- [ ] Adicionar métodos em context-builder.ts
- [ ] Modificar processWithAgent para usar contexto otimizado
- [ ] Implementar limites de resposta por agente
- [ ] Testar contexto gerado para cada agente
- [ ] Validar tamanho do contexto vs contrato

### Fase 3: Resumos Estruturados ✅
- [ ] Modificar agent-interaction.ts para criar resumos
- [ ] Usar resumo ao invés de histórico completo
- [ ] Modificar generatePRDWithPM para usar resumo
- [ ] Testar compressão de insights
- [ ] Validar qualidade dos resumos

### Fase 4: Rastreamento Aprimorado ✅
- [ ] Estender ai-usage-tracker.ts
- [ ] Registrar otimizações em cada etapa
- [ ] Criar endpoint de métricas
- [ ] Implementar relatório de economia
- [ ] Validar cálculos de tokens salvos

### Fase 5: Testes e Validação ✅
- [ ] Criar testes unitários
- [ ] Executar testes de integração
- [ ] Comparar métricas antes/depois
- [ ] Validar qualidade dos documentos
- [ ] Documentar resultados

---

## Rollback Plan

Se houver problemas:

1. **Classificador falhando**: 
   - Fallback automático para todos os agentes já implementado
   - Verificar logs de erro

2. **Contexto muito pequeno**:
   - Aumentar `maxContextTokens` nos contratos
   - Adicionar seções opcionais como obrigatórias

3. **Resumos incompletos**:
   - Usar `useAI: true` no summaryBuilder
   - Aumentar `maxSummaryTokens`

4. **Qualidade dos documentos caiu**:
   - Reverter para histórico completo temporariamente
   - Ajustar templates de resumo

---

## Próximos Passos

Após implementação completa:

1. **Monitoramento contínuo**:
   - Dashboard de métricas em tempo real
   - Alertas para economia < 50%

2. **Otimizações adicionais**:
   - Cache de classificações similares
   - Aprendizado do classificador
   - Ajuste dinâmico de contratos

3. **Expansão**:
   - Aplicar para outros fluxos
   - Otimizar geração de documentos
   - Reduzir tokens em cognitive core

---

## Suporte

Para dúvidas ou problemas:
- Verificar logs em `server/services/*.ts`
- Consultar `TOKEN_OPTIMIZATION_ANALYSIS.md`
- Revisar testes em `tests/token-optimization.test.ts`
