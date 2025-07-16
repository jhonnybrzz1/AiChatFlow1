import OpenAI from "openai";
import { type Demand, type ChatMessage } from "@shared/schema";
import { storage } from "../storage";
import fs from "fs";
import path from "path";

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY || "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"
});

export class AISquadService {
  private agents = [
    { name: "refinador", icon: "🧠", description: "Iniciando refinamento da demanda..." },
    { name: "scrum_master", icon: "🧝", description: "Analisando impacto no processo e definindo incrementos..." },
    { name: "qa", icon: "✅", description: "Identificando critérios de aceite e cenários de teste..." },
    { name: "ux", icon: "🎨", description: "Avaliando experiência do usuário e fluxo de interação..." },
    { name: "analista_de_dados", icon: "📈", description: "Verificando estrutura de dados e integrações necessárias..." },
    { name: "tech_lead", icon: "💧", description: "Avaliando viabilidade técnica e arquitetura..." },
    { name: "pm", icon: "📋", description: "Gerando PRD e Tasks baseado no refinamento..." }
  ];

  async processDemand(demandId: number, onProgress?: (message: ChatMessage) => void): Promise<void> {
    const demand = await storage.getDemand(demandId);
    if (!demand) throw new Error("Demand not found");

    const refinementLevels = this.getRefinementLevels(demand.type);
    const messages: ChatMessage[] = [];

    for (let i = 0; i < this.agents.length; i++) {
      const agent = this.agents[i];
      const message: ChatMessage = {
        id: `${demandId}-${i}`,
        agent: agent.name,
        message: agent.description,
        timestamp: new Date().toISOString(),
        type: 'processing'
      };

      messages.push(message);
      await storage.updateDemandChat(demandId, messages);
      
      if (onProgress) {
        onProgress(message);
      }

      // Simulate processing time based on agent
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Process with OpenAI for actual agent response
      const response = await this.processWithAgent(agent.name, demand, refinementLevels);
      
      message.message = response;
      message.type = 'completed';
      await storage.updateDemandChat(demandId, messages);
      
      if (onProgress) {
        onProgress(message);
      }
    }

    // Generate documents
    const { prdContent, tasksContent } = await this.generateDocuments(demand, messages);
    
    // Save documents
    const prdPath = await this.saveDocument(demandId, 'PRD', prdContent);
    const tasksPath = await this.saveDocument(demandId, 'Tasks', tasksContent);

    // Update demand with document paths
    await storage.updateDemand(demandId, {
      status: 'completed',
      prdUrl: prdPath,
      tasksUrl: tasksPath
    });
  }

  private getRefinementLevels(type: string): number {
    switch (type) {
      case 'nova_funcionalidade': return 4; // Alto esforço
      case 'melhoria': return 3; // Médio esforço
      case 'bug': return 2; // Baixo esforço
      default: return 3;
    }
  }

