
import { type Demand, type ChatMessage } from "@shared/schema";
import { storage } from "../storage";
import fs from "fs";
import path from "path";
import { mistralAIService } from "./mistral-ai";
import yaml from "js-yaml";
import { pdfGenerator } from "./pdf-generator";

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

    // Update status to processing
    await storage.updateDemand(demandId, { status: 'processing' });

    const refinementLevels = this.getRefinementLevels(demand.type);
    const messages: ChatMessage[] = [];

    // Calculate progress per agent
    const progressPerAgent = 100 / this.agents.length;

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
        type: 'processing',
        progress: Math.min(100, Math.round((i + 1) * progressPerAgent)) // Calculate progress
      };

      messages.push(message);
      await storage.updateDemandChat(demandId, messages);

      // Update demand with current progress
      await storage.updateDemand(demandId, {
        status: 'processing',
        progress: message.progress
      });

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
      progress: 100,
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
    // Summarize agent discussions first
    const summarizedContent = await this.summarizeAgentDiscussions(demand, messages);

    // Create context with summarized information
    const context = `
    Demanda: ${demand.title}
    Descrição: ${demand.description}
    Tipo: ${demand.type}
    Prioridade: ${demand.priority}

    Resumo das discussões dos agentes:
    ${summarizedContent}

    Detalhes dos agentes:
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

      // Ensure we have valid content
      const finalPrdContent = prdContent && prdContent.trim() !== '' ? prdContent : `PRD para ${demand.title}\n\nDescrição: ${demand.description}\n\nDocumento gerado automaticamente.`;
      const finalTasksContent = tasksContent && tasksContent.trim() !== '' ? tasksContent : `Tasks para ${demand.title}\n\n- [ ] 🔧 Implementar funcionalidade principal\n- [ ] 🔧 Criar testes\n- [ ] 🎨 Documentar solução`;

      return {
        prdContent: finalPrdContent,
        tasksContent: finalTasksContent
      };
    } catch (error) {
      console.error("Error generating documents:", error);
      // Return properly formatted fallback content
      return {
        prdContent: `# Product Requirements Document (PRD)

## 1. Visão Geral

**Demanda:** ${demand.title}
**Descrição:** ${demand.description}
**Tipo:** ${demand.type}
**Prioridade:** ${demand.priority}

## 2. Requisitos Funcionais

- Implementar funcionalidade principal
- Criar testes automatizados
- Documentar solução

## 3. Requisitos Não Funcionais

- Performance: < 2s response time
- Security: Data encryption

## 4. Critérios de Aceitação

- Funcionalidade deve passar em todos os testes
- Documentação completa

## 5. Dependências e Riscos

- Dependências: Nenhuma conhecida
- Riscos: Nenhum identificado

## 6. Cronograma

- Início: ${new Date().toLocaleDateString()}
- Previsão de conclusão: ${new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString()}

## 7. Aprovações

- **Project Manager:** [Name]
- **Tech Lead:** [Name]
- **Stakeholders:** [Names]

## 8. Resumo das Discussões dos Agentes

${summarizedContent || 'Nenhum resumo disponível.'}
`,
        tasksContent: `# Tasks Document

## 1. Project Overview

**Project Name:** ${demand.title}
**Date:** ${new Date().toLocaleDateString()}
**Version:** 1.0

## 2. Task Categories

### 2.1 Backend Tasks

- [ ] 🔧 Implementar funcionalidade principal
- [ ] 🔧 Criar testes unitários
- [ ] 🔧 Configurar banco de dados

### 2.2 Frontend Tasks

- [ ] 🎨 Criar interface de usuário
- [ ] 🎨 Implementar validação de formulário
- [ ] 🎨 Adicionar animações

## 3. Task Priorities

| Task ID | Task Name | Priority | Assigned To | Due Date | Status |
|--------|-----------|----------|-------------|----------|--------|
| T1 | Implement main API | High | [Developer] | [Date] | Not Started |
| T2 | Design UI | Medium | [Designer] | [Date] | Not Started |
| T3 | Write tests | High | [QA] | [Date] | Not Started |

## 4. Dependencies

- Nenhuma dependência conhecida

## 5. Approvals

- **Project Manager:** [Name]
- **Tech Lead:** [Name]
- **Stakeholders:** [Names]

