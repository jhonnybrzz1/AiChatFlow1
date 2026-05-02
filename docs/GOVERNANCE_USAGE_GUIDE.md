# Guia de Uso - Governança Humana

## 📋 Visão Geral

A feature de **Governança Humana** permite que documentos passem por um processo de revisão e aprovação antes de serem finalizados, garantindo que o conteúdo aprovado seja exatamente o que foi revisado.

## 🔄 Fluxo de Estados

```
DRAFT → APPROVAL_REQUIRED → FINAL
  ↓           ↓                ↓
Edição    Revisão          Bloqueado
Livre     Congelada        (Read-only)
```

## 🚀 Como Usar

### 1. Criar Demanda com Governança

```typescript
POST /api/demands
{
  "title": "Nova Feature",
  "description": "Descrição da demanda",
  "type": "nova_funcionalidade",
  "priority": "alta",
  "requiresApproval": true  // ← Ativa governança
}
```

### 2. Submeter para Revisão

Quando o documento estiver pronto para revisão:

```typescript
POST /api/governance/demands/:id/submit-for-approval

Response:
{
  "success": true,
  "documentState": "APPROVAL_REQUIRED",
  "reviewSnapshotId": "uuid-do-snapshot",
  "snapshotHash": "hash-sha256",
  "approvalSessionId": "uuid-da-sessao"
}
```

**O que acontece:**
- Cria snapshot imutável do conteúdo atual
- Transiciona estado para `APPROVAL_REQUIRED`
- Congela o conteúdo para revisão

### 3. Visualizar Documento em Revisão

```typescript
GET /api/governance/demands/:id/review-snapshot

Response:
{
  "snapshot": {
    "snapshotId": "uuid",
    "snapshotHash": "hash",
    "createdAt": "timestamp"
  },
  "payload": {
    "demandId": 123,
    "title": "...",
    "prdContent": "...",
    "tasksContent": "..."
  }
}
```

### 4. Aprovar Documento

```typescript
POST /api/governance/demands/:id/approve
{
  "reviewSnapshotId": "uuid-do-snapshot",
  "comments": "Aprovado com ressalvas..." // opcional
}

Response:
{
  "success": true,
  "documentState": "APPROVAL_REQUIRED",
  "approvedSnapshotId": "uuid-aprovado",
  "approvedSnapshotHash": "hash"
}
```

**Características:**
- ✅ Idempotente (pode chamar múltiplas vezes)
- ✅ Valida que snapshot não mudou
- ✅ Retorna erro `SNAPSHOT_OUTDATED` se mudou

### 5. Finalizar Documento

```typescript
POST /api/governance/demands/:id/finalize
{} // ← Body vazio! Não aceita conteúdo

Response:
{
  "success": true,
  "documentState": "FINAL",
  "finalSnapshotId": "uuid",
  "finalizedFromHash": "hash"
}
```

**Guardrails:**
- ❌ Rejeita se body contém campos de conteúdo
- ✅ Deriva conteúdo exclusivamente do snapshot aprovado
- ✅ Valida hash: `finalizedFromHash === approvedSnapshotHash`

## 🎨 Componentes Frontend

### ReviewBanner

Exibe banner informativo sobre o estado do documento:

```tsx
import { ReviewBanner } from "@/components/governance/ReviewBanner";

<ReviewBanner
  documentState={demand.documentState}
  reviewSnapshotId={demand.reviewSnapshotId}
  snapshotHash={demand.approvedSnapshotHash}
  approvalSessionId={demand.approvalSessionId}
/>
```

### ApprovalActions

Botões de aprovação e finalização:

```tsx
import { ApprovalActions } from "@/components/governance/ApprovalActions";

<ApprovalActions
  demandId={demand.id}
  reviewSnapshotId={demand.reviewSnapshotId}
  documentState={demand.documentState}
  onApprovalComplete={() => refetchDemand()}
/>
```

### ApprovalComments

Lista de comentários de revisão:

```tsx
import { ApprovalComments } from "@/components/governance/ApprovalComments";

<ApprovalComments demandId={demand.id} />
```

## 📊 Métricas e Auditoria

