import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { History, RefreshCw, Download, CheckCircle, Clock, XCircle, StopCircle, Menu, Search, Filter } from "lucide-react";
import { type Demand } from "@shared/schema";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { useState, useMemo } from "react";

interface HistorySidebarProps {
  demands: Demand[];
  selectedDemand?: Demand | null;
  onSelectDemand?: (demand: Demand) => void;
}

export function HistorySidebar({ demands, selectedDemand, onSelectDemand }: HistorySidebarProps) {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterPriority, setFilterPriority] = useState<string>('all');

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
        return <CheckCircle className="text-green-600" size={16} />;
      case 'processing':
        return <Clock className="text-yellow-600" size={16} />;
      case 'stopped':
        return <StopCircle className="text-orange-600" size={16} />;
      case 'error':
        return <XCircle className="text-red-600" size={16} />;
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

  // Filter and search demands
  const filteredDemands = useMemo(() => {
    return demands.filter(demand => {
      const matchesSearch = searchTerm === '' ||
        demand.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        demand.description.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesStatus = filterStatus === 'all' || demand.status === filterStatus;
      const matchesPriority = filterPriority === 'all' || demand.priority === filterPriority;

      return matchesSearch && matchesStatus && matchesPriority;
    });
  }, [demands, searchTerm, filterStatus, filterPriority]);

  const statusOptions = ['all', 'completed', 'processing', 'stopped', 'error'];
  const priorityOptions = ['all', 'baixa', 'media', 'alta', 'critica'];

  const sidebarContent = (
    <>
      <CardHeader className="border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-t-xl p-5">
        <div className="flex flex-col space-y-4">
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center space-x-2">
              <div className="bg-blue-500 p-2 rounded-lg">
                <History className="text-white" size={20} />
              </div>
              <span className="font-semibold text-gray-800">Histórico de Demandas</span>
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => window.location.reload()}
              className="text-gray-600 hover:bg-gray-100"
              aria-label="Atualizar histórico"
            >
              <RefreshCw size={16} />
            </Button>
          </CardTitle>

          {/* Search and filters */}
          <div className="space-y-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Buscar demandas..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                aria-label="Buscar demandas"
              />
            </div>

            <div className="flex space-x-2">
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="flex-1 py-2 px-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                aria-label="Filtrar por status"
              >
                <option value="all">Todos os Status</option>
                {statusOptions.filter(opt => opt !== 'all').map(status => (
                  <option key={status} value={status}>{getStatusText(status)}</option>
                ))}
              </select>

              <select
                value={filterPriority}
                onChange={(e) => setFilterPriority(e.target.value)}
                className="flex-1 py-2 px-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                aria-label="Filtrar por prioridade"
              >
                <option value="all">Todas as Prioridades</option>
                {priorityOptions.filter(opt => opt !== 'all').map(priority => (
                  <option key={priority} value={priority}>{priority.charAt(0).toUpperCase() + priority.slice(1)}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="max-h-96 overflow-y-auto">
          {filteredDemands.length === 0 ? (
            <div className="p-8 text-center">
              <div className="mx-auto bg-gray-100 w-16 h-16 rounded-full flex items-center justify-center mb-4">
                <History className="text-gray-500" size={32} />
              </div>
              <p className="text-gray-600 font-medium">
                {demands.length === 0
                  ? 'Nenhuma demanda processada ainda'
                  : 'Nenhuma demanda encontrada com os filtros aplicados'}
              </p>
              {demands.length > 0 && (
                <p className="text-sm text-gray-500 mt-1">
                  Tente ajustar sua busca ou filtros
                </p>
              )}
            </div>
          ) : (
            filteredDemands.map((demand) => (
              <div
                key={demand.id}
                className={`p-4 border-b border-gray-100 last:border-b-0 hover:bg-gray-50 transition-colors cursor-pointer ${selectedDemand?.id === demand.id ? 'bg-blue-50 border-l-4 border-l-blue-500' : ''}`}
                onClick={() => {
                  onSelectDemand?.(demand);
                  setIsOpen(false); // Fechar drawer ao selecionar
                }}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    onSelectDemand?.(demand);
                    setIsOpen(false);
                  }
                }}
                aria-label={`Demanda: ${demand.title}, Status: ${getStatusText(demand.status)}`}
              >
                <div className="flex items-start space-x-3">
                  <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center flex-shrink-0 shadow-sm">
                    {getStatusIcon(demand.status)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-semibold text-gray-800 truncate">
                      {demand.title}
                    </h4>
                    <div className="flex items-center space-x-2 mt-1">
                      <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-800 rounded-full">
                        {getStatusText(demand.status)}
                      </span>
                      <span className="text-xs text-gray-500">
                        {getTimeAgo(demand.updatedAt!)}
                      </span>
                    </div>
                    <div className="flex items-center space-x-2 mt-1">
                      <span className="text-xs text-gray-600 capitalize">
                        {demand.type.replace('_', ' ')}
                      </span>
                      <span className="text-xs text-gray-400">•</span>
                      <span className="text-xs text-gray-600 capitalize">
                        {demand.priority}
                      </span>
                    </div>

                    {demand.status === 'processing' && (
                      <div className="mt-2">
                        <div className="w-full bg-gray-200 rounded-full h-1.5">
                          <div
                            className="bg-blue-600 h-1.5 rounded-full transition-all duration-500"
                            style={{
                              width: `${((demand.chatMessages?.filter(m => m.type === 'completed').length || 0) / 7) * 100}%`
                            }}
                          />
                        </div>
                      </div>
                    )}

                    {demand.status === 'completed' && (
                      <div className="flex items-center space-x-2 mt-2 pt-1">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 px-2 text-xs text-blue-700 border-blue-300 hover:bg-blue-50"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDownload(demand.prdUrl, 'PRD');
                          }}
                        >
                          <Download size={12} className="mr-1" />
                          <span>PRD</span>
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 px-2 text-xs text-blue-700 border-blue-300 hover:bg-blue-50"
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
                        variant="outline"
                        size="sm"
                        className="h-7 px-2 text-xs text-red-700 border-red-300 hover:bg-red-50 mt-2"
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
    </>
  );

  return (
    <>
      {/* Mobile: Drawer (Sheet) */}
      <div className="md:hidden">
        <Sheet open={isOpen} onOpenChange={setIsOpen}>
          <SheetTrigger asChild>
            <Button variant="outline" size="sm" className="w-full mb-4 bg-white shadow-sm">
              <Menu size={16} className="mr-2" />
              Histórico ({demands.length})
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-[300px] sm:w-[400px] p-0">
            <div className="h-full flex flex-col">
              <SheetHeader className="p-5 border-b border-gray-200">
                <div className="bg-blue-500 p-2 rounded-lg w-10 h-10 flex items-center justify-center">
                  <History className="text-white" size={20} />
                </div>
                <SheetTitle className="text-left">Histórico de Demandas</SheetTitle>
              </SheetHeader>
              <div className="flex-1 overflow-y-auto">
                {sidebarContent}
              </div>
            </div>
          </SheetContent>
        </Sheet>
      </div>

      {/* Desktop: Card */}
      <div className="hidden md:block">
        <Card className="shadow-lg rounded-xl border-0 bg-white">
          {sidebarContent}
        </Card>
      </div>
    </>
  );
}
