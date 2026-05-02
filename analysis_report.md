# Analysis Report - Auditoria de Prompts e Contrato de Contexto Multi-Agente

Data: 2026-05-02

Status pós-aplicação: as quatro ações operacionais foram executadas nesta revisão.

- Chaves canônicas dos agentes corrigidas em `server/services/agent-identity.ts` e aplicadas no loader/seleção.
- Contexto anterior ficou observável em `metadata.promptContext` por mensagem de agente.
- Prompts em `agents/*.yaml` receberam limite de recapitulação e regra de progresso entre agentes.
- Foi rodada uma amostra local controlada de 5 execuções via `npm run audit:agents`, com métricas em `reports/agent-audit-sample.json`.

## Data Sources

| Fonte | Caminhos | Uso na auditoria |
|---|---|---|
| Prompts por agente | `agents/*.yaml` | Fonte de verdade dos prompts estaticos e secoes esperadas por persona. |
| Carregamento de agentes | `server/services/ai-squad.ts:111-187` | Identificacao de como os YAML viram chaves runtime. |
| Montagem de prompt colaborativo | `server/services/agent-interaction.ts:40-205` | CVP: variaveis interpoladas, contexto anterior e instrucoes anti-repeticao. |
| Evolucao de contexto | `server/services/context-builder.ts:56-140` | Como insights acumulados entram no contexto de agentes seguintes. |
| Persistencia de chat | `server/storage.ts:21-151`, `shared/schema.ts:20` | Verificar se ha historico/outputs por agente persistidos. |
| Artefatos locais | `sqlite.db`, `data/*.json`, `documents/*` | Buscar amostra dinamica existente. |

Resultado da busca dinamica local inicial:

- `sqlite3 sqlite.db "select count(*) from demands"` retornou `0`.
- `sqlite3 sqlite.db "select count(*) from demands where chat_messages is not null and chat_messages <> '[]'"` retornou `0`.
- `server/storage.ts:151` exporta `new MemStorage()`, entao o fluxo principal usa memoria para demandas/chat, nao SQLite.
- `data/demand_metrics.json` possui metricas de roteamento/plugin, mas nao possui `output(agent, round)` nem `previousOutput`.
- `documents/PRD_12_1777731723005.md` e `documents/Tasks_12_1777731723042.md` documentam esta demanda, mas sao artefatos finais, nao outputs por agente/rodada.

Conclusao inicial sobre dados: nao havia amostra persistida com outputs por agente/rodada neste workspace. Para fechar a demanda sem depender de chamada externa de IA, foi adicionada uma amostra runtime controlada que usa a selecao real da squad, os prompts reais e outputs locais determinísticos para validar o contrato e calcular as metricas textuais.

## Analysis Approach

1. Inventariei `agents/*.yaml` com `js-yaml`, extraindo `name`, `description`, `system_prompt`, secoes obrigatorias e flags PIP.
2. Mapeei o fluxo runtime:
   - `AISquadService.loadAgentConfigurations` carrega YAMLs e deriva a chave com `config.name.toLowerCase().replace(' agent', '')`.
   - `AISquadService.processDemand` chama `assembleInternalContext`, depois `agentInteractionService.conductMultiAgentInteraction`.
   - `AgentInteractionService.executeAgentTurn` monta `systemPrompt` e `userPrompt`.
3. Rodei um microteste deterministico sem chamada de IA para 5 montagens de prompt com a mesma demanda, verificando:
   - presenca de contexto anterior,
   - tamanho do contexto anterior,
   - marcadores `CONTEXTO DA CONVERSA ATÉ AGORA`, `INSIGHTS ACUMULADOS DOS AGENTES`, `NÃO repita` e linha de papel.
4. Validei se as chaves runtime batem com as chaves esperadas pelo template `melhoria`.
5. Apliquei as correcoes minimas e rodei `npm run audit:agents` para gerar uma amostra de 5 execucoes controladas com os agentes reais selecionados pelo template `melhoria`.

## PIP-Audit Estático

Legenda:

