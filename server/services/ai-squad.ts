
import { type Demand, type ChatMessage } from "@shared/schema";
import { storage } from "../storage";
import fs from "fs";
import path from "path";
import { mistralAIService } from "./mistral-ai";
import yaml from "js-yaml";

// Using Mistral AI service instead of OpenAI

export class AISquadService {
  private agents: { name: string, icon: string, description: string }[] = [];
  private agentConfigs: Record<string, { system_prompt: string, description: string }> = {};

  constructor() {
    this.loadAgentConfigurations();
  }

  private loadAgentConfigurations(): void {
    const agentsDir = path.join(process.cwd(), 'agents');
    if (!fs.existsSync(agentsDir)) {
      console.warn('Agents directory not found, using default agents');
      this.agents = [
        { name: "refinador", icon: "🧠", description: "Iniciando refinamento da demanda..." },
        { name: "scrum_master", icon: "🧝", description: "Analisando impacto no processo e definindo incrementos..." },
        { name: "qa", icon: "✅", description: "Identificando critérios de aceite e cenários de teste..." },
        { name: "ux", icon: "🎨", description: "Avaliando experiência do usuário e fluxo de interação..." },
        { name: "analista_de_dados", icon: "📈", description: "Verificando estrutura de dados e integrações necessárias..." },
        { name: "tech_lead", icon: "💧", description: "Avaliando viabilidade técnica e arquitetura..." },
        { name: "pm", icon: "📋", description: "Gerando PRD e Tasks baseado no refinamento..." }
      ];
      return;
    }

    try {
      const files = fs.readdirSync(agentsDir);
      const agentConfigs = files
        .filter(file => file.endsWith('.yaml') || file.endsWith('.yml'))
        .map(file => {
          const filePath = path.join(agentsDir, file);
          const content = fs.readFileSync(filePath, 'utf8');
          return yaml.load(content) as { name: string, description: string, system_prompt: string };
        });

      // Map agent names to their configurations
      agentConfigs.forEach(config => {
        const agentName = config.name.toLowerCase().replace(' agent', '');
        this.agentConfigs[agentName] = {
          system_prompt: config.system_prompt,
          description: config.description
        };

        // Add to agents list with appropriate icon
        const icon = this.getIconForAgent(agentName);
        this.agents.push({
          name: agentName,
          icon: icon,
          description: config.description || `${agentName} processando...`
        });
      });

      // Add refinador if not present (it's a special agent)
      if (!this.agents.some(a => a.name === 'refinador')) {
        this.agents.unshift({ name: "refinador", icon: "🧠", description: "Iniciando refinamento da demanda..." });
      }

      // Add pm if not present (it's a special agent)
      if (!this.agents.some(a => a.name === 'pm')) {
        this.agents.push({ name: "pm", icon: "📋", description: "Gerando PRD e Tasks baseado no refinamento..." });
      }

      console.log('Loaded agent configurations:', this.agents.map(a => a.name));

    } catch (error) {
      console.error('Error loading agent configurations:', error);
      // Fallback to default agents
      this.agents = [
        { name: "refinador", icon: "🧠", description: "Iniciando refinamento da demanda..." },
        { name: "scrum_master", icon: "🧝", description: "Analisando impacto no processo e definindo incrementos..." },
        { name: "qa", icon: "✅", description: "Identificando critérios de aceite e cenários de teste..." },
        { name: "ux", icon: "🎨", description: "Avaliando experiência do usuário e fluxo de interação..." },
        { name: "analista_de_dados", icon: "📈", description: "Verificando estrutura de dados e integrações necessárias..." },
        { name: "tech_lead", icon: "💧", description: "Avaliando viabilidade técnica e arquitetura..." },
        { name: "pm", icon: "📋", description: "Gerando PRD e Tasks baseado no refinamento..." }
      ];
    }
  }

  private getIconForAgent(agentName: string): string {
    switch (agentName) {
      case 'scrum_master': return "🧝";
      case 'qa': return "✅";
      case 'ux': return "🎨";
      case 'analista_de_dados': return "📈";
      case 'tech_lead': return "💧";
      case 'product_manager': return "📋";
      case 'refinador': return "🧠";
      default: return "🤖";
    }
  }

  private stopRequests = new Set<number>();

  stopProcessing(demandId: number): void {
    this.stopRequests.add(demandId);
  }

