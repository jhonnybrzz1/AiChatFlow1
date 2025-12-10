# Tasks Document - [Nome da Demanda]

**Versão:** [1.0.0]
**Data de Criação:** [YYYY-MM-DD]
**Última Atualização:** [YYYY-MM-DD]
**PRD Vinculado:** [Link ou referência ao PRD - Ex: prd-notificacoes-v1.0.0.md]

---

## Metadados do Projeto

- **Prioridade Geral**: [Alta | Média | Baixa]
- **Responsável Geral**: [@nome-do-time] *(Formato obrigatório: @nome)*
- **Status Geral**: [Não Iniciado | Em Progresso | Concluído]
- **Sprint/Milestone**: [Ex: Sprint 23 | Milestone Q1 2024]
- **Data de Início**: [YYYY-MM-DD]
- **Data de Conclusão Prevista**: [YYYY-MM-DD]

---

## Tarefas

### 🔧 Backend

#### **T1**: [Título da Tarefa - Máx 100 caracteres]
**Descrição**: [Descrição técnica detalhada da tarefa. Mínimo 20 caracteres, máximo 500 caracteres.]

**Exemplo:** Criar endpoint POST /notifications/segment para identificar usuários inativos. O endpoint deve receber parâmetros de segmentação (dias de inatividade, perfil comportamental) e retornar lista paginada de usuários com seus dados de contato.

**Critérios de Aceite**:
- [Critério 1 - Deve ser claro, mensurável e testável. Mínimo 10 caracteres.]
- [Critério 2 - Deve ser claro, mensurável e testável. Mínimo 10 caracteres.]
- [Exemplo: "Endpoint responde com status 200 e lista de usuários"]
- [Exemplo: "Tempo de resposta < 500ms para 1000 usuários no p95"]
- [Exemplo: "Validação de entrada implementada com retorno 400 para dados inválidos"]

**Responsável**: [@backend-team] *(Formato obrigatório: @nome-do-time ou @nome-pessoa)*

**Prioridade**: [Alta | Média | Baixa]

**Estimativa**: [5 SP | 8h | 2d] *(Formato: Story Points (SP), horas (h) ou dias (d))*

**Dependências**: [T2, T3] *(IDs de tarefas que devem ser concluídas antes - Ex: T2, T5)*

**Vinculado ao PRD**: [RF1, RF2, RNF1] *(IDs dos requisitos do PRD que esta tarefa implementa)*

**Status**: [Não Iniciado | Em Progresso | Bloqueado | Concluído]

---

#### **T2**: [Título da Tarefa]
**Descrição**: [Descrição técnica detalhada da tarefa. Mínimo 20 caracteres, máximo 500 caracteres.]

**Critérios de Aceite**:
- [Critério 1]
- [Critério 2]

**Responsável**: [@backend-team]

**Prioridade**: [Alta | Média | Baixa]

**Estimativa**: [X SP/h/d]

**Dependências**: [Lista de IDs ou "Nenhuma"]

**Vinculado ao PRD**: [RF, RNF]

**Status**: [Não Iniciado | Em Progresso | Bloqueado | Concluído]

---

*Adicione mais tarefas de backend seguindo o padrão T3, T4, etc.*

---

### 🎨 Frontend

#### **T5**: [Título da Tarefa - Máx 100 caracteres]
**Descrição**: [Descrição técnica detalhada da tarefa. Mínimo 20 caracteres.]

**Exemplo:** Criar componente NotificationCard em React que exibe preview da notificação com título, mensagem, imagem e botões de ação (enviar, editar, cancelar). Componente deve ser responsivo e seguir design system.

**Critérios de Aceite**:
- [Critério 1]
- [Exemplo: "Componente renderiza corretamente em mobile, tablet e desktop"]
- [Exemplo: "Todos os botões têm feedback visual (hover, active, disabled)"]
- [Exemplo: "Testes unitários com cobertura ≥80%"]

