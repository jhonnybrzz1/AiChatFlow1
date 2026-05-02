import { useEffect, useMemo } from "react";
import {
  getMessageLengthBucket,
  normalizeRefinementAgentText,
  shouldUseRefinementPlainTextRenderer,
  trackRefinementEvent,
} from "@/lib/refinement-telemetry";

const renderedMessages = new Set<string>();

interface RefinementAgentMessagePlainTextProps {
  messageId: string;
  content: string;
  stageId?: string;
  mode?: "refinement";
  role?: "agent";
  timestampRendered?: number;
}

export function RefinementAgentMessagePlainText({
  messageId,
  content,
  stageId,
  mode = "refinement",
  role = "agent",
  timestampRendered,
}: RefinementAgentMessagePlainTextProps) {
  const shouldRenderPlainText = shouldUseRefinementPlainTextRenderer(mode, role);
  const normalizedContent = useMemo(() => normalizeRefinementAgentText(content), [content]);
  const messageLengthBucket = useMemo(
    () => getMessageLengthBucket(normalizedContent),
    [normalizedContent]
  );

  useEffect(() => {
    if (!shouldRenderPlainText) return;
    if (renderedMessages.has(messageId)) return;
    renderedMessages.add(messageId);

    trackRefinementEvent("refinement_agent_message_rendered", {
      messageId,
      stageId,
      mode,
      role,
      messageLengthBucket,
      renderedAt: timestampRendered ?? Date.now(),
      qualityFlags: stageId ? [] : ["missing_stage_id"],
    });
  }, [messageId, messageLengthBucket, mode, role, shouldRenderPlainText, stageId, timestampRendered]);

  if (!shouldRenderPlainText) {
    return <>{content}</>;
  }

  return (
    <div
      className="refinement-agent-message-plain-text"
      data-renderer="plain-text"
      data-message-id={messageId}
      data-stage-id={stageId}
      style={{
        whiteSpace: "pre-wrap",
        overflowWrap: "anywhere",
        wordBreak: "break-word",
        margin: 0,
      }}
    >
      <div className="font-mono text-[10px] font-bold uppercase tracking-normal text-[var(--foreground-muted)] mb-2">
        Orientação do agente
      </div>
      <div className="font-mono text-sm text-[var(--foreground)] leading-relaxed">
        {normalizedContent}
      </div>
    </div>
  );
}
