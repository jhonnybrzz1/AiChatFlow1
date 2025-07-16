import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { History, RefreshCw, Download, CheckCircle, Clock, XCircle, StopCircle } from "lucide-react";
import { type Demand } from "@shared/schema";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

interface HistorySidebarProps {
  demands: Demand[];
  selectedDemand?: Demand | null;
  onSelectDemand?: (demand: Demand) => void;
}

export function HistorySidebar({ demands, selectedDemand, onSelectDemand }: HistorySidebarProps) {
  const { toast } = useToast();

  const handleDownload = (url: string | null, type: 'PRD' | 'Tasks') => {
    if (!url) {
      toast({
        title: "Documento não disponível",
        description: `O documento ${type} ainda não foi gerado.`,
        variant: "destructive",
      });
      return;
    }

    window.open(url, '_blank');
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="text-green-500" size={16} />;
      case 'processing':
        return <Clock className="text-yellow-500" size={16} />;
      case 'stopped':
        return <StopCircle className="text-orange-500" size={16} />;
      case 'error':
        return <XCircle className="text-red-500" size={16} />;
      default:
        return <Clock className="text-gray-500" size={16} />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'completed':
        return 'Concluído';
      case 'processing':
        return 'Em processamento';
      case 'stopped':
        return 'Interrompido';
      case 'error':
        return 'Erro no processamento';
      default:
        return 'Desconhecido';
    }
  };

  const getTimeAgo = (date: Date | string) => {
    const now = new Date();
    const past = new Date(date);
    const diffInMs = now.getTime() - past.getTime();
    const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
    const diffInDays = Math.floor(diffInHours / 24);

    if (diffInDays > 0) {
      return `há ${diffInDays} dia${diffInDays > 1 ? 's' : ''}`;
    } else if (diffInHours > 0) {
      return `há ${diffInHours} hora${diffInHours > 1 ? 's' : ''}`;
    } else {
      return 'agora';
    }
  };

  return (
    <Card className="shadow-sm">
      <CardHeader className="border-b border-border">
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center space-x-2">
            <History className="text-primary" size={20} />
            <span>Histórico de Demandas</span>
          </span>
          <Button variant="ghost" size="sm">
            <RefreshCw size={14} />
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="max-h-96 overflow-y-auto">
          {demands.length === 0 ? (
            <div className="p-8 text-center">
              <History className="mx-auto text-muted-foreground mb-3" size={48} />
              <p className="text-muted-foreground text-sm">
                Nenhuma demanda processada ainda
              </p>
            </div>
          ) : (
            demands.map((demand) => (
              <div
                key={demand.id}
                className={`p-4 border-b border-border last:border-b-0 hover:bg-muted/50 transition-colors cursor-pointer ${
                  selectedDemand?.id === demand.id ? 'bg-primary/10 border-primary/50' : ''
                }`}
                onClick={() => onSelectDemand?.(demand)}
              >
                <div className="flex items-start space-x-3">
                  <div className="w-8 h-8 bg-muted rounded-full flex items-center justify-center flex-shrink-0">
                    {getStatusIcon(demand.status)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-medium text-foreground truncate">
                      {demand.title}
                    </h4>
                    <p className="text-xs text-muted-foreground mt-1">
                      {getStatusText(demand.status)} • {getTimeAgo(demand.updatedAt!)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1 capitalize">
                      {demand.type.replace('_', ' ')} • {demand.priority}
                    </p>
                    
                    {demand.status === 'processing' && (
                      <div className="mt-2">
                        <div className="w-full bg-muted rounded-full h-1">
                          <div 
                            className="bg-primary h-1 rounded-full transition-all duration-500"
                            style={{ 
                              width: `${((demand.chatMessages?.filter(m => m.type === 'completed').length || 0) / 7) * 100}%` 
                            }}
                          />
                        </div>
                      </div>
                    )}
                    
                    {demand.status === 'completed' && (
                      <div className="flex items-center space-x-2 mt-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-auto p-0 text-xs text-primary hover:text-primary/80"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDownload(demand.prdUrl, 'PRD');
                          }}
                        >
                          <Download size={12} className="mr-1" />
                          <span>PRD</span>
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-auto p-0 text-xs text-primary hover:text-primary/80"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDownload(demand.tasksUrl, 'Tasks');
                          }}
                        >
                          <Download size={12} className="mr-1" />
                          <span>Tasks</span>
                        </Button>
                      </div>
                    )}
                    
                    {demand.status === 'error' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-auto p-0 text-xs text-red-500 hover:text-red-600 mt-2"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <RefreshCw size={12} className="mr-1" />
                        <span>Tentar novamente</span>
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