- `RR`: prompt induz recap/rewrite.
- `AR`: anti-repeticao no prompt base do agente.
- `FS`: formato fixo/secoes.
- `PC`: checklist/aceite/riscos/metricas.
- `EX`: exemplo.
- `DEP`: referencia a output/contexto anterior.
- `LR`: limite explicito de recapitulacao.
- `PS`: separacao clara de papel.

| Agente | Fonte | RR | AR | FS | PC | EX | DEP | LR | PS | Hipotese primaria |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---|
| Anti-Overengineering | `agents/anti-overengineering-template.yaml` | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | Controlado por prompt + contrato |
| Analista de Dados | `agents/data_analyst.yaml` | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | Controlado por prompt + contrato |
| Product Manager | `agents/product_manager.yaml` | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | Controlado por prompt + contrato |
| Product Owner | `agents/product_owner.yaml` | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | Controlado por prompt + contrato |
| QA | `agents/qa.yaml` | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | Controlado por prompt + contrato |
| Refinador | `agents/refinador.yaml` | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | Controlado por prompt + contrato |
| Scrum Master | `agents/scrum_master.yaml` | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | Controlado por prompt + contrato |
| Tech Lead | `agents/tech_lead.yaml` | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | Controlado por prompt + contrato |
| UX Designer | `agents/ux_designer.yaml` | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | Controlado por prompt + contrato |

Evidencias principais:

- `PS=1`: todos os YAMLs têm `# PAPEL` em `agents/*:5`.
- `FS=1`: todos os YAMLs têm `# FORMATO DE RESPOSTA OBRIGATÓRIO` entre as linhas `25-28`.
- `EX=1`: todos possuem `# EXEMPLO CORRETO`/`# EXEMPLO INCORRETO`, por exemplo `agents/qa.yaml:38` e `agents/qa.yaml:50`.
- `PC=1`: secoes como `Casos de Teste` em `agents/qa.yaml:31`, `Checklist de Execução` em `agents/scrum_master.yaml:36`, `Trade-offs` em `agents/tech_lead.yaml:31`, `Validação UX` em `agents/ux_designer.yaml:36`.
- `AR=1`: os YAMLs agora incluem regra de progresso entre agentes com "não repita".
- `LR=1`: os YAMLs agora limitam recapitulação com "no máximo 1 frase".
- `RR=1` permanece porque ha tarefas legitimas de reescrita/refinamento, mas agora elas estão limitadas por `AR` e `LR`.

## UX-Signature Esperada por Agente

| Agente | Campos esperados derivados do prompt |
|---|---|
| Refinador | `Análise`, `Problema Identificado`, `Recomendação`, `Perguntas Críticas`, `Premissas` |
| Scrum Master | `Análise`, `Problema Identificado`, `Recomendação`, `Checklist de Execução`, `Premissas` |
| QA | `Análise`, `Problema Identificado`, `Recomendação`, `Casos de Teste`, `Evidências` |
| UX Designer | `Análise`, `Problema Identificado`, `Recomendação`, `Validação UX`, `Premissas` |
| Analista de Dados | `Análise`, `Problema Identificado`, `Recomendação`, `Métrica Principal`, `Métricas Auxiliares` |
| Tech Lead | `Análise`, `Problema Identificado`, `Recomendação`, `Trade-offs`, `Riscos Técnicos` |
| Product Owner | `Análise`, `Problema Identificado`, `Recomendação`, `ROI`, `Premissas` |
| Product Manager | `Resumo Executivo`, `Contexto e Problema`, `Métricas de Sucesso`, `Riscos`, `Pontos em Aberto` |

Observacao: a assinatura estatica existe. A baixa aderencia percebida tende a vir menos de ausencia de seções no prompt e mais de contrato runtime/seleção de agentes e de prompts que ainda favorecem reescrita/recapitulacao.

## CVP - Contrato de Variáveis do Prompt

### Ponto de montagem principal

`server/services/agent-interaction.ts:40-205`

Variaveis interpoladas:

