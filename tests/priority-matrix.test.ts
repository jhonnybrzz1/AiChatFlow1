import { describe, expect, it } from 'vitest';
import type { Demand } from '../shared/schema';
import {
  buildPriorityMatrix,
  classifyDemandForPriorityMatrix,
} from '../shared/priority-matrix';

function createDemand(overrides: Partial<Demand>): Demand {
  return {
    id: 1,
    title: 'Demanda',
    description: 'Descrição objetiva da demanda.',
    type: 'melhoria',
    priority: 'media',
    refinementType: 'business',
    status: 'processing',
    progress: 0,
    chatMessages: [],
    prdUrl: null,
    tasksUrl: null,
    classification: null,
    orchestration: null,
    currentAgent: null,
    errorMessage: null,
    validationNotes: null,
    typeAdherence: null,
    completedAt: null,
    requiresApproval: false,
    requiresHumanReview: false,
    documentState: 'DRAFT',
    reviewSnapshotId: null,
    approvedSnapshotId: null,
    approvedSnapshotHash: null,
    finalSnapshotId: null,
    finalizedFromHash: null,
    approvalSessionId: null,
    revisionNumber: 0,
    reviewRequestedAt: null,
    approvedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    domain: 'padrao',
    executionId: null,
    executionConfig: null,
    qualityPassed: null,
    missingSections: null,
    fallbackUsed: false,
    fallbackReason: null,
    ...overrides,
  } as Demand;
}

describe('priority matrix', () => {
  it('classifies critical low-effort bugs as do first', () => {
    const item = classifyDemandForPriorityMatrix(createDemand({
      type: 'bug',
      priority: 'critica',
      tokenOptimization: {
        complexity: 'low',
        requiredAgents: ['qa'],
        estimatedInputTokens: 1000,
        estimatedOutputTokens: 500,
        confidence: 0.9,
        reasoning: 'low effort bug',
      },
    }));

    expect(item.quadrant).toBe('do_first');
  });

  it('classifies high-value high-effort features as strategic planning', () => {
    const item = classifyDemandForPriorityMatrix(createDemand({
      type: 'nova_funcionalidade',
      priority: 'alta',
      tokenOptimization: {
        complexity: 'high',
        requiredAgents: ['tech_lead', 'ux', 'qa'],
        estimatedInputTokens: 10000,
        estimatedOutputTokens: 7000,
        confidence: 0.8,
        reasoning: 'high effort feature',
      },
    }));

    expect(item.quadrant).toBe('plan_strategically');
  });

  it('builds all quadrants from demand list', () => {
    const matrix = buildPriorityMatrix([
      createDemand({ id: 1, priority: 'critica', type: 'bug' }),
      createDemand({ id: 2, priority: 'baixa', type: 'analise_exploratoria' }),
    ]);

    expect(Object.keys(matrix)).toEqual([
      'do_first',
      'plan_strategically',
      'do_later',
      'avoid_or_split',
    ]);
  });
});