## 6. Summary of Agent Discussions

${summarizedContent || 'No summary available.'}
`
      };
    }
  }

  /**
   * Summarize agent discussions to create a consolidated view
   */
  private async summarizeAgentDiscussions(demand: Demand, messages: ChatMessage[]): Promise<string> {
    // Group messages by agent type for better organization
    const agentsByType = this.groupAgentsByType(messages);

    // Create a summary prompt
    const summaryPrompt = `
    Demanda: ${demand.title}
    Descrição: ${demand.description}
    Tipo: ${demand.type}
    Prioridade: ${demand.priority}

    Análises dos agentes:
    ${Object.entries(agentsByType).map(([type, msgs]) => {
      return `### ${type.charAt(0).toUpperCase() + type.slice(1)} Analysis\n${msgs.map(msg => `- ${msg.agent}: ${msg.message}`).join('\n')}`;
    }).join('\n\n')}
    `;

    try {
      // Use AI to summarize the discussions
      const summarySystemPrompt = "Você é um Product Manager experiente. Resuma as análises dos agentes da squad em um formato estruturado e profissional. Destaque os pontos principais de cada área (técnica, UX, QA, etc.) e forneça uma visão consolidada.";
      const summaryUserPrompt = `Resuma as análises dos agentes para a demanda:\n${summaryPrompt}`;

      const summary = await mistralAIService.generateChatCompletion(
        summarySystemPrompt,
        summaryUserPrompt,
        {
          maxTokens: 800,
          temperature: 0.5
        }
      );

      return summary || "Resumo das discussões dos agentes não disponível.";
    } catch (error) {
      console.error("Error summarizing agent discussions:", error);
      // Fallback to simple summary
      return `Resumo das discussões dos agentes para ${demand.title}:\n\n${Object.entries(agentsByType).map(([type, msgs]) => {
        return `${type}: ${msgs.length} análises`;
      }).join(', ')}`;
    }
  }

  /**
   * Group agents by type for better organization
   */
  private groupAgentsByType(messages: ChatMessage[]): Record<string, ChatMessage[]> {
    const result: Record<string, ChatMessage[]> = {
      technical: [],
      ux: [],
      qa: [],
      data: [],
      process: [],
      other: []
    };

    messages.forEach(msg => {
      if (msg.agent.includes('tech_lead') || msg.agent.includes('backend') || msg.agent.includes('frontend')) {
        result.technical.push(msg);
      } else if (msg.agent.includes('ux') || msg.agent.includes('designer')) {
        result.ux.push(msg);
      } else if (msg.agent.includes('qa')) {
        result.qa.push(msg);
      } else if (msg.agent.includes('analista_de_dados') || msg.agent.includes('data')) {
        result.data.push(msg);
      } else if (msg.agent.includes('scrum') || msg.agent.includes('process')) {
        result.process.push(msg);
      } else {
        result.other.push(msg);
      }
    });

    return result;
  }

  private async saveDocument(demandId: number, type: string, content: string): Promise<string> {
    const documentsDir = path.join(process.cwd(), 'documents');
    if (!fs.existsSync(documentsDir)) {
      fs.mkdirSync(documentsDir, { recursive: true });
    }

    const timestamp = Date.now();
    const filename = `${type}_${demandId}_${timestamp}.pdf`;
    const filepath = path.join(documentsDir, filename);

    try {
      // Generate PDF using pdf-lib
      let pdfContent: Buffer;

      if (type === 'PRD') {
        pdfContent = await pdfGenerator.generatePRDDocument(content, demandId);
      } else if (type === 'Tasks') {
        pdfContent = await pdfGenerator.generateTasksDocument(content, demandId);
      } else {
        // Fallback to PRD format for unknown types
        pdfContent = await pdfGenerator.generatePRDDocument(content, demandId);
      }

      fs.writeFileSync(filepath, pdfContent);
      return `/api/documents/${filename}`;
    } catch (error) {
      console.error('Error generating PDF document:', error);
      // Fallback to text file if PDF generation fails
      const textFilename = `${type}_${demandId}_${timestamp}.txt`;
      const textFilepath = path.join(documentsDir, textFilename);
      fs.writeFileSync(textFilepath, content, 'utf8');
      return `/api/documents/${textFilename}`;
    }
  }
}

export const aiSquadService = new AISquadService();
