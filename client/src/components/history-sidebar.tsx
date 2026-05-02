import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { History, RefreshCw, Download, CheckCircle, Clock, XCircle, StopCircle, Menu, Search } from "lucide-react";
import { type Demand } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import { TypeAdherenceBadgeCompact } from "./type-adherence-badge";

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

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'completed':
        return { icon: CheckCircle, color: 'var(--success)', label: 'COMPLETO' };
      case 'processing':
        return { icon: Clock, color: 'var(--accent-cyan)', label: 'PROCESSANDO' };
      case 'stopped':
        return { icon: StopCircle, color: 'var(--warning)', label: 'INTERROMPIDO' };
      case 'error':
        return { icon: XCircle, color: 'var(--destructive)', label: 'ERRO' };
      default:
        return { icon: Clock, color: 'var(--foreground-muted)', label: 'PENDENTE' };
    }
  };

  const getTimeAgo = (date: Date | string) => {
    const now = new Date();
    const past = new Date(date);
    const diffInMs = now.getTime() - past.getTime();
    const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
    const diffInDays = Math.floor(diffInHours / 24);

    if (diffInDays > 0) return `${diffInDays}d`;
    if (diffInHours > 0) return `${diffInHours}h`;
    return 'agora';
  };

  const filteredDemands = useMemo(() => {
    return demands.filter(demand => {
      const matchesSearch = searchTerm === '' ||
        demand.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        demand.description.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = filterStatus === 'all' || demand.status === filterStatus;
      return matchesSearch && matchesStatus;
    });
  }, [demands, searchTerm, filterStatus]);

  const statusOptions = [
    { value: 'all', label: 'TODOS' },
    { value: 'completed', label: 'COMPLETOS' },
    { value: 'processing', label: 'ATIVOS' },
    { value: 'stopped', label: 'PARADOS' },
  ];

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b-2 border-[var(--border)] bg-[var(--muted)]">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-[var(--accent-orange)] flex items-center justify-center">
              <History className="w-4 h-4 text-[var(--background)]" />
            </div>
            <span className="font-mono text-sm font-bold">HISTÓRICO</span>
          </div>
          <button
            onClick={() => window.location.reload()}
            className="w-8 h-8 flex items-center justify-center border border-[var(--border)] hover:border-[var(--accent-cyan)] hover:text-[var(--accent-cyan)] transition-colors"
            title="Atualizar"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {/* Search */}
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--foreground-muted)]" />
          <input
            type="text"
            placeholder="Buscar demandas..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="terminal-input w-full pl-10 py-2 text-sm"
          />
        </div>

        {/* Filter Tabs */}
        <div className="brutal-tabs">
          {statusOptions.map((option) => (
            <button
              key={option.value}
              onClick={() => setFilterStatus(option.value)}
              className={cn(
                "brutal-tab text-[9px] py-2",
                filterStatus === option.value && "active"
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {/* Demands List */}
      <div className="flex-1 overflow-y-auto">
        {filteredDemands.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center px-4">
            <div className="w-12 h-12 border-2 border-[var(--border)] flex items-center justify-center mb-3">
              <History className="w-6 h-6 text-[var(--foreground-muted)]" />
            </div>
            <p className="font-mono text-xs text-[var(--foreground-muted)]">
              {demands.length === 0 ? 'NENHUMA DEMANDA' : 'NENHUM RESULTADO'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-[var(--border)]">
            {filteredDemands.map((demand) => {
              const status = getStatusConfig(demand.status);
              const StatusIcon = status.icon;
              const isSelected = selectedDemand?.id === demand.id;

              return (
                <div
                  key={demand.id}
                  onClick={() => {
                    onSelectDemand?.(demand);
                    setIsOpen(false);
                  }}
                  className={cn(
                    "w-full text-left p-4 transition-colors hover:bg-[var(--muted)] cursor-pointer",
                    isSelected && "bg-[var(--muted)] border-l-4"
                  )}
                  style={{
                    borderLeftColor: isSelected ? status.color : 'transparent'
                  }}
                >
                  <div className="flex items-start gap-3">
                    {/* Status Icon */}
                    <div
                      className="w-8 h-8 flex items-center justify-center border flex-shrink-0"
                      style={{ borderColor: status.color }}
                    >
                      <StatusIcon
                        className={cn(
                          "w-4 h-4",
                          demand.status === 'processing' && "animate-spin"
                        )}
                        style={{ color: status.color }}
                      />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <h4 className="font-mono text-sm font-bold truncate">
                        {demand.title}
                      </h4>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <span
                          className="brutal-badge text-[9px] px-1.5 py-0.5"
                          style={{ color: status.color, borderColor: status.color }}
                        >
                          {status.label}
                        </span>
                        <TypeAdherenceBadgeCompact
                          refinementType={demand.refinementType as 'technical' | 'business' | null}
                          typeAdherence={demand.typeAdherence as any}
                        />
                        <span className="font-mono text-[10px] text-[var(--foreground-muted)]">
                          {getTimeAgo(demand.updatedAt!)}
                        </span>
                      </div>

                      {/* Progress for processing */}
                      {demand.status === 'processing' && (
                        <div className="mt-2">
                          <div className="progress-brutal h-1">
                            <div
                              className="progress-brutal-fill"
                              style={{
                                width: `${((demand.chatMessages?.filter(m => m.type === 'completed').length || 0) / 7) * 100}%`
                              }}
                            />
                          </div>
                        </div>
                      )}

                      {/* Download buttons for completed */}
                      {demand.status === 'completed' && (
                        <div className="flex items-center gap-2 mt-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDownload(demand.prdUrl, 'PRD');
                            }}
                            className="flex items-center gap-1 px-2 py-1 border border-[var(--accent-cyan)] text-[var(--accent-cyan)] font-mono text-[9px] hover:bg-[var(--accent-cyan)] hover:text-[var(--background)] transition-colors"
                          >
                            <Download className="w-3 h-3" />
                            PRD
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDownload(demand.tasksUrl, 'Tasks');
                            }}
                            className="flex items-center gap-1 px-2 py-1 border border-[var(--accent-lime)] text-[var(--accent-lime)] font-mono text-[9px] hover:bg-[var(--accent-lime)] hover:text-[var(--background)] transition-colors"
                          >
                            <Download className="w-3 h-3" />
                            TASKS
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer Stats */}
      <div className="p-3 border-t-2 border-[var(--border)] bg-[var(--muted)]">
        <div className="flex items-center justify-between font-mono text-[10px] text-[var(--foreground-muted)]">
          <span>TOTAL: {demands.length}</span>
          <span>FILTRADO: {filteredDemands.length}</span>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile: Sheet Trigger */}
      <div className="lg:hidden">
        <Sheet open={isOpen} onOpenChange={setIsOpen}>
          <SheetTrigger asChild>
            <button className="cmd-button w-full flex items-center justify-center gap-2">
              <Menu className="w-4 h-4" />
              <span>HISTÓRICO ({demands.length})</span>
            </button>
          </SheetTrigger>
          <SheetContent side="left" className="w-[320px] p-0 bg-[var(--background)] border-r-2 border-[var(--border)]">
            <SidebarContent />
          </SheetContent>
        </Sheet>
      </div>

      {/* Desktop: Card */}
      <div className="hidden lg:block">
        <div className="neo-card overflow-hidden">
          <SidebarContent />
        </div>
      </div>
    </>
  );
}
