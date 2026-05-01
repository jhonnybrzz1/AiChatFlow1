import { eq, and } from 'drizzle-orm';
import { db } from '../db';
import { InsertRepo, InsertRepoFile, Repo, RepoFile, repos, repoFiles } from '@shared/schema';
import { GitHubService } from './github';
import { mistralAIService } from './mistral-ai';

const isSupportedGitHubToken = (token: string): boolean =>
  token.startsWith('github_pat_');

export class RepoService {
  private gitHubService: GitHubService;

  constructor() {
    const githubToken = process.env.GITHUB_ACCESS_TOKEN || process.env.GITHUB_TOKEN;
    console.log('RepoService initializing GitHubService with token availability:', !!githubToken);
    if (githubToken) {
      console.log('GitHub token is available');
      // Validate token format
      if (!isSupportedGitHubToken(githubToken)) {
        console.warn('Warning: Use a fine-grained GitHub personal access token that starts with "github_pat_" and grants repository read-only permissions.');
      }
    }
    this.gitHubService = new GitHubService(githubToken || undefined);
  }

  async generateStructuralContext(owner: string, name: string): Promise<void> {
    console.log(`Iniciando geração de contexto estrutural para ${owner}/${name}`);
    const repo = await this.getOrCreateRepo(owner, name);

    // 1. Coletar dados do repositório
    const { defaultBranch } = repo;
    if (!defaultBranch) {
      console.error(`Branch padrão não encontrado para ${owner}/${name}.`);
      return;
    }

    let fileTree = '';
    let keyFilesContent = '';

    try {
      // Primeiro, verificar se o repositório é acessível
      try {
        console.log(`Verificando acessibilidade do repositório ${owner}/${name}`);
        const repoCheck = await this.gitHubService.client.repos.get({ owner, repo: name });
        console.log(`Repositório ${owner}/${name} é acessível`);
      } catch (checkError) {
        console.error(`Repositório ${owner}/${name} não é acessível ou não existe:`, checkError);
        // Se o repositório não é acessível, não tente gerar o contexto
        return;
      }

      // Buscar a árvore de arquivos completa
      try {
        console.log(`Buscando árvore de arquivos para ${owner}/${name} no branch ${defaultBranch}`);
        const treeData = await this.gitHubService.client.git.getTree({
          owner,
          repo: name,
          tree_sha: defaultBranch,
          recursive: 'true',
        });
        if (treeData.data.truncated) {
          console.warn(`A árvore de arquivos para ${owner}/${name} está truncada.`);
        }
        fileTree = treeData.data.tree.map(file => file.path).join('\n');
        console.log(`Árvore de arquivos obtida com sucesso. Total de arquivos: ${treeData.data.tree.length}`);
      } catch (treeError) {
        console.error(`Erro ao buscar árvore de arquivos para ${owner}/${name}:`, treeError);
        // Se não conseguirmos a árvore de arquivos, não podemos gerar o contexto
        return;
      }

      // Identificar e ler o conteúdo de arquivos chave
      const keyFiles = ['package.json', 'pom.xml', 'build.gradle', 'requirements.txt', 'docker-compose.yml', 'README.md', 'ARCHITECTURE.md', 'tsconfig.json'];
      try {
        console.log(`Buscando conteúdo da raiz para identificar arquivos chave`);
        const rootContent = await this.gitHubService.getRepoContent(owner, name);
        const filesToRead = (rootContent as any[]).filter(item => item.type === 'file' && keyFiles.includes(item.name));
        console.log(`Arquivos chave encontrados: ${filesToRead.map(f => f.name).join(', ')}`);

        for (const file of filesToRead) {
          try {
            const content = await this.gitHubService.getRepoContent(owner, name, file.path);
            if (content && content.encoding === 'base64') {
              const decodedContent = Buffer.from(content.content, 'base64').toString('utf8');
              keyFilesContent += `--- CONTEÚDO DO ARQUIVO: ${file.path} ---\n${decodedContent}\n\n`;
            }
          } catch (fileError) {
            console.error(`Erro ao ler arquivo ${file.path}:`, fileError);
            // Continue com os outros arquivos mesmo se um falhar
          }
        }
      } catch (contentError) {
        console.error(`Erro ao buscar conteúdo da raiz para ${owner}/${name}:`, contentError);
        // Continue mesmo sem os arquivos chave
      }
    } catch (error) {
      console.error(`Erro ao coletar dados para o contexto estrutural de ${owner}/${name}:`, error);
      // Mesmo com erro, tenta continuar com o que tiver
    }

    // 2. Criar o prompt para a IA
    const systemPrompt = `Você é um Arquiteto de Software Sênior. Sua tarefa é analisar a estrutura de um repositório de código e gerar um "Repository Briefing" e um "System Map".

Responda em formato JSON com a seguinte estrutura:
{
  "repositoryBriefing": {
    "projectType": "monolito | microserviços | biblioteca | outro",
    "techStack": ["Tecnologia 1", "Tecnologia 2", ...],
    "architecturalPattern": "MVC | MVVM | Camadas | Hexagonal | Event-Driven | Desconhecido",
    "technicalStage": "estável | legado parcial | refatoração contínua | em desenvolvimento ativo",
    "criticalAreas": ["auth | billing | core-logic | ..."],
    "sensitiveAreas": ["migrations | feature-flags | external-integrations | ..."]
  },
  "systemMap": "PASTA / -> descrição (TAGS)\\n  PASTA /src -> código fonte (CRÍTICO)\\n    PASTA /src/api -> camada de api\\n  PASTA /test -> testes (SENSÍVEL)"
}

- projectType: Classifique o tipo de projeto.
- techStack: Liste as principais tecnologias, frameworks e linguagens.
- architecturalPattern: Identifique o padrão de arquitetura principal.
- technicalStage: Avalie o estágio técnico do projeto.
- criticalAreas: Identifique diretórios ou módulos que são o coração do sistema.
- sensitiveAreas: Identifique áreas que não devem ser alteradas sem cuidado (ex: configurações, migrações).
- systemMap: Crie um mapa de pastas simplificado, com uma breve descrição e tags como (CRÍTICO), (SENSÍVEL), (LEGADO). Use indentação para hierarquia.`;

    const userPrompt = `Analise os seguintes dados do repositório "${owner}/${name}":

--- ÁRVORE DE ARQUIVOS ---
${fileTree}

--- CONTEÚDO DE ARQUIVOS CHAVE ---
${keyFilesContent}

Gere o "Repository Briefing" e o "System Map" no formato JSON solicitado.`;

    // 3. Chamar a IA para gerar o contexto
    try {
      const response = await mistralAIService.generateChatCompletion(systemPrompt, userPrompt, { maxTokens: 4000 });
      const contextJson = JSON.parse(response);

      // 4. Salvar no banco de dados
      await db.update(repos).set({
        briefing: JSON.stringify(contextJson.repositoryBriefing, null, 2),
        systemMap: contextJson.systemMap,
        briefingGeneratedAt: new Date(),
        systemMapGeneratedAt: new Date(),
        updatedAt: new Date(),
      }).where(eq(repos.id, repo.id));

      console.log(`Contexto estrutural gerado e salvo para ${owner}/${name}`);

    } catch (error) {
      console.error(`Erro ao gerar ou salvar o contexto estrutural para ${owner}/${name}:`, error);
    }
  }

