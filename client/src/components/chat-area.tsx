import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { MessageCircle, Bot, Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { type Demand, type ChatMessage } from "@shared/schema";

const agentIcons: Record<string, string> = {
  refinador: "🧠",
  scrum_master: "🧝",
  qa: "✅",
  ux: "🎨",
  analista_de_dados: "📈",
  tech_lead: "💧",
  pm: "📋",
};

export function ChatArea() {
  const [selectedDemand, setSelectedDemand] = useState<Demand | null>(null);
  const [progress, setProgress] = useState(0);

  const { data: demands = [] } = useQuery({
    queryKey: ['/api/demands'],
    queryFn: () => api.demands.getAll(),
    refetchInterval: 2000,
  });

  // Get the most recent processing demand
  const processingDemand = demands.find(d => d.status === 'processing') || null;

  useEffect(() => {
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
  }, [processingDemand?.id]);

  const chatMessages = selectedDemand?.chatMessages || [];

  return (
    <>
      {/* Chat Messages Area */}
      <Card className="shadow-sm">
        <CardHeader className="border-b border-border">
          <CardTitle className="flex items-center space-x-2">
            <MessageCircle className="text-primary" size={20} />
            <span>Refinamento em Andamento</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          <div className="space-y-4 max-h-96 overflow-y-auto">
            {chatMessages.length === 0 ? (
              <div className="text-center py-8">
                <Bot className="mx-auto text-muted-foreground mb-4" size={48} />
                <p className="text-muted-foreground">Nenhum refinamento em andamento</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Crie uma nova demanda para iniciar o processo
                </p>
              </div>
            ) : (
              chatMessages.map((message) => (
                <div
                  key={message.id}
                  className="chat-message flex items-start space-x-3 p-3 rounded-lg bg-muted/50"
                >
                  <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-sm">{agentIcons[message.agent] || "🤖"}</span>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-1">
                      <span className="text-sm font-medium text-foreground capitalize">
                        {message.agent.replace('_', ' ')}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(message.timestamp).toLocaleTimeString()}
                      </span>
                      {message.type === 'processing' && (
                        <Loader2 className="w-3 h-3 animate-spin text-primary" />
                      )}
                    </div>
                    <p className="text-sm text-foreground">{message.message}</p>
                  </div>
                </div>
              ))
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
                  A squad está analisando sua solicitação...
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
    </>
  );
}
