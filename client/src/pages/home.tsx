import { useState, useEffect } from "react";
import { Settings, Zap, Moon, Sun, Terminal, Activity } from "lucide-react";
import { DemandForm } from "@/components/demand-form";
import { ChatArea } from "@/components/chat-area";
import { HistorySidebar } from "@/components/history-sidebar";
import { SquadMembers } from "@/components/squad-members";
import { PriorityMatrix } from "@/components/priority-matrix";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { type Demand } from "@shared/schema";
import { useEnhancedTheme } from "@/components/ui/theme-provider";

export default function Home() {
  const [selectedDemand, setSelectedDemand] = useState<Demand | null>(null);
  const { toggleTheme, isDarkMode } = useEnhancedTheme();
  const [currentTime, setCurrentTime] = useState(new Date());

  const { data: demands = [] } = useQuery({
    queryKey: ['/api/demands'],
    queryFn: () => api.demands.getAll(),
    refetchInterval: 5000,
  });

  // Update time every second
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const handleSelectDemand = (demand: Demand) => {
    setSelectedDemand(demand);
  };

  const processingCount = demands.filter(d => d.status === 'processing').length;
  const completedCount = demands.filter(d => d.status === 'completed').length;

  return (
    <div className="min-h-screen relative z-10">
      {/* Header - Command Bar Style */}
      <header className="sticky top-0 z-50 border-b-2 border-[var(--border)] bg-[var(--background)]/95 backdrop-blur-sm">
        <div className="max-w-[1600px] mx-auto">
          <div className="flex items-center justify-between h-14 px-4">
            {/* Logo & Brand */}
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-[var(--accent-cyan)] flex items-center justify-center">
                  <Terminal className="w-4 h-4 text-[var(--background)]" />
                </div>
                <span className="font-mono text-lg font-bold tracking-tight">
                  AI<span className="text-[var(--accent-cyan)]">CHAT</span>FLOW
                </span>
              </div>

              {/* System Status */}
              <div className="hidden md:flex items-center gap-6 ml-8 font-mono text-xs">
                <div className="flex items-center gap-2">
                  <div className="status-dot online" />
                  <span className="text-[var(--foreground-muted)]">SISTEMA</span>
                  <span className="text-[var(--success)]">ONLINE</span>
                </div>
                <div className="flex items-center gap-2 text-[var(--foreground-muted)]">
                  <Activity className="w-3 h-3" />
                  <span>{processingCount} ATIVO</span>
                  <span className="text-[var(--border)]">|</span>
                  <span>{completedCount} COMPLETO</span>
                </div>
              </div>
            </div>

            {/* Right Side Controls */}
            <div className="flex items-center gap-4">
              {/* Clock */}
              <div className="hidden sm:flex items-center gap-2 font-mono text-xs text-[var(--foreground-muted)]">
                <span>{currentTime.toLocaleDateString('pt-BR')}</span>
                <span className="text-[var(--accent-cyan)]">
                  {currentTime.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </span>
              </div>

              {/* Theme Toggle */}
              <button
                onClick={toggleTheme}
                className="w-8 h-8 flex items-center justify-center border border-[var(--border)] hover:border-[var(--accent-cyan)] hover:text-[var(--accent-cyan)] transition-colors"
                aria-label={isDarkMode ? 'Modo claro' : 'Modo escuro'}
              >
                {isDarkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </button>

              {/* Settings */}
              <button
                className="w-8 h-8 flex items-center justify-center border border-[var(--border)] hover:border-[var(--accent-cyan)] hover:text-[var(--accent-cyan)] transition-colors"
                aria-label="Configurações"
              >
                <Settings className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Status Banner */}
      <div className="border-b border-[var(--border)] bg-[var(--muted)]">
        <div className="max-w-[1600px] mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-[var(--accent-cyan)]/10 border border-[var(--accent-cyan)] flex items-center justify-center">
                <Zap className="w-4 h-4 text-[var(--accent-cyan)]" />
              </div>
              <div className="font-mono">
                <p className="text-sm font-semibold">SQUAD DE REFINAMENTO ATIVA</p>
                <p className="text-xs text-[var(--foreground-muted)]">
                  6 agentes de IA prontos para processar sua demanda
                </p>
              </div>
            </div>
            <div className="hidden md:flex items-center gap-2">
              <span className="brutal-badge cyan">
                <span className="w-2 h-2 bg-current rounded-full animate-pulse" />
                PRONTO
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-[1600px] mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Main Column - Form & Chat */}
          <div className="lg:col-span-8 xl:col-span-9 space-y-6">
            <DemandForm />
            <PriorityMatrix
              demands={demands}
              selectedDemand={selectedDemand}
              onSelectDemand={handleSelectDemand}
            />
            <ChatArea selectedDemand={selectedDemand} />
          </div>

          {/* Sidebar Column */}
          <aside className="lg:col-span-4 xl:col-span-3 space-y-6">
            <HistorySidebar
              demands={demands}
              selectedDemand={selectedDemand}
              onSelectDemand={handleSelectDemand}
            />
            <SquadMembers />
          </aside>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t-2 border-[var(--border)] mt-12">
        <div className="max-w-[1600px] mx-auto px-4 py-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 font-mono text-xs text-[var(--foreground-muted)]">
            <div className="flex items-center gap-4">
              <span>© 2024 AICHATFLOW</span>
              <span className="hidden sm:inline text-[var(--border)]">|</span>
              <span className="hidden sm:inline">POWERED BY AI SQUAD TECHNOLOGY</span>
            </div>
            <div className="flex items-center gap-2">
              <span>v2.0.0</span>
              <span className="text-[var(--border)]">|</span>
              <span className="text-[var(--accent-cyan)]">NEO-BRUTALIST EDITION</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
