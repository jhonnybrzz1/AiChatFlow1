import { z } from 'zod';

export const DEMAND_TYPES = {
  nova_funcionalidade: {
    label: 'NOVA FEATURE',
    shortLabel: 'FEATURE',
    icon: 'Plus',
    color: 'cyan',
    suggestedPriority: 'media',
    plugin: 'FeaturePlugin',
    prdTemplate: 'feature',
    refinementLevel: 4,
    intensity: 'alta',
    defaultTeam: 'Development Team',
    defaultResolutionMinutes: 2880, // 48h
    complexityAdjustment: 15,
    baseSuccessRate: 85,
    canonicalDemandType: 'newFeature',
    outputType: 'feature_prd',
    typeRequirements: [
      'User stories',
      'Acceptance criteria',
      'Rollout plan',
      'Success metrics'
    ],
    maxEffortDays: 14,
    minROI: '3:1',
    primaryFramework: 'jtbd',
    secondaryFrameworks: ['double-diamond', 'heart'],
    resolutionMultiplier: 1.5,
    classifierScoreAdjustments: {
      technical: 15,
      creative: 10,
      business: 5
    }
  },
  melhoria: {
    label: 'MELHORIA',
    shortLabel: 'UPGRADE',
    icon: 'TrendingUp',
    color: 'lime',
    suggestedPriority: 'media',
    plugin: 'ImprovementPlugin',
    prdTemplate: 'improvement',
    refinementLevel: 3,
    intensity: 'media',
    defaultTeam: 'Maintenance Team',
    defaultResolutionMinutes: 1440, // 24h
    complexityAdjustment: 5,
    baseSuccessRate: 90,
    canonicalDemandType: 'improvement',
    outputType: 'improvement_plan',
    typeRequirements: [
      'Current baseline',
      'Expected improvement',
      'Before and after metrics',
      'Compatibility check'
    ],
    maxEffortDays: 7,
    minROI: '3:1',
    primaryFramework: 'heart',
    secondaryFrameworks: ['jtbd', 'crisp-dm'],
    resolutionMultiplier: 1.0,
    classifierScoreAdjustments: {
      technical: 5,
      creative: 5,
      analytical: 5
    }
  },
  bug: {
    label: 'BUG FIX',
    shortLabel: 'BUG',
    icon: 'Bug',
    color: 'magenta',
    suggestedPriority: 'alta',
    plugin: 'BugPlugin',
    prdTemplate: 'bug',
    refinementLevel: 2,
    intensity: 'baixa',
    defaultTeam: 'Support Team',
    defaultResolutionMinutes: 480, // 8h
    complexityAdjustment: 10,
    baseSuccessRate: 95,
    canonicalDemandType: 'bug',
    outputType: 'bug_fix_plan',
    typeRequirements: [
      'Root cause analysis',
      'Steps to reproduce',
      'Regression tests',
      'Fix validation'
    ],
    maxEffortDays: 3,
    minROI: 'N/A',
    primaryFramework: 'severity-priority',
    secondaryFrameworks: ['jtbd', 'heart'],
    resolutionMultiplier: 0.5,
    classifierScoreAdjustments: {
      support: 20,
      technical: 10
    }
  },
  discovery: {
    label: 'DISCOVERY',
    shortLabel: 'DISC',
    icon: 'Compass',
    color: 'violet',
    suggestedPriority: 'baixa',
    plugin: 'DiscoveryPlugin',
    prdTemplate: 'discovery',
    refinementLevel: 3,
    intensity: 'media',
    defaultTeam: 'Product Team',
    defaultResolutionMinutes: 1440, // 24h
    complexityAdjustment: 0,
    baseSuccessRate: 80,
    canonicalDemandType: 'discovery',
    outputType: 'research_report',
    typeRequirements: [
      'Hypothesis',
      'Research questions',
      'Methodology',
      'Decision criteria'
    ],
    maxEffortDays: 5,
    minROI: 'Learning objective',
    primaryFramework: 'double-diamond',
    secondaryFrameworks: ['jtbd', 'heart'],
    resolutionMultiplier: 1.0,
    classifierScoreAdjustments: {
      research: 20,
      creative: 10
    }
  },
  analise_exploratoria: {
    label: 'ANÁLISE',
    shortLabel: 'DATA',
    icon: 'BarChart',
    color: 'orange',
    suggestedPriority: 'baixa',
    plugin: 'DiscoveryPlugin',
    prdTemplate: 'analysis',
    refinementLevel: 3,
    intensity: 'media',
    defaultTeam: 'Data Team',
    defaultResolutionMinutes: 1440, // 24h
    complexityAdjustment: 0,
    baseSuccessRate: 85,
    canonicalDemandType: 'exploratoryAnalysis',
    outputType: 'analysis_report',
    typeRequirements: [
      'Data sources',
      'Analysis approach',
      'Insights',
      'Recommendations'
    ],
    maxEffortDays: 5,
    minROI: 'Actionable insight',
    primaryFramework: 'crisp-dm',
    secondaryFrameworks: ['double-diamond', 'jtbd'],
    resolutionMultiplier: 1.0,
    classifierScoreAdjustments: {
      analytical: 20,
      research: 10
    }
  }
} as const;

export const demandTypeSchema = z.enum([
  'nova_funcionalidade',
  'melhoria',
  'bug',
  'discovery',
  'analise_exploratoria'
]);

export type DemandType = z.infer<typeof demandTypeSchema>;

export function getDemandTypeConfig(type: string) {
  const config = DEMAND_TYPES[type as DemandType];
  if (!config) {
    return DEMAND_TYPES.discovery;
  }
  return config;
}

export function isDemandType(type: string): type is DemandType {
  return type in DEMAND_TYPES;
}

export const PRIORITIES = {
  baixa: { label: 'Baixa', color: 'slate' },
  media: { label: 'Média', color: 'blue' },
  alta: { label: 'Alta', color: 'amber' },
  critica: { label: 'Crítica', color: 'red' }
} as const;

export const prioritySchema = z.enum(['baixa', 'media', 'alta', 'critica']);
export type DemandPriority = z.infer<typeof prioritySchema>;
