# Análise de Otimização de Tokens - AiChatFlow

## Data da Análise
2 de maio de 2026

## Resumo Executivo

O AiChatFlow atualmente consome tokens de forma ineficiente devido a:
- Acionamento de todos os agentes para qualquer tipo de demanda
- Envio de contexto completo e não resumido para cada agente
- Falta de limites claros de resposta por agente
- Ausência de classificação prévia para roteamento inteligente

**Economia estimada com otimizações**: 60-75% de redução no consumo de tokens

---

## 1. Pontos Críticos Identificados

### 1.1 Orquestração de Agentes (ai-squad.ts)

**Problema**: Todos os 6 agentes são chamados sequencialmente para TODAS as demandas, independente do tipo.

```typescript
// Código atual - TODOS os agentes são chamados
for (let i = 0; i < this.agents.length; i++) {
  const agent = this.agents[i];
  // ... processa cada agente
}
```

**Impacto**:
- Bug simples: 6 agentes × ~1500 tokens/agente = ~9.000 tokens desnecessários
- Feature complexa: pode precisar de todos, mas ainda há desperdício de contexto

**Solução proposta**:
- Classificador de demandas que determina subset de agentes necessários
- Matriz de relevância: tipo de demanda → agentes necessários

### 1.2 Construção de Contexto (context-builder.ts)

**Problema**: Contexto base muito extenso (~1500 tokens) + contexto de repositório ilimitado + insights acumulados sem resumo.

```typescript
// Contexto base atual
private createBaseContext(): string {
  return `--- AICHATFLOW CORE CONSTRAINTS ---
  1. Stack atual: TypeScript, React, Node.js, Vite
  2. Arquitetura: Monolítico com Cognitive Core
  // ... ~1500 tokens de contexto fixo
```

**Impacto**:
- Contexto base: ~1.500 tokens
- Contexto de repositório: 2.000-10.000 tokens (sem limite)
- Insights acumulados: crescem indefinidamente
- **Total por agente**: 3.500-12.000 tokens de entrada

**Solução proposta**:
- Contexto diferenciado por tipo de agente
- Resumo estruturado de insights (máx 500 tokens)
- Limite de contexto de repositório (máx 2.000 tokens)

### 1.3 Interação Multi-Agente (agent-interaction.ts)

**Problema**: 2 rounds completos com histórico completo da conversa para cada agente.

```typescript
// Código atual
const interactionRounds = 2; // Sempre 2 rounds
for (let round = 0; round < interactionRounds; round++) {
  for (const agentName of agentNames) {
    // Cada agente recebe histórico completo
    const conversationContext = this.buildConversationContext(conversationHistory);
  }
}
```

**Impacto**:
- Round 1: 6 agentes × 3.500 tokens entrada = 21.000 tokens
- Round 2: 6 agentes × 5.000 tokens entrada (com histórico) = 30.000 tokens
- **Total**: ~51.000 tokens de entrada por demanda

**Solução proposta**:
- Avaliação de completude após cada agente (não só após round)
- Resumo estruturado entre rounds
- Limite de 1 round para demandas simples

### 1.4 Geração de Documentos (ai-squad.ts)

**Problema**: PM recebe todo o histórico de refinamento sem resumo.

```typescript
const refinementSummary = refinementMessages
  .filter(msg => msg.type === 'completed')
  .map(msg => `**${msg.agent}**: ${msg.message}`)
  .join('\n\n'); // Pode ter 10.000+ tokens