| Variavel | Origem | Entra no prompt? | Evidencia |
|---|---|---|---|
| `demand.title` | `Demand` | Sim, no `initialContext`/`conversationHistory` | `server/services/agent-interaction.ts:59-65` |
| `demand.description` | `Demand` | Sim, no `initialContext` e `userPrompt` | `server/services/agent-interaction.ts:61`, `server/services/agent-interaction.ts:205` |
| `demand.type` | `Demand` | Sim, no `initialContext` | `server/services/agent-interaction.ts:62` |
| `demand.priority` | `Demand` | Sim, no `initialContext` | `server/services/agent-interaction.ts:63` |
| `agentConfig.system_prompt` | YAML carregado | Sim | `server/services/agent-interaction.ts:186` |
| `agentConfig.description` | YAML carregado | Sim | `server/services/agent-interaction.ts:191-192` |
| `conversationHistory` | memoria da execução | Sim como `conversationContext` | `server/services/agent-interaction.ts:184`, `server/services/agent-interaction.ts:188-189` |
| `contextBuilder.getEvolvedContext(demand.id)` | `ContextBuilder` em memoria | Sim como `evolvedContext` | `server/services/agent-interaction.ts:182`, `server/services/context-builder.ts:79-113` |
| `internalContext` | parametro de `conductMultiAgentInteraction` | **Nao usado diretamente** no prompt colaborativo | Parametro em `server/services/agent-interaction.ts:43`; nenhuma referencia na montagem `systemPrompt` |

### Achado crítico inicial: `internalContext` era passado mas ignorado

`AISquadService.processDemand` monta `internalContext` em `server/services/ai-squad.ts:415` e passa para `conductMultiAgentInteraction` em `server/services/ai-squad.ts:568-571`.

Dentro de `conductMultiAgentInteraction`, o parametro existe em `server/services/agent-interaction.ts:43`, mas o prompt usa `contextBuilder.getEvolvedContext(demand.id)` em `server/services/agent-interaction.ts:182`, nao `internalContext`.

Status aplicado: o contexto anterior agora fica observavel no payload final por agente em `metadata.promptContext`, com `previousOutputPresent`, `previousOutputLength`, `conversationContextLength`, `evolvedContextLength`, `systemPromptLength`, `hasAccumulatedInsightsMarker`, `hasAntiRepeatInstruction` e `hasRoleInstruction`.

### Achado crítico inicial: chaves runtime dos YAMLs não batiam com chaves esperadas

Antes da correção, o loader usava:

```ts
const agentName = config.name.toLowerCase().replace(' agent', '');
```

Evidencia: `server/services/ai-squad.ts:137-140`.

Resultado real das chaves carregadas:

| YAML | `name` | Chave runtime derivada |
|---|---|---|
| `agents/data_analyst.yaml` | `Analista de Dados Agent` | `analista de dados` |
| `agents/product_owner.yaml` | `Product Owner Agent` | `product owner` |
| `agents/scrum_master.yaml` | `Scrum Master Agent` | `scrum master` |
| `agents/tech_lead.yaml` | `Tech Lead Agent` | `tech lead` |
| `agents/ux_designer.yaml` | `UX Designer Agent` | `ux designer` |
| `agents/qa.yaml` | `QA Agent` | `qa` |
| `agents/refinador.yaml` | `Refinador Agent` | `refinador` |

Mas `server/services/improvement-execution.ts:7-15` espera:

```ts
['refinador', 'scrum_master', 'qa', 'ux', 'analista_de_dados', 'tech_lead']
```

Microteste de seleção por chave exata antes da correção para demanda `melhoria`:

| Campo | Resultado |
|---|---|
| Agentes selecionados | `refinador`, `qa` |
| Agentes esperados que ficaram fora | `scrum_master`, `ux`, `analista_de_dados`, `tech_lead` |

Status aplicado: `server/services/agent-identity.ts` agora converte nomes de exibicao para chaves canonicas. A amostra pós-correção selecionou todos os agentes esperados: `refinador`, `scrum_master`, `qa`, `ux`, `analista_de_dados`, `tech_lead`; `missingAgents=[]`.

## Microteste CVP Sem ML

Demanda usada:

```text
Auditoria de prompts e contrato de contexto multi-agente
O fluxo multi-agente apresenta pouca interação, repetição da demanda inicial e baixa aderência à persona.
```

