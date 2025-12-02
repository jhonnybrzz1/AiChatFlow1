
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import fs from 'fs';
import path from 'path';

export class PDFGenerator {
  /**
   * Remove emojis and other non-WinAnsi characters from text
   * WinAnsi (used by Helvetica) only supports basic Latin characters
   */
  private removeEmojis(text: string): string {
    // Remove emojis and other Unicode characters outside the WinAnsi range
    // WinAnsi supports characters from 0x0020 to 0x00FF
    return text.replace(/[^\x20-\x7E\xA0-\xFF]/g, '');
  }

  async generatePRDDocument(content: string, demandId: number): Promise<Buffer> {
    // Format content to follow standard PRD structure
    const formattedContent = this.formatPRDContent(content);

    // Create a new PDFDocument
    const pdfDoc = await PDFDocument.create();

    // Embed the Helvetica font
    const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const helveticaBoldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    // Draw content across multiple pages
    await this.drawMultiPageContent(pdfDoc, helveticaFont, helveticaBoldFont, formattedContent, demandId, 'Product Requirements Document (PRD)');

    // Serialize the PDFDocument to bytes
    const pdfBytes = await pdfDoc.save();
    return Buffer.from(pdfBytes);
  }

  async generateTasksDocument(content: string, demandId: number): Promise<Buffer> {
    // Format content to follow standard Tasks structure
    const formattedContent = this.formatTasksContent(content);

    // Create a new PDFDocument
    const pdfDoc = await PDFDocument.create();

    // Embed the Helvetica font
    const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const helveticaBoldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    // Draw content across multiple pages
    await this.drawMultiPageContent(pdfDoc, helveticaFont, helveticaBoldFont, formattedContent, demandId, 'Tasks');

    // Serialize the PDFDocument to bytes
    const pdfBytes = await pdfDoc.save();
    return Buffer.from(pdfBytes);
  }

  /**
   * Format content to follow standard Tasks structure
   */
  private formatTasksContent(content: string): string {
    // Check if content already has standard structure
    if (content.includes('## 1. Project Overview') || content.includes('## 2. Task Categories')) {
      return content;
    }

    // Extract summarized content if available
    const summaryMatch = content.match(/Resumo das discussões dos agentes:([\s\S]*?)Detalhes dos agentes:/);
    const summaryContent = summaryMatch ? summaryMatch[1].trim() : '';

    // Format content into standard Tasks structure
    const formattedContent = `
# Tasks Document

## 1. Project Overview

**Project Name:** [Project Name]
**Date:** ${new Date().toLocaleDateString()}
**Version:** 1.0

## 2. Task Categories

${this.extractTaskCategories(content)}

## 3. Task Priorities

${this.extractTaskPriorities(content)}

## 4. Dependencies

${this.extractSection(content, 'dependencies', 'depends on')}

## 5. Approvals

- **Project Manager:** [Name]
- **Tech Lead:** [Name]
- **Stakeholders:** [Names]

## 6. Summary of Agent Discussions

${summaryContent || 'No summary available.'}
`;

    return formattedContent.trim();
  }

  /**
   * Extract task categories from content
   */
  private extractTaskCategories(content: string): string {
    const lines = content.split('\n');
    const categories = {
      backend: [],
      frontend: [],
      qa: [],
      devops: [],
      other: []
    };

    for (const line of lines) {
      if (line.includes('Backend') || line.includes('backend')) {
        categories.backend.push(line);
      } else if (line.includes('Frontend') || line.includes('frontend')) {
        categories.frontend.push(line);
      } else if (line.includes('QA') || line.includes('qa')) {
        categories.qa.push(line);
      } else if (line.includes('DevOps') || line.includes('devops')) {
        categories.devops.push(line);
      } else if (line.trim().startsWith('-')) {
        categories.other.push(line);
      }
    }

    // Format categories
    let result = '';

    if (categories.backend.length > 0) {
      result += '### 2.1 Backend Tasks\n\n';
      result += categories.backend.map(task => `- [ ] ${task.replace(/^- \[ \]\s*/, '').trim()}`).join('\n');
    }

    if (categories.frontend.length > 0) {
      result += '\n### 2.2 Frontend Tasks\n\n';
      result += categories.frontend.map(task => `- [ ] ${task.replace(/^- \[ \]\s*/, '').trim()}`).join('\n');
    }

    if (categories.qa.length > 0) {
      result += '\n### 2.3 QA Tasks\n\n';
      result += categories.qa.map(task => `- [ ] ${task.replace(/^- \[ \]\s*/, '').trim()}`).join('\n');
    }

    if (categories.devops.length > 0) {
      result += '\n### 2.4 DevOps Tasks\n\n';
      result += categories.devops.map(task => `- [ ] ${task.replace(/^- \[ \]\s*/, '').trim()}`).join('\n');
    }

    if (categories.other.length > 0) {
      result += '\n### 2.5 Other Tasks\n\n';
      result += categories.other.map(task => `- [ ] ${task.replace(/^- \[ \]\s*/, '').trim()}`).join('\n');
    }

    return result || '- [No tasks provided]';
  }