  async processDemand(demandId: number, onProgress?: (message: ChatMessage) => void): Promise<void> {
    const demand = await storage.getDemand(demandId);
    if (!demand) throw new Error("Demand not found");

    const refinementLevels = this.getRefinementLevels(demand.type);
    const messages: ChatMessage[] = [];

    for (let i = 0; i < this.agents.length; i++) {
      // Check if processing was stopped
      if (this.stopRequests.has(demandId)) {
        this.stopRequests.delete(demandId);
        await storage.updateDemand(demandId, { status: 'stopped' });
        return;
      }

      const agent = this.agents[i];
      const message: ChatMessage = {
        id: `${demandId}-${i}`,
        agent: agent.name,
        message: agent.description,
        timestamp: new Date().toISOString(),
        type: 'processing'
      };

      messages.push(message);
      await storage.updateDemandChat(demandId, messages);

      if (onProgress) {
        onProgress(message);
      }

      // Simulate processing time based on agent
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Check again if processing was stopped during wait
      if (this.stopRequests.has(demandId)) {
        this.stopRequests.delete(demandId);
        await storage.updateDemand(demandId, { status: 'stopped' });
        return;
      }

      // Process with OpenAI for actual agent response
      const response = await this.processWithAgent(agent.name, demand, refinementLevels);

      message.message = response;
      message.type = 'completed';
      await storage.updateDemandChat(demandId, messages);

      if (onProgress) {
        onProgress(message);
      }
    }

    // Check one more time before generating documents
    if (this.stopRequests.has(demandId)) {
      this.stopRequests.delete(demandId);
      await storage.updateDemand(demandId, { status: 'stopped' });
      return;
    }

    // Generate documents
    const { prdContent, tasksContent } = await this.generateDocuments(demand, messages);

    // Save documents
    const prdPath = await this.saveDocument(demandId, 'PRD', prdContent);
    const tasksPath = await this.saveDocument(demandId, 'Tasks', tasksContent);

    // Update demand with document paths
    await storage.updateDemand(demandId, {
      status: 'completed',
      prdUrl: prdPath,
      tasksUrl: tasksPath
    });
  }

  private getRefinementLevels(type: string): number {
    switch (type) {
      case 'nova_funcionalidade': return 4; // Alto esforço
      case 'melhoria': return 3; // Médio esforço
      case 'bug': return 2; // Baixo esforço
      default: return 3;
    }
  }

  private async processWithAgent(agentName: string, demand: Demand, refinementLevels: number): Promise<string> {
    const intensityLevel = this.getIntensityByType(demand.type);

    // Check if we have a custom configuration for this agent
    const agentConfig = this.agentConfigs[agentName];

    // Use the system prompt from the configuration if available
    const systemPrompt = agentConfig?.system_prompt
      ? `${agentConfig.system_prompt}\n\nContexto adicional: Tipo de demanda: ${demand.type}. Nível de refinamento: ${refinementLevels}/4. Intensidade de análise: ${intensityLevel}.`
      : `Você é um ${agentName} experiente em uma squad de desenvolvimento. Responda SEMPRE em português brasileiro. Seja objetivo e prático nas suas respostas. Tipo de demanda: ${demand.type}. Nível de refinamento: ${refinementLevels}/4. Intensidade de análise: ${intensityLevel}.`;

    // Generate a user prompt based on the agent type
    const userPrompt = agentConfig?.description
      ? `Para esta ${demand.type}, ${agentConfig.description.toLowerCase()}: ${demand.description}`
      : `Analise a demanda: ${demand.description}`;

    try {
      // Set max tokens based on intensity level
      const maxTokens = intensityLevel === 'baixa' ? 300 : intensityLevel === 'media' ? 500 : 800;

      const response = await mistralAIService.generateChatCompletion(
        systemPrompt,
        userPrompt,
        {
          temperature: 0.7,
          maxTokens: maxTokens
        }
      );

      return response || `${agentName} processou a demanda com sucesso.`;
    } catch (error) {
      console.error(`Error processing with ${agentName}:`, error);
      return `${agentName} encontrou um erro durante o processamento, mas o fluxo continua.`;
    }
  }

  private getIntensityByType(type: string): 'baixa' | 'media' | 'alta' {
    switch (type) {
      case 'bug': return 'baixa';
      case 'melhoria': return 'media';
      case 'nova_funcionalidade': return 'alta';
      default: return 'media';
    }
  }