  private async processWithAgent(agentName: string, demand: Demand, refinementLevels: number): Promise<string> {
    const intensityLevel = this.getIntensityByType(demand.type);
    
    const prompts = {
      refinador: `Você é o refinador de demandas da squad Redeflex POS. Analise a seguinte ${demand.type} e faça perguntas estratégicas para refinamento com intensidade ${intensityLevel}: ${demand.description}`,
      scrum_master: `Você é o Scrum Master da squad Redeflex POS. Para esta ${demand.type}, analise os riscos de processo e sugira quebras de entrega considerando intensidade ${intensityLevel}: ${demand.description}`,
      qa: `Você é o QA da squad Redeflex POS. Para esta ${demand.type}, identifique critérios de aceite e cenários de teste com intensidade ${intensityLevel}: ${demand.description}`,
      ux: `Você é o UX Designer da squad Redeflex POS. Para esta ${demand.type}, avalie a experiência do usuário e sugira melhorias com intensidade ${intensityLevel}: ${demand.description}`,
      analista_de_dados: `Você é o Analista de Dados da squad Redeflex POS. Para esta ${demand.type}, verifique estrutura de dados e integrações necessárias com intensidade ${intensityLevel}: ${demand.description}`,
      tech_lead: `Você é o Tech Lead da squad Redeflex POS. Para esta ${demand.type}, avalie viabilidade técnica e sugira arquitetura com intensidade ${intensityLevel}: ${demand.description}`,
      pm: `Você é o Product Manager da squad Redeflex POS. Para esta ${demand.type}, organize as informações finais baseado no refinamento com intensidade ${intensityLevel}: ${demand.description}`
    };

    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `Você é um ${agentName} experiente em uma squad de desenvolvimento. Responda SEMPRE em português brasileiro. Seja objetivo e prático nas suas respostas. Tipo de demanda: ${demand.type}. Nível de refinamento: ${refinementLevels}/4. Intensidade de análise: ${intensityLevel}.`
          },
          {
            role: "user",
            content: prompts[agentName as keyof typeof prompts] || `Analise a demanda: ${demand.description}`
          }
        ],
        max_tokens: intensityLevel === 'baixa' ? 300 : intensityLevel === 'media' ? 500 : 800,
        temperature: 0.7
      });

      return response.choices[0].message.content || `${agentName} processou a demanda com sucesso.`;
    } catch (error) {
      console.error(`Error processing with ${agentName}:`, error);
      return `${agentName} encontrou um erro durante o processamento, mas o fluxo continua.`;
    }
  }

  private getIntensityByType(type: string): 'baixa' | 'media' | 'alta' {
    switch (type) {
      case 'bug': return 'baixa';
      case 'melhoria': return 'media';
      case 'nova_funcionalidade': return 'alta';
      default: return 'media';
    }
  }

  private async generateDocuments(demand: Demand, messages: ChatMessage[]): Promise<{ prdContent: string, tasksContent: string }> {
    const context = `
    Demanda: ${demand.title}
    Descrição: ${demand.description}
    Tipo: ${demand.type}
    Prioridade: ${demand.priority}
    
    Respostas dos agentes da squad:
    ${messages.map(msg => `${msg.agent}: ${msg.message}`).join('\n')}
    `;

    try {
      const prdResponse = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: "Você é um Product Manager experiente da squad Redeflex POS. Gere um PRD (Product Requirements Document) estruturado em português brasileiro baseado no contexto fornecido. Use formato profissional com seções bem definidas."
          },
          {
            role: "user",
            content: `Gere um PRD completo e estruturado para:\n${context}`
          }
        ],
        max_tokens: 1500,
        temperature: 0.3
      });

      const tasksResponse = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: "Você é um Product Manager experiente da squad Redeflex POS. Gere uma lista de tasks/user stories estruturadas em português brasileiro baseadas no contexto fornecido. Use formato com ícones 🔧 para Backend e 🎨 para Frontend."
          },
          {
            role: "user",
            content: `Gere tasks organizadas em Backend (🔧) e Frontend (🎨) para:\n${context}`
          }
        ],
        max_tokens: 1500,
        temperature: 0.3
      });

      return {
        prdContent: prdResponse.choices[0].message.content || "PRD gerado com sucesso",
        tasksContent: tasksResponse.choices[0].message.content || "Tasks geradas com sucesso"
      };
    } catch (error) {
      console.error("Error generating documents:", error);
      return {
        prdContent: `PRD para ${demand.title}\n\nDescrição: ${demand.description}\n\nDocumento gerado automaticamente.`,
        tasksContent: `Tasks para ${demand.title}\n\n- [ ] 🔧 Implementar funcionalidade principal\n- [ ] 🔧 Criar testes\n- [ ] 🎨 Documentar solução`
      };
    }
  }

  private async saveDocument(demandId: number, type: string, content: string): Promise<string> {
    const documentsDir = path.join(process.cwd(), 'documents');
    if (!fs.existsSync(documentsDir)) {
      fs.mkdirSync(documentsDir, { recursive: true });
    }

    const filename = `${type}_${demandId}_${Date.now()}.txt`;
    const filepath = path.join(documentsDir, filename);
    
    fs.writeFileSync(filepath, content, 'utf8');
    return `/api/documents/${filename}`;
  }
}

export const aiSquadService = new AISquadService();
