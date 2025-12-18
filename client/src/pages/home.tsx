import { useState } from "react";
import { Users, Settings, Circle, Sparkles } from "lucide-react";
import CustomAlert from "@/components/ui/custom-alert";
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
    <div className="font-sans bg-gradient-to-br from-gray-50 to-gray-100 min-h-screen">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center shadow-md">
                <Users className="text-white" size={20} />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Squad de Agentes IA</h1>
                <p className="text-sm text-gray-600">Sistema de Refinamento de Demandas</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <div className="hidden sm:flex items-center space-x-2 text-sm text-gray-600">
                <Circle className="w-2 h-2 bg-green-500 rounded-full fill-current" />
                <span>Sistema Online</span>
              </div>
              <button className="p-2 text-gray-600 hover:text-gray-900 transition-colors rounded-lg hover:bg-gray-100">
                <Settings size={16} />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Status Alert */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Sparkles className="w-5 h-5 text-blue-600" />
              <div>
                <p className="font-semibold text-gray-800">Sistema Operacional</p>
                <p className="text-sm text-gray-600">Nossos agentes de IA estão prontos para refinar sua demanda</p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Circle className="w-2 h-2 bg-green-500 rounded-full fill-current" />
              <span className="text-sm font-medium text-green-700">Online</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Chat Area - now spans 3 columns */}
          <div className="lg:col-span-3 space-y-6">
            <div className="bg-white rounded-xl shadow-sm">
              <DemandForm />
            </div>
            <ChatArea selectedDemand={selectedDemand} />
          </div>

          {/* Sidebar - now spans 1 column */}
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
