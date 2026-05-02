# Implementação Técnica - Governança Humana Opcional

**Baseado em:** PRD - Governança humana opcional para documentos
**Data:** 01 de Maio de 2026
**Versão:** 1.0
**Status:** Planejamento Técnico

---

## 📋 Sumário Executivo

Este documento detalha a implementação técnica do sistema de governança humana opcional para documentos, permitindo revisão e aprovação antes da finalização quando necessário.

**Objetivo:** Adicionar fluxo de revisão opcional que reduz retrabalho pós-finalização mantendo simplicidade para documentos que não precisam de revisão.

**Escopo MVP:**
- Estados claros do ciclo de vida
- Snapshot de conteúdo para revisão
- Comentários simples de feedback
- Versionamento mínimo por aprovação
- Métricas básicas de ROI

---

## 🎯 Requisitos Técnicos

### RT1: Schema de Banco de Dados

**Extensão da tabela `demands`:**

```typescript
// shared/schema.ts
export const demands = sqliteTable("demands", {
  // ... campos existentes ...

  // Novos campos para governança
  requiresHumanReview: integer("requires_human_review", { mode: "boolean" }).default(false),
  documentStatus: text("document_status", {
    enum: ["DRAFT", "UNDER_REVIEW", "APPROVED", "FINAL"]
  }).default("DRAFT"),
  revisionNumber: integer("revision_number").default(0),
  reviewRequestedAt: integer("review_requested_at", { mode: "timestamp" }),
  reviewedAt: integer("reviewed_at", { mode: "timestamp" }),
  reviewedBy: text("reviewed_by"),

  // Snapshots de conteúdo
  draftSnapshot: text("draft_snapshot"), // JSON do conteúdo enviado para revisão
  approvedSnapshot: text("approved_snapshot"), // JSON do conteúdo aprovado
});
```

**Nova tabela `document_reviews`:**

```typescript
export const documentReviews = sqliteTable("document_reviews", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  demandId: integer("demand_id").notNull().references(() => demands.id),
  reviewerName: text("reviewer_name"),
  reviewerEmail: text("reviewer_email"),
  action: text("action", { enum: ["APPROVED", "CHANGES_REQUESTED"] }).notNull(),
  comments: text("comments"),
  snapshotHash: text("snapshot_hash"), // Hash do conteúdo revisado
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});
```

**Nova tabela `document_metrics`:**

```typescript
export const documentMetrics = sqliteTable("document_metrics", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  demandId: integer("demand_id").notNull().references(() => demands.id),
  eventType: text("event_type", {
    enum: [
      "review_requested",
      "review_approved",
      "review_changes_requested",
      "document_finalized",
      "document_reopened_after_final",
      "conflict_detected"
    ]
  }).notNull(),
  metadata: text("metadata"), // JSON com dados adicionais
  timestamp: integer("timestamp", { mode: "timestamp" }).notNull(),
});
```

### RT2: Estados e Transições

**Máquina de Estados:**

```typescript
// server/services/document-state-machine.ts

export type DocumentState = "DRAFT" | "UNDER_REVIEW" | "APPROVED" | "FINAL";

export interface StateTransition {
  from: DocumentState;
  to: DocumentState;
  action: string;
  requiresReview: boolean;
}

export const ALLOWED_TRANSITIONS: StateTransition[] = [
  // Sem revisão obrigatória
  { from: "DRAFT", to: "FINAL", action: "finalize", requiresReview: false },

  // Com revisão obrigatória
  { from: "DRAFT", to: "UNDER_REVIEW", action: "request_review", requiresReview: true },
  { from: "UNDER_REVIEW", to: "APPROVED", action: "approve", requiresReview: true },
  { from: "UNDER_REVIEW", to: "DRAFT", action: "request_changes", requiresReview: true },
  { from: "APPROVED", to: "FINAL", action: "finalize", requiresReview: true },

  // Reabrir após finalização (edge case)
  { from: "FINAL", to: "DRAFT", action: "reopen", requiresReview: false },
];

export class DocumentStateMachine {
  static canTransition(
    currentState: DocumentState,
    targetState: DocumentState,
    requiresReview: boolean
  ): boolean {
    return ALLOWED_TRANSITIONS.some(
      t => t.from === currentState &&
           t.to === targetState &&
           t.requiresReview === requiresReview
    );
  }

  static getNextActions(
    currentState: DocumentState,
    requiresReview: boolean
  ): string[] {
    return ALLOWED_TRANSITIONS
      .filter(t => t.from === currentState && t.requiresReview === requiresReview)
      .map(t => t.action);
  }

  static validateTransition(
    currentState: DocumentState,
    action: string,
    requiresReview: boolean
  ): { valid: boolean; targetState?: DocumentState; error?: string } {
    const transition = ALLOWED_TRANSITIONS.find(
      t => t.from === currentState &&
           t.action === action &&
           t.requiresReview === requiresReview
    );

    if (!transition) {
      return {
        valid: false,
        error: `Transição inválida: ${action} não permitido no estado ${currentState} (requiresReview: ${requiresReview})`
      };
    }

    return { valid: true, targetState: transition.to };
  }
}
```

