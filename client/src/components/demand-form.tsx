import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Plus, TrendingUp, Bug, Compass, BarChart, CloudUpload, Send, Github } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertDemandSchema } from "@shared/schema";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { GitHubImportModal } from "./github-import-modal"; // Import the new modal

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
      queryClient.invalidateQueries({ queryKey: ['/api/demands'] });
    },
    onError: (error) => {
      toast({
        title: "Erro ao criar demanda",
        description: error.message,
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

  return (
    <Card className="shadow-sm">
      <CardHeader>
        <CardTitle className="text-lg font-semibold">Nova Demanda</CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Demand Type Selection */}
            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tipo de Demanda</FormLabel>
                  <FormControl>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {demandTypes.map((type) => {
                        const Icon = type.icon;
                        return (
                          <button
                            key={type.value}
                            type="button"
                            onClick={() => {
                              setSelectedType(type.value);
                              field.onChange(type.value);
                            }}
                            className={cn(
                              "demand-type-btn p-3 rounded-lg border-2 font-medium text-sm transition-all hover:border-muted-foreground",
                              selectedType === type.value
                                ? "border-primary bg-blue-50 text-primary"
                                : "border-border text-muted-foreground"
                            )}
                          >
                            <Icon className="mx-auto mb-1" size={16} />
                            <div>{type.label}</div>
                          </button>
                        );
                      })}
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Demand Title */}
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Título da Demanda</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Ex: Sistema de autenticação por biometria"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Demand Description */}
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descrição Detalhada</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Descreva sua demanda em detalhes. Inclua contexto, objetivos e qualquer informação relevante..."
                      rows={4}
                      className="resize-none"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Priority Selection */}
            <FormField
              control={form.control}
              name="priority"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Prioridade</FormLabel>
                  <FormControl>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger>
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
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* File Upload */}
            <div className="space-y-2">
              <Label>Anexar Documentos (Opcional)</Label>
              <div className="border-2 border-dashed border-border rounded-lg p-6 text-center hover:border-muted-foreground transition-colors">
                <CloudUpload className="mx-auto text-muted-foreground mb-2" size={24} />
                <p className="text-sm text-muted-foreground">
                  Arraste arquivos aqui ou{" "}
                  <label className="text-primary cursor-pointer hover:text-primary/80">
                    clique para selecionar
                    <input
                      type="file"
                      className="hidden"
                      accept=".txt,.pdf,.docx"
                      multiple
                      onChange={handleFileChange}
                    />
                  </label>
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Formatos suportados: .txt, .pdf, .docx
                </p>
                {selectedFiles && (
                  <div className="mt-2 text-sm text-foreground">
                    {Array.from(selectedFiles).map((file, index) => (
                      <div key={index} className="text-left">
                        {file.name} ({Math.round(file.size / 1024)}KB)
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-between items-center pt-2">
              <GitHubImportModal
                onImportSuccess={handleGitHubImport}
                demandDescription={form.watch('description')} // Pass the current demand description
              />
              <Button
                type="submit"
                disabled={createDemandMutation.isPending}
                className="flex items-center space-x-2"
              >
                <Send size={16} />
                <span>
                  {createDemandMutation.isPending ? "Enviando..." : "Enviar para Squad"}
                </span>
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
