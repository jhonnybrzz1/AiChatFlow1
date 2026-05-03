import { useMemo } from "react";
import { ArrowRight, Gauge, Grid2X2, Target } from "lucide-react";
import { type Demand } from "@shared/schema";
import {
  buildPriorityMatrix,
  PRIORITY_MATRIX_QUADRANTS,
  type PriorityMatrixItem,
  type PriorityMatrixQuadrant,
} from "@shared/priority-matrix";
import { DEMAND_TYPES } from "@shared/demand-types";
import { cn } from "@/lib/utils";

interface PriorityMatrixProps {
  demands: Demand[];
  selectedDemand?: Demand | null;
  onSelectDemand?: (demand: Demand) => void;
}

const quadrantOrder: PriorityMatrixQuadrant[] = [
  "do_first",
  "plan_strategically",
  "do_later",
  "avoid_or_split",
];

function getAccentColor(color: string) {
  switch (color) {
    case "cyan":
      return "var(--accent-cyan)";
    case "lime":
      return "var(--accent-lime)";
    case "orange":
      return "var(--accent-orange)";
    case "magenta":
      return "var(--accent-magenta)";
    default:
      return "var(--accent-cyan)";
  }
}

function getStatusLabel(status: string) {
  switch (status) {
    case "processing":
      return "PROCESSANDO";
    case "completed":
      return "COMPLETO";
    case "stopped":
      return "PARADO";
    case "error":
      return "ERRO";
    default:
      return status.toUpperCase();
  }
}

function MatrixDemandButton({
  item,
  isSelected,
  onSelectDemand,
}: {
  item: PriorityMatrixItem;
  isSelected: boolean;
  onSelectDemand?: (demand: Demand) => void;
}) {
  const typeConfig = DEMAND_TYPES[item.demand.type as keyof typeof DEMAND_TYPES];

  return (
    <button
      type="button"
      onClick={() => onSelectDemand?.(item.demand)}
      className={cn(
        "w-full border p-3 text-left transition-colors hover:bg-[var(--background)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent-cyan)]",
        isSelected ? "border-[var(--accent-cyan)] bg-[var(--background)]" : "border-[var(--border)] bg-[var(--card)]"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-mono text-xs font-bold text-[var(--foreground)]">
            {item.demand.title}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2 font-mono text-[9px] text-[var(--foreground-muted)]">
            <span className="border border-[var(--border)] px-1.5 py-0.5">
              {typeConfig?.shortLabel || item.demand.type}
            </span>
            <span className="border border-[var(--border)] px-1.5 py-0.5">
              {getStatusLabel(item.demand.status)}
            </span>
          </div>
        </div>
        <ArrowRight className="mt-0.5 h-4 w-4 flex-shrink-0 text-[var(--foreground-muted)]" />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 font-mono text-[10px]">
        <div>
          <div className="mb-1 flex items-center gap-1 text-[var(--foreground-muted)]">
            <Target className="h-3 w-3" />
            <span>VALOR</span>
          </div>
          <div className="h-1.5 border border-[var(--border)] bg-[var(--background)]">
            <div className="h-full bg-[var(--accent-lime)]" style={{ width: `${item.valueScore}%` }} />
          </div>
        </div>
        <div>
          <div className="mb-1 flex items-center gap-1 text-[var(--foreground-muted)]">
            <Gauge className="h-3 w-3" />
            <span>ESFORÇO</span>
          </div>
          <div className="h-1.5 border border-[var(--border)] bg-[var(--background)]">
            <div className="h-full bg-[var(--accent-orange)]" style={{ width: `${item.effortScore}%` }} />
          </div>
        </div>
      </div>
    </button>
  );
}

export function PriorityMatrix({ demands, selectedDemand, onSelectDemand }: PriorityMatrixProps) {
  const matrix = useMemo(() => buildPriorityMatrix(demands), [demands]);
  const activeDemands = demands.filter((demand) => demand.status !== "completed").length;

  return (
    <section className="neo-card">
      <div className="border-b-2 border-[var(--border)] bg-[var(--muted)] p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center bg-[var(--accent-violet)]">
              <Grid2X2 className="h-4 w-4 text-[var(--background)]" />
            </div>
            <div>
              <h2 className="font-mono text-sm font-bold">MATRIZ DE PRIORIZAÇÃO</h2>
              <p className="font-mono text-xs text-[var(--foreground-muted)]">
                Valor x esforço para decidir o próximo foco
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 font-mono text-[10px] text-[var(--foreground-muted)]">
            <span className="border border-[var(--border)] px-2 py-1">TOTAL: {demands.length}</span>
            <span className="border border-[var(--border)] px-2 py-1">ATIVAS: {activeDemands}</span>
          </div>
        </div>
      </div>

      <div className="grid gap-4 p-4 lg:grid-cols-2">
        {quadrantOrder.map((quadrant) => {
          const config = PRIORITY_MATRIX_QUADRANTS[quadrant];
          const color = getAccentColor(config.color);
          const items = matrix[quadrant];

          return (
            <div key={quadrant} className="border-2 border-[var(--border)] bg-[var(--background)]">
              <div className="border-b border-[var(--border)] p-3" style={{ borderTop: `3px solid ${color}` }}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-mono text-xs font-bold" style={{ color }}>
                      {config.label.toUpperCase()}
                    </h3>
                    <p className="mt-1 font-mono text-[10px] text-[var(--foreground-muted)]">
                      {config.description}
                    </p>
                  </div>
                  <span className="border px-2 py-1 font-mono text-[10px]" style={{ borderColor: color, color }}>
                    {items.length}
                  </span>
                </div>
              </div>

              <div className="space-y-2 p-3">
                {items.length === 0 ? (
                  <div className="flex min-h-[96px] items-center justify-center border border-dashed border-[var(--border)] p-3 text-center font-mono text-xs text-[var(--foreground-muted)]">
                    Sem demandas neste quadrante
                  </div>
                ) : (
                  items.slice(0, 4).map((item) => (
                    <MatrixDemandButton
                      key={item.demand.id}
                      item={item}
                      isSelected={selectedDemand?.id === item.demand.id}
                      onSelectDemand={onSelectDemand}
                    />
                  ))
                )}
                {items.length > 4 && (
                  <div className="font-mono text-[10px] text-[var(--foreground-muted)]">
                    +{items.length - 4} demandas adicionais no quadrante
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
