import { Demand } from '@shared/schema';
import { storage } from '../storage';
import { getDemandTypeConfig, isDemandType } from '@shared/demand-types';

/**
 * Categories for demand classification
 */
export type DemandCategory =
  | 'technical'
  | 'legal'
  | 'creative'
  | 'business'
  | 'analytical'
  | 'support'
  | 'research';

/**
 * Classification criteria
 */
export interface ClassificationCriteria {
  ambiguity: number; // 0-100 (higher = more ambiguous)
  interpretationRisk: number; // 0-100 (higher = higher risk)
  depthRequired: number; // 0-100 (higher = more depth needed)
  complexity: number; // 0-100 (higher = more complex)
  urgency: number; // 0-100 (higher = more urgent)
}

/**
 * Classification result
 */
export interface DemandClassification {
  category: DemandCategory;
  criteria: ClassificationCriteria;
  confidence: number; // 0-100
  recommendedAgents: string[];
  notes: string;
  realityConstraints?: {
    maturityLevel: string;
    forbiddenTechnologies: string[];
    allowedTechnologies: string[];
    capabilities: any;
  };
}

/**
 * Keywords that indicate specific categories
 */
const CATEGORY_KEYWORDS: Record<DemandCategory, string[]> = {
  technical: ['api', 'database', 'integration', 'backend', 'frontend', 'code', 'algorithm', 'server', 'deployment', 'infrastructure'],
  legal: ['contract', 'compliance', 'regulation', 'law', 'legal', 'gdpr', 'privacy', 'terms', 'policy', 'agreement'],
  creative: ['design', 'ux', 'ui', 'branding', 'creative', 'art', 'visual', 'aesthetic', 'user experience', 'prototype'],
  business: ['market', 'strategy', 'revenue', 'profit', 'business', 'sales', 'marketing', 'customer', 'product', 'growth'],
  analytical: ['data', 'analysis', 'report', 'metrics', 'analytics', 'statistics', 'insights', 'trends', 'dashboard', 'kpi'],
  support: ['help', 'support', 'issue', 'problem', 'error', 'bug', 'ticket', 'customer service', 'troubleshoot', 'resolve'],
  research: ['research', 'study', 'explore', 'investigate', 'discovery', 'findings', 'hypothesis', 'experiment', 'survey', 'analysis']
};

/**
 * Demand Classifier - Intelligent classifier for categorizing demands
 */
export class DemandClassifier {

  /**
   * Classifies a demand based on its content and context
   * @param demand - The demand to classify
   * @returns Classification result
   */
  async classifyDemand(demand: Demand): Promise<DemandClassification> {
    const criteria = this.analyzeClassificationCriteria(demand);
    const category = this.determineCategory(demand, criteria);
    const confidence = this.calculateConfidence(demand, criteria, category);
    const recommendedAgents = this.getRecommendedAgents(category, criteria);
    const notes = this.generateClassificationNotes(demand, criteria, category);

    return {
      category,
      criteria,
      confidence,
      recommendedAgents,
      notes
    };
  }

  /**
   * Analyzes classification criteria for a demand
   * @param demand - The demand to analyze
   * @returns Classification criteria
   */
  private analyzeClassificationCriteria(demand: Demand): ClassificationCriteria {
    const description = demand.description.toLowerCase();
    const title = demand.title.toLowerCase();
    const combinedText = `${title} ${description}`;

    // Calculate ambiguity (based on vague language)
    const ambiguity = this.calculateAmbiguity(combinedText);

    // Calculate interpretation risk (based on potential for misunderstanding)
    const interpretationRisk = this.calculateInterpretationRisk(combinedText);

    // Calculate depth required (based on complexity indicators)
    const depthRequired = this.calculateDepthRequired(combinedText);

    // Calculate complexity (based on technical terms and scope)
    const complexity = this.calculateComplexity(combinedText);

    // Calculate urgency (based on priority and keywords)
    const urgency = this.calculateUrgency(demand);

    return {
      ambiguity,
      interpretationRisk,
      depthRequired,
      complexity,
      urgency
    };
  }

  /**
   * Calculates ambiguity score
   * @param text - Text to analyze
   * @returns Ambiguity score (0-100)
   */
  private calculateAmbiguity(text: string): number {
    const vagueWords = ['maybe', 'possibly', 'could', 'might', 'perhaps', 'some', 'various', 'different', 'several', 'many'];
    let score = 0;

    vagueWords.forEach(word => {
      if (text.includes(word)) score += 5;
    });

    // Longer descriptions tend to be more ambiguous
    if (text.length > 500) score += 10;
    if (text.length > 1000) score += 15;

    // Question marks indicate uncertainty
    const questionMarks = (text.match(/\?/g) || []).length;
    score += questionMarks * 3;

    return Math.min(100, Math.max(0, score));
  }