### RT3: Snapshot de Conteúdo

**Serviço de Snapshot:**

```typescript
// server/services/document-snapshot.ts

import crypto from 'crypto';

export interface DocumentSnapshot {
  prdContent: string;
  tasksContent: string;
  metadata: {
    demandId: number;
    title: string;
    description: string;
    type: string;
    priority: string;
  };
  timestamp: Date;
  hash: string;
}

export class DocumentSnapshotService {
  static createSnapshot(demand: Demand): DocumentSnapshot {
    const snapshot: Omit<DocumentSnapshot, 'hash'> = {
      prdContent: demand.prdContent || '',
      tasksContent: demand.tasksContent || '',
      metadata: {
        demandId: demand.id,
        title: demand.title,
        description: demand.description,
        type: demand.type,
        priority: demand.priority,
      },
      timestamp: new Date(),
    };

    const hash = this.generateHash(snapshot);

    return { ...snapshot, hash };
  }

  static generateHash(snapshot: Omit<DocumentSnapshot, 'hash'>): string {
    const content = JSON.stringify(snapshot);
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  static verifySnapshot(snapshot: DocumentSnapshot): boolean {
    const { hash, ...snapshotWithoutHash } = snapshot;
    const calculatedHash = this.generateHash(snapshotWithoutHash);
    return hash === calculatedHash;
  }

  static compareSnapshots(
    snapshot1: DocumentSnapshot,
    snapshot2: DocumentSnapshot
  ): boolean {
    return snapshot1.hash === snapshot2.hash;
  }
}
```

### RT4: API Endpoints

**Novos endpoints:**