### Visualizar Eventos do Ciclo de Vida

```typescript
GET /api/governance/demands/:id/lifecycle-events

Response: [
  {
    "eventId": 1,
    "demandId": 123,
    "eventType": "DRAFT_TO_APPROVAL_REQUIRED",
    "reviewSnapshotId": "uuid",
    "resultCode": "SUCCESS",
    "createdAt": "timestamp"
  },
  {
    "eventId": 2,
    "eventType": "APPROVAL_REQUIRED_TO_APPROVED",
    "approvedSnapshotId": "uuid",
    "resultCode": "SUCCESS"
  }
]
```

### Métricas do Sistema

```typescript
GET /api/governance/metrics

Response: {
  "adoptionRate": 0.75,
  "avgTimeToApproval": 3600,
  "reworkRate": 0.05,
  "avgComments": 2.3,
  "conflictRate": 0.01
}
```

## 🔒 Invariantes Garantidas

1. **Snapshot Imutável**: Conteúdo em revisão nunca muda
2. **Hash Determinístico**: `finalizedFromHash === approvedSnapshotHash`
3. **Single Source of Truth**: FINAL deriva apenas do snapshot aprovado
4. **Idempotência**: Aprovar mesmo snapshot múltiplas vezes = mesmo resultado
5. **Guardrail de Payload**: Finalize rejeita conteúdo do cliente

## ⚠️ Tratamento de Erros

### SNAPSHOT_OUTDATED

```json
{
  "error": "SNAPSHOT_OUTDATED: The review snapshot has changed. Please reload.",
  "currentReviewSnapshotId": "novo-uuid"
}
```

**Ação:** Recarregar página para obter snapshot atualizado

### Estado Inválido

```json
{
  "error": "Cannot finalize: document is in state 'DRAFT', expected 'APPROVAL_REQUIRED'",
  "currentState": "DRAFT",
  "allowedActions": ["submit_for_approval"]
}
```

### Payload Rejeitado

```json
{
  "error": "Invalid request: finalize must not contain content fields",
  "rejectedFields": ["prdContent", "description"]
}
```

## 🧪 Testando a Feature

```bash
# 1. Criar demanda com governança
curl -X POST http://localhost:5000/api/demands \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Test Governance",
    "description": "Testing approval workflow",
    "type": "nova_funcionalidade",
    "priority": "media",
    "requiresApproval": true
  }'

# 2. Submeter para revisão
curl -X POST http://localhost:5000/api/governance/demands/1/submit-for-approval

# 3. Aprovar
curl -X POST http://localhost:5000/api/governance/demands/1/approve \
  -H "Content-Type: application/json" \
  -d '{
    "reviewSnapshotId": "uuid-retornado",
    "comments": "LGTM!"
  }'

# 4. Finalizar
curl -X POST http://localhost:5000/api/governance/demands/1/finalize \
  -H "Content-Type: application/json" \
  -d '{}'
```

## 📈 Compatibilidade

- ✅ Demandas com `requiresApproval: false` mantêm fluxo original
- ✅ Demandas existentes não são afetadas
- ✅ Feature é opt-in (ativada por demanda)

## 🔍 Debugging

### Verificar Estado Atual

```sql
SELECT
  id,
  title,
  document_state,
  requires_approval,
  review_snapshot_id,
  approved_snapshot_id,
  final_snapshot_id
FROM demands
WHERE id = 123;
```

### Verificar Snapshots

```sql
SELECT
  snapshot_id,
  snapshot_type,
  snapshot_hash,
  created_at
FROM document_snapshots
WHERE demand_id = 123
ORDER BY created_at DESC;
```

### Verificar Eventos

```sql
SELECT
  event_type,
  result_code,
  error_message,
  created_at
FROM document_lifecycle_events
WHERE demand_id = 123
ORDER BY created_at DESC;
```

## 📚 Referências

- [PRD Técnico](../PRODUCT_DISCOVERY_REPORT.md)
- [Documentação de Implementação](./HUMAN_GOVERNANCE_IMPLEMENTATION.md)
- [Schema Database](../shared/schema.ts)
