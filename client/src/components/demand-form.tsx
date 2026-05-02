import React, { useState } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Plus, TrendingUp, Bug, Compass, BarChart, Upload, Send, X, CheckCircle, ChevronDown, ChevronUp, AlertCircle, Loader2, Code, Briefcase } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertDemandSchema, type InsertDemand } from "@shared/schema";
import { Form, FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { GitHubImportModal } from "./github-import-modal";
import { DEMAND_TYPES, type DemandType } from "@shared/demand-types";

const demandTypeIconMap = {
  Plus,
  TrendingUp,
  Bug,
  Compass,
  BarChart,
};

const demandTypes = Object.entries(DEMAND_TYPES).map(([value, config]) => ({
  value: value as DemandType,
  ...config,
  icon: demandTypeIconMap[config.icon],
}));

const priorities = [
  { value: "baixa", label: "BAIXA", color: "text-[var(--foreground-muted)]" },
  { value: "media", label: "MÉDIA", color: "text-[var(--accent-lime)]" },
  { value: "alta", label: "ALTA", color: "text-[var(--accent-orange)]" },
  { value: "critica", label: "CRÍTICA", color: "text-[var(--destructive)]" },
];

const refinementTypes = [
  {
    value: "technical",
    label: "TÉCNICO",
    icon: Code,
    color: "cyan",
    description: "Arquitetura, componentes, dependências, trade-offs"
  },
  {
    value: "business",
    label: "NEGÓCIOS",
    icon: Briefcase,
    color: "lime",
    description: "Objetivo, valor, impacto, prioridade"
  },
];

export function DemandForm() {
  const [selectedType, setSelectedType] = useState<DemandType>("nova_funcionalidade");
  const [selectedRefinementType, setSelectedRefinementType] = useState<"technical" | "business">("business");
  const [selectedFiles, setSelectedFiles] = useState<FileList | null>(null);
  const [selectedRepo, setSelectedRepo] = useState<string | null>(null);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<InsertDemand>({
    resolver: zodResolver(insertDemandSchema),
    defaultValues: {
      title: "",
      description: "",
      type: "nova_funcionalidade",
      priority: "media",
    },
  });

  const createDemandMutation = useMutation({
    mutationFn: ({ demand, files, githubRepoOwner, githubRepoName, refinementType }: {
      demand: InsertDemand,
      files?: FileList,
      githubRepoOwner?: string,
      githubRepoName?: string,
      refinementType?: "technical" | "business"
    }) => {
      const formData = new FormData();
      Object.entries(demand).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          formData.append(key, value as string);
        }
      });
      // Usar set() para garantir que refinementType nunca seja duplicado
      if (refinementType) {
        formData.set('refinementType', refinementType);
      }
      if (githubRepoOwner && githubRepoName) {
        formData.append('githubRepoOwner', githubRepoOwner);
        formData.append('githubRepoName', githubRepoName);
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
        title: "Demanda enviada para a Squad",
        description: `Os agentes de IA estão processando sua solicitação no modo ${selectedRefinementType === 'technical' ? 'Técnico' : 'Negócios'}.`,
      });
      form.reset();
      setSelectedFiles(null);
      setSelectedRepo(null);
      setSelectedType("nova_funcionalidade");
      setSelectedRefinementType("business");
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

  const onSubmit = (data: InsertDemand) => {
    let githubRepoOwner: string | undefined;
    let githubRepoName: string | undefined;
    if (selectedRepo) {
      [githubRepoOwner, githubRepoName] = selectedRepo.split('/');
    }
    createDemandMutation.mutate({
      demand: data,
      files: selectedFiles || undefined,
      githubRepoOwner,
      githubRepoName,
      refinementType: selectedRefinementType
    });
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSelectedFiles(event.target.files);
  };

  const handleRepoSelect = (_indexedContent: string, _analysisResult: string, repoName?: string) => {
    if (repoName) {
      setSelectedRepo(repoName);
      toast({
        title: "Repositório vinculado",
        description: `${repoName} será usado como contexto.`,
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

  const getTypeColor = (color: string) => {
    switch (color) {
      case "cyan": return "var(--accent-cyan)";
      case "lime": return "var(--accent-lime)";
      case "magenta": return "var(--accent-magenta)";
      case "violet": return "var(--accent-violet)";
      case "orange": return "var(--accent-orange)";
      default: return "var(--accent-cyan)";
    }
  };

  return (
    <div className="neo-card">
      {/* Header */}
      <button
        className="w-full flex items-center justify-between p-4 border-b-2 border-[var(--border)] bg-[var(--muted)] hover:bg-[var(--background)] transition-colors"
        onClick={() => setIsCollapsed(!isCollapsed)}
        aria-expanded={!isCollapsed}
        aria-controls="demand-form-content"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-[var(--accent-cyan)] flex items-center justify-center">
            <Plus className="w-4 h-4 text-[var(--background)]" />
          </div>
          <span className="font-mono text-sm font-bold tracking-wide">NOVA DEMANDA</span>
        </div>
        <div className="w-8 h-8 flex items-center justify-center border border-[var(--border)]">
          {isCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
        </div>
      </button>

      {/* Form Content */}
      {!isCollapsed && (
        <div id="demand-form-content" className="p-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">

              {/* Tips Banner */}
              <div className="border-l-4 border-[var(--accent-cyan)] bg-[var(--muted)] p-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-[var(--accent-cyan)] flex-shrink-0 mt-0.5" />
                  <div className="font-mono text-xs space-y-1">
                    <p className="font-bold text-[var(--foreground)]">DICAS PARA UMA BOA DEMANDA:</p>
                    <ul className="text-[var(--foreground-muted)] space-y-0.5">
                      <li>→ Descreva detalhadamente o problema ou necessidade</li>
                      <li>→ Inclua contexto técnico e objetivos esperados</li>
                      <li>→ Anexe documentos relevantes se disponível</li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* GitHub Context */}
              <div className="space-y-2">
                <Label className="font-mono text-xs text-[var(--foreground-muted)]">CONTEXTO DO PROJETO (OPCIONAL)</Label>
                {selectedRepo ? (
                  <div className="flex items-center justify-between p-3 border-2 border-[var(--success)] bg-[var(--success)]/5">
                    <div className="flex items-center gap-2 font-mono text-sm">
                      <CheckCircle className="w-4 h-4 text-[var(--success)]" />
                      <span className="text-[var(--success)]">{selectedRepo}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedRepo(null)}
                      className="w-6 h-6 flex items-center justify-center hover:bg-[var(--destructive)]/10 transition-colors"
                    >
                      <X className="w-4 h-4 text-[var(--destructive)]" />
                    </button>
                  </div>
                ) : (
                  <GitHubImportModal
                    onImportSuccess={handleRepoSelect}
                    demandDescription={form.watch('description')}
                  />
                )}
              </div>

              {/* Demand Type Tabs */}
              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <Label className="font-mono text-xs text-[var(--foreground-muted)]">TIPO DE DEMANDA</Label>
                    <FormControl>
                      <div className="brutal-tabs mt-2">
                        {demandTypes.map((type) => {
                          const Icon = type.icon;
                          const isActive = selectedType === type.value;
                          return (
	                            <button
	                              key={type.value}
	                              type="button"
	                              onClick={() => {
	                                setSelectedType(type.value);
	                                field.onChange(type.value);

	                                // Só atualiza a prioridade se ela não tiver sido alterada manualmente
	                                if (!form.getFieldState('priority').isDirty) {
	                                  form.setValue('priority', type.suggestedPriority, {
	                                    shouldDirty: false, // Mantém como não dirty se for sugestão
	                                    shouldValidate: true,
	                                  });
	                                }
	                              }}
                              className={cn(
                                "brutal-tab flex flex-col items-center gap-1 py-3",
                                isActive && "active"
                              )}
                              style={{
                                borderBottomColor: isActive ? getTypeColor(type.color) : undefined,
                                borderBottomWidth: isActive ? '3px' : undefined,
                              }}
                            >
                              <Icon className="w-4 h-4" style={{ color: isActive ? undefined : getTypeColor(type.color) }} />
                              <span className="hidden sm:inline text-[10px]">{type.label}</span>
                              <span className="sm:hidden text-[10px]">{type.shortLabel}</span>
                            </button>
                          );
                        })}
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Title */}
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <Label className="font-mono text-xs text-[var(--foreground-muted)]">TÍTULO DA DEMANDA</Label>
                    <FormControl>
                      <Input
                        placeholder="Ex: Sistema de autenticação por biometria"
                        className="terminal-input mt-2"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Description */}
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <Label className="font-mono text-xs text-[var(--foreground-muted)]">DESCRIÇÃO DETALHADA</Label>
                    <FormControl>
                      <Textarea
                        placeholder="Descreva sua demanda em detalhes. Inclua contexto, objetivos e qualquer informação relevante..."
                        rows={5}
                        className="terminal-input mt-2 resize-none"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Priority */}
              <FormField
                control={form.control}
                name="priority"
                render={({ field }) => (
                  <FormItem>
                    <Label className="font-mono text-xs text-[var(--foreground-muted)]">PRIORIDADE</Label>
                    <FormControl>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger className="terminal-input mt-2">
                          <SelectValue placeholder="Selecione a prioridade" />
                        </SelectTrigger>
                        <SelectContent className="bg-[var(--background)] border-2 border-[var(--border)]">
                          {priorities.map((priority) => (
                            <SelectItem
                              key={priority.value}
                              value={priority.value}
                              className={cn("font-mono", priority.color)}
                            >
                              [{priority.value.toUpperCase()}] {priority.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Refinement Type */}
              <div className="space-y-2">
                <Label className="font-mono text-xs text-[var(--foreground-muted)]">TIPO DE REFINAMENTO</Label>
                <div className="grid grid-cols-2 gap-3 mt-2">
                  {refinementTypes.map((refType) => {
                    const Icon = refType.icon;
                    const isActive = selectedRefinementType === refType.value;
                    return (
                      <button
                        key={refType.value}
                        type="button"
                        onClick={() => setSelectedRefinementType(refType.value as "technical" | "business")}
                        className={cn(
                          "flex flex-col items-center gap-2 p-4 border-2 transition-all",
                          isActive
                            ? "border-[var(--accent-" + refType.color + ")] bg-[var(--accent-" + refType.color + ")]/10"
                            : "border-[var(--border)] hover:border-[var(--foreground-muted)]"
                        )}
                        style={{
                          borderColor: isActive ? `var(--accent-${refType.color})` : undefined,
                          backgroundColor: isActive ? `var(--accent-${refType.color})10` : undefined,
                        }}
                      >
                        <div
                          className={cn(
                            "w-10 h-10 flex items-center justify-center",
                            isActive ? "bg-[var(--accent-" + refType.color + ")]" : "bg-[var(--muted)]"
                          )}
                          style={{
                            backgroundColor: isActive ? `var(--accent-${refType.color})` : undefined,
                          }}
                        >
                          <Icon
                            className="w-5 h-5"
                            style={{
                              color: isActive ? 'var(--background)' : `var(--accent-${refType.color})`
                            }}
                          />
                        </div>
                        <span className={cn(
                          "font-mono text-sm font-bold",
                          isActive && "text-[var(--foreground)]"
                        )}>
                          {refType.label}
                        </span>
                        <span className="font-mono text-[10px] text-[var(--foreground-muted)] text-center">
                          {refType.description}
                        </span>
                      </button>
                    );
                  })}
                </div>
                <p className="font-mono text-[10px] text-[var(--foreground-muted)] mt-1">
                  O tipo define a estrutura esperada do refinamento gerado.
                </p>
              </div>

              {/* File Upload */}
              <div className="space-y-2">
                <Label className="font-mono text-xs text-[var(--foreground-muted)]">ANEXAR DOCUMENTOS (OPCIONAL)</Label>
                <div
                  className={cn(
                    "upload-zone mt-2",
                    selectedFiles && "has-files"
                  )}
                >
                  <label className="cursor-pointer block">
                    <Upload className="w-8 h-8 mx-auto mb-3 text-[var(--foreground-muted)]" />
                    <p className="font-mono text-sm">
                      Arraste arquivos ou{" "}
                      <span className="text-[var(--accent-cyan)] underline">clique para selecionar</span>
                    </p>
                    <p className="font-mono text-xs text-[var(--foreground-muted)] mt-1">
                      Formatos: .txt, .pdf, .docx
                    </p>
                    <input
                      type="file"
                      className="hidden"
                      accept=".txt,.pdf,.docx"
                      multiple
                      onChange={handleFileChange}
                    />
                  </label>
                </div>

                {/* File List */}
                {selectedFiles && (
                  <div className="space-y-2 mt-3">
                    {Array.from(selectedFiles).map((file, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-2 border border-[var(--border)] bg-[var(--muted)]"
                      >
                        <div className="flex items-center gap-2 font-mono text-xs truncate">
                          <span className="text-[var(--success)]">✓</span>
                          <span className="truncate">{file.name}</span>
                          <span className="text-[var(--foreground-muted)]">
                            ({Math.round(file.size / 1024)}KB)
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveFile(index)}
                          className="w-6 h-6 flex items-center justify-center hover:bg-[var(--destructive)]/10"
                        >
                          <X className="w-3 h-3 text-[var(--destructive)]" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Submit Button */}
              <div className="pt-4">
                <button
                  type="submit"
                  disabled={createDemandMutation.isPending}
                  className={cn(
                    "cmd-button primary w-full flex items-center justify-center gap-2",
                    createDemandMutation.isPending && "opacity-50 cursor-not-allowed"
                  )}
                >
                  {createDemandMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>ENVIANDO...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      <span>ENVIAR PARA SQUAD</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </Form>
        </div>
      )}
    </div>
  );
}
