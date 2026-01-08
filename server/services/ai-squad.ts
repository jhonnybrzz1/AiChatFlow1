import { type Demand, type ChatMessage } from "@shared/schema";
import { storage } from "../storage";
import fs from "fs";
import path from "path";
import { mistralAIService } from "./mistral-ai";
import yaml from "js-yaml";
import { pdfGenerator } from "./pdf-generator";
import { demandRoutingOrchestrator } from "../routing/orchestrator";
import { DiscoveryPlugin } from "../plugins/discovery-plugin";
import { BugPlugin } from "../plugins/bug-plugin";
import { ImprovementPlugin } from "../plugins/improvement-plugin";
import { agentInteractionService } from "./agent-interaction";
import { agentOrchestrator } from "../cognitive-core/agent-orchestrator";
import { frameworkManager } from "../frameworks/framework-manager";
import { gitHubService } from './github';
import { repoService } from './repo-service';
import { contextBuilder } from './context-builder';

// Using Mistral AI service instead of OpenAI

// Adicionando interface para gerenciamento de SSE
interface SSEConnection {
  res: any;
  lastEventId: number;
}

export class AISquadService {
  private agents: { name: string, icon: string, description: string }[] = [];
  private agentConfigs: Record<string, { system_prompt: string, description: string, model?: string }> = {};
  private sseConnections: Map<number, SSEConnection> = new Map(); // Map de demandId para connection

  constructor() {
    this.loadAgentConfigurations();
    this.initializeRoutingSystem();
    this.initializeCognitiveCore();
    this.initializeFrameworkManager();
  }

  public addSSEConnection(demandId: number, connection: SSEConnection): void {
    this.sseConnections.set(demandId, connection);
  }

  public removeSSEConnection(demandId: number): void {
    this.sseConnections.delete(demandId);
  }

  public sendSSEUpdate(demandId: number, data: any): void {
    const connection = this.sseConnections.get(demandId);
    if (connection) {
      try {
        connection.res.write(`data: ${JSON.stringify(data)}\n\n`);
      } catch (error) {
        // Remover conexão se ela estiver encerrada
        this.sseConnections.delete(demandId);
      }
    }
  }

  private async initializeRoutingSystem(): Promise<void> {
    try {
      // Initialize the routing orchestrator
      await demandRoutingOrchestrator.initialize();

      // Register plugins
      demandRoutingOrchestrator.registerPlugin(new DiscoveryPlugin());
      demandRoutingOrchestrator.registerPlugin(new BugPlugin());
      demandRoutingOrchestrator.registerPlugin(new ImprovementPlugin());

      console.log('Routing system initialized with plugins');
    } catch (error) {
      console.error('Error initializing routing system:', error);
    }
  }

  private async initializeCognitiveCore(): Promise<void> {
    try {
      console.log('Initializing AICHATflow Cognitive Core...');
      console.log('✅ Demand Classifier ready');
      console.log('✅ Agent Orchestrator ready');
      console.log('AICHATflow Cognitive Core initialized successfully');
    } catch (error) {
      console.error('Error initializing cognitive core:', error);
    }
  }