```typescript
// server/routes.ts

// 1. Solicitar revisão
app.post("/api/demands/:id/request-review", async (req, res) => {
  const { id } = req.params;
  const { reviewerEmail, reviewerName } = req.body;

  try {
    const demand = await db.query.demands.findFirst({
      where: eq(demands.id, parseInt(id))
    });

    if (!demand) {
      return res.status(404).json({ error: "Demanda não encontrada" });
    }

    // Validar transição
    const validation = DocumentStateMachine.validateTransition(
      demand.documentStatus,
      "request_review",
      demand.requiresHumanReview
    );

    if (!validation.valid) {
      return res.status(409).json({
        error: validation.error,
        currentState: demand.documentStatus,
        allowedActions: DocumentStateMachine.getNextActions(
          demand.documentStatus,
          demand.requiresHumanReview
        )
      });
    }

    // Criar snapshot
    const snapshot = DocumentSnapshotService.createSnapshot(demand);

    // Atualizar demanda
    await db.update(demands)
      .set({
        documentStatus: "UNDER_REVIEW",
        draftSnapshot: JSON.stringify(snapshot),
        reviewRequestedAt: new Date(),
        reviewedBy: reviewerEmail,
      })
      .where(eq(demands.id, parseInt(id)));

    // Registrar métrica
    await db.insert(documentMetrics).values({
      demandId: parseInt(id),
      eventType: "review_requested",
      metadata: JSON.stringify({ reviewerEmail, reviewerName }),
      timestamp: new Date(),
    });

    res.json({
      success: true,
      documentStatus: "UNDER_REVIEW",
      snapshotHash: snapshot.hash
    });
  } catch (error) {
    console.error("Erro ao solicitar revisão:", error);
    res.status(500).json({ error: "Erro ao solicitar revisão" });
  }
});

// 2. Aprovar documento
app.post("/api/demands/:id/approve", async (req, res) => {
  const { id } = req.params;
  const { comments, snapshotHash } = req.body;

  try {
    const demand = await db.query.demands.findFirst({
      where: eq(demands.id, parseInt(id))
    });

    if (!demand) {
      return res.status(404).json({ error: "Demanda não encontrada" });
    }

    // Validar transição
    const validation = DocumentStateMachine.validateTransition(
      demand.documentStatus,
      "approve",
      demand.requiresHumanReview
    );

    if (!validation.valid) {
      return res.status(409).json({
        error: validation.error,
        currentState: demand.documentStatus
      });
    }

    // Verificar consistência do snapshot
    const draftSnapshot = JSON.parse(demand.draftSnapshot || '{}');
    if (snapshotHash && draftSnapshot.hash !== snapshotHash) {
      return res.status(409).json({
        error: "Conflito: o documento foi modificado durante a revisão",
        action: "reload",
        currentSnapshotHash: draftSnapshot.hash
      });
    }

    // Criar snapshot aprovado
    const approvedSnapshot = DocumentSnapshotService.createSnapshot(demand);

    // Atualizar demanda
    await db.update(demands)
      .set({
        documentStatus: "APPROVED",
        approvedSnapshot: JSON.stringify(approvedSnapshot),
        reviewedAt: new Date(),
        revisionNumber: (demand.revisionNumber || 0) + 1,
      })
      .where(eq(demands.id, parseInt(id)));

    // Registrar review
    await db.insert(documentReviews).values({
      demandId: parseInt(id),
      reviewerName: demand.reviewedBy || 'Unknown',
      action: "APPROVED",
      comments: comments || null,
      snapshotHash: approvedSnapshot.hash,
      createdAt: new Date(),
    });

    // Registrar métrica
    await db.insert(documentMetrics).values({
      demandId: parseInt(id),
      eventType: "review_approved",
      metadata: JSON.stringify({ comments }),
      timestamp: new Date(),
    });

    res.json({
      success: true,
      documentStatus: "APPROVED",
      revisionNumber: (demand.revisionNumber || 0) + 1
    });
  } catch (error) {
    console.error("Erro ao aprovar documento:", error);
    res.status(500).json({ error: "Erro ao aprovar documento" });
  }
});

// 3. Solicitar mudanças
app.post("/api/demands/:id/request-changes", async (req, res) => {
  const { id } = req.params;
  const { comments } = req.body;

  try {
    const demand = await db.query.demands.findFirst({
      where: eq(demands.id, parseInt(id))
    });

    if (!demand) {
      return res.status(404).json({ error: "Demanda não encontrada" });
    }

    // Validar transição
    const validation = DocumentStateMachine.validateTransition(
      demand.documentStatus,
      "request_changes",
      demand.requiresHumanReview
    );

    if (!validation.valid) {
      return res.status(409).json({
        error: validation.error,
        currentState: demand.documentStatus
      });
    }

    // Atualizar demanda
    await db.update(demands)
      .set({
        documentStatus: "DRAFT",
        reviewedAt: new Date(),
      })
      .where(eq(demands.id, parseInt(id)));

    // Registrar review
    await db.insert(documentReviews).values({
      demandId: parseInt(id),
      reviewerName: demand.reviewedBy || 'Unknown',
      action: "CHANGES_REQUESTED",
      comments: comments || null,
      createdAt: new Date(),
    });

    // Registrar métrica
    await db.insert(documentMetrics).values({
      demandId: parseInt(id),
      eventType: "review_changes_requested",
      metadata: JSON.stringify({ comments }),
      timestamp: new Date(),
    });

    res.json({
      success: true,
      documentStatus: "DRAFT"
    });
  } catch (error) {
    console.error("Erro ao solicitar mudanças:", error);
    res.status(500).json({ error: "Erro ao solicitar mudanças" });
  }
});

// 4. Finalizar documento
app.post("/api/demands/:id/finalize", async (req, res) => {
  const { id } = req.params;

  try {
    const demand = await db.query.demands.findFirst({
      where: eq(demands.id, parseInt(id))
    });

    if (!demand) {
      return res.status(404).json({ error: "Demanda não encontrada" });
    }

    // Validar transição
    const validation = DocumentStateMachine.validateTransition(
      demand.documentStatus,
      "finalize",
      demand.requiresHumanReview
    );

    if (!validation.valid) {
      return res.status(409).json({
        error: validation.error,
        currentState: demand.documentStatus,
        requiresReview: demand.requiresHumanReview,
        message: demand.requiresHumanReview
          ? "Este documento requer revisão antes de finalizar. Use 'Solicitar Revisão'."
          : "Estado atual não permite finalização."
      });
    }

    // Atualizar demanda
    await db.update(demands)
      .set({
        documentStatus: "FINAL",
        status: "completed", // Status geral da demanda
      })
      .where(eq(demands.id, parseInt(id)));

    // Registrar métrica
    await db.insert(documentMetrics).values({
      demandId: parseInt(id),
      eventType: "document_finalized",
      timestamp: new Date(),
    });

    res.json({
      success: true,
      documentStatus: "FINAL"
    });
  } catch (error) {
    console.error("Erro ao finalizar documento:", error);
    res.status(500).json({ error: "Erro ao finalizar documento" });
  }
});

// 5. Obter histórico de revisões
app.get("/api/demands/:id/reviews", async (req, res) => {
  const { id } = req.params;

  try {
    const reviews = await db.query.documentReviews.findMany({
      where: eq(documentReviews.demandId, parseInt(id)),
      orderBy: [desc(documentReviews.createdAt)]
    });

    res.json(reviews);
  } catch (error) {
    console.error("Erro ao buscar revisões:", error);
    res.status(500).json({ error: "Erro ao buscar revisões" });
  }
});

// 6. Obter snapshot para revisão
app.get("/api/demands/:id/review-snapshot", async (req, res) => {
  const { id } = req.params;

  try {
    const demand = await db.query.demands.findFirst({
      where: eq(demands.id, parseInt(id))
    });

    if (!demand) {
      return res.status(404).json({ error: "Demanda não encontrada" });
    }

    if (demand.documentStatus !== "UNDER_REVIEW") {
      return res.status(400).json({
        error: "Documento não está em revisão",
        currentState: demand.documentStatus
      });
    }

    const snapshot = JSON.parse(demand.draftSnapshot || '{}');

    res.json({
      snapshot,
      demandInfo: {
        id: demand.id,
        title: demand.title,
        documentStatus: demand.documentStatus,
        reviewRequestedAt: demand.reviewRequestedAt,
        reviewedBy: demand.reviewedBy,
      }
    });
  } catch (error) {
    console.error("Erro ao buscar snapshot:", error);
    res.status(500).json({ error: "Erro ao buscar snapshot" });
  }
});
```

