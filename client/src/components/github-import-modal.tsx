
import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Loader2, Github, Check } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

interface GitHubImportModalProps {
  onImportSuccess: (indexedContent: string, analysisResult: string, repoName?: string) => void;
  demandDescription?: string;
}

export function GitHubImportModal({ onImportSuccess }: GitHubImportModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedRepo, setSelectedRepo] = useState<string | null>(null);
  const [repoSearch, setRepoSearch] = useState('');

  const { data: repos, isLoading: isLoadingRepos, isError: isErrorRepos } = useQuery({
    queryKey: ['github/repos'],
    queryFn: () => api.github.listRepos(),
    enabled: isOpen,
  });

  const handleRepoSelect = (repoFullName: string) => {
    setSelectedRepo(repoFullName);
    // Pass the selected repo name back to the parent. The other parameters are now irrelevant.
    onImportSuccess("", "", repoFullName);
    setIsOpen(false);
  };

  const filteredRepos = repos?.filter(repo =>
    repo.full_name.toLowerCase().includes(repoSearch.toLowerCase())
  ) || [];

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Github className="mr-2" size={16} />
          Adicionar Projeto
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Selecionar Repositório do GitHub</DialogTitle>
          <DialogDescription>
            Selecione o repositório que a squad deve usar como contexto para refinar a demanda.
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
                      selectedRepo === repo.full_name && "bg-green-100 dark:bg-green-900" // Highlight in green
                    )}
                    onClick={() => handleRepoSelect(repo.full_name)}
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
        </div>
      </DialogContent>
    </Dialog>
  );
}