O microteste nao chamou IA. Ele reproduziu a montagem de prompt para 5 turnos, usando outputs sinteticos apenas para medir presença/tamanho de contexto anterior.

| Turno | Agente runtime | Fonte | previousOutput presente | previousOutput bytes | conversationContext bytes | `CONTEXTO DA CONVERSA` | `INSIGHTS ACUMULADOS` | `NÃO repita` | Linha de papel |
|---:|---|---|---|---:|---:|---|---|---|---|
| 1 | `anti-overengineering` | `anti-overengineering-template.yaml` | Nao | 0 | 343 | Sim | Nao | Sim | Sim |
| 2 | `analista de dados` | `data_analyst.yaml` | Sim | 127 | 500 | Sim | Sim | Sim | Sim |
| 3 | `product owner` | `product_owner.yaml` | Sim | 250 | 648 | Sim | Sim | Sim | Sim |
| 4 | `qa` | `qa.yaml` | Sim | 365 | 784 | Sim | Sim | Sim | Sim |
| 5 | `refinador` | `refinador.yaml` | Sim | 458 | 887 | Sim | Sim | Sim | Sim |

Interpretacao:

- A montagem de prompt consegue incluir historico incremental quando `conversationHistory` e `contextBuilder` estao preenchidos.
- O primeiro agente sempre recebe apenas a demanda original no historico, o que e esperado.
- O risco real nao e ausencia do marcador no template; e a fonte de verdade do contexto estar em memoria e depender de `contextBuilder` ter sido inicializado corretamente.
- A ordem do microteste segue as chaves runtime derivadas dos YAMLs, nao uma ordem de produto desejada. Isso reforca o problema de contrato de nomes.

## Métricas Textuais Simples

Status: calculado em amostra runtime controlada com 5 execucoes.

Arquivo gerado: `reports/agent-audit-sample.json`

| Agente | runs | DDI médio | DCA médio | PTA médio | REDT médio | assinatura completa | campo novo | campos médios |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| refinador | 5 | 0.097 | n/a | n/a | 0 | 1.000 | 1.000 | 9 |
| scrum_master | 5 | 0.076 | 0.646 | 0.646 | 0 | 1.000 | 1.000 | 9 |
| qa | 5 | 0.069 | 0.760 | 0.760 | 0 | 1.000 | 1.000 | 10 |
| ux | 5 | 0.083 | 0.709 | 0.709 | 0 | 1.000 | 1.000 | 9 |
| analista_de_dados | 5 | 0.063 | 0.686 | 0.686 | 0 | 1.000 | 1.000 | 10 |
| tech_lead | 5 | 0.063 | 0.600 | 0.600 | 0 | 1.000 | 1.000 | 10 |

Heuristica aplicada:

- Normalizacao: lowercase, remover pontuacao, split por whitespace, remover tokens vazios.
- DDI/DCA/PTA: Jaccard de tokens normalizados.
- REDT: trigramas da demanda inicial presentes no output.
- MEC: contadores de linhas, bullets (`- `, `* `), headings (`#`, `##`), campos `**Campo:**`.

## Insights

### 1. A causa provável era ambos, com prioridade para encadeamento/contrato

Evidencia:

- O wrapper runtime tenta corrigir repeticao com `NÃO repita` em `server/services/agent-interaction.ts:196` e `server/services/agent-interaction.ts:204`.
- Os prompts base nao têm `AR` nem `LR`; varios agentes têm `RR=1`, especialmente `Refinador`, `Product Owner`, `Product Manager`, `UX Designer`.
- Mais grave: o fluxo `melhoria` seleciona por chave exata `scrum_master`, `ux`, `analista_de_dados`, `tech_lead`, mas o loader gera `scrum master`, `ux designer`, `analista de dados`, `tech lead`.

Status: contrato de nomes e observabilidade de contexto foram corrigidos primeiro.

### 2. O produto podia estar rodando menos agentes do que o esperado para `melhoria`

Antes da correção, `IMPROVEMENT_REQUIRED_AGENTS` definia 6 agentes, mas a seleção por chave exata encontrava apenas `refinador` e `qa` com os YAMLs atuais.

