import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle, XCircle, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ApprovalActionsProps {
  demandId: number;
  reviewSnapshotId: string;
  documentState: "DRAFT" | "UNDER_REVIEW" | "APPROVED" | "FINAL" | "APPROVAL_REQUIRED";
  onApprovalComplete?: () => void;
}

export function ApprovalActions({
  demandId,
  reviewSnapshotId,
  documentState,
  onApprovalComplete,
}: ApprovalActionsProps) {
  const [comments, setComments] = useState("");
  const [isApproving, setIsApproving] = useState(false);
  const [isRequestingChanges, setIsRequestingChanges] = useState(false);
  const { toast } = useToast();
  const isUnderReview = documentState === "UNDER_REVIEW" || documentState === "APPROVAL_REQUIRED";

  // Only show actions while the review snapshot is awaiting a human decision.
  if (!isUnderReview) {
    return null;
  }

  const handleApprove = async () => {
    setIsApproving(true);
    try {
      const response = await fetch(`/api/governance/demands/${demandId}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reviewSnapshotId,
          comments: comments.trim() || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.error?.includes("SNAPSHOT_OUTDATED")) {
          toast({
            title: "Snapshot Desatualizado",
            description: "A versão em revisão mudou. Por favor, recarregue a página.",
            variant: "destructive",
          });
          return;
        }
        throw new Error(data.error || "Falha ao aprovar documento");
      }

      toast({
          title: "Documento Aprovado",
          description: "O documento foi aprovado e finalizado a partir do snapshot revisado.",
      });

      setComments("");
      onApprovalComplete?.();
    } catch (error) {
      console.error("Error approving document:", error);
      toast({
        title: "Erro ao Aprovar",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive",
      });
    } finally {
      setIsApproving(false);
    }
  };

  const handleRequestChanges = async () => {
    setIsRequestingChanges(true);
    try {
      const response = await fetch(`/api/governance/demands/${demandId}/request-changes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reviewSnapshotId,
          comments: comments.trim() || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Falha ao solicitar ajustes");
      }

      toast({
        title: "Ajustes Solicitados",
        description: "O documento voltou para rascunho para uma nova rodada.",
      });

      setComments("");
      onApprovalComplete?.();
    } catch (error) {
      console.error("Error requesting changes:", error);
      toast({
        title: "Erro ao Solicitar Ajustes",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive",
      });
    } finally {
      setIsRequestingChanges(false);
    }
  };

  return (
    <div className="space-y-4 p-4 border rounded-lg bg-white">
      <h3 className="font-semibold text-lg">Ações de Aprovação</h3>

      <div className="space-y-2">
        <label htmlFor="approval-comments" className="text-sm font-medium">
          Comentários (opcional)
        </label>
        <Textarea
          id="approval-comments"
          placeholder="Adicione comentários sobre a revisão..."
          value={comments}
          onChange={(e) => setComments(e.target.value)}
          rows={4}
          className="resize-none"
        />
      </div>

      <div className="flex gap-3">
        <Button
          onClick={handleApprove}
          disabled={isApproving || isRequestingChanges}
          className="flex-1"
          variant="default"
        >
          {isApproving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Aprovando...
            </>
          ) : (
            <>
              <CheckCircle className="mr-2 h-4 w-4" />
              Aprovar e Finalizar
            </>
          )}
        </Button>

        <Button
          onClick={handleRequestChanges}
          disabled={isApproving || isRequestingChanges}
          className="flex-1"
          variant="outline"
        >
          {isRequestingChanges ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Solicitando...
            </>
          ) : (
            <>
              <XCircle className="mr-2 h-4 w-4" />
              Solicitar Ajustes
            </>
          )}
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">
        <strong>Aprovar e Finalizar:</strong> usa exatamente o snapshot revisado como fonte final.
        <br />
        <strong>Solicitar Ajustes:</strong> devolve o documento para rascunho com o feedback registrado.
      </p>
    </div>
  );
}