**Responsável**: [@frontend-team]

**Prioridade**: [Alta | Média | Baixa]

**Estimativa**: [X SP/h/d]

**Dependências**: [Lista de IDs ou "Nenhuma"]

**Vinculado ao PRD**: [RF, RNF]

**Status**: [Não Iniciado | Em Progresso | Bloqueado | Concluído]

---

*Adicione mais tarefas de frontend seguindo o padrão T6, T7, etc.*

---

### 🧪 Testes

#### **T10**: [Título da Tarefa - Máx 100 caracteres]
**Descrição**: [Descrição técnica detalhada da tarefa. Mínimo 20 caracteres.]

**Exemplo:** Criar testes de integração para endpoint /notifications/segment. Testes devem cobrir cenários de sucesso (retorno 200), validação de entrada (retorno 400), autenticação (retorno 401) e erro de servidor (retorno 500).

**Critérios de Aceite**:
- [Critério 1]
- [Exemplo: "Testes de integração com cobertura ≥90% para endpoint"]
- [Exemplo: "Testes de performance validam tempo de resposta < 500ms"]
- [Exemplo: "Testes de segurança validam autenticação obrigatória"]

**Responsável**: [@qa-team]

**Prioridade**: [Alta | Média | Baixa]

**Estimativa**: [X SP/h/d]

**Dependências**: [T1, T2] *(Testes dependem da implementação estar pronta)*

**Vinculado ao PRD**: [RF, RNF]

**Status**: [Não Iniciado | Em Progresso | Bloqueado | Concluído]

---

*Adicione mais tarefas de testes seguindo o padrão T11, T12, etc.*

---

### 📚 Documentação

#### **T15**: [Título da Tarefa - Máx 100 caracteres]
**Descrição**: [Descrição técnica detalhada da tarefa. Mínimo 20 caracteres.]

**Exemplo:** Atualizar documentação da API no Swagger com endpoint /notifications/segment. Incluir descrição, parâmetros de entrada, exemplos de request/response, códigos de erro e autenticação necessária.

**Critérios de Aceite**:
- [Critério 1]
- [Exemplo: "Swagger atualizado com todos os endpoints novos"]
- [Exemplo: "Exemplos de código incluídos (curl, Python, JavaScript)"]
- [Exemplo: "Documentação revisada pelo tech lead"]

**Responsável**: [@backend-team ou @docs-team]

**Prioridade**: [Alta | Média | Baixa]

**Estimativa**: [X SP/h/d]

**Dependências**: [T1, T2, T10]

**Vinculado ao PRD**: [Critérios de Aceitação Gerais]

**Status**: [Não Iniciado | Em Progresso | Bloqueado | Concluído]

---

### 🏗️ Infraestrutura (se aplicável)

#### **T20**: [Título da Tarefa]
**Descrição**: [Descrição técnica detalhada.]

**Exemplo:** Configurar fila de mensagens (AWS SQS) para processamento assíncrono de notificações. Fila deve suportar 10.000 mensagens/minuto com retry automático em caso de falha.

**Critérios de Aceite**:
- [Critério 1]

**Responsável**: [@devops-team]

**Prioridade**: [Alta | Média | Baixa]

**Estimativa**: [X SP/h/d]

**Dependências**: [Lista de IDs ou "Nenhuma"]

**Vinculado ao PRD**: [RNF (requisitos não funcionais)]

**Status**: [Não Iniciado | Em Progresso | Bloqueado | Concluído]

---

## Métricas de Sucesso

**IMPORTANTE**: Métricas específicas mensuráveis com valores numéricos. Mínimo 1 métrica obrigatória.

