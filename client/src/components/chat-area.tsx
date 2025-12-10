import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { MessageCircle, Bot, Loader2, StopCircle, Download, CheckCircle, XCircle, FileJson, FileText, Copy } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { type Demand, type ChatMessage } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import RefinementDialog from "./refinement-dialog";
import { MessageCategoryBadge, categoryConfig } from "./message-category";
import { cn } from "@/lib/utils";

const agentIcons: Record<string, string> = {
  refinador: "🧠",
  scrum_master: "🧝",
  qa: "✅",
  ux: "🎨",
  analista_de_dados: "📈",
  tech_lead: "💧",
  pm: "📋",
};

const agentNames: Record<string, string> = {
  refinador: "Refinador",
  scrum_master: "Scrum Master",
  qa: "QA",
  ux: "UX Designer",
  analista_de_dados: "Analista de Dados",
  tech_lead: "Tech Lead",
  pm: "Product Manager",
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
  }>({ isOpen: false, agent: '', header: '', message: '' });
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { data: demands = [] } = useQuery({
    queryKey: ['/api/demands'],
    queryFn: () => api.demands.getAll(),
    refetchInterval: 2000,
  });

  // Get the most recent processing demand or use the selected one
  const processingDemand = demands.find(d => d.status === 'processing') || null;

  // Stop processing mutation
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
    // If there's a processing demand, prioritize it
    if (processingDemand) {
      setSelectedDemand(processingDemand);

      // Calculate progress based on messages
      const totalAgents = 7;
      const completedMessages = processingDemand.chatMessages?.filter(m => m.type === 'completed').length || 0;
      setProgress((completedMessages / totalAgents) * 100);

      // Subscribe to real-time updates
      const unsubscribe = api.demands.subscribeToUpdates(processingDemand.id, (updatedDemand) => {
        setSelectedDemand(updatedDemand);
        const newCompletedMessages = updatedDemand.chatMessages?.filter(m => m.type === 'completed').length || 0;
        setProgress((newCompletedMessages / totalAgents) * 100);
      });

      return unsubscribe;
    }
    // Otherwise use the selected demand from props
    else if (propSelectedDemand) {
      setSelectedDemand(propSelectedDemand);
      const totalAgents = 7;
      const completedMessages = propSelectedDemand.chatMessages?.filter(m => m.type === 'completed').length || 0;
      setProgress((completedMessages / totalAgents) * 100);
    }
  }, [processingDemand?.id, propSelectedDemand?.id]);

  const chatMessages = selectedDemand?.chatMessages || [];

  const handleDownloadDocument = (url: string) => {
    window.open(url, '_blank');
  };

  const handleExportJSON = () => {
    if (!selectedDemand) return;
    window.open(`/api/demands/${selectedDemand.id}/export/json`, '_blank');
    toast({
      title: "Exportando diálogo",
      description: "O arquivo JSON está sendo baixado.",
    });
  };

  const handleExportTXT = () => {
    if (!selectedDemand) return;
    window.open(`/api/demands/${selectedDemand.id}/export/txt`, '_blank');
    toast({
      title: "Exportando diálogo",
      description: "O arquivo TXT está sendo baixado.",
    });
  };

  const handleCopyChat = async () => {
    if (!selectedDemand || chatMessages.length === 0) return;

    // Formatar o conteúdo do chat
    let chatContent = `HISTÓRICO DE DIÁLOGO - DEMANDA #${selectedDemand.id}\n`;
    chatContent += `${'='.repeat(60)}\n\n`;
    chatContent += `Título: ${selectedDemand.title}\n`;
    chatContent += `Tipo: ${selectedDemand.type}\n`;
    chatContent += `Prioridade: ${selectedDemand.priority}\n`;
    chatContent += `Status: ${selectedDemand.status}\n`;
    chatContent += `Criado em: ${selectedDemand.createdAt}\n`;
    chatContent += `\nDescrição:\n${selectedDemand.description}\n\n`;
    chatContent += `${'='.repeat(60)}\n`;
    chatContent += `MENSAGENS DO CHAT\n`;
    chatContent += `${'='.repeat(60)}\n\n`;

    chatMessages.forEach((message, index) => {
      const agentName = agentNames[message.agent] || message.agent;
      const timestamp = new Date(message.timestamp).toLocaleString('pt-BR');
      const status = message.type === 'completed' ? '✓' : message.type === 'processing' ? '⏳' : '✗';

      chatContent += `[${index + 1}] ${agentName} ${status}\n`;
      chatContent += `Data/Hora: ${timestamp}\n`;
      chatContent += `${'-'.repeat(60)}\n`;
      chatContent += `${message.message}\n\n`;
    });

    chatContent += `${'='.repeat(60)}\n`;
    chatContent += `FIM DO HISTÓRICO\n`;
    chatContent += `Copiado em: ${new Date().toLocaleString('pt-BR')}\n`;

    try {
      await navigator.clipboard.writeText(chatContent);
      toast({
        title: "Diálogo copiado",
        description: "O conteúdo do chat foi copiado para a área de transferência.",
      });
    } catch (error) {
      toast({
        title: "Erro ao copiar",
        description: "Não foi possível copiar o conteúdo do chat.",
        variant: "destructive",
      });
    }
  };

  const openRefinementDialog = (agent: string, message: string) => {
    const agentDisplayName = agentNames[agent] || agent;
    setRefinementDialog({
      isOpen: true,
      agent,
      header: `Refinamento de ${agentDisplayName}`,
      message
    });
  };

  const closeRefinementDialog = () => {
    setRefinementDialog({ isOpen: false, agent: '', header: '', message: '' });
  };

  const handleApplyRefinement = () => {
    toast({
      title: "Refinamento aplicado",
      description: `O refinamento do ${agentNames[refinementDialog.agent] || refinementDialog.agent} foi aplicado com sucesso.`,
    });
    closeRefinementDialog();
  };

  const handleReviewLater = () => {
    toast({
      title: "Revisão adiada",
      description: `Você pode revisar o refinamento do ${agentNames[refinementDialog.agent] || refinementDialog.agent} mais tarde.`,
    });
    closeRefinementDialog();
  };

  return (
    <>
      {/* Chat Messages Area */}
      <Card className="shadow-sm">
        <CardHeader className="border-b border-border">
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <MessageCircle className="text-primary" size={20} />
              <span>
                {selectedDemand?.status === 'processing' ? 'Refinamento em Andamento' :
                  selectedDemand?.status === 'completed' ? 'Refinamento Concluído' :
                    selectedDemand?.status === 'stopped' ? 'Refinamento Interrompido' :
                      'Squad de Refinamento'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {selectedDemand && chatMessages.length > 0 && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleExportJSON}
                    title="Exportar diálogo em JSON"
                  >
                    <FileJson className="w-4 h-4 mr-1" />
                    JSON
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleExportTXT}
                    title="Exportar diálogo em TXT"
                  >
                    <FileText className="w-4 h-4 mr-1" />
                    TXT
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCopyChat}
                    title="Copiar diálogo para área de transferência"
                  >
                    <Copy className="w-4 h-4 mr-1" />
                    Copiar
                  </Button>
                </>
              )}
              {selectedDemand?.status === 'processing' && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => stopProcessingMutation.mutate(selectedDemand.id)}
                  disabled={stopProcessingMutation.isPending}
                >
                  {stopProcessingMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <StopCircle className="w-4 h-4 mr-2" />
                  )}
                  Parar
                </Button>
              )}
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4" data-chat-area>
          <div className="space-y-4 max-h-96 overflow-y-auto" id="chat-messages-container">
            {chatMessages.length === 0 ? (
              <div className="text-center py-8">
                <Bot className="mx-auto text-muted-foreground mb-4" size={48} />
                <p className="text-muted-foreground">Nenhum refinamento em andamento</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Crie uma nova demanda para iniciar o processo
                </p>
              </div>
            ) : (
              chatMessages.map((message) => {
                // Determine category (default to 'answer' if not specified)
                const category = message.category || 'answer';
                const config = categoryConfig[category];

                return (
                  <div
                    key={message.id}
                    className={cn(
                      "chat-message flex items-start space-x-3 p-3 rounded-lg border-l-4 transition-colors",
                      config.borderColor,
                      config.bgColor
                    )}
                    role="article"
                    aria-label={`${config.ariaLabel} de ${agentNames[message.agent] || message.agent}`}
                  >
                    <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
                      <span className="text-sm">{agentIcons[message.agent] || "🤖"}</span>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-1 flex-wrap gap-1">
                        <span className="text-sm font-medium text-foreground">
                          {agentNames[message.agent] || message.agent}
                        </span>
                        <MessageCategoryBadge category={category} />
                        <span className="text-xs text-muted-foreground">
                          {new Date(message.timestamp).toLocaleTimeString('pt-BR')}
                        </span>
                        {message.type === 'processing' && (
                          <Loader2 className="w-3 h-3 animate-spin text-primary" />
                        )}
                        {message.type === 'completed' && (
                          <CheckCircle className="w-3 h-3 text-green-600" />
                        )}
                        {message.type === 'error' && (
                          <XCircle className="w-3 h-3 text-red-600" />
                        )}
                      </div>
                      <div className="flex flex-col">
                        <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                          {message.message}
                        </p>
                        <div className="mt-2 flex gap-2">
                          <button
                            onClick={() => openRefinementDialog(message.agent, message.message)}
                            className="text-xs text-primary hover:underline"
                          >
                            Ver refinamento completo
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </CardContent>
      </Card>

      {/* Processing Status */}
      {selectedDemand?.status === 'processing' && (
        <Card className="shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center space-x-3">
              <div className="processing-spinner w-8 h-8"></div>
              <div>
                <p className="font-medium text-foreground">Processando Demanda</p>
                <p className="text-sm text-muted-foreground">
                  A squad está analisando sua solicitação: "{selectedDemand.title}"
                </p>
              </div>
            </div>
            <div className="mt-4">
              <div className="flex justify-between text-sm text-muted-foreground mb-1">
                <span>Progresso do Refinamento</span>
                <span>{Math.round(progress)}%</span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Completed Status with Download Buttons */}
      {selectedDemand?.status === 'completed' && (
        <Card className="shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center space-x-3 mb-4">
              <CheckCircle className="w-8 h-8 text-green-600" />
              <div>
                <p className="font-medium text-foreground">Refinamento Concluído</p>
                <p className="text-sm text-muted-foreground">
                  Documentos PRD e Tasks foram gerados com sucesso
                </p>
              </div>
            </div>
            <div className="flex space-x-3">
              {selectedDemand.prdUrl && (
                <Button
                  variant="outline"
                  onClick={() => handleDownloadDocument(selectedDemand.prdUrl!)}
                  className="flex-1"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Baixar PRD
                </Button>
              )}
              {selectedDemand.tasksUrl && (
                <Button
                  variant="outline"
                  onClick={() => handleDownloadDocument(selectedDemand.tasksUrl!)}
                  className="flex-1"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Baixar Tasks
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stopped Status */}
      {selectedDemand?.status === 'stopped' && (
        <Card className="shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center space-x-3">
              <XCircle className="w-8 h-8 text-orange-600" />
              <div>
                <p className="font-medium text-foreground">Refinamento Interrompido</p>
                <p className="text-sm text-muted-foreground">
                  O processo foi interrompido pelo usuário
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
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
      />
    </>
  );
}
