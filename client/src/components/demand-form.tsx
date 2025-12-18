import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import CustomAlert from "@/components/ui/custom-alert";
import CustomDisclaimer from "@/components/ui/custom-disclaimer";
import { Plus, TrendingUp, Bug, Compass, BarChart, CloudUpload, Send, Github, ChevronDown, ChevronUp, X, AlertTriangle, CheckCircle } from "lucide-react";
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

// Ordenadas logicamente: Baixa → Média → Alta → Crítica
const priorities = [
  { value: "baixa", label: "Baixa" },
  { value: "media", label: "Média" },
  { value: "alta", label: "Alta" },
  { value: "critica", label: "Crítica" },
];

export function DemandForm() {
  const [selectedType, setSelectedType] = useState("nova_funcionalidade");
  const [selectedFiles, setSelectedFiles] = useState<FileList | null>(null);
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
    mutationFn: ({ demand, files }: { demand: typeof insertDemandSchema._type, files?: FileList }) =>
      api.demands.create(demand, files),
    onSuccess: () => {
      toast({
        title: "Demanda criada com sucesso",
        description: "A squad está processando sua solicitação.",
      });
      form.reset();
      setSelectedFiles(null);
      setIsCollapsed(true); // Minimizar formulário após envio
      queryClient.invalidateQueries({ queryKey: ['/api/demands'] });

      // Foco automático no chat após 500ms
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
    createDemandMutation.mutate({ demand: data, files: selectedFiles || undefined });
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSelectedFiles(event.target.files);
  };

  const handleGitHubImport = (indexedContent: string, analysisResult: string) => {
    form.setValue('description', analysisResult || indexedContent); // Use analysisResult if available, otherwise indexedContent
    form.setValue(
      'title',
      analysisResult
        ? 'Análise de Repositório GitHub (Contextualizada)'
        : 'Análise de Repositório GitHub (Discovery)'
    );
    toast({
      title: "Conteúdo do GitHub carregado",
      description: "A descrição da demanda foi preenchida com o conteúdo do repositório.",
    });
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
    <Card className="shadow-lg rounded-xl border-0 bg-gradient-to-br from-gray-50 to-white">
      <CardHeader
        className="cursor-pointer p-5 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-t-xl border-b border-gray-200"
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
            <div className="bg-blue-500 p-2 rounded-lg">
              <Plus className="w-5 h-5 text-white" />
            </div>
            <CardTitle className="text-lg font-semibold text-gray-800">Nova Demanda</CardTitle>
          </div>
          <Button
            variant="ghost"
            size="sm"
            type="button"
            className="h-8 w-8 p-0 rounded-full hover:bg-blue-100"
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

              {/* Disclaimer para instruções de uso */}
              <CustomDisclaimer
                title="Dicas para criar uma boa demanda"
                variant="info"
              >
                <ul className="list-disc pl-5 space-y-1 text-sm">
                  <li>Descreva detalhadamente o problema ou necessidade</li>
                  <li>Explique o contexto e os objetivos esperados</li>
                  <li>Adicione informações técnicas relevantes</li>
                  <li>Priorize conforme impacto no negócio</li>
                </ul>
              </CustomDisclaimer>

              {/* GitHub Import */}
              <div className="flex justify-end">
                <GitHubImportModal
                  onImportSuccess={handleGitHubImport}
                  demandDescription={form.watch('description')}
                />
              </div>

              {/* Demand Type Selection */}
              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel
                      className={`block text-sm font-medium mb-2 ${isFocused.type ? 'text-blue-600' : 'text-gray-700'}`}
                      onFocus={() => setIsFocused(prev => ({ ...prev, type: true }))}
                      onBlur={() => setIsFocused(prev => ({ ...prev, type: false }))}
                    >
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
                        <TabsList className="grid w-full grid-cols-5 bg-transparent p-1 rounded-lg border-0">
                          {demandTypes.map((type) => {
                            const Icon = type.icon;
                            return (
                              <TabsTrigger
                                key={type.value}
                                value={type.value}
                                className={cn(
                                  "h-14 flex flex-col items-center gap-1 data-[state=active]:bg-white data-[state=active]:text-blue-600 data-[state=active]:shadow-sm",
                                  selectedType === type.value ? 'text-blue-600' : 'text-gray-600'
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

              {/* Demand Title */}
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel
                      className={`block text-sm font-medium mb-2 ${isFocused.title ? 'text-blue-600' : 'text-gray-700'}`}
                      onFocus={() => setIsFocused(prev => ({ ...prev, title: true }))}
                      onBlur={() => setIsFocused(prev => ({ ...prev, title: false }))}
                    >
                      Título da Demanda
                    </FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Ex: Sistema de autenticação por biometria"
                        className={cn(
                          "transition-all duration-200",
                          form.formState.errors.title ? "border-red-500 ring-red-500" : "border-gray-300"
                        )}
                        {...field}
                        aria-invalid={!!form.formState.errors.title}
                      />
                    </FormControl>
                    <FormMessage className="mt-2" />
                  </FormItem>
                )}
              />

              {/* Demand Description */}
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel
                      className={`block text-sm font-medium mb-2 ${isFocused.description ? 'text-blue-600' : 'text-gray-700'}`}
                      onFocus={() => setIsFocused(prev => ({ ...prev, description: true }))}
                      onBlur={() => setIsFocused(prev => ({ ...prev, description: false }))}
                    >
                      Descrição Detalhada
                    </FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Descreva sua demanda em detalhes. Inclua contexto, objetivos e qualquer informação relevante..."
                        rows={5}
                        className={cn(
                          "resize-none transition-all duration-200",
                          form.formState.errors.description ? "border-red-500 ring-red-500" : "border-gray-300"
                        )}
                        {...field}
                        aria-invalid={!!form.formState.errors.description}
                      />
                    </FormControl>
                    <FormMessage className="mt-2" />
                  </FormItem>
                )}
              />

              {/* Priority Selection */}
              <FormField
                control={form.control}
                name="priority"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel
                      className={`block text-sm font-medium mb-2 ${isFocused.priority ? 'text-blue-600' : 'text-gray-700'}`}
                      onFocus={() => setIsFocused(prev => ({ ...prev, priority: true }))}
                      onBlur={() => setIsFocused(prev => ({ ...prev, priority: false }))}
                    >
                      Prioridade
                    </FormLabel>
                    <FormControl>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger
                          className={cn(
                            "w-full",
                            form.formState.errors.priority ? "border-red-500 ring-red-500" : "border-gray-300"
                          )}
                          aria-invalid={!!form.formState.errors.priority}
                        >
                          <SelectValue placeholder="Selecione a prioridade" />
                        </SelectTrigger>
                        <SelectContent>
                          {priorities.map((priority) => (
                            <SelectItem key={priority.value} value={priority.value}>
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

              {/* File Upload */}
              <div className="space-y-2">
                <Label className="block text-sm font-medium text-gray-700">Anexar Documentos (Opcional)</Label>
                <div
                  className={cn(
                    "border-2 border-dashed rounded-xl p-6 text-center transition-colors",
                    selectedFiles ? "border-green-500 bg-green-50" : "border-gray-300 hover:border-blue-500 bg-gray-50"
                  )}
                >
                  <CloudUpload className="mx-auto text-gray-400 mb-2" size={24} />
                  <p className="text-sm text-gray-600">
                    Arraste arquivos aqui ou{" "}
                    <label className="text-blue-600 cursor-pointer hover:text-blue-800 font-medium">
                      clique para selecionar
                      <input
                        type="file"
                        className="hidden"
                        accept=".txt,.pdf,.docx"
                        multiple
                        onChange={handleFileChange}
                        aria-label="Selecionar arquivos para anexar"
                      />
                    </label>
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    Formatos suportados: .txt, .pdf, .docx
                  </p>
                  {selectedFiles && (
                    <div className="mt-3 space-y-2">
                      {Array.from(selectedFiles).map((file, index) => (
                        <div key={index} className="flex items-center justify-between bg-white px-3 py-2 rounded-lg border border-gray-200 text-sm">
                          <div className="flex items-center truncate">
                            <span className="text-gray-900 truncate" title={file.name}>
                              {file.name}
                            </span>
                            <span className="text-gray-500 ml-2 text-xs">
                              ({Math.round(file.size / 1024)}KB)
                            </span>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveFile(index)}
                            className="h-6 w-6 p-0 hover:bg-red-100 rounded-full"
                            aria-label={`Remover arquivo ${file.name}`}
                          >
                            <X size={14} className="text-red-500" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end pt-4">
                <Button
                  type="submit"
                  disabled={createDemandMutation.isPending}
                  className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg transition-colors"
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
