import { Demand, ChatMessage } from '@shared/schema';
import { openAIService } from './openai-ai';
import { storage } from '../storage';
import { contextBuilder } from './context-builder';

export interface AgentMessage {
  agent: string;
  message: string;
  timestamp: string;
  metadata?: Record<string, any>;
}

export interface AgentInteractionResult {
  finalOutput: string;
  conversationHistory: AgentMessage[];
  agentContributions: Record<string, string>;
  completedEarly: boolean; // Indicates if interaction was completed early based on sufficiency of information
  finalCompletenessPercentage: number; // The final completeness percentage at the end of interaction
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
    onProgress?: (message: ChatMessage) => void
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
      for (const agentName of agentNames) {
        const agentConfig = agentConfigs[agentName];
        if (!agentConfig) continue;

        // CONTEXT EVOLUTION: Get the evolved context with all previous agent insights
        const evolvedContext = contextBuilder.getEvolvedContext(demand.id);

        // Create prompt with EVOLVED context (not static)
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

        try {
          // Send intermediate progress update
          if (onProgress) {
            onProgress({
              id: `${demand.id}-round-${round}-${agentName}`,
              agent: agentName,
              message: `${agentName} está contribuindo para a discussão...`,
              timestamp: new Date().toISOString(),
              type: 'processing',
              category: 'system',
              progress: 10 + Math.min(70, Math.round((round * agentNames.length + agentNames.indexOf(agentName) + 1) * 70 / (interactionRounds * agentNames.length)))
            });
          }

          const response = await openAIService.generateChatCompletion(
            systemPrompt,
            userPrompt,
            {
              temperature: 0.8, // Higher temperature for more creative collaboration
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
                originalDemand: demand.id
              }
            };

            conversationHistory.push(agentMessage);

            // CONTEXT EVOLUTION: Add this agent's insight to the evolving context
            // This ensures the next agent sees this agent's contributions
            contextBuilder.addAgentInsight(demand.id, agentName, response);

            // Send completed message update
            if (onProgress) {
              onProgress({
                id: `${demand.id}-round-${round}-${agentName}-completed`,
                agent: agentName,
                message: response,
                timestamp: new Date().toISOString(),
                type: 'completed',
                category: 'system',
                progress: 10 + Math.min(70, Math.round((round * agentNames.length + agentNames.indexOf(agentName) + 1) * 70 / (interactionRounds * agentNames.length)))
              });
            }

            // Update the demand storage with the new message for real-time updates
            const currentDemand = await storage.getDemand(demand.id);
            const currentMessages = currentDemand?.chatMessages || [];

            // Calculate current completeness percentage based on conversation so far (before this message)
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
              progress: currentCompleteness // Use completeness percentage as progress indicator
            };
            const updatedMessages = [...currentMessages, newMessage];
            await storage.updateDemandChat(demand.id, updatedMessages);

            // Update the overall demand progress to reflect completeness percentage
            await storage.updateDemand(demand.id, {
              ...currentDemand,
              progress: Math.max(10, Math.min(85, currentCompleteness)) // Keep between 10-85 during interaction
            });

            // Store the contribution
            if (!agentContributions[agentName]) {
              agentContributions[agentName] = '';
            }
            agentContributions[agentName] += `\n\n[${new Date().toLocaleString('pt-BR')}] ${response}`;
          }
        } catch (error) {
          console.error(`Error processing agent ${agentName} in round ${round}:`, error);

          // Send error progress update
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

          // Add error message to conversation
          const errorMessage: AgentMessage = {
            agent: agentName,
            message: `${agentName} encontrou um erro durante a colaboração, mas o processo continua.`,
            timestamp: new Date().toISOString(),
            metadata: {
              round,
              phase: 'error',
              error: error instanceof Error ? error.message : 'Unknown error'
            }
          };
          conversationHistory.push(errorMessage);
        }
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
