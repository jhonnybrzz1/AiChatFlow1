import { Demand, ChatMessage } from '@shared/schema';
import { openAIService } from './openai-ai';
import { storage } from '../storage';
import { contextBuilder } from './context-builder';
import {
  IMPROVEMENT_EXECUTION_CONFIG_VERSION,
  IMPROVEMENT_PARALLEL_AGENTS,
  improvementExecutionService
} from './improvement-execution';

export interface AgentMessage {
  agent: string;
  message: string;
  timestamp: string;
  metadata?: Record<string, any>;
}

export interface AgentPromptContextAudit {
  demandId: number;
  agentName: string;
  round: number;
  previousAgentCount: number;
  previousOutputPresent: boolean;
  previousOutputLength: number;
  conversationContextLength: number;
  evolvedContextLength: number;
  systemPromptLength: number;
  userPromptLength: number;
  hasConversationContextMarker: boolean;
  hasAccumulatedInsightsMarker: boolean;
  hasAntiRepeatInstruction: boolean;
  hasRoleInstruction: boolean;
}

export interface AgentInteractionResult {
  finalOutput: string;
  conversationHistory: AgentMessage[];
  agentContributions: Record<string, string>;
  completedEarly: boolean; // Indicates if interaction was completed early based on sufficiency of information
  finalCompletenessPercentage: number; // The final completeness percentage at the end of interaction
}

export interface AgentInteractionOptions {
  executionId?: string;
  enableParallelSubset?: boolean;
  maxConcurrency?: number;
}

export class AgentInteractionService {
  /**
   * Performs multi-agent interaction for a specific demand
   * Agents will collaborate, debate, and refine the demand together
   * @param demand - The demand to be refined
   * @param agentConfigs - Configuration for all participating agents
   * @returns The final output and conversation history
   */
  async conductMultiAgentInteraction(
    demand: Demand,
    agentConfigs: Record<string, { system_prompt: string, description: string, model?: string }>,
    internalContext: string, // Initial context (will be evolved)
    onProgress?: (message: ChatMessage) => void,
    options: AgentInteractionOptions = {}
  ): Promise<AgentInteractionResult> {
    // Get all agent names
    const agentNames = Object.keys(agentConfigs);

    if (agentNames.length === 0) {
      throw new Error('No agents available for interaction');
    }

    // Initialize conversation history
    const conversationHistory: AgentMessage[] = [];
    const agentContributions: Record<string, string> = {};

    // Create initial context for the conversation
    const initialContext = `DEMANDA ORIGINAL:
Título: ${demand.title}
Descrição: ${demand.description}
Tipo: ${demand.type}
Prioridade: ${demand.priority}

Por favor, colaborem para refinar esta demanda. Cada agente deve contribuir com sua expertise.`;

    // Add initial context to conversation
    conversationHistory.push({
      agent: 'system',
      message: initialContext,
      timestamp: new Date().toISOString(),
      metadata: { phase: 'initial' }
    });

    // Define interaction rounds - each agent gets multiple rounds to contribute
    const interactionRounds = 2; // Maximum number of rounds each agent participates

    let completedEarly = false;

    for (let round = 0; round < interactionRounds; round++) {
      const parallelAgents = options.enableParallelSubset
        ? agentNames.filter(agentName => IMPROVEMENT_PARALLEL_AGENTS.includes(agentName as any))
        : [];
      const sequentialAgents = agentNames.filter(agentName => !parallelAgents.includes(agentName));

      for (const agentName of sequentialAgents) {
        await this.executeAgentTurn({
          demand,
          agentName,
          agentConfig: agentConfigs[agentName],
          agentNames,
          agentConfigs,
          conversationHistory,
          agentContributions,
          round,
          interactionRounds,
          onProgress,
          options,
        });
      }

      if (parallelAgents.length > 0) {
        await this.runWithConcurrency(parallelAgents, options.maxConcurrency || 3, async (agentName) => {
          await this.executeAgentTurn({
            demand,
            agentName,
            agentConfig: agentConfigs[agentName],
            agentNames,
            agentConfigs,
            conversationHistory,
            agentContributions,
            round,
            interactionRounds,
            onProgress,
            options,
          });
        });
      }

      // After each complete round, check if we have sufficient information to complete early
      if (round > 0) { // Only check after the first round
        const shouldCompleteEarly = await this.shouldCompleteEarly(demand, conversationHistory, agentConfigs);

        if (shouldCompleteEarly) {
          console.log(`Completing interaction early after round ${round + 1} based on sufficiency of information`);
          completedEarly = true;
          break; // Exit the round loop early
        }
      }
    }

    // Final synthesis phase - have the most appropriate agent create a summary
    const synthesisResult = await this.synthesizeResults(
      demand,
      conversationHistory,
      agentConfigs
    );

    // Calculate final completeness percentage
    const finalCompletenessPercentage = await this.evaluateCompleteness(demand, conversationHistory, agentConfigs);

    return {
      finalOutput: synthesisResult,
      conversationHistory,
      agentContributions,
      completedEarly,
      finalCompletenessPercentage
    };
  }