```

**Impacto**:
- PRD: ~12.000 tokens entrada + 4.000 tokens saída
- Tasks: ~14.000 tokens entrada + 2.000 tokens saída
- **Total documentos**: ~32.000 tokens por demanda

**Solução proposta**:
- Resumo estruturado de insights (máx 2.000 tokens)
- Template de resumo por agente (análise, recomendação, ROI, esforço)

### 1.5 Rastreamento de Uso (ai-usage-tracker.ts)

**Problema**: Rastreamento básico sem métricas por agente/etapa.

**Impacto**:
- Impossível identificar quais agentes consomem mais
- Sem visibilidade de economia de cache
- Sem comparação antes/depois de otimizações

**Solução proposta**:
- Rastreamento por agente e etapa
- Métricas de economia (cache, resumos, roteamento)
- Dashboard de consumo

---

## 2. Estimativa de Consumo Atual

### 2.1 Demanda Simples (Bug)

| Etapa | Tokens Entrada | Tokens Saída | Total |
|-------|----------------|--------------|-------|
| Roteamento | 500 | 100 | 600 |
| 6 Agentes (Round 1) | 21.000 | 9.000 | 30.000 |
| 6 Agentes (Round 2) | 30.000 | 9.000 | 39.000 |
| PRD | 12.000 | 4.000 | 16.000 |
| Tasks | 14.000 | 2.000 | 16.000 |
| **TOTAL** | **77.500** | **24.100** | **101.600** |

**Custo estimado** (gpt-4o-mini): $0.15/1M input + $0.60/1M output
- Input: 77.500 × $0.15/1M = $0.0116
- Output: 24.100 × $0.60/1M = $0.0145
- **Total por demanda**: ~$0.026

### 2.2 Demanda Complexa (Feature)

| Etapa | Tokens Entrada | Tokens Saída | Total |
|-------|----------------|--------------|-------|
| Roteamento | 800 | 150 | 950 |
| 6 Agentes (Round 1) | 35.000 | 12.000 | 47.000 |
| 6 Agentes (Round 2) | 50.000 | 12.000 | 62.000 |
| PRD | 20.000 | 4.000 | 24.000 |
| Tasks | 22.000 | 2.000 | 24.000 |
| **TOTAL** | **127.800** | **30.150** | **157.950** |

**Custo estimado**:
- Input: 127.800 × $0.15/1M = $0.0192
- Output: 30.150 × $0.60/1M = $0.0181
- **Total por demanda**: ~$0.037

---

## 3. Proposta de Otimização

### 3.1 Classificador de Demandas

**Objetivo**: Determinar subset mínimo de agentes necessários antes de iniciar refinamento.

**Implementação**:
```typescript
interface DemandClassification {
  type: string;
  complexity: 'low' | 'medium' | 'high';
  requiredAgents: string[];
  estimatedTokens: number;
}

class DemandClassifier {
  async classify(demand: Demand): Promise<DemandClassification> {
    // Usa modelo nano para classificação rápida
    // Retorna apenas agentes necessários
  }
}
```

**Matriz de Relevância**:
| Tipo Demanda | Agentes Necessários | Economia |
|--------------|---------------------|----------|
| Bug | refinador, qa, tech_lead | 50% |
| Feature Simples | refinador, ux, tech_lead | 50% |
| Feature Complexa | todos (6) | 0% |
| Melhoria | refinador, qa, analista_dados | 50% |
| Discovery | refinador, ux, analista_dados | 50% |

**Economia estimada**: 40-50% em demandas simples/médias

### 3.2 Contrato de Contexto por Agente

**Objetivo**: Cada agente recebe apenas o contexto relevante para sua função.

**Implementação**:
```typescript
interface AgentContextContract {
  agentName: string;
  maxContextTokens: number;
  requiredSections: string[];
  optionalSections: string[];
}