  private async generateDocuments(demand: Demand, messages: ChatMessage[]): Promise<{ prdContent: string, tasksContent: string }> {
    const context = `
    Demanda: ${demand.title}
    Descrição: ${demand.description}
    Tipo: ${demand.type}
    Prioridade: ${demand.priority}

    Respostas dos agentes da squad:
    ${messages.map(msg => `${msg.agent}: ${msg.message}`).join('\n')}
    `;

    try {
      // Generate PRD using Mistral AI
      const prdSystemPrompt = "Você é um Product Manager experiente da squad. Gere um PRD (Product Requirements Document) estruturado em português brasileiro baseado no contexto fornecido. Use formato profissional com seções bem definidas.";
      const prdUserPrompt = `Gere um PRD completo e estruturado para:\n${context}`;

      // Generate Tasks using Mistral AI
      const tasksSystemPrompt = "Você é um Product Manager experiente da squad. Gere uma lista de tasks/user stories estruturadas em português brasileiro baseadas no contexto fornecido. Use formato com ícones 🔧 para Backend e 🎨 para Frontend.";
      const tasksUserPrompt = `Gere tasks organizadas em Backend (🔧) e Frontend (🎨) para:\n${context}`;

      // Generate both documents in parallel
      const [prdContent, tasksContent] = await mistralAIService.generateMultipleChatCompletions(
        [
          { systemPrompt: prdSystemPrompt, userPrompt: prdUserPrompt },
          { systemPrompt: tasksSystemPrompt, userPrompt: tasksUserPrompt }
        ],
        {
          maxTokens: 1500,
          temperature: 0.3
        }
      );

      return {
        prdContent: prdContent || "PRD gerado com sucesso",
        tasksContent: tasksContent || "Tasks geradas com sucesso"
      };
    } catch (error) {
      console.error("Error generating documents:", error);
      return {
        prdContent: `PRD para ${demand.title}\n\nDescrição: ${demand.description}\n\nDocumento gerado automaticamente.`,
        tasksContent: `Tasks para ${demand.title}\n\n- [ ] 🔧 Implementar funcionalidade principal\n- [ ] 🔧 Criar testes\n- [ ] 🎨 Documentar solução`
      };
    }
  }

  private async saveDocument(demandId: number, type: string, content: string): Promise<string> {
    const documentsDir = path.join(process.cwd(), 'documents');
    if (!fs.existsSync(documentsDir)) {
      fs.mkdirSync(documentsDir, { recursive: true });
    }

    const filename = `${type}_${demandId}_${Date.now()}.pdf`;
    const filepath = path.join(documentsDir, filename);

    try {
      // Generate PDF using a simpler approach
      const pdfContent = this.generatePdfContent(content, type);
      fs.writeFileSync(filepath, pdfContent);
      return `/api/documents/${filename}`;
    } catch (error) {
      console.error('Error generating PDF document:', error);
      // Fallback to text file if PDF generation fails
      const textFilename = `${type}_${demandId}_${Date.now()}.txt`;
      const textFilepath = path.join(documentsDir, textFilename);
      fs.writeFileSync(textFilepath, content, 'utf8');
      return `/api/documents/${textFilename}`;
    }
  }

  private generatePdfContent(content: string, type: string): Buffer {
    // Simple PDF generation - this is a basic approach that creates a minimal PDF structure
    // In a real implementation, you would use a proper PDF library

    // For now, let's create a simple text-based PDF structure
    // This is a minimal PDF header and content structure
    const pdfHeader = Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n4 0 obj\n<< /Length 0 >>\nstream\nBT\n/F1 12 Tf\n100 700 Td\n');

    const pdfFooter = Buffer.from('\nET\nendstream\nendobj\n5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\nxref\n0 6\n0000000000 65535 f\n0000000010 00000 n\n0000000059 00000 n\n0000000118 00000 n\n0000000200 00000 n\n0000000300 00000 n\ntrailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n0\n%%EOF');

    // Simple text content - in a real implementation, this would be properly formatted
    const textContent = Buffer.from(`(${type} - ${new Date().toISOString()})\nTj\n100 680 Td\n`);

    // Split content into lines and add to PDF
    const contentLines = content.split('\n');
    let contentBuffer = Buffer.alloc(0);

    let yPosition = 660;
    for (const line of contentLines) {
      if (line.trim()) {
        const lineBuffer = Buffer.from(`100 ${yPosition} Td\n(${this.escapePdfString(line)}) Tj\n`);
        contentBuffer = Buffer.concat([contentBuffer, lineBuffer]);
        yPosition -= 14; // Move down for next line
        if (yPosition < 50) break; // Prevent overflow
      }
    }

    return Buffer.concat([pdfHeader, textContent, contentBuffer, pdfFooter]);
  }

  private escapePdfString(str: string): string {
    // Escape special characters for PDF
    return str.replace(/\(/g, '\\(').replace(/\)/g, '\\)').replace(/\\/g, '\\\\');
  }

  private parseContentToWordElements(content: string, type: string): any[] {
    // This method is no longer used for PDF generation, but kept for backward compatibility
    // PDF generation now uses a simpler approach
    return [];
  }

  private isHeading(text: string): boolean {
    // This method is no longer used for PDF generation, but kept for backward compatibility
    return false;
  }
}

export const aiSquadService = new AISquadService();
