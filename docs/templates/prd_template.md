# PRD - [Nome da Demanda]

**Versão:** [1.0.0]
**Data de Criação:** [YYYY-MM-DD]
**Última Atualização:** [YYYY-MM-DD]

---

## 1. Visão Geral

### 1.1 Objetivo
[Descrição clara e concisa do objetivo principal desta demanda. Mínimo 20 caracteres.]

**Exemplo:** Aumentar o reengajamento de usuários inativos em 15% através de notificações personalizadas baseadas em comportamento e preferências.

### 1.2 Problema
[Descrição detalhada do problema que esta demanda resolve. Mínimo 20 caracteres.]

**Exemplo:** Atualmente, 42% dos usuários cadastrados estão inativos há mais de 30 dias, resultando em perda de receita estimada em R$ 250.000/mês e redução do LTV (Lifetime Value) em 35%.

### 1.3 Solução Proposta
[Descrição da solução que será implementada para resolver o problema. Opcional, mas recomendado.]

**Exemplo:** Implementar sistema de notificações personalizadas multicanal (email + push) que identifica usuários inativos, segmenta por perfil comportamental e envia mensagens customizadas para reengajamento.

---

## 2. Requisitos Funcionais

### RF1: [Título do Requisito]
**Descrição**: [Descrição técnica detalhada do requisito funcional. Mínimo 10 caracteres.]

**Exemplo:** Segmentação de usuários inativos - Sistema deve identificar automaticamente usuários que não realizaram login nos últimos 30 dias e classificá-los por perfil comportamental (casual, power user, trial).

**Critérios de Aceite**:
- [Critério 1 - Deve ser claro, mensurável e testável]
- [Critério 2 - Deve ser claro, mensurável e testável]
- [Exemplo: "Retornar lista de usuários inativos com precisão ≥95%"]
- [Exemplo: "API deve responder em menos de 500ms no p95"]

**Prioridade**: [Must-have | Should-have | Nice-to-have]

---

### RF2: [Título do Requisito]
**Descrição**: [Descrição técnica detalhada do requisito funcional. Mínimo 10 caracteres.]

**Critérios de Aceite**:
- [Critério 1 - Deve ser claro, mensurável e testável]
- [Critério 2 - Deve ser claro, mensurável e testável]

**Prioridade**: [Must-have | Should-have | Nice-to-have]

---

*Adicione mais requisitos funcionais seguindo o padrão RF3, RF4, etc.*

---

## 3. Requisitos Não Funcionais

### RNF1: Performance
**Descrição**: [Requisito específico de performance com números concretos. Mínimo 10 caracteres.]

**Exemplo:** Sistema deve suportar 1000 requisições simultâneas sem degradação de performance.

**Métrica**: [Como medir e validar - Deve ser específica e mensurável.]

**Exemplo:** Tempo de resposta < 200ms no percentil 95 (p95), medido via APM (New Relic/Datadog).

---

### RNF2: Segurança
**Descrição**: [Requisitos de segurança específicos. Mínimo 10 caracteres.]

**Exemplo:** Todas as comunicações devem usar TLS 1.3, dados sensíveis criptografados em repouso (AES-256).

**Métrica**: [Como validar - Deve ser específica e verificável.]

**Exemplo:** 100% dos endpoints protegidos com autenticação JWT, validado por testes de segurança automatizados.

---

### RNF3: Escalabilidade
**Descrição**: [Requisitos de escalabilidade. Mínimo 10 caracteres.]

**Exemplo:** Sistema deve escalar horizontalmente para suportar crescimento de 200% na base de usuários.

**Métrica**: [Como medir - Deve ser específica e mensurável.]

**Exemplo:** Tempo de provisionamento de novos pods < 30 segundos, medido via Kubernetes metrics.

---

*Adicione mais requisitos não funcionais seguindo o padrão RNF4, RNF5, etc.*

---

## 4. Escopo

### 4.1 In Scope (O que está incluído)
- [Item 1 - Entregável específico e mensurável]
- [Item 2 - Entregável específico e mensurável]
- [Exemplo: "Criar endpoint API para segmentação de usuários inativos"]
- [Exemplo: "Implementar sistema de envio de notificações via email (SendGrid)"]
- [Exemplo: "Desenvolver dashboard de métricas de reengajamento"]

### 4.2 Out of Scope (O que está excluído)
- [Item 1 - Exclusão explícita para evitar ambiguidade]
- [Item 2 - Exclusão explícita para evitar ambiguidade]
- [Exemplo: "Notificações via SMS (será tratado em fase futura)"]
- [Exemplo: "Integração com redes sociais (fora do MVP)"]
- [Exemplo: "Exportação de dados de usuários em CSV"]

---

## 5. Critérios de Aceitação Gerais
- [Critério 1 - Condição global que deve ser atendida. Mínimo 10 caracteres.]
- [Critério 2 - Condição global que deve ser atendida. Mínimo 10 caracteres.]
- [Exemplo: "Todos os endpoints API devem estar funcionais e testados"]
- [Exemplo: "Documentação da API atualizada no Swagger"]
- [Exemplo: "Testes automatizados com cobertura mínima de 80%"]
- [Exemplo: "Code review aprovado por tech lead"]
- [Exemplo: "Deploy em ambiente de staging realizado com sucesso"]

## 6. Dependências

### 6.1 Dependências Internas
- [Dependência 1 - Time ou sistema interno necessário]
- [Exemplo: "Time de backend deve concluir API de autenticação até [data]"]
- [Exemplo: "Design system deve incluir componentes de notificação até [data]"]
- [Exemplo: "Database migration para suportar novos campos até [data]"]

### 6.2 Dependências Externas
- [Dependência 1 - Serviço ou aprovação externa necessária]
- [Exemplo: "Aprovação de compliance/LGPD até [YYYY-MM-DD]"]
- [Exemplo: "API do SendGrid deve estar disponível e configurada"]
- [Exemplo: "Conta no Firebase Cloud Messaging configurada"]

---

## 7. Riscos e Mitigações

### R1: [Título do Risco]
**Descrição**: [Descrição detalhada do risco identificado. Mínimo 10 caracteres.]

**Exemplo:** Atraso na integração com CRM (Salesforce) pode bloquear a funcionalidade de sincronização de dados de usuários.

**Impacto**: [Alto | Médio | Baixo]

**Probabilidade**: [Alta | Média | Baixa]

**Mitigação**: [Estratégia específica para mitigar ou resolver o risco. Mínimo 10 caracteres.]

**Exemplo:** Criar mock da API do Salesforce para desenvolvimento paralelo. Estabelecer reuniões semanais com time de integração do Salesforce.

---

### R2: [Título do Risco]
**Descrição**: [Descrição detalhada do risco identificado. Mínimo 10 caracteres.]

**Impacto**: [Alto | Médio | Baixo]

**Probabilidade**: [Alta | Média | Baixa]

**Mitigação**: [Estratégia específica para mitigar ou resolver o risco. Mínimo 10 caracteres.]

---

*Adicione mais riscos seguindo o padrão R3, R4, etc. Mínimo 1 risco obrigatório.*

---

## 8. Métricas de Sucesso

### 8.1 KPIs Primários
**KPI1**: [Descrição do KPI primário. Mínimo 10 caracteres.]
- **Meta**: [Valor numérico específico - Ex: "15%", "200ms", "95%"]
- **Como Medir**: [Método e ferramenta de medição]
- **Exemplo Completo:**
  - **Descrição**: Taxa de reengajamento de usuários inativos
  - **Meta**: ≥15% em 3 meses
  - **Como Medir**: Google Analytics + Amplitude (eventos de login após notificação)

---

**KPI2**: [Descrição do KPI primário. Mínimo 10 caracteres.]
- **Meta**: [Valor numérico específico]
- **Como Medir**: [Método e ferramenta de medição]

---

*Mínimo 1 KPI primário obrigatório. Adicione mais seguindo o padrão KPI3, KPI4, etc.*

### 8.2 KPIs Secundários (Opcional)
**KPI-S1**: [Descrição do KPI secundário. Mínimo 10 caracteres.]
- **Meta**: [Valor numérico específico]
- **Como Medir**: [Método e ferramenta de medição]
- **Exemplo:**
  - **Descrição**: Aumento no NPS (Net Promoter Score)
  - **Meta**: +10 pontos em 6 meses
  - **Como Medir**: Pesquisa NPS trimestral via Typeform

---

### 8.3 Frequência de Medição
- [Especificar com que frequência os KPIs serão medidos]
- [Exemplo: "Avaliação semanal durante o primeiro mês"]
- [Exemplo: "Relatórios mensais para stakeholders"]
- [Exemplo: "Dashboard em tempo real para métricas críticas (uptime, latência)"]

---

## 9. Cronograma Estimado

**Data do MVP**: [YYYY-MM-DD] *(Obrigatório - formato ISO 8601)*

### Fases do Projeto (Opcional, mas recomendado)

| Fase | Duração Estimada | Responsável | Data Início | Data Fim |
|------|-----------------|-------------|-------------|----------|
| Discovery & Design | [Ex: 2 semanas] | [@design-team] | [YYYY-MM-DD] | [YYYY-MM-DD] |
| Desenvolvimento Backend | [Ex: 4 semanas] | [@backend-team] | [YYYY-MM-DD] | [YYYY-MM-DD] |
| Desenvolvimento Frontend | [Ex: 3 semanas] | [@frontend-team] | [YYYY-MM-DD] | [YYYY-MM-DD] |
| Testes & QA | [Ex: 2 semanas] | [@qa-team] | [YYYY-MM-DD] | [YYYY-MM-DD] |
| Deploy & Monitoramento | [Ex: 1 semana] | [@devops-team] | [YYYY-MM-DD] | [YYYY-MM-DD] |

---

## 10. Aprovações

- [ ] **Product Manager** - [Nome] - Data: [YYYY-MM-DD]
- [ ] **Tech Lead** - [Nome] - Data: [YYYY-MM-DD]
- [ ] **Stakeholder Principal** - [Nome] - Data: [YYYY-MM-DD]
- [ ] **Time de Design** (se aplicável) - [Nome] - Data: [YYYY-MM-DD]
- [ ] **Time de Segurança/Compliance** (se aplicável) - [Nome] - Data: [YYYY-MM-DD]
- [ ] **Time de Dados** (se aplicável) - [Nome] - Data: [YYYY-MM-DD]

---

## Histórico de Versões

| Versão | Data | Autor | Alterações |
|--------|------|-------|------------|
| 1.0.0 | [YYYY-MM-DD] | [Nome] | Criação inicial do documento |
| 1.0.1 | [YYYY-MM-DD] | [Nome] | [Descrição das alterações] |

---

**Notas:**
- Todos os campos marcados com [colchetes] devem ser preenchidos.
- IDs devem seguir os padrões: RF1, RF2 para Requisitos Funcionais; RNF1, RNF2 para Não Funcionais; R1, R2 para Riscos; KPI1, KPI2 para Métricas.
- Datas devem estar no formato ISO 8601 (YYYY-MM-DD).
- Prioridades devem ser: Must-have, Should-have ou Nice-to-have.
- Responsáveis devem seguir o padrão: @nome-do-time ou @nome-pessoa.
