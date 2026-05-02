import { Demand } from '@shared/schema';
import { storage } from '../storage';
import { demandClassifier, DemandClassification } from './demand-classifier';
import { agentInteractionService } from '../services/agent-interaction';

/**
 * Agent execution result
 */
export interface AgentExecutionResult {
  agentName: string;
  success: boolean;
  message: string;
  data?: any;
  timestamp: string;
}

/**
 * Cross-validation result
 */
export interface CrossValidationResult {
  validationPassed: boolean;
  validationNotes: string[];
  confidenceScore: number; // 0-100
}

/**
 * Orchestration plan
 */
export interface OrchestrationPlan {
  demandId: number;
  classification: DemandClassification;
  agentExecutionOrder: string[];
  crossValidationRequired: boolean;
  validationAgents: string[];
  estimatedCompletionTime: number; // in minutes
  notes: string;
}

/**
 * Agent Orchestrator - Manages the execution order of agents and cross-validation
 */
export class AgentOrchestrator {
  
  /**
   * Creates an orchestration plan for a demand
   * @param demandId - The ID of the demand
   * @returns Orchestration plan
   */
  async createOrchestrationPlan(demandId: number): Promise<OrchestrationPlan> {
    const demand = await storage.getDemand(demandId);
    if (!demand) {
      throw new Error(`Demand with ID ${demandId} not found`);
    }
    
    // Classify the demand
    const classification = await demandClassifier.classifyDemand(demand);
    
    // Determine agent execution order
    const agentExecutionOrder = this.determineAgentExecutionOrder(classification);
    
    // Determine if cross-validation is required
    const crossValidationRequired = this.isCrossValidationRequired(classification);
    
    // Determine validation agents
    const validationAgents = this.getValidationAgents(classification);
    
    // Estimate completion time
    const estimatedCompletionTime = this.estimateCompletionTime(classification, agentExecutionOrder.length);
    
    // Generate notes
    const notes = this.generateOrchestrationNotes(classification, agentExecutionOrder, crossValidationRequired);
    
    return {
      demandId,
      classification,
      agentExecutionOrder,
      crossValidationRequired,
      validationAgents,
      estimatedCompletionTime,
      notes
    };
  }
  
  /**
   * Determines the execution order of agents
   * @param classification - Demand classification
   * @returns Array of agent names in execution order
   */
  private determineAgentExecutionOrder(classification: DemandClassification): string[] {
    const agents = [...classification.recommendedAgents];
    
    // Always start with refinador if it's in the list
    if (agents.includes('refinador')) {
      agents.sort((a, b) => a === 'refinador' ? -1 : b === 'refinador' ? 1 : 0);
    }
    
    // For technical demands, tech_lead should come before qa
    if (classification.category === 'technical') {
      const techLeadIndex = agents.indexOf('tech_lead');
      const qaIndex = agents.indexOf('qa');
      
      if (techLeadIndex > qaIndex && techLeadIndex !== -1 && qaIndex !== -1) {
        agents[techLeadIndex] = 'qa';
        agents[qaIndex] = 'tech_lead';
      }
    }
    
    // For business demands, product_manager should come first
    if (classification.category === 'business' && agents.includes('product_manager')) {
      agents.sort((a, b) => a === 'product_manager' ? -1 : b === 'product_manager' ? 1 : 0);
    }
    
    // For high complexity, scrum_master should be near the end
    if (classification.criteria.complexity > 70 && agents.includes('scrum_master')) {
      const scrumMasterIndex = agents.indexOf('scrum_master');
      if (scrumMasterIndex !== -1 && scrumMasterIndex < agents.length - 1) {
        agents.splice(scrumMasterIndex, 1);
        agents.push('scrum_master');
      }
    }
    
    return agents;
  }
  
  /**
   * Determines if cross-validation is required
   * @param classification - Demand classification
   * @returns True if cross-validation is required
   */
  private isCrossValidationRequired(classification: DemandClassification): boolean {
    // Cross-validation is required for:
    // 1. High ambiguity
    // 2. High interpretation risk
    // 3. High complexity
    // 4. Critical priority demands
    
    const hasHighAmbiguity = classification.criteria.ambiguity > 60;
    const hasHighInterpretationRisk = classification.criteria.interpretationRisk > 60;
    const hasHighComplexity = classification.criteria.complexity > 70;
    const isCriticalPriority = classification.criteria.urgency > 80;
    
    return hasHighAmbiguity || hasHighInterpretationRisk || hasHighComplexity || isCriticalPriority;
  }
  
