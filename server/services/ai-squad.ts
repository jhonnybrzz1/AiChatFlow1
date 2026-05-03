import { type Demand, type ChatMessage, type RefinementType } from "@shared/schema";
import { storage } from "../storage";
import fs from "fs";
import path from "path";
import { openAIService } from "./openai-ai";
import yaml from "js-yaml";
import { pdfGenerator } from "./pdf-generator";
import { demandRoutingOrchestrator } from "../routing/orchestrator";
import { DiscoveryPlugin } from "../plugins/discovery-plugin";
import { BugPlugin } from "../plugins/bug-plugin";
import { ImprovementPlugin } from "../plugins/improvement-plugin";
import { FeaturePlugin } from "../plugins/feature-plugin";
import { agentInteractionService } from "./agent-interaction";
import { agentOrchestrator } from "../cognitive-core/agent-orchestrator";
import { frameworkManager } from "../frameworks/framework-manager";
import { gitHubService } from './github';
import { repoService } from './repo-service';
import { contextBuilder } from './context-builder';
import { RealityBasedRefinement } from '../cognitive-core/reality-based-refinement';
import { typeContractValidator } from '../utils/typeContractValidator';
import { getDemandTypeConfig } from '@shared/demand-types';
import {
  IMPROVEMENT_EXECUTION_CONFIG_VERSION,
  improvementExecutionService
} from './improvement-execution';
import { canonicalAgentKey, isProductManagerAgent } from './agent-identity';
import {
  MODEL_MINI,
  MODEL_NANO,
  modelRoutingService,
  type ModelRoutingFailureReason,
} from './model-routing';
import { demandClassifier, type DemandClassification } from './demand-classifier';
import { summaryBuilder } from './structured-summary';

// Adicionando interface para gerenciamento de SSE
interface SSEConnection {
  res: any;
  lastEventId: number;
}

export class AISquadService {
  private agents: { name: string, icon: string, description: string }[] = [];
  private agentConfigs: Record<string, { system_prompt: string, description: string, model?: string }> = {};
  private sseConnections: Map<number, SSEConnection> = new Map(); // Map de demandId para connection
  private realityBasedRefinement: RealityBasedRefinement;

