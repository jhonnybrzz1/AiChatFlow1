import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import type { Demand, DemandDomain } from '@shared/schema';
import { canonicalizeAgentConfigMap } from './agent-identity';

export const IMPROVEMENT_EXECUTION_CONFIG_VERSION = 'improvement-domain-parallel-v1';
export const IMPROVEMENT_PARALLEL_AGENTS = ['qa', 'ux', 'analista_de_dados'] as const;
export const IMPROVEMENT_REQUIRED_AGENTS = [
  'refinador',
  'scrum_master',
  'qa',
  'ux',
  'analista_de_dados',
  'tech_lead',
] as const;

const SUPPORTED_DOMAINS: DemandDomain[] = ['padrao', 'fintech', 'healthtech', 'ecommerce'];
const REQUIRED_PROMPT_PLACEHOLDERS = ['domain', 'agentName', 'demandType'];
const ALLOWED_PROMPT_PLACEHOLDERS = new Set([...REQUIRED_PROMPT_PLACEHOLDERS, 'title']);

const DOMAIN_PROMPTS: Record<DemandDomain, string> = {
  padrao: [
    'Contexto de dominio: {domain}.',
    'Como {agentName}, avalie a melhoria {title} para o tipo {demandType} com foco em entrega incremental, metricas antes/depois e reducao de retrabalho.',
  ].join('\n'),
  fintech: [
    'Contexto de dominio: {domain}.',
    'Como {agentName}, avalie a melhoria {title} para o tipo {demandType} considerando fluxos financeiros, confiabilidade operacional, rastreabilidade de decisoes, privacidade e risco de erro em dados sensiveis.',
  ].join('\n'),
  healthtech: [
    'Contexto de dominio: {domain}.',
    'Como {agentName}, avalie a melhoria {title} para o tipo {demandType} considerando seguranca do paciente/usuario, clareza de informacao, privacidade, consentimento e continuidade operacional.',
  ].join('\n'),
  ecommerce: [
    'Contexto de dominio: {domain}.',
    'Como {agentName}, avalie a melhoria {title} para o tipo {demandType} considerando descoberta de produto, conversao, checkout, estoque, pos-venda e metricas de funil.',
  ].join('\n'),
};

export interface PromptResolution {
  prompt: string;
  fallbackUsed: boolean;
  fallbackReason?: string;
}

export interface QualityChecklistResult {
  qualityPassed: boolean;
  missingSections: string[];
}

export interface ExecutionMetricEvent {
  executionId: string;
  demandId: number;
  eventType: string;
  configVersion: string;
  timestamp: string;
  agentName?: string;
  startTime?: string;
  endTime?: string;
  durationMs?: number;
  qualityPassed?: boolean;
  missingSections?: string[];
  fallbackUsed?: boolean;
  fallbackReason?: string;
  metadata?: Record<string, unknown>;
}

export class ImprovementExecutionService {
  createExecutionId(): string {
    return `exec_${Date.now()}_${randomUUID().slice(0, 8)}`;
  }

  normalizeDomain(domain: unknown): DemandDomain {
    return SUPPORTED_DOMAINS.includes(domain as DemandDomain) ? domain as DemandDomain : 'padrao';
  }

  resolveDomainPrompt(domain: DemandDomain, demand: Demand, agentName: string): PromptResolution {
    const template = DOMAIN_PROMPTS[domain] || DOMAIN_PROMPTS.padrao;
    const validation = this.validatePromptTemplate(template);

    if (!validation.valid) {
      return {
        prompt: this.renderPrompt(DOMAIN_PROMPTS.padrao, 'padrao', demand, agentName),
        fallbackUsed: true,
        fallbackReason: validation.reason,
      };
    }

    return {
      prompt: this.renderPrompt(template, domain, demand, agentName),
      fallbackUsed: false,
    };
  }

