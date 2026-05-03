# Patch de Integração - Otimização de Tokens

Este arquivo contém as modificações exatas necessárias para integrar a otimização de tokens no AiChatFlow.

## ⚠️ IMPORTANTE: Backup Antes de Aplicar

```bash
# Criar backup dos arquivos que serão modificados
cp server/services/ai-squad.ts server/services/ai-squad.ts.backup
cp server/services/agent-interaction.ts server/services/agent-interaction.ts.backup
cp server/services/ai-usage-tracker.ts server/services/ai-usage-tracker.ts.backup
```

---

## 1. Adicionar Imports em ai-squad.ts

**Arquivo**: `server/services/ai-squad.ts`  
**Linha**: Após os imports existentes (linha ~32)

```typescript
// ADICIONAR ESTES IMPORTS:
import { demandClassifier, type DemandClassification } from './demand-classifier';
import { agentContextBuilder } from './agent-context-contracts';
import { summaryBuilder } from './structured-summary';
import { optimizationTracker } from './ai-usage-tracker';
```

---

## 2. Modificar processDemand em ai-squad.ts

**Arquivo**: `server/services/ai-squad.ts`  
**Método**: `processDemand`  
**Localização**: Após `assembleInternalContext` e antes do loop de agentes

### 2.1 Adicionar Classificação (após linha ~450)

```typescript
// ADICIONAR APÓS: const internalContext = await this.assembleInternalContext(demand);

// === TOKEN OPTIMIZATION: DEMAND CLASSIFICATION ===
let classification: DemandClassification;
let activeAgents = this.agents;

try {
  classification = await demandClassifier.classify(demand);
  
  console.log(`[TOKEN OPT] Demand ${demandId} classified:`, {
    complexity: classification.complexity,
    requiredAgents: classification.requiredAgents.length,
    estimatedTokens: classification.estimatedInputTokens + classification.estimatedOutputTokens
  });

  // Filtrar agentes baseado na classificação
  activeAgents = this.agents.filter(agent => 
    classification.requiredAgents.includes(agent.name)
  );

  console.log(`[TOKEN OPT] Using ${activeAgents.length} of ${this.agents.length} agents`);

  // Registrar economia de classificação
  const allAgentsTokens = this.agents.length * 3500;
  const classifiedTokens = classification.estimatedInputTokens;
  
  optimizationTracker.recordOptimization({
    demandId: demand.id,
    stage: 'classification',
    tokensUsed: classifiedTokens,
    tokensSaved: allAgentsTokens - classifiedTokens,
    savingsSource: 'classification',
    timestamp: new Date().toISOString()
  });

  // Salvar classificação na demanda
  await storage.updateDemand(demandId, {
    tokenOptimization: {
      complexity: classification.complexity,
      requiredAgents: classification.requiredAgents,
      estimatedInputTokens: classification.estimatedInputTokens,
      estimatedOutputTokens: classification.estimatedOutputTokens,
      confidence: classification.confidence,
      reasoning: classification.reasoning
    }
  });

  // Notificar progresso
  if (onProgress) {
    onProgress({
      id: `${demandId}-classification`,
      agent: 'classifier',
      message: `✅ Classificação: ${classification.complexity} complexidade, ${classification.requiredAgents.length} agentes (${classification.requiredAgents.join(', ')})`,
      timestamp: new Date().toISOString(),
      type: 'completed',
      progress: 8
    });
  }

} catch (error) {
  console.error('[TOKEN OPT] Classification failed, using all agents:', error);
  classification = {
    type: demand.type,
    complexity: 'medium',
    requiredAgents: this.agents.map(a => a.name),
    estimatedInputTokens: 50000,
    estimatedOutputTokens: 15000,
    confidence: 0.5,
    reasoning: 'Fallback due to classification error'
  };
}
// === END TOKEN OPTIMIZATION ===
```

### 2.2 Modificar Loop de Agentes

```typescript
// SUBSTITUIR: for (let i = 0; i < this.agents.length; i++) {
// POR:
for (let i = 0; i < activeAgents.length; i++) {
  const agent = activeAgents[i];
  // ... resto do código permanece igual
```

---

## 3. Modificar processWithAgent em ai-squad.ts

**Arquivo**: `server/services/ai-squad.ts`  
**Método**: `processWithAgent`  
**Localização**: Substituir construção de contexto

