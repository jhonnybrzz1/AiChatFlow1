import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import fs from 'fs';
import path from 'path';

export class SummarizationService {
  async summarizeDocument(content: string, docType: string): Promise<Buffer> {
    // Create a new PDFDocument
    const pdfDoc = await PDFDocument.create();

    // Embed the Helvetica font
    const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const helveticaBoldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    // Add a page to the document
    const page = pdfDoc.addPage([612, 792]); // Letter size: 8.5" x 11" (612 x 792 points)

    const { width, height } = page.getSize();
    const margin = 50;

    // Draw header
    this.drawHeader(page, helveticaBoldFont, docType);

    // Draw content
    this.drawContent(page, helveticaFont, helveticaBoldFont, content);

    // Draw footer
    this.drawFooter(page, helveticaFont);

    // Serialize the PDFDocument to bytes
    const pdfBytes = await pdfDoc.save();
    return Buffer.from(pdfBytes);
  }

  private drawHeader(page: any, font: any, docType: string) {
    const { width, height } = page.getSize();

    // Draw company logo placeholder
    page.drawRectangle({
      x: 50,
      y: height - 100,
      width: 60,
      height: 60,
      color: rgb(0.95, 0.95, 0.95),
      borderColor: rgb(0.8, 0.8, 0.8),
      borderWidth: 1,
    });

    // Draw company name
    page.drawText('AICHATflow', {
      x: 120,
      y: height - 60,
      size: 24,
      font: font,
      color: rgb(0, 0, 0),
    });

    // Draw document title
    page.drawText(`${docType} Summary`, {
      x: 50,
      y: height - 120,
      size: 18,
      font: font,
      color: rgb(0.2, 0.4, 0.6),
    });

    // Draw document info
    page.drawText(`Date: ${new Date().toLocaleDateString()}`, {
      x: 50,
      y: height - 140,
      size: 12,
      font: font,
      color: rgb(0.5, 0.5, 0.5),
    });

    // Draw separator line
    page.drawLine({
      start: { x: 50, y: height - 160 },
      end: { x: width - 50, y: height - 160 },
      thickness: 1,
      color: rgb(0.8, 0.8, 0.8),
    });
  }

  private drawContent(page: any, font: any, boldFont: any, content: string) {
    const { width, height } = page.getSize();
    const margin = 50;
    const lineHeight = 14;
    let yPosition = height - 180; // Start below the header

    // Split content into lines
    const lines = content.split('\n');

    for (const line of lines) {
      if (line.trim() === '') {
        // Skip empty lines
        continue;
      }

      // Check if this is a heading (starts with #)
      if (line.trim().startsWith('#')) {
        const headingText = line.replace(/^#+\s*/, '').trim();
        page.drawText(headingText, {
          x: margin,
          y: yPosition,
          size: 16,
          font: boldFont,
          color: rgb(0.2, 0.4, 0.6),
        });
        yPosition -= 20;
      }
  // Check if this is a task item (starts with - [ ] or similar)
  else if (line.trim().match(/^- \[ \]/)) {
    const taskText = line.replace(/^- \[ \]\s*/, '').trim();
    page.drawText('• ' + taskText, {
      x: margin,
      y: yPosition,
      size: 12,
      font: font,
      color: rgb(0, 0, 0),
    });
    yPosition -= lineHeight;
  }
  // Check if this is a section header (contains 🔧 or 🎨)
  else if (line.match(/🔧|🎨/)) {
    const sectionText = line.trim();
    page.drawText(sectionText, {
      x: margin,
      y: yPosition,
      size: 14,
      font: boldFont,
      color: rgb(0.2, 0.6, 0.2),
    });
    yPosition -= 18;
  }
  else {
    // Regular text
    page.drawText(line, {
      x: margin,
      y: yPosition,
      size: 12,
      font: font,
      color: rgb(0, 0, 0),
    });
    yPosition -= lineHeight;
  }

  // Check if we need a new page
  if (yPosition < margin) {
    // Add a new page if we run out of space
    // Note: In a real implementation, we would add a new page and continue
    // For simplicity, we'll just break here
    break;
  }
}
}

private drawFooter(page: any, font: any) {
const { width, height } = page.getSize();

// Draw footer line
page.drawLine({
start: { x: 50, y: 50 },
end: { x: width - 50, y: 50 },
thickness: 1,
color: rgb(0.8, 0.8, 0.8),
});

// Draw footer text
page.drawText('AICHATflow - Confidential Document', {
x: 50,
y: 30,
size: 10,
font: font,
color: rgb(0.5, 0.5, 0.5),
});

// Draw page number
page.drawText('Page 1', {
x: width - 100,
y: 30,
size: 10,
font: font,
color: rgb(0.5, 0.5, 0.5),
});
}
}

export const summarizationService = new SummarizationService();