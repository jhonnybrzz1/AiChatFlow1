import { useState, useEffect, useRef, type UIEvent } from "react";
import { Progress } from "@/components/ui/progress";
import { MessageCircle, Bot, Loader2, StopCircle, Download, CheckCircle, XCircle, FileJson, FileText, Copy, Terminal, Cpu } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { type Demand, type ChatMessage } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import RefinementDialog from "./refinement-dialog";
import { MessageCategoryBadge } from "./message-category";
import { cn } from "@/lib/utils";
import { DocumentViewer } from "./document-viewer";
import { RefinementAgentMessagePlainText } from "./refinement-agent-message-plain-text";
import { trackRefinementEvent } from "@/lib/refinement-telemetry";

const agentConfig: Record<string, { icon: string; color: string; name: string }> = {
  refinador: { icon: "🧠", color: "var(--accent-violet)", name: "Refinador" },
  scrum_master: { icon: "🧝", color: "var(--accent-lime)", name: "Scrum Master" },
  qa: { icon: "✅", color: "var(--success)", name: "QA" },
  ux: { icon: "🎨", color: "var(--accent-magenta)", name: "UX Designer" },
  analista_de_dados: { icon: "📈", color: "var(--accent-orange)", name: "Analista de Dados" },
  tech_lead: { icon: "💧", color: "var(--accent-cyan)", name: "Tech Lead" },
  pm: { icon: "📋", color: "var(--accent-gold)", name: "Product Manager" },
};

interface ChatAreaProps {
  selectedDemand?: Demand | null;
}

