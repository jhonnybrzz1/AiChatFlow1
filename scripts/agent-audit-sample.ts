import fs from "fs";
import path from "path";
import yaml from "js-yaml";
import type { Demand } from "../shared/schema";
import { canonicalAgentKey, canonicalizeAgentConfigMap } from "../server/services/agent-identity";
import {
  IMPROVEMENT_REQUIRED_AGENTS,
  improvementExecutionService,
} from "../server/services/improvement-execution";

type AgentConfig = {
  name: string;
  description: string;
  system_prompt: string;
  model?: string;
};

type TextMetrics = {
  ddi: number;
  dca: number | null;
  pta: number | null;
  redt: number;
  mec: {
    lines: number;
    bullets: number;
    headings: number;
    fields: number;
  };
};

type AgentSample = {
  runId: string;
  roundIndex: number;
  agentName: string;
  promptContext: {
    previousOutputPresent: boolean;
    previousOutputLength: number;
    conversationContextLength: number;
    hasConversationContextMarker: boolean;
    hasAccumulatedInsightsMarker: boolean;
    hasAntiRepeatInstruction: boolean;
    hasRoleInstruction: boolean;
  };
  output: string;
  metrics: TextMetrics;
  uxSignature: {
    expectedSections: string[];
    presentSections: string[];
    isComplete: boolean;
    hasNewSectionVsPrevious: boolean;
  };
};