### RT5: Frontend Components

**1. Document Status Badge:**

```typescript
// client/src/components/document-status-badge.tsx

import { CheckCircle, Clock, FileCheck, FileText } from "lucide-react";

interface DocumentStatusBadgeProps {
  status: "DRAFT" | "UNDER_REVIEW" | "APPROVED" | "FINAL";
  size?: "sm" | "md" | "lg";
}

export function DocumentStatusBadge({ status, size = "md" }: DocumentStatusBadgeProps) {
  const config = {
    DRAFT: {
      icon: FileText,
      label: "RASCUNHO",
      color: "var(--foreground-muted)",
    },
    UNDER_REVIEW: {
      icon: Clock,
      label: "EM REVISÃO",
      color: "var(--accent-cyan)",
    },
    APPROVED: {
      icon: FileCheck,
      label: "APROVADO",
      color: "var(--accent-lime)",
    },
    FINAL: {
      icon: CheckCircle,
      label: "FINALIZADO",
      color: "var(--success)",
    },
  };

  const { icon: Icon, label, color } = config[status];
  const sizeClass = size === "sm" ? "text-[9px] px-1.5 py-0.5" : "text-xs px-2 py-1";

  return (
    <span
      className={`brutal-badge inline-flex items-center gap-1 ${sizeClass}`}
      style={{ color, borderColor: color }}
    >
      <Icon className="w-3 h-3" />
      {label}
    </span>
  );
}
```

**2. Review Panel:**

```typescript
// client/src/components/review-panel.tsx

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle, XCircle, MessageSquare } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { DocumentStatusBadge } from "./document-status-badge";

interface ReviewPanelProps {
  demandId: number;
  documentStatus: string;
  requiresReview: boolean;
}

export function ReviewPanel({ demandId, documentStatus, requiresReview }: ReviewPanelProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [comments, setComments] = useState("");
  const [showComments, setShowComments] = useState(false);

  // Buscar histórico de revisões
  const { data: reviews } = useQuery({
    queryKey: [`/api/demands/${demandId}/reviews`],
    enabled: requiresReview,
  });

  // Mutation para aprovar
  const approveMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/demands/${demandId}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ comments }),
      });
      if (!response.ok) throw new Error("Erro ao aprovar documento");
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Documento aprovado com sucesso!" });
      queryClient.invalidateQueries({ queryKey: [`/api/demands/${demandId}`] });
      setComments("");
      setShowComments(false);
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao aprovar",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Mutation para solicitar mudanças
  const requestChangesMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/demands/${demandId}/request-changes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ comments }),
      });
      if (!response.ok) throw new Error("Erro ao solicitar mudanças");
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Mudanças solicitadas com sucesso!" });
      queryClient.invalidateQueries({ queryKey: [`/api/demands/${demandId}`] });
      setComments("");
      setShowComments(false);
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao solicitar mudanças",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  if (!requiresReview) {
    return null;
  }

  if (documentStatus !== "UNDER_REVIEW") {
    return (
      <div className="neo-card p-4">
        <div className="flex items-center gap-3">
          <DocumentStatusBadge status={documentStatus as any} />
          <span className="font-mono text-sm text-[var(--foreground-muted)]">
            {documentStatus === "DRAFT" && "Documento em rascunho"}
            {documentStatus === "APPROVED" && "Documento aprovado, pronto para finalizar"}
            {documentStatus === "FINAL" && "Documento finalizado"}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="neo-card">
      <div className="p-4 border-b-2 border-[var(--border)] bg-[var(--muted)]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-[var(--accent-cyan)] flex items-center justify-center">
              <MessageSquare className="w-4 h-4 text-[var(--background)]" />
            </div>
            <span className="font-mono text-sm font-bold">PAINEL DE REVISÃO</span>
          </div>
          <DocumentStatusBadge status="UNDER_REVIEW" />
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Comentários */}
        <div>
          <label className="font-mono text-xs font-bold mb-2 block">
            COMENTÁRIOS (OPCIONAL)
          </label>
          <Textarea
            value={comments}
            onChange={(e) => setComments(e.target.value)}
            placeholder="Adicione seus comentários sobre o documento..."
            className="terminal-input min-h-[100px]"
          />
        </div>

        {/* Ações */}
        <div className="flex gap-3">
          <button
            onClick={() => approveMutation.mutate()}
            disabled={approveMutation.isPending}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-[var(--accent-lime)] text-[var(--background)] font-mono text-sm font-bold hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            <CheckCircle className="w-4 h-4" />
            {approveMutation.isPending ? "APROVANDO..." : "APROVAR"}
          </button>
          <button
            onClick={() => requestChangesMutation.mutate()}
            disabled={requestChangesMutation.isPending}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 border-2 border-[var(--accent-orange)] text-[var(--accent-orange)] font-mono text-sm font-bold hover:bg-[var(--accent-orange)] hover:text-[var(--background)] transition-colors disabled:opacity-50"
          >
            <XCircle className="w-4 h-4" />
            {requestChangesMutation.isPending ? "SOLICITANDO..." : "SOLICITAR MUDANÇAS"}
          </button>
        </div>

        {/* Histórico de revisões */}
        {reviews && reviews.length > 0 && (
          <div className="mt-6 pt-4 border-t-2 border-[var(--border)]">
            <h4 className="font-mono text-xs font-bold mb-3">HISTÓRICO DE REVISÕES</h4>
            <div className="space-y-2">
              {reviews.map((review: any) => (
                <div
                  key={review.id}
                  className="p-3 border border-[var(--border)] bg-[var(--muted)]"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-mono text-xs font-bold">
                      {review.reviewerName || "Revisor"}
                    </span>
                    <span
                      className="brutal-badge text-[9px]"
                      style={{
                        color: review.action === "APPROVED"
                          ? "var(--accent-lime)"
                          : "var(--accent-orange)",
                        borderColor: review.action === "APPROVED"
                          ? "var(--accent-lime)"
                          : "var(--accent-orange)",
                      }}
                    >
                      {review.action === "APPROVED" ? "APROVADO" : "MUDANÇAS SOLICITADAS"}
                    </span>
                  </div>
                  {review.comments && (
                    <p className="font-mono text-xs text-[var(--foreground-muted)]">
                      {review.comments}
                    </p>
                  )}
                  <span className="font-mono text-[10px] text-[var(--foreground-muted)] mt-2 block">
                    {new Date(review.createdAt).toLocaleString('pt-BR')}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
```