  /**
   * Gets validation agents for cross-validation
   * @param classification - Demand classification
   * @returns Array of validation agent names
   */
  private getValidationAgents(classification: DemandClassification): string[] {
    const validationAgents: string[] = [];
    
    // For technical demands, include qa and tech_lead
    if (classification.category === 'technical') {
      if (!validationAgents.includes('qa')) validationAgents.push('qa');
      if (!validationAgents.includes('tech_lead')) validationAgents.push('tech_lead');
    }
    
    // For business demands, include product_manager
    if (classification.category === 'business') {
      if (!validationAgents.includes('product_manager')) validationAgents.push('product_manager');
    }
    
    // For high ambiguity, include refinador
    if (classification.criteria.ambiguity > 60 && !validationAgents.includes('refinador')) {
      validationAgents.push('refinador');
    }
    
    // For high complexity, include scrum_master
    if (classification.criteria.complexity > 70 && !validationAgents.includes('scrum_master')) {
      validationAgents.push('scrum_master');
    }
    
    // Always include at least one validator
    if (validationAgents.length === 0) {
      validationAgents.push('qa');
    }
    
    return validationAgents;
  }
  
  /**
   * Estimates completion time
   * @param classification - Demand classification
   * @param agentCount - Number of agents in the execution order
   * @returns Estimated completion time in minutes
   */
  private estimateCompletionTime(classification: DemandClassification, agentCount: number): number {
    let baseTime = agentCount * 30; // 30 minutes per agent
    
    // Adjust based on complexity
    if (classification.criteria.complexity > 80) {
      baseTime *= 1.5;
    } else if (classification.criteria.complexity > 60) {
      baseTime *= 1.2;
    }
    
    // Adjust based on depth required
    if (classification.criteria.depthRequired > 80) {
      baseTime *= 1.3;
    }
    
    // Adjust based on ambiguity (more ambiguity = more time for clarification)
    if (classification.criteria.ambiguity > 70) {
      baseTime *= 1.4;
    }
    
    // Add time for cross-validation if required
    if (this.isCrossValidationRequired(classification)) {
      baseTime += 60; // Additional hour for validation
    }
    
    return Math.round(baseTime);
  }
  
  /**
   * Generates orchestration notes
   * @param classification - Demand classification
   * @param agentExecutionOrder - Agent execution order
   * @param crossValidationRequired - Whether cross-validation is required
   * @returns Orchestration notes
   */
  private generateOrchestrationNotes(
    classification: DemandClassification,
    agentExecutionOrder: string[],
    crossValidationRequired: boolean
  ): string {
    const notes: string[] = [];
    
    notes.push(`Orchestration plan created for ${classification.category} demand`);
    notes.push(`Execution order: ${agentExecutionOrder.join(' → ')}`);
    notes.push(`Estimated completion time: ${this.estimateCompletionTime(classification, agentExecutionOrder.length)} minutes`);
    
    if (crossValidationRequired) {
      notes.push(`✅ Cross-validation required for this demand`);
      notes.push(`Validation agents: ${this.getValidationAgents(classification).join(', ')}`);
    } else {
      notes.push(`❌ Cross-validation not required`);
    }
    
    if (classification.criteria.ambiguity > 60) {
      notes.push(`🔍 High ambiguity detected - clarification may be needed during execution`);
    }
    
    if (classification.criteria.complexity > 70) {
      notes.push(`🛠️ High complexity - consider breaking into smaller tasks`);
    }
    
    return notes.join('\n');
  }
  