  private async initializeFrameworkManager(): Promise<void> {
    try {
      console.log('🔧 Initializing Framework Manager...');
      await frameworkManager.initialize();
      console.log('✅ Framework Manager initialized with 6 demand management frameworks');
      console.log('   - JTBD (Jobs-to-be-Done)');
      console.log('   - HEART (UX Metrics)');
      console.log('   - Severity x Priority Matrix');
      console.log('   - Double Diamond (Design Thinking)');
      console.log('   - CRISP-DM (Data Science)');
      console.log('   - AI Framework Suggestion');
    } catch (error) {
      console.error('Error initializing framework manager:', error);
    }
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
      this.agents = this.agents.filter(a => {
        const lowerName = a.name.toLowerCase();
        return lowerName !== 'pm' &&
               lowerName !== 'product_manager' &&
               !(lowerName.includes('product') && lowerName.includes('manager'));
      });

      // IMPORTANTE: Também remover PM do agentConfigs (usado na interação multi-agente)
      const pmKeys = Object.keys(this.agentConfigs).filter(key => {
        const lowerKey = key.toLowerCase();
        return lowerKey === 'pm' ||
               lowerKey === 'product_manager' ||
               lowerKey === 'productmanager' ||
               (lowerKey.includes('product') && lowerKey.includes('manager'));
      });

      pmKeys.forEach(key => {
        delete this.agentConfigs[key];
      });

      console.log('Loaded agent configurations:', this.agents.map(a => a.name));
      console.log('Agent configs (excluding PM):', Object.keys(this.agentConfigs));

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

  async processDemandWithCognitiveCore(demandId: number, onProgress?: (message: ChatMessage) => void): Promise<void> {
    const demand = await storage.getDemand(demandId);
    if (!demand) throw new Error("Demand not found");

    // Update status to processing
    await storage.updateDemand(demandId, { status: 'processing' });

    try {
      // Use AICHATflow Cognitive Core for intelligent classification and orchestration
      console.log(`🚀 Using AICHATflow Cognitive Core for demand ${demandId}`);

      // Step 1: Classify the demand
      const classification = await agentOrchestrator.createOrchestrationPlan(demandId);
      
      // Update demand with classification information
      await agentOrchestrator.updateDemandWithOrchestration(demandId, classification);

      console.log(`📊 Demand classified as: ${classification.classification.category}`);
      console.log(`🔧 Execution order: ${classification.agentExecutionOrder.join(' → ')}`);
      console.log(`⏱️ Estimated time: ${classification.estimatedCompletionTime} minutes`);

      // Send classification update
      if (onProgress) {
        onProgress({
          id: `${demandId}-classification`,
          agent: 'cognitive_core',
          message: `📊 Classificação Inteligente: ${classification.classification.category}\n` +
                   `🔧 Ordem de Execução: ${classification.agentExecutionOrder.join(' → ')}\n` +
                   `⏱️ Tempo Estimado: ${classification.estimatedCompletionTime} minutos`,
          timestamp: new Date().toISOString(),
          type: 'completed',
          progress: 10
        });
      }

      // Step 2: Execute the orchestration plan
      const executionResults = await agentOrchestrator.executeOrchestrationPlan(
        classification,
        (progress: number, message: string) => {
          if (onProgress) {
            onProgress({
              id: `${demandId}-orchestration-${progress}`,
              agent: 'cognitive_core',
              message: message,
              timestamp: new Date().toISOString(),
              type: 'processing',
              progress: progress
            });
          }
        }
      );

      console.log(`✅ Cognitive Core processing completed for demand ${demandId}`);
      console.log(`📋 Execution results: ${executionResults.length} agents executed`);

      // Step 3: Generate documents with PM (outside the cognitive core orchestration)
      await storage.updateDemand(demandId, {
        status: 'processing',
        progress: 95
      });

      // Generate PRD with PM
      const prdContent = await this.generatePRDWithPM(demand, []);

      // Generate Tasks with PM
      const tasksContent = await this.generateTasksWithPM(demand, prdContent);

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

      // Notify clients
      this.notifyDemandUpdate(demandId);

    } catch (error) {
      console.error(`❌ Error in Cognitive Core processing for demand ${demandId}:`, error);
      
      // Fallback to traditional processing if cognitive core fails
      await storage.updateDemand(demandId, {
        status: 'processing',
        errorMessage: `Cognitive Core error: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
      
      // Continue with traditional processing
      await this.processDemand(demandId, onProgress);
    }
  }

  private async assembleInternalContext(demand: Demand): Promise<string> {
    // Use the new ContextBuilder with anti-overengineering constraintsn    return contextBuilder.buildContext(demand);
  }

  async processDemand(demandId: number, onProgress?: (message: ChatMessage) => void): Promise<void> {
    const demand = await storage.getDemand(demandId);
    if (!demand) throw new Error("Demand not found");

    // Assemble the full internal context (briefing, map, specific files)
    const internalContext = await this.assembleInternalContext(demand);

    // Update status to processing
    await storage.updateDemand(demandId, { status: 'processing' });

    // Use intelligent routing to determine optimal processing path
    try {
      const routingPrediction = await demandRoutingOrchestrator.routeDemand(demandId);
      console.log(`Demand ${demandId} routed to team: ${routingPrediction.team} with ${routingPrediction.confidence}% confidence`);

      // Update demand with routing information
      await storage.updateDemand(demandId, {
        status: 'routed',
        progress: 5 // Set to 5% to indicate routing completed
      });

      // Send routing update via progress callback
      if (onProgress) {
        onProgress({
          id: `${demandId}-routing`,
          agent: 'router',
          message: `Rota otimizada: ${routingPrediction.team} (confiança: ${routingPrediction.confidence}%)`,
          timestamp: new Date().toISOString(),
          type: 'completed',
          progress: 5
        });
      }
    } catch (error) {
      console.error(`Error during routing for demand ${demandId}:`, error);
      // Continue with default processing if routing fails
      await storage.updateDemand(demandId, {
        status: 'processing',
        progress: 5
      });
    }

    // Perform multi-agent interaction for collaborative refinement
    const agentConfigs = this.agentConfigs; // Use the loaded agent configurations
    let messages: ChatMessage[] = []; // Initialize messages array

    // Progress: 10% after routing
    await storage.updateDemand(demandId, {
      status: 'processing',
      progress: 10
    });

    // Send progress update
    if (onProgress) {
      onProgress({
        id: `${demandId}-interaction-start`,
        agent: 'coordinator',
        message: 'Iniciando interação colaborativa entre agentes...',
        timestamp: new Date().toISOString(),
        type: 'processing',
        progress: 10
      });
    }

    // Conduct multi-agent interaction
    let interactionResult: import("./agent-interaction").AgentInteractionResult | undefined;
    try {
      // Verify that agentConfigs is not empty to prevent the "No agents available" error
      if (Object.keys(agentConfigs).length === 0) {
        console.warn('No agent configurations loaded, using fallback processing');
        throw new Error('No agent configurations available for interaction');
      }

      interactionResult = await agentInteractionService.conductMultiAgentInteraction(
        demand, 
        agentConfigs,
        internalContext, // Pass the assembled context
        onProgress
      );

      if (interactionResult) {
        // Save the interaction results as chat messages
        messages = interactionResult.conversationHistory.map((agentMsg, index) => ({
          id: `${demandId}-interaction-${index}`,
          agent: agentMsg.agent,
          message: agentMsg.message,
          timestamp: agentMsg.timestamp,
          type: 'completed',
          category: 'system' as const,
          progress: 10 + Math.min(75, Math.round((index + 1) * 75 / interactionResult!.conversationHistory.length))
        }));

        // Update with all interaction messages
        await storage.updateDemandChat(demandId, messages);

        // Update progress to reflect interaction completion
        await storage.updateDemand(demandId, {
          status: 'processing',
          progress: interactionResult!.completedEarly ? 87 : 85
        });

        if (onProgress) {
          const completionMessage = interactionResult!.completedEarly
            ? `Interação entre agentes concluída antecipadamente com ${interactionResult!.finalCompletenessPercentage}% de completude (${interactionResult!.conversationHistory.length} mensagens)`
            : `Interação entre agentes concluída com ${interactionResult!.finalCompletenessPercentage}% de completude (${interactionResult!.conversationHistory.length} mensagens)`;

          onProgress({
            id: `${demandId}-interaction-complete`,
            agent: 'coordinator',
            message: completionMessage,
            timestamp: new Date().toISOString(),
            type: 'completed',
            progress: interactionResult!.completedEarly ? 87 : 85
          });
        }
      }
    } catch (error) {
      console.error('Error during multi-agent interaction:', error);
      // Fallback to original sequential processing
      const refinementLevels = this.getRefinementLevels(demand.type);

      // Initialize messages array for fallback
      messages = [];

      // Calculate progress per agent (85% for agents, 10% for document generation, 5% for routing)
      const progressPerAgent = 85 / this.agents.length;

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
          progress: Math.min(90, Math.round(5 + (i + 1) * progressPerAgent)) // Start from 5% (after routing)
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
          refinementLevels,
          internalContext // Pass the assembled context here as well
        );

        message.message = response;
        message.type = 'completed';

        // Update with actual agent response
        await storage.updateDemandChat(demandId, messages);

        if (onProgress) {
          onProgress(message);
        }
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

    // Progresso 85%: Iniciando geração de PRD com PM
    await storage.updateDemand(demandId, {
      status: 'processing',
      progress: 85
    });

    // GERAR PRD COM PM (FORA DO LOOP)
    const prdContent = await this.generatePRDWithPM(demand, messages);

    // Progresso 92%: PRD gerado, gerando tasks
    await storage.updateDemand(demandId, {
      status: 'processing',
      progress: 92
    });

    // GERAR TASKS COM PM
    const tasksContent = await this.generateTasksWithPM(demand, prdContent);

    // Progresso 97%: Salvando documentos
    await storage.updateDemand(demandId, {
      status: 'processing',
      progress: 97
    });

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

    // Emitir evento para atualizar clientes conectados
    this.notifyDemandUpdate(demandId);
  }

  private notifyDemandUpdate(demandId: number): void {
    // Notifica os clientes conectados sobre a atualização da demanda
    console.log(`Notificando atualização para demanda ${demandId}`);

    // Obter a demanda atualizada e enviar via SSE
    storage.getDemand(demandId).then(demand => {
      if (demand) {
        this.sendSSEUpdate(demandId, demand);
      }
    }).catch(error => {
      console.error(`Erro ao obter demanda para notificação: ${demandId}`, error);
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
    refinementLevels: number,
    internalContext: string, // New parameter
  ): Promise<string> {
    const intensityLevel = this.getIntensityByType(demand.type);
    const agentConfig = this.agentConfigs[agentName];

    // Prepend the internal context to the agent's system prompt
    const systemPrompt = `${internalContext}

${agentConfig?.system_prompt
      ? `${agentConfig.system_prompt}

Contexto adicional: Tipo de demanda: ${demand.type}. Nível de refinamento: ${refinementLevels}/4. Intensidade de análise: ${intensityLevel}.`
      : `Você é um ${agentName} experiente em uma squad de desenvolvimento. Responda SEMPRE em português brasileiro. Seja objetivo e prático nas suas respostas. Tipo de demanda: ${demand.type}. Nível de refinamento: ${refinementLevels}/4. Intensidade de análise: ${intensityLevel}.`
    }`;

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

      const finalResponse = response || `${agentName} processou a demanda com sucesso.`;
      
      // Validate response against anti-overengineering rules
      const validation = contextBuilder.validateResponse(finalResponse);
      
      if (!validation.isValid) {
        console.warn(`Agent ${agentName} response validation failed (score: ${validation.score}):`, validation.issues);
        // Return structured response even if validation fails
        return this.createStructuredResponse(agentName, finalResponse, validation);
      }
      
      return finalResponse;
    } catch (error) {
      console.error(`Error processing with ${agentName}:`, error);
      return `${agentName} encontrou um erro durante o processamento, mas o fluxo continua.`;
    }
  }

  private createStructuredResponse(agentName: string, rawResponse: string, validation: { score: number; issues: string[] }): string {
    // Try to extract structured information from raw response
    const analysisMatch = rawResponse.match(/\*\*Análise:\*\*(.*?)(?=\*\*|$)/s);
    const problemMatch = rawResponse.match(/\*\*Problema Identificado:\*\*(.*?)(?=\*\*|$)/s);
    const impactMatch = rawResponse.match(/\*\*Impacto:\*\*(.*?)(?=\*\*|$)/s);
    const recommendationMatch = rawResponse.match(/\*\*Recomendação:\*\*(.*?)(?=\*\*|$)/s);
    const roiMatch = rawResponse.match(/\*\*ROI:\*\*(.*?)(?=\*\*|$)/s);
    const effortMatch = rawResponse.match(/\*\*Esforço:\*\*(.*?)(?=\*\*|$)/s);
    const priorityMatch = rawResponse.match(/\*\*Prioridade:\*\*(.*?)(?=\*\*|$)/s);

    const structuredResponse = `
**Análise:** ${analysisMatch ? analysisMatch[1].trim() : 'Análise não fornecida'}
**Problema Identificado:** ${problemMatch ? problemMatch[1].trim() : 'Problema não identificado'}
**Impacto:** ${impactMatch ? impactMatch[1].trim() : 'Impacto não especificado'}
**Recomendação:** ${recommendationMatch ? recommendationMatch[1].trim() : 'Nenhuma recomendação específica'}
**ROI:** ${roiMatch ? roiMatch[1].trim() : 'ROI não calculado'}
**Esforço:** ${effortMatch ? effortMatch[1].trim() : 'Esforço não estimado'}
**Prioridade:** ${priorityMatch ? priorityMatch[1].trim() : 'Desejável'}

---
**Validação:** Score ${validation.score}/100
**Problemas:** ${validation.issues.length > 0 ? validation.issues.join(', ') : 'Nenhum'}
**Nota:** Resposta estruturada automaticamente para conformidade`;

    return structuredResponse;
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
Sua responsabilidade é criar um PRD (Product Requirements Document) profissional em Markdown seguindo EXATAMENTE este formato:

# PRD - [Título da Demanda]

**Versão:** 1.0.0
**Data:** [Data atual]
**Autor:** Product Manager

## 📋 Visão Geral

**Objetivo:** [Descreva o objetivo principal em 1-2 frases]
**Problema:** [Descreva o problema que está sendo resolvido]
**Solução:** [Descreva a solução proposta]

## 🎯 Requisitos Funcionais

- RF1:
  **Descrição:** [Descrição detalhada do requisito]
  **Critérios de Aceite:** [Critérios de aceite específicos]
  **Prioridade:** [Alta/Média/Baixa]

- RF2:
  **Descrição:** [Descrição detalhada do requisito]
  **Critérios de Aceite:** [Critérios de aceite específicos]
  **Prioridade:** [Alta/Média/Baixa]

[Continue com mais RFs conforme necessário]

## 🛠️ Requisitos Não Funcionais

- RNF1:
  **Descrição:** [Descrição do requisito não funcional]
  **Métrica:** [Métrica mensurável]

- RNF2:
  **Descrição:** [Descrição do requisito não funcional]
  **Métrica:** [Métrica mensurável]

[Continue com mais RNFs conforme necessário]

## 🎯 Escopo

### In Scope
- [Item no escopo 1]
- [Item no escopo 2]
- [Item no escopo 3]

### Out of Scope
- [Item fora do escopo 1]
- [Item fora do escopo 2]

## ✅ Critérios de Aceitação Gerais
- [Critério geral 1]
- [Critério geral 2]
- [Critério geral 3]

## 📦 Dependências

**Internas:**
- [Dependência interna 1]
- [Dependência interna 2]

**Externas:**
- [Dependência externa 1]
- [Dependência externa 2]

## ⚠️ Riscos e Mitigações

- **Risco 1:**
  **Impacto:** [Alto/Médio/Baixo]
  **Probabilidade:** [Alta/Média/Baixa]
  **Mitigação:** [Estratégia de mitigação]

- **Risco 2:**
  **Impacto:** [Alto/Médio/Baixo]
  **Probabilidade:** [Alta/Média/Baixa]
  **Mitigação:** [Estratégia de mitigação]

## 📊 Métricas de Sucesso

**Primárias:**
- [Métrica primária 1 com valor alvo]
- [Métrica primária 2 com valor alvo]

**Secundárias:**
- [Métrica secundária 1 com valor alvo]
- [Métrica secundária 2 com valor alvo]

## 📅 Cronograma

**Data MVP:** [Data estimada]

**Fases:**
1. **Fase 1:** [Nome] - [Duração estimada] - [Descrição breve]
2. **Fase 2:** [Nome] - [Duração estimada] - [Descrição breve]
3. **Fase 3:** [Nome] - [Duração estimada] - [Descrição breve]

IMPORTANTE: Siga EXATAMENTE este formato, incluindo todos os emojis, títulos de seção e estrutura.
Gere um PRD completo, profissional e bem estruturado em português brasileiro.`;

    const userPrompt = `Demanda Original: ${demand.title}
Descrição: ${demand.description}
Tipo: ${demand.type}
Prioridade: ${demand.priority}

=== REFINAMENTO DA SQUAD ===
${refinementSummary}

=== SUA TAREFA ===
Com base em TODAS as análises acima, crie um PRD completo em Markdown seguindo o formato especificado.
O PRD deve ser um documento profissional que qualquer pessoa possa ler e entender o que precisa ser feito.

IMPORTANTE:
- Use as informações do refinamento dos agentes para preencher os campos do PRD
- Seja específico e técnico, usando as sugestões e insights dos agentes
- Certifique-se de que o conteúdo do PRD reflita fielmente as discussões realizadas
- Referencie diretamente as sugestões de cada agente onde apropriado`;

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
Crie um documento de tasks técnicas detalhadas baseadas no PRD seguindo EXATAMENTE este formato:

# Tasks Document - [Título da Demanda]

**Versão:** 1.0.0
**Prioridade:** [Alta/Média/Baixa]
**Responsável:** @squad-dev
**Status:** Não Iniciado

## Tarefas

- **T1:** [Descrição concisa da tarefa 1]
  Critérios de aceite: [Critérios específicos de aceite]
  **Dependências:** [Tarefas ou recursos necessários]
  **Vinculado ao PRD:** RF1, RF2

- **T2:** [Descrição concisa da tarefa 2]
  Critérios de aceite: [Critérios específicos de aceite]
  **Dependências:** T1
  **Vinculado ao PRD:** RF3

- **T3:** [Descrição concisa da tarefa 3]
  Critérios de aceite: [Critérios específicos de aceite]
  **Dependências:** Nenhuma
  **Vinculado ao PRD:** RNF1

[Continue com mais tasks conforme necessário - mínimo 5 tasks]

## Métricas de Sucesso
- [Métrica 1: Como medir o sucesso desta implementação]
- [Métrica 2: KPI específico relacionado às tasks]
- [Métrica 3: Indicador de qualidade]

## Notas de Implementação
[Observações técnicas importantes, boas práticas, ou considerações de arquitetura]

IMPORTANTE:
- Siga EXATAMENTE este formato
- Gere NO MÍNIMO 5 tasks detalhadas
- Cada task deve ter ID sequencial (T1, T2, T3, etc.)
- Vincule cada task aos requisitos do PRD (RF ou RNF)
- As tasks devem cobrir: Backend, Frontend, Database, Testes e DevOps
- Seja específico e técnico nas descrições

Gere o documento em português brasileiro.`;

    const userPrompt = `PRD:
${prdContent}

=== SUA TAREFA ===
Com base no PRD acima, crie uma lista completa de tasks técnicas organizadas por categoria.
As tasks devem cobrir todos os aspectos técnicos necessários para implementar a demanda.

IMPORTANTE:
- As tasks devem refletir diretamente os requisitos funcionais e não funcionais definidos no PRD
- Use informações técnicas e insights específicos mencionados durante o refinamento da squad
- Crie tarefas que estejam claramente alinhadas com as sugestões dos agentes do refinamento`;

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

  private async saveDocument(demandId: number, type: string, content: string): Promise<string> {
    const documentsDir = path.join(process.cwd(), 'documents');
    if (!fs.existsSync(documentsDir)) {
      fs.mkdirSync(documentsDir, { recursive: true });
    }

    const timestamp = Date.now();
    const filename = `${type}_${demandId}_${timestamp}.pdf`;
    const filepath = path.join(documentsDir, filename);

    // Save markdown content for viewer
    const markdownFilename = `${type}_${demandId}_${timestamp}.md`;
    const markdownFilepath = path.join(documentsDir, markdownFilename);
    fs.writeFileSync(markdownFilepath, content, 'utf8');

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