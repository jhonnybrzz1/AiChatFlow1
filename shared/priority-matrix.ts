import { getDemandTypeConfig, type DemandPriority, type DemandType } from "./demand-types";
import type { Demand, TokenOptimizationClassification } from "./schema";

export type PriorityMatrixQuadrant =
  | "do_first"
  | "plan_strategically"
  | "do_later"
  | "avoid_or_split";

export type PriorityMatrixItem = {
  demand: Demand;
  quadrant: PriorityMatrixQuadrant;
  valueScore: number;
  effortScore: number;
  rationale: string;
};

export type PriorityMatrixQuadrantConfig = {
  label: string;
  shortLabel: string;
  description: string;
  action: string;
  color: "cyan" | "lime" | "orange" | "magenta";
};

export const PRIORITY_MATRIX_QUADRANTS: Record<PriorityMatrixQuadrant, PriorityMatrixQuadrantConfig> = {
  do_first: {
    label: "Fazer agora",
    shortLabel: "Agora",
    description: "Alto valor e baixo esforço",
    action: "Priorizar execução",
    color: "lime",
  },
  plan_strategically: {
    label: "Planejar",
    shortLabel: "Plano",
    description: "Alto valor e alto esforço",
    action: "Quebrar em etapas",
    color: "cyan",
  },
  do_later: {
    label: "Fazer depois",
    shortLabel: "Depois",
    description: "Baixo valor e baixo esforço",
    action: "Manter no backlog",
    color: "orange",
  },
  avoid_or_split: {
    label: "Evitar ou quebrar",
    shortLabel: "Quebrar",
    description: "Baixo valor e alto esforço",
    action: "Reavaliar escopo",
    color: "magenta",
  },
};

const priorityValue: Record<DemandPriority, number> = {
  critica: 100,
  alta: 82,
  media: 58,
  baixa: 32,
};

const tokenComplexityEffort: Record<TokenOptimizationClassification["complexity"], number> = {
  low: 30,
  medium: 58,
  high: 86,
};

function clampScore(score: number): number {
  return Math.max(0, Math.min(100, Math.round(score)));
}

function getClassificationComplexity(demand: Demand): number | null {
  const criteria = demand.classification?.classification?.criteria
    || demand.classification?.criteria;

  if (criteria && typeof criteria.complexity === "number") {
    return criteria.complexity;
  }

  return null;
}

export function calculateDemandValueScore(demand: Pick<Demand, "priority" | "type" | "status">): number {
  const base = priorityValue[demand.priority as DemandPriority] ?? 50;
  const typeBoost = demand.type === "bug"
    ? 8
    : demand.type === "melhoria"
      ? 5
      : demand.type === "nova_funcionalidade"
        ? 3
        : 0;
  const statusAdjustment = demand.status === "error"
    ? -12
    : demand.status === "stopped"
      ? -8
      : 0;

  return clampScore(base + typeBoost + statusAdjustment);
}

export function calculateDemandEffortScore(demand: Demand): number {
  if (demand.tokenOptimization?.complexity) {
    return tokenComplexityEffort[demand.tokenOptimization.complexity];
  }

  const classificationComplexity = getClassificationComplexity(demand);
  if (classificationComplexity !== null) {
    return clampScore(classificationComplexity);
  }

  const config = getDemandTypeConfig(demand.type as DemandType);
  const typeEffort = config.maxEffortDays <= 3
    ? 30
    : config.maxEffortDays <= 7
      ? 52
      : 78;
  const descriptionEffort = demand.description.length > 1200
    ? 12
    : demand.description.length > 600
      ? 6
      : 0;

  return clampScore(typeEffort + descriptionEffort);
}

export function getPriorityMatrixQuadrant(valueScore: number, effortScore: number): PriorityMatrixQuadrant {
  const highValue = valueScore >= 70;
  const highEffort = effortScore >= 60;

  if (highValue && !highEffort) return "do_first";
  if (highValue && highEffort) return "plan_strategically";
  if (!highValue && !highEffort) return "do_later";
  return "avoid_or_split";
}

export function classifyDemandForPriorityMatrix(demand: Demand): PriorityMatrixItem {
  const valueScore = calculateDemandValueScore(demand);
  const effortScore = calculateDemandEffortScore(demand);
  const quadrant = getPriorityMatrixQuadrant(valueScore, effortScore);
  const config = PRIORITY_MATRIX_QUADRANTS[quadrant];

  return {
    demand,
    quadrant,
    valueScore,
    effortScore,
    rationale: `${config.description}. ${config.action}.`,
  };
}

export function buildPriorityMatrix(demands: Demand[]): Record<PriorityMatrixQuadrant, PriorityMatrixItem[]> {
  const initial: Record<PriorityMatrixQuadrant, PriorityMatrixItem[]> = {
    do_first: [],
    plan_strategically: [],
    do_later: [],
    avoid_or_split: [],
  };

  return demands
    .map(classifyDemandForPriorityMatrix)
    .sort((a, b) => (b.valueScore - b.effortScore) - (a.valueScore - a.effortScore))
    .reduce((matrix, item) => {
      matrix[item.quadrant].push(item);
      return matrix;
    }, initial);
}