**3. Request Review Button:**

```typescript
// client/src/components/request-review-button.tsx

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { UserCheck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface RequestReviewButtonProps {
  demandId: number;
  documentStatus: string;
  requiresReview: boolean;
}

export function RequestReviewButton({
  demandId,
  documentStatus,
  requiresReview
}: RequestReviewButtonProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [reviewerEmail, setReviewerEmail] = useState("");
  const [reviewerName, setReviewerName] = useState("");

  const requestReviewMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/demands/${demandId}/request-review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reviewerEmail, reviewerName }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Erro ao solicitar revisão");
      }
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Revisão solicitada com sucesso!" });
      queryClient.invalidateQueries({ queryKey: [`/api/demands/${demandId}`] });
      setIsOpen(false);
      setReviewerEmail("");
      setReviewerName("");
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao solicitar revisão",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  if (!requiresReview || documentStatus !== "DRAFT") {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <button className="cmd-button flex items-center gap-2">
          <UserCheck className="w-4 h-4" />
          <span>SOLICITAR REVISÃO</span>
        </button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="font-mono text-lg font-bold">
            SOLICITAR REVISÃO
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div>
            <label className="font-mono text-xs font-bold mb-2 block">
              NOME DO REVISOR
            </label>
            <Input
              value={reviewerName}
              onChange={(e) => setReviewerName(e.target.value)}
              placeholder="Ex: João Silva"
              className="terminal-input"
            />
          </div>

          <div>
            <label className="font-mono text-xs font-bold mb-2 block">
              EMAIL DO REVISOR (OPCIONAL)
            </label>
            <Input
              type="email"
              value={reviewerEmail}
              onChange={(e) => setReviewerEmail(e.target.value)}
              placeholder="Ex: joao@empresa.com"
              className="terminal-input"
            />
          </div>

          <div className="p-3 border border-[var(--accent-cyan)] bg-[var(--muted)]">
            <p className="font-mono text-xs text-[var(--foreground-muted)]">
              O documento será enviado para revisão e ficará bloqueado até aprovação.
              O revisor poderá aprovar ou solicitar mudanças.
            </p>
          </div>

          <button
            onClick={() => requestReviewMutation.mutate()}
            disabled={!reviewerName || requestReviewMutation.isPending}
            className="cmd-button w-full disabled:opacity-50"
          >
            {requestReviewMutation.isPending ? "ENVIANDO..." : "ENVIAR PARA REVISÃO"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

---

## 📊 Métricas e Monitoramento

### Queries para Métricas

```sql
-- 1. Taxa de adoção de revisão
SELECT
  COUNT(CASE WHEN requires_human_review = 1 THEN 1 END) * 100.0 / COUNT(*) as adoption_rate
FROM demands
WHERE created_at >= datetime('now', '-30 days');