  private async executeAgentTurn(params: {
    demand: Demand;
    agentName: string;
    agentConfig?: { system_prompt: string, description: string, model?: string };
    agentNames: string[];
    agentConfigs: Record<string, { system_prompt: string, description: string, model?: string }>;
    conversationHistory: AgentMessage[];
    agentContributions: Record<string, string>;
    round: number;
    interactionRounds: number;
    onProgress?: (message: ChatMessage) => void;
    options: AgentInteractionOptions;
  }): Promise<void> {
    const {
      demand,
      agentName,
      agentConfig,
      agentNames,
      agentConfigs,
      conversationHistory,
      agentContributions,
      round,
      interactionRounds,
      onProgress,
      options,
    } = params;

    if (!agentConfig) return;

    const startTime = new Date();

    const evolvedContext = contextBuilder.getEvolvedContext(demand.id);

    const conversationContext = this.buildConversationContext(conversationHistory);

    const systemPrompt = `${evolvedContext}\n\n${agentConfig.system_prompt}

CONTEXTO DA CONVERSA ATÉ AGORA:
${conversationContext}

Como ${agentName}, contribua para o refinamento da demanda acima.
Seu papel é: ${agentConfig.description}

IMPORTANTE:
- Use os insights dos agentes anteriores para enriquecer sua análise
- NÃO repita o que já foi dito - adicione NOVO valor
- Seja específico e prático nas recomendações
- Respeite as REALITY CONSTRAINTS se aplicáveis

Trabalhe em colaboração com outros agentes para criar a melhor possível compreensão e refinamento da demanda.`;

    const userPrompt = `Agora é sua vez de contribuir para o refinamento da demanda.
Considere as contribuições anteriores dos outros agentes e adicione seu valor específico com base em sua especialidade.
NÃO repita análises já feitas - traga novos insights da sua área.
Demanda: ${demand.description}`;

    const previousAgentMessages = conversationHistory.filter(msg => msg.agent !== 'system');
    const previousOutputLength = previousAgentMessages.reduce(
      (total, msg) => total + msg.message.length,
      0
    );
    const promptContextAudit: AgentPromptContextAudit = {
      demandId: demand.id,
      agentName,
      round,
      previousAgentCount: previousAgentMessages.length,
      previousOutputPresent: previousAgentMessages.length > 0 && previousOutputLength > 0,
      previousOutputLength,
      conversationContextLength: conversationContext.length,
      evolvedContextLength: evolvedContext.length,
      systemPromptLength: systemPrompt.length,
      userPromptLength: userPrompt.length,
      hasConversationContextMarker: systemPrompt.includes('CONTEXTO DA CONVERSA ATÉ AGORA'),
      hasAccumulatedInsightsMarker: systemPrompt.includes('INSIGHTS ACUMULADOS DOS AGENTES'),
      hasAntiRepeatInstruction: systemPrompt.includes('NÃO repita'),
      hasRoleInstruction: systemPrompt.includes(`Como ${agentName}`) && systemPrompt.includes('Seu papel é:'),
    };

    try {
      if (onProgress) {
        onProgress({
          id: `${demand.id}-round-${round}-${agentName}`,
          agent: agentName,
          message: `${agentName} está contribuindo para a discussão...`,
          timestamp: new Date().toISOString(),
          type: 'processing',
          category: 'system',
          progress: 10 + Math.min(70, Math.round((round * agentNames.length + agentNames.indexOf(agentName) + 1) * 70 / (interactionRounds * agentNames.length))),
          metadata: {
            promptContext: promptContextAudit,
          },
        });
      }

      const response = await openAIService.generateChatCompletion(
        systemPrompt,
        userPrompt,
        {
          temperature: 0.8,
          maxTokens: 1500,
          model: agentConfig.model,
          taskType: 'analysis',
          operation: `agent_interaction:${agentName}`
        }
      );

      if (response) {
        const agentMessage: AgentMessage = {
          agent: agentName,
          message: response,
          timestamp: new Date().toISOString(),
          metadata: {
            round,
            phase: 'collaboration',
            originalDemand: demand.id,
            promptContext: promptContextAudit,
          }
        };

        conversationHistory.push(agentMessage);

        contextBuilder.addAgentInsight(demand.id, agentName, response);

        if (onProgress) {
          onProgress({
            id: `${demand.id}-round-${round}-${agentName}-completed`,
            agent: agentName,
            message: response,
            timestamp: new Date().toISOString(),
          type: 'completed',
          category: 'system',
          progress: 10 + Math.min(70, Math.round((round * agentNames.length + agentNames.indexOf(agentName) + 1) * 70 / (interactionRounds * agentNames.length))),
          metadata: {
            promptContext: promptContextAudit,
          },
        });
      }

        const currentDemand = await storage.getDemand(demand.id);
        const currentMessages = currentDemand?.chatMessages || [];

        const currentCompleteness = await this.evaluateCompleteness(
          demand,
          conversationHistory,
          agentConfigs
        );

        const newMessage: ChatMessage = {
          id: `${demand.id}-round-${round}-${agentName}-completed`,
          agent: agentName,
          message: response,
          timestamp: new Date().toISOString(),
          type: 'completed',
          category: 'system',
          progress: currentCompleteness,
          metadata: {
            promptContext: promptContextAudit,
          },
        };
        const updatedMessages = [...currentMessages, newMessage];
        await storage.updateDemandChat(demand.id, updatedMessages);

        await storage.updateDemand(demand.id, {
          ...currentDemand,
          progress: Math.max(10, Math.min(85, currentCompleteness))
        });

        if (!agentContributions[agentName]) {
          agentContributions[agentName] = '';
        }
        agentContributions[agentName] += `\n\n[${new Date().toLocaleString('pt-BR')}] ${response}`;
      }
    } catch (error) {
      console.error(`Error processing agent ${agentName} in round ${round}:`, error);

      if (onProgress) {
        onProgress({
          id: `${demand.id}-round-${round}-${agentName}-error`,
          agent: agentName,
          message: `${agentName} encontrou um erro durante a colaboração, mas o processo continua.`,
          timestamp: new Date().toISOString(),
          type: 'error',
          category: 'error',
          progress: 10 + Math.min(70, Math.round((round * agentNames.length + agentNames.indexOf(agentName) + 1) * 70 / (interactionRounds * agentNames.length)))
        });
      }

      const errorMessage: AgentMessage = {
        agent: agentName,
        message: `${agentName} encontrou um erro durante a colaboração, mas o processo continua.`,
        timestamp: new Date().toISOString(),
        metadata: {
          round,
          phase: 'error',
          error: error instanceof Error ? error.message : 'Unknown error',
          promptContext: promptContextAudit,
        }
      };
      conversationHistory.push(errorMessage);
    }

    const endTime = new Date();
    if (options.executionId) {
      improvementExecutionService.recordEvent({
        executionId: options.executionId,
        demandId: demand.id,
        eventType: 'agent_execution',
        configVersion: IMPROVEMENT_EXECUTION_CONFIG_VERSION,
        timestamp: endTime.toISOString(),
        agentName,
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        durationMs: endTime.getTime() - startTime.getTime(),
        metadata: {
          round,
          parallelSubset: Boolean(options.enableParallelSubset && IMPROVEMENT_PARALLEL_AGENTS.includes(agentName as any)),
        },
      });
    }
  }