  constructor() {
    this.realityBasedRefinement = new RealityBasedRefinement();
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
      demandRoutingOrchestrator.registerPlugin(new FeaturePlugin());
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
      // Refinador removido - clarificação já é feita pelo PO e classificador
      this.agents = [
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
        const agentName = canonicalAgentKey(config.name);
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

      // Refinador removido do fluxo - não é mais necessário
      // A clarificação é feita pelo classificador de demandas e pelo PO

      // PM não deve estar no loop de agentes - será chamado separadamente
      // Remover PM se foi adicionado via YAML
      this.agents = this.agents.filter(a => !isProductManagerAgent(a.name));

      // IMPORTANTE: Também remover PM do agentConfigs (usado na interação multi-agente)
      const pmKeys = Object.keys(this.agentConfigs).filter(key => isProductManagerAgent(key));

      pmKeys.forEach(key => {
        delete this.agentConfigs[key];
      });

      console.log('Loaded agent configurations:', this.agents.map(a => a.name));
      console.log('Agent configs (excluding PM):', Object.keys(this.agentConfigs));

    } catch (error) {
      console.error('Error loading agent configurations:', error);
      // Fallback to default agents (sem PM e sem refinador)
      this.agents = [
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

      // UNIFIED: Initialize context with reality constraints (same as processDemand)
      const internalContext = await this.assembleInternalContext(demand);

      // UNIFIED: Apply reality constraints BEFORE any processing
      try {
        const realityConstraints = await this.realityBasedRefinement.getConstraintsForDemandType(demand.type);
        contextBuilder.setRealityConstraints(demandId, {
          maturityLevel: realityConstraints.maturityLevel || 'MVP',
          demandType: realityConstraints.demandType || demand.type,
          canonicalDemandType: realityConstraints.canonicalDemandType,
          allowedTechnologies: realityConstraints.allowedTechnologies || ['TypeScript', 'React', 'Node.js', 'Vite', 'SQLite'],
          forbiddenTechnologies: realityConstraints.forbiddenTechnologies || ['kubernetes', 'microservices', 'blockchain'],
          maxEffortDays: realityConstraints.maxEffortDays || 14,
          minROI: realityConstraints.minROI || '3:1',
          outputType: realityConstraints.outputType,
          typeRequirements: realityConstraints.typeRequirements || []
        });

        if (onProgress) {
          onProgress({
            id: `${demandId}-reality-check`,
            agent: 'reality_checker',
            message: `🔍 Reality Check aplicado: Maturity Level ${realityConstraints.maturityLevel}`,
            timestamp: new Date().toISOString(),
            type: 'completed',
            progress: 3
          });
        }
      } catch (error) {
        console.warn(`Reality check failed, using defaults`);
        contextBuilder.setRealityConstraints(demandId, {
          maturityLevel: 'MVP',
          allowedTechnologies: ['TypeScript', 'React', 'Node.js', 'Vite', 'SQLite'],
          forbiddenTechnologies: ['kubernetes', 'microservices', 'blockchain'],
          maxEffortDays: 14,
          minROI: '3:1',
          demandType: demand.type,
          outputType: 'standard refinement',
          typeRequirements: []
        });
      }

      // Step 1: Classify the demand
      const classification = await agentOrchestrator.createOrchestrationPlan(demandId);

      // Update demand with classification information
      await agentOrchestrator.updateDemandWithOrchestration(demandId, classification);

      console.log(`📊 Demand classified as: ${classification.classification.category}`);
      console.log(`🔧 Execution order: ${classification.agentExecutionOrder.join(' → ')}`);
      const readiness = classification.classification.personalReadiness;
      const readinessMessage = readiness
        ? `\nProntidão pessoal: ${readiness.score}% (${readiness.level})\nRecomendação: ${readiness.recommendation}`
        : '';

      // Send classification update
      if (onProgress) {
        onProgress({
          id: `${demandId}-classification`,
          agent: 'cognitive_core',
          message: `📊 Classificação: ${classification.classification.category}\n` +
                   `🔧 Ordem: ${classification.agentExecutionOrder.join(' → ')}${readinessMessage}`,
          timestamp: new Date().toISOString(),
          type: 'completed',
          progress: 10
        });
      }

      // Step 2: Execute orchestration with context evolution
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

      // UNIFIED: Add execution results to evolving context
      for (const result of executionResults) {
        if (result.message) {
          contextBuilder.addAgentInsight(demandId, result.agentName || 'unknown', result.message);
        }
      }

      console.log(`✅ Cognitive Core completed for demand ${demandId}`);

      // Step 3: Generate documents with PM (uses evolved context with all insights)
      await storage.updateDemand(demandId, {
        status: 'processing',
        progress: 90
      });

      // Convert execution results to chat messages for PRD generation
      const refinementMessages: ChatMessage[] = executionResults.map((result, index) => ({
        id: `${demandId}-result-${index}`,
        agent: result.agentName || 'unknown',
        message: result.message || '',
        timestamp: new Date().toISOString(),
        type: 'completed' as const
      }));

      // Generate PRD with PM (validated)
      const prdContent = await this.generatePRDWithPM(demand, refinementMessages);

      // Generate Tasks with PM (validated)
      const tasksContent = await this.generateTasksWithPM(demand, prdContent);

      // Validate type adherence if refinement type is set
      const refinementType = demand.refinementType as RefinementType;
      const typeAdherence = typeContractValidator.validateTypeAdherence(prdContent, refinementType);

      // Log type adherence result
      if (refinementType) {
        console.log(`📋 Type adherence for demand ${demandId} (${refinementType}): ${typeAdherence.isAdherent ? '✅ Passed' : '⚠️ Failed'} - Score: ${typeAdherence.score}%`);
      }

      // Save documents
      const prdPath = await this.saveDocument(demandId, 'PRD', prdContent);
      const tasksPath = await this.saveDocument(demandId, 'Tasks', tasksContent);

      // Update demand with document paths, type adherence, and final progress
      await storage.updateDemand(demandId, {
        status: 'completed',
        progress: 100,
        prdUrl: prdPath,
        tasksUrl: tasksPath,
        typeAdherence: typeAdherence
      });

      // UNIFIED: Clean up evolving context
      contextBuilder.clearEvolvingContext(demandId);
      console.log(`✅ Demand ${demandId} completed via Cognitive Core`);

      // Notify clients
      this.notifyDemandUpdate(demandId);

    } catch (error) {
      console.error(`❌ Error in Cognitive Core for demand ${demandId}:`, error);

      // Clean up context on error
      contextBuilder.clearEvolvingContext(demandId);

      // UNIFIED: Fallback to standard processing with clear notification
      await storage.updateDemand(demandId, {
        status: 'processing',
        errorMessage: `Fallback: ${error instanceof Error ? error.message : 'Unknown error'}`
      });

      if (onProgress) {
        onProgress({
          id: `${demandId}-fallback`,
          agent: 'system',
          message: `⚠️ Cognitive Core indisponível, usando processamento padrão...`,
          timestamp: new Date().toISOString(),
          type: 'processing',
          progress: 5
        });
      }

      // Continue with standard processing (which also has reality check)
      await this.processDemand(demandId, onProgress);
    }
  }

  private async assembleInternalContext(demand: Demand): Promise<string> {
    // Use the new ContextBuilder with anti-overengineering constraints
    return contextBuilder.buildContext(demand);
  }

  async processDemand(demandId: number, onProgress?: (message: ChatMessage) => void): Promise<void> {
    const demand = await storage.getDemand(demandId);
    if (!demand) throw new Error("Demand not found");

    // Assemble the full internal context (briefing, map, specific files)
    const internalContext = await this.assembleInternalContext(demand);

    // Update status to processing


    // === TOKEN OPTIMIZATION: DEMAND CLASSIFICATION ===
    let classification: DemandClassification;
    let activeAgents = this.agents;

    try {
      classification = await demandClassifier.classify(demand);
      
      console.log(`[TOKEN OPT] Demand ${demandId} classified:`, {
        complexity: classification.complexity,
        requiredAgents: classification.requiredAgents.length,
        estimatedTokens: classification.estimatedInputTokens + classification.estimatedOutputTokens
      });

      // Filtrar agentes baseado na classificação
      activeAgents = this.agents.filter(agent => 
        classification.requiredAgents.includes(agent.name)
      );

      console.log(`[TOKEN OPT] Using ${activeAgents.length} of ${this.agents.length} agents`);

      // Salvar classificação na demanda
      await storage.updateDemand(demandId, {
        tokenOptimization: {
          complexity: classification.complexity,
          requiredAgents: classification.requiredAgents,
          estimatedInputTokens: classification.estimatedInputTokens,
          estimatedOutputTokens: classification.estimatedOutputTokens,
          confidence: classification.confidence,
          reasoning: classification.reasoning
        }
      });

      // Notificar progresso
      if (onProgress) {
        onProgress({
          id: `${demandId}-classification`,
          agent: 'classifier',
          message: `✅ Classificação: ${classification.complexity} complexidade, ${classification.requiredAgents.length} agentes (${classification.requiredAgents.join(', ')})`,
          timestamp: new Date().toISOString(),
          type: 'completed',
          progress: 8
        });
      }

    } catch (error) {
      console.error('[TOKEN OPT] Classification failed, using all agents:', error);
      classification = {
        type: demand.type,
        complexity: 'medium',
        requiredAgents: this.agents.map(a => a.name),
        estimatedInputTokens: 50000,
        estimatedOutputTokens: 15000,
        confidence: 0.5,
        reasoning: 'Fallback due to classification error'
      };
    }
    // === END TOKEN OPTIMIZATION ===

    await storage.updateDemand(demandId, { status: 'processing' });

    // REALITY CHECK: Apply reality constraints BEFORE any agent processing
    try {
      console.log(`🔍 Applying Reality Check for demand ${demandId}...`);
      const realityConstraints = await this.realityBasedRefinement.getConstraintsForDemandType(demand.type);

      // Set reality constraints in the context builder
      contextBuilder.setRealityConstraints(demandId, {
        maturityLevel: realityConstraints.maturityLevel || 'MVP',
        demandType: realityConstraints.demandType || demand.type,
        canonicalDemandType: realityConstraints.canonicalDemandType,
        allowedTechnologies: realityConstraints.allowedTechnologies || ['TypeScript', 'React', 'Node.js', 'Vite', 'SQLite'],
        forbiddenTechnologies: realityConstraints.forbiddenTechnologies || ['kubernetes', 'microservices', 'blockchain'],
        maxEffortDays: realityConstraints.maxEffortDays || 14,
        minROI: realityConstraints.minROI || '3:1',
        outputType: realityConstraints.outputType,
        typeRequirements: realityConstraints.typeRequirements || []
      });

      console.log(`✅ Reality constraints applied: ${realityConstraints.maturityLevel}`);

      if (onProgress) {
        onProgress({
          id: `${demandId}-reality-check`,
          agent: 'reality_checker',
          message: `🔍 Reality Check aplicado: Maturity Level ${realityConstraints.maturityLevel}, Stack permitida: ${(realityConstraints.allowedTechnologies || []).slice(0, 3).join(', ')}`,
          timestamp: new Date().toISOString(),
          type: 'completed',
          progress: 3
        });
      }
    } catch (error) {
      console.warn(`Reality check failed for demand ${demandId}, continuing with defaults:`, error);
      // Apply default constraints if reality check fails
      contextBuilder.setRealityConstraints(demandId, {
        maturityLevel: 'MVP',
        demandType: demand.type,
        allowedTechnologies: ['TypeScript', 'React', 'Node.js', 'Vite', 'SQLite'],
        forbiddenTechnologies: ['kubernetes', 'microservices', 'blockchain', 'kafka', 'elasticsearch'],
        maxEffortDays: 14,
        minROI: '3:1',
        outputType: 'standard refinement',
        typeRequirements: []
      });
    }

    // Use intelligent routing to determine optimal processing path
    try {
      const routingPrediction = await demandRoutingOrchestrator.routeDemand(demandId);
      console.log(`Demand ${demandId} routed to team: ${routingPrediction.team} with ${routingPrediction.confidence}% confidence`);

      await modelRoutingService.recordStageRun({
        demandId,
        stageName: 'router',
        modelUsed: modelRoutingService.classifyRouterModel(),
        attemptIndex: 1,
        status: 'completed',
        validationPassed: true,
        validationErrorsCount: 0,
        metadata: {
          team: routingPrediction.team,
          confidence: routingPrediction.confidence,
          decisionContract: 'router_classification_always_nano',
        },
      });

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
          progress: 5,
          metadata: {
            modelRouting: {
              stageName: 'router',
              modelUsed: MODEL_NANO,
              attemptIndex: 1,
              status: 'completed',
            },
          },
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

    const executionId = demand.type === 'melhoria'
      ? improvementExecutionService.createExecutionId()
      : undefined;
    const domain = improvementExecutionService.normalizeDomain(demand.domain);
    const parallelEnabled = demand.type === 'melhoria' && this.isImprovementParallelEnabled();
    const improvementConfig = improvementExecutionService.getImprovementAgentConfigs(this.agentConfigs, {
      ...demand,
      domain
    });

    if (executionId) {
      const fallbackReason = improvementConfig.fallbackReason || null;
      await storage.updateDemand(demandId, {
        executionId,
        executionConfig: {
          configVersion: IMPROVEMENT_EXECUTION_CONFIG_VERSION,
          profile: parallelEnabled ? 'experimental_parallel_subset' : 'baseline_sequential',
          domain,
          template: 'improvement',
          parallelAgents: parallelEnabled ? ['qa', 'ux', 'analista_de_dados'] : [],
          maxConcurrency: parallelEnabled ? 3 : 1,
        },
        fallbackUsed: improvementConfig.fallbackUsed,
        fallbackReason,
      });
      improvementExecutionService.recordEvent({
        executionId,
        demandId,
        eventType: 'execution_started',
        configVersion: IMPROVEMENT_EXECUTION_CONFIG_VERSION,
        timestamp: new Date().toISOString(),
        fallbackUsed: improvementConfig.fallbackUsed,
        fallbackReason: fallbackReason || undefined,
        metadata: {
          domain,
          demandType: demand.type,
          profile: parallelEnabled ? 'experimental_parallel_subset' : 'baseline_sequential',
        },
      });
    }

    // Perform multi-agent interaction for collaborative refinement
    // Filter agentConfigs to only include agents from classification (token optimization)
    const fullAgentConfigs = improvementConfig.configs;
    const activeAgentNames = new Set(activeAgents.map(a => a.name));
    // Refinador removido - clarificação feita pelo classificador e PO
    const agentConfigs = Object.fromEntries(
      Object.entries(fullAgentConfigs).filter(([name]) => activeAgentNames.has(name))
    );
    console.log(`[TOKEN OPT] Filtered configs: ${Object.keys(agentConfigs).length} of ${Object.keys(fullAgentConfigs).length} agents (${Array.from(activeAgentNames).join(', ')})`);
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
        onProgress,
        {
          executionId,
          enableParallelSubset: parallelEnabled,
          maxConcurrency: 3,
        }
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
          progress: 10 + Math.min(75, Math.round((index + 1) * 75 / interactionResult!.conversationHistory.length)),
          metadata: agentMsg.metadata
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
      const progressPerAgent = 85 / activeAgents.length;

      for (let i = 0; i < activeAgents.length; i++) {
        // Check if processing was stopped
        if (this.stopRequests.has(demandId)) {
          this.stopRequests.delete(demandId);
          await storage.updateDemand(demandId, { status: 'stopped' });
          return;
        }

        const agent = activeAgents[i];
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
    let prdContent = await this.generatePRDWithPM(demand, messages);

    // Progresso 92%: PRD gerado, gerando tasks
    await storage.updateDemand(demandId, {
      status: 'processing',
      progress: 92
    });

    // GERAR TASKS COM PM
    let tasksContent = await this.generateTasksWithPM(demand, prdContent);

    // Progresso 97%: Validando aderência ao tipo e salvando documentos
    await storage.updateDemand(demandId, {
      status: 'processing',
      progress: 97
    });

    // Validate type adherence if refinement type is set
    const refinementType = demand.refinementType as RefinementType;
    const typeAdherence = typeContractValidator.validateTypeAdherence(prdContent, refinementType);
    let qualityChecklist = demand.type === 'melhoria'
      ? improvementExecutionService.validateImprovementPlan(prdContent)
      : { qualityPassed: typeAdherence.isAdherent, missingSections: [] };
    const templateValidationErrorsCount = demand.type === 'melhoria'
      ? qualityChecklist.missingSections.length
      : (typeAdherence.isAdherent ? 0 : Math.max(1, typeAdherence.sectionsRequired - typeAdherence.sectionsMet));

    await modelRoutingService.recordStageRun({
      demandId,
      executionId,
      stageName: 'template_validator',
      modelUsed: MODEL_NANO,
      attemptIndex: 1,
      status: qualityChecklist.qualityPassed ? 'completed' : 'fallback_triggered',
      validationPassed: qualityChecklist.qualityPassed,
      validationErrorsCount: templateValidationErrorsCount,
      failureReason: qualityChecklist.qualityPassed ? null : 'validation_failed',
      metadata: {
        missingSections: qualityChecklist.missingSections,
        typeAdherenceScore: typeAdherence.score,
      },
    });

    if (!qualityChecklist.qualityPassed) {
      const fallback = modelRoutingService.shouldFallback({
        demandId,
        executionId,
        stageName: 'template_validator',
        attemptIndex: 1,
        failureReason: 'validation_failed',
      });

      if (fallback.allowed) {
        prdContent = await this.generatePRDWithPM(demand, messages, MODEL_MINI);
        tasksContent = await this.generateTasksWithPM(demand, prdContent, MODEL_MINI);

        const retryTypeAdherence = typeContractValidator.validateTypeAdherence(prdContent, refinementType);
        qualityChecklist = demand.type === 'melhoria'
          ? improvementExecutionService.validateImprovementPlan(prdContent)
          : { qualityPassed: retryTypeAdherence.isAdherent, missingSections: [] };
        const retryErrorsCount = demand.type === 'melhoria'
          ? qualityChecklist.missingSections.length
          : (retryTypeAdherence.isAdherent ? 0 : Math.max(1, retryTypeAdherence.sectionsRequired - retryTypeAdherence.sectionsMet));

        await modelRoutingService.recordStageRun({
          demandId,
          executionId,
          stageName: 'template_validator',
          modelUsed: MODEL_MINI,
          attemptIndex: fallback.nextAttemptIndex,
          status: qualityChecklist.qualityPassed ? 'completed' : 'failed',
          validationPassed: qualityChecklist.qualityPassed,
          validationErrorsCount: retryErrorsCount,
          failureReason: qualityChecklist.qualityPassed ? null : fallback.failureReason,
          metadata: {
            fallbackFromModel: MODEL_NANO,
            missingSections: qualityChecklist.missingSections,
          },
        });
      } else {
        await modelRoutingService.recordStageRun({
          demandId,
          executionId,
          stageName: 'template_validator',
          modelUsed: MODEL_MINI,
          attemptIndex: 1,
          status: 'failed_after_retries',
          validationPassed: false,
          validationErrorsCount: templateValidationErrorsCount,
          failureReason: 'budget_exhausted',
          metadata: {
            missingSections: qualityChecklist.missingSections,
          },
        });
      }
    }

    const qaResult = this.validatePilotQualityInvariants(demand, prdContent, qualityChecklist.qualityPassed);
    await modelRoutingService.recordStageRun({
      demandId,
      executionId,
      stageName: 'qa',
      modelUsed: qaResult.qaPassed ? MODEL_NANO : MODEL_MINI,
      attemptIndex: 1,
      status: qaResult.qaPassed ? 'completed' : 'fallback_triggered',
      qaPassed: qaResult.qaPassed,
      qaBlockersCount: qaResult.blockers.length,
      failureReason: qaResult.qaPassed ? null : 'qa_failed_critical',
      finalArtifactAccepted: qaResult.qaPassed && qualityChecklist.qualityPassed,
      metadata: {
        blockers: qaResult.blockers,
        invariants: qaResult.invariants,
      },
    });

    if (!qaResult.qaPassed) {
      const fallback = modelRoutingService.shouldFallback({
        demandId,
        executionId,
        stageName: 'qa',
        attemptIndex: 1,
        failureReason: 'qa_failed_critical',
      });
      if (!fallback.allowed) {
        await modelRoutingService.recordStageRun({
          demandId,
          executionId,
          stageName: 'qa',
          modelUsed: MODEL_MINI,
          attemptIndex: 1,
          status: 'failed_after_retries',
          qaPassed: false,
          qaBlockersCount: qaResult.blockers.length,
          failureReason: 'budget_exhausted',
          finalArtifactAccepted: false,
          metadata: { blockers: qaResult.blockers },
        });
      }
    }

    const routingSummaryMessages: ChatMessage[] = [
      {
        id: `${demandId}-template-validator-routing`,
        agent: 'template_validator',
        message: qualityChecklist.qualityPassed
          ? 'Template Validator aprovado.'
          : `Template Validator encontrou ${qualityChecklist.missingSections.length} pendência(s) estrutural(is).`,
        timestamp: new Date().toISOString(),
        type: qualityChecklist.qualityPassed ? 'completed' : 'error',
        category: qualityChecklist.qualityPassed ? 'system' : 'alert',
        progress: 98,
        metadata: {
          modelRouting: {
            stageName: 'template_validator',
            modelUsed: qualityChecklist.qualityPassed ? MODEL_NANO : MODEL_MINI,
            attemptIndex: qualityChecklist.qualityPassed ? 1 : 2,
            status: qualityChecklist.qualityPassed ? 'completed' : 'failed',
            failureReason: qualityChecklist.qualityPassed ? null : 'validation_failed',
          },
        },
      },
      {
        id: `${demandId}-qa-routing`,
        agent: 'qa',
        message: qaResult.qaPassed
          ? 'QA de invariantes mínimas aprovado.'
          : `QA encontrou ${qaResult.blockers.length} blocker(s): ${qaResult.blockers.join(', ')}`,
        timestamp: new Date().toISOString(),
        type: qaResult.qaPassed ? 'completed' : 'error',
        category: qaResult.qaPassed ? 'system' : 'alert',
        progress: 99,
        metadata: {
          modelRouting: {
            stageName: 'qa',
            modelUsed: qaResult.qaPassed ? MODEL_NANO : MODEL_MINI,
            attemptIndex: 1,
            status: qaResult.qaPassed ? 'completed' : 'fallback_triggered',
            failureReason: qaResult.qaPassed ? null : 'qa_failed_critical',
          },
        },
      },
    ];
    messages = [...messages, ...routingSummaryMessages];
    await storage.updateDemandChat(demandId, messages);
    if (onProgress) {
      routingSummaryMessages.forEach(onProgress);
    }

    if (executionId) {
      improvementExecutionService.recordEvent({
        executionId,
        demandId,
        eventType: 'quality_gate',
        configVersion: IMPROVEMENT_EXECUTION_CONFIG_VERSION,
        timestamp: new Date().toISOString(),
        qualityPassed: qualityChecklist.qualityPassed,
        missingSections: qualityChecklist.missingSections,
        fallbackUsed: improvementConfig.fallbackUsed,
        fallbackReason: improvementConfig.fallbackReason,
      });
    }

    // Log type adherence result
    if (refinementType) {
      console.log(`📋 Type adherence for demand ${demandId} (${refinementType}): ${typeAdherence.isAdherent ? '✅ Passed' : '⚠️ Failed'} - Score: ${typeAdherence.score}%`);
    }

    // Save documents
    const prdPath = await this.saveDocument(demandId, 'PRD', prdContent);
    const tasksPath = await this.saveDocument(demandId, 'Tasks', tasksContent);

    // Update demand with document paths, type adherence, and final progress
    await storage.updateDemand(demandId, {
      status: 'completed',
      progress: 100,
      prdUrl: prdPath,
      tasksUrl: tasksPath,
      typeAdherence: typeAdherence,
      qualityPassed: qualityChecklist.qualityPassed,
      missingSections: qualityChecklist.missingSections,
      validationNotes: demand.type === 'melhoria'
        ? `quality_passed=${qualityChecklist.qualityPassed}; missing_sections=${qualityChecklist.missingSections.join(', ') || 'none'}; qa_passed=${qaResult.qaPassed}; qa_blockers=${qaResult.blockers.length}`
        : undefined
    });

    // Clean up evolving context after processing completes
    contextBuilder.clearEvolvingContext(demandId);
    console.log(`✅ Demand ${demandId} processing completed and context cleaned up`);

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
    return getDemandTypeConfig(type).refinementLevel;
  }

  private async processWithAgent(
    agentName: string,
    demand: Demand,
    refinementLevels: number,
    internalContext: string, // Mantido para compatibilidade, mas não usado
  ): Promise<string> {
    const intensityLevel = this.getIntensityByType(demand.type);
    const agentConfig = this.agentConfigs[agentName];

    // === TOKEN OPTIMIZATION: USE AGENT-SPECIFIC CONTEXT ===
    const optimizedContext = contextBuilder.buildAgentSpecificContext(
      demand.id,
      agentName,
      demand
    );

    console.log(`[TOKEN OPT] Agent ${agentName}: using optimized context (${Math.ceil(optimizedContext.length / 4)} tokens vs ${Math.ceil(internalContext.length / 4)} original)`);
    // === END TOKEN OPTIMIZATION ===

    // Prepend the optimized context to the agent's system prompt
    const systemPrompt = `${optimizedContext}

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

      const response = await openAIService.generateChatCompletion(
        systemPrompt,
        userPrompt,
        {
          temperature: 0.7,
          maxTokens: maxTokens,
          model: model,
          taskType: 'analysis',
          operation: `agent:${agentName}`
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
    return getDemandTypeConfig(type).intensity;
  }

  private isImprovementParallelEnabled(): boolean {
    try {
      const flagsPath = path.join(process.cwd(), 'config', 'feature-flags.json');
      const flags = JSON.parse(fs.readFileSync(flagsPath, 'utf8'));
      return flags.enableImprovementParallelSubset === true;
    } catch {
      return false;
    }
  }

  private getDemandTypePrdGuidance(type: string): string {
    const config = getDemandTypeConfig(type);
    const requirements = config.typeRequirements.map(requirement => `- ${requirement}`).join('\n');

    return `Tipo de Demanda: ${config.label}
Template Esperado: ${config.prdTemplate}
Saída Esperada: ${config.outputType}
Esforço Máximo: ${config.maxEffortDays} dias
Requisitos Obrigatórios por Tipo:
${requirements}`;
  }

  private validatePilotQualityInvariants(
    demand: Demand,
    prdContent: string,
    templatePassed: boolean,
  ): {
    qaPassed: boolean;
    blockers: string[];
    invariants: Record<string, boolean>;
  } {
    const normalized = prdContent
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
    const demandTypeLabel = getDemandTypeConfig(demand.type).label
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();

    const invariants = {
      prd_reflects_extracted_fields:
        normalized.includes(demand.type) ||
        normalized.includes(demandTypeLabel) ||
        normalized.includes('tipo de demanda'),
      tags_do_not_contradict_area_type:
        !normalized.includes('bug') || demand.type === 'bug' || normalized.includes('nao fazer'),
      risk_complexity_coherent:
        normalized.includes('risco') &&
        (normalized.includes('escopo') || normalized.includes('complexidade') || normalized.includes('mitigacao')),
      template_validator_passed: templatePassed,
    };

    const blockers = Object.entries(invariants)
      .filter(([, passed]) => !passed)
      .map(([name]) => name);

    return {
      qaPassed: blockers.length === 0,
      blockers,
      invariants,
    };
  }

  // ===== PROMPTS DIFERENCIADOS POR TIPO DE REFINAMENTO =====

  /**
   * Prompt para PRD técnico - foco em arquitetura, componentes, dependências e trade-offs
   */
  private getTechnicalPRDPrompt(insightsSummary: string): string {
    return `Você é um Tech Lead/Arquiteto de Software experiente criando um documento técnico de requisitos.

--- ANTI-OVERENGINEERING CONSTRAINTS (OBRIGATÓRIO) ---
1. NÃO sugira tecnologias fora do stack atual (TypeScript, React, Node.js, Vite, SQLite)
2. NÃO proponha refatoração arquitetural ou troca de frameworks
3. TODAS as estimativas devem ser realistas (< 2 semanas para features, < 3 dias para bugs)
4. Foque em soluções SIMPLES e INCREMENTAIS
5. Priorize código existente sobre novas abstrações

--- MODO PRODUTO PESSOAL (OBRIGATÓRIO) ---
1. Escreva para um builder solo que precisa executar, não para um comitê enterprise
2. Se a demanda for simples, mantenha o documento curto
3. Separe claramente: fazer agora, fazer depois e não fazer
4. Inclua lacunas e perguntas abertas apenas quando bloquearem a execução
5. Evite linguagem de startup, ARR, TAM, stakeholders corporativos, SSO e compliance pesado

${insightsSummary ? `--- INSIGHTS DA SQUAD ---\n${insightsSummary}\n\n` : ''}
Crie um PRD TÉCNICO em Markdown seguindo EXATAMENTE este formato:

# PRD Técnico - [Título]

## 1. Plano Executivo
[3-5 linhas: problema técnico, resultado esperado e menor entrega útil]

## 2. Prontidão Da Demanda
- **Status:** [Pronta / Precisa refinar / Bloqueada]
- **Por que:** [Justificativa objetiva]
- **Perguntas abertas:** [Somente perguntas que bloqueiam execução]

## 3. Escopo
### 3.1 Fazer Agora
- [Entrega incremental 1]
- [Entrega incremental 2]

### 3.2 Fazer Depois
- [Melhoria ou expansão futura]

### 3.3 Não Fazer
- [Item explicitamente fora de escopo]

## 4. Implementação Proposta
### 4.1 Componentes Afetados
- [Lista de arquivos/módulos que serão modificados]
- [Novos componentes se necessário - mínimo possível]

### 4.2 Fluxo
[Descrição textual do fluxo de dados - entrada → processamento → saída]

### 4.3 Integrações
- [APIs internas/externas necessárias]
- [Dependências entre módulos]

## 5. Especificações Técnicas
### 5.1 Modelo de Dados
[Alterações em schemas, tabelas, tipos TypeScript]

### 5.2 Endpoints/Interfaces
[Novas rotas, parâmetros, retornos esperados]

### 5.3 Regras de Validação
[Validações de entrada, regras de negócio técnicas]

## 6. Dependências e Requisitos
### 6.1 Dependências de Código
- [Bibliotecas existentes a utilizar]
- [Novas dependências - APENAS se estritamente necessário]

### 6.2 Pré-requisitos
- [O que precisa estar pronto antes de começar]

## 7. Trade-offs e Decisões
| Decisão | Alternativa Descartada | Justificativa |
|---------|------------------------|---------------|
| [Escolha feita] | [Opção não escolhida] | [Por que essa escolha] |

## 8. Riscos Técnicos
- **Risco:** [Descrição] | **Mitigação:** [Como evitar/resolver]

## 9. Critérios de Aceite Técnicos
- [ ] [Critério técnico verificável 1]
- [ ] [Critério técnico verificável 2]
- [ ] [Testes passando]
- [ ] [Performance dentro do esperado]

## 10. Estimativa de Esforço
| Fase | Esforço |
|------|---------|
| Desenvolvimento | [X dias] |
| Testes | [X dias] |
| Code Review | [X dias] |
| **Total** | **[X dias]** |

IMPORTANTE:
- Este é um documento TÉCNICO para engenheiros
- Inclua detalhes de implementação específicos
- Mantenha seções de arquitetura, componentes e trade-offs
- Estimativas devem ser conservadoras e realistas
- Não aumente o escopo apenas para preencher seções`;
  }

  /**
   * Prompt para PRD de negócios - foco em objetivo, valor, impacto e prioridade
   */
  private getBusinessPRDPrompt(insightsSummary: string): string {
    return `Você é um Product Manager experiente criando um documento de requisitos de negócio.

--- ANTI-OVERENGINEERING CONSTRAINTS (OBRIGATÓRIO) ---
1. NÃO entre em detalhes técnicos de implementação
2. Foque no VALOR para o usuário e para o negócio
3. Mantenha linguagem acessível para stakeholders não-técnicos
4. Priorize clareza sobre completude

--- MODO PRODUTO PESSOAL (OBRIGATÓRIO) ---
1. Escreva para um builder solo decidindo o que fazer agora
2. Troque linguagem corporativa por decisão prática
3. Separe claramente: fazer agora, fazer depois e não fazer
4. Não use TAM, ARR, MRR, enterprise sales, SSO ou compliance pesado
5. O documento deve ajudar a executar, não impressionar stakeholders

${insightsSummary ? `--- INSIGHTS DA SQUAD ---\n${insightsSummary}\n\n` : ''}
Crie um PRD de NEGÓCIOS em Markdown seguindo EXATAMENTE este formato:

# PRD - [Título]

## 1. Decisão De Produto
[3-5 linhas: o que fazer, por que agora e qual menor resultado útil]

## 2. Prontidão Da Demanda
- **Status:** [Pronta / Precisa refinar / Bloqueada]
- **Por que:** [Justificativa objetiva]
- **Perguntas abertas:** [Somente perguntas que bloqueiam execução]

## 3. Problema e Oportunidade
### 3.1 Contexto do Problema
[Qual dor do usuário/negócio estamos resolvendo?]

### 3.2 Impacto Atual
[O que fica pior se não resolver agora?]

### 3.3 Oportunidade
[Qual ganho prático ao resolver?]

## 4. Objetivo e Benefícios
### 4.1 Objetivo Principal
[Uma frase clara: "Permitir que [usuário] consiga [ação] para [benefício]"]

### 4.2 Benefícios Esperados
- **Para o Usuário:** [Como melhora a vida do usuário]
- **Para o Produto Pessoal:** [Como reduz tempo, melhora clareza ou acelera execução]
- **Para a Operação:** [Redução de custo/suporte/tempo]

## 5. Escopo da Entrega
### 5.1 Fazer Agora
- [Funcionalidade/entrega 1]
- [Funcionalidade/entrega 2]

### 5.2 Fazer Depois
- [Melhoria futura 1]

### 5.3 Não Fazer
- [Item explicitamente excluído 1]
- [Item explicitamente excluído 2]

## 6. Experiência Esperada
### 6.1 Jornada do Usuário
[Descreva passo a passo como o usuário vai interagir com a funcionalidade]

### 6.2 Critérios de Sucesso do Usuário
- [O usuário consegue fazer X em Y cliques]
- [O tempo para completar a tarefa é menor que Z]

## 7. Regras de Negócio e Premissas
### 7.1 Regras de Negócio
- [Regra 1: "Se X, então Y"]
- [Regra 2: "Nunca permitir Z quando W"]

### 7.2 Premissas
- [Premissa 1: Assumimos que...]
- [Premissa 2: Dependemos de...]

## 8. Métricas de Sucesso
| Métrica | Baseline Atual | Meta | Como Medir |
|---------|----------------|------|------------|
| Tempo economizado | [Valor atual] | [Valor esperado] | [Ferramenta/método] |
| Reaproveitamento do plano | [Valor atual] | [Valor esperado] | [Ferramenta/método] |

## 9. Prioridade e Justificativa
- **Prioridade:** [Alta/Média/Baixa]
- **Justificativa:** [Por que essa prioridade? Impacto vs Esforço]
- **Custo de Atraso:** [O que perdemos se não fizermos agora?]

## 10. Riscos e Mitigações
| Risco | Probabilidade | Impacto | Mitigação |
|-------|---------------|---------|-----------|
| [Risco 1] | Alta/Média/Baixa | Alto/Médio/Baixo | [Como evitar] |

IMPORTANTE:
- Este é um documento de produto pessoal para decisão e execução
- Evite jargão técnico quando não ajudar a decidir
- Mantenha seções de objetivo, valor, impacto e prioridade
- O documento deve ser compreensível em uma leitura`;
  }

  // ===== NOVOS MÉTODOS: Geração de PRD e Tasks com PM (FORA DO LOOP) =====
  // Agora com validação anti-overengineering integrada
  // ATUALIZADO: Suporta diferentes templates baseados no refinementType

  private async generatePRDWithPM(
    demand: Demand,
    refinementMessages: ChatMessage[],
    model?: string,
  ): Promise<string> {
    // === TOKEN OPTIMIZATION: USE STRUCTURED SUMMARY ===
    const insights = refinementMessages
      .filter(msg => msg.type === 'completed')
      .map(msg => ({
        agentName: msg.agent,
        insight: msg.message,
        timestamp: msg.timestamp
      }));

    const summary = await summaryBuilder.buildStructuredSummary(insights, false);
    const refinementSummary = summaryBuilder.formatAsMarkdown(summary);

    console.log(`[TOKEN OPT] PRD summary: ${summary.metadata.compressionRatio.toFixed(1)}x compression (${summary.metadata.originalTokens} -> ${summary.metadata.compressedTokens} tokens)`);
    // === END TOKEN OPTIMIZATION ===

    // Get insights from evolved context for richer PRD
    const insightsSummary = contextBuilder.getInsightsSummary(demand.id);

    // Determinar tipo de refinamento - usa o valor da demanda
    const refinementType = demand.refinementType as RefinementType;
    const isTechnical = refinementType === 'technical' && demand.type !== 'melhoria';
    const demandTypeGuidance = this.getDemandTypePrdGuidance(demand.type);

    // Sistema de prompts diferenciados por tipo
    const systemPrompt = isTechnical
      ? this.getTechnicalPRDPrompt(insightsSummary)
      : this.getBusinessPRDPrompt(insightsSummary);

    const typeLabel = isTechnical ? 'TÉCNICO' : 'NEGÓCIOS';
    const userPrompt = `Demanda Original: ${demand.title}
Descrição: ${demand.description}
Tipo: ${demand.type}
Prioridade: ${demand.priority}
Tipo de Refinamento: ${typeLabel}

=== CONTRATO DO TIPO DE DEMANDA ===
${demandTypeGuidance}

=== REFINAMENTO DA SQUAD ===
${refinementSummary}

=== SUA TAREFA ===
Com base em TODAS as análises acima, crie um documento ${isTechnical ? 'técnico' : 'de negócio'} enxuto em Markdown seguindo o formato especificado.
${isTechnical
  ? 'O documento deve ser um artefato técnico que engenheiros e tech leads consigam usar para implementação.'
  : 'O documento deve ser um artefato de decisão que um builder solo consiga ler uma vez e executar.'}

IMPORTANTE:
- Use as informações do refinamento dos agentes para preencher os campos do PRD
- Respeite o contrato do tipo de demanda e inclua as seções/requisitos obrigatórios quando aplicável
${isTechnical
  ? '- Mantenha detalhes técnicos como arquitetura, componentes, dependências e trade-offs'
  : '- Traduza sugestões técnicas dos agentes para impacto de negócio, experiência do usuário, risco, escopo ou métrica'}
- Certifique-se de que o conteúdo do PRD reflita fielmente as discussões realizadas
- Não escreva em formato RF/RNF
- Não use linguagem de startup enterprise; mantenha foco em produto pessoal e execução`;

    try {
      const response = await openAIService.generateChatCompletion(
        systemPrompt,
        userPrompt,
        {
          temperature: 0.5,
          maxTokens: 4000,
          model,
          taskType: 'document',
          operation: 'document:prd'
        }
      );

      return response || `# PRD - ${demand.title}\n\n## Resumo Executivo\n\nPRD gerado com base no refinamento da squad.`;
    } catch (error) {
      console.error(`Error generating PRD with PM:`, error);
      return `# PRD - ${demand.title}\n\n## Erro\nErro ao gerar PRD. Refinamento capturado mas documento não foi criado.`;
    }
  }

  private async generateTasksWithPM(
    demand: Demand,
    prdContent: string,
    model?: string,
  ): Promise<string> {
    // Get insights from evolved context
    const insightsSummary = contextBuilder.getInsightsSummary(demand.id);

    const systemPrompt = `Você é um Product Manager experiente criando um checklist de execução para um produto pessoal.

--- ANTI-OVERENGINEERING CONSTRAINTS (OBRIGATÓRIO) ---
1. NÃO sugira tecnologias fora do stack atual (TypeScript, React, Node.js, Vite, SQLite)
2. NÃO proponha refatoração arquitetural ou troca de frameworks
3. TODAS as estimativas devem ser realistas (< 2 semanas para features, < 3 dias para bugs)
4. As tasks devem ser INCREMENTAIS e PRÁTICAS
5. Foque no que pode ser feito AGORA com a stack atual
6. Não force Backend, Frontend, Database e DevOps se a demanda não precisar

${insightsSummary ? `--- INSIGHTS DA SQUAD ---\n${insightsSummary}\n\n` : ''}
Crie um documento de tasks baseado no PRD seguindo EXATAMENTE este formato:

# Checklist De Execução - [Título da Demanda]

**Versão:** 1.0.0
**Prioridade:** [Alta/Média/Baixa]
**Responsável:** Produto pessoal
**Status:** Não Iniciado

## Agora

- **T1:** [Descrição concisa da tarefa 1]
  Critérios de aceite: [Critérios específicos de aceite]
  **Dependências:** [Tarefas ou recursos necessários]
  **Vinculado ao PRD:** [Seção relevante]

- **T2:** [Descrição concisa da tarefa 2]
  Critérios de aceite: [Critérios específicos de aceite]
  **Dependências:** T1
  **Vinculado ao PRD:** [Seção relevante]

- **T3:** [Descrição concisa da tarefa 3]
  Critérios de aceite: [Critérios específicos de aceite]
  **Dependências:** Nenhuma
  **Vinculado ao PRD:** [Seção relevante]

## Depois
- [Melhoria futura que não deve bloquear a entrega atual]

## Não Fazer
- [Item fora de escopo para evitar overengineering]

## Métricas de Sucesso
- [Tempo economizado ou fricção removida]
- [Como saber que o plano foi reaproveitado na execução]
- [Indicador simples de qualidade]

## Notas de Implementação
[Observações técnicas importantes, boas práticas, ou considerações de arquitetura]

IMPORTANTE:
- Siga EXATAMENTE este formato
- Gere entre 3 e 7 tasks; use menos tasks quando a demanda for simples
- Cada task deve ter ID sequencial (T1, T2, T3, etc.)
- Vincule cada task a uma seção, entrega ou métrica do PRD
- Cubra somente as áreas realmente necessárias
- Seja específico e técnico nas descrições

Gere o documento em português brasileiro.`;

    const userPrompt = `PRD:
${prdContent}

=== SUA TAREFA ===
Com base no PRD acima, crie um checklist de execução pessoal.
As tasks devem cobrir apenas os aspectos necessários para implementar a menor entrega útil.

IMPORTANTE:
- As tasks devem refletir diretamente o escopo, a experiência esperada, as regras de negócio e as métricas do PRD
- Use informações técnicas e insights específicos mencionados durante o refinamento da squad
- Crie tarefas que estejam claramente alinhadas com as sugestões dos agentes do refinamento
- Separe com rigor o que fazer agora, o que fazer depois e o que não fazer`;

    try {
      const response = await openAIService.generateChatCompletion(
        systemPrompt,
        userPrompt,
        {
          temperature: 0.5,
          maxTokens: 2000,
          model,
          taskType: 'document',
          operation: 'document:tasks'
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
