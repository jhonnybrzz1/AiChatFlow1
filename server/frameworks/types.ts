// Framework Types and Interfaces
// Base types for all demand management frameworks

export type FrameworkType =
  | 'jtbd'          // Jobs-to-be-Done
  | 'heart'         // HEART Framework
  | 'severity-priority' // Severity x Priority Matrix
  | 'double-diamond' // Double Diamond
  | 'crisp-dm'      // CRISP-DM
  | 'auto-suggest'  // AI Framework Suggestion
;

// Base interface for all frameworks
export interface BaseFramework {
  id: string;
  name: string;
  description: string;
  type: FrameworkType;
  version: string;
  createdAt: string;
  updatedAt: string;
}

// Common metrics interface
export interface FrameworkMetrics {
  successRate: number; // 0-100
  completionTime: number; // in minutes
  stakeholderSatisfaction: number; // 0-100
  costEfficiency: number; // 0-100
  qualityScore: number; // 0-100
}

// Integration capabilities
export interface FrameworkIntegration {
  aiEnabled: boolean;
  externalTools: string[];
  apiEndpoints: string[];
  dataSources: string[];
}

// JTBD Framework - Jobs-to-be-Done
export interface JTBDFramework extends BaseFramework {
  type: 'jtbd';
  jobStatement: string;
  jobSteps: string[];
  desiredOutcomes: string[];
  constraints: string[];
  successMetrics: {
    jobCompletionRate: number;
    customerSatisfaction: number;
    timeToComplete: number;
  };
  integration: FrameworkIntegration & {
    customerInterviews: boolean;
    surveyTools: string[];
  };
}

// HEART Framework - UX Metrics
export interface HEARTFramework extends BaseFramework {
  type: 'heart';
  happiness: {
    currentScore: number;
    targetScore: number;
    measurementMethod: string;
  };
  engagement: {
    currentScore: number;
    targetScore: number;
    measurementMethod: string;
  };
  adoption: {
    currentScore: number;
    targetScore: number;
    measurementMethod: string;
  };
  retention: {
    currentScore: number;
    targetScore: number;
    measurementMethod: string;
  };
  taskSuccess: {
    currentScore: number;
    targetScore: number;
    measurementMethod: string;
  };
  uxMetrics: {
    usabilityScore: number;
    accessibilityScore: number;
    userFeedback: string[];
  };
  integration: FrameworkIntegration & {
    analyticsTools: string[];
    sessionRecording: boolean;
    heatmapTools: string[];
  };
}

// Severity x Priority Matrix
export interface SeverityPriorityFramework extends BaseFramework {
  type: 'severity-priority';
  severityLevels: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  priorityLevels: {
    immediate: number;
    urgent: number;
    high: number;
    medium: number;
    low: number;
  };
  matrix: {
    [severity: string]: {
      [priority: string]: {
        action: string;
        sla: string;
        team: string;
      };
    };
  };
  bugMetrics: {
    resolutionTime: number;
    reopenRate: number;
    customerImpact: number;
  };
  integration: FrameworkIntegration & {
    bugTracking: string[];
    monitoringTools: string[];
    alertingSystems: string[];
  };
}

// Double Diamond Framework
export interface DoubleDiamondFramework extends BaseFramework {
  type: 'double-diamond';
  discoverPhase: {
    researchMethods: string[];
    insights: string[];
    userNeeds: string[];
    painPoints: string[];
  };
  definePhase: {
    problemStatements: string[];
    userJourneys: string[];
    personas: string[];
    hypotheses: string[];
  };
  developPhase: {
    prototypes: string[];
    testPlans: string[];
    iterations: number;
  };
  deliverPhase: {
    implementationPlan: string;
    rolloutStrategy: string;
    successCriteria: string[];
  };
  discoveryMetrics: {
    insightsGenerated: number;
    userInterviews: number;
    researchDepth: number;
  };
  integration: FrameworkIntegration & {
    researchTools: string[];
    prototypingTools: string[];
    userTestingPlatforms: string[];
  };
}

// CRISP-DM Framework
export interface CRISPDMFramework extends BaseFramework {
  type: 'crisp-dm';
  businessUnderstanding: {
    objectives: string[];
    successCriteria: string[];
    requirements: string[];
  };
  dataUnderstanding: {
    dataSources: string[];
    dataQuality: number;
    initialInsights: string[];
  };
  dataPreparation: {
    cleaningSteps: string[];
    transformationSteps: string[];
    featureEngineering: string[];
  };
  modeling: {
    algorithms: string[];
    evaluationMetrics: string[];
    modelsCreated: number;
  };
  evaluation: {
    modelPerformance: number;
    businessImpact: number;
    recommendations: string[];
  };
  deployment: {
    deploymentPlan: string;
    monitoringPlan: string;
    maintenancePlan: string;
  };
  dataScienceMetrics: {
    modelAccuracy: number;
    dataCoverage: number;
    insightValue: number;
  };
  integration: FrameworkIntegration & {
    dataPlatforms: string[];
    mlTools: string[];
    visualizationTools: string[];
  };
}

// AI Framework Suggestion
export interface AIFrameworkSuggestion extends BaseFramework {
  type: 'auto-suggest';
  analysisCriteria: FrameworkSelectionCriteria;
  suggestedFrameworks: {
    primary: FrameworkType;
    secondary: FrameworkType[];
    rationale: string;
  };
  confidenceScore: number;
  alternativeOptions: {
    framework: FrameworkType;
    score: number;
    rationale: string;
  }[];
  integration: FrameworkIntegration & {
    aiModels: string[];
    knowledgeBases: string[];
    decisionEngines: string[];
  };
}

// Union type for all frameworks
export type AnyFramework =
  | JTBDFramework
  | HEARTFramework
  | SeverityPriorityFramework
  | DoubleDiamondFramework
  | CRISPDMFramework
  | AIFrameworkSuggestion;

// Framework selection criteria
export interface FrameworkSelectionCriteria {
  demandType: string;
  complexity: 'low' | 'medium' | 'high' | 'very-high';
  impact: 'low' | 'medium' | 'high' | 'critical';
  urgency: 'low' | 'medium' | 'high' | 'immediate' | 'urgent';
  teamSize: 'small' | 'medium' | 'large' | 'enterprise';
  budget: 'limited' | 'moderate' | 'high' | 'unlimited';
  timeline: 'short' | 'medium' | 'long' | 'ongoing';
  industry: string;
  stakeholders: string[];
  }

  // Framework recommendation result
  export interface FrameworkRecommendation {
  recommendedFramework: FrameworkType;
  confidence: number; // 0-100
  rationale: string;
  implementationSteps: string[];
  expectedOutcomes: string[];
  successMetrics: FrameworkMetrics;
  integrationRequirements: FrameworkIntegration;
  }

  // Framework execution result
  export interface FrameworkExecutionResult {
  frameworkId: string;
  frameworkType: FrameworkType;
  status: 'pending' | 'in-progress' | 'completed' | 'failed';
  progress: number; // 0-100
  metrics: FrameworkMetrics;
  outputs: any;
  timeline: {
    startedAt: string;
    completedAt?: string;
    duration?: number; // in minutes
  };
  teamMembers: string[];
  resourcesUsed: string[];
  }