  /**
   * Calculates interpretation risk score
   * @param text - Text to analyze
   * @returns Interpretation risk score (0-100)
   */
  private calculateInterpretationRisk(text: string): number {
    const riskyPhrases = [
      'as needed',
      'if possible',
      'when appropriate',
      'depending on',
      'subject to',
      'based on',
      'according to',
      'as per'
    ];

    let score = 0;
    riskyPhrases.forEach(phrase => {
      if (text.includes(phrase)) score += 8;
    });

    // Multiple stakeholders increase risk
    const stakeholders = ['team', 'department', 'group', 'stakeholder', 'client', 'customer'];
    const stakeholderCount = stakeholders.filter(word => text.includes(word)).length;
    score += stakeholderCount * 5;

    return Math.min(100, Math.max(0, score));
  }

  /**
   * Calculates depth required score
   * @param text - Text to analyze
   * @returns Depth required score (0-100)
   */
  private calculateDepthRequired(text: string): number {
    const depthIndicators = [
      'comprehensive',
      'detailed',
      'thorough',
      'complete',
      'in-depth',
      'extensive',
      'full',
      'complete',
      'exhaustive'
    ];

    let score = 20; // Base score

    depthIndicators.forEach(indicator => {
      if (text.includes(indicator)) score += 10;
    });

    // Longer descriptions indicate more depth needed
    if (text.length > 300) score += 15;
    if (text.length > 800) score += 25;

    // Multiple requirements increase depth
    const requirements = ['requirement', 'need', 'must', 'should', 'require'];
    const requirementCount = requirements.filter(word => text.includes(word)).length;
    score += requirementCount * 5;

    return Math.min(100, Math.max(0, score));
  }

  /**
   * Calculates complexity score
   * @param text - Text to analyze
   * @returns Complexity score (0-100)
   */
  private calculateComplexity(text: string): number {
    const complexTerms = [
      'integration',
      'migration',
      'refactoring',
      'scalability',
      'performance',
      'security',
      'authentication',
      'authorization',
      'database',
      'api',
      'microservice',
      'architecture',
      'infrastructure',
      'deployment',
      'containerization'
    ];

    let score = 30; // Base score

    complexTerms.forEach(term => {
      if (text.includes(term)) score += 8;
    });

    // Multiple systems increase complexity
    const systems = ['system', 'service', 'module', 'component', 'application'];
    const systemCount = systems.filter(word => text.includes(word)).length;
    score += systemCount * 7;

    // Technical jargon increases complexity
    const jargon = ['rest', 'graphql', 'websocket', 'kafka', 'redis', 'docker', 'kubernetes', 'aws', 'azure', 'gcp'];
    const jargonCount = jargon.filter(word => text.includes(word)).length;
    score += jargonCount * 6;

    return Math.min(100, Math.max(0, score));
  }

  /**
   * Calculates urgency score
   * @param demand - The demand to analyze
   * @returns Urgency score (0-100)
   */
  private calculateUrgency(demand: Demand): number {
    let score = 0;

    // Priority-based urgency
    switch (demand.priority) {
      case 'critica':
        score = 90;
        break;
      case 'alta':
        score = 70;
        break;
      case 'media':
        score = 50;
        break;
      case 'baixa':
        score = 30;
        break;
      default:
        score = 40;
    }

    // Urgent keywords
    const urgentKeywords = ['urgent', 'immediate', 'asap', 'critical', 'priority', 'emergency', 'now', 'today', 'tomorrow'];
    urgentKeywords.forEach(keyword => {
      if (demand.description.toLowerCase().includes(keyword)) score += 5;
    });

    return Math.min(100, Math.max(0, score));
  }

  /**
   * Determines the category for a demand
   * @param demand - The demand to categorize
   * @param criteria - Classification criteria
   * @returns Demand category
   */
  private determineCategory(demand: Demand, criteria: ClassificationCriteria): DemandCategory {
    const text = `${demand.title} ${demand.description}`.toLowerCase();
    const categoryScores: Record<DemandCategory, number> = {
      technical: 0,
      legal: 0,
      creative: 0,
      business: 0,
      analytical: 0,
      support: 0,
      research: 0
    };

    // Score based on keywords
    for (const category in CATEGORY_KEYWORDS) {
      const keywords = CATEGORY_KEYWORDS[category as DemandCategory];
      keywords.forEach(keyword => {
        if (text.includes(keyword)) {
          categoryScores[category as DemandCategory] += 10;
        }
      });
    }

    // Adjust scores based on classification criteria
    if (criteria.complexity > 70) categoryScores.technical += 15;
    if (criteria.ambiguity > 60) categoryScores.research += 10;
    if (criteria.depthRequired > 80) categoryScores.analytical += 12;
    if (criteria.urgency > 80) categoryScores.support += 10;

    // Adjust based on demand type using centralized config
    if (isDemandType(demand.type)) {
      const typeConfig = getDemandTypeConfig(demand.type);
      const adjustments = typeConfig.classifierScoreAdjustments;
      for (const [category, adjustment] of Object.entries(adjustments)) {
        if (category in categoryScores && typeof adjustment === 'number') {
          categoryScores[category as DemandCategory] += adjustment;
        }
      }
    }

    // Find the category with the highest score
    let highestScore = -1;
    let selectedCategory: DemandCategory = 'technical'; // default

    for (const category in categoryScores) {
      if (categoryScores[category as DemandCategory] > highestScore) {
        highestScore = categoryScores[category as DemandCategory];
        selectedCategory = category as DemandCategory;
      }
    }

    return selectedCategory;
  }

