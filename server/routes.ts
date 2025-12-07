
import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertDemandSchema, insertFileSchema } from "@shared/schema";
import { aiSquadService } from "./services/ai-squad";
import { pdfGenerator } from "./services/pdf-generator";
import { gitHubService } from './services/github';
import { codeAnalysisService } from './services/codeAnalysis'; // Import the new service
import multer from "multer";
import path from "path";
import fs from "fs";

const upload = multer({
  dest: 'uploads/',
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

export async function registerRoutes(app: Express): Promise<Server> {

  // GitHub routes
  app.get("/api/github/repos", async (req: Request, res: Response) => {
    try {
      const repos = await gitHubService.listUserRepos();
      res.json(repos);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch repositories" });
    }
  });

  app.get("/api/github/repos/:owner/:repo/content", async (req: Request, res: Response) => {
    try {
      const { owner, repo } = req.params;
      const path = req.query.path as string || '';
      const content = await gitHubService.getRepoContent(owner, repo, path);
      res.json(content);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch repository content" });
    }
  });

  app.post("/api/github/repos/:owner/:repo/index", async (req: Request, res: Response) => {
    try {
      const { owner, repo } = req.params;
      const { demandDescription } = req.body; // Extract demandDescription from body

      const indexedContent = await gitHubService.indexRepo(owner, repo);

      let userPrompt = '';
      if (demandDescription && demandDescription.trim() !== '') {
        userPrompt = `Analise este repositório focando na seguinte demanda: "${demandDescription}". Forneça um resumo dos aspectos relevantes para esta demanda, identifique possíveis soluções ou desafios e sugira os próximos passos.`;
      } else {
        userPrompt = `Realize uma análise geral deste repositório para identificar possíveis funcionalidades, estrutura, e desafios. Considere que este é um modo de descoberta (discovery).`;
      }

      const analysisResult = await codeAnalysisService.analyzeRepo(indexedContent, demandDescription || '', userPrompt);
      
      res.json({ content: indexedContent, analysisResult: analysisResult, demandDescription: demandDescription || null });
    } catch (error) {
      res.status(500).json({ error: "Failed to index repository or analyze code" });
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

  // Create new demand
  app.post("/api/demands", upload.array('files'), async (req: Request, res: Response) => {
    try {
      const demandData = insertDemandSchema.parse(req.body);
      const demand = await storage.createDemand(demandData);

      // Handle uploaded files
      const files = req.files as Express.Multer.File[];
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

      res.json(demand);
    } catch (error) {
      res.status(400).json({ error: "Invalid demand data" });
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

    const intervalId = setInterval(async () => {
      try {
        const demand = await storage.getDemand(id);
        if (demand) {
          res.write(`data: ${JSON.stringify(demand)}\n\n`);
        }
      } catch (error) {
        console.error('SSE error:', error);
      }
    }, 1000);

    req.on('close', () => {
      clearInterval(intervalId);
    });
  });

  // Test PDF generation endpoint
  app.get("/api/test-pdf", async (req: Request, res: Response) => {
    try {
      const testContent = `
# Test PRD Document

## 1. Visão Geral

**Funcionalidade:** Test PDF Generation
**Tipo:** Test
**Prioridade:** High

This is a test document to verify PDF generation works correctly.

## 2. Requisitos Funcionais

- Implementar funcionalidade principal
- Criar testes automatizados
- Documentar solução

## 3. Requisitos Não Funcionais

- Performance: < 2s response time
- Security: Data encryption
`;

      const tasksContent = `
# Test Tasks Document

## 🔧 Backend Tasks

- [ ] Implementar API principal
- [ ] Criar testes unitários
- [ ] Configurar banco de dados

## 🎨 Frontend Tasks

- [ ] Criar interface de usuário
- [ ] Implementar validação de formulário
- [ ] Adicionar animações
`;

      // Generate test PDFs
      const prdPdf = await pdfGenerator.generatePRDDocument(testContent, 999);
      const tasksPdf = await pdfGenerator.generateTasksDocument(tasksContent, 999);

      // Save to documents directory
      const documentsDir = path.join(process.cwd(), 'documents');
      if (!fs.existsSync(documentsDir)) {
        fs.mkdirSync(documentsDir, { recursive: true });
      }

      const prdPath = path.join(documentsDir, 'test_prd.pdf');
      const tasksPath = path.join(documentsDir, 'test_tasks.pdf');

      fs.writeFileSync(prdPath, prdPdf);
      fs.writeFileSync(tasksPath, tasksPdf);

      res.json({
        message: "PDF generation test completed successfully!",
        prdUrl: `/api/documents/test_prd.pdf`,
        tasksUrl: `/api/documents/test_tasks.pdf`
      });
    } catch (error) {
      console.error('Error during PDF generation test:', error);
      res.status(500).json({ error: "Failed to generate test PDFs" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
