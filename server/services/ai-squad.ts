
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
  private agentConfigs: Record<string, { system_prompt: string, description: string, model?: string }> = {};

  constructor() {
    this.loadAgentConfigurations();
  }

  private loadAgentConfigurations(): void {
    const agentsDir = path.join(process.cwd(), 'agents');
    if (!fs.existsSync(agentsDir)) {
      console.warn('Agents directory not found, using default agents');
      // PM não está aqui - será chamado separadamente após refinamento
      this.agents = [
        { name: "refinador", icon: "🧠", description: "Captando e reformulando a demanda para a squad..." },
        { name: "scrum_master", icon: "🧝", description: "Analisando impacto no processo e definindo incrementos..." },
        { name: "qa", icon: "✅", description: "Identificando critérios de aceite e cenários de teste..." },
        { name: "ux", icon: "🎨", description: "Avaliando experiência do usuário e fluxo de interação..." },
        { name: "analista_de_dados", icon: "📈", description: "Verificando estrutura de dados e integrações necessárias..." },
        { name: "tech_lead", icon: "💧", description: "Avaliando viabilidade técnica e arquitetura..." }
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
          return yaml.load(content) as { name: string, description: string, system_prompt: string, model?: string };
        });

      // Map agent names to their configurations
      agentConfigs.forEach(config => {
        const agentName = config.name.toLowerCase().replace(' agent', '');
        this.agentConfigs[agentName] = {
          system_prompt: config.system_prompt,
          description: config.description,
          model: config.model
        };

        // Add to agents list with appropriate icon
        const icon = this.getIconForAgent(agentName);
        this.agents.push({
          name: agentName,
          icon: icon,
          description: config.description || `${agentName} processando...`
        });
      });

      // Ensure refinador is always first
      const refinadorIndex = this.agents.findIndex(a => a.name === 'refinador');
      if (refinadorIndex > 0) {
        const refinador = this.agents.splice(refinadorIndex, 1)[0];
        this.agents.unshift(refinador);
      } else if (refinadorIndex === -1) {
        this.agents.unshift({ name: "refinador", icon: "🧠", description: "Captando e reformulando a demanda para a squad..." });
      }

      // PM não deve estar no loop de agentes - será chamado separadamente
      // Remover PM se foi adicionado via YAML
      this.agents = this.agents.filter(a => a.name !== 'pm' && a.name !== 'product_manager');

      console.log('Loaded agent configurations:', this.agents.map(a => a.name));

    } catch (error) {
      console.error('Error loading agent configurations:', error);
      // Fallback to default agents (sem PM)
      this.agents = [
        { name: "refinador", icon: "🧠", description: "Captando e reformulando a demanda para a squad..." },
        { name: "scrum_master", icon: "🧝", description: "Analisando impacto no processo e definindo incrementos..." },
        { name: "qa", icon: "✅", description: "Identificando critérios de aceite e cenários de teste..." },
        { name: "ux", icon: "🎨", description: "Avaliando experiência do usuário e fluxo de interação..." },
        { name: "analista_de_dados", icon: "📈", description: "Verificando estrutura de dados e integrações necessárias..." },
        { name: "tech_lead", icon: "💧", description: "Avaliando viabilidade técnica e arquitetura..." }
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

    // Calculate progress per agent (90% for agents, 10% for document generation)
    const progressPerAgent = 90 / this.agents.length;

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
        progress: Math.min(90, Math.round((i + 1) * progressPerAgent)) // Calculate progress (max 90% for agents)
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

      // Process with agent for actual agent response
      const response = await this.processWithAgent(
        agent.name,
        demand,
        refinementLevels
      );

      message.message = response;
      message.type = 'completed';

      // Update with actual agent response
      await storage.updateDemandChat(demandId, messages);

      if (onProgress) {
        onProgress(message);
      }
    }

    // Update progress to 95% before document generation
    await storage.updateDemand(demandId, {
      status: 'processing',
      progress: 95
    });

    // Check one more time before generating documents
    if (this.stopRequests.has(demandId)) {
      this.stopRequests.delete(demandId);
      await storage.updateDemand(demandId, { status: 'stopped' });
      return;
    }

    // Generate documents with refined content from agent discussions
    const { prdContent, tasksContent } = await this.generateDocuments(demand, messages);

    // Save documents
    const prdPath = await this.saveDocument(demandId, 'PRD', prdContent);
    const tasksPath = await this.saveDocument(demandId, 'Tasks', tasksContent);

    // Update demand with document paths and final progress
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

  private async processWithAgent(
    agentName: string,
    demand: Demand,
    refinementLevels: number
  ): Promise<string> {
    const intensityLevel = this.getIntensityByType(demand.type);
    const agentConfig = this.agentConfigs[agentName];

    // Processamento padrão para todos os agentes de refinamento
    const systemPrompt = agentConfig?.system_prompt
      ? `${agentConfig.system_prompt}\n\nContexto adicional: Tipo de demanda: ${demand.type}. Nível de refinamento: ${refinementLevels}/4. Intensidade de análise: ${intensityLevel}.`
      : `Você é um ${agentName} experiente em uma squad de desenvolvimento. Responda SEMPRE em português brasileiro. Seja objetivo e prático nas suas respostas. Tipo de demanda: ${demand.type}. Nível de refinamento: ${refinementLevels}/4. Intensidade de análise: ${intensityLevel}.`;

    const userPrompt = agentConfig?.description
      ? `Para esta ${demand.type}, ${agentConfig.description.toLowerCase()}: ${demand.description}`
      : `Analise a demanda: ${demand.description}`;

    try {
      const maxTokens = intensityLevel === 'baixa' ? 800 : intensityLevel === 'media' ? 1500 : 2500;
      const model = agentConfig?.model || undefined;

      const response = await mistralAIService.generateChatCompletion(
        systemPrompt,
        userPrompt,
        {
          temperature: 0.7,
          maxTokens: maxTokens,
          model: model
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

  // ===== NOVOS MÉTODOS: Geração de PRD e Tasks com PM (FORA DO LOOP) =====
  
  private async generatePRDWithPM(
    demand: Demand,
    refinementMessages: ChatMessage[]
  ): Promise<string> {
    const refinementSummary = refinementMessages
      .filter(msg => msg.type === 'completed')
      .map(msg => `**${msg.agent}**: ${msg.message}`)
      .join('\n\n');

    const systemPrompt = `Você é um Product Manager experiente.
Sua responsabilidade é criar um PRD (Product Requirements Document) profissional em Markdown.

FORMATO DO PRD:
# [Título da Demanda]

## 📋 Visão Geral
[Objetivo claro e contexto]

## 🎯 Requisitos Funcionais
- RF1: [Requisito funcional 1]
- RF2: [Requisito funcional 2]

## ✅ Critérios de Aceite
- CA1: [Critério de aceite 1]
- CA2: [Critério de aceite 2]

## 🏗️ Considerações Técnicas
[Insights do Tech Lead sobre arquitetura e viabilidade]

## 🎨 UX/UI
[Considerações do UX Designer sobre experiência do usuário]

## 🧪 Estratégia de Testes
[Plano do QA para testes e validação]

## 📊 Estrutura de Dados
[Análise do Analista de Dados sobre dados e integrações]

## 📈 Impacto no Processo
[Análise do Scrum Master sobre impacto no processo]

Gere um PRD completo, profissional e bem estruturado em português brasileiro.`;

    const userPrompt = `Demanda Original: ${demand.title}
Descrição: ${demand.description}
Tipo: ${demand.type}
Prioridade: ${demand.priority}

=== REFINAMENTO DA SQUAD ===
${refinementSummary}

=== SUA TAREFA ===
Com base em TODAS as análises acima, crie um PRD completo em Markdown seguindo o formato especificado.
O PRD deve ser um documento profissional que qualquer pessoa possa ler e entender o que precisa ser feito.`;

    try {
      const response = await mistralAIService.generateChatCompletion(
        systemPrompt,
        userPrompt,
        {
          temperature: 0.5,
          maxTokens: 4000
        }
      );

      return response || `# ${demand.title}\n\nPRD gerado com base no refinamento da squad.`;
    } catch (error) {
      console.error(`Error generating PRD with PM:`, error);
      return `# ${demand.title}\n\n## Erro\nErro ao gerar PRD. Refinamento capturado mas documento não foi criado.`;
    }
  }

  private async generateTasksWithPM(
    demand: Demand,
    prdContent: string
  ): Promise<string> {
    const systemPrompt = `Você é um Product Manager experiente.
Crie uma lista de tasks técnicas detalhadas baseadas no PRD.

FORMATO DAS TASKS:
## Backend
- [ ] Task backend 1
- [ ] Task backend 2

## Frontend
- [ ] Task frontend 1
- [ ] Task frontend 2

## Database
- [ ] Task database 1

## DevOps/Infraestrutura
- [ ] Task devops 1

## Testes
- [ ] Task testes 1

Cada task deve ser:
- Específica e acionável
- Com escopo claro
- Tecnicamente detalhada

Gere tasks em português brasileiro.`;

    const userPrompt = `PRD:
${prdContent}

=== SUA TAREFA ===
Com base no PRD acima, crie uma lista completa de tasks técnicas organizadas por categoria.
As tasks devem cobrir todos os aspectos técnicos necessários para implementar a demanda.`;

    try {
      const response = await mistralAIService.generateChatCompletion(
        systemPrompt,
        userPrompt,
        {
          temperature: 0.5,
          maxTokens: 2000
        }
      );

      return response || `# Tasks - ${demand.title}\n\n## Geral\n- [ ] Implementar funcionalidade`;
    } catch (error) {
      console.error(`Error generating Tasks with PM:`, error);
      return `# Tasks - ${demand.title}\n\n## Erro\nErro ao gerar tasks.`;
    }
  }

  private async generateDocuments(demand: Demand, messages: ChatMessage[]): Promise<{ prdContent: string, tasksContent: string }> {
    // Summarize agent discussions first
    const summarizedContent = await this.summarizeAgentDiscussions(demand, messages);

    // Create context with summarized information
    const context = `
    Demanda original: ${demand.title}
    Descrição original: ${demand.description}
    Tipo: ${demand.type}
    Prioridade: ${demand.priority}

    Resumo das discussões dos agentes:
    ${summarizedContent}

    Detalhes das respostas dos agentes:
    ${messages.map(msg => `${msg.agent}: ${msg.message}`).join('\n\n')}
    `;

    try {
      // Generate PRD using Mistral AI based on actual agent discussions
      const prdSystemPrompt = `Você é um Product Manager experiente da squad. Gere um PRD (Product Requirements Document) estruturado em português brasileiro baseado no contexto fornecido. O PRD deve refletir fielmente as discussões e decisões dos agentes durante o refinamento da demanda, não o conteúdo genérico do AiChatFlow. Use formato profissional com seções bem definidas e informações específicas extraídas das respostas dos agentes.`;
      const prdUserPrompt = `Gere um PRD completo e estruturado para a seguinte demanda, com base nas discussões dos agentes:\n\n${context}`;

      // Generate Tasks using Mistral AI based on actual agent discussions
      const tasksSystemPrompt = `Você é um Product Manager experiente da squad. Gere uma lista de tasks/user stories estruturadas em português brasileiro baseadas nas discussões específicas dos agentes sobre a demanda original, não sobre o AiChatFlow. Use formato com ícones 🔧 para Backend e 🎨 para Frontend e inclua detalhes específicos mencionados nas respostas dos agentes.`;
      const tasksUserPrompt = `Gere tasks organizadas em Backend (🔧) e Frontend (🎨) para a seguinte demanda, com base nas discussões dos agentes:\n\n${context}`;

      // Generate both documents in parallel
      const [prdContent, tasksContent] = await mistralAIService.generateMultipleChatCompletions(
        [
          { systemPrompt: prdSystemPrompt, userPrompt: prdUserPrompt },
          { systemPrompt: tasksSystemPrompt, userPrompt: tasksUserPrompt }
        ],
        {
          maxTokens: 4000,
          temperature: 0.3
        }
      );

      console.log("Conteúdo do PRD gerado pela IA:", prdContent);
      console.log("Conteúdo das Tasks gerado pela IA:", tasksContent);

      // Process the AI-generated content to ensure it contains actual agent information
      let processedPrdContent = prdContent || '';
      if (!processedPrdContent || processedPrdContent.trim() === '') {
        // If AI failed to generate content, build from agent messages
        processedPrdContent = this.buildPRDFromAgentMessages(demand, messages, summarizedContent);
      } else {
        // Ensure the generated content includes actual agent discussions
        if (!processedPrdContent.includes(demand.title) && !processedPrdContent.includes(demand.description)) {
          processedPrdContent = this.buildPRDFromAgentMessages(demand, messages, summarizedContent) + '\n\n' + processedPrdContent;
        }
      }

      let processedTasksContent = tasksContent || '';
      if (!processedTasksContent || processedTasksContent.trim() === '') {
        // If AI failed to generate content, build from agent messages
        processedTasksContent = this.buildTasksFromAgentMessages(demand, messages);
      } else {
        // Ensure the generated content includes actual agent discussions
        if (!processedTasksContent.includes('Backend Tasks') && !processedTasksContent.includes('Frontend Tasks')) {
          processedTasksContent = this.buildTasksFromAgentMessages(demand, messages) + '\n\n' + processedTasksContent;
        }
      }

      console.log("Conteúdo final do PRD:", processedPrdContent);
      console.log("Conteúdo final das Tasks:", processedTasksContent);

      return {
        prdContent: processedPrdContent,
        tasksContent: processedTasksContent
      };
    } catch (error) {
      console.error("Error generating documents:", error);
      // Return properly formatted fallback content that always includes actual agent data
      const fallbackPrd = this.buildPRDFromAgentMessages(demand, messages, summarizedContent);
      const fallbackTasks = this.buildTasksFromAgentMessages(demand, messages);

      return {
        prdContent: fallbackPrd,
        tasksContent: fallbackTasks
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
   * Build a PRD document from agent messages
   */
  private buildPRDFromAgentMessages(demand: Demand, messages: ChatMessage[], summarizedContent: string): string {
    return `# Product Requirements Document (PRD)

## 1. Visão Geral
**Demanda:** ${demand.title}
**Descrição:** ${demand.description}
**Tipo:** ${demand.type}
**Prioridade:** ${demand.priority}

## 2. Análise Detalhada
${summarizedContent || 'Nenhuma análise consolidada disponível.'}

## 3. Discussões dos Agentes
${messages.map(msg => `### ${msg.agent.charAt(0).toUpperCase() + msg.agent.slice(1)}
${msg.message}`).join('\n\n')}

## 4. Requisitos Funcionais
${this.extractRequirementsFromMessages(messages, 'funcional')}

## 5. Requisitos Não Funcionais
${this.extractRequirementsFromMessages(messages, 'nao-funcional')}

## 6. Critérios de Aceitação
${this.extractAcceptanceCriteriaFromMessages(messages)}

## 7. Riscos e Dependências
${this.extractRisksAndDependenciesFromMessages(messages)}
`;
  }

  /**
   * Build a Tasks document from agent messages
   */
  private buildTasksFromAgentMessages(demand: Demand, messages: ChatMessage[]): string {
    return `# Tasks Document

## 1. Project Overview
**Project Name:** ${demand.title}
**Date:** ${new Date().toLocaleDateString()}
**Version:** 1.0

## 2. Task Categories

### 2.1 Backend Tasks (🔧)
${this.extractTasksFromAgentMessages(messages, 'backend', true)}

### 2.2 Frontend Tasks (🎨)
${this.extractTasksFromAgentMessages(messages, 'frontend', true)}

### 2.3 QA Tasks (✅)
${this.extractTasksFromAgentMessages(messages, 'qa', true)}

### 2.4 Other Tasks
${this.extractTasksFromAgentMessages(messages, 'other', true)}

## 3. Agent Discussions Summary
${messages.map(msg => `**${msg.agent}**: ${msg.message.substring(0, 200)}${msg.message.length > 200 ? '...' : ''}`).join('\n\n')}
`;
  }

  /**
   * Extract requirements from agent messages based on type
   */
  private extractRequirementsFromMessages(messages: ChatMessage[], type: 'funcional' | 'nao-funcional'): string {
    const relevantMessages = messages.filter(msg =>
      (type === 'funcional' &&
        (msg.message.toLowerCase().includes('funcional') ||
          msg.message.toLowerCase().includes('requisito') ||
          msg.message.toLowerCase().includes('lógica'))) ||
      (type === 'nao-funcional' &&
        (msg.message.toLowerCase().includes('desempenho') ||
          msg.message.toLowerCase().includes('segurança') ||
          msg.message.toLowerCase().includes('performance')))
    );

    if (relevantMessages.length > 0) {
      return relevantMessages.map(msg => `- ${msg.agent}: ${msg.message.substring(0, 150)}...`).join('\n');
    }

    return `- Nenhum requisito ${type === 'funcional' ? 'funcional' : 'não funcional'} específico identificado nos dados dos agentes`;
  }

  /**
   * Extract acceptance criteria from agent messages
   */
  private extractAcceptanceCriteriaFromMessages(messages: ChatMessage[]): string {
    const criteriaMessages = messages.filter(msg =>
      msg.message.toLowerCase().includes('critério') ||
      msg.message.toLowerCase().includes('aceitação') ||
      msg.message.toLowerCase().includes('teste') ||
      msg.message.toLowerCase().includes('validar')
    );

    if (criteriaMessages.length > 0) {
      return criteriaMessages.map(msg => `- ${msg.agent}: ${msg.message.substring(0, 150)}...`).join('\n');
    }

    return '- Nenhum critério de aceitação específico identificado nos dados dos agentes';
  }

  /**
   * Extract risks and dependencies from agent messages
   */
  private extractRisksAndDependenciesFromMessages(messages: ChatMessage[]): string {
    const riskMessages = messages.filter(msg =>
      msg.message.toLowerCase().includes('risco') ||
      msg.message.toLowerCase().includes('dependência') ||
      msg.message.toLowerCase().includes('bloqueador') ||
      msg.message.toLowerCase().includes('impedimento')
    );

    if (riskMessages.length > 0) {
      return riskMessages.map(msg => `- ${msg.agent}: ${msg.message.substring(0, 150)}...`).join('\n');
    }

    return '- Nenhum risco ou dependência específica identificada nos dados dos agentes';
  }

  /**
   * Extract tasks from agent messages based on category
   */
  private extractTasksFromAgentMessages(messages: ChatMessage[], category: string, useFallback: boolean = false): string {
    const categoryAgents: Record<string, string[]> = {
      backend: ['tech_lead', 'backend', 'analista_de_dados'],
      frontend: ['ux', 'frontend'],
      qa: ['qa'],
      other: ['scrum_master', 'refinador', 'pm', 'product_manager']
    };

    const relevantMessages = messages.filter(msg => {
      if (category === 'backend') {
        return categoryAgents.backend.some(agent => msg.agent.includes(agent));
      } else if (category === 'frontend') {
        return categoryAgents.frontend.some(agent => msg.agent.includes(agent));
      } else if (category === 'qa') {
        return categoryAgents.qa.some(agent => msg.agent.includes(agent));
      } else if (category === 'other') {
        return categoryAgents.other.some(agent => msg.agent.includes(agent));
      }
      return false;
    });

    if (relevantMessages.length > 0) {
      return relevantMessages.map(msg => `- [ ] ${category === 'frontend' ? '🎨' : category === 'backend' ? '🔧' : '✅'} ${msg.agent}: ${msg.message.substring(0, 100)}...`).join('\n');
    }

    if (useFallback) {
      // If no specific messages found, create generic tasks
      const genericTasks: Record<string, string> = {
        backend: "- [ ] 🔧 Implementar lógica de backend\n- [ ] 🔧 Configurar banco de dados\n- [ ] 🔧 Criar testes unitários",
        frontend: "- [ ] 🎨 Criar interface de usuário\n- [ ] 🎨 Implementar validação de formulário\n- [ ] 🎨 Adicionar animações",
        qa: "- [ ] ✅ Definir critérios de aceitação\n- [ ] ✅ Criar casos de teste\n- [ ] ✅ Realizar testes exploratórios",
        other: "- [ ] 📋 Planejar etapas de implementação\n- [ ] 📋 Definir critérios de sucesso\n- [ ] 📋 Criar documentação de processo"
      };
      return genericTasks[category] || "- [ ] Tarefa não especificada";
    }

    return "- [ ] Nenhuma tarefa específica identificada";
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