const demand: Demand = {
  id: 9001,
  title: "Auditoria de prompts e contrato de contexto multi-agente",
  description:
    "O fluxo multi-agente apresenta pouca interação, repetição da demanda inicial e baixa aderência à persona.",
  type: "melhoria",
  priority: "media",
  refinementType: "business",
  domain: "fintech",
  status: "processing",
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
  documentState: "DRAFT",
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

const signatureSections: Record<string, string[]> = {
  refinador: ["Análise", "Problema Identificado", "Recomendação", "Perguntas Críticas", "Premissas"],
  scrum_master: ["Análise", "Problema Identificado", "Recomendação", "Checklist de Execução", "Premissas"],
  qa: ["Análise", "Problema Identificado", "Recomendação", "Casos de Teste", "Evidências"],
  ux: ["Análise", "Problema Identificado", "Recomendação", "Validação UX", "Premissas"],
  analista_de_dados: ["Análise", "Problema Identificado", "Recomendação", "Métrica Principal", "Métricas Auxiliares"],
  tech_lead: ["Análise", "Problema Identificado", "Recomendação", "Trade-offs", "Riscos Técnicos"],
};

function loadAgentConfigs(): Record<string, AgentConfig> {
  const agentsDir = path.join(process.cwd(), "agents");
  const configs: Record<string, AgentConfig> = {};

  for (const file of fs.readdirSync(agentsDir)) {
    if (!file.endsWith(".yaml") && !file.endsWith(".yml")) continue;
    const loaded = yaml.load(fs.readFileSync(path.join(agentsDir, file), "utf8")) as AgentConfig;
    configs[canonicalAgentKey(loaded.name)] = loaded;
  }

  return canonicalizeAgentConfigMap(configs);
}

function normalizeText(value: string): string[] {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

function jaccard(a: string, b: string): number {
  const aSet = new Set(normalizeText(a));
  const bSet = new Set(normalizeText(b));
  if (aSet.size === 0 && bSet.size === 0) return 1;
  const intersection = [...aSet].filter(token => bSet.has(token)).length;
  const union = new Set([...aSet, ...bSet]).size;
  return union === 0 ? 0 : round(intersection / union);
}

function trigrams(tokens: string[]): string[] {
  const grams: string[] = [];
  for (let index = 0; index <= tokens.length - 3; index += 1) {
    grams.push(tokens.slice(index, index + 3).join(" "));
  }
  return grams;
}

function redt(demandInitial: string, output: string): number {
  const demandGrams = trigrams(normalizeText(demandInitial));
  if (demandGrams.length === 0) return 0;
  const outputText = normalizeText(output).join(" ");
  const repeated = demandGrams.filter(gram => outputText.includes(gram)).length;
  return round(repeated / demandGrams.length);
}

function mec(output: string): TextMetrics["mec"] {
  const lines = output.split("\n").filter(line => line.trim()).length;
  return {
    lines,
    bullets: output.split("\n").filter(line => /^\s*[-*]\s+/.test(line)).length,
    headings: output.split("\n").filter(line => /^\s*#{1,6}\s+/.test(line)).length,
    fields: [...output.matchAll(/\*\*[^*]+:\*\*/g)].length,
  };
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function buildOutput(agentName: string, runIndex: number, previousOutput: string | null): string {
  const priorClause = previousOutput
    ? "Complementa o agente anterior com uma decisao nova e um criterio verificavel."
    : "Resume a demanda em uma frase e abre lacunas para a squad.";

  const agentSpecific: Record<string, string[]> = {
    refinador: [
      "**Perguntas Críticas:** Qual variavel representa contexto anterior? Onde o output por rodada e salvo? Qual baseline mede repeticao?",
    ],
    scrum_master: [
      "**Checklist de Execução:** corrigir contrato de chaves; validar contexto anterior; rodar amostra; revisar metricas.",
    ],
    qa: [
      "**Casos de Teste:** chave canonica com espaco; chave canonica snake_case; historico com contexto vazio; historico preenchido.",
      "**Evidências:** status do teste, metadata.promptContext e arquivo de amostra gerado.",
    ],
    ux: [
      "**Validação UX:** comparar conversa antes/depois por legibilidade, progresso entre agentes e ausencia de repeticao literal.",
    ],
    analista_de_dados: [
      "**Métrica Principal:** PTA medio entre agentes consecutivos; direcao esperada: queda de sobreposicao repetitiva com aumento de campos novos.",
      "**Métricas Auxiliares:** DDI, DCA, REDT e completude de assinatura.",
    ],
    tech_lead: [
      "**Trade-offs:** metadata pequena reduz risco de vazamento, mas exige script para reconstruir metricas sem texto completo.",
      "**Riscos Técnicos:** contexto em memoria pode sumir; mitigar persistindo resumo e tamanhos por turno.",
    ],
  };

  const sections = [
    `**Análise:** ${priorClause} Run ${runIndex + 1} foca em contrato multi-agente observavel.`,
    "**Problema Identificado:** chaves de agente e contexto anterior precisam ser verificaveis no payload final.",
    "**Impacto:** sem contrato, a squad pode rodar incompleta e parecer generica.",
    "**Recomendação:** manter chave canonica, metadata de contexto e regra de progresso por persona.",
    ...(agentSpecific[agentName] || []),
    "**ROI:** 4:1",
    "**Esforço:** 2 dias",
    "**Prioridade:** Importante",
    "**Premissas:** amostra local controlada sem chamada externa de IA.",
  ];

  return sections.join("\n");
}

function buildPromptContext(agentName: string, agentConfig: AgentConfig, previousOutputs: string[]) {
  const conversationContext = previousOutputs
    .map((output, index) => `[agent_${index + 1} @ T]: ${output}`)
    .join("\n\n");
  const evolvedContext = previousOutputs.length > 0
    ? `BASE CONTEXT\n\n--- INSIGHTS ACUMULADOS DOS AGENTES ---\n${previousOutputs.join("\n\n")}`
    : "BASE CONTEXT";
  const systemPrompt = `${evolvedContext}\n\n${agentConfig.system_prompt}

CONTEXTO DA CONVERSA ATÉ AGORA:
${conversationContext || "DEMANDA ORIGINAL: " + demand.description}

Como ${agentName}, contribua para o refinamento da demanda acima.
Seu papel é: ${agentConfig.description}

IMPORTANTE:
- Use os insights dos agentes anteriores para enriquecer sua análise
- NÃO repita o que já foi dito - adicione NOVO valor`;

  const previousOutputLength = previousOutputs.join("\n\n").length;
  return {
    previousOutputPresent: previousOutputs.length > 0 && previousOutputLength > 0,
    previousOutputLength,
    conversationContextLength: conversationContext.length,
    hasConversationContextMarker: systemPrompt.includes("CONTEXTO DA CONVERSA ATÉ AGORA"),
    hasAccumulatedInsightsMarker: systemPrompt.includes("INSIGHTS ACUMULADOS DOS AGENTES"),
    hasAntiRepeatInstruction: systemPrompt.includes("NÃO repita"),
    hasRoleInstruction: systemPrompt.includes(`Como ${agentName}`) && systemPrompt.includes("Seu papel é:"),
  };
}

function calculateMetrics(output: string, previousOutput: string | null): TextMetrics {
  const previousJaccard = previousOutput ? jaccard(output, previousOutput) : null;
  return {
    ddi: jaccard(output, demand.description),
    dca: previousJaccard,
    pta: previousJaccard,
    redt: redt(demand.description, output),
    mec: mec(output),
  };
}

function measureSignature(agentName: string, output: string, previousOutput: string | null): AgentSample["uxSignature"] {
  const expectedSections = signatureSections[agentName] || ["Análise", "Problema Identificado", "Recomendação"];
  const presentSections = expectedSections.filter(section => output.includes(`**${section}:**`));
  const previousSections = previousOutput
    ? expectedSections.filter(section => previousOutput.includes(`**${section}:**`))
    : [];

  return {
    expectedSections,
    presentSections,
    isComplete: presentSections.length === expectedSections.length,
    hasNewSectionVsPrevious: presentSections.some(section => !previousSections.includes(section)),
  };
}

function aggregate(samples: AgentSample[]) {
  const byAgent: Record<string, AgentSample[]> = {};
  for (const sample of samples) {
    byAgent[sample.agentName] = byAgent[sample.agentName] || [];
    byAgent[sample.agentName].push(sample);
  }

  return Object.fromEntries(
    Object.entries(byAgent).map(([agentName, rows]) => [
      agentName,
      {
        runs: rows.length,
        avgDdi: round(rows.reduce((sum, row) => sum + row.metrics.ddi, 0) / rows.length),
        avgDca: round(rows.reduce((sum, row) => sum + (row.metrics.dca || 0), 0) / rows.filter(row => row.metrics.dca !== null).length),
        avgPta: round(rows.reduce((sum, row) => sum + (row.metrics.pta || 0), 0) / rows.filter(row => row.metrics.pta !== null).length),
        avgRedt: round(rows.reduce((sum, row) => sum + row.metrics.redt, 0) / rows.length),
        signatureCompleteRate: round(rows.filter(row => row.uxSignature.isComplete).length / rows.length),
        newSectionRate: round(rows.filter(row => row.uxSignature.hasNewSectionVsPrevious).length / rows.length),
        avgFields: round(rows.reduce((sum, row) => sum + row.metrics.mec.fields, 0) / rows.length),
      },
    ])
  );
}

const agentConfigs = loadAgentConfigs();
const improvementConfig = improvementExecutionService.getImprovementAgentConfigs(agentConfigs, demand);
const selectedAgents = Object.keys(improvementConfig.configs);
const missingAgents = IMPROVEMENT_REQUIRED_AGENTS.filter(agentName => !selectedAgents.includes(agentName));
const samples: AgentSample[] = [];

for (let runIndex = 0; runIndex < 5; runIndex += 1) {
  const previousOutputs: string[] = [];
  const runId = `agent_audit_run_${runIndex + 1}`;

  for (const agentName of selectedAgents) {
    const agentConfig = improvementConfig.configs[agentName];
    const previousOutput = previousOutputs[previousOutputs.length - 1] || null;
    const output = buildOutput(agentName, runIndex, previousOutput);

    samples.push({
      runId,
      roundIndex: 0,
      agentName,
      promptContext: buildPromptContext(agentName, agentConfig, previousOutputs),
      output,
      metrics: calculateMetrics(output, previousOutput),
      uxSignature: measureSignature(agentName, output, previousOutput),
    });

    previousOutputs.push(output);
  }
}

const report = {
  generatedAt: new Date().toISOString(),
  sampleType: "runtime_controlled_no_external_ai",
  demandInitial: demand.description,
  selectedAgents,
  missingAgents,
  samples,
  aggregate: aggregate(samples),
};

fs.mkdirSync(path.join(process.cwd(), "reports"), { recursive: true });
fs.writeFileSync(
  path.join(process.cwd(), "reports", "agent-audit-sample.json"),
  `${JSON.stringify(report, null, 2)}\n`,
  "utf8"
);

console.log(JSON.stringify({
  sampleType: report.sampleType,
  selectedAgents,
  missingAgents,
  aggregate: report.aggregate,
}, null, 2));
