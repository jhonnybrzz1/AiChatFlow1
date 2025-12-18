import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { MessageCircle, Bot, Loader2, StopCircle, Download, CheckCircle, XCircle, FileJson, FileText, Copy, FileText as FileTextIcon } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { type Demand, type ChatMessage } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import RefinementDialog from "./refinement-dialog";
import { MessageCategoryBadge, categoryConfig } from "./message-category";
import { cn } from "@/lib/utils";
import CustomDisclaimer from "@/components/ui/custom-disclaimer";
import { DocumentViewer } from "./document-viewer";

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
      <Card className="shadow-lg rounded-xl border-0 bg-gradient-to-br from-gray-50 to-white">
        <CardHeader className="border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-t-xl p-5">
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="bg-blue-500 p-2 rounded-lg">
                <MessageCircle className="text-white" size={20} />
              </div>
              <span className="text-lg font-semibold text-gray-800">
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
                    className="text-gray-700 border-gray-300 hover:bg-gray-100"
                  >
                    <FileJson className="w-4 h-4 mr-1" />
                    JSON
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleExportTXT}
                    title="Exportar diálogo em TXT"
                    className="text-gray-700 border-gray-300 hover:bg-gray-100"
                  >
                    <FileText className="w-4 h-4 mr-1" />
                    TXT
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCopyChat}
                    title="Copiar diálogo para área de transferência"
                    className="text-gray-700 border-gray-300 hover:bg-gray-100"
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
                  className="bg-red-100 hover:bg-red-200 text-red-700 border border-red-300"
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
        <CardContent className="p-6" data-chat-area>

          {/* Disclaimer para o fluxo de refinamento */}
          <CustomDisclaimer
            title="Como funciona o refinamento"
            variant="info"
            className="mb-6"
          >
            <ul className="list-disc pl-5 space-y-1 text-sm">
              <li>Os agentes especializados colaboram para refinar sua demanda</li>
              <li>Cada agente contribui com sua expertise específica</li>
              <li>O refinamento é baseado em completude (0-100%) de informações</li>
              <li>Documentos finais (PRD/Tasks) são gerados após conclusão</li>
            </ul>
          </CustomDisclaimer>

          <div
            className="space-y-4 max-h-96 overflow-y-auto"
            id="chat-messages-container"
            aria-live="polite"
            aria-atomic="false"
          >
            {chatMessages.length === 0 ? (
              <div className="text-center py-12">
                <div className="mx-auto bg-gray-100 w-16 h-16 rounded-full flex items-center justify-center mb-4">
                  <Bot className="text-gray-500" size={32} />
                </div>
                <p className="text-gray-600 font-medium">Nenhum refinamento em andamento</p>
                <p className="text-sm text-gray-500 mt-1">
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
                      "chat-message flex items-start space-x-4 p-4 rounded-xl transition-all duration-200",
                      "bg-white border-l-4 shadow-sm",
                      config.borderColor,
                      "hover:shadow-md"
                    )}
                    role="article"
                    aria-label={`${config.ariaLabel} de ${agentNames[message.agent] || message.agent}`}
                  >
                    <div
                      className="w-10 h-10 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-full flex items-center justify-center flex-shrink-0 shadow-sm"
                      aria-hidden="true"
                    >
                      <span className="text-base">{agentIcons[message.agent] || "🤖"}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2 mb-2 flex-wrap gap-2">
                        <span className="text-sm font-semibold text-gray-800">
                          {agentNames[message.agent] || message.agent}
                        </span>
                        <MessageCategoryBadge category={category} />
                        <span className="text-xs text-gray-500 font-medium">
                          {new Date(message.timestamp).toLocaleTimeString('pt-BR')}
                        </span>
                        {message.type === 'processing' && (
                          <div className="flex items-center">
                            <Loader2 className="w-3 h-3 animate-spin text-blue-500" />
                            <span className="ml-1 text-xs text-blue-600">Processando...</span>
                          </div>
                        )}
                        {message.type === 'completed' && (
                          <CheckCircle className="w-4 h-4 text-green-600" />
                        )}
                        {message.type === 'error' && (
                          <XCircle className="w-4 h-4 text-red-600" />
                        )}
                      </div>
                      <div className="flex flex-col">
                        <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                          {message.message}
                        </p>
                        <div className="mt-3 flex gap-3">
                          <button
                            onClick={() => openRefinementDialog(message.agent, message.message)}
                            className="text-xs text-blue-600 hover:text-blue-800 hover:underline font-medium"
                            aria-label="Ver refinamento completo"
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
        <Card className="shadow-lg rounded-xl border-0 bg-gradient-to-br from-blue-50 to-indigo-50 mt-4">
          <CardContent className="p-5">
            <div className="flex items-center space-x-4">
              <div className="processing-spinner w-8 h-8"></div>
              <div>
                <p className="font-semibold text-gray-800">Processando Demanda</p>
                <p className="text-sm text-gray-600">
                  A squad está analisando sua solicitação: "{selectedDemand.title}"
                </p>
              </div>
            </div>
            <div className="mt-4">
              <div className="flex justify-between text-sm text-gray-600 mb-2">
                <span className="font-medium">Progresso do Refinamento</span>
                <span className="font-semibold">{Math.round(progress)}%</span>
              </div>
              <Progress value={progress} className="h-3 rounded-full overflow-hidden" />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Completed Status with Document Viewers */}
      {selectedDemand?.status === 'completed' && (
        <>
          <Card className="shadow-lg rounded-xl border-0 bg-gradient-to-br from-green-50 to-emerald-50 mb-6 mt-4">
            <CardContent className="p-5">
              <div className="flex items-center space-x-4">
                <div className="bg-green-100 p-3 rounded-full">
                  <CheckCircle className="w-6 h-6 text-green-600" />
                </div>
                <div>
                  <p className="font-semibold text-gray-800">Refinamento Concluído</p>
                  <p className="text-sm text-gray-600">
                    Documentos PRD e Tasks foram gerados com sucesso
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* PRD Document Viewer */}
          {selectedDemand.prdUrl && (
            <div className="mb-6">
              <DocumentViewer
                demandId={selectedDemand.id}
                documentType="prd"
                pdfUrl={selectedDemand.prdUrl}
              />
            </div>
          )}

          {/* Tasks Document Viewer */}
          {selectedDemand.tasksUrl && (
            <div className="mb-6">
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
        <Card className="shadow-lg rounded-xl border-0 bg-gradient-to-br from-amber-50 to-orange-50 mt-4">
          <CardContent className="p-5">
            <div className="flex items-center space-x-4">
              <div className="bg-amber-100 p-3 rounded-full">
                <XCircle className="w-6 h-6 text-amber-600" />
              </div>
              <div>
                <p className="font-semibold text-gray-800">Refinamento Interrompido</p>
                <p className="text-sm text-gray-600">
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