export function ChatArea({ selectedDemand: propSelectedDemand }: ChatAreaProps) {
  const [selectedDemand, setSelectedDemand] = useState<Demand | null>(null);
  const [progress, setProgress] = useState(0);
  const [refinementDialog, setRefinementDialog] = useState<{
    isOpen: boolean;
    agent: string;
    header: string;
    message: string;
    messageId?: string;
    stageId?: string;
  }>({ isOpen: false, agent: '', header: '', message: '' });
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const lastScrollTopRef = useRef(0);
  const lastAgentRenderRef = useRef<{
    messageId: string;
    stageId: string;
    renderedAt: number;
    scrollTracked: boolean;
  } | null>(null);

  const { data: demands = [] } = useQuery({
    queryKey: ['/api/demands'],
    queryFn: () => api.demands.getAll(),
    refetchInterval: 2000,
  });

  const processingDemand = demands.find(d => d.status === 'processing') || null;

  const stopProcessingMutation = useMutation({
    mutationFn: async (demandId: number) => {
      return await apiRequest('POST', `/api/demands/${demandId}/stop`);
    },
    onSuccess: () => {
      toast({
        title: "Refinamento interrompido",
        description: "O processo foi interrompido com sucesso.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/demands'] });
    },
    onError: () => {
      toast({
        title: "Erro ao interromper",
        description: "Não foi possível interromper o refinamento.",
        variant: "destructive",
      });
    },
  });

  useEffect(() => {
    if (processingDemand) {
      setSelectedDemand(processingDemand);
      const totalAgents = 7;
      const completedMessages = processingDemand.chatMessages?.filter(m => m.type === 'completed').length || 0;
      setProgress((completedMessages / totalAgents) * 100);

      const unsubscribe = api.demands.subscribeToUpdates(processingDemand.id, (updatedDemand) => {
        setSelectedDemand(updatedDemand);
        const newCompletedMessages = updatedDemand.chatMessages?.filter(m => m.type === 'completed').length || 0;
        setProgress((newCompletedMessages / totalAgents) * 100);
        setProgress(prev => prev + 0.001);
      });

      return unsubscribe;
    } else if (propSelectedDemand) {
      setSelectedDemand(propSelectedDemand);
      const totalAgents = 7;
      const completedMessages = propSelectedDemand.chatMessages?.filter(m => m.type === 'completed').length || 0;
      setProgress((completedMessages / totalAgents) * 100);
    }
  }, [processingDemand?.id, propSelectedDemand?.id]);

  const chatMessages = selectedDemand?.chatMessages || [];

  useEffect(() => {
    const latestMessage = chatMessages[chatMessages.length - 1];
    if (!selectedDemand || !latestMessage) return;

    lastAgentRenderRef.current = {
      messageId: latestMessage.id,
      stageId: `${selectedDemand.id}:${latestMessage.agent}`,
      renderedAt: Date.now(),
      scrollTracked: false,
    };
  }, [chatMessages.length, selectedDemand?.id]);

  const handleDownloadDocument = (url: string) => {
    window.open(url, '_blank');
  };

  const handleExportJSON = () => {
    if (!selectedDemand) return;
    window.open(`/api/demands/${selectedDemand.id}/export/json`, '_blank');
  };

  const handleExportTXT = () => {
    if (!selectedDemand) return;
    window.open(`/api/demands/${selectedDemand.id}/export/txt`, '_blank');
  };

  const handleCopyChat = async () => {
    if (!selectedDemand || chatMessages.length === 0) return;

    let chatContent = `HISTÓRICO DE DIÁLOGO - DEMANDA #${selectedDemand.id}\n`;
    chatContent += `${'═'.repeat(60)}\n\n`;
    chatContent += `Título: ${selectedDemand.title}\n`;
    chatContent += `Tipo: ${selectedDemand.type}\n`;
    chatContent += `Status: ${selectedDemand.status}\n\n`;
    chatContent += `${'─'.repeat(60)}\n`;
    chatContent += `MENSAGENS\n`;
    chatContent += `${'─'.repeat(60)}\n\n`;

    chatMessages.forEach((message, index) => {
      const config = agentConfig[message.agent] || { name: message.agent };
      const timestamp = new Date(message.timestamp).toLocaleTimeString('pt-BR');
      chatContent += `[${index + 1}] ${config.name} @ ${timestamp}\n`;
      chatContent += `${message.message}\n\n`;
    });

    try {
      await navigator.clipboard.writeText(chatContent);
      toast({ title: "Copiado", description: "Diálogo copiado para a área de transferência." });
    } catch {
      toast({ title: "Erro", description: "Não foi possível copiar.", variant: "destructive" });
    }
  };

  const openRefinementDialog = (agent: string, message: string, messageId: string, stageId: string) => {
    const config = agentConfig[agent] || { name: agent };
    trackRefinementEvent("refinement_next_action_clicked", {
      messageId,
      stageId,
      clickedAt: Date.now(),
    });

    setRefinementDialog({
      isOpen: true,
      agent,
      header: `Refinamento de ${config.name}`,
      message,
      messageId,
      stageId,
    });
  };

  const closeRefinementDialog = () => {
    setRefinementDialog({ isOpen: false, agent: '', header: '', message: '' });
  };

  const handleApplyRefinement = () => {
    const config = agentConfig[refinementDialog.agent] || { name: refinementDialog.agent };
    if (refinementDialog.messageId) {
      trackRefinementEvent("refinement_next_action_clicked", {
        messageId: refinementDialog.messageId,
        stageId: refinementDialog.stageId,
        clickedAt: Date.now(),
      });
    }

    toast({ title: "Refinamento aplicado", description: `Refinamento do ${config.name} aplicado.` });
    closeRefinementDialog();
  };

  const handleClarityFeedback = (clarityValue: "yes" | "no") => {
    if (!refinementDialog.messageId) return;

    trackRefinementEvent("refinement_clarity_prompt_answered", {
      messageId: refinementDialog.messageId,
      stageId: refinementDialog.stageId,
      clarityValue,
      answeredAt: Date.now(),
      qualityFlags: refinementDialog.stageId ? [] : ["missing_stage_id"],
    });

    toast({
      title: clarityValue === "yes" ? "Clareza registrada" : "Sinalização registrada",
      description: clarityValue === "yes"
        ? "Obrigado pelo feedback."
        : "Vamos usar esse sinal para melhorar as orientações.",
    });
  };

  const handleReviewLater = () => {
    closeRefinementDialog();
  };

  const getStatusConfig = () => {
    switch (selectedDemand?.status) {
      case 'processing':
        return { label: 'PROCESSANDO', color: 'var(--accent-cyan)', icon: Loader2 };
      case 'completed':
        return { label: 'COMPLETO', color: 'var(--success)', icon: CheckCircle };
      case 'stopped':
        return { label: 'INTERROMPIDO', color: 'var(--warning)', icon: StopCircle };
      case 'error':
        return { label: 'ERRO', color: 'var(--destructive)', icon: XCircle };
      default:
        return { label: 'AGUARDANDO', color: 'var(--foreground-muted)', icon: Terminal };
    }
  };

  const statusConfig = getStatusConfig();
  const StatusIcon = statusConfig.icon;

  const handleMessageScroll = (event: UIEvent<HTMLDivElement>) => {
    const currentScrollTop = event.currentTarget.scrollTop;
    const scrollDeltaPx = lastScrollTopRef.current - currentScrollTop;
    const activeMessage = lastAgentRenderRef.current;

    if (
      activeMessage &&
      !activeMessage.scrollTracked &&
      scrollDeltaPx >= 24 &&
      Date.now() - activeMessage.renderedAt <= 60_000
    ) {
      activeMessage.scrollTracked = true;
      trackRefinementEvent("refinement_scroll_up_after_agent", {
        messageId: activeMessage.messageId,
        stageId: activeMessage.stageId,
        occurred: true,
        occurredAt: Date.now(),
        scrollDeltaPx,
        qualityFlags: ["real_scroll_up_delta_met"],
      });
    }

    lastScrollTopRef.current = currentScrollTop;
  };

  return (
    <>
      {/* Chat Messages Card */}
      <div className="neo-card">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b-2 border-[var(--border)] bg-[var(--muted)]">
          <div className="flex items-center gap-3">
            <div
              className="w-8 h-8 flex items-center justify-center"
              style={{ backgroundColor: statusConfig.color }}
            >
              <MessageCircle className="w-4 h-4 text-[var(--background)]" />
            </div>
            <div>
              <h2 className="font-mono text-sm font-bold">SQUAD DE REFINAMENTO</h2>
              <div className="flex items-center gap-2 font-mono text-xs text-[var(--foreground-muted)]">
                <StatusIcon
                  className={cn("w-3 h-3", selectedDemand?.status === 'processing' && "animate-spin")}
                  style={{ color: statusConfig.color }}
                />
                <span style={{ color: statusConfig.color }}>{statusConfig.label}</span>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            {selectedDemand && chatMessages.length > 0 && (
              <>
                <button
                  onClick={handleExportJSON}
                  className="flex items-center gap-1 px-2 py-1 border border-[var(--border)] font-mono text-xs hover:border-[var(--accent-cyan)] hover:text-[var(--accent-cyan)] transition-colors"
                  title="Exportar JSON"
                >
                  <FileJson className="w-3 h-3" />
                  <span className="hidden sm:inline">JSON</span>
                </button>
                <button
                  onClick={handleExportTXT}
                  className="flex items-center gap-1 px-2 py-1 border border-[var(--border)] font-mono text-xs hover:border-[var(--accent-cyan)] hover:text-[var(--accent-cyan)] transition-colors"
                  title="Exportar TXT"
                >
                  <FileText className="w-3 h-3" />
                  <span className="hidden sm:inline">TXT</span>
                </button>
                <button
                  onClick={handleCopyChat}
                  className="flex items-center gap-1 px-2 py-1 border border-[var(--border)] font-mono text-xs hover:border-[var(--accent-cyan)] hover:text-[var(--accent-cyan)] transition-colors"
                  title="Copiar"
                >
                  <Copy className="w-3 h-3" />
                </button>
              </>
            )}
            {selectedDemand?.status === 'processing' && (
              <button
                onClick={() => stopProcessingMutation.mutate(selectedDemand.id)}
                disabled={stopProcessingMutation.isPending}
                className="flex items-center gap-1 px-3 py-1 border-2 border-[var(--destructive)] text-[var(--destructive)] font-mono text-xs font-bold hover:bg-[var(--destructive)] hover:text-[var(--background)] transition-colors"
              >
                {stopProcessingMutation.isPending ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <StopCircle className="w-3 h-3" />
                )}
                <span>PARAR</span>
              </button>
            )}
          </div>
        </div>

        {/* Messages Container */}
        <div
          className="p-4 max-h-[500px] overflow-y-auto bg-[var(--background)]"
          data-chat-area
          onScroll={handleMessageScroll}
        >
          {chatMessages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-16 h-16 border-2 border-[var(--border)] flex items-center justify-center mb-4">
                <Bot className="w-8 h-8 text-[var(--foreground-muted)]" />
              </div>
              <p className="font-mono text-sm text-[var(--foreground-muted)]">NENHUM REFINAMENTO EM ANDAMENTO</p>
              <p className="font-mono text-xs text-[var(--foreground-muted)] mt-1">
                Crie uma nova demanda para iniciar
              </p>
            </div>
          ) : (
            <div className="space-y-4 stagger-children">
              {chatMessages.map((message) => {
                const agent = agentConfig[message.agent] || { icon: "🤖", color: "var(--foreground-muted)", name: message.agent };
                const category = message.category || 'answer';
                const stageId = `${selectedDemand?.id ?? "unknown"}:${message.agent}`;

                return (
                  <div
                    key={message.id}
                    className="chat-message from-agent"
                    style={{ borderLeftColor: agent.color }}
                  >
                    <div className="flex items-start gap-4 p-4 bg-[var(--muted)]">
                      {/* Agent Avatar */}
                      <div
                        className="agent-avatar flex-shrink-0"
                        style={{ borderColor: agent.color, color: agent.color }}
                      >
                        <span className="text-xl">{agent.icon}</span>
                        {message.type === 'completed' && (
                          <div
                            className="absolute -bottom-1 -right-1 w-4 h-4 flex items-center justify-center"
                            style={{ backgroundColor: 'var(--success)' }}
                          >
                            <CheckCircle className="w-3 h-3 text-[var(--background)]" />
                          </div>
                        )}
                      </div>

                      {/* Message Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                          <span className="font-mono text-sm font-bold" style={{ color: agent.color }}>
                            {agent.name.toUpperCase()}
                          </span>
                          <MessageCategoryBadge category={category} />
                          <span className="font-mono text-xs text-[var(--foreground-muted)]">
                            {new Date(message.timestamp).toLocaleTimeString('pt-BR')}
                          </span>
                          {message.type === 'processing' && (
                            <div className="typing-indicator">
                              <span></span>
                              <span></span>
                              <span></span>
                            </div>
                          )}
                        </div>

                        <RefinementAgentMessagePlainText
                          messageId={message.id}
                          stageId={stageId}
                          mode="refinement"
                          role="agent"
                          content={message.message}
                        />

                        <button
                          onClick={() => openRefinementDialog(message.agent, message.message, message.id, stageId)}
                          className="mt-3 font-mono text-xs text-[var(--accent-cyan)] hover:underline"
                        >
                          [VER COMPLETO]
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>
      </div>

      {/* Processing Status Card */}
      {selectedDemand?.status === 'processing' && (
        <div className="neo-card mt-6 glow-border">
          <div className="p-4">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-10 h-10 bg-[var(--accent-cyan)]/10 border border-[var(--accent-cyan)] flex items-center justify-center">
                <Cpu className="w-5 h-5 text-[var(--accent-cyan)] animate-pulse" />
              </div>
              <div>
                <p className="font-mono text-sm font-bold">PROCESSANDO DEMANDA</p>
                <p className="font-mono text-xs text-[var(--foreground-muted)] truncate max-w-xs">
                  {selectedDemand.title}
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between font-mono text-xs">
                <span className="text-[var(--foreground-muted)]">PROGRESSO</span>
                <span className="text-[var(--accent-cyan)]">{Math.round(progress)}%</span>
              </div>
              <div className="progress-brutal">
                <div
                  className="progress-brutal-fill"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Completed Status with Documents */}
      {selectedDemand?.status === 'completed' && (
        <>
          <div className="neo-card mt-6 glow-border" style={{ borderColor: 'var(--success)' }}>
            <div className="p-4 flex items-center gap-4">
              <div className="w-10 h-10 bg-[var(--success)]/10 border border-[var(--success)] flex items-center justify-center">
                <CheckCircle className="w-5 h-5 text-[var(--success)]" />
              </div>
              <div>
                <p className="font-mono text-sm font-bold text-[var(--success)]">REFINAMENTO COMPLETO</p>
                <p className="font-mono text-xs text-[var(--foreground-muted)]">
                  Documentos PRD e Tasks gerados com sucesso
                </p>
              </div>
            </div>
          </div>

          {selectedDemand.prdUrl && (
            <div className="mt-6">
              <DocumentViewer
                demandId={selectedDemand.id}
                documentType="prd"
                pdfUrl={selectedDemand.prdUrl}
                refinementType={selectedDemand.refinementType as 'technical' | 'business' | null}
                typeAdherence={selectedDemand.typeAdherence as any}
                documentState={selectedDemand.documentState as any}
                reviewSnapshotId={selectedDemand.reviewSnapshotId as any}
                snapshotHash={selectedDemand.approvedSnapshotHash as any}
                approvalSessionId={selectedDemand.approvalSessionId as any}
              />
            </div>
          )}

          {selectedDemand.tasksUrl && (
            <div className="mt-6">
              <DocumentViewer
                demandId={selectedDemand.id}
                documentType="tasks"
                pdfUrl={selectedDemand.tasksUrl}
              />
            </div>
          )}
        </>
      )}

      {/* Stopped Status */}
      {selectedDemand?.status === 'stopped' && (
        <div className="neo-card mt-6" style={{ borderColor: 'var(--warning)' }}>
          <div className="p-4 flex items-center gap-4">
            <div className="w-10 h-10 bg-[var(--warning)]/10 border border-[var(--warning)] flex items-center justify-center">
              <StopCircle className="w-5 h-5 text-[var(--warning)]" />
            </div>
            <div>
              <p className="font-mono text-sm font-bold text-[var(--warning)]">REFINAMENTO INTERROMPIDO</p>
              <p className="font-mono text-xs text-[var(--foreground-muted)]">
                O processo foi interrompido pelo usuário
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Refinement Dialog */}
      <RefinementDialog
        agent={refinementDialog.agent}
        header={refinementDialog.header}
        message={refinementDialog.message}
        isOpen={refinementDialog.isOpen}
        onClose={closeRefinementDialog}
        onApply={handleApplyRefinement}
        onReviewLater={handleReviewLater}
        onClarityFeedback={handleClarityFeedback}
      />
    </>
  );
}
