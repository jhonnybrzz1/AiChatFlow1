/**
 * Serviço de geração de documentos para AIChatFlow
 * Classe base para geração de PRD e Tasks com lógica comum
 * Agora inclui validação anti-overengineering para garantir documentos realistas
 */

import { Demand, ChatMessage } from '@shared/schema';
import { mistralAIService } from './mistral-ai';
import { pdfGenerator } from './pdf-generator';
import fs from 'fs';
import path from 'path';
import { logger } from '../utils/logger';
import { contextBuilder } from './context-builder';

export interface DocumentGenerationOptions {
  demand: Demand;
  refinementMessages?: ChatMessage[];
  additionalContext?: string;
}

export interface GeneratedDocument {
  content: string;
  filePath: string;
  fileName: string;
  fileType: 'markdown' | 'pdf' | 'text';
}

export abstract class DocumentGenerator {
  protected abstract getDocumentType(): string;
  protected abstract getSystemPrompt(): string;
  protected abstract getUserPrompt(demand: Demand, refinementMessages: ChatMessage[]): string;
  protected abstract getFilePrefix(): string;

  // Maximum attempts to regenerate document if validation fails
  private readonly MAX_REGENERATION_ATTEMPTS = 2;

  /**
   * Gera o conteúdo do documento usando IA com validação anti-overengineering
   */
  protected async generateContent(demand: Demand, refinementMessages: ChatMessage[]): Promise<string> {
    const systemPrompt = this.getSystemPrompt();
    const userPrompt = this.getUserPrompt(demand, refinementMessages);

    // Get insights summary from context builder for richer documents
    const insightsSummary = contextBuilder.getInsightsSummary(demand.id);

    logger.info(`Generating ${this.getDocumentType()} content for demand ${demand.id}`, {
      context: {
        demandId: demand.id,
        demandType: demand.type,
        messageCount: refinementMessages.length
      }
    });

    let attempts = 0;
    let lastResponse = '';

    while (attempts < this.MAX_REGENERATION_ATTEMPTS) {
      attempts++;

      try {
        // Add anti-overengineering constraints to system prompt
        const constrainedSystemPrompt = `${systemPrompt}

--- ANTI-OVERENGINEERING CONSTRAINTS (OBRIGATÓRIO) ---
1. NÃO sugira tecnologias fora do stack atual (TypeScript, React, Node.js, Vite, SQLite)
2. NÃO proponha refatoração arquitetural ou troca de frameworks
3. NÃO sugira microserviços, kubernetes, blockchain ou tecnologias enterprise
4. TODAS as estimativas devem ser realistas (< 2 semanas para features, < 3 dias para bugs)
5. TODOS os requisitos devem ter critérios de aceite mensuráveis
6. Foque em soluções PRÁTICAS e INCREMENTAIS
7. Referencie dados CONCRETOS do projeto quando disponíveis

${insightsSummary ? `\n--- INSIGHTS DA SQUAD ---\n${insightsSummary}` : ''}

Se você incluir qualquer sugestão de overengineering, o documento será REJEITADO e regenerado.`;

        const response = await mistralAIService.generateChatCompletion(
          constrainedSystemPrompt,
          userPrompt,
          {
            temperature: 0.5,
            maxTokens: 4000
          }
        );

        if (!response) {
          return this.getFallbackContent(demand);
        }

        lastResponse = response;

        // Validate the generated document against anti-overengineering rules
        const validation = this.validateDocument(response);

        if (validation.isValid) {
          logger.info(`${this.getDocumentType()} validated successfully (score: ${validation.score})`, {
            context: { demandId: demand.id, attempts }
          });
          return response;
        }

        // If validation failed and we have more attempts, regenerate with feedback
        if (attempts < this.MAX_REGENERATION_ATTEMPTS) {
          logger.warn(`${this.getDocumentType()} validation failed (score: ${validation.score}), regenerating...`, {
            context: {
              demandId: demand.id,
              issues: validation.issues,
              attempt: attempts
            }
          });

          // Add validation feedback to the prompt for next attempt
          const feedbackPrompt = `${userPrompt}

ATENÇÃO: O documento anterior foi REJEITADO por violações de anti-overengineering:
${validation.issues.map(i => `- ${i}`).join('\n')}

Por favor, gere um documento que:
1. NÃO inclua as violações listadas acima
2. Seja mais PRÁTICO e REALISTA
3. Foque no que pode ser feito com o stack atual
4. Tenha estimativas conservadoras`;

          // Continue to next iteration with feedback
          continue;
        }

      } catch (error) {
        logger.error(`Error generating ${this.getDocumentType()} content (attempt ${attempts})`, {
          context: {
            demandId: demand.id,
            error: error instanceof Error ? error.message : 'Unknown error'
          }
        });
      }
    }

    // If all attempts failed, return last response with warning or fallback
    if (lastResponse) {
      logger.warn(`Returning ${this.getDocumentType()} despite validation issues after ${attempts} attempts`, {
        context: { demandId: demand.id }
      });
      return `<!-- AVISO: Este documento pode conter sugestões de overengineering. Revise cuidadosamente. -->\n\n${lastResponse}`;
    }

    return this.getFallbackContent(demand);
  }