  // Track ongoing context generation to prevent duplicate calls
  private ongoingContextGeneration = new Set<string>();

  /**
   * Get or create a repository in the database
   * @param owner - Repository owner
   * @param name - Repository name
   * @returns The repository record
   */
  async getOrCreateRepo(owner: string, name: string): Promise<Repo> {
    const repo = await db.select().from(repos).where(
      eq(repos.fullName, `${owner}/${name}`)
    ).limit(1);

    // Se o repositório já existe, verifica se o briefing precisa ser atualizado
    if (repo) {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      // Se o briefing não existe ou é mais antigo que 7 dias, gera em segundo plano
      if (!repo.briefing || !repo.briefingGeneratedAt || repo.briefingGeneratedAt < sevenDaysAgo) {
        const repoKey = `${owner}/${name}`;
        if (!this.ongoingContextGeneration.has(repoKey)) {
          this.ongoingContextGeneration.add(repoKey);
          console.log(`Briefing para ${owner}/${name} está desatualizado ou não existe. Gerando em segundo plano...`);
          this.generateStructuralContext(owner, name).catch(error => {
            console.error(`Erro na geração de contexto em segundo plano para ${owner}/${name}:`, error);
          }).finally(() => {
            this.ongoingContextGeneration.delete(repoKey);
          });
        } else {
          console.log(`Geração de contexto já em andamento para ${owner}/${name}. Pulando chamada duplicada.`);
        }
      }
      return repo;
    }

    // Se o repositório não existe, busca no GitHub e cria
    let repoDataFromGitHub;
    try {
      console.log(`Fetching repository metadata for ${owner}/${name} from GitHub`);
      const response = await this.gitHubService.client.repos.get({ owner, repo: name });
      repoDataFromGitHub = response.data;
      console.log(`Successfully fetched repository metadata for ${owner}/${name}`);
    } catch (error: any) {
      console.error(`Could not fetch repository metadata for ${owner}/${name} from GitHub. Creating minimal repo record.`);
      repoDataFromGitHub = {
        name,
        full_name: `${owner}/${name}`,
        owner: { login: owner },
        description: 'Repositório não acessível via API do GitHub.',
        html_url: `https://github.com/${owner}/${name}`,
        default_branch: 'main',
        language: null,
        size: 0,
        stargazers_count: 0,
        forks_count: 0,
        private: false,
        fork: false,
      };
    }

    const newRepo: InsertRepo = {
      owner,
      name,
      fullName: repoDataFromGitHub.full_name,
      description: repoDataFromGitHub.description,
      url: `https://github.com/${owner}/${name}`,
      cloneUrl: repoDataFromGitHub.clone_url,
      sshUrl: repoDataFromGitHub.ssh_url,
      htmlUrl: repoDataFromGitHub.html_url,
      defaultBranch: repoDataFromGitHub.default_branch,
      language: repoDataFromGitHub.language,
      size: repoDataFromGitHub.size,
      stars: repoDataFromGitHub.stargazers_count,
      forks: repoDataFromGitHub.forks_count,
      isPrivate: repoDataFromGitHub.private,
      isFork: repoDataFromGitHub.fork,
    };

    const [createdRepo] = await db.insert(repos).values(newRepo).returning();

    // Dispara a geração de contexto em segundo plano para o novo repositório
    const repoKey = `${owner}/${name}`;
    if (!this.ongoingContextGeneration.has(repoKey)) {
      this.ongoingContextGeneration.add(repoKey);
      console.log(`Disparando geração de contexto inicial para o novo repositório ${owner}/${name}...`);
      this.generateStructuralContext(owner, name).catch(error => {
        console.error(`Erro na geração de contexto inicial em segundo plano para ${owner}/${name}:`, error);
      }).finally(() => {
        this.ongoingContextGeneration.delete(repoKey);
      });
    } else {
      console.log(`Geração de contexto já em andamento para ${owner}/${name}. Pulando chamada duplicada.`);
    }

    return createdRepo;
  }

