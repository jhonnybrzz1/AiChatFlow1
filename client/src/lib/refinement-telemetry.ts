export type RefinementMessageLengthBucket = "short" | "medium" | "long";

export type RefinementTelemetryEventName =
  | "refinement_agent_message_rendered"
  | "refinement_next_action_clicked"
  | "refinement_scroll_up_after_agent"
  | "refinement_clarity_prompt_answered";

export type RefinementTelemetryPayload = {
  messageId: string;
  stageId?: string;
  mode?: "refinement" | string;
  role?: "agent" | "user" | string;
  messageLengthBucket?: RefinementMessageLengthBucket;
  renderedAt?: number;
  clickedAt?: number;
  occurred?: boolean;
  occurredAt?: number;
  scrollDeltaPx?: number;
  clarityValue?: string | number | boolean;
  answeredAt?: number;
  correlationValid?: boolean;
  qualityFlags?: string[];
};

declare global {
  interface Window {
    __AICHATFLOW_REFINEMENT_EVENTS__?: Array<{
      eventName: RefinementTelemetryEventName;
      payload: RefinementTelemetryPayload;
    }>;
  }
}

export function normalizeRefinementAgentText(content: string): string {
  return content.replace(/\\r\\n/g, "\n").replace(/\\n/g, "\n");
}

export function shouldUseRefinementPlainTextRenderer(mode: string, role: string): boolean {
  return mode === "refinement" && role === "agent";
}

export function getMessageLengthBucket(content: string): RefinementMessageLengthBucket {
  const length = normalizeRefinementAgentText(content).length;

  if (length < 280) return "short";
  if (length < 900) return "medium";
  return "long";
}

export function trackRefinementEvent(
  eventName: RefinementTelemetryEventName,
  payload: RefinementTelemetryPayload
): void {
  if (typeof window === "undefined") return;

  window.__AICHATFLOW_REFINEMENT_EVENTS__ = window.__AICHATFLOW_REFINEMENT_EVENTS__ || [];
  const payloadWithDefaults: RefinementTelemetryPayload = {
    mode: "refinement",
    role: "agent",
    correlationValid: Boolean(payload.messageId && payload.stageId),
    qualityFlags: payload.qualityFlags ?? [],
    ...payload,
  };

  window.__AICHATFLOW_REFINEMENT_EVENTS__.push({ eventName, payload: payloadWithDefaults });

  window.dispatchEvent(
    new CustomEvent("aichatflow:refinement-telemetry", {
      detail: { eventName, payload: payloadWithDefaults },
    })
  );

  if (import.meta.env.DEV) {
    console.debug("[refinement-telemetry]", eventName, payloadWithDefaults);
  }
}