  /**
   * Calculates confidence in the classification
   * @param demand - The demand
   * @param criteria - Classification criteria
   * @param category - Determined category
   * @returns Confidence score (0-100)
   */
  private calculateConfidence(demand: Demand, criteria: ClassificationCriteria, category: DemandCategory): number {
    let confidence = 50; // Base confidence

    // Higher criteria scores increase confidence
    const avgCriteria = (criteria.ambiguity + criteria.interpretationRisk + criteria.depthRequired + criteria.complexity + criteria.urgency) / 5;
    confidence += Math.min(30, avgCriteria * 0.5);

    // Keyword matches increase confidence
    const text = `${demand.title} ${demand.description}`.toLowerCase();
    const keywords = CATEGORY_KEYWORDS[category];
    const keywordMatches = keywords.filter(keyword => text.includes(keyword)).length;
    confidence += Math.min(20, keywordMatches * 3);

    // High ambiguity decreases confidence
    if (criteria.ambiguity > 70) confidence -= 15;

    // High interpretation risk decreases confidence
    if (criteria.interpretationRisk > 60) confidence -= 10;

    return Math.min(100, Math.max(30, confidence));
  }

  /**
   * Gets recommended agents for a category
   * @param category - Demand category
   * @param criteria - Classification criteria
   * @returns Array of recommended agent names
   */
  private getRecommendedAgents(category: DemandCategory, criteria: ClassificationCriteria): string[] {
    const baseAgents: Record<DemandCategory, string[]> = {
      technical: ['tech_lead', 'qa', 'analista_de_dados'],
      legal: ['product_manager', 'qa'],
      creative: ['ux_designer', 'product_manager'],
      business: ['product_manager', 'scrum_master'],
      analytical: ['analista_de_dados', 'product_manager'],
      support: ['qa', 'scrum_master'],
      research: ['product_manager', 'analista_de_dados']
    };

    const agents = [...baseAgents[category]];

    // Add refinador for high ambiguity
    if (criteria.ambiguity > 60 && !agents.includes('refinador')) {
      agents.unshift('refinador');
    }

    // Add scrum_master for high complexity
    if (criteria.complexity > 70 && !agents.includes('scrum_master')) {
      agents.push('scrum_master');
    }

    // Add tech_lead for technical demands with high depth
    if (category === 'technical' && criteria.depthRequired > 80 && !agents.includes('tech_lead')) {
      agents.push('tech_lead');
    }

    return Array.from(new Set(agents)); // Remove duplicates
  }

  /**
   * Generates classification notes
   * @param demand - The demand
   * @param criteria - Classification criteria
   * @param category - Determined category
   * @returns Classification notes
   */
  private generateClassificationNotes(demand: Demand, criteria: ClassificationCriteria, category: DemandCategory): string {
    const notes: string[] = [];

    notes.push(`Demand classified as: ${category}`);
    notes.push(`Confidence: ${this.calculateConfidence(demand, criteria, category)}%`);

    if (criteria.ambiguity > 60) {
      notes.push(`⚠️ High ambiguity detected (${criteria.ambiguity}%) - may require clarification`);
    }

    if (criteria.interpretationRisk > 60) {
      notes.push(`⚠️ High interpretation risk (${criteria.interpretationRisk}%) - ensure clear communication`);
    }

    if (criteria.complexity > 70) {
      notes.push(`🔧 High complexity (${criteria.complexity}%) - consider breaking into smaller tasks`);
    }

    if (criteria.depthRequired > 80) {
      notes.push(`📊 High depth required (${criteria.depthRequired}%) - detailed analysis needed`);
    }

    if (criteria.urgency > 80) {
      notes.push(`⏰ High urgency (${criteria.urgency}%) - prioritize accordingly`);
    }

    return notes.join('\n');
  }

  /**
   * Updates demand with classification information
   * @param demandId - Demand ID
   * @param classification - Classification result
   */
  async updateDemandWithClassification(demandId: number, classification: DemandClassification): Promise<void> {
    const demand = await storage.getDemand(demandId);
    if (!demand) {
      throw new Error(`Demand with ID ${demandId} not found`);
    }

    await storage.updateDemand(demandId, {
      ...demand,
      classification: {
        category: classification.category,
        criteria: classification.criteria,
        confidence: classification.confidence,
        recommendedAgents: classification.recommendedAgents,
        notes: classification.notes,
        classifiedAt: new Date().toISOString()
      }
    });
  }
}

// Create a singleton instance
export const demandClassifier = new DemandClassifier();