# Guia de Templates e Validação de Documentos

## Visão Geral

Este sistema implementa templates padronizados e validação automática para documentos PRD (Product Requirements Document) e Tasks Document gerados pelo agente Product Manager.

## Objetivos

1. **Qualidade estrutural**: Garantir que todos os documentos sigam um padrão mínimo de qualidade
2. **Rastreabilidade**: Criar vínculos claros entre requisitos (PRD) e tarefas (Tasks)
3. **Clareza técnica**: Eliminar ambiguidades e garantir critérios de aceite testáveis
4. **Validação automática**: Detectar problemas antes da entrega ao time

## Templates

### Template PRD

Localização: `/docs/templates/prd_template.md`

**Estrutura obrigatória:**
- Escopo (In Scope / Out of Scope)
- Requisitos Funcionais (RF1, RF2, ...)
- Requisitos Não Funcionais (RNF1, RNF2, ...)
- Critérios de Aceitação Gerais
- Dependências (Internas / Externas)
- Riscos e Mitigações
- Métricas de Sucesso
- Cronograma Estimado
- Aprovações

**Exemplo de Requisito Funcional:**
```markdown
### RF1: Listar usuários ativos
**Descrição**: Sistema deve retornar lista paginada de usuários ativos

**Critérios de Aceite**:
- Retornar JSON com campos: id, nome, email, status
- Suportar paginação com limite de 50 usuários por página
- Validar token de autenticação antes de processar

**Prioridade**: Must-have
```

### Template Tasks Document

Localização: `/docs/templates/tasks_template.md`

**Estrutura obrigatória:**
- Metadados (Prioridade, Responsável, Status)
- Tarefas por categoria (Backend, Frontend, Testes, Documentação)
- Métricas de Sucesso
- Dependências Externas
- Riscos Identificados

**Exemplo de Tarefa:**
```markdown
### 🔧 Backend
- **T1**: Criar endpoint GET /users para listar usuários
  - Critérios de aceite:
    - Endpoint responde com status 200 e lista de usuários
    - Implementar paginação com query params ?page e ?limit
    - Adicionar validação de token JWT
  - Dependências: T3 (autenticação)
  - Vinculado ao PRD: RF1, RNF1
```

## Sistema de Validação

### Arquivo de Validação

Localização: `/server/utils/validateDocuments.ts`

### Regras de Validação

#### PRD
- ✅ Seção "Escopo" presente
- ✅ Pelo menos 1 Requisito Funcional (RF1, RF2, ...)
- ✅ Cada RF possui critérios de aceite
- ✅ Seção "Critérios de Aceitação Gerais" presente
- ⚠️ Requisitos Não Funcionais (warning se ausente)
- ⚠️ Métricas de Sucesso (warning se ausente)

#### Tasks Document
- ✅ Metadados completos (Prioridade, Responsável, Status)
- ✅ Pelo menos 1 tarefa (T1, T2, ...)
- ✅ Cada tarefa possui critérios de aceite
- ⚠️ Tarefas vinculadas ao PRD (warning se ausente)
- ⚠️ Seção "Métricas de Sucesso" (warning se ausente)

### Tipos de Validação

1. **Erros Críticos** (❌): Bloqueiam a qualidade do documento
   - Campo obrigatório ausente
   - Formato de ID inválido
   - Critérios de aceite vazios

2. **Avisos** (⚠️): Indicam áreas de melhoria
   - Campos opcionais ausentes
   - Placeholders não preenchidos
   - Vínculos PRD-Tasks ausentes

## Integração com o Sistema

### 1. Agente Product Manager

O agente foi atualizado para:
- Seguir templates obrigatórios ao gerar documentos
- Incluir IDs estruturados (RF1, T1, RNF1)
- Vincular tarefas a requisitos do PRD
- Usar métricas quantificáveis

Arquivo: `/agents/product_manager.yaml`

### 2. Hook de Validação Pré-Salvamento

A validação ocorre automaticamente em:
- `PDFGenerator.generatePRDDocument()`
- `PDFGenerator.generateTasksDocument()`

**Comportamento:**
- Erros são logados no console com tag `[PDF-GENERATOR]`
- Warnings são logados separadamente
- Documentos são gerados mesmo com erros (para não bloquear o fluxo)
- Logs ajudam a identificar problemas para correção futura

Arquivo: `/server/services/pdf-generator.ts`

## Uso da Validação Programática

```typescript
import { validatePRDDocument, validateTasksDocument, formatValidationErrors } from './server/utils/validateDocuments';

// Validar PRD
const prdValidation = validatePRDDocument(prdContent);
if (!prdValidation.isValid) {
  console.error('PRD possui erros:');
  prdValidation.errors.forEach(error => {
    console.error(`- [${error.field}] ${error.message}`);
  });
}

// Validar Tasks
const tasksValidation = validateTasksDocument(tasksContent);
if (!tasksValidation.isValid) {
  console.error(formatValidationErrors(tasksValidation, 'Tasks'));
}

// Validar ambos
import { validateDocuments } from './server/utils/validateDocuments';
const result = validateDocuments(prdContent, tasksContent);
console.log('Validação geral:', result.overallValid);
```

## Exemplos de Documentos Válidos

### PRD Completo

```markdown
# PRD - API de Gerenciamento de Usuários

## 1. Escopo

### In Scope
- Criar endpoint para listar usuários ativos
- Implementar autenticação JWT
- Adicionar paginação

### Out of Scope
- Exportação de dados em CSV
- Integração com LDAP

## 2. Requisitos Funcionais

### RF1: Listar usuários ativos
**Descrição**: Sistema deve retornar lista paginada de usuários com status "ativo"

**Critérios de Aceite**:
- Retornar JSON com campos: id, nome, email, status, data_criacao
- Suportar paginação com query params ?page (padrão: 1) e ?limit (padrão: 50, máx: 100)
- Validar token JWT antes de processar requisição
- Retornar status 401 se token inválido

**Prioridade**: Must-have

### RF2: Autenticação por token
**Descrição**: Sistema deve validar token JWT em todas as requisições

**Critérios de Aceite**:
- Validar assinatura do token
- Verificar expiração (máx: 24h)
- Retornar erro 401 com mensagem clara se inválido

**Prioridade**: Must-have

## 3. Requisitos Não Funcionais

### RNF1: Performance
**Descrição**: Sistema deve suportar 1000 requisições simultâneas
**Métrica**: Tempo de resposta < 200ms no p95

### RNF2: Segurança
**Descrição**: Todas as requisições devem usar HTTPS
**Métrica**: 100% das requisições com TLS 1.2+

## 4. Critérios de Aceitação Gerais
- Endpoint /users funcional e testado
- Documentação da API atualizada (Swagger)
- Testes automatizados com cobertura mínima de 80%
- Code review aprovado por tech lead

## 5. Dependências

### Internas
- Time de backend deve concluir migração do banco até 15/01

### Externas
- Aprovação de segurança até 20/01

## 6. Riscos e Mitigações

### Risco 1: Atraso na migração do banco
**Impacto**: Alto
**Probabilidade**: Média
**Mitigação**: Usar banco de staging até conclusão da migração

## 7. Métricas de Sucesso

### KPIs Primários
- Redução de 30% no tempo de resposta da API
- Aumento de 20% na taxa de conversão

### KPIs Secundários
- Aumento de 10% no NPS
- Redução de 25% nas chamadas ao suporte

### Como Medir
- Google Analytics + Dashboard interno
- Avaliação semanal durante primeiro mês

## 8. Cronograma Estimado

| Fase | Prazo | Responsável |
|------|-------|-------------|
| Design | 3 dias | @backend-team |
| Desenvolvimento | 10 dias | @backend-team |
| Testes | 5 dias | @qa-team |
| Deploy | 1 dia | @devops-team |

## 9. Aprovações
- [ ] Product Manager
- [ ] Tech Lead
- [ ] Stakeholder (Head of Engineering)
```

### Tasks Document Completo

```markdown
# Tasks Document - API de Gerenciamento de Usuários

## Metadados
- **Prioridade**: Alta
- **Responsável**: @backend-team
- **Status**: Não Iniciado

## Tarefas

### 🔧 Backend
- **T1**: Criar endpoint GET /users para listar usuários
  - Critérios de aceite:
    - Endpoint responde com status 200 e array de usuários
    - Implementar paginação com query params ?page e ?limit
    - Validar limites (max 100 usuários por página)
    - Retornar metadata de paginação (total, páginas, página atual)
  - Dependências: T2
  - Vinculado ao PRD: RF1

- **T2**: Implementar autenticação JWT
  - Critérios de aceite:
    - Middleware valida token JWT em todas as rotas
    - Retornar 401 com mensagem clara se token inválido
    - Verificar expiração do token (máx 24h)
    - Logs de tentativas de acesso com token inválido
  - Dependências: Nenhuma
  - Vinculado ao PRD: RF2, RNF2

### 🎨 Frontend
- **T3**: Criar interface de listagem de usuários
  - Critérios de aceite:
    - Tabela com colunas: Nome, Email, Status, Data de Criação
    - Implementar paginação client-side
    - Loading state durante requisição
    - Mensagem de erro se falha na API
  - Dependências: T1
  - Vinculado ao PRD: RF1

### 🧪 Testes
- **T4**: Criar testes automatizados para /users
  - Critérios de aceite:
    - Testes unitários para lógica de paginação
    - Testes de integração para endpoint completo
    - Testes de autenticação (token válido/inválido)
    - Cobertura mínima de 80%
  - Dependências: T1, T2
  - Vinculado ao PRD: RF1, RF2

### 📚 Documentação
- **T5**: Atualizar documentação da API (Swagger)
  - Critérios de aceite:
    - Documentar endpoint /users com exemplos
    - Incluir schemas de resposta
    - Documentar códigos de erro (401, 500)
    - Adicionar exemplos de autenticação
  - Dependências: T1, T2
  - Vinculado ao PRD: Critérios Gerais

## Métricas de Sucesso
- Redução de 30% no tempo de resposta da API (baseline: 300ms, meta: 210ms)
- Cobertura de testes acima de 80%
- Zero erros de autenticação em produção após 1 semana

## Dependências Externas
- Aprovação do time de segurança até 20/01
- Banco de dados migrado até 15/01

## Riscos Identificados
- **Risco**: Atraso na migração do banco pode bloquear T1
  - **Mitigação**: Usar banco de staging até conclusão
- **Risco**: Token JWT pode ter problemas de performance em alta carga
  - **Mitigação**: Implementar cache de validação de tokens
```

## Critérios de Sucesso do Sistema

- ✅ 100% dos documentos gerados seguem os templates mínimos
- ✅ 0 erros de validação críticos em produção
- ✅ Tempo de refinamento reduzido em 30%
- ✅ Rastreabilidade completa entre PRD e Tasks (vínculos RF-T)

## Monitoramento

### Logs de Validação

Os logs seguem o formato:
```
[PDF-GENERATOR] PRD validation failed: {demandId, errors, timestamp}
[PDF-GENERATOR] Tasks validation warnings: {demandId, warnings, timestamp}
```

### Métricas Recomendadas

1. **Taxa de conformidade**: % de documentos sem erros críticos
2. **Tempo médio de refinamento**: Da criação da demanda até aprovação
3. **Erros por tipo**: Quais validações falham com mais frequência
4. **Taxa de retrabalho**: % de documentos que precisam correção manual

## Próximos Passos (Roadmap)

1. ✅ **MVP Implementado** (Versão Atual)
   - Templates mínimos
   - Validação básica
   - Integração com geração de PDFs

2. 🔄 **Melhorias Futuras**
   - Dashboard de métricas de qualidade
   - Validação em tempo real durante refinamento
   - Sugestões automáticas de correção
   - Integração com ferramentas de gerenciamento (Jira, Linear)
   - Exportação para outros formatos (JSON, YAML)
   - Histórico de versões de documentos

## Suporte

Para dúvidas ou problemas:
1. Verifique os logs com tag `[PDF-GENERATOR]`
2. Consulte os templates em `/docs/templates/`
3. Revise a validação em `/server/utils/validateDocuments.ts`
4. Verifique a configuração do agente em `/agents/product_manager.yaml`