  /**
   * Validates document content against anti-overengineering rules
   */
  protected validateDocument(content: string): { isValid: boolean; score: number; issues: string[] } {
    const issues: string[] = [];
    let score = 100;

    const contentLower = content.toLowerCase();

    // Check for forbidden technologies
    const forbiddenTech = [
      'kubernetes', 'k8s', 'docker swarm', 'microservices', 'microserviços',
      'blockchain', 'web3', 'graphql federation', 'event sourcing',
      'cqrs', 'saga pattern', 'service mesh', 'istio', 'kafka',
      'elasticsearch cluster', 'redis cluster', 'mongodb sharding'
    ];

    for (const tech of forbiddenTech) {
      if (contentLower.includes(tech)) {
        issues.push(`Tecnologia proibida detectada: ${tech}`);
        score -= 25;
      }
    }

    // Check for unrealistic time estimates (more than 4 weeks)
    const longEstimates = content.match(/(\d+)\s*(meses|months|semanas|weeks)/gi);
    if (longEstimates) {
      for (const estimate of longEstimates) {
        const num = parseInt(estimate);
        if (estimate.toLowerCase().includes('mes') || estimate.toLowerCase().includes('month')) {
          if (num > 1) {
            issues.push(`Estimativa muito longa detectada: ${estimate}`);
            score -= 15;
          }
        } else if (num > 4) {
          issues.push(`Estimativa muito longa detectada: ${estimate}`);
          score -= 10;
        }
      }
    }

    // Check for vague language
    const vagueTerms = [
      'revolucionar', 'transformar completamente', 'reescrever do zero',
      'arquitetura enterprise', 'solução de ponta', 'cutting-edge',
      'state-of-the-art', 'paradigma', 'disruptivo'
    ];

    for (const term of vagueTerms) {
      if (contentLower.includes(term)) {
        issues.push(`Linguagem vaga/exagerada detectada: ${term}`);
        score -= 10;
      }
    }

    // Check for architectural changes
    const archChanges = [
      'refatorar toda', 'reescrever', 'nova arquitetura',
      'migrar para', 'trocar framework', 'substituir banco'
    ];

    for (const change of archChanges) {
      if (contentLower.includes(change)) {
        issues.push(`Mudança arquitetural detectada: ${change}`);
        score -= 20;
      }
    }

    // Bonus: Check for good practices
    if (content.includes('ROI') || content.match(/\d+:\d+/)) {
      score += 5;
    }
    if (content.match(/\d+\s*(dia|day)/i)) {
      score += 5;
    }
    if (content.includes('critério') || content.includes('aceite')) {
      score += 5;
    }

    // Clamp score between 0 and 100
    score = Math.max(0, Math.min(100, score));

    return {
      isValid: score >= 70,
      score,
      issues
    };
  }

  /**
   * Conteúdo de fallback caso a geração de IA falhe
   */
  protected getFallbackContent(demand: Demand): string {
    return `# ${this.getDocumentType()} - ${demand.title}

## Error
Error generating ${this.getDocumentType()}. Refinement captured but document not created.`;
  }