```typescript
// SUBSTITUIR ESTA LINHA:
// const systemPrompt = `${internalContext}\n\n${agentConfig?.system_prompt...`

// POR:
private async processWithAgent(
  agentName: string,
  demand: Demand,
  refinementLevels: number,
  internalContext: string, // Mantido para compatibilidade, mas não usado
): Promise<string> {
  const intensityLevel = this.getIntensityByType(demand.type);
  const agentConfig = this.agentConfigs[agentName];

  // === TOKEN OPTIMIZATION: USE AGENT-SPECIFIC CONTEXT ===
  const optimizedContext = contextBuilder.buildAgentSpecificContext(
    demand.id,
    agentName,
    demand
  );

  const contract = agentContextBuilder.getContract(agentName);
  const maxTokens = contract ? contract.responseMaxTokens : 1500;

  // Estimar tokens do contexto original vs otimizado
  const originalContextTokens = Math.ceil(internalContext.length / 4);
  const optimizedContextTokens = Math.ceil(optimizedContext.length / 4);
  
  if (originalContextTokens > optimizedContextTokens) {
    optimizationTracker.recordOptimization({
      demandId: demand.id,
      stage: 'agent_execution',
      agentName: agentName,
      tokensUsed: optimizedContextTokens,
      tokensSaved: originalContextTokens - optimizedContextTokens,
      savingsSource: 'context_contract',
      timestamp: new Date().toISOString()
    });
  }
  // === END TOKEN OPTIMIZATION ===

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

    // ... resto do método permanece igual
  }
}
```

---

## 4. Modificar generatePRDWithPM em ai-squad.ts

**Arquivo**: `server/services/ai-squad.ts`  
**Método**: `generatePRDWithPM`  
**Localização**: Início do método

```typescript
// SUBSTITUIR:
// const refinementSummary = refinementMessages
//   .filter(msg => msg.type === 'completed')
//   .map(msg => `**${msg.agent}**: ${msg.message}`)
//   .join('\n\n');

// POR:
private async generatePRDWithPM(
  demand: Demand,
  refinementMessages: ChatMessage[],
  model?: string,
): Promise<string> {
  // === TOKEN OPTIMIZATION: USE STRUCTURED SUMMARY ===
  const insights = refinementMessages
    .filter(msg => msg.type === 'completed')
    .map(msg => ({
      agentName: msg.agent,
      insight: msg.message,
      timestamp: msg.timestamp
    }));

  const summary = await summaryBuilder.buildStructuredSummary(insights, false);
  const refinementSummary = summaryBuilder.formatAsMarkdown(summary);

  // Registrar economia
  const originalTokens = insights.reduce((sum, i) => 
    sum + Math.ceil(i.insight.length / 4), 0
  );
  const summaryTokens = Math.ceil(refinementSummary.length / 4);

  optimizationTracker.recordOptimization({
    demandId: demand.id,
    stage: 'document_generation',
    tokensUsed: summaryTokens,
    tokensSaved: originalTokens - summaryTokens,
    savingsSource: 'summary',
    timestamp: new Date().toISOString()
  });

  console.log(`[TOKEN OPT] PRD summary: ${summary.metadata.compressionRatio.toFixed(1)}x compression`);
  // === END TOKEN OPTIMIZATION ===

  // Usar insightsSummary do context builder também
  const insightsSummary = contextBuilder.getInsightsSummary(demand.id);

  // ... resto do método permanece igual
}
```

---

## 5. Adicionar OptimizationTracker em ai-usage-tracker.ts

**Arquivo**: `server/services/ai-usage-tracker.ts`  
**Localização**: Final do arquivo

```typescript
// ADICIONAR NO FINAL DO ARQUIVO:

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

    console.log(`[TOKEN OPT] Saved ${metric.tokensSaved} tokens via ${metric.savingsSource} at ${metric.stage}`);
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

---

## 6. Adicionar Endpoint de Métricas em routes.ts

**Arquivo**: `server/routes.ts`  
**Localização**: Adicionar novo endpoint

```typescript
// ADICIONAR ESTE ENDPOINT:
import { optimizationTracker } from './services/ai-usage-tracker';

app.get('/api/optimization/metrics', async (req, res) => {
  try {
    const report = optimizationTracker.getOptimizationReport();
    const usageSummary = aiUsageTracker.getSummary();
    const savings = optimizationTracker.getTotalSavings();
    
    res.json({
      optimization: {
        report,
        savings,
        bySource: savings.bySource,
        byStage: savings.byStage
      },
      usage: usageSummary
    });
  } catch (error) {
    console.error('Error getting optimization metrics:', error);
    res.status(500).json({ error: 'Failed to get optimization metrics' });
  }
});
```

---

## 7. Modificar agent-interaction.ts (Opcional - Para Resumos em Rounds)

**Arquivo**: `server/services/agent-interaction.ts`  
**Método**: `conductMultiAgentInteraction`  
**Localização**: Após cada round

```typescript
// ADICIONAR IMPORT NO TOPO:
import { summaryBuilder, type StructuredSummary } from './structured-summary';

// ADICIONAR PROPRIEDADE À CLASSE:
export class AgentInteractionService {
  private summaries: Map<number, StructuredSummary> = new Map();
  
  // ... resto da classe
}

// ADICIONAR APÓS CADA ROUND (dentro do loop de rounds):
// Após executar todos os agentes do round, ANTES de verificar shouldCompleteEarly:

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

  console.log(`[TOKEN OPT] Round ${round + 1} summary: ${summary.metadata.compressionRatio.toFixed(1)}x compression`);

  if (onProgress) {
    onProgress({
      id: `${demand.id}-round-${round}-summary`,
      agent: 'system',
      message: `📊 Resumo do Round ${round + 1}:\n${summaryBuilder.formatAsCompactText(summary)}`,
      timestamp: new Date().toISOString(),
      type: 'completed',
      category: 'system',
      progress: 10 + Math.round((round + 1) * 70 / interactionRounds)
    });
  }
}