  getImprovementAgentConfigs<T extends { system_prompt: string; description: string; model?: string }>(
    configs: Record<string, T>,
    demand: Demand,
  ): { configs: Record<string, T>; fallbackUsed: boolean; fallbackReason?: string } {
    const canonicalConfigs = canonicalizeAgentConfigMap(configs);

    if (demand.type !== 'melhoria') {
      return { configs: canonicalConfigs, fallbackUsed: false };
    }

    const domain = this.normalizeDomain(demand.domain);
    const selectedConfigs: Record<string, T> = {};
    let fallbackUsed = false;
    const fallbackReasons: string[] = [];

    for (const agentName of IMPROVEMENT_REQUIRED_AGENTS) {
      const baseConfig = canonicalConfigs[agentName];
      if (!baseConfig) continue;

      const domainPrompt = this.resolveDomainPrompt(domain, demand, agentName);
      if (domainPrompt.fallbackUsed) {
        fallbackUsed = true;
        fallbackReasons.push(`${agentName}: ${domainPrompt.fallbackReason}`);
      }

      selectedConfigs[agentName] = {
        ...baseConfig,
        system_prompt: `${baseConfig.system_prompt}\n\n--- DOMINIO DA DEMANDA ---\n${domainPrompt.prompt}`,
      };
    }

    return {
      configs: selectedConfigs,
      fallbackUsed,
      fallbackReason: fallbackReasons.length > 0 ? fallbackReasons.join('; ') : undefined,
    };
  }

  validateImprovementPlan(content: string): QualityChecklistResult {
    const requiredSections = [
      '## 3. Problema e Oportunidade',
      '### 3.1 Contexto do Problema',
      '### 3.2 Impacto Atual',
      '### 3.3 Oportunidade',
      '## 4. Objetivo e Benefícios',
      '### 4.1 Objetivo Principal',
      '### 4.2 Benefícios Esperados',
      '## 5. Escopo da Entrega',
      '### 5.1 Fazer Agora',
      '### 5.2 Fazer Depois',
      '### 5.3 Não Fazer',
      '## 8. Métricas de Sucesso',
      '## 9. Prioridade e Justificativa',
      '## 10. Riscos e Mitigações',
    ];

    const normalized = this.normalizeText(content);
    const missingSections = requiredSections.filter(section => !normalized.includes(this.normalizeText(section)));

    return {
      qualityPassed: missingSections.length === 0,
      missingSections,
    };
  }

  recordEvent(event: ExecutionMetricEvent): void {
    const dataDir = path.join(process.cwd(), 'data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    const eventWithDefaults = {
      ...event,
      configVersion: event.configVersion || IMPROVEMENT_EXECUTION_CONFIG_VERSION,
      timestamp: event.timestamp || new Date().toISOString(),
    };

    fs.appendFileSync(
      path.join(dataDir, 'execution_events.jsonl'),
      `${JSON.stringify(eventWithDefaults)}\n`,
      'utf8',
    );
  }

  private validatePromptTemplate(template: string): { valid: boolean; reason?: string } {
    if (template.length < 80 || template.length > 1200) {
      return { valid: false, reason: 'prompt_size_out_of_bounds' };
    }

    const malformedBraces = (template.match(/{/g)?.length || 0) !== (template.match(/}/g)?.length || 0);
    if (malformedBraces) {
      return { valid: false, reason: 'malformed_placeholder_braces' };
    }

    const placeholders = [...template.matchAll(/{([^{}]+)}/g)].map(match => match[1]);
    for (const required of REQUIRED_PROMPT_PLACEHOLDERS) {
      if (!placeholders.includes(required)) {
        return { valid: false, reason: `missing_required_placeholder:${required}` };
      }
    }

    const invalidPlaceholder = placeholders.find(placeholder => !ALLOWED_PROMPT_PLACEHOLDERS.has(placeholder));
    if (invalidPlaceholder) {
      return { valid: false, reason: `unsupported_placeholder:${invalidPlaceholder}` };
    }

    return { valid: true };
  }

  private renderPrompt(template: string, domain: DemandDomain, demand: Demand, agentName: string): string {
    return template
      .replaceAll('{domain}', domain)
      .replaceAll('{agentName}', agentName)
      .replaceAll('{demandType}', demand.type)
      .replaceAll('{title}', demand.title);
  }

  private normalizeText(value: string): string {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim();
  }
}

export const improvementExecutionService = new ImprovementExecutionService();