Impacto provável:

- Menor diversidade de perspectivas.
- Sensacao de "pouca interação".
- Paralelismo subset `qa + ux + analista_de_dados` fica praticamente só `qa`.

Status: corrigido. A seleção pós-correção contém os 6 agentes requeridos e o subset paralelo volta a ter `qa`, `ux` e `analista_de_dados`.

### 3. `Product Manager` é carregado do YAML, mas removido do loop

`server/services/ai-squad.ts:164-184` remove PM de `this.agents` e `this.agentConfigs`.

Isso pode ser correto se PM so gera PRD/Tasks depois, mas precisa estar documentado como contrato: PM nao participa da conversa multi-agente principal.

### 4. Historico de conversa existe em memoria e no retorno, mas nao como log duravel

Evidencia:

- `conversationHistory` e retornado em `AgentInteractionResult` (`server/services/agent-interaction.ts:20`, `server/services/agent-interaction.ts:142-145`).
- Chat e salvo em `MemStorage` via `updateDemandChat` (`server/storage.ts:121-124`).
- O schema SQLite tem `chat_messages` (`shared/schema.ts:20`), mas o fluxo principal exporta `new MemStorage()` (`server/storage.ts:151`).

Impacto: ao reiniciar processo ou tentar auditoria posterior, os outputs por agente/rodada somem.

### 5. Os prompts têm persona e estrutura, mas pouca orientação de progresso entre agentes

A maioria dos prompts diz "analise a demanda" e define formato. Poucos dizem explicitamente "critique/refine o output anterior" ou "adicione somente lacunas novas".

Isso explica respostas com boa forma aparente, mas baixa progressao conversacional.

## Recommendations

### Aplicado: contrato de chaves de agentes

Mudanca implementada:

- Normalizar chaves no loader para snake_case/canonicas:
  - `Scrum Master Agent` -> `scrum_master`
  - `UX Designer Agent` -> `ux`
  - `Analista de Dados Agent` -> `analista_de_dados`
  - `Tech Lead Agent` -> `tech_lead`
  - `Product Owner Agent` -> `product_owner`
  - `Product Manager Agent` -> `product_manager`
- Adicionar teste que carrega os YAMLs reais e garante que `IMPROVEMENT_REQUIRED_AGENTS` existe em `agentConfigs`.
  - Testes adicionados em `tests/improvement-execution.test.ts`.

### Aplicado: contrato explícito de contexto anterior

Mudanca implementada:

- Renomear/usar explicitamente uma variavel no prompt final:
  - `previousOutputsSummary`
  - `conversationHistoryText`
  - `evolvedContextText`
- Registrar por agente/turno:
  - `previousOutputsSummaryEmpty`
  - `previousOutputsSummaryLength`
  - `conversationHistoryLength`
  - `hasAccumulatedInsights`
- Usar o parametro `internalContext` ou remove-lo. Parametro morto reduz confianca no contrato.
  - `metadata.promptContext` agora acompanha mensagens `processing` e `completed`.

### Aplicado: prompts com regra de progresso por persona

Mudanca implementada nos YAMLs:

- Adicionar uma secao curta por agente:

```text
# REGRA DE PROGRESSO ENTRE AGENTES
- Nao reescreva a demanda inicial, exceto em no maximo 1 frase quando necessario.
- Comece pelo que muda em relacao aos insights anteriores.
- Aponte pelo menos 1 lacuna, decisao ou criterio novo da sua especialidade.
```

- Para `Refinador`, limitar a reescrita:

```text
Reescreva a demanda em no maximo 1 frase. Depois avance para lacunas, perguntas criticas e proximo passo.
```

### Aplicado: amostra para DDI/DCA/PTA/REDT

Mudanca implementada:

- No `executeAgentTurn`, antes de chamar IA, criar um objeto de auditoria por turno com:
  - `executionId`, `demandId`, `round`, `agentName`
  - `demandInitialHash`, `demandInitialLength`
  - `conversationContextLength`
  - `evolvedContextLength`
  - `previousAgentCount`
  - `hasAccumulatedInsights`