  /**
   * Extract task priorities from content
   */
  private extractTaskPriorities(content: string): string {
    const lines = content.split('\n');
    const priorities = [];

    for (const line of lines) {
      if (line.includes('priority') || line.includes('Priority')) {
        priorities.push(line);
      }
    }

    if (priorities.length > 0) {
      return priorities.join('\n');
    }

    return `| Task ID | Task Name | Priority | Assigned To | Due Date | Status |
|--------|-----------|----------|-------------|----------|--------|
| T1 | Implement main API | High | [Developer] | [Date] | Not Started |
| T2 | Design UI | Medium | [Designer] | [Date] | Not Started |
| T3 | Write tests | High | [QA] | [Date] | Not Started |`;
  }

  /**
   * Format content to follow standard PRD structure
   */
  private formatPRDContent(content: string): string {
    // Check if content already has standard structure
    if (content.includes('## 1. Visão Geral') || content.includes('## 2. Requisitos Funcionais')) {
      return content;
    }

    // Extract summarized content if available
    const summaryMatch = content.match(/Resumo das discussões dos agentes:([\s\S]*?)Detalhes dos agentes:/);
    const summaryContent = summaryMatch ? summaryMatch[1].trim() : '';

    // Format content into standard PRD structure
    const formattedContent = `
# Product Requirements Document (PRD)

## 1. Visão Geral

${this.extractSection(content, 'overview', 'objectives', 'scope')}

## 2. Requisitos Funcionais

${this.extractSection(content, 'functional requirements', 'features', 'user flows')}

## 3. Requisitos Não Funcionais

${this.extractSection(content, 'non-functional requirements', 'performance', 'security', 'usability')}

## 4. Critérios de Aceitação

${this.extractSection(content, 'acceptance criteria', 'success metrics')}

## 5. Dependências e Riscos

${this.extractSection(content, 'dependencies', 'risks')}

## 6. Cronograma

${this.extractSection(content, 'timeline', 'schedule', 'milestones')}

## 7. Aprovações

${this.extractSection(content, 'approvals', 'stakeholders')}

## 8. Resumo das Discussões dos Agentes

${summaryContent || 'Nenhum resumo disponível.'}
`;

    return formattedContent.trim();
  }

  /**
   * Extract section content based on keywords
   */
  private extractSection(content: string, ...keywords: string[]): string {
    const lines = content.toLowerCase().split('\n');
    const resultLines = [];

    for (const line of lines) {
      if (keywords.some(keyword => line.includes(keyword))) {
        resultLines.push(line);
      }
    }

    return resultLines.length > 0 ? resultLines.join('\n') : '- [Content not provided]';
  }