const AGENT_CONTEXT_CONTRACTS: Record<string, AgentContextContract> = {
  refinador: {
    maxContextTokens: 2000,
    requiredSections: ['demand', 'constraints'],
    optionalSections: ['repo_briefing']
  },
  qa: {
    maxContextTokens: 1500,
    requiredSections: ['demand', 'constraints', 'previous_insights'],
    optionalSections: []
  },
  tech_lead: {
    maxContextTokens: 3000,
    requiredSections: ['demand', 'constraints', 'repo_context', 'previous_insights'],
    optionalSections: ['system_map']
  }
  // ... outros agentes
};
```

**Economia estimada**: 30-40% no contexto de entrada

### 3.3 Sistema de Resumo Estruturado

**Objetivo**: Substituir histórico completo por resumo objetivo entre etapas.

**Implementação**:
```typescript
interface StructuredSummary {
  decisions: string[];      // Decisões tomadas
  requirements: string[];   // Requisitos identificados
  risks: string[];         // Riscos levantados
  estimates: {             // Estimativas
    effort: string;
    roi: string;
  };
  openQuestions: string[]; // Perguntas em aberto
}

class SummaryBuilder {
  buildStructuredSummary(insights: AgentInsight[]): StructuredSummary {
    // Extrai informações estruturadas dos insights
    // Máximo 500 tokens
  }
}
```

**Formato de Resumo**:
```markdown
## Resumo Estruturado

### Decisões
- [Decisão 1]
- [Decisão 2]

### Requisitos
- [Requisito 1]
- [Requisito 2]

### Riscos
- [Risco 1]: Mitigação proposta

### Estimativas
- Esforço: X dias
- ROI: Y:1

### Perguntas em Aberto
- [Pergunta 1]
```

**Economia estimada**: 50-60% no contexto entre rounds

### 3.4 Limite de Resposta por Agente

**Objetivo**: Respostas curtas e estruturadas para agentes intermediários.

**Implementação**:
```typescript
const AGENT_RESPONSE_LIMITS: Record<string, number> = {
  refinador: 1500,      // Pode ser mais extenso
  scrum_master: 800,    // Resposta focada
  qa: 1000,             // Lista de critérios
  ux: 800,              // Pontos de UX
  analista_dados: 800,  // Estrutura de dados
  tech_lead: 1200       // Considerações técnicas
};

// Prompt para respostas estruturadas
const STRUCTURED_RESPONSE_PROMPT = `
Responda em formato estruturado JSON:
{
  "analysis": "string (max 200 chars)",
  "recommendation": "string (max 200 chars)",
  "impact": "string (max 100 chars)",
  "effort": "string (ex: 3 dias)",
  "roi": "string (ex: 4:1)",
  "priority": "Crítico|Importante|Desejável"
}
`;
```

**Economia estimada**: 40-50% nos tokens de saída

### 3.5 Medição Aprimorada de Tokens

**Objetivo**: Rastreamento detalhado por agente e etapa com métricas de economia.

**Implementação**:
```typescript
interface TokenMetrics {
  demandId: number;
  stage: string;
  agent?: string;
  inputTokens: number;
  outputTokens: number;
  cachedTokens: number;
  cost: number;
  savings: {
    fromCache: number;
    fromSummary: number;
    fromRouting: number;
  };
}

