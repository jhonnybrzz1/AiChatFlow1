import { describe, expect, it } from 'vitest';
import type { Demand } from '../shared/schema';
import { improvementExecutionService } from '../server/services/improvement-execution';

const demand: Demand = {
  id: 1,
  title: 'Melhorar plano gerado',
  description: 'Quero reduzir retrabalho no plano de melhoria.',
  type: 'melhoria',
  priority: 'media',
  refinementType: 'business',
  domain: 'fintech',
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
};

describe('ImprovementExecutionService', () => {
  it('renders a domain prompt without fallback for supported domains', () => {
    const result = improvementExecutionService.resolveDomainPrompt('fintech', demand, 'qa');

    expect(result.fallbackUsed).toBe(false);
    expect(result.prompt).toContain('fintech');
    expect(result.prompt).toContain('qa');
    expect(result.prompt).toContain('melhoria');
  });

  it('selects only the fixed improvement template agents', () => {
    const result = improvementExecutionService.getImprovementAgentConfigs({
      refinador: { system_prompt: 'base', description: 'Refina' },
      scrum_master: { system_prompt: 'base', description: 'Scrum' },
      qa: { system_prompt: 'base', description: 'QA' },
      ux: { system_prompt: 'base', description: 'UX' },
      analista_de_dados: { system_prompt: 'base', description: 'Dados' },
      tech_lead: { system_prompt: 'base', description: 'Tech' },
      product_manager: { system_prompt: 'base', description: 'PM' },
    }, demand);

    expect(Object.keys(result.configs)).toEqual([
      'refinador',
      'scrum_master',
      'qa',
      'ux',
      'analista_de_dados',
      'tech_lead',
    ]);
  });

  it('passes the deterministic checklist when all improvement sections exist', () => {
    const content = `
## 3. Problema e Oportunidade
### 3.1 Contexto do Problema
### 3.2 Impacto Atual
### 3.3 Oportunidade
## 4. Objetivo e Benefícios
### 4.1 Objetivo Principal
### 4.2 Benefícios Esperados
## 5. Escopo da Entrega
### 5.1 Fazer Agora
### 5.2 Fazer Depois
### 5.3 Não Fazer
## 8. Métricas de Sucesso
## 9. Prioridade e Justificativa
## 10. Riscos e Mitigações
`;

    const result = improvementExecutionService.validateImprovementPlan(content);

    expect(result.qualityPassed).toBe(true);
    expect(result.missingSections).toEqual([]);
  });

  it('returns missing sections when the checklist fails', () => {
    const result = improvementExecutionService.validateImprovementPlan('## 3. Problema e Oportunidade');

    expect(result.qualityPassed).toBe(false);
    expect(result.missingSections).toContain('### 5.1 Fazer Agora');
  });
});