-- 2. Tempo médio até aprovação
SELECT
  AVG(CAST((julianday(reviewed_at) - julianday(review_requested_at)) * 24 * 60 AS INTEGER)) as avg_minutes
FROM demands
WHERE document_status = 'APPROVED'
  AND review_requested_at IS NOT NULL
  AND reviewed_at IS NOT NULL;

-- 3. Taxa de retrabalho pós-finalização
SELECT
  COUNT(CASE WHEN event_type = 'document_reopened_after_final' THEN 1 END) * 100.0 /
  COUNT(CASE WHEN event_type = 'document_finalized' THEN 1 END) as rework_rate
FROM document_metrics
WHERE timestamp >= datetime('now', '-30 days');

-- 4. Média de comentários por revisão
SELECT
  AVG(comment_count) as avg_comments
FROM (
  SELECT demand_id, COUNT(*) as comment_count
  FROM document_reviews
  WHERE created_at >= datetime('now', '-30 days')
  GROUP BY demand_id
);

-- 5. Taxa de conflitos
SELECT
  COUNT(CASE WHEN event_type = 'conflict_detected' THEN 1 END) * 100.0 /
  COUNT(CASE WHEN event_type = 'review_requested' THEN 1 END) as conflict_rate
FROM document_metrics
WHERE timestamp >= datetime('now', '-30 days');
```

### Dashboard de Métricas

```typescript
// client/src/pages/governance-metrics.tsx

import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, Clock, RefreshCw, MessageSquare, AlertTriangle } from "lucide-react";