  private async runWithConcurrency<T>(
    items: T[],
    concurrency: number,
    worker: (item: T) => Promise<void>,
  ): Promise<void> {
    for (let index = 0; index < items.length; index += concurrency) {
      await Promise.all(items.slice(index, index + concurrency).map(item => worker(item)));
    }
  }

  /**
   * Executes a single agent for a specific demand
   */
  async executeAgent(agentName: string, demand: Demand): Promise<string> {
    const evolvedContext = contextBuilder.getEvolvedContext(demand.id);
    const systemPrompt = `${evolvedContext}\n\nVocê é um ${agentName} experiente em uma squad de desenvolvimento. Responda SEMPRE em português brasileiro. Seja objetivo e prático nas suas respostas.`;
    const userPrompt = `Analise a demanda: ${demand.description}`;

    try {
      const response = await openAIService.generateChatCompletion(
        systemPrompt,
        userPrompt,
        {
          temperature: 0.7,
          maxTokens: 1500,
          taskType: 'analysis',
          operation: `agent_execution:${agentName}`
        }
      );

      return response || `${agentName} processou a demanda com sucesso.`;
    } catch (error) {
      console.error(`Error executing agent ${agentName}:`, error);
      throw error;
    }
  }

  /**
   * Validates an agent's output for a specific demand
   */
  async validateAgentOutput(agentName: string, demand: Demand): Promise<any> {
    // Basic validation implementation
    const evolvedContext = contextBuilder.getEvolvedContext(demand.id);
    const insights = contextBuilder.getAgentInsights(demand.id, agentName);
    const lastInsight = insights[insights.length - 1];

    if (!lastInsight) {
      return { isValid: false, score: 0, feedback: "No output found for agent" };
    }

    // Use AI to validate if the output is aligned with the demand and reality constraints
    const systemPrompt = `Você é um QA Arquiteto. Avalie a saída do agente ${agentName} para a demanda abaixo.
Demanda: ${demand.description}
Saída do Agente: ${lastInsight}

Avalie se a resposta é técnica, viável e segue boas práticas.
Responda em formato JSON: { "isValid": boolean, "score": number (0-100), "feedback": "string" }`;

    try {
      const response = await openAIService.generateChatCompletion(
        systemPrompt,
        "Valide a saída do agente.",
        {
          temperature: 0.2,
          maxTokens: 500,
          taskType: 'classification',
          operation: `agent_validation:${agentName}`
        }
      );

      return JSON.parse(response || '{"isValid": true, "score": 80, "feedback": "Validation failed, assuming valid."}');
    } catch (error) {
      console.error(`Error validating agent ${agentName}:`, error);
      return { isValid: true, score: 70, feedback: "Validation error occurred" };
    }
  }

