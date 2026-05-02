import { describe, expect, it } from "vitest";
import { PDFGenerator } from "../server/services/pdf-generator";

describe("professional PRD PDF layout helpers", () => {
  const generator = new PDFGenerator() as any;

  const fakeFont = {
    widthOfTextAtSize: (text: string, size: number) => text.length * size * 0.55,
  };

  it("wraps long text using font metrics instead of fixed character counts", () => {
    const lines = generator.wrapTextByFontMetrics(
      "Este texto precisa quebrar em varias linhas para preservar legibilidade no PDF profissional.",
      150,
      fakeFont,
      10
    );

    expect(lines.length).toBeGreaterThan(1);
    expect(lines.every((line: string) => fakeFont.widthOfTextAtSize(line, 10) <= 150)).toBe(true);
  });

  it("breaks long unspaced words to avoid horizontal overflow", () => {
    const lines = generator.wrapTextByFontMetrics("x".repeat(220), 100, fakeFont, 10);

    expect(lines.length).toBeGreaterThan(1);
    expect(lines.every((line: string) => fakeFont.widthOfTextAtSize(line, 10) <= 100)).toBe(true);
  });

  it("preserves ordered-list numbers as prefixes while removing markdown from content", () => {
    const style = generator.getProfessionalLineStyle("12. **Validar aceite**", fakeFont, fakeFont);
    const text = generator.getProfessionalLineText("12. **Validar aceite**", style.prefix);

    expect(style.prefix).toBe("12. ");
    expect(text).toBe("Validar aceite");
  });

  it("uses professional styling for second-level PRD headings", () => {
    const style = generator.getProfessionalLineStyle("## Métricas de Sucesso", fakeFont, fakeFont);

    expect(style.drawRule).toBe(true);
    expect(style.afterGap).toBeGreaterThan(0);
    expect(style.fontSize).toBeGreaterThan(12);
  });
});
