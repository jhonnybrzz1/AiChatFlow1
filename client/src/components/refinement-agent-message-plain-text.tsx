import { useEffect, useMemo } from "react";
import {
  getMessageLengthBucket,
  normalizeRefinementAgentText,
  parseRefinementAgentText,
  shouldUseRefinementPlainTextRenderer,
  trackRefinementEvent,
} from "@/lib/refinement-telemetry";
import { cn } from "@/lib/utils";

const renderedMessages = new Set<string>();

interface RefinementAgentMessagePlainTextProps {
  messageId: string;
  content: string;
  stageId?: string;
  mode?: "refinement";
  role?: "agent";
  timestampRendered?: number;
}

interface RefinementAgentMessageContentProps {
  content: string;
  className?: string;
}

export function RefinementAgentMessageContent({
  content,
  className,
}: RefinementAgentMessageContentProps) {
  const blocks = useMemo(() => parseRefinementAgentText(content), [content]);

  return (
    <div className={cn("refinement-agent-message-content", className)}>
      {blocks.map((block, blockIndex) => {
        if (block.type === "list") {
          return (
            <ul key={`list-${blockIndex}`} className="refinement-agent-list">
              {block.items.map((item, itemIndex) => (
                <li key={`${blockIndex}-${itemIndex}`}>{item}</li>
              ))}
            </ul>
          );
        }

        return (
          <p key={`paragraph-${blockIndex}`} className="refinement-agent-paragraph">
            {block.text}
          </p>
        );
      })}
    </div>
  );
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
      <RefinementAgentMessageContent
        content={normalizedContent}
        className="font-mono text-sm text-[var(--foreground)] leading-relaxed"
      />
    </div>
  );
}