  /**
   * Salva o documento em arquivo
   */
  protected async saveDocument(demandId: number, content: string): Promise<GeneratedDocument> {
    const documentsDir = path.join(process.cwd(), 'documents');
    if (!fs.existsSync(documentsDir)) {
      fs.mkdirSync(documentsDir, { recursive: true });
    }

    const timestamp = Date.now();
    const filePrefix = this.getFilePrefix();
    const markdownFilename = `${filePrefix}_${demandId}_${timestamp}.md`;
    const markdownFilepath = path.join(documentsDir, markdownFilename);

    // Salvar conteúdo markdown
    fs.writeFileSync(markdownFilepath, content, 'utf8');

    // Gerar PDF
    let pdfContent: Buffer;
    try {
      if (this.getDocumentType() === 'PRD') {
        pdfContent = await pdfGenerator.generatePRDDocument(content, demandId);
      } else {
        pdfContent = await pdfGenerator.generateTasksDocument(content, demandId);
      }

      const pdfFilename = `${filePrefix}_${demandId}_${timestamp}.pdf`;
      const pdfFilepath = path.join(documentsDir, pdfFilename);
      fs.writeFileSync(pdfFilepath, pdfContent);

      return {
        content,
        filePath: `/api/documents/${pdfFilename}`,
        fileName: pdfFilename,
        fileType: 'pdf'
      };
    } catch (error) {
      logger.warn(`PDF generation failed for ${this.getDocumentType()}, using markdown`, {
        context: { 
          demandId,
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      });

      return {
        content,
        filePath: `/api/documents/${markdownFilename}`,
        fileName: markdownFilename,
        fileType: 'markdown'
      };
    }
  }

  /**
   * Gera o documento completo
   */
  public async generateDocument(demand: Demand, refinementMessages: ChatMessage[] = []): Promise<GeneratedDocument> {
    const content = await this.generateContent(demand, refinementMessages);
    const document = await this.saveDocument(demand.id, content);

    logger.info(`${this.getDocumentType()} generated successfully`, {
      context: { 
        demandId: demand.id,
        fileType: document.fileType,
        fileName: document.fileName
      }
    });

    return document;
  }
}

/**
 * Gerador de PRD
 */
export class PRDGenerator extends DocumentGenerator {
  protected getDocumentType(): string {
    return 'PRD';
  }

  protected getFilePrefix(): string {
    return 'PRD';
  }

  protected getSystemPrompt(): string {
    return `Você é um Product Manager experiente e orientado a negócios.
Sua responsabilidade é criar um PRD executivo em Markdown, claro para diretoria, produto, operação, comercial e tecnologia.

Use esta estrutura:
# PRD - [Título da Demanda]
## Resumo Executivo
## Contexto e Problema
## Público Impactado
## Objetivos de Negócio
## Escopo da Entrega
### Faremos
### Não Faremos Agora
## Experiência Esperada
## Regras de Negócio e Premissas
## Métricas de Sucesso
## Riscos e Cuidados
## Plano de Entrega
## Pontos em Aberto
## Aprovações Necessárias

Evite RF/RNF, endpoint, API, banco de dados, deploy, sprint e jargão técnico. Traduza sugestões técnicas para impacto de negócio, experiência, risco, escopo ou métrica.`;
  }

  protected getUserPrompt(demand: Demand, refinementMessages: ChatMessage[]): string {
    const refinementSummary = refinementMessages
      .filter(msg => msg.type === 'completed')
      .map(msg => `**${msg.agent}**: ${msg.message}`)
      .join('\n\n');

    return `Demanda Original: ${demand.title}
Descrição: ${demand.description}
Tipo: ${demand.type}
Prioridade: ${demand.priority}

=== REFINAMENTO DA SQUAD ===
${refinementSummary}

=== SUA TAREFA ===
Com base em TODAS as análises acima, crie um PRD de negócio completo em Markdown seguindo o formato especificado.`;
  }

  protected getFallbackContent(demand: Demand): string {
    return `# PRD - ${demand.title}

## Erro
Erro ao gerar PRD. Refinamento capturado mas documento não foi criado.`;
  }
}

/**
 * Gerador de Tasks
 */
export class TasksGenerator extends DocumentGenerator {
  protected getDocumentType(): string {
    return 'Tasks';
  }

  protected getFilePrefix(): string {
    return 'Tasks';
  }

  protected getSystemPrompt(): string {
    return `Você é um Product Manager experiente.
Crie um documento de tasks técnicas detalhadas baseadas no PRD seguindo EXATAMENTE este formato:`;
  }

  protected getUserPrompt(demand: Demand, refinementMessages: ChatMessage[]): string {
    const refinementSummary = refinementMessages
      .filter(msg => msg.type === 'completed')
      .map(msg => `**${msg.agent}**: ${msg.message}`)
      .join('\n\n');

    return `Demanda Original: ${demand.title}
Descrição: ${demand.description}
Tipo: ${demand.type}
Prioridade: ${demand.priority}

=== REFINAMENTO DA SQUAD ===
${refinementSummary}

=== SUA TAREFA ===
Com base no refinamento acima, crie uma lista completa de tasks técnicas organizadas por categoria.`;
  }

  protected getFallbackContent(demand: Demand): string {
    return `# Tasks - ${demand.title}

## Error
Error generating tasks. Refinement captured but document not created.`;
  }
}

// Instâncias singleton
export const prdGenerator = new PRDGenerator();
export const tasksGenerator = new TasksGenerator();
