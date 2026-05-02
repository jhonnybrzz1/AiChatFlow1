
import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertDemandSchema, insertFileSchema, type RefinementType } from "@shared/schema";
import { aiSquadService } from "./services/ai-squad";
import { demandClassifier } from "./cognitive-core/demand-classifier";
import { agentOrchestrator } from "./cognitive-core/agent-orchestrator";
import { frameworkManager } from "./frameworks/framework-manager";
import { z } from "zod";
import { gitHubService } from './services/github';
import { demandRoutingOrchestrator } from './routing/orchestrator';
import { metricsCollector } from './routing/metrics-collector';
import { repoService } from './services/repo-service';
import { aiUsageTracker } from './services/ai-usage-tracker';
import { aiResponseCache } from './services/ai-cache';
import { contextBuilder } from './services/context-builder';
import { RefinementInputError, resolveRefinementInput } from './services/refinement-input';
import multer from "multer";
import path from "path";
import fs from "fs";
import governanceRoutes from './routes/governance-routes';

// Validador de refinementType
const refinementTypeSchema = z.enum(['technical', 'business']).nullable().optional();

const upload = multer({
  dest: 'uploads/',
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

function sendValidationError(res: Response, error: unknown): void {
  if (error instanceof RefinementInputError) {
    res.status(422).json({
      error: error.message,
      errorCode: error.errorCode,
      refinementInputSource: 'document',
      documentTextLength: 0,
      ideaTextLength: 0
    });
    return;
  }

  if (error instanceof z.ZodError) {
    res.status(400).json({
      error: "Invalid demand data",
      issues: error.errors.map(issue => ({
        path: issue.path.join('.'),
        message: issue.message
      }))
    });
    return;
  }

  res.status(400).json({ error: "Invalid demand data" });
}

function cleanupUploadedFiles(files: Express.Multer.File[] = []): void {
  for (const file of files) {
    fs.promises.unlink(file.path).catch(() => undefined);
  }
}

export async function registerRoutes(app: Express): Promise<Server> {

  // Register governance routes
  app.use('/api/governance', governanceRoutes);

  app.get("/api/ai/usage", (_req: Request, res: Response) => {
    res.json({
      usage: aiUsageTracker.getSummary(),
      cache: aiResponseCache.getStats(),
      context: contextBuilder.getContextStats()
    });
  });

  app.post("/api/ai/usage/reset", (_req: Request, res: Response) => {
    aiUsageTracker.reset();
    res.json({ success: true });
  });

  app.post("/api/ai/cache/clear", (_req: Request, res: Response) => {
    aiResponseCache.clear();
    res.json({ success: true, cache: aiResponseCache.getStats() });
  });

  // GitHub routes
  app.get("/api/github/repos", async (req: Request, res: Response) => {
    try {
      console.log('Fetching user repositories from GitHub API');
      const repos = await gitHubService.listUserRepos();
      console.log(`Successfully fetched ${repos.length} repositories from GitHub API`);
      res.json(repos);
    } catch (error) {
      console.error('GitHub API Error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStatus = (error as any)?.status || 'Unknown status';
      console.error(`GitHub API error details - Status: ${errorStatus}, Message: ${errorMessage}`);
      // Return minimal data instead of failing completely
      res.status(500).json({
        error: "Failed to fetch repositories. This may be due to GitHub token permissions or connection issues.",
        // Provide helpful message to user
        message: 'Please check your GitHub token permissions and ensure it has the required scopes (repo, read:org).',
        errorDetails: errorMessage,
        errorStatus: errorStatus
      });
    }
  });

  app.get("/api/github/repos/:owner/:repo/content", async (req: Request, res: Response) => {
    try {
      const { owner, repo } = req.params;
      const path = req.query.path as string || '';
      console.log(`Fetching content for ${owner}/${repo}/${path}`);
      const content = await gitHubService.getRepoContent(owner, repo, path);
      console.log(`Successfully fetched content for ${owner}/${repo}/${path}`);
      res.json(content);
    } catch (error) {
      console.error('GitHub content fetch error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStatus = (error as any)?.status || 'Unknown status';
      console.error(`GitHub API error details - Status: ${errorStatus}, Message: ${errorMessage}`);
      res.status(500).json({
        error: "Failed to fetch repository content. Check repository visibility and token permissions.",
        errorDetails: errorMessage,
        errorStatus: errorStatus
      });
    }
  });

  app.post("/api/github/search-files", async (req: Request, res: Response) => {
    try {
      const { owner, repo, query } = req.body;
      if (!owner || !repo || !query) {
        return res.status(400).json({ error: "Missing required parameters: owner, repo, query" });
      }
      const results = await gitHubService.searchRepo(owner, repo, query);
      res.json(results);
    } catch (error) {
      console.error('GitHub search error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      res.status(500).json({
        error: "Failed to search repository.",
        errorDetails: errorMessage,
      });
    }
  });

  // New endpoint to get repository information from backend
  app.get("/api/github/repos/:owner/:repo", async (req: Request, res: Response) => {
    try {
      const { owner, repo } = req.params;

      const result = await repoService.getRepoWithFiles(owner, repo);
      if (!result) {
        return res.status(404).json({ error: "Repository not found in backend" });
      }

      res.json({
        repo: result.repo,
        files: result.files,
        fileCount: result.files.length
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to get repository from backend" });
    }
  });

  // Get all demands
  app.get("/api/demands", async (req: Request, res: Response) => {
    try {
      const demands = await storage.getAllDemands();
      res.json(demands);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch demands" });
    }
  });

  // Get demand classification
  app.get("/api/demands/:id/classification", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const demand = await storage.getDemand(id);
      if (!demand) {
        return res.status(404).json({ error: "Demand not found" });
      }

      // Classify the demand using cognitive core
      const classification = await demandClassifier.classifyDemand(demand);

      res.json({
        demandId: id,
        classification: classification
      });
    } catch (error) {
      console.error('Error classifying demand:', error);
      res.status(500).json({ error: "Failed to classify demand" });
    }
  });

  // Get specific demand
  app.get("/api/demands/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const demand = await storage.getDemand(id);
      if (!demand) {
        return res.status(404).json({ error: "Demand not found" });
      }
      res.json(demand);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch demand" });
    }
  });

  // Create new demand with cognitive core
  app.post("/api/demands/cognitive", upload.array('files'), async (req: Request, res: Response) => {
    const files = req.files as Express.Multer.File[] || [];
    try {
      const demandData = insertDemandSchema.parse(req.body);

      // Check if repository information is included in the request
      const { githubRepoOwner, githubRepoName, githubRepoDescription } = req.body;

      // Validar refinementType com Zod (evita valores inválidos)
      const refinementTypeRaw = req.body.refinementType;
      const refinementType = refinementTypeSchema.parse(refinementTypeRaw) as RefinementType;
      const refinementInput = await resolveRefinementInput(demandData.description, files);
      let updatedDescription = refinementInput.ideaText;

      // If GitHub repository information is provided, incorporate it into the description
      if (refinementInput.refinementInputSource === 'description' && githubRepoOwner && githubRepoName) {
        try {
          // Attempt to fetch repository information to enrich the demand
          const repoInfo = await repoService.getOrCreateRepo(githubRepoOwner, githubRepoName);

          if (repoInfo && repoInfo.description) {
            updatedDescription = `${refinementInput.ideaText}\n\n---\n**Contexto do Repositório GitHub:**\nRepositório: ${repoInfo.fullName}\nDescrição: ${repoInfo.description}\nLinguagem Principal: ${repoInfo.language || 'N/A'}\n`;
          } else {
            updatedDescription = `${refinementInput.ideaText}\n\n---\n**Contexto do Repositório GitHub:**\nRepositório: ${githubRepoOwner}/${githubRepoName}\n`;
          }
        } catch (repoError) {
          console.warn(`Could not fetch GitHub repository info for ${githubRepoOwner}/${githubRepoName}:`, repoError);
          // Still include the basic repo info even if we can't fetch details
          updatedDescription = `${refinementInput.ideaText}\n\n---\n**Contexto do Repositório GitHub:**\nRepositório: ${githubRepoOwner}/${githubRepoName}\n`;
        }
      }

      // Create demand with potentially updated description and refinement type
      const demand = await storage.createDemand({
        ...demandData,
        description: updatedDescription,
        refinementType: refinementType || null
      });

      // Handle uploaded files
      if (files && files.length > 0) {
        for (const file of files) {
          const fileData = insertFileSchema.parse({
            demandId: demand.id,
            filename: file.filename,
            originalName: file.originalname,
            mimeType: file.mimetype,
            size: file.size,
            path: file.path
          });
          await storage.createFile(fileData);
        }
      }

      // Start processing with cognitive core in background with progress callback
      aiSquadService.processDemandWithCognitiveCore(demand.id, async (message) => {
        // Update demand with progress
        await storage.updateDemand(demand.id, {
          status: 'processing',
          progress: message.progress || 0
        });
      }).catch(error => {
        console.error(`Error processing demand ${demand.id} with cognitive core:`, error);
        storage.updateDemand(demand.id, { status: 'error' });
      });

      res.json({
        ...demand,
        refinementInputSource: refinementInput.refinementInputSource,
        documentTextLength: refinementInput.documentTextLength,
        ideaTextLength: updatedDescription.length
      });
    } catch (error) {
      cleanupUploadedFiles(files);
      sendValidationError(res, error);
    }
  });

  // Create new demand
  app.post("/api/demands", upload.array('files'), async (req: Request, res: Response) => {
    const files = req.files as Express.Multer.File[] || [];
    try {
      const demandData = insertDemandSchema.parse(req.body);

      // Check if repository information is included in the request
      const { githubRepoOwner, githubRepoName, githubRepoDescription } = req.body;

      // Validar refinementType com Zod (evita valores inválidos)
      const refinementTypeRaw = req.body.refinementType;
      const refinementType = refinementTypeSchema.parse(refinementTypeRaw) as RefinementType;

      const refinementInput = await resolveRefinementInput(demandData.description, files);
      let updatedDescription = refinementInput.ideaText;

      // If GitHub repository information is provided, incorporate it into the description
      if (refinementInput.refinementInputSource === 'description' && githubRepoOwner && githubRepoName) {
        try {
          // Attempt to fetch repository information to enrich the demand
          const repoInfo = await repoService.getOrCreateRepo(githubRepoOwner, githubRepoName);

          if (repoInfo && repoInfo.description) {
            updatedDescription = `${refinementInput.ideaText}\n\n---\n**Contexto do Repositório GitHub:**\nRepositório: ${repoInfo.fullName}\nDescrição: ${repoInfo.description}\nLinguagem Principal: ${repoInfo.language || 'N/A'}\n`;
          } else {
            updatedDescription = `${refinementInput.ideaText}\n\n---\n**Contexto do Repositório GitHub:**\nRepositório: ${githubRepoOwner}/${githubRepoName}\n`;
          }
        } catch (repoError) {
          console.warn(`Could not fetch GitHub repository info for ${githubRepoOwner}/${githubRepoName}:`, repoError);
          // Still include the basic repo info even if we can't fetch details
          updatedDescription = `${refinementInput.ideaText}\n\n---\n**Contexto do Repositório GitHub:**\nRepositório: ${githubRepoOwner}/${githubRepoName}\n`;
        }
      }

      // Create demand with potentially updated description and refinement type
      const demand = await storage.createDemand({
        ...demandData,
        description: updatedDescription,
        refinementType: refinementType || null
      });

      // Handle uploaded files
      if (files && files.length > 0) {
        for (const file of files) {
          const fileData = insertFileSchema.parse({
            demandId: demand.id,
            filename: file.filename,
            originalName: file.originalname,
            mimeType: file.mimetype,
            size: file.size,
            path: file.path
          });
          await storage.createFile(fileData);
        }
      }

      // Start processing in background with progress callback
      aiSquadService.processDemand(demand.id, async (message) => {
        // Update demand with progress
        await storage.updateDemand(demand.id, {
          status: 'processing',
          progress: message.progress || 0
        });
      }).catch(error => {
        console.error(`Error processing demand ${demand.id}:`, error);
        storage.updateDemand(demand.id, { status: 'error' });
      });

      res.json({
        ...demand,
        refinementInputSource: refinementInput.refinementInputSource,
        documentTextLength: refinementInput.documentTextLength,
        ideaTextLength: updatedDescription.length
      });
    } catch (error) {
      cleanupUploadedFiles(files);
      sendValidationError(res, error);
    }
  });

  // Get demand orchestration plan
  app.get("/api/demands/:id/orchestration", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const demand = await storage.getDemand(id);
      if (!demand) {
        return res.status(404).json({ error: "Demand not found" });
      }

      // Create orchestration plan using cognitive core
      const orchestrationPlan = await agentOrchestrator.createOrchestrationPlan(id);

      res.json({
        demandId: id,
        orchestrationPlan: orchestrationPlan
      });
    } catch (error) {
      console.error('Error creating orchestration plan:', error);
      res.status(500).json({ error: "Failed to create orchestration plan" });
    }
  });

  // Framework Manager Endpoints

  // Get all available frameworks
  app.get("/api/frameworks", async (req: Request, res: Response) => {
    try {
      const frameworks = frameworkManager.getAllFrameworks();
      res.json({
        success: true,
        count: frameworks.length,
        frameworks: frameworks
      });
    } catch (error) {
      console.error('Error getting frameworks:', error);
      res.status(500).json({ error: "Failed to get frameworks" });
    }
  });

  // Get framework by ID
  app.get("/api/frameworks/:id", async (req: Request, res: Response) => {
    try {
      const id = req.params.id;
      const framework = frameworkManager.getFrameworkById(id);
      if (!framework) {
        return res.status(404).json({ error: "Framework not found" });
      }
      res.json(framework);
    } catch (error) {
      console.error('Error getting framework:', error);
      res.status(500).json({ error: "Failed to get framework" });
    }
  });

  // Get framework recommendation for a demand
  app.get("/api/demands/:id/framework-recommendation", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const demand = await storage.getDemand(id);
      if (!demand) {
        return res.status(404).json({ error: "Demand not found" });
      }

      // Get AI-powered framework recommendation
      const recommendation = await frameworkManager.recommendFramework(demand);

      res.json({
        demandId: id,
        recommendation: recommendation
      });
    } catch (error) {
      console.error('Error getting framework recommendation:', error);
      res.status(500).json({ error: "Failed to get framework recommendation" });
    }
  });

  // Execute a framework for a demand
  app.post("/api/demands/:id/frameworks/:frameworkId/execute", async (req: Request, res: Response) => {
    try {
      const demandId = parseInt(req.params.id);
      const frameworkId = req.params.frameworkId;
      const demand = await storage.getDemand(demandId);
      if (!demand) {
        return res.status(404).json({ error: "Demand not found" });
      }

      // Execute the framework
      const executionResult = await frameworkManager.executeFramework(
        demandId,
        frameworkId,
        (progress: number, message: string) => {
          console.log(`Framework execution progress: ${progress}% - ${message}`);
        }
      );

      res.json({
        success: true,
        executionResult: executionResult
      });
    } catch (error) {
      console.error('Error executing framework:', error);
      res.status(500).json({ error: "Failed to execute framework" });
    }
  });

  // Get framework execution history for a demand
  app.get("/api/demands/:id/framework-executions", async (req: Request, res: Response) => {
    try {
      const id = req.params.id;
      const history = frameworkManager.getExecutionHistory(id);

      res.json({
        demandId: id,
        executionCount: history.length,
        executions: history
      });
    } catch (error) {
      console.error('Error getting framework execution history:', error);
      res.status(500).json({ error: "Failed to get framework execution history" });
    }
  });

  // Get framework metrics summary
  app.get("/api/frameworks/metrics", async (req: Request, res: Response) => {
    try {
      const metrics = frameworkManager.getFrameworkMetricsSummary();

      res.json({
        success: true,
        metrics: metrics
      });
    } catch (error) {
      console.error('Error getting framework metrics:', error);
      res.status(500).json({ error: "Failed to get framework metrics" });
    }
  });

  // Get chat messages for a demand
  app.get("/api/demands/:id/messages", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const demand = await storage.getDemand(id);
      if (!demand) {
        return res.status(404).json({ error: "Demand not found" });
      }
      res.json(demand.chatMessages || []);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch messages" });
    }
  });

  // Export chat dialog as JSON
  app.get("/api/demands/:id/export/json", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const demand = await storage.getDemand(id);

      if (!demand) {
        return res.status(404).json({ error: "Demand not found" });
      }

      const exportData = {
        demandId: demand.id,
        title: demand.title,
        description: demand.description,
        type: demand.type,
        priority: demand.priority,
        status: demand.status,
        createdAt: demand.createdAt,
        updatedAt: demand.updatedAt,
        chatHistory: demand.chatMessages || []
      };

      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="dialogo_demanda_${id}_${Date.now()}.json"`);
      res.json(exportData);
    } catch (error) {
      res.status(500).json({ error: "Failed to export chat as JSON" });
    }
  });

  // Export chat dialog as TXT
  app.get("/api/demands/:id/export/txt", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const demand = await storage.getDemand(id);

      if (!demand) {
        return res.status(404).json({ error: "Demand not found" });
      }

      const agentNames: Record<string, string> = {
        refinador: "Refinador",
        scrum_master: "Scrum Master",
        qa: "QA",
        ux: "UX Designer",
        analista_de_dados: "Analista de Dados",
        tech_lead: "Tech Lead",
        pm: "Product Manager",
      };

      let txtContent = `HISTÓRICO DE DIÁLOGO - DEMANDA #${demand.id}\n`;
      txtContent += `${'='.repeat(60)}\n\n`;
      txtContent += `Título: ${demand.title}\n`;
      txtContent += `Tipo: ${demand.type}\n`;
      txtContent += `Prioridade: ${demand.priority}\n`;
      txtContent += `Status: ${demand.status}\n`;
      txtContent += `Criado em: ${demand.createdAt}\n`;
      txtContent += `\nDescrição:\n${demand.description}\n\n`;
      txtContent += `${'='.repeat(60)}\n`;
      txtContent += `MENSAGENS DO CHAT\n`;
      txtContent += `${'='.repeat(60)}\n\n`;

      const messages = demand.chatMessages || [];
      messages.forEach((message, index) => {
        const agentName = agentNames[message.agent] || message.agent;
        const timestamp = new Date(message.timestamp).toLocaleString('pt-BR');
        const status = message.type === 'completed' ? '✓' : message.type === 'processing' ? '⏳' : '✗';

        txtContent += `[${index + 1}] ${agentName} ${status}\n`;
        txtContent += `Data/Hora: ${timestamp}\n`;
        txtContent += `${'-'.repeat(60)}\n`;
        txtContent += `${message.message}\n\n`;
      });

      txtContent += `${'='.repeat(60)}\n`;
      txtContent += `FIM DO HISTÓRICO\n`;
      txtContent += `Exportado em: ${new Date().toLocaleString('pt-BR')}\n`;

      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="dialogo_demanda_${id}_${Date.now()}.txt"`);
      res.send(txtContent);
    } catch (error) {
      res.status(500).json({ error: "Failed to export chat as TXT" });
    }
  });

  // Get markdown content of documents (PRD or Tasks)
  app.get("/api/demands/:id/documents/:type", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const type = req.params.type.toLowerCase();

      if (type !== 'prd' && type !== 'tasks') {
        return res.status(400).json({ error: "Invalid document type. Use 'prd' or 'tasks'" });
      }

      const demand = await storage.getDemand(id);

      if (!demand) {
        return res.status(404).json({ error: "Demand not found" });
      }

      if (demand.status !== 'completed') {
        return res.status(400).json({ error: "Demand is not completed yet" });
      }

      // Find the most recent markdown file
      const documentsDir = path.join(process.cwd(), 'documents');
      const searchType = type === 'prd' ? 'PRD' : 'Tasks';

      const files = fs.readdirSync(documentsDir);
      const markdownFiles = files.filter(file =>
        file.startsWith(`${searchType}_${id}_`) && file.endsWith('.md')
      );

      // Sort files by timestamp (newest first) and get the most recent one
      const markdownFile = markdownFiles
        .sort((a, b) => {
          const timestampA = parseInt(a.split('_')[2]?.replace('.md', '') || '0');
          const timestampB = parseInt(b.split('_')[2]?.replace('.md', '') || '0');
          return timestampB - timestampA; // Descending order (newest first)
        })
        .shift(); // Get the first (most recent) file

      if (!markdownFile) {
        return res.status(404).json({ error: `Markdown file for ${type} not found` });
      }

      const markdownPath = path.join(documentsDir, markdownFile);
      const content = fs.readFileSync(markdownPath, 'utf8');

      res.json({ content });
    } catch (error) {
      console.error('Error fetching markdown document:', error);
      res.status(500).json({ error: "Failed to fetch markdown document" });
    }
  });

  // Stop processing demand
  app.post("/api/demands/:id/stop", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const demand = await storage.getDemand(id);

      if (!demand) {
        return res.status(404).json({ error: "Demand not found" });
      }

      if (demand.status !== 'processing') {
        return res.status(400).json({ error: "Demand is not being processed" });
      }

      aiSquadService.stopProcessing(id);
      res.json({ message: "Stop request sent" });
    } catch (error) {
      res.status(500).json({ error: "Failed to stop processing" });
    }
  });

  // Download document
  app.get("/api/documents/:filename", async (req: Request, res: Response) => {
    try {
      const filename = req.params.filename;
      const filepath = path.join(process.cwd(), 'documents', filename);

      if (!fs.existsSync(filepath)) {
        return res.status(404).json({ error: "Document not found" });
      }

      const isWordDoc = filename.endsWith('.docx');
      const isPdf = filename.endsWith('.pdf');
      const isPRD = filename.includes('PRD');

      if (isWordDoc) {
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
        res.setHeader('Content-Disposition', `attachment; filename="${isPRD ? 'PRD' : 'Tasks'}_${Date.now()}.docx"`);
        const buffer = fs.readFileSync(filepath);
        res.send(buffer);
      } else if (isPdf) {
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${isPRD ? 'PRD' : 'Tasks'}_${Date.now()}.pdf"`);
        const buffer = fs.readFileSync(filepath);
        res.send(buffer);
      } else {
        const content = fs.readFileSync(filepath, 'utf8');
        res.setHeader('Content-Type', 'text/plain');
        res.setHeader('Content-Disposition', `attachment; filename="${isPRD ? 'PRD' : 'Tasks'}_${Date.now()}.txt"`);
        res.send(content);
      }
    } catch (error) {
      res.status(500).json({ error: "Failed to download document" });
    }
  });

  // Server-sent events for real-time updates
  app.get("/api/demands/:id/events", async (req: Request, res: Response) => {
    const id = parseInt(req.params.id);

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*'
    });

    // Adiciona o cliente à lista de conexões SSE no serviço
    const connection = { res, lastEventId: Date.now() };
    aiSquadService.addSSEConnection(id, connection);

    // Envia atualização inicial
    try {
      const demand = await storage.getDemand(id);
      if (demand) {
        res.write(`data: ${JSON.stringify(demand)}\n\n`);
      }
    } catch (error) {
      console.error('Initial SSE error:', error);
    }

    // Atualizações periódicas
    const intervalId = setInterval(async () => {
      try {
        const demand = await storage.getDemand(id);
        if (demand) {
          res.write(`data: ${JSON.stringify(demand)}\n\n`);
        }
      } catch (error) {
        console.error('SSE error:', error);
      }
    }, 2000); // Reduzido o intervalo para atualizações mais rápidas

    req.on('close', () => {
      clearInterval(intervalId);
      // Remove a conexão quando o cliente se desconecta
      aiSquadService.removeSSEConnection(id);
    });
  });

  // Route a demand with intelligent routing
  app.post("/api/demands/:id/route", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const demand = await storage.getDemand(id);

      if (!demand) {
        return res.status(404).json({ error: "Demand not found" });
      }

      // Route the demand using the orchestrator
      const routingPrediction = await demandRoutingOrchestrator.routeDemand(id);

      res.json({
        message: "Demand routed successfully",
        routingPrediction,
        demandId: id
      });
    } catch (error) {
      console.error('Error routing demand:', error);
      res.status(500).json({ error: "Failed to route demand" });
    }
  });

  // Get all registered plugins
  app.get("/api/plugins", (req: Request, res: Response) => {
    try {
      const plugins = demandRoutingOrchestrator.getPlugins();
      res.json({
        plugins: plugins.map(plugin => ({
          name: plugin.name,
          description: plugin.description,
          type: plugin.getSupportedTypes(),
          enabled: plugin.isEnabled(),
          priority: plugin.getPriority()
        }))
      });
    } catch (error) {
      console.error('Error getting plugins:', error);
      res.status(500).json({ error: "Failed to get plugins" });
    }
  });

  // Get metrics for a specific demand
  app.get("/api/demands/:id/metrics", (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const metrics = metricsCollector.getDemandMetricsById(id);

      if (!metrics) {
        return res.status(404).json({ error: "Metrics not found for this demand" });
      }

      res.json(metrics);
    } catch (error) {
      console.error('Error getting demand metrics:', error);
      res.status(500).json({ error: "Failed to get demand metrics" });
    }
  });

  // Get overall system metrics
  app.get("/api/metrics", (req: Request, res: Response) => {
    try {
      const systemMetrics = metricsCollector.getSystemMetrics();

      if (!systemMetrics) {
        return res.status(404).json({ error: "No metrics available yet" });
      }

      res.json(systemMetrics);
    } catch (error) {
      console.error('Error getting system metrics:', error);
      res.status(500).json({ error: "Failed to get system metrics" });
    }
  });

  // Get improvement metrics
  app.get("/api/metrics/improvement", (req: Request, res: Response) => {
    try {
      const improvementMetrics = metricsCollector.calculateImprovementMetrics();

      res.json(improvementMetrics);
    } catch (error) {
      console.error('Error getting improvement metrics:', error);
      res.status(500).json({ error: "Failed to get improvement metrics" });
    }
  });

  // Get demand metrics by type
  app.get("/api/metrics/type/:type", (req: Request, res: Response) => {
    try {
      const type = req.params.type;
      const metrics = metricsCollector.getMetricsByType(type);

      res.json({
        type,
        metrics
      });
    } catch (error) {
      console.error('Error getting metrics by type:', error);
      res.status(500).json({ error: "Failed to get metrics by type" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
