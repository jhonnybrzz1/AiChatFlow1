import { DEMAND_TYPES, type DemandType } from "./demand-types";

export type DemandReadinessStatus =
  | "ready_for_development"
  | "needs_discovery"
  | "needs_data"
  | "needs_reproduction"
  | "needs_scope_breakdown";

export type DemandContractField = {
  id: string;
  label: string;
  placeholder: string;
  required: boolean;
};

export type DemandContractFields = Record<string, string>;

export type DemandStartContract = {
  fields: DemandContractField[];
  incompleteStatus: DemandReadinessStatus;
  incompleteNextStep: string;
};

export type DemandTypeSuggestion = {
  type: DemandType;
  label: string;
  confidence: number;
  reason: string;
};

export type DemandReadinessResult = {
  score: number;
  status: DemandReadinessStatus;
  statusLabel: string;
  isComplete: boolean;
  canSubmit: boolean;
  missingFields: DemandContractField[];
  completedFields: DemandContractField[];
  nextStep: string;
  suggestedType?: DemandTypeSuggestion;
};

export const READINESS_STATUS_LABELS: Record<DemandReadinessStatus, string> = {
  ready_for_development: "Pronto para desenvolvimento",
  needs_discovery: "Precisa discovery",
  needs_data: "Precisa dados",
  needs_reproduction: "Precisa reprodução",
  needs_scope_breakdown: "Precisa quebrar escopo",
};

export const DEMAND_START_CONTRACTS: Record<DemandType, DemandStartContract> = {
  nova_funcionalidade: {
    incompleteStatus: "needs_discovery",
    incompleteNextStep: "Complete usuário, problema, job story, métrica e rollout antes de iniciar a feature.",
    fields: [
      { id: "feature_user", label: "Usuário", placeholder: "Quem sente o problema ou usará a feature", required: true },
      { id: "feature_problem", label: "Problema", placeholder: "Qual problema real a feature resolve", required: true },
      { id: "feature_job_story", label: "Job story", placeholder: "Quando..., quero..., para...", required: true },
      { id: "feature_success_metric", label: "Métrica", placeholder: "Como saberemos que funcionou", required: true },
      { id: "feature_rollout", label: "Rollout", placeholder: "Como lançar sem risco desnecessário", required: true },
    ],
  },
  melhoria: {
    incompleteStatus: "needs_data",
    incompleteNextStep: "Informe baseline atual, métrica alvo, restrições e compatibilidade antes de tratar como melhoria pronta.",
    fields: [
      { id: "improvement_baseline", label: "Baseline atual", placeholder: "Estado atual ou medição antes da mudança", required: true },
      { id: "improvement_target_metric", label: "Métrica alvo", placeholder: "Resultado esperado depois da melhoria", required: true },
      { id: "improvement_constraints", label: "Restrições", placeholder: "Limites técnicos, UX, prazo ou compatibilidade", required: true },
      { id: "improvement_compatibility", label: "Compatibilidade", placeholder: "O que não pode quebrar ou regredir", required: true },
    ],
  },
  bug: {
    incompleteStatus: "needs_reproduction",
    incompleteNextStep: "Inclua passos de reprodução, esperado vs ocorrido, ambiente e severidade antes de abrir o bug.",
    fields: [
      { id: "bug_reproduction_steps", label: "Passos de reprodução", placeholder: "Passo 1, passo 2, resultado observado", required: true },
      { id: "bug_expected_actual", label: "Esperado vs ocorrido", placeholder: "O que deveria acontecer e o que aconteceu", required: true },
      { id: "bug_environment", label: "Ambiente", placeholder: "Browser, dispositivo, versão, endpoint ou contexto", required: true },
      { id: "bug_severity", label: "Severidade", placeholder: "Crítica, alta, média ou baixa com impacto", required: true },
    ],
  },
  discovery: {
    incompleteStatus: "needs_discovery",
    incompleteNextStep: "Defina hipótese, perguntas, método e critério de decisão para orientar a pesquisa.",
    fields: [
      { id: "discovery_hypothesis", label: "Hipótese", placeholder: "O que precisa ser validado ou invalidado", required: true },
      { id: "discovery_questions", label: "Perguntas", placeholder: "Perguntas que a pesquisa deve responder", required: true },
      { id: "discovery_method", label: "Método", placeholder: "Entrevistas, teste de protótipo, análise desk, survey", required: true },
      { id: "discovery_decision_criteria", label: "Critério de decisão", placeholder: "Qual evidência decide o próximo passo", required: true },
    ],
  },
  analise_exploratoria: {
    incompleteStatus: "needs_data",
    incompleteNextStep: "Informe fonte de dados, pergunta analítica, período e decisão esperada antes de executar análise.",
    fields: [
      { id: "analysis_data_source", label: "Fonte de dados", placeholder: "Tabela, arquivo, API, evento ou origem dos dados", required: true },
      { id: "analysis_question", label: "Pergunta analítica", placeholder: "Pergunta que a análise precisa responder", required: true },
      { id: "analysis_period", label: "Período", placeholder: "Intervalo temporal ou recorte analisado", required: true },
      { id: "analysis_expected_decision", label: "Decisão esperada", placeholder: "Qual decisão será tomada com os insights", required: true },
    ],
  },
};

