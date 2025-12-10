import { useState } from "react";
import { Users, Settings, Circle } from "lucide-react";
import { DemandForm } from "@/components/demand-form";
import { ChatArea } from "@/components/chat-area";
import { HistorySidebar } from "@/components/history-sidebar";
import { SquadMembers } from "@/components/squad-members";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { type Demand } from "@shared/schema";

export default function Home() {
  const [selectedDemand, setSelectedDemand] = useState<Demand | null>(null);

  const { data: demands = [] } = useQuery({
    queryKey: ['/api/demands'],
    queryFn: () => api.demands.getAll(),
    refetchInterval: 5000,
  });

  const handleSelectDemand = (demand: Demand) => {
    setSelectedDemand(demand);
  };

  return (
    <div className="font-sans bg-background min-h-screen">
      {/* Header */}
      <header className="bg-card shadow-sm border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
                <Users className="text-primary-foreground" size={20} />
              </div>
              <div>
                <h1 className="text-xl font-semibold text-foreground">Squad de Agentes IA</h1>
                <p className="text-sm text-muted-foreground">Sistema de Refinamento de Demandas</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                <Circle className="w-2 h-2 bg-green-500 rounded-full fill-current" />
                <span>Sistema Online</span>
              </div>
              <button className="p-2 text-muted-foreground hover:text-foreground transition-colors">
                <Settings size={16} />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Chat Area */}
          <div className="lg:col-span-2 space-y-6">
            <DemandForm />
            <ChatArea selectedDemand={selectedDemand} />
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1 space-y-6">
            <HistorySidebar
              demands={demands}
              selectedDemand={selectedDemand}
              onSelectDemand={handleSelectDemand}
            />
            <SquadMembers />
          </div>
        </div>
      </div>
    </div>
  );
}