// MODIFICAR buildConversationContext:
private buildConversationContext(conversationHistory: AgentMessage[], demandId?: number): string {
  // Se temos um resumo, usar ele
  if (demandId && this.summaries.has(demandId)) {
    const summary = this.summaries.get(demandId)!;
    return summaryBuilder.formatAsCompactText(summary);
  }

  // Fallback: últimas 10 mensagens
  return conversationHistory
    .slice(-10)
    .map(msg => `[${msg.agent}]: ${msg.message}`)
    .join('\n\n');
}

// LIMPAR RESUMO NO FINAL:
// No final de conductMultiAgentInteraction, antes do return:
this.summaries.delete(demand.id);
```

---

## 8. Testar a Integração

### 8.1 Teste Básico

```bash
# Reiniciar servidor
npm run dev

# Criar demanda simples
curl -X POST http://localhost:5000/api/demands \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Corrigir botão",
    "description": "O botão não funciona",
    "type": "bug",
    "priority": "media"
  }'

# Verificar logs para:
# - [TOKEN OPT] Demand X classified
# - [TOKEN OPT] Using Y of Z agents
# - [TOKEN OPT] Saved X tokens
```

### 8.2 Verificar Métricas

```bash
# Acessar endpoint de métricas
curl http://localhost:5000/api/optimization/metrics

# Deve retornar:
# - Total de tokens salvos
# - Economia por fonte (classification, context_contract, summary)
# - Economia por etapa
```

### 8.3 Validar Qualidade

```bash
# Verificar documentos gerados
# - PRD deve manter qualidade
# - Tasks deve estar completo
# - Tempo de execução similar ou menor
```

---

## 9. Rollback (Se Necessário)

```bash
# Restaurar backups
cp server/services/ai-squad.ts.backup server/services/ai-squad.ts
cp server/services/agent-interaction.ts.backup server/services/agent-interaction.ts
cp server/services/ai-usage-tracker.ts.backup server/services/ai-usage-tracker.ts

# Reiniciar servidor
npm run dev
```

---

## 10. Checklist de Validação

- [ ] Servidor inicia sem erros
- [ ] Classificação funciona (logs mostram agentes filtrados)
- [ ] Contexto otimizado é usado (logs mostram economia)
- [ ] Resumos são criados (logs mostram compressão)
- [ ] Métricas são registradas (endpoint retorna dados)
- [ ] Documentos mantêm qualidade (PRD e Tasks completos)
- [ ] Economia de 60-75% confirmada (métricas)
- [ ] Sem regressões funcionais (testes passam)

---

## Notas Importantes

1. **Aplicar gradualmente**: Comece com classificação, depois contexto, depois resumos
2. **Testar cada etapa**: Valide que tudo funciona antes de prosseguir
3. **Monitorar logs**: Use `[TOKEN OPT]` para filtrar logs de otimização
4. **Comparar métricas**: Use endpoint `/api/optimization/metrics` para validar economia
5. **Manter backups**: Sempre tenha como reverter mudanças

---

## Suporte

- **Documentação**: `docs/TOKEN_OPTIMIZATION_*.md`
- **Testes**: `tests/token-optimization.test.ts` (a criar)
- **Logs**: Filtrar por `[TOKEN OPT]` no console