const TYPE_SIGNALS: Record<DemandType, string[]> = {
  nova_funcionalidade: [
    "adicionar",
    "criar",
    "implementar",
    "nova feature",
    "nova funcionalidade",
    "permitir",
    "suporte a",
  ],
  melhoria: [
    "melhorar",
    "melhoria",
    "otimizar",
    "otimizacao",
    "otimização",
    "performance",
    "lento",
    "refinar",
    "ajustar",
  ],
  bug: [
    "bug",
    "erro",
    "error",
    "falha",
    "crash",
    "quebra",
    "travando",
    "não funciona",
    "nao funciona",
    "500",
    "exception",
  ],
  discovery: [
    "discovery",
    "descobrir",
    "validar",
    "hipotese",
    "hipótese",
    "pesquisar",
    "entrevistar",
    "experimento",
  ],
  analise_exploratoria: [
    "analisar",
    "análise",
    "analise",
    "dados",
    "dataset",
    "fonte de dados",
    "csv",
    "relatorio",
    "relatório",
    "insights",
  ],
};

function normalizeText(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function isFilled(value: string | undefined): boolean {
  return Boolean(value && value.trim().length >= 3);
}

function hasBroadScope(text: string): boolean {
  const normalized = normalizeText(text);
  return [
    "sistema inteiro",
    "tudo",
    "toda a plataforma",
    "reescrever",
    "refazer inteiro",
    "do zero",
  ].some((signal) => normalized.includes(signal));
}

export function getDemandStartContract(type: DemandType): DemandStartContract {
  return DEMAND_START_CONTRACTS[type];
}

export function detectSuggestedDemandType(input: {
  selectedType: DemandType;
  title?: string;
  description?: string;
}): DemandTypeSuggestion | undefined {
  const text = normalizeText(`${input.title || ""} ${input.description || ""}`);
  if (!text.trim()) return undefined;

  const scores = Object.entries(TYPE_SIGNALS).map(([type, signals]) => {
    const score = signals.reduce((total, signal) => total + (text.includes(normalizeText(signal)) ? 1 : 0), 0);
    return { type: type as DemandType, score };
  });

  const selectedScore = scores.find((item) => item.type === input.selectedType)?.score || 0;
  const best = scores.sort((a, b) => b.score - a.score)[0];

  if (!best || best.type === input.selectedType || best.score < 2 || best.score < selectedScore + 2) {
    return undefined;
  }

  return {
    type: best.type,
    label: DEMAND_TYPES[best.type].label,
    confidence: Math.min(95, 55 + best.score * 10),
    reason: `A descrição tem sinais fortes de ${DEMAND_TYPES[best.type].label}.`,
  };
}

export function evaluateDemandStartContract(input: {
  type: DemandType;
  title?: string;
  description?: string;
  fields?: Partial<DemandContractFields>;
}): DemandReadinessResult {
  const contract = getDemandStartContract(input.type);
  const fields = input.fields || {};
  const requiredFields = contract.fields.filter((field) => field.required);
  const completedFields = requiredFields.filter((field) => isFilled(fields[field.id]));
  const missingFields = requiredFields.filter((field) => !isFilled(fields[field.id]));
  const requiredScore = requiredFields.length === 0
    ? 100
    : Math.round((completedFields.length / requiredFields.length) * 100);
  const descriptionBonus = isFilled(input.description) ? 0 : -10;
  const scopeBlocked = hasBroadScope(`${input.title || ""} ${input.description || ""}`);
  const score = Math.max(0, Math.min(100, requiredScore + descriptionBonus));
  const status: DemandReadinessStatus = scopeBlocked
    ? "needs_scope_breakdown"
    : missingFields.length === 0
      ? "ready_for_development"
      : contract.incompleteStatus;
  const isComplete = status === "ready_for_development";

  return {
    score,
    status,
    statusLabel: READINESS_STATUS_LABELS[status],
    isComplete,
    canSubmit: true,
    missingFields,
    completedFields,
    nextStep: isComplete
      ? "Enviar para a squad com contrato preenchido."
      : status === "needs_scope_breakdown"
        ? "Pode enviar para refinamento, mas a squad deve avaliar quebra de escopo antes de executar."
        : `Pode enviar para refinamento. Lacunas registradas: ${contract.incompleteNextStep}`,
    suggestedType: detectSuggestedDemandType({
      selectedType: input.type,
      title: input.title,
      description: input.description,
    }),
  };
}

export function formatDemandStartContract(input: {
  type: DemandType;
  fields: Partial<DemandContractFields>;
  readiness: DemandReadinessResult;
  acceptedTypeSuggestion?: boolean;
}): string {
  const contract = getDemandStartContract(input.type);
  const lines = contract.fields.map((field) => {
    const value = input.fields[field.id]?.trim() || "Não informado";
    return `- ${field.label}: ${value}`;
  });

  const suggestion = input.readiness.suggestedType
    ? `\nSugestão de tipo: ${input.readiness.suggestedType.label} (${input.readiness.suggestedType.confidence}%)\nSugestão aceita: ${input.acceptedTypeSuggestion ? "Sim" : "Não"}`
    : input.acceptedTypeSuggestion
      ? "\nSugestão de tipo aceita: Sim"
    : "";

  return `---\n**Contrato Inteligente de Início**\nTipo avaliado: ${DEMAND_TYPES[input.type].label}\nStatus: ${input.readiness.statusLabel}\nScore de prontidão: ${input.readiness.score}%\nPróximo passo: ${input.readiness.nextStep}${suggestion}\n\nCampos do contrato:\n${lines.join("\n")}`;
}
