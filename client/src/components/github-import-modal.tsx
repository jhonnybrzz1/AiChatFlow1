
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
  onImportSuccess: (indexedContent: string, analysisResult: string, repoName?: string) => void;
  demandDescription?: string;
}

export function GitHubImportModal({ onImportSuccess, demandDescription }: GitHubImportModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedRepo, setSelectedRepo] = useState<string | null>(null);
  const [repoSearch, setRepoSearch] = useState('');
  const [indexedRepoName, setIndexedRepoName] = useState<string | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

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
        title: "Repositório analisado com sucesso!",
        description: "O conteúdo do repositório foi carregado para análise.",
      });
      onImportSuccess(data.content, data.analysisResult, data.repoName);
      setIndexedRepoName(data.repoName);
      setIsOpen(false);
      setSelectedRepo(null);
      setRepoSearch('');
    },
    onError: (error) => {
      toast({
        title: "Erro ao analisar repositório",
        description: error.message,
        variant: "destructive",
      });
      setIndexedRepoName(null);
    },
  });

  const handleCancelSelection = () => {
    setSelectedRepo(null);
  };

  const filteredRepos = repos?.filter(repo =>
    repo.full_name.toLowerCase().includes(repoSearch.toLowerCase())
  ) || [];

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          disabled={indexRepoMutation.isPending}
        >
          {indexRepoMutation.isPending ? (
            <FaSpinner className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Github size={16} />
          )}
          <span>
            {indexRepoMutation.isPending
              ? "Analisando..."
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
            {indexRepoMutation.isPending ? (
              <Button disabled className="flex-1">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Analisando repositório automaticamente...
              </Button>
            ) : (
              <Button
                disabled={!selectedRepo}
                onClick={handleCancelSelection}
                variant="outline"
                className="flex-1"
              >
                {selectedRepo ? 'Cancelar seleção' : 'Selecione um repositório'}
              </Button>
            )}
          </div>
          {selectedRepo && !indexRepoMutation.isPending && (
            <div className="mt-2 text-sm text-muted-foreground">
              🤖 A squad virtual irá analisar automaticamente este repositório quando você criar a demanda
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
