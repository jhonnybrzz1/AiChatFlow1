import { useState } from "react";
import { Settings, Circle, Sparkles, Moon, Sun } from "lucide-react";
import CustomAlert from "@/components/ui/custom-alert";
import { DemandForm } from "@/components/demand-form";
import { ChatArea } from "@/components/chat-area";
import { HistorySidebar } from "@/components/history-sidebar";
import { SquadMembers } from "@/components/squad-members";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { type Demand } from "@shared/schema";
import Logo from "@/components/ui/logo";
import { useTheme } from "next-themes";

export default function Home() {
  const [selectedDemand, setSelectedDemand] = useState<Demand | null>(null);
  const { theme, setTheme } = useTheme();

  const { data: demands = [] } = useQuery({
    queryKey: ['/api/demands'],
    queryFn: () => api.demands.getAll(),
    refetchInterval: 5000,
  });

  const handleSelectDemand = (demand: Demand) => {
    setSelectedDemand(demand);
  };

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  return (
    <div className="font-sans min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-3">
              <Logo size="md" showText={true} />
            </div>
            <div className="flex items-center space-x-4">
              <button
                onClick={toggleTheme}
                className="p-2 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
                aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              >
                {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
              </button>
              <div className="hidden sm:flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-300">
                <Circle className="w-2 h-2 bg-green-500 dark:bg-green-400 rounded-full fill-current" />
                <span>Sistema Online</span>
              </div>
              <button className="p-2 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700">
                <Settings size={16} />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Status Alert */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/30 dark:to-indigo-900/30 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Sparkles className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              <div>
                <p className="font-semibold text-gray-800 dark:text-gray-200">Sistema Operacional</p>
                <p className="text-sm text-gray-600 dark:text-gray-300">Nossos agentes de IA estão prontos para refinar sua demanda</p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Circle className="w-2 h-2 bg-green-500 dark:bg-green-400 rounded-full fill-current" />
              <span className="text-sm font-medium text-green-700 dark:text-green-400">Online</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Chat Area - now spans 3 columns */}
          <div className="lg:col-span-3 space-y-6">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm">
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