  /**
   * Builds context from previous conversation for an agent
   */
  private buildConversationContext(conversationHistory: AgentMessage[]): string {
    return conversationHistory
      .slice(-20) // Get last 20 messages to avoid context overflow
      .map(msg => `[${msg.agent} @ ${msg.timestamp}]: ${msg.message}`)
      .join('\n\n');
  }

  /**
   * Synthesizes the results from all agent interactions
   */
  /**
   * Determines if the interaction should complete early based on sufficiency of information
   */
  /**
   * Evaluates the completeness of information based on sufficiency for documentation
   * Returns a percentage of questions answered (0-100)
   */
  private async evaluateCompleteness(
    demand: Demand,
    conversationHistory: AgentMessage[],
    agentConfigs: Record<string, { system_prompt: string, description: string, model?: string }>
  ): Promise<number> {
    // Create context of the conversation so far
    const conversationContext = this.buildConversationContext(conversationHistory);

    // Ask for an evaluation of completeness based on documentation requirements
    const systemPrompt = `Você é um Product Manager experiente responsável por avaliar o grau de completude do refinamento de uma demanda.

Critérios de avaliação (cada critério vale 12.5 pontos, total 100):
1. Objetivo da demanda claramente definido (0-12.5)
2. Escopo bem delimitado (o que está incluso e o que não está) (0-12.5)
3. Requisitos funcionais identificados (0-12.5)
4. Requisitos não-funcionais considerados (0-12.5)
5. Critérios de aceitação definidos (0-12.5)
6. Riscos identificados (0-12.5)
7. Considerações técnicas abordadas (0-12.5)
8. Impacto no negócio e usuários definido (0-12.5)

CONTEXTO DO REFINAMENTO ATÉ AGORA:
${conversationContext}

DEMANDA ORIGINAL:
Título: ${demand.title}
Descrição: ${demand.description}
Tipo: ${demand.type}
Prioridade: ${demand.priority}

Avalie o grau de completude do refinamento em relação aos critérios acima.
Forneça um número de 0 a 100 representando o percentual de critérios atendidos.
Responda APENAS com o número, sem explicações adicionais.`;

    const userPrompt = `Qual o percentual de completude do refinamento com base nos critérios definidos? Responda apenas com um número de 0 a 100.`;

    try {
      const response = await openAIService.generateChatCompletion(
        systemPrompt,
        userPrompt,
        {
          temperature: 0.2, // Lower temperature for more consistent evaluation
          maxTokens: 20,
          taskType: 'classification',
          operation: 'agent_interaction:completeness'
        }
      );

      // Extract the percentage from the response
      if (response) {
        const match = response.match(/\d+/);
        if (match) {
          const percentage = parseInt(match[0], 10);
          return Math.min(100, Math.max(0, percentage)); // Clamp between 0 and 100
        }
      }

      // If we can't determine, default to 0
      return 0;
    } catch (error) {
      console.error('Error during completeness evaluation:', error);
      // If there's an error, return 0
      return 0;
    }
  }

