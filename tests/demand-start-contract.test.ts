import { describe, expect, it } from 'vitest';
import { evaluateDemandStartContract } from '../shared/demand-start-contract';

describe('Demand start contract readiness', () => {
  it('marks an improvement ready when baseline, target, constraints, and compatibility are filled', () => {
    const result = evaluateDemandStartContract({
      type: 'melhoria',
      title: 'Melhorar início de demandas',
      description: 'Melhorar o formulário para reduzir retrabalho antes do PRD.',
      fields: {
        improvement_baseline: 'Demandas entram sem baseline e voltam para correção.',
        improvement_target_metric: 'Reduzir retrabalho em 30%.',
        improvement_constraints: 'Não redesenhar todo o fluxo.',
        improvement_compatibility: 'Manter criação atual de demandas e arquivos.',
      },
    });

    expect(result.canSubmit).toBe(true);
    expect(result.isComplete).toBe(true);
    expect(result.status).toBe('ready_for_development');
    expect(result.score).toBe(100);
  });

  it('keeps a bug submittable but flags missing reproduction details', () => {
    const result = evaluateDemandStartContract({
      type: 'bug',
      title: 'Erro ao salvar demanda',
      description: 'A tela mostra erro 500 ao salvar.',
      fields: {
        bug_expected_actual: 'Esperado salvar, ocorrido erro 500.',
        bug_environment: 'Chrome local.',
      },
    });

    expect(result.canSubmit).toBe(true);
    expect(result.isComplete).toBe(false);
    expect(result.status).toBe('needs_reproduction');
    expect(result.missingFields.map((field) => field.id)).toContain('bug_reproduction_steps');
  });

  it('suggests bug fix when the selected type is feature but description has strong bug signals', () => {
    const result = evaluateDemandStartContract({
      type: 'nova_funcionalidade',
      title: 'Corrigir erro de login',
      description: 'Bug com erro 500 e exception quando o usuário tenta entrar.',
      fields: {},
    });

    expect(result.suggestedType?.type).toBe('bug');
  });

  it('keeps exploratory analysis submittable but flags missing data source', () => {
    const result = evaluateDemandStartContract({
      type: 'analise_exploratoria',
      title: 'Analisar queda de conversão',
      description: 'Análise dos dados de conversão por período.',
      fields: {
        analysis_question: 'Onde a conversão caiu?',
        analysis_period: 'Últimos 30 dias.',
        analysis_expected_decision: 'Priorizar melhoria no passo com maior perda.',
      },
    });

    expect(result.canSubmit).toBe(true);
    expect(result.isComplete).toBe(false);
    expect(result.status).toBe('needs_data');
    expect(result.missingFields.map((field) => field.id)).toContain('analysis_data_source');
  });
});