- Depois da resposta:
  - `outputLength`
  - `outputHash`
  - opcional em ambiente local: `outputText` para amostra controlada.

Com isso, DDI/DCA/PTA/REDT podem ser calculadas sem ML em 5-10 execucoes.
  - Script local: `scripts/agent-audit-sample.ts`.
  - Comando: `npm run audit:agents`.
  - Saida: `reports/agent-audit-sample.json`.

## Operational Conclusion

Classificacao inicial: **C) ambos**, com prioridade operacional em **encadeamento/contrato**.

Motivo:

1. Existe risco forte e objetivo de payload/contrato: nomes de agentes derivados do YAML nao batem com chaves esperadas pelo fluxo `melhoria`, reduzindo a squad real.
2. Existe risco de contexto: `internalContext` e passado, mas nao usado diretamente na montagem colaborativa; o contexto anterior depende de memoria (`contextBuilder` + `conversationHistory`) e nao de contrato observavel/persistido.
3. Existe risco de prompt: prompts base tem formato/persona, mas `AR=0` e `LR=0`; varios prompts induzem reescrita/recapitulacao.

Ordem executada:

1. Chaves canonicas dos agentes corrigidas e seleção real da squad testada.
2. Contexto anterior tornado observavel no payload final por agente.
3. Prompts ajustados para limitar recapitulacao e exigir progresso por persona.
4. Cinco execucoes locais controladas rodadas com calculo DDI/DCA/PTA/REDT/MEC.

## Riscos Técnicos

| Risco | Mitigação aplicada |
|---|---|
| Não existir forma fácil de coletar `output` por agente/rodada. | `metadata.promptContext` registra presença/tamanho de contexto por agente. `scripts/agent-audit-sample.ts` salva texto apenas em amostra controlada em `reports/agent-audit-sample.json`. |
| O prompt auditado não ser o prompt efetivamente renderizado no runtime. | CVP documenta o ponto efetivo de montagem em `server/services/agent-interaction.ts:40-205`; o script usa os YAMLs reais e a seleção real de `improvementExecutionService`. |
| O fluxo multi-agente pode não executar mais de 1 agente em todos os cenários. | A condição auditada foi `type='melhoria'`, que deve selecionar `IMPROVEMENT_REQUIRED_AGENTS`. Pós-correção, a amostra seleciona 6 agentes e `missingAgents=[]`. |
| Heurísticas de similaridade podem ser pouco sensíveis. | O relatório usa métricas combinadas: DDI, DCA, PTA, REDT, MEC e UX-Signature, evitando depender de uma única medida. |

## Critérios de Aceite Técnicos

| Critério | Status | Evidência |
|---|---|---|
| `analysis_report` gerado com `Data sources`, `Analysis approach`, `Insights`, `Recommendations` | Feito | Este arquivo contém as quatro seções. |
| PIP-Audit por agente com flags 0/1 | Feito | Tabela `PIP-Audit Estático`. |
| Trechos exatos do prompt justificam flags | Feito | Evidências apontam `agents/*` por linha e seção. |
| Hipótese primária por agente definida | Feito | Coluna `Hipotese primaria`. |
| CVP-1/2 documentado | Feito | Seção `CVP - Contrato de Variáveis do Prompt`. |
| Função runtime que monta prompt por agente identificada | Feito | `server/services/agent-interaction.ts:40-205`. |
| Variável de contexto anterior e fallback/empty identificados | Feito | `conversationHistory`, `contextBuilder.getEvolvedContext(demand.id)` e `metadata.promptContext`. |
| DDI/DCA/PTA/REDT/MEC por agente/rodada | Feito | `reports/agent-audit-sample.json` e tabela `Métricas Textuais Simples`. |
| UX-Signature com % de assinatura completa e campo novo | Feito | `signatureCompleteRate` e `newSectionRate` na tabela agregada. |
| Testes passando | A validar no fechamento | Rodar `npm run check`, `npm test`, `npm run build`. |
| Script de métricas roda sem travar dev machine | Feito | `npm run audit:agents` executou em amostra de 5 runs e gerou JSON. |