  private async shouldCompleteEarly(
    demand: Demand,
    conversationHistory: AgentMessage[],
    agentConfigs: Record<string, { system_prompt: string, description: string, model?: string }>
  ): Promise<boolean> {
    const completenessPercentage = await this.evaluateCompleteness(demand, conversationHistory, agentConfigs);

    // Set threshold for early completion (e.g., 85% completeness)
    const completionThreshold = 85; // Can be adjusted based on requirements

    console.log(`Completeness evaluation: ${completenessPercentage}% (threshold: ${completionThreshold}%)`);

    return completenessPercentage >= completionThreshold;
  }

  private async synthesizeResults(
    demand: Demand,
    conversationHistory: AgentMessage[],
    agentConfigs: Record<string, { system_prompt: string, description: string, model?: string }>
  ): Promise<string> {
    // Convert agent conversation history to a format suitable for synthesis
    const formattedConversation = conversationHistory
      .filter(msg => msg.agent !== 'system') // Exclude system messages
      .map(msg => `**${msg.agent.toUpperCase()}**: ${msg.message}`)
      .join('\n\n');

    const systemPrompt = `Você é um Product Manager experiente especializado em síntese de feedback de equipe multidisciplinar.
Sua tarefa é consolidar todas as contribuições dos agentes especializados em um único documento de refinamento coeso e abrangente.

CONTRIBUIÇÕES DOS AGENTES:
${formattedConversation}

DEMANDA ORIGINAL:
Título: ${demand.title}
Descrição: ${demand.description}
Tipo: ${demand.type}

Por favor, crie um refinamento consolidado que incorpore as melhores ideias e insights de todos os agentes, 
mantendo uma estrutura clara e coesa que seja útil para a equipe de desenvolvimento.`;

    const userPrompt = `Consolide todas as contribuições acima em um único refinamento da demanda que seja útil para a squad. 
O documento deve ser bem estruturado, claro e prático, incorporando os insights de todas as especialidades.`;

    try {
      const synthesis = await openAIService.generateChatCompletion(
        systemPrompt,
        userPrompt,
        {
          temperature: 0.6,
          maxTokens: 3000,
          taskType: 'document',
          operation: 'agent_interaction:synthesis'
        }
      );

      return synthesis || formattedConversation; // Fallback to raw conversation if synthesis fails
    } catch (error) {
      console.error('Error during synthesis:', error);
      // Fallback: return the formatted conversation
      return formattedConversation;
    }
  }
}

export const agentInteractionService = new AgentInteractionService();
