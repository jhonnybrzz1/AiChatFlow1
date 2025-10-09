
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import fs from 'fs';
import path from 'path';

export class PDFGenerator {
  async generatePRDDocument(content: string, demandId: number): Promise<Buffer> {
    // Format content to follow standard PRD structure
    const formattedContent = this.formatPRDContent(content);

    // Create a new PDFDocument
    const pdfDoc = await PDFDocument.create();

    // Embed the Helvetica font
    const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const helveticaBoldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    // Add a page to the document
    const page = pdfDoc.addPage([612, 792]); // Letter size: 8.5" x 11" (612 x 792 points)

    // Draw header
    this.drawHeader(page, helveticaBoldFont, demandId, 'Product Requirements Document (PRD)');

    // Draw content
    this.drawContent(page, helveticaFont, helveticaBoldFont, formattedContent);

    // Draw footer
    this.drawFooter(page, helveticaFont);

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

    // Add a page to the document
    const page = pdfDoc.addPage([612, 792]); // Letter size: 8.5" x 11" (612 x 792 points)

    // Draw header
    this.drawHeader(page, helveticaBoldFont, demandId, 'Tasks');

    // Draw content
    this.drawContent(page, helveticaFont, helveticaBoldFont, formattedContent);

    // Draw footer
    this.drawFooter(page, helveticaFont);

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
    const lineHeight = 14;
    let yPosition = height - 200; // Start below the header

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

export const pdfGenerator = new PDFGenerator();
