import { describe, expect, it } from "vitest";
import {
  getMessageLengthBucket,
  normalizeRefinementAgentText,
  shouldUseRefinementPlainTextRenderer,
} from "../client/src/lib/refinement-telemetry";

describe("refinement plain text helpers", () => {
  it("converts literal newline tokens into visible line breaks", () => {
    expect(normalizeRefinementAgentText("Passo 1\\nPasso 2")).toBe("Passo 1\nPasso 2");
    expect(normalizeRefinementAgentText("Passo 1\\r\\nPasso 2")).toBe("Passo 1\nPasso 2");
  });

  it("keeps markdown tokens as literal text", () => {
    const content = "**obrigatorio**\\n- Primeiro\\n1. Faca X\\n```\\ncode\\n```\\n[ver](url)";

    expect(normalizeRefinementAgentText(content)).toContain("**obrigatorio**");
    expect(normalizeRefinementAgentText(content)).toContain("- Primeiro");
    expect(normalizeRefinementAgentText(content)).toContain("```");
    expect(normalizeRefinementAgentText(content)).toContain("[ver](url)");
  });

  it("classifies message length buckets deterministically", () => {
    expect(getMessageLengthBucket("curta")).toBe("short");
    expect(getMessageLengthBucket("m".repeat(400))).toBe("medium");
    expect(getMessageLengthBucket("l".repeat(1200))).toBe("long");
  });

  it("gates literal rendering to refinement agent messages only", () => {
    expect(shouldUseRefinementPlainTextRenderer("refinement", "agent")).toBe(true);
    expect(shouldUseRefinementPlainTextRenderer("refinement", "user")).toBe(false);
    expect(shouldUseRefinementPlainTextRenderer("general", "agent")).toBe(false);
  });
});
