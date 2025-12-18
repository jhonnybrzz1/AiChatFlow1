import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, Loader2, FileText, Eye, EyeOff, ExternalLink } from "lucide-react";
import { MarkdownEditor } from "./markdown-editor";
import { useToast } from "@/hooks/use-toast";
import MDEditor from "@uiw/react-md-editor";

interface DocumentViewerProps {
  demandId: number;
  documentType: "prd" | "tasks";
  pdfUrl?: string;
}

export function DocumentViewer({ demandId, documentType, pdfUrl }: DocumentViewerProps) {
  const { toast } = useToast();
  const [isExpanded, setIsExpanded] = useState(false);

  const { data: markdownContent, isLoading, error } = useQuery({
    queryKey: [`/api/demands/${demandId}/documents/${documentType}`],
    queryFn: async () => {
      const response = await fetch(`/api/demands/${demandId}/documents/${documentType}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch ${documentType} document`);
      }
      const data = await response.json();
      return data.content;
    },
    enabled: isExpanded,
  });

  const handleDownloadPDF = () => {
    if (pdfUrl) {
      window.open(pdfUrl, '_blank');
      toast({
        title: "Download iniciado",
        description: `O documento ${documentType.toUpperCase()} está sendo baixado.`,
      });
    } else {
      toast({
        title: "Documento não disponível",
        description: `O documento ${documentType.toUpperCase()} ainda não foi gerado.`,
        variant: "destructive",
      });
    }
  };

  const documentTitle = documentType === "prd"
    ? "Product Requirements Document (PRD)"
    : "Tasks Document";

  if (!isExpanded) {
    return (
      <Card className="shadow-lg rounded-xl border-0 bg-gradient-to-br from-gray-50 to-white">
        <CardContent className="p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-blue-100 p-2 rounded-lg">
                <FileText className="w-5 h-5 text-blue-600" />
              </div>
              <span className="font-semibold text-gray-800">{documentTitle}</span>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsExpanded(true)}
                className="text-blue-700 border-blue-300 hover:bg-blue-50"
              >
                <Eye className="w-4 h-4 mr-2" />
                Visualizar
              </Button>
              {pdfUrl && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDownloadPDF}
                  className="text-blue-700 border-blue-300 hover:bg-blue-50"
                >
                  <Download className="w-4 h-4 mr-2" />
                  PDF
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-lg rounded-xl border-0 bg-white">
      <CardHeader className="border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-t-xl p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="bg-blue-500 p-2 rounded-lg">
              <FileText className="w-5 h-5 text-white" />
            </div>
            <CardTitle className="text-gray-800">{documentTitle}</CardTitle>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsExpanded(false)}
              className="text-gray-700 border-gray-300 hover:bg-gray-100"
            >
              <EyeOff className="w-4 h-4 mr-2" />
              Recolher
            </Button>
            {pdfUrl && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownloadPDF}
                className="text-blue-700 border-blue-300 hover:bg-blue-50"
              >
                <ExternalLink className="w-4 h-4 mr-2" />
                Abrir PDF
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-5">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <div className="text-center">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto" />
              <p className="mt-2 text-gray-600">Carregando documento...</p>
            </div>
          </div>
        ) : error ? (
          <div className="text-center py-8">
            <p className="text-red-600 font-medium">Erro ao carregar documento</p>
            <p className="text-sm text-gray-600 mt-2">
              {error instanceof Error ? error.message : "Erro desconhecido"}
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-4 text-red-700 border-red-300 hover:bg-red-50"
              onClick={() => setIsExpanded(false)}
            >
              Voltar
            </Button>
          </div>
        ) : (
          <div
            data-color-mode="light"
            className="border border-gray-200 rounded-lg p-4 bg-white"
          >
            <MDEditor.Markdown
              source={markdownContent || "Sem conteúdo disponível"}
              style={{
                padding: 16,
                minHeight: 400,
                backgroundColor: 'white',
                fontFamily: "'Inter', sans-serif"
              }}
              remarkPlugins={[]}
              rehypePlugins={[]}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