export function GovernanceMetrics() {
  const { data: metrics } = useQuery({
    queryKey: ["/api/governance/metrics"],
    refetchInterval: 60000, // Atualiza a cada minuto
  });

  if (!metrics) return <div>Carregando métricas...</div>;

  return (
    <div className="space-y-6">
      <h1 className="font-mono text-2xl font-bold">MÉTRICAS DE GOVERNANÇA</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Taxa de Adoção */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-mono text-sm">
              <TrendingUp className="w-4 h-4" />
              TAXA DE ADOÇÃO
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{metrics.adoptionRate.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground mt-1">
              Documentos com revisão obrigatória
            </p>
          </CardContent>
        </Card>

        {/* Tempo até Aprovação */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-mono text-sm">
              <Clock className="w-4 h-4" />
              TEMPO ATÉ APROVAÇÃO
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{metrics.avgTimeToApproval}min</div>
            <p className="text-xs text-muted-foreground mt-1">
              Média dos últimos 30 dias
            </p>
          </CardContent>
        </Card>

        {/* Taxa de Retrabalho */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-mono text-sm">
              <RefreshCw className="w-4 h-4" />
              TAXA DE RETRABALHO
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{metrics.reworkRate.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground mt-1">
              Documentos reabertos após finalização
            </p>
          </CardContent>
        </Card>

        {/* Comentários por Revisão */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-mono text-sm">
              <MessageSquare className="w-4 h-4" />
              COMENTÁRIOS/REVISÃO
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{metrics.avgComments.toFixed(1)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Média de feedback por documento
            </p>
          </CardContent>
        </Card>

        {/* Taxa de Conflitos */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-mono text-sm">
              <AlertTriangle className="w-4 h-4" />
              TAXA DE CONFLITOS
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{metrics.conflictRate.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground mt-1">
              Conflitos de concorrência detectados
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
```

---

## 🧪 Testes

### Testes Unitários

```typescript
// server/__tests__/document-state-machine.test.ts

import { describe, it, expect } from 'vitest';
import { DocumentStateMachine } from '../services/document-state-machine';

describe('DocumentStateMachine', () => {
  describe('canTransition', () => {
    it('permite finalizar direto quando não requer revisão', () => {
      expect(
        DocumentStateMachine.canTransition('DRAFT', 'FINAL', false)
      ).toBe(true);
    });

    it('bloqueia finalização direta quando requer revisão', () => {
      expect(
        DocumentStateMachine.canTransition('DRAFT', 'FINAL', true)
      ).toBe(false);
    });

    it('permite solicitar revisão quando requer', () => {
      expect(
        DocumentStateMachine.canTransition('DRAFT', 'UNDER_REVIEW', true)
      ).toBe(true);
    });

    it('permite aprovar de UNDER_REVIEW', () => {
      expect(
        DocumentStateMachine.canTransition('UNDER_REVIEW', 'APPROVED', true)
      ).toBe(true);
    });

    it('permite solicitar mudanças de UNDER_REVIEW', () => {
      expect(
        DocumentStateMachine.canTransition('UNDER_REVIEW', 'DRAFT', true)
      ).toBe(true);
    });
  });

  describe('validateTransition', () => {
    it('retorna erro para transição inválida', () => {
      const result = DocumentStateMachine.validateTransition(
        'DRAFT',
        'finalize',
        true
      );
      expect(result.valid).toBe(false);
      expect(result.error).toContain('não permitido');
    });

    it('retorna sucesso para transição válida', () => {
      const result = DocumentStateMachine.validateTransition(
        'DRAFT',
        'request_review',
        true
      );
      expect(result.valid).toBe(true);
      expect(result.targetState).toBe('UNDER_REVIEW');
    });
  });

  describe('getNextActions', () => {
    it('retorna ações corretas para DRAFT sem revisão', () => {
      const actions = DocumentStateMachine.getNextActions('DRAFT', false);
      expect(actions).toContain('finalize');
      expect(actions).not.toContain('request_review');
    });

    it('retorna ações corretas para DRAFT com revisão', () => {
      const actions = DocumentStateMachine.getNextActions('DRAFT', true);
      expect(actions).toContain('request_review');
      expect(actions).not.toContain('finalize');
    });

    it('retorna ações corretas para UNDER_REVIEW', () => {
      const actions = DocumentStateMachine.getNextActions('UNDER_REVIEW', true);
      expect(actions).toContain('approve');
      expect(actions).toContain('request_changes');
    });
  });
});
```

```typescript
// server/__tests__/document-snapshot.test.ts

import { describe, it, expect } from 'vitest';
import { DocumentSnapshotService } from '../services/document-snapshot';

describe('DocumentSnapshotService', () => {
  const mockDemand = {
    id: 1,
    title: 'Test Demand',
    description: 'Test Description',
    type: 'feature',
    priority: 'high',
    prdContent: '# PRD Content',
    tasksContent: '# Tasks Content',
  };

  describe('createSnapshot', () => {
    it('cria snapshot com hash', () => {
      const snapshot = DocumentSnapshotService.createSnapshot(mockDemand as any);

      expect(snapshot).toHaveProperty('hash');
      expect(snapshot).toHaveProperty('prdContent');
      expect(snapshot).toHaveProperty('tasksContent');
      expect(snapshot).toHaveProperty('metadata');
      expect(snapshot).toHaveProperty('timestamp');
    });

    it('gera hash consistente para mesmo conteúdo', () => {
      const snapshot1 = DocumentSnapshotService.createSnapshot(mockDemand as any);
      const snapshot2 = DocumentSnapshotService.createSnapshot(mockDemand as any);

      // Hashes devem ser diferentes por causa do timestamp
      expect(snapshot1.hash).not.toBe(snapshot2.hash);
    });
  });

  describe('verifySnapshot', () => {
    it('verifica snapshot válido', () => {
      const snapshot = DocumentSnapshotService.createSnapshot(mockDemand as any);
      expect(DocumentSnapshotService.verifySnapshot(snapshot)).toBe(true);
    });

    it('detecta snapshot adulterado', () => {
      const snapshot = DocumentSnapshotService.createSnapshot(mockDemand as any);
      snapshot.prdContent = 'Modified content';

      expect(DocumentSnapshotService.verifySnapshot(snapshot)).toBe(false);
    });
  });

  describe('compareSnapshots', () => {
    it('identifica snapshots idênticos', () => {
      const snapshot = DocumentSnapshotService.createSnapshot(mockDemand as any);

      expect(
        DocumentSnapshotService.compareSnapshots(snapshot, snapshot)
      ).toBe(true);
    });

    it('identifica snapshots diferentes', () => {
      const snapshot1 = DocumentSnapshotService.createSnapshot(mockDemand as any);
      const modifiedDemand = { ...mockDemand, title: 'Modified' };
      const snapshot2 = DocumentSnapshotService.createSnapshot(modifiedDemand as any);

      expect(
        DocumentSnapshotService.compareSnapshots(snapshot1, snapshot2)
      ).toBe(false);
    });
  });
});
```

### Testes de Integração

```typescript
// server/__tests__/governance-flow.test.ts

import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../index';
import { db } from '../db';

describe('Governance Flow Integration', () => {
  let demandId: number;

  beforeEach(async () => {
    // Criar demanda de teste
    const response = await request(app)
      .post('/api/demands')
      .send({
        title: 'Test Demand',
        description: 'Test Description',
        type: 'feature',
        priority: 'high',
        requiresHumanReview: true,
      });

    demandId = response.body.id;
  });

  it('fluxo completo: draft -> review -> approve -> final', async () => {
    // 1. Solicitar revisão
    const reviewResponse = await request(app)
      .post(`/api/demands/${demandId}/request-review`)
      .send({
        reviewerEmail: 'reviewer@test.com',
        reviewerName: 'Test Reviewer',
      });

    expect(reviewResponse.status).toBe(200);
    expect(reviewResponse.body.documentStatus).toBe('UNDER_REVIEW');

    // 2. Aprovar
    const approveResponse = await request(app)
      .post(`/api/demands/${demandId}/approve`)
      .send({
        comments: 'Looks good!',
      });

    expect(approveResponse.status).toBe(200);
    expect(approveResponse.body.documentStatus).toBe('APPROVED');

    // 3. Finalizar
    const finalizeResponse = await request(app)
      .post(`/api/demands/${demandId}/finalize`);

    expect(finalizeResponse.status).toBe(200);
    expect(finalizeResponse.body.documentStatus).toBe('FINAL');
  });

  it('bloqueia finalização direta quando requer revisão', async () => {
    const response = await request(app)
      .post(`/api/demands/${demandId}/finalize`);

    expect(response.status).toBe(409);
    expect(response.body.error).toContain('requer revisão');
  });

  it('permite solicitar mudanças', async () => {
    // Solicitar revisão
    await request(app)
      .post(`/api/demands/${demandId}/request-review`)
      .send({
        reviewerEmail: 'reviewer@test.com',
        reviewerName: 'Test Reviewer',
      });

    // Solicitar mudanças
    const response = await request(app)
      .post(`/api/demands/${demandId}/request-changes`)
      .send({
        comments: 'Please fix X',
      });

    expect(response.status).toBe(200);
    expect(response.body.documentStatus).toBe('DRAFT');
  });

  it('detecta conflito de snapshot', async () => {
    // Solicitar revisão
    const reviewResponse = await request(app)
      .post(`/api/demands/${demandId}/request-review`)
      .send({
        reviewerEmail: 'reviewer@test.com',
        reviewerName: 'Test Reviewer',
      });

    const snapshotHash = reviewResponse.body.snapshotHash;

    // Modificar documento (simular edição concorrente)
    await db.update(demands)
      .set({ prdContent: 'Modified content' })
      .where(eq(demands.id, demandId));

    // Tentar aprovar com hash antigo
    const approveResponse = await request(app)
      .post(`/api/demands/${demandId}/approve`)
      .send({
        comments: 'Approved',
        snapshotHash: snapshotHash,
      });

    expect(approveResponse.status).toBe(409);
    expect(approveResponse.body.error).toContain('Conflito');
  });
});
```

---

## 📝 Checklist de Implementação

### Fase 1: Backend Core (Semana 1)
- [ ] Criar migrations para novas tabelas
- [ ] Implementar `DocumentStateMachine`
- [ ] Implementar `DocumentSnapshotService`
- [ ] Criar endpoints de API
- [ ] Testes unitários (>80% cobertura)

### Fase 2: Frontend Components (Semana 2)
- [ ] Criar `DocumentStatusBadge`
- [ ] Criar `ReviewPanel`
- [ ] Criar `RequestReviewButton`
- [ ] Integrar com `DocumentViewer`
- [ ] Testes de componentes

### Fase 3: Integração e Testes (Semana 3)
- [ ] Testes de integração end-to-end
- [ ] Testes de concorrência
- [ ] Validação de UX
- [ ] Documentação de usuário

### Fase 4: Métricas e Monitoramento (Semana 4)
- [ ] Implementar coleta de métricas
- [ ] Criar dashboard de governança
- [ ] Configurar alertas
- [ ] Baseline de métricas

### Fase 5: Rollout (Semana 5)
- [ ] Deploy em staging
- [ ] Testes com usuários beta
- [ ] Ajustes baseados em feedback
- [ ] Deploy em produção
- [ ] Monitoramento pós-deploy

---

## 🚀 Plano de Rollout

### Fase 1: Beta Fechado (2 semanas)
- 10 usuários selecionados
- Feature flag: `governance_enabled`
- Coleta intensiva de feedback
- Métricas baseline

### Fase 2: Beta Aberto (2 semanas)
- Todos os usuários podem ativar
- Opt-in por documento
- Refinamento baseado em dados
- Documentação completa

### Fase 3: GA (General Availability)
- Feature disponível para todos
- Métricas de sucesso validadas
- Suporte completo
- Marketing e comunicação

---

## 📚 Documentação de Usuário

### Como Usar Governança Humana

**1. Ativar Revisão Obrigatória:**
- Ao criar/editar demanda, marque "Requer Revisão Humana"
- Documento não poderá ser finalizado sem aprovação

**2. Solicitar Revisão:**
- Clique em "Solicitar Revisão"
- Informe nome e email do revisor
- Documento entra em estado "Em Revisão"

**3. Revisar Documento:**
- Revisor acessa documento em modo read-only
- Adiciona comentários (opcional)
- Aprova ou solicita mudanças

**4. Finalizar:**
- Após aprovação, documento pode ser finalizado
- Conteúdo aprovado é preservado

### FAQ

**P: O que acontece se eu editar o documento durante a revisão?**
R: O sistema detectará o conflito e pedirá para o revisor recarregar a página.

**P: Posso desativar a revisão depois de ativada?**
R: Não no MVP. Uma vez ativada, a revisão é obrigatória para aquele documento.

**P: Quantos revisores posso ter?**
R: No MVP, apenas um revisor por vez.

**P: O histórico de revisões é mantido?**
R: Sim, todas as revisões ficam registradas no histórico do documento.

---

**Documento preparado por:** Tech Lead
**Data:** 01 de Maio de 2026
**Versão:** 1.0
**Status:** Pronto para Implementação