class EnhancedUsageTracker extends AIUsageTracker {
  recordStageMetrics(metrics: TokenMetrics): void;
  getDemandMetrics(demandId: number): TokenMetrics[];
  getAgentMetrics(agentName: string): TokenMetrics[];
  getSavingsSummary(): {
    totalSaved: number;
    byOptimization: Record<string, number>;
  };
}
```

---

## 4. Estimativa de Consumo Otimizado

### 4.1 Demanda Simples (Bug) - Otimizado

| Etapa | Tokens Entrada | Tokens Saída | Total | Economia |
|-------|----------------|--------------|-------|----------|
| Classificação | 300 | 50 | 350 | -250 |
| 3 Agentes (Round 1) | 6.000 | 2.400 | 8.400 | -21.600 |
| Avaliação Completude | 500 | 50 | 550 | -38.450 |
| PRD (com resumo) | 3.000 | 4.000 | 7.000 | -9.000 |
| Tasks (com resumo) | 3.500 | 2.000 | 5.500 | -10.500 |
| **TOTAL** | **13.300** | **8.500** | **21.800** | **-79.800** |

**Economia**: 78,5% (de 101.600 para 21.800 tokens)
**Custo otimizado**: ~$0.007 (de $0.026 para $0.007)

### 4.2 Demanda Complexa (Feature) - Otimizado

| Etapa | Tokens Entrada | Tokens Saída | Total | Economia |
|-------|----------------|--------------|-------|----------|
| Classificação | 500 | 100 | 600 | -350 |
| 6 Agentes (Round 1) | 18.000 | 7.200 | 25.200 | -21.800 |
| Resumo Estruturado | 1.000 | 500 | 1.500 | - |
| 4 Agentes (Round 2) | 12.000 | 4.800 | 16.800 | -45.200 |
| PRD (com resumo) | 5.000 | 4.000 | 9.000 | -15.000 |
| Tasks (com resumo) | 6.000 | 2.000 | 8.000 | -16.000 |
| **TOTAL** | **42.500** | **18.600** | **61.100** | **-96.850** |

**Economia**: 61,3% (de 157.950 para 61.100 tokens)
**Custo otimizado**: ~$0.017 (de $0.037 para $0.017)

---

## 5. Plano de Implementação

### Fase 1: Fundação (Semana 1)
- [ ] Criar `DemandClassifier` com matriz de relevância
- [ ] Implementar contratos de contexto por agente
- [ ] Adicionar rastreamento aprimorado de tokens
- [ ] Testes unitários

### Fase 2: Otimização de Contexto (Semana 2)
- [ ] Implementar `SummaryBuilder` para resumos estruturados
- [ ] Adicionar limites de contexto por agente
- [ ] Implementar compressão de insights acumulados
- [ ] Testes de integração

### Fase 3: Otimização de Respostas (Semana 3)
- [ ] Implementar limites de resposta por agente
- [ ] Adicionar prompts para respostas estruturadas (JSON)
- [ ] Implementar avaliação de completude por agente
- [ ] Testes end-to-end

### Fase 4: Medição e Ajustes (Semana 4)
- [ ] Dashboard de métricas de tokens
- [ ] Comparação antes/depois
- [ ] Ajustes finos baseados em dados reais
- [ ] Documentação final

---

## 6. Métricas de Sucesso

### 6.1 Métricas Primárias
- **Redução de tokens de entrada**: Meta 60-70%
- **Redução de chamadas por demanda**: Meta 40-50%
- **Custo médio por refinamento**: Meta redução de 60%

### 6.2 Métricas Secundárias
- **Uso de cache**: Meta >30%
- **Agentes acionados por demanda**: Meta 3-4 (vs 6 atual)
- **Tempo de execução**: Manter ou reduzir

### 6.3 Métricas de Qualidade
- **Qualidade do refinamento**: Manter >85%
- **Completude dos documentos**: Manter >90%
- **Satisfação do usuário**: Manter ou melhorar

---

## 7. Riscos e Mitigações

### 7.1 Risco: Perda de Qualidade
**Mitigação**: 
- Validação de completude após cada otimização
- A/B testing com grupo de controle
- Rollback rápido se qualidade cair >10%

### 7.2 Risco: Classificação Incorreta
**Mitigação**:
- Fallback para todos os agentes se confiança <80%
- Aprendizado contínuo do classificador
- Revisão manual de classificações

### 7.3 Risco: Resumos Incompletos
**Mitigação**:
- Template estruturado obrigatório
- Validação de seções críticas
- Histórico completo disponível para PM

---

## 8. Conclusão

A implementação das otimizações propostas pode reduzir o consumo de tokens em **60-75%** sem perda significativa de qualidade. O investimento de 4 semanas de desenvolvimento tem ROI estimado de **10:1** considerando:

- Redução de custo operacional imediata
- Escalabilidade melhorada para crescimento
- Base para otimizações futuras
- Melhor experiência do usuário (mais rápido)

**Recomendação**: Iniciar implementação imediatamente, priorizando Fase 1 e 2 para obter ganhos rápidos.