  /**
   * Draw content across multiple pages
   */
  private async drawMultiPageContent(
    pdfDoc: any,
    font: any,
    boldFont: any,
    content: string,
    demandId: number,
    docType: string
  ): Promise<void> {
    const pageWidth = 612;
    const pageHeight = 792;
    const margin = 50;
    const maxWidth = pageWidth - (margin * 2);
    const lineHeight = 14;
    const headerHeight = 180;
    const footerHeight = 70;
    const contentAreaHeight = pageHeight - headerHeight - footerHeight;

    // Remove emojis from content
    const cleanContent = this.removeEmojis(content);
    const lines = cleanContent.split('\n');

    // Create first page
    let currentPage = pdfDoc.addPage([pageWidth, pageHeight]);
    let pageNumber = 1;
    this.drawHeader(currentPage, boldFont, demandId, docType);
    let yPosition = pageHeight - headerHeight;

    for (const line of lines) {
      if (line.trim() === '') {
        yPosition -= 8;
        continue;
      }

      let wrappedLines: string[] = [];
      let fontSize = 12;
      let currentFont = font;
      let color = rgb(0, 0, 0);
      let indent = 0;

      // Check line type and set properties
      if (line.trim().startsWith('#')) {
        const headingText = line.replace(/^#+\s*/, '').trim();
        wrappedLines = this.wrapText(headingText, maxWidth, boldFont, 16);
        fontSize = 16;
        currentFont = boldFont;
        color = rgb(0.2, 0.4, 0.6);
      } else if (line.trim().match(/^- \[ \]/)) {
        const taskText = line.replace(/^- \[ \]\s*/, '').trim();
        wrappedLines = this.wrapText('• ' + taskText, maxWidth - 20, font, 12);
        indent = 10;
      } else if (line.trim().startsWith('-')) {
        const listText = line.replace(/^-\s*/, '').trim();
        wrappedLines = this.wrapText('• ' + listText, maxWidth - 20, font, 12);
        indent = 10;
      } else {
        wrappedLines = this.wrapText(line, maxWidth, font, 12);
      }

      // Draw each wrapped line
      for (const wrappedLine of wrappedLines) {
        // Check if we need a new page
        if (yPosition < footerHeight + 20) {
          // Draw footer on current page
          this.drawFooter(currentPage, font, pageNumber);

          // Create new page
          pageNumber++;
          currentPage = pdfDoc.addPage([pageWidth, pageHeight]);
          this.drawHeader(currentPage, boldFont, demandId, docType);
          yPosition = pageHeight - headerHeight;
        }

        // Draw the line
        currentPage.drawText(wrappedLine, {
          x: margin + indent,
          y: yPosition,
          size: fontSize,
          font: currentFont,
          color: color,
        });

        yPosition -= (fontSize === 16 ? 20 : lineHeight);
      }
    }

    // Draw footer on last page
    this.drawFooter(currentPage, font, pageNumber);
  }

  private drawHeader(page: any, font: any, demandId: number, docType: string = 'PRD') {
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
    page.drawText(`${docType} Document`, {
      x: 50,
      y: height - 120,
      size: 18,
      font: font,
      color: rgb(0.2, 0.4, 0.6),
    });

    // Draw document info
    page.drawText(`Demand ID: ${demandId}`, {
      x: 50,
      y: height - 140,
      size: 12,
      font: font,
      color: rgb(0.5, 0.5, 0.5),
    });

    page.drawText(`Date: ${new Date().toLocaleDateString()}`, {
      x: 50,
      y: height - 160,
      size: 12,
      font: font,
      color: rgb(0.5, 0.5, 0.5),
    });

    // Draw separator line
    page.drawLine({
      start: { x: 50, y: height - 180 },
      end: { x: width - 50, y: height - 180 },
      thickness: 1,
      color: rgb(0.8, 0.8, 0.8),
    });
  }

  private drawContent(page: any, font: any, boldFont: any, content: string) {
    const { width, height } = page.getSize();
    const margin = 50;
    const maxWidth = width - (margin * 2);
    const lineHeight = 14;
    let yPosition = height - 200; // Start below the header

    // Remove emojis from content before processing
    const cleanContent = this.removeEmojis(content);

    // Split content into lines
    const lines = cleanContent.split('\n');

    for (const line of lines) {
      if (line.trim() === '') {
        // Add space for empty lines
        yPosition -= 8;
        continue;
      }

      // Check if this is a heading (starts with #)
      if (line.trim().startsWith('#')) {
        const headingText = line.replace(/^#+\s*/, '').trim();
        const wrappedLines = this.wrapText(headingText, maxWidth, boldFont, 16);

        for (const wrappedLine of wrappedLines) {
          if (yPosition < margin + 50) break;

          page.drawText(wrappedLine, {
            x: margin,
            y: yPosition,
            size: 16,
            font: boldFont,
            color: rgb(0.2, 0.4, 0.6),
          });
          yPosition -= 20;
        }
      }
      // Check if this is a task item (starts with - [ ] or similar)
      else if (line.trim().match(/^- \[ \]/)) {
        const taskText = line.replace(/^- \[ \]\s*/, '').trim();
        const wrappedLines = this.wrapText('• ' + taskText, maxWidth - 20, font, 12);

        for (const wrappedLine of wrappedLines) {
          if (yPosition < margin + 50) break;

          page.drawText(wrappedLine, {
            x: margin + 10,
            y: yPosition,
            size: 12,
            font: font,
            color: rgb(0, 0, 0),
          });
          yPosition -= lineHeight;
        }
      }
      // Check if this is a list item (starts with -)
      else if (line.trim().startsWith('-')) {
        const listText = line.replace(/^-\s*/, '').trim();
        const wrappedLines = this.wrapText('• ' + listText, maxWidth - 20, font, 12);

        for (const wrappedLine of wrappedLines) {
          if (yPosition < margin + 50) break;

          page.drawText(wrappedLine, {
            x: margin + 10,
            y: yPosition,
            size: 12,
            font: font,
            color: rgb(0, 0, 0),
          });
          yPosition -= lineHeight;
        }
      }
      else {
        // Regular text - wrap if needed
        const wrappedLines = this.wrapText(line, maxWidth, font, 12);

        for (const wrappedLine of wrappedLines) {
          if (yPosition < margin + 50) break;

          page.drawText(wrappedLine, {
            x: margin,
            y: yPosition,
            size: 12,
            font: font,
            color: rgb(0, 0, 0),
          });
          yPosition -= lineHeight;
        }
      }

      // Check if we need a new page
      if (yPosition < margin + 50) {
        // For now, just break - in production, would add new pages
        break;
      }
    }
  }

  /**
   * Wrap text to fit within a specific width
   */
  private wrapText(text: string, maxWidth: number, font: any, fontSize: number): string[] {
    const words = text.split(' ');
    const lines: string[] = [];
    let currentLine = '';

    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      const testWidth = font.widthOfTextAtSize(testLine, fontSize);

      if (testWidth > maxWidth && currentLine) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }

    if (currentLine) {
      lines.push(currentLine);
    }

    return lines.length > 0 ? lines : [''];
  }

  private drawFooter(page: any, font: any, pageNumber: number = 1) {
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
    page.drawText(`Page ${pageNumber}`, {
      x: width - 100,
      y: 30,
      size: 10,
      font: font,
      color: rgb(0.5, 0.5, 0.5),
    });
  }
}

export const pdfGenerator = new PDFGenerator();
