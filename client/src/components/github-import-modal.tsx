
import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Loader2, Github, Check } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { FaCheck, FaSpinner } from 'react-icons/fa'; // Import react-icons

interface GitHubImportModalProps {
  onImportSuccess: (indexedContent: string, analysisResult: string) => void;
  demandDescription?: string;
}

export function GitHubImportModal({ onImportSuccess, demandDescription }: GitHubImportModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedRepo, setSelectedRepo] = useState<string | null>(null);
  const [repoSearch, setRepoSearch] = useState('');
  const [showGenericWarning, setShowGenericWarning] = useState(false);
  const [isIndexed, setIsIndexed] = useState(false); // New state
  const [indexedRepoName, setIndexedRepoName] = useState<string | null>(null); // New state
  const [countdown, setCountdown] = useState<number>(0); // Countdown timer
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Auto-index timer effect
  useEffect(() => {
    if (selectedRepo && !indexRepoMutation.isPending) {
      // Start countdown from 3 seconds
      setCountdown(3);

      const countdownInterval = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) {
            clearInterval(countdownInterval);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      // Set timer to auto-index after 3 seconds
      timerRef.current = setTimeout(() => {
        handleIndexRepo();
      }, 3000);

      return () => {
        clearInterval(countdownInterval);
        if (timerRef.current) {
          clearTimeout(timerRef.current);
          timerRef.current = null;
        }
      };
    } else {
      setCountdown(0);
    }
  }, [selectedRepo, indexRepoMutation.isPending]);

  const { data: repos, isLoading: isLoadingRepos, isError: isErrorRepos } = useQuery({
    queryKey: ['github/repos'],
    queryFn: () => api.github.listRepos(),
    enabled: isOpen,
  });

  const indexRepoMutation = useMutation({
    mutationFn: ({ owner, repo, demandDescription }: { owner: string; repo: string; demandDescription?: string }) =>
      api.github.indexRepo(owner, repo, demandDescription),
    onSuccess: (data) => {
      toast({
        title: "Repositório indexado com sucesso!",
        description: "O conteúdo do repositório foi carregado para análise.",
      });
      onImportSuccess(data.content, data.analysisResult);
      setIsIndexed(true);
      setIndexedRepoName(data.repoName); // Set repo name from API response
      setIsOpen(false);
      setSelectedRepo(null);
      setRepoSearch('');
    },
    onError: (error) => {
      toast({
        title: "Erro ao indexar repositório",
        description: error.message,
        variant: "destructive",
      });
      setIsIndexed(false);
      setIndexedRepoName(null);
    },
  });

  const handleIndexRepo = () => {
    if (selectedRepo) {
      if (!demandDescription || demandDescription.trim() === '') {
        setShowGenericWarning(true);
      } else {
        setShowGenericWarning(false);
      }
      const [owner, repo] = selectedRepo.split('/');
      indexRepoMutation.mutate({ owner, repo, demandDescription });
    }
  };

  const handleCancelSelection = () => {
    setSelectedRepo(null);
    setCountdown(0);
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const filteredRepos = repos?.filter(repo => 
    repo.full_name.toLowerCase().includes(repoSearch.toLowerCase())
  ) || [];

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          className={cn("flex items-center space-x-2", isIndexed && "bg-green-100 text-green-700 hover:bg-green-200")}
          disabled={indexRepoMutation.isPending}
        >
          {indexRepoMutation.isPending ? (
            <FaSpinner className="mr-2 h-4 w-4 animate-spin" />
          ) : isIndexed ? (
            <FaCheck className="mr-2 h-4 w-4" />
          ) : (
            <Github size={16} />
          )}
          <span>
            {indexRepoMutation.isPending
              ? "Indexando..."
              : isIndexed && indexedRepoName
              ? `Indexado: ${indexedRepoName}`
              : "Importar do GitHub"}
          </span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Importar Repositório do GitHub</DialogTitle>
          <DialogDescription>
            Selecione um repositório para importar e iniciar a análise.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Input 
            placeholder="Buscar repositórios..." 
            value={repoSearch} 
            onChange={(e) => setRepoSearch(e.target.value)} 
          />

          {showGenericWarning && (
            <div className="bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 p-4" role="alert">
              <p className="font-bold">Modo genérico ativado!</p>
              <p>A análise pode gerar sugestões fora do escopo atual, pois nenhuma demanda específica foi fornecida.</p>
            </div>
          )}

          {isLoadingRepos && (
            <div className="flex items-center justify-center p-4">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <span className="ml-2 text-muted-foreground">Carregando repositórios...</span>
            </div>
          )}

          {isErrorRepos && (
            <div className="text-destructive text-center p-4">
              Erro ao carregar repositórios. Verifique seu token de acesso pessoal do GitHub.
            </div>
          )}

          {!isLoadingRepos && !isErrorRepos && filteredRepos.length === 0 && (
            <div className="text-muted-foreground text-center p-4">
              Nenhum repositório encontrado.
            </div>
          )}

          {!isLoadingRepos && filteredRepos.length > 0 && (
            <ScrollArea className="h-[300px] w-full rounded-md border">
              <div className="p-4">
                {filteredRepos.map((repo) => (
                  <div
                    key={repo.id}
                    className={cn(
                      "flex items-center justify-between p-2 cursor-pointer hover:bg-muted rounded-md",
                      selectedRepo === repo.full_name && "bg-muted"
                    )}
                    onClick={() => setSelectedRepo(repo.full_name)}
                  >
                    <span>{repo.full_name}</span>
                    {selectedRepo === repo.full_name && (
                      <Check className="h-4 w-4 text-green-500" />
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}

          <div className="flex gap-2">
            <Button
              onClick={handleIndexRepo}
              disabled={!selectedRepo || indexRepoMutation.isPending}
              className="flex-1"
            >
              {indexRepoMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Indexando...
                </>
              ) : countdown > 0 ? (
                <>
                  <Github className="mr-2 h-4 w-4" />
                  Indexando em {countdown}s...
                </>
              ) : (
                <>
                  <Github className="mr-2 h-4 w-4" />
                  Indexar Repositório
                </>
              )}
            </Button>
            {selectedRepo && countdown > 0 && !indexRepoMutation.isPending && (
              <Button
                onClick={handleCancelSelection}
                variant="outline"
              >
                Cancelar
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