- [Métrica 1 com valor numérico específico. Mínimo 10 caracteres.]
- [Exemplo: "Redução de 20% no tempo de resposta da API (baseline: 600ms, meta: 480ms)"]
- [Exemplo: "Cobertura de testes ≥80% em todas as tarefas"]
- [Exemplo: "Zero bugs críticos em produção após 2 semanas de deploy"]
- [Exemplo: "Tempo de build < 5 minutos no CI/CD"]

---

## Dependências Externas

**OPCIONAL**: Liste dependências de serviços, times ou aprovações externas.

- [Dependência 1. Mínimo 10 caracteres.]
- [Exemplo: "API do SendGrid deve estar disponível e configurada até [YYYY-MM-DD]"]
- [Exemplo: "Aprovação de segurança para uso de dados de usuários até [YYYY-MM-DD]"]
- [Exemplo: "Time de design deve finalizar componentes do design system até [YYYY-MM-DD]"]

---

## Riscos Identificados

**OPCIONAL**: Liste riscos específicos que podem impactar as tarefas.

### Risco 1: [Título do Risco]
**Descrição**: [Descrição detalhada do risco. Mínimo 10 caracteres.]

**Exemplo:** Atraso na configuração da conta do SendGrid pode bloquear T2 (implementação de envio de emails).

**Mitigação**: [Estratégia para mitigar. Mínimo 10 caracteres.]

**Exemplo:** Criar mock da API do SendGrid para desenvolvimento e testes. Escalar com gestor para priorizar configuração da conta real.

---

### Risco 2: [Título do Risco]
**Descrição**: [Descrição detalhada.]

**Mitigação**: [Estratégia para mitigar.]

---

## Matriz de Rastreabilidade (Requisitos PRD → Tarefas)

| Requisito PRD | Tarefas Vinculadas | Responsável | Status |
|---------------|-------------------|-------------|--------|
| RF1: Segmentação de usuários | T1, T2, T10 | @backend-team | [Status] |
| RF2: Envio de notificações | T3, T4, T11 | @backend-team | [Status] |
| RF3: Dashboard de métricas | T5, T6, T12 | @frontend-team | [Status] |
| RNF1: Performance | T1, T2, T3, T10 | @backend-team | [Status] |
| RNF2: Segurança | T1, T2, T13 | @backend-team, @security-team | [Status] |

---

## Cronograma de Execução

| ID | Tarefa | Responsável | Data Início | Data Fim | Status |
|----|--------|-------------|-------------|----------|--------|
| T1 | [Título da T1] | [@team] | [YYYY-MM-DD] | [YYYY-MM-DD] | [Status] |
| T2 | [Título da T2] | [@team] | [YYYY-MM-DD] | [YYYY-MM-DD] | [Status] |
| T5 | [Título da T5] | [@team] | [YYYY-MM-DD] | [YYYY-MM-DD] | [Status] |

---

## Histórico de Versões

| Versão | Data | Autor | Alterações |
|--------|------|-------|------------|
| 1.0.0 | [YYYY-MM-DD] | [Nome] | Criação inicial do documento |
| 1.0.1 | [YYYY-MM-DD] | [Nome] | [Descrição das alterações] |

---

## Notas Importantes

**Regras de Preenchimento:**
- Todos os campos marcados com [colchetes] devem ser preenchidos.
- IDs de tarefas devem seguir o padrão: T1, T2, T3, etc.
- Responsáveis devem seguir o padrão: @nome-do-time ou @nome-pessoa.
- Estimativas devem usar: SP (Story Points), h (horas) ou d (dias).
- Datas devem estar no formato ISO 8601 (YYYY-MM-DD).
- Status possíveis: Não Iniciado, Em Progresso, Bloqueado, Concluído.
- Prioridades possíveis: Alta, Média, Baixa.

**Validação:**
- Mínimo 1 tarefa obrigatória.
- Cada tarefa deve ter pelo menos 1 critério de aceite.
- Cada tarefa deve estar vinculada a pelo menos 1 requisito do PRD.
- Tarefas bloqueadas devem ter dependências listadas explicitamente.