  /**
   * Get a repository and its files from the database
   * @param owner - Repository owner
   * @param name - Repository name
   * @returns Repository with files
   */
  async getRepoWithFiles(owner: string, name: string): Promise<{ repo: Repo, files: RepoFile[] } | null> {
    const repo = await db.select().from(repos).where(
      eq(repos.fullName, `${owner}/${name}`)
    ).limit(1);
    
    if (repo.length === 0) {
      return null;
    }
    
    const files = await db.select().from(repoFiles).where(
      eq(repoFiles.repoId, repo[0].id)
    );
    
    return {
      repo: repo[0],
      files
    };
  }

  /**
   * Get a specific file from a repository
   * @param repoId - Repository ID
   * @param path - File path
   * @returns The repository file
   */
  async getRepoFile(repoId: number, path: string): Promise<RepoFile | null> {
    const files = await db.select().from(repoFiles).where(
      and(
        eq(repoFiles.repoId, repoId),
        eq(repoFiles.path, path)
      )
    ).limit(1);
    
    return files.length > 0 ? files[0] : null;
  }

  /**
   * Get all repositories from the database
   */
  async getAllRepos(): Promise<Repo[]> {
    return await db.select().from(repos);
  }

  /**
   * Get all files for a specific repository
   * @param repoId - Repository ID
   */
  async getRepoFiles(repoId: number): Promise<RepoFile[]> {
    return await db.select().from(repoFiles).where(
      eq(repoFiles.repoId, repoId)
    );
  }

  /**
   * Update repository metadata
   * @param repoId - Repository ID
   * @param updates - Fields to update
   */
  async updateRepo(repoId: number, updates: Partial<Repo>): Promise<Repo> {
    const [updatedRepo] = await db.update(repos).set({
      ...updates,
      updatedAt: new Date()
    }).where(eq(repos.id, repoId)).returning();
    
    return updatedRepo;
  }
}

export const repoService = new RepoService();
