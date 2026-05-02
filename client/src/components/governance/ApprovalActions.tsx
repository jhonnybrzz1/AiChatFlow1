import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle, XCircle, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ApprovalActionsProps {
  demandId: number;
  reviewSnapshotId: string;
  documentState: "DRAFT" | "APPROVAL_REQUIRED" | "FINAL";
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
  const [isFinalizing, setIsFinalizing] = useState(false);
  const { toast } = useToast();

  // Only show actions if in APPROVAL_REQUIRED state
  if (documentState !== "APPROVAL_REQUIRED") {
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
        description: "O documento foi aprovado com sucesso. Agora você pode finalizá-lo.",
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

  const handleFinalize = async () => {
    setIsFinalizing(true);
    try {
      const response = await fetch(`/api/governance/demands/${demandId}/finalize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}), // Empty body - no content fields allowed
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Falha ao finalizar documento");
      }

      toast({
        title: "Documento Finalizado",
        description: "O documento foi finalizado com sucesso e está agora bloqueado.",
      });

      onApprovalComplete?.();
    } catch (error) {
      console.error("Error finalizing document:", error);
      toast({
        title: "Erro ao Finalizar",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive",
      });
    } finally {
      setIsFinalizing(false);
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
          disabled={isApproving || isFinalizing}
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
              Aprovar
            </>
          )}
        </Button>

        <Button
          onClick={handleFinalize}
          disabled={isApproving || isFinalizing}
          className="flex-1"
          variant="outline"
        >
          {isFinalizing ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Finalizando...
            </>
          ) : (
            <>
              <CheckCircle className="mr-2 h-4 w-4" />
              Aprovar e Finalizar
            </>
          )}
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">
        <strong>Aprovar:</strong> Marca o documento como aprovado, mas mantém em revisão.
        <br />
        <strong>Aprovar e Finalizar:</strong> Aprova e finaliza o documento em uma única ação.
      </p>
    </div>
  );
}