  /**
   * Executes the orchestration plan
   * @param plan - The orchestration plan
   * @param onProgress - Callback for progress updates
   * @returns Array of agent execution results
   */
  async executeOrchestrationPlan(
    plan: OrchestrationPlan,
    onProgress: (progress: number, message: string) => void
  ): Promise<AgentExecutionResult[]> {
    const results: AgentExecutionResult[] = [];
    const totalAgents = plan.agentExecutionOrder.length;
    
    // Execute agents in order
    for (let i = 0; i < totalAgents; i++) {
      const agentName = plan.agentExecutionOrder[i];
      const progress = Math.round(((i + 1) / totalAgents) * 100);
      
      onProgress(progress, `Executing agent: ${agentName} (${i + 1}/${totalAgents})`);
      
      try {
        // Execute the agent
        const executionResult = await this.executeAgent(plan.demandId, agentName);
        results.push(executionResult);
        
        // Update demand status
        await storage.updateDemand(plan.demandId, {
          status: 'processing',
          progress: progress,
          currentAgent: agentName
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        results.push({
          agentName,
          success: false,
          message: `Agent execution failed: ${errorMessage}`,
          timestamp: new Date().toISOString()
        });
        
        // Update demand status to error
        await storage.updateDemand(plan.demandId, {
          status: 'error',
          errorMessage: `Agent ${agentName} failed: ${errorMessage}`
        });
        
        throw new Error(`Agent ${agentName} execution failed: ${errorMessage}`);
      }
    }
    
    // Perform cross-validation if required
    if (plan.crossValidationRequired) {
      onProgress(90, 'Performing cross-validation');
      
      const validationResult = await this.performCrossValidation(plan);
      
      if (!validationResult.validationPassed) {
        await storage.updateDemand(plan.demandId, {
          status: 'validation_failed',
          validationNotes: validationResult.validationNotes.join('\n')
        });
        
        throw new Error('Cross-validation failed: ' + validationResult.validationNotes.join(', '));
      }
      
      results.push({
        agentName: 'cross_validation',
        success: true,
        message: 'Cross-validation completed successfully',
        data: validationResult,
        timestamp: new Date().toISOString()
      });
    }
    
    // Update demand status to completed
    await storage.updateDemand(plan.demandId, {
      status: 'completed',
      progress: 100,
      completedAt: new Date()
    });
    
    onProgress(100, 'Orchestration completed successfully');
    
    return results;
  }
  
  /**
   * Executes a single agent
   * @param demandId - Demand ID
   * @param agentName - Agent name
   * @returns Agent execution result
   */
  private async executeAgent(demandId: number, agentName: string): Promise<AgentExecutionResult> {
    try {
      const demand = await storage.getDemand(demandId);
      if (!demand) {
        throw new Error(`Demand with ID ${demandId} not found`);
      }
      
      // Use the agent interaction service to execute the agent
      const result = await agentInteractionService.executeAgent(agentName, demand);
      
      return {
        agentName,
        success: true,
        message: `Agent ${agentName} executed successfully`,
        data: result,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return {
        agentName,
        success: false,
        message: `Agent ${agentName} execution failed: ${errorMessage}`,
        timestamp: new Date().toISOString()
      };
    }
  }
  
  /**
   * Performs cross-validation
   * @param plan - Orchestration plan
   * @returns Cross-validation result
   */
  private async performCrossValidation(plan: OrchestrationPlan): Promise<CrossValidationResult> {
    const validationNotes: string[] = [];
    let confidenceScore = 100;
    
    // Get the demand
    const demand = await storage.getDemand(plan.demandId);
    if (!demand) {
      throw new Error(`Demand with ID ${plan.demandId} not found`);
    }
    
    // Perform validation with each validation agent
    for (const agentName of plan.validationAgents) {
      try {
        const validationResult = await agentInteractionService.validateAgentOutput(agentName, demand);
        
        if (validationResult && validationResult.notes) {
          validationNotes.push(...validationResult.notes);
        }
        
        if (validationResult && validationResult.confidence) {
          confidenceScore = Math.min(confidenceScore, validationResult.confidence);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        validationNotes.push(`Validation by ${agentName} failed: ${errorMessage}`);
        confidenceScore -= 20;
      }
    }
    
    // Determine if validation passed
    const validationPassed = confidenceScore >= 70; // 70% confidence threshold
    
    if (!validationPassed) {
      validationNotes.push(`⚠️ Cross-validation confidence (${confidenceScore}%) below threshold (70%)`);
    } else {
      validationNotes.push(`✅ Cross-validation passed with confidence: ${confidenceScore}%`);
    }
    
    return {
      validationPassed,
      validationNotes,
      confidenceScore
    };
  }
  
  /**
   * Updates demand with orchestration information
   * @param demandId - Demand ID
   * @param plan - Orchestration plan
   */
  async updateDemandWithOrchestration(demandId: number, plan: OrchestrationPlan): Promise<void> {
    const demand = await storage.getDemand(demandId);
    if (!demand) {
      throw new Error(`Demand with ID ${demandId} not found`);
    }
    
    await storage.updateDemand(demandId, {
      ...demand,
      orchestration: {
        plan: {
          agentExecutionOrder: plan.agentExecutionOrder,
          crossValidationRequired: plan.crossValidationRequired,
          validationAgents: plan.validationAgents,
          estimatedCompletionTime: plan.estimatedCompletionTime,
          notes: plan.notes
        },
        classification: plan.classification,
        orchestratedAt: new Date().toISOString()
      }
    });
  }
}

// Create a singleton instance
export const agentOrchestrator = new AgentOrchestrator();