import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import CustomDisclaimer from "@/components/ui/custom-disclaimer";
import Home from "@/pages/home";
import NotFound from "@/pages/not-found";
import { ThemeProvider } from "next-themes";
import { EnhancedThemeProvider } from "@/components/ui/theme-provider";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <EnhancedThemeProvider>
        <QueryClientProvider client={queryClient}>
          <TooltipProvider>
            <Toaster />
            <div className="min-h-screen flex flex-col bg-background dark:bg-darkBackground text-foreground dark:text-darkTextPrimary">
              <Router />
              <footer className="mt-auto">
                <CustomDisclaimer
                  title="Sobre o AICHATflow"
                  variant="note"
                  className="border-0 rounded-none dark:border-darkBorder"
                >
                  <p className="text-sm dark:text-darkTextSecondary">
                    Esta plataforma utiliza inteligência artificial para refinar demandas com
                    colaboração entre agentes especializados. Os agentes trabalham juntos para
                    entender completamente seu pedido antes de gerar documentos finais.
                  </p>
                </CustomDisclaimer>
              </footer>
            </div>
          </TooltipProvider>
        </QueryClientProvider>
      </EnhancedThemeProvider>
    </ThemeProvider>
  );
}

export default App;
