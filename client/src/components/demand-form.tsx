import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import CustomDisclaimer from "@/components/ui/custom-disclaimer";
import { Plus, TrendingUp, Bug, Compass, BarChart, CloudUpload, Send, Github, ChevronDown, ChevronUp, X, CheckCircle } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertDemandSchema } from "@shared/schema";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { GitHubImportModal } from "./github-import-modal";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import LoadingSpinner from "./ui/loading-spinner";

const demandTypes = [
  { value: "nova_funcionalidade", label: "Nova Funcionalidade", icon: Plus },
  { value: "melhoria", label: "Melhoria", icon: TrendingUp },
  { value: "bug", label: "Bug", icon: Bug },
  { value: "discovery", label: "Discovery", icon: Compass },
  { value: "analise_exploratoria", label: "Análise Exploratória", icon: BarChart },
];

const priorities = [
  { value: "baixa", label: "Baixa" },
  { value: "media", label: "Média" },
  { value: "alta", label: "Alta" },
  { value: "critica", label: "Crítica" },
];

export function DemandForm() {
  const [selectedType, setSelectedType] = useState("nova_funcionalidade");
  const [selectedFiles, setSelectedFiles] = useState<FileList | null>(null);
  const [selectedRepo, setSelectedRepo] = useState<string | null>(null); // New unified state
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isFocused, setIsFocused] = useState({
    title: false,
    description: false,
    type: false,
    priority: false,
  });
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm({
    resolver: zodResolver(insertDemandSchema),
    defaultValues: {
      title: "",
      description: "",
      type: "nova_funcionalidade",
      priority: "media",
    },
  });

  const createDemandMutation = useMutation({
    mutationFn: ({ demand, files, githubRepoOwner, githubRepoName }: {
      demand: typeof insertDemandSchema._type,
      files?: FileList,
      githubRepoOwner?: string,
      githubRepoName?: string
    }) => {
      const formData = new FormData();
      Object.entries(demand).forEach(([key, value]) => {
        formData.append(key, value as string);
      });
      if (githubRepoOwner && githubRepoName) {
        formData.append('githubRepoOwner', githubRepoOwner);
        formData.append('githubRepoName', githubRepoName);
        // Also add to description for the backend to parse
        formData.set('description', `${demand.description}\n\n---\n**Contexto do Repositório GitHub:**\nRepositório: ${githubRepoOwner}/${githubRepoName}\n`);
      }
      if (files) {
        Array.from(files).forEach((file) => {
          formData.append('files', file);
        });
      }
      return api.demands.createWithFormData(formData);
    },
    onSuccess: () => {
      toast({
        title: "Demanda criada com sucesso",
        description: "A squad está processando sua solicitação.",
      });
      form.reset();
      setSelectedFiles(null);
      setSelectedRepo(null); // Reset selected repo
      setIsCollapsed(true);
      queryClient.invalidateQueries({ queryKey: ['/api/demands'] });
      setTimeout(() => {
        const chatArea = document.querySelector('[data-chat-area]');
        if (chatArea) {
          chatArea.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 500);
    },
    onError: (error) => {
      toast({
        title: "Erro ao criar demanda",
        description: error.message || "Ocorreu um erro ao processar sua solicitação",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: typeof insertDemandSchema._type) => {
    let githubRepoOwner: string | undefined;
    let githubRepoName: string | undefined;
    if (selectedRepo) {
      [githubRepoOwner, githubRepoName] = selectedRepo.split('/');
    }
    createDemandMutation.mutate({ demand: data, files: selectedFiles || undefined, githubRepoOwner, githubRepoName });
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSelectedFiles(event.target.files);
  };

  const handleRepoSelect = (_indexedContent: string, _analysisResult: string, repoName?: string) => {
    if (repoName) {
      setSelectedRepo(repoName);
      toast({
        title: "Repositório selecionado!",
        description: `O repositório ${repoName} será usado como contexto.`,
      });
    }
  };

  const handleRemoveFile = (indexToRemove: number) => {
    if (selectedFiles) {
      const dt = new DataTransfer();
      Array.from(selectedFiles).forEach((file, index) => {
        if (index !== indexToRemove) {
          dt.items.add(file);
        }
      });
      setSelectedFiles(dt.files.length > 0 ? dt.files : null);
    }
  };

  return (
    <Card className="shadow-lg rounded-xl border-0 bg-gradient-to-br from-gray-50 to-white dark:from-gray-800/50 dark:to-gray-900/50">
      <CardHeader
        className="cursor-pointer p-5 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/30 dark:to-indigo-900/30 rounded-t-xl border-b border-gray-200 dark:border-gray-700"
        onClick={() => setIsCollapsed(!isCollapsed)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            setIsCollapsed(!isCollapsed);
          }
        }}
        aria-expanded={!isCollapsed}
        aria-controls="demand-form-content"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="bg-blue-500 dark:bg-blue-600 p-2 rounded-lg">
              <Plus className="w-5 h-5 text-white" />
            </div>
            <CardTitle className="text-lg font-semibold text-gray-800 dark:text-white">Nova Demanda</CardTitle>
          </div>
          <Button
            variant="ghost"
            size="sm"
            type="button"
            className="h-8 w-8 p-0 rounded-full hover:bg-blue-100 dark:hover:bg-blue-900/50"
            aria-label={isCollapsed ? "Expandir formulário" : "Recolher formulário"}
          >
            {isCollapsed ? <ChevronDown size={20} /> : <ChevronUp size={20} />}
          </Button>
        </div>
      </CardHeader>
      {!isCollapsed && (
        <CardContent id="demand-form-content" className="p-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">

              <CustomDisclaimer title="Dicas para criar uma boa demanda" variant="info">
                <ul className="list-disc pl-5 space-y-1 text-sm">
                  <li>Descreva detalhadamente o problema ou necessidade</li>
                  <li>Explique o contexto e os objetivos esperados</li>
                  <li>Adicione informações técnicas relevantes</li>
                  <li>Priorize conforme impacto no negócio</li>
                </ul>
              </CustomDisclaimer>
              
              <div className="space-y-2">
                <Label>Contexto do Projeto (Opcional)</Label>
                {selectedRepo ? (
                  <div className="flex items-center justify-between p-2 rounded-lg bg-green-100 dark:bg-green-900/30 border border-green-200 dark:border-green-800">
                    <div className="flex items-center gap-2 text-green-800 dark:text-green-300">
                      <CheckCircle size={16} />
                      <span className="font-medium">{selectedRepo}</span>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedRepo(null)}
                      className="h-6 w-6 p-0 rounded-full text-green-600 hover:bg-green-200 dark:text-green-400 dark:hover:bg-green-800"
                    >
                      <X size={14} />
                    </Button>
                  </div>
                ) : (
                  <GitHubImportModal
                    onImportSuccess={handleRepoSelect}
                    demandDescription={form.watch('description')}
                  />
                )}
              </div>

              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className={`block text-sm font-medium mb-2 ${isFocused.type ? 'text-blue-600 dark:text-blue-400' : 'text-gray-700 dark:text-gray-300'}`}>
                      Tipo de Demanda
                    </FormLabel>
                    <FormControl>
                      <Tabs
                        value={selectedType}
                        onValueChange={(value) => {
                          setSelectedType(value);
                          field.onChange(value);
                        }}
                        className="w-full"
                      >
                        <TabsList className="grid w-full grid-cols-5 bg-gray-100 dark:bg-gray-700 p-1 rounded-lg border-0">
                          {demandTypes.map((type) => {
                            const Icon = type.icon;
                            return (
                              <TabsTrigger
                                key={type.value}
                                value={type.value}
                                className={cn(
                                  "h-14 flex flex-col items-center gap-1 data-[state=active]:bg-white data-[state=active]:text-blue-600 data-[state=active]:shadow-sm dark:data-[state=active]:bg-gray-800 dark:data-[state=active]:text-blue-400",
                                  selectedType === type.value ? 'text-blue-600 dark:text-blue-400' : 'text-gray-600 dark:text-gray-300'
                                )}
                                aria-selected={selectedType === type.value}
                              >
                                <Icon size={16} />
                                <span className="text-xs hidden sm:inline">{type.label}</span>
                              </TabsTrigger>
                            );
                          })}
                        </TabsList>
                      </Tabs>
                    </FormControl>
                    <FormMessage className="mt-2" />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className={`block text-sm font-medium mb-2 ${isFocused.title ? 'text-blue-600 dark:text-blue-400' : 'text-gray-700 dark:text-gray-300'}`}>
                      Título da Demanda
                    </FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Ex: Sistema de autenticação por biometria"
                        className={cn("transition-all duration-200 bg-white dark:bg-gray-800 text-gray-900 dark:text-white border-gray-300 dark:border-gray-600", form.formState.errors.title ? "border-red-500 ring-red-500 dark:border-red-500 dark:ring-red-500" : "")}
                        {...field}
                        aria-invalid={!!form.formState.errors.title}
                      />
                    </FormControl>
                    <FormMessage className="mt-2" />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className={`block text-sm font-medium mb-2 ${isFocused.description ? 'text-blue-600 dark:text-blue-400' : 'text-gray-700 dark:text-gray-300'}`}>
                      Descrição Detalhada
                    </FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Descreva sua demanda em detalhes. Inclua contexto, objetivos e qualquer informação relevante..."
                        rows={5}
                        className={cn("resize-none transition-all duration-200 bg-white dark:bg-gray-800 text-gray-900 dark:text-white border-gray-300 dark:border-gray-600", form.formState.errors.description ? "border-red-500 ring-red-500 dark:border-red-500 dark:ring-red-500" : "")}
                        {...field}
                        aria-invalid={!!form.formState.errors.description}
                      />
                    </FormControl>
                    <FormMessage className="mt-2" />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="priority"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className={`block text-sm font-medium mb-2 ${isFocused.priority ? 'text-blue-600 dark:text-blue-400' : 'text-gray-700 dark:text-gray-300'}`}>
                      Prioridade
                    </FormLabel>
                    <FormControl>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger
                          className={cn("w-full bg-white dark:bg-gray-800 text-gray-900 dark:text-white border-gray-300 dark:border-gray-600", form.formState.errors.priority ? "border-red-500 ring-red-500 dark:border-red-500 dark:ring-red-500" : "")}
                          aria-invalid={!!form.formState.errors.priority}
                        >
                          <SelectValue placeholder="Selecione a prioridade" />
                        </SelectTrigger>
                        <SelectContent className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                          {priorities.map((priority) => (
                            <SelectItem
                              key={priority.value}
                              value={priority.value}
                              className="bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                            >
                              {priority.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormControl>
                    <FormMessage className="mt-2" />
                  </FormItem>
                )}
              />

              <div className="space-y-2">
                <Label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Anexar Documentos (Opcional)</Label>
                <div
                  className={cn("border-2 border-dashed rounded-xl p-6 text-center transition-colors", selectedFiles ? "border-green-500 bg-green-50 dark:border-green-500 dark:bg-green-900/20" : "border-gray-300 hover:border-blue-500 bg-gray-50 dark:border-gray-600 dark:bg-gray-800/50 dark:hover:border-blue-500")}
                >
                  <CloudUpload className="mx-auto text-gray-400 dark:text-gray-500 mb-2" size={24} />
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Arraste arquivos aqui ou{" "}
                    <label className="text-blue-600 dark:text-blue-400 cursor-pointer hover:text-blue-800 dark:hover:text-blue-300 font-medium">
                      clique para selecionar
                      <input type="file" className="hidden" accept=".txt,.pdf,.docx" multiple onChange={handleFileChange} aria-label="Selecionar arquivos para anexar" />
                    </label>
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Formatos suportados: .txt, .pdf, .docx
                  </p>
                  {selectedFiles && (
                    <div className="mt-3 space-y-2">
                      {Array.from(selectedFiles).map((file, index) => (
                        <div key={index} className="flex items-center justify-between bg-white dark:bg-gray-800 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-sm">
                          <div className="flex items-center truncate">
                            <span className="text-gray-900 dark:text-gray-100 truncate" title={file.name}>
                              {file.name}
                            </span>
                            <span className="text-gray-500 dark:text-gray-400 ml-2 text-xs">
                              ({Math.round(file.size / 1024)}KB)
                            </span>
                          </div>
                          <Button type="button" variant="ghost" size="sm" onClick={() => handleRemoveFile(index)} className="h-6 w-6 p-0 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-full" aria-label={`Remover arquivo ${file.name}`}>
                            <X size={14} className="text-red-500 dark:text-red-400" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex justify-end pt-4">
                <Button
                  type="submit"
                  disabled={createDemandMutation.isPending}
                  className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg transition-colors dark:bg-blue-700 dark:hover:bg-blue-800"
                >
                  {createDemandMutation.isPending ? (
                    <>
                      <LoadingSpinner size="sm" />
                      <span>Enviando...</span>
                    </>
                  ) : (
                    <>
                      <Send size={16} />
                      <span>Enviar para Squad</span>
                    </>
                  )}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      )}
    </Card>
  );
}
