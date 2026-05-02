import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, Loader2, FileText, Eye, EyeOff, ExternalLink } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import MDEditor from "@uiw/react-md-editor";
import { useEnhancedTheme } from "@/components/ui/theme-provider";
import { TypeAdherenceBadge, TypeAdherenceBadgeCompact } from "./type-adherence-badge";
import { ReviewBanner } from "./governance/ReviewBanner";
import { ApprovalActions } from "./governance/ApprovalActions";
import { ApprovalComments } from "./governance/ApprovalComments";

interface TypeAdherenceResult {
  isAdherent: boolean;
  type: 'technical' | 'business' | null;
  sectionsFound: string[];
  sectionsRequired: number;
  sectionsMet: number;
  score: number;
  feedback: string;
}

interface DocumentViewerProps {
  demandId: number;
  documentType: "prd" | "tasks";
  pdfUrl?: string;
  refinementType?: 'technical' | 'business' | null;
  typeAdherence?: TypeAdherenceResult | null;
  documentState?: "DRAFT" | "APPROVAL_REQUIRED" | "FINAL";
  reviewSnapshotId?: string;
  snapshotHash?: string;
  approvalSessionId?: string;
}

export function DocumentViewer({
  demandId,
  documentType,
  pdfUrl,
  refinementType,
  typeAdherence,
  documentState = "DRAFT",
  reviewSnapshotId,
  snapshotHash,
  approvalSessionId
}: DocumentViewerProps) {
  const { toast } = useToast();
  const [isExpanded, setIsExpanded] = useState(false);
  const { isDarkMode } = useEnhancedTheme();
  const queryClient = useQueryClient();

  const { data: markdownContent, isLoading, error } = useQuery({
    queryKey: [`/api/demands/${demandId}/documents/${documentType}`],
    queryFn: async () => {
      const response = await fetch(`/api/demands/${demandId}/documents/${documentType}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch ${documentType} document`);
      }
      const data = await response.json();
      return data.content;
    },
    enabled: isExpanded,
  });

  const handleApprovalComplete = () => {
    queryClient.invalidateQueries({ queryKey: ['/api/demands'] });
  };

  const handleDownloadPDF = () => {
    if (pdfUrl) {
      window.open(pdfUrl, '_blank');
      toast({
        title: "Download iniciado",
        description: `${documentType.toUpperCase()} está sendo baixado.`,
      });
    } else {
      toast({
        title: "Não disponível",
        description: `O documento ainda não foi gerado.`,
        variant: "destructive",
      });
    }
  };

  const documentConfig = documentType === "prd"
    ? { title: "PRD EXECUTIVO", code: "PRD", color: "var(--accent-cyan)" }
    : { title: "TASKS DOCUMENT", code: "TASKS", color: "var(--accent-lime)" };

  // Collapsed View
  if (!isExpanded) {
    return (
      <div className="neo-card">
        <div className="p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 flex items-center justify-center border-2"
              style={{ borderColor: documentConfig.color }}
            >
              <FileText className="w-5 h-5" style={{ color: documentConfig.color }} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm font-bold">{documentConfig.title}</span>
                {documentType === "prd" && (
                  <TypeAdherenceBadgeCompact
                    typeAdherence={typeAdherence}
                    refinementType={refinementType}
                  />
                )}
              </div>
              <p className="font-mono text-xs text-[var(--foreground-muted)]">
                Clique para visualizar
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setIsExpanded(true)}
              className="flex items-center gap-2 px-3 py-2 border-2 font-mono text-xs font-bold transition-all hover:-translate-x-0.5 hover:-translate-y-0.5"
              style={{
                borderColor: documentConfig.color,
                color: documentConfig.color
              }}
            >
              <Eye className="w-4 h-4" />
              <span>VER</span>
            </button>
            {pdfUrl && (
              <button
                onClick={handleDownloadPDF}
                className="flex items-center gap-2 px-3 py-2 font-mono text-xs font-bold transition-all hover:-translate-x-0.5 hover:-translate-y-0.5"
                style={{
                  backgroundColor: documentConfig.color,
                  color: 'var(--background)'
                }}
              >
                <Download className="w-4 h-4" />
                <span>PDF</span>
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Expanded View
  return (
    <div className="neo-card">
      {/* Header */}
      <div
        className="flex items-center justify-between p-4 border-b-2 border-[var(--border)]"
        style={{ backgroundColor: `color-mix(in srgb, ${documentConfig.color} 10%, var(--muted))` }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 flex items-center justify-center"
            style={{ backgroundColor: documentConfig.color }}
          >
            <FileText className="w-5 h-5 text-[var(--background)]" />
          </div>
          <div>
            <span className="font-mono text-sm font-bold">{documentConfig.title}</span>
            <span
              className="brutal-badge ml-2 text-[9px]"
              style={{ color: documentConfig.color, borderColor: documentConfig.color }}
            >
              {documentConfig.code}
            </span>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setIsExpanded(false)}
            className="flex items-center gap-2 px-3 py-2 border border-[var(--border)] font-mono text-xs hover:border-[var(--foreground)] transition-colors"
          >
            <EyeOff className="w-4 h-4" />
            <span className="hidden sm:inline">RECOLHER</span>
          </button>
          {pdfUrl && (
            <button
              onClick={handleDownloadPDF}
              className="flex items-center gap-2 px-3 py-2 border-2 font-mono text-xs font-bold transition-all hover:-translate-x-0.5 hover:-translate-y-0.5"
              style={{
                borderColor: documentConfig.color,
                color: documentConfig.color
              }}
            >
              <ExternalLink className="w-4 h-4" />
              <span className="hidden sm:inline">ABRIR PDF</span>
            </button>
          )}
        </div>
      </div>

      {/* Type Adherence Feedback (only for PRD) */}
      {documentType === "prd" && (refinementType || typeAdherence) && (
        <div className="p-4 border-b-2 border-[var(--border)]">
          <TypeAdherenceBadge
            typeAdherence={typeAdherence}
            refinementType={refinementType}
          />
        </div>
      )}

      {/* Governance Feedback (only for PRD) */}
      {documentType === "prd" && (
        <div className="px-4 pt-4">
          <ReviewBanner
            documentState={documentState}
            reviewSnapshotId={reviewSnapshotId}
            snapshotHash={snapshotHash}
            approvalSessionId={approvalSessionId}
          />
        </div>
      )}

      {/* Content */}
      <div className="p-4">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-16">
            <div className="w-12 h-12 border-2 border-[var(--accent-cyan)] flex items-center justify-center mb-4">
              <Loader2 className="w-6 h-6 animate-spin text-[var(--accent-cyan)]" />
            </div>
            <p className="font-mono text-sm text-[var(--foreground-muted)]">CARREGANDO DOCUMENTO...</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="w-12 h-12 border-2 border-[var(--destructive)] flex items-center justify-center mb-4">
              <span className="text-2xl">⚠</span>
            </div>
            <p className="font-mono text-sm text-[var(--destructive)] font-bold">ERRO AO CARREGAR</p>
            <p className="font-mono text-xs text-[var(--foreground-muted)] mt-2">
              {error instanceof Error ? error.message : "Erro desconhecido"}
            </p>
            <button
              onClick={() => setIsExpanded(false)}
              className="cmd-button mt-4"
            >
              VOLTAR
            </button>
          </div>
        ) : (
          <div
            data-color-mode={isDarkMode ? "dark" : "light"}
            className="border-2 border-[var(--border)] bg-[var(--background)]"
          >
            <MDEditor.Markdown
              source={markdownContent || "Sem conteúdo disponível"}
              style={{
                padding: 24,
                minHeight: 400,
                backgroundColor: 'transparent',
                fontFamily: "'Space Grotesk', sans-serif",
                color: 'var(--foreground)'
              }}
              remarkPlugins={[]}
              rehypePlugins={[]}
            />
          </div>
        )}
      </div>

      {/* Governance Actions (only for PRD when expanded) */}
      {isExpanded && documentType === "prd" && documentState === "APPROVAL_REQUIRED" && (
        <div className="p-4 border-t-2 border-[var(--border)] bg-[var(--muted)] space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ApprovalActions
              demandId={demandId}
              documentState={documentState}
              reviewSnapshotId={reviewSnapshotId || ""}
              onApprovalComplete={handleApprovalComplete}
            />
            <ApprovalComments demandId={demandId} />
          </div>
        </div>
      )}

      {/* History of comments (for PRD when expanded and in FINAL state) */}
      {isExpanded && documentType === "prd" && documentState === "FINAL" && (
        <div className="p-4 border-t-2 border-[var(--border)] bg-[var(--muted)]">
          <ApprovalComments demandId={demandId} />
        </div>
      )}
    </div>
  );
}
