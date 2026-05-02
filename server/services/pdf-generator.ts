import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import fs from 'fs';
import path from 'path';
import { validatePRDDocument, validateTasksDocument, formatValidationErrors, type ValidationResult } from '../utils/validateDocuments';
import { validatePRD as validatePRDSchema, validateTasksDocument as validateTasksSchema, formatValidationErrors as formatZodErrors } from '../../shared/document-schemas';

export class PDFGenerator {
  private readonly professionalLayout = {
    pageWidth: 612,
    pageHeight: 792,
    marginX: 54,
    headerHeight: 116,
    footerHeight: 58,
    bodyFontSize: 10.5,
    bodyLineHeight: 15,
    sectionGap: 12,
    paragraphGap: 5,
    bulletIndent: 14,
    primaryColor: rgb(0.08, 0.18, 0.31),
    accentColor: rgb(0.0, 0.45, 0.62),
    mutedColor: rgb(0.38, 0.43, 0.5),
    bodyColor: rgb(0.1, 0.1, 0.1),
    borderColor: rgb(0.82, 0.85, 0.88),
    headerFill: rgb(0.96, 0.98, 0.99),
  };

  /**
   * Extrai dados estruturados de um documento PRD em Markdown
   * para validação com schema Zod
   */
  private extractPRDDataFromMarkdown(content: string): any {
    const data: any = {
      title: '',
      overview: { objective: '', problem: '', solution: '' },
      functionalRequirements: [],
      nonFunctionalRequirements: [],
      scope: { inScope: [], outOfScope: [] },
      acceptanceCriteria: [],
      dependencies: { internal: [], external: [] },
      risks: [],
      metrics: { primary: [], secondary: [] },
      timeline: { mvpDate: '', phases: [] },
      version: '1.0.0',
    };

    // Extrai título
    const titleMatch = content.match(/^#\s+PRD\s*-\s*(.+)$/m);
    console.log('[PDF-GENERATOR-DEBUG] titleMatch:', titleMatch);
    if (titleMatch) data.title = titleMatch[1].trim();

    // Extrai versão
    const versionMatch = content.match(/\*\*Versão:\*\*\s*\[?(\d+\.\d+\.\d+)\]?/);
    console.log('[PDF-GENERATOR-DEBUG] versionMatch:', versionMatch);
    if (versionMatch) data.version = versionMatch[1];
    
    // Extrai overview
    const overviewObjectiveMatch = content.match(/## 📋 Visão Geral\n\n\*\*Objetivo:\*\*\s*([^\n]+)/m);
    console.log('[PDF-GENERATOR-DEBUG] overviewObjectiveMatch:', overviewObjectiveMatch);
    if (overviewObjectiveMatch) data.overview.objective = overviewObjectiveMatch[1].trim();
    const overviewProblemMatch = content.match(/\*\*Problema:\*\*\s*([^\n]+)/m);
    console.log('[PDF-GENERATOR-DEBUG] overviewProblemMatch:', overviewProblemMatch);
    if (overviewProblemMatch) data.overview.problem = overviewProblemMatch[1].trim();
    const overviewSolutionMatch = content.match(/\*\*Solução:\*\*\s*([^\n]+)/m);
    console.log('[PDF-GENERATOR-DEBUG] overviewSolutionMatch:', overviewSolutionMatch);
    if (overviewSolutionMatch) data.overview.solution = overviewSolutionMatch[1].trim();

    // Extrai functional requirements
    const functionalRequirementsMatch = content.match(/## 🎯 Requisitos Funcionais([\s\S]*?)##/m);
    console.log('[PDF-GENERATOR-DEBUG] functionalRequirementsMatch:', functionalRequirementsMatch);
    if (functionalRequirementsMatch) {
      const requirements = functionalRequirementsMatch[1].match(/- RF\d+:[\s\S]*?(?=- RF\d+:|##|$)/g);
      console.log('[PDF-GENERATOR-DEBUG] functionalRequirements:', requirements);
      if (requirements) {
        data.functionalRequirements = requirements.map(req => ({
          id: req.match(/- RF(\d+):/)?.[1] || '',
          description: req.match(/\*\*Descrição:\*\*\s*([^\n]+)/)?.[1].trim() || '',
          acceptanceCriteria: req.match(/\*\*Critérios de Aceite:\*\*\s*([\s\S]*?)(?=\*\*Prioridade|$)/)?.[1].trim() || '',
          priority: req.match(/\*\*Prioridade:\*\*\s*([^\n]+)/)?.[1].trim() || '',
        }));
      }
    }

    // Extrai non-functional requirements
    const nonFunctionalRequirementsMatch = content.match(/## 🛠️ Requisitos Não Funcionais([\s\S]*?)##/m);
    console.log('[PDF-GENERATOR-DEBUG] nonFunctionalRequirementsMatch:', nonFunctionalRequirementsMatch);
    if (nonFunctionalRequirementsMatch) {
      const requirements = nonFunctionalRequirementsMatch[1].match(/- RNF\d+:[\s\S]*?(?=- RNF\d+:|##|$)/g);
      console.log('[PDF-GENERATOR-DEBUG] nonFunctionalRequirements:', requirements);
      if (requirements) {
        data.nonFunctionalRequirements = requirements.map(req => ({
          id: req.match(/- RNF(\d+):/)?.[1] || '',
          description: req.match(/\*\*Descrição:\*\*\s*([^\n]+)/)?.[1].trim() || '',
          metric: req.match(/\*\*Métrica:\*\*\s*([^\n]+)/)?.[1].trim() || '',
        }));
      }
    }

    // Extrai scope
    const inScopeMatch = content.match(/### In Scope([\s\S]*?)###/m);
    console.log('[PDF-GENERATOR-DEBUG] inScopeMatch:', inScopeMatch);
    if (inScopeMatch) {
      data.scope.inScope = inScopeMatch[1].match(/- [^\n]+/g)?.map(item => item.replace(/- /, '').trim()) || [];
    }
    const outOfScopeMatch = content.match(/### Out of Scope([\s\S]*?)##/m);
    console.log('[PDF-GENERATOR-DEBUG] outOfScopeMatch:', outOfScopeMatch);
    if (outOfScopeMatch) {
      data.scope.outOfScope = outOfScopeMatch[1].match(/- [^\n]+/g)?.map(item => item.replace(/- /, '').trim()) || [];
    }

    // Extrai acceptance criteria
    const acceptanceCriteriaMatch = content.match(/## ✅ Critérios de Aceitação Gerais([\s\S]*?)##/m);
    console.log('[PDF-GENERATOR-DEBUG] acceptanceCriteriaMatch:', acceptanceCriteriaMatch);
    if (acceptanceCriteriaMatch) {
      data.acceptanceCriteria = acceptanceCriteriaMatch[1].match(/- [^\n]+/g)?.map(item => item.replace(/- /, '').trim()) || [];
    }
    
    // Extrai risks
    const risksMatch = content.match(/## ⚠️ Riscos e Mitigações([\s\S]*?)##/m);
    console.log('[PDF-GENERATOR-DEBUG] risksMatch:', risksMatch);
    if (risksMatch) {
        data.risks = risksMatch[1].match(/- \*\*Risco \d+:\*\*[\s\S]*?(?=- \*\*Risco \d+:|##|$)/g)?.map(risk => ({
            description: risk.match(/- \*\*Risco \d+:\*\*\s*([^\n]+)/)?.[1].trim() || '',
            impact: risk.match(/\*\*Impacto:\*\*\s*([^\n]+)/)?.[1].trim() || '',
            probability: risk.match(/\*\*Probabilidade:\*\*\s*([^\n]+)/)?.[1].trim() || '',
            mitigation: risk.match(/\*\*Mitigação:\*\*\s*([^\n]+)/)?.[1].trim() || '',
        })) || [];
    }

    // Extrai metrics
    const primaryMetricsMatch = content.match(/### KPIs Primários([\s\S]*?)###/m);
    console.log('[PDF-GENERATOR-DEBUG] primaryMetricsMatch:', primaryMetricsMatch);
    if (primaryMetricsMatch) {
      data.metrics.primary = primaryMetricsMatch[1].match(/- [^\n]+/g)?.map(item => item.replace(/- /, '').trim()) || [];
    }
    const secondaryMetricsMatch = content.match(/### KPIs Secundários([\s\S]*?)##/m);
    console.log('[PDF-GENERATOR-DEBUG] secondaryMetricsMatch:', secondaryMetricsMatch);
    if (secondaryMetricsMatch) {
      data.metrics.secondary = secondaryMetricsMatch[1].match(/- [^\n]+/g)?.map(item => item.replace(/- /, '').trim()) || [];
    }
    
    // Extrai timeline
    const timelineMatch = content.match(/## 📅 Cronograma Estimado([\s\S]*?)##/m);
    console.log('[PDF-GENERATOR-DEBUG] timelineMatch:', timelineMatch);
    if (timelineMatch) {
        data.timeline.mvpDate = timelineMatch[1].match(/\*\*Data de Lançamento \(MVP\):\*\*\s*([^\n]+)/)?.[1].trim() || '';
    }


    // Log para debugging
    console.log('[PDF-GENERATOR] Extracted PRD data for validation:', {
      title: data.title,
      version: data.version,
      hasTitle: !!data.title,
      contentLength: content.length,
      overview: data.overview,
      functionalRequirements: data.functionalRequirements,
      nonFunctionalRequirements: data.nonFunctionalRequirements,
      scope: data.scope,
      acceptanceCriteria: data.acceptanceCriteria,
      risks: data.risks,
      metrics: data.metrics,
      timeline: data.timeline,
    });

    return data;
  }

  /**
   * Extrai dados estruturados de um documento Tasks em Markdown
   * para validação com schema Zod
   */
    private extractTasksDataFromMarkdown(content: string): any {
      const data: any = {
        title: '',
        metadata: {
          priority: 'Média',
          responsible: '@unknown-team',
          status: 'Não Iniciado',
          version: '1.0.0',
        },
        tasks: [],
        successMetrics: [],
      };
  
      // Extrai título
      const titleMatch = content.match(/^#\s+Tasks Document\s*-\s*(.+)$/m);
      console.log('[PDF-GENERATOR-DEBUG] titleMatch:', titleMatch);
      if (titleMatch) data.title = titleMatch[1].trim();
  
      // Extrai versão
      const versionMatch = content.match(/\*\*Versão:\*\*\s*\[?(\d+\.\d+\.\d+)\]?/);
      console.log('[PDF-GENERATOR-DEBUG] versionMatch:', versionMatch);
      if (versionMatch) data.metadata.version = versionMatch[1];
  
      // Extrai metadata
      const priorityMatch = content.match(/\*\*Prioridade:\*\*\s*([^\n]+)/m);
      console.log('[PDF-GENERATOR-DEBUG] priorityMatch:', priorityMatch);
      if (priorityMatch) data.metadata.priority = priorityMatch[1].trim();
      const responsibleMatch = content.match(/\*\*Responsável:\*\*\s*([^\n]+)/m);
      console.log('[PDF-GENERATOR-DEBUG] responsibleMatch:', responsibleMatch);
      if (responsibleMatch) data.metadata.responsible = responsibleMatch[1].trim();
      const statusMatch = content.match(/\*\*Status:\*\*\s*([^\n]+)/m);
      console.log('[PDF-GENERATOR-DEBUG] statusMatch:', statusMatch);
      if (statusMatch) data.metadata.status = statusMatch[1].trim();
      
      // Extrai tasks
      const tasksMatch = content.match(/## Tarefas([\s\S]*?)##/m);
      console.log('[PDF-GENERATOR-DEBUG] tasksMatch:', tasksMatch);
      if (tasksMatch) {
          data.tasks = tasksMatch[1].match(/- \*\*T\d+:\*\*[\s\S]*?(?=- \*\*T\d+:|##|$)/g)?.map(task => ({
              id: task.match(/- \*\*T(\d+):\*\*/)?.[1] || '',
              description: task.match(/- \*\*T\d+:\*\*\s*([^\n]+)/)?.[1].trim() || '',
              acceptanceCriteria: task.match(/Critérios de aceite:\s*([\s\S]*?)(?=\*\*Dependências|\*\*Vinculado|$)/)?.[1].trim() || '',
              dependencies: task.match(/\*\*Dependências:\*\*\s*([^\n]+)/)?.[1].trim() || '',
              linkedToPRD: task.match(/\*\*Vinculado ao PRD:\*\*\s*([^\n]+)/)?.[1].trim() || '',
          })) || [];
      }
      
      // Extrai success metrics
      const successMetricsMatch = content.match(/## Métricas de Sucesso([\s\S]*?)##/m);
      console.log('[PDF-GENERATOR-DEBUG] successMetricsMatch:', successMetricsMatch);
      if (successMetricsMatch) {
          data.successMetrics = successMetricsMatch[1].match(/- [^\n]+/g)?.map(item => item.replace(/- /, '').trim()) || [];
      }
  
      // Log para debugging
      console.log('[PDF-GENERATOR] Extracted Tasks data for validation:', {
        title: data.title,
        metadata: data.metadata,
        tasks: data.tasks,
        successMetrics: data.successMetrics,
        contentLength: content.length
      });
  
      return data;
    }

  /**
   * Remove emojis and other non-WinAnsi characters from text
   * WinAnsi (used by Helvetica) only supports basic Latin characters
   */
  private removeEmojis(text: string): string {
    // Preserve whitespace controls used for layout while removing glyphs
    // that Helvetica/WinAnsi cannot encode safely.
    return text
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .replace(/[^\x09\x0A\x0D\x20-\x7E\xA0-\xFF]/g, '');
  }

  private hasMarkdownHeadings(content: string): boolean {
    return (content.match(/^##\s+/gm)?.length || 0) >= 2;
  }

  private isBusinessPRDContent(content: string): boolean {
    const normalized = content.toLowerCase();
    const businessSections = [
      '## resumo executivo',
      '## contexto e problema',
      '## publico impactado',
      '## público impactado',
      '## objetivos de negocio',
      '## objetivos de negócio',
      '## escopo da entrega',
      '## experiencia esperada',
      '## experiência esperada',
      '## metricas de sucesso',
      '## métricas de sucesso'
    ];

    return businessSections.some(section => normalized.includes(section));
  }

  private stripMarkdownForPdf(text: string): string {
    return text
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1 ($2)')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/__([^_]+)__/g, '$1')
      .replace(/\*([^*]+)\*/g, '$1')
      .replace(/_([^_]+)_/g, '$1')
      .replace(/^\s*>\s?/, '')
      .trim();
  }

  async generatePRDDocument(content: string, demandId: number): Promise<Buffer> {
    console.log('[PDF-GENERATOR] Starting PRD document generation', {
      demandId,
      contentLength: content.length,
      timestamp: new Date().toISOString()
    });

    // FASE 1: Validação de estrutura Markdown (validação existente)
    const markdownValidation = validatePRDDocument(content);

    if (!markdownValidation.isValid) {
      console.error('[PDF-GENERATOR] PRD Markdown validation failed:', {
        demandId,
        errors: markdownValidation.errors,
        timestamp: new Date().toISOString()
      });
      console.error(formatValidationErrors(markdownValidation, 'PRD'));
    }

    if (markdownValidation.warnings.length > 0) {
      console.warn('[PDF-GENERATOR] PRD Markdown validation warnings:', {
        demandId,
        warnings: markdownValidation.warnings,
        timestamp: new Date().toISOString()
      });
    }

    // FASE 2: Validação de schema Zod legado (somente para PRD técnico RF/RNF)
    if (!this.isBusinessPRDContent(content)) {
      try {
        const extractedData = this.extractPRDDataFromMarkdown(content);
        const schemaValidation = validatePRDSchema(extractedData);

        if (!schemaValidation.success && schemaValidation.errors) {
          const formattedErrors = formatZodErrors(schemaValidation.errors);
          console.error('[PDF-GENERATOR] PRD Zod schema validation failed:', {
            demandId,
            errors: formattedErrors,
            timestamp: new Date().toISOString()
          });

          // Log cada erro individualmente para facilitar debugging
          formattedErrors.forEach((error, index) => {
            console.error(`[PDF-GENERATOR] PRD Schema Error ${index + 1}: ${error}`);
          });
        } else {
          console.log('[PDF-GENERATOR] PRD Zod schema validation passed', {
            demandId,
            timestamp: new Date().toISOString()
          });
        }
      } catch (error) {
        console.error('[PDF-GENERATOR] Error during Zod validation:', {
          demandId,
          error: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString()
        });
      }
    } else {
      console.log('[PDF-GENERATOR] Business PRD detected; skipping legacy RF/RNF schema validation', {
        demandId,
        timestamp: new Date().toISOString()
      });
    }

    // Format content to follow standard PRD structure
    const formattedContent = this.formatPRDContent(content);

    // Create a new PDFDocument
    const pdfDoc = await PDFDocument.create();

    // Embed the Helvetica font
    const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const helveticaBoldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    // Draw PRD with the professional layout contract. This changes presentation
    // only: content order and text are preserved from formattedContent.
    await this.drawProfessionalPRDContent(pdfDoc, helveticaFont, helveticaBoldFont, formattedContent, demandId);

    // Serialize the PDFDocument to bytes
    const pdfBytes = await pdfDoc.save();
    return Buffer.from(pdfBytes);
  }

  async generateTasksDocument(content: string, demandId: number): Promise<Buffer> {
    console.log('[PDF-GENERATOR] Starting Tasks document generation', {
      demandId,
      contentLength: content.length,
      timestamp: new Date().toISOString()
    });

    // FASE 1: Validação de estrutura Markdown (validação existente)
    const markdownValidation = validateTasksDocument(content);

    if (!markdownValidation.isValid) {
      console.error('[PDF-GENERATOR] Tasks Markdown validation failed:', {
        demandId,
        errors: markdownValidation.errors,
        timestamp: new Date().toISOString()
      });
      console.error(formatValidationErrors(markdownValidation, 'Tasks'));
    }

    if (markdownValidation.warnings.length > 0) {
      console.warn('[PDF-GENERATOR] Tasks Markdown validation warnings:', {
        demandId,
        warnings: markdownValidation.warnings,
        timestamp: new Date().toISOString()
      });
    }

    // FASE 2: Validação de schema Zod (nova validação estrutural)
    try {
      const extractedData = this.extractTasksDataFromMarkdown(content);
      const schemaValidation = validateTasksSchema(extractedData);

      if (!schemaValidation.success && schemaValidation.errors) {
        const formattedErrors = formatZodErrors(schemaValidation.errors);
        console.error('[PDF-GENERATOR] Tasks Zod schema validation failed:', {
          demandId,
          errors: formattedErrors,
          timestamp: new Date().toISOString()
        });

        // Log cada erro individualmente para facilitar debugging
        formattedErrors.forEach((error, index) => {
          console.error(`[PDF-GENERATOR] Tasks Schema Error ${index + 1}: ${error}`);
        });
      } else {
        console.log('[PDF-GENERATOR] Tasks Zod schema validation passed', {
          demandId,
          timestamp: new Date().toISOString()
        });
      }
    } catch (error) {
      console.error('[PDF-GENERATOR] Error during Zod validation:', {
        demandId,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      });
    }

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
    if (
      content.includes('## 1. Project Overview') ||
      content.includes('## 2. Task Categories') ||
      content.includes('## Tarefas') ||
      this.hasMarkdownHeadings(content)
    ) {
      return content.trim();
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
    const categories: {
      backend: string[];
      frontend: string[];
      qa: string[];
      devops: string[];
      other: string[];
    } = {
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
      result += categories.backend.map(task => `- [ ] ${this.removeEmojis(task.replace(/^- [ \ ]\s*/, '').trim())}`).join('\n');
    }

    if (categories.frontend.length > 0) {
      result += '\n### 2.2 Frontend Tasks\n\n';
      result += categories.frontend.map(task => `- [ ] ${this.removeEmojis(task.replace(/^- [ \ ]\s*/, '').trim())}`).join('\n');
    }

    if (categories.qa.length > 0) {
      result += '\n### 2.3 QA Tasks\n\n';
      result += categories.qa.map(task => `- [ ] ${this.removeEmojis(task.replace(/^- [ \ ]\s*/, '').trim())}`).join('\n');
    }

    if (categories.devops.length > 0) {
      result += '\n### 2.4 DevOps Tasks\n\n';
      result += categories.devops.map(task => `- [ ] ${this.removeEmojis(task.replace(/^- [ \ ]\s*/, '').trim())}`).join('\n');
    }

    if (categories.other.length > 0) {
      result += '\n### 2.5 Other Tasks\n\n';
      result += categories.other.map(task => `- [ ] ${this.removeEmojis(task.replace(/^- [ \ ]\s*/, '').trim())}`).join('\n');
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
    console.log('[PDF-GENERATOR] formatPRDContent called with content length:', content.length);
    
    // Check if content already has standard structure
    if (
      content.includes('## 1. Visão Geral') ||
      content.includes('## 2. Requisitos Funcionais') ||
      this.isBusinessPRDContent(content) ||
      this.hasMarkdownHeadings(content)
    ) {
      console.log('[PDF-GENERATOR] Content already has standard structure, returning as-is');
      return content.trim();
    }

    // Extract summarized content if available
    const summaryMatch = content.match(/Resumo das discussões dos agentes:([\s\S]*?)Detalhes dos agentes:/);
    const summaryContent = summaryMatch ? summaryMatch[1].trim() : '';

    // Format unstructured content into a business-oriented PRD structure
    const section1 = this.extractSection(content, 'overview', 'objectives', 'scope');
    const section2 = this.extractSection(content, 'problem', 'problema', 'pain', 'dor');
    const section3 = this.extractSection(content, 'users', 'usuarios', 'usuários', 'customer', 'cliente');
    const section4 = this.extractSection(content, 'success metrics', 'metricas', 'métricas', 'kpi');
    const section5 = this.extractSection(content, 'dependencies', 'risks', 'dependencias', 'dependências', 'riscos');
    const section6 = this.extractSection(content, 'timeline', 'schedule', 'milestones', 'cronograma', 'prazo');
    const section7 = this.extractSection(content, 'approvals', 'stakeholders', 'aprovacao', 'aprovação');
    
    console.log('[PDF-GENERATOR] Extracted sections:', {
      section1Length: section1.length,
      section2Length: section2.length,
      section3Length: section3.length,
      section4Length: section4.length,
      section5Length: section5.length,
      section6Length: section6.length,
      section7Length: section7.length,
      summaryContentLength: summaryContent?.length || 0
    });
    
    const formattedContent = `
# PRD Executivo

## Resumo Executivo

${section1}

## Contexto e Problema

${section2}

## Público Impactado

${section3}

## Métricas de Sucesso

${section4}

## Riscos e Dependências

${section5}

## Plano de Entrega

${section6}

## Aprovações Necessárias

${section7}

## Resumo das Discussões da Squad

${summaryContent || 'Nenhum resumo disponível.'}
`;

    console.log('[PDF-GENERATOR] Formatted content length:', formattedContent.length);
    return formattedContent.trim();
  }

  /**
   * Extract section content based on keywords
   */
  private extractSection(content: string, ...keywords: string[]): string {
    const lines = content.split('\n');
    const resultLines = [];
    const lowerCaseKeywords = keywords.map(k => k.toLowerCase());

    for (const line of lines) {
      const lowerLine = line.toLowerCase();
      if (lowerCaseKeywords.some(keyword => lowerLine.includes(keyword))) {
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
    console.log('[PDF-GENERATOR] Starting drawMultiPageContent', {
      demandId,
      contentLength: content.length,
      docType,
      timestamp: new Date().toISOString()
    });
    
    const pageWidth = 612;
    const pageHeight = 792;
    const margin = 50;
    const maxWidth = pageWidth - (margin * 2);
    const lineHeight = 14;
    const headerHeight = 180;
    const footerHeight = 70;

    // Remove emojis from content
    const cleanContent = this.removeEmojis(content);
    const lines = cleanContent.split('\n');
    
    console.log('[PDF-GENERATOR] Content split into lines', {
      demandId,
      lineCount: lines.length,
      firstLine: lines[0]?.substring(0, 50),
      timestamp: new Date().toISOString()
    });

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
      const trimmedLine = line.trim();

      // Check line type and set properties
      if (trimmedLine.startsWith('#')) {
        const headingText = this.stripMarkdownForPdf(trimmedLine.replace(/^#+\s*/, ''));
        wrappedLines = this.wrapText(headingText, maxWidth, boldFont, 16);
        fontSize = 16;
        currentFont = boldFont;
        color = rgb(0.2, 0.4, 0.6);
      } else if (/^-\s+\[[ xX]\]\s*/.test(trimmedLine)) {
        const taskText = this.stripMarkdownForPdf(trimmedLine.replace(/^-\s+\[[ xX]\]\s*/, ''));
        wrappedLines = this.wrapText('- ' + taskText, maxWidth - 20, font, 12);
        indent = 10;
      } else if (/^\d+\.\s+/.test(trimmedLine)) {
        const listText = this.stripMarkdownForPdf(trimmedLine);
        wrappedLines = this.wrapText(listText, maxWidth - 20, font, 12);
        indent = 10;
      } else if (trimmedLine.startsWith('-')) {
        const listText = this.stripMarkdownForPdf(trimmedLine.replace(/^-\s*/, ''));
        wrappedLines = this.wrapText('- ' + listText, maxWidth - 20, font, 12);
        indent = 10;
      } else {
        wrappedLines = this.wrapText(this.stripMarkdownForPdf(line), maxWidth, font, 12);
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

  private async drawProfessionalPRDContent(
    pdfDoc: any,
    font: any,
    boldFont: any,
    content: string,
    demandId: number
  ): Promise<void> {
    const layout = this.professionalLayout;
    const maxWidth = layout.pageWidth - layout.marginX * 2;
    const cleanContent = this.removeEmojis(content);
    const lines = cleanContent.split('\n');
    const generatedAt = new Date();

    console.log('[PDF-GENERATOR] Drawing PRD with professional layout', {
      demandId,
      lineCount: lines.length,
      timestamp: generatedAt.toISOString()
    });

    let currentPage = pdfDoc.addPage([layout.pageWidth, layout.pageHeight]);
    let pageNumber = 1;
    this.drawProfessionalHeader(currentPage, boldFont, font, demandId, generatedAt);
    let yPosition = layout.pageHeight - layout.headerHeight;

    const ensureSpace = (requiredHeight: number) => {
      if (yPosition >= layout.footerHeight + requiredHeight) return;

      this.drawProfessionalFooter(currentPage, font, pageNumber);
      pageNumber++;
      currentPage = pdfDoc.addPage([layout.pageWidth, layout.pageHeight]);
      this.drawProfessionalHeader(currentPage, boldFont, font, demandId, generatedAt);
      yPosition = layout.pageHeight - layout.headerHeight;
    };

    for (const line of lines) {
      const trimmedLine = line.trim();

      if (!trimmedLine) {
        yPosition -= layout.paragraphGap;
        continue;
      }

      const style = this.getProfessionalLineStyle(trimmedLine, font, boldFont);
      const availableWidth = maxWidth - style.indent;
      const text = this.getProfessionalLineText(trimmedLine, style.prefix);
      const wrappedLines = this.wrapTextByFontMetrics(text, availableWidth, style.font, style.fontSize);
      const blockHeight = wrappedLines.length * style.lineHeight + style.afterGap + style.beforeGap;

      ensureSpace(blockHeight);
      yPosition -= style.beforeGap;

      if (style.drawRule) {
        currentPage.drawLine({
          start: { x: layout.marginX, y: yPosition + 7 },
          end: { x: layout.pageWidth - layout.marginX, y: yPosition + 7 },
          thickness: 0.7,
          color: layout.borderColor,
        });
      }

      for (let index = 0; index < wrappedLines.length; index++) {
        ensureSpace(style.lineHeight + layout.paragraphGap);

        const linePrefix = index === 0 ? style.prefix : style.continuationPrefix;
        const prefixWidth = linePrefix ? style.font.widthOfTextAtSize(linePrefix, style.fontSize) : 0;
        const x = layout.marginX + style.indent;

        if (linePrefix) {
          currentPage.drawText(linePrefix, {
            x,
            y: yPosition,
            size: style.fontSize,
            font: style.prefixFont,
            color: style.color,
          });
        }

        currentPage.drawText(wrappedLines[index], {
          x: x + prefixWidth,
          y: yPosition,
          size: style.fontSize,
          font: style.font,
          color: style.color,
        });

        yPosition -= style.lineHeight;
      }

      yPosition -= style.afterGap;
    }

    this.drawProfessionalFooter(currentPage, font, pageNumber);
  }

  private getProfessionalLineStyle(trimmedLine: string, font: any, boldFont: any) {
    const layout = this.professionalLayout;

    if (/^#\s+/.test(trimmedLine)) {
      return {
        font: boldFont,
        prefixFont: boldFont,
        fontSize: 20,
        lineHeight: 25,
        beforeGap: 4,
        afterGap: 12,
        indent: 0,
        prefix: '',
        continuationPrefix: '',
        color: layout.primaryColor,
        drawRule: false,
      };
    }

    if (/^##\s+/.test(trimmedLine)) {
      return {
        font: boldFont,
        prefixFont: boldFont,
        fontSize: 13,
        lineHeight: 18,
        beforeGap: layout.sectionGap,
        afterGap: 6,
        indent: 0,
        prefix: '',
        continuationPrefix: '',
        color: layout.accentColor,
        drawRule: true,
      };
    }

    if (/^###\s+/.test(trimmedLine)) {
      return {
        font: boldFont,
        prefixFont: boldFont,
        fontSize: 11.5,
        lineHeight: 16,
        beforeGap: 8,
        afterGap: 3,
        indent: 0,
        prefix: '',
        continuationPrefix: '',
        color: layout.primaryColor,
        drawRule: false,
      };
    }

    if (/^-\s+\[[ xX]\]\s*/.test(trimmedLine)) {
      return {
        font,
        prefixFont: boldFont,
        fontSize: layout.bodyFontSize,
        lineHeight: layout.bodyLineHeight,
        beforeGap: 1,
        afterGap: 2,
        indent: layout.bulletIndent,
        prefix: '□ ',
        continuationPrefix: '  ',
        color: layout.bodyColor,
        drawRule: false,
      };
    }

    if (/^\d+\.\s+/.test(trimmedLine)) {
      const numberPrefix = trimmedLine.match(/^(\d+\.\s+)/)?.[1] || '';
      return {
        font,
        prefixFont: boldFont,
        fontSize: layout.bodyFontSize,
        lineHeight: layout.bodyLineHeight,
        beforeGap: 1,
        afterGap: 2,
        indent: layout.bulletIndent,
        prefix: numberPrefix,
        continuationPrefix: ' '.repeat(numberPrefix.length),
        color: layout.bodyColor,
        drawRule: false,
      };
    }

    if (/^-\s+/.test(trimmedLine)) {
      return {
        font,
        prefixFont: boldFont,
        fontSize: layout.bodyFontSize,
        lineHeight: layout.bodyLineHeight,
        beforeGap: 1,
        afterGap: 2,
        indent: layout.bulletIndent,
        prefix: '• ',
        continuationPrefix: '  ',
        color: layout.bodyColor,
        drawRule: false,
      };
    }

    return {
      font,
      prefixFont: boldFont,
      fontSize: layout.bodyFontSize,
      lineHeight: layout.bodyLineHeight,
      beforeGap: 0,
      afterGap: layout.paragraphGap,
      indent: 0,
      prefix: '',
      continuationPrefix: '',
      color: layout.bodyColor,
      drawRule: false,
    };
  }

  private getProfessionalLineText(trimmedLine: string, prefix: string): string {
    let text = trimmedLine
      .replace(/^#{1,6}\s*/, '')
      .replace(/^-\s+\[[ xX]\]\s*/, '')
      .replace(/^-\s+/, '');

    if (prefix && /^\d+\.\s+/.test(text)) {
      text = text.replace(/^\d+\.\s+/, '');
    }

    return this.stripMarkdownForPdf(text);
  }

  private wrapTextByFontMetrics(text: string, maxWidth: number, font: any, fontSize: number): string[] {
    const normalizedText = text.replace(/\s+/g, ' ').trim();
    if (!normalizedText) return [''];

    const lines: string[] = [];
    let currentLine = '';

    for (const word of normalizedText.split(' ')) {
      const candidate = currentLine ? `${currentLine} ${word}` : word;

      if (font.widthOfTextAtSize(candidate, fontSize) <= maxWidth) {
        currentLine = candidate;
        continue;
      }

      if (currentLine) {
        lines.push(currentLine);
      }

      if (font.widthOfTextAtSize(word, fontSize) <= maxWidth) {
        currentLine = word;
      } else {
        const brokenWordLines = this.breakLongWord(word, maxWidth, font, fontSize);
        lines.push(...brokenWordLines.slice(0, -1));
        currentLine = brokenWordLines[brokenWordLines.length - 1] || '';
      }
    }

    if (currentLine) {
      lines.push(currentLine);
    }

    return lines;
  }

  private breakLongWord(word: string, maxWidth: number, font: any, fontSize: number): string[] {
    const chunks: string[] = [];
    let currentChunk = '';

    for (const char of word) {
      const candidate = currentChunk + char;
      if (font.widthOfTextAtSize(candidate, fontSize) <= maxWidth || !currentChunk) {
        currentChunk = candidate;
      } else {
        chunks.push(currentChunk);
        currentChunk = char;
      }
    }

    if (currentChunk) {
      chunks.push(currentChunk);
    }

    return chunks.length ? chunks : [word];
  }

  private drawProfessionalHeader(page: any, boldFont: any, font: any, demandId: number, generatedAt: Date) {
    const layout = this.professionalLayout;
    const { width, height } = page.getSize();

    page.drawRectangle({
      x: 0,
      y: height - layout.headerHeight + 14,
      width,
      height: layout.headerHeight - 14,
      color: layout.headerFill,
    });

    page.drawText('AICHATFLOW', {
      x: layout.marginX,
      y: height - 42,
      size: 10,
      font: boldFont,
      color: layout.mutedColor,
    });

    page.drawText('PRD Executivo', {
      x: layout.marginX,
      y: height - 69,
      size: 18,
      font: boldFont,
      color: layout.primaryColor,
    });

    page.drawText(`Demanda #${demandId}`, {
      x: width - layout.marginX - 112,
      y: height - 48,
      size: 9.5,
      font,
      color: layout.mutedColor,
    });

    page.drawText(`Gerado em ${generatedAt.toLocaleDateString('pt-BR')}`, {
      x: width - layout.marginX - 112,
      y: height - 64,
      size: 9.5,
      font,
      color: layout.mutedColor,
    });

    page.drawLine({
      start: { x: layout.marginX, y: height - layout.headerHeight + 16 },
      end: { x: width - layout.marginX, y: height - layout.headerHeight + 16 },
      thickness: 1,
      color: layout.borderColor,
    });
  }

  private drawProfessionalFooter(page: any, font: any, pageNumber: number) {
    const layout = this.professionalLayout;
    const { width } = page.getSize();

    page.drawLine({
      start: { x: layout.marginX, y: 42 },
      end: { x: width - layout.marginX, y: 42 },
      thickness: 0.7,
      color: layout.borderColor,
    });

    page.drawText('AICHATflow - Documento confidencial', {
      x: layout.marginX,
      y: 24,
      size: 8.5,
      font,
      color: layout.mutedColor,
    });

    page.drawText(`Pagina ${pageNumber}`, {
      x: width - layout.marginX - 58,
      y: 24,
      size: 8.5,
      font,
      color: layout.mutedColor,
    });
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
    page.drawText(docType, {
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

  /**
   * Wrap text to fit within a specific width
   */
  private wrapText(text: string, maxWidth: number, font: any, fontSize: number): string[] {
    // Simple word wrapping - approximate character count
    // Note: For accurate wrapping, we'd need font metrics, but this is a reasonable approximation
    const words = text.split(' ');
    const lines: string[] = [];
    let currentLine = '';
    const avgCharWidth = fontSize * 0.6; // Approximate average character width
    const maxCharsPerLine = Math.floor(maxWidth / avgCharWidth);

    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      const estimatedWidth = testLine.length * avgCharWidth;

      if (estimatedWidth > maxWidth && currentLine) {
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
    page.drawText('AICHATflow - Documento confidencial', {
      x: 50,
      y: 30,
      size: 10,
      font: font,
      color: rgb(0.5, 0.5, 0.5),
    });

    // Draw page number
    page.drawText(`Pagina ${pageNumber}`, {
      x: width - 100,
      y: 30,
      size: 10,
      font: font,
      color: rgb(0.5, 0.5, 0.5),
    });
  }
}

export const pdfGenerator = new PDFGenerator();
