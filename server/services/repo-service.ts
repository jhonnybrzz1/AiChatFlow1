import { eq, and } from 'drizzle-orm';
import { db } from '../db';
import { InsertRepo, InsertRepoFile, Repo, RepoFile, repos, repoFiles } from '@shared/schema';
import { GitHubService } from './github';

export class RepoService {
  private gitHubService: GitHubService;

  constructor() {
    const githubToken = process.env.GITHUB_ACCESS_TOKEN || process.env.GITHUB_TOKEN;
    console.log('RepoService initializing GitHubService with token availability:', !!githubToken);
    if (githubToken) {
      console.log('GitHub token is available, first 5 chars:', githubToken.substring(0, 5) + '...');
      // Validate token format
      if (!githubToken.startsWith('ghp_') && !githubToken.startsWith('github_pat_')) {
        console.warn('Warning: GitHub token may be in an incorrect format. Should start with "ghp_" or "github_pat_".');
      }
    }
    this.gitHubService = new GitHubService(githubToken || undefined);
  }

  /**
   * Get or create a repository in the database
   * @param owner - Repository owner
   * @param name - Repository name
   * @returns The repository record
   */
  async getOrCreateRepo(owner: string, name: string): Promise<Repo> {
    // First try to get existing repo
    const existingRepo = await db.select().from(repos).where(
      eq(repos.fullName, `${owner}/${name}`)
    ).limit(1);

    if (existingRepo.length > 0) {
      return existingRepo[0];
    }

    // If repo doesn't exist, try to fetch from GitHub and create
    let repoData;
    try {
      console.log(`Fetching repository metadata for ${owner}/${name} from GitHub`);
      repoData = await this.gitHubService.client.repos.get({
        owner,
        repo: name
      });
      console.log(`Successfully fetched repository metadata for ${owner}/${name}`);
    } catch (error: any) {
      console.error(`Could not fetch repository metadata for ${owner}/${name} from GitHub:`, error.message || error);
      const errorStatus = (error as any)?.status || 'Unknown status';
      console.error(`GitHub API error details - Status: ${errorStatus}`);
      // Create a minimal repo object with basic information
      repoData = {
        data: {
          id: Date.now(), // Use timestamp as temporary ID
          node_id: '',
          name,
          full_name: `${owner}/${name}`,
          owner: { login: owner },
          private: false,
          html_url: `https://github.com/${owner}/${name}`,
          description: 'Repository data not available (no GitHub access)',
          fork: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          size: 0,
          stargazers_count: 0,
          watchers_count: 0,
          language: null,
          has_issues: true,
          has_projects: true,
          has_wiki: true,
          default_branch: 'main'
        }
      };
    }

    const newRepo: InsertRepo = {
      owner,
      name,
      fullName: repoData.data.full_name || `${owner}/${name}`,
      description: repoData.data.description || null,
      url: repoData.data.url || `https://github.com/${owner}/${name}`,
      cloneUrl: repoData.data.clone_url || null,
      sshUrl: repoData.data.ssh_url || null,
      htmlUrl: repoData.data.html_url || `https://github.com/${owner}/${name}`,
      defaultBranch: repoData.data.default_branch || 'main',
      language: repoData.data.language || null,
      size: repoData.data.size || 0,
      stars: repoData.data.stargazers_count || 0,
      forks: repoData.data.forks_count || 0,
      isPrivate: repoData.data.private || false,
      isFork: repoData.data.fork || false,
      indexedContent: null, // Will be populated later
      lastCommit: null, // Will be populated later
    };

    const [createdRepo] = await db.insert(repos).values(newRepo).returning();
    return createdRepo;
  }

  /**
   * Index a repository and store its content
   * @param owner - Repository owner
   * @param name - Repository name
   * @returns The indexed repository content
   */
  async indexRepo(owner: string, name: string): Promise<string> {
    console.log(`Starting repository indexing for ${owner}/${name}`);
    // Get or create the repo record
    const repo = await this.getOrCreateRepo(owner, name);
    console.log(`Repository record retrieved/created for ${owner}/${name}, ID: ${repo.id}`);

    // Index the repository content using the GitHub service
    let indexedContent;
    try {
      console.log(`Calling GitHubService.indexRepo for ${owner}/${name}`);
      indexedContent = await this.gitHubService.indexRepo(owner, name);
      console.log(`Successfully indexed repository content for ${owner}/${name}`);
    } catch (error: any) {
      console.error(`Could not index repository ${owner}/${name} from GitHub. Using fallback approach.`);
      
      // Enhanced error logging
      let errorMessage = 'Unknown error';
      let errorType = 'unknown';
      let errorDetails = {};
      
      if (error instanceof Error) {
        errorMessage = error.message;
        errorType = 'Error';
        errorDetails = {
          message: error.message,
          name: error.name,
          stack: error.stack?.substring(0, 200) + '...'
        };
      } else if (error && typeof error === 'object') {
        errorMessage = error.message || 'Unknown error';
        errorType = error.type || 'unknown';
        errorDetails = {
          type: error.type,
          message: error.message,
          timeStamp: error.timeStamp,
          defaultPrevented: error.defaultPrevented,
          cancelable: error.cancelable
        };
        
        if (error.type === 'error') {
          console.error('ErrorEvent detected in repoService:', errorDetails);
        }
      }
      
      console.error(`Error details - Type: ${errorType}, Message: ${errorMessage}`);
      console.error('Full error object:', error);
      
      // Fallback: create minimal content if indexing fails
      indexedContent = `# Repository: ${owner}/${name}\n\nRepository content could not be indexed. This may be due to:\n- GitHub token permissions\n- Private repository access\n- Network connectivity issues\n\nConsider uploading repository files directly or ensuring proper GitHub token permissions.\n\nLast attempt: ${new Date().toISOString()}\n\nError type: ${errorType}\nError details: ${JSON.stringify(errorDetails, null, 2)}`;
    }

    // Update the repo with indexed content and timestamp
    console.log(`Updating repository record with indexed content for ${owner}/${name}`);
    await db.update(repos).set({
      indexedContent,
      indexedAt: new Date(),
      updatedAt: new Date()
    }).where(eq(repos.id, repo.id));

    // Parse and store individual files
    try {
      console.log(`Storing repository files for ${owner}/${name}`);
      await this.storeRepoFiles(owner, name, indexedContent, repo.id);
      console.log(`Successfully stored repository files for ${owner}/${name}`);
    } catch (error: any) {
      console.error(`Could not store repository files for ${owner}/${name}:`, error.message || error);
      // Continue with the indexed content even if file storage fails
    }

    console.log(`Completed repository indexing for ${owner}/${name}`);
    return indexedContent;
  }

  /**
   * Store individual files from indexed content
   * @param owner - Repository owner
   * @param name - Repository name
   * @param indexedContent - Full indexed content
   * @param repoId - ID of the parent repository
   */
  private async storeRepoFiles(owner: string, name: string, indexedContent: string, repoId: number): Promise<void> {
    // Clear existing files for this repo
    await db.delete(repoFiles).where(eq(repoFiles.repoId, repoId));
    
    // Parse the indexed content to extract individual files
    // The content format is: "--- FILE: path ---\n\nfile_content\n\n"
    const fileSections = indexedContent.split('--- FILE: ');
    
    for (let i = 1; i < fileSections.length; i++) { // Skip first empty section
      const section = fileSections[i];
      const endOfFileHeader = section.indexOf(' ---');
      
      if (endOfFileHeader === -1) continue; // Invalid format
      
      const filename = section.substring(0, endOfFileHeader);
      const contentStart = section.indexOf('\n\n', endOfFileHeader) + 2;
      const contentEnd = section.indexOf('\n\n--- FILE: ') !== -1 
        ? section.indexOf('\n\n--- FILE: ') 
        : section.length;
      
      const content = section.substring(contentStart, contentEnd);
      
      const fileExtension = filename.split('.').pop()?.toLowerCase() || '';
      const language = this.getLanguageFromExtension(fileExtension);
      
      const repoFile: InsertRepoFile = {
        repoId,
        path: filename,
        filename: filename.split('/').pop() || filename,
        content,
        language,
        size: content.length,
        url: `https://github.com/${owner}/${name}/blob/main/${filename}`
      };
      
      await db.insert(repoFiles).values(repoFile);
    }
  }

  /**
   * Get language from file extension
   * @param ext - File extension
   * @returns Language name
   */
  private getLanguageFromExtension(ext: string): string | null {
    const extToLang: Record<string, string> = {
      'js': 'JavaScript',
      'ts': 'TypeScript',
      'jsx': 'JavaScript',
      'tsx': 'TypeScript',
      'py': 'Python',
      'java': 'Java',
      'cpp': 'C++',
      'c': 'C',
      'cs': 'C#',
      'go': 'Go',
      'rb': 'Ruby',
      'php': 'PHP',
      'html': 'HTML',
      'css': 'CSS',
      'json': 'JSON',
      'yaml': 'YAML',
      'yml': 'YAML',
      'md': 'Markdown',
      'sql': 'SQL',
      'sh': 'Shell',
      'bash': 'Shell',
      'dockerfile': 'Dockerfile',
      'txt': 'Plain Text',
      'xml': 'XML',
      'vue': 'Vue',
      'svelte': 'Svelte',
      'rs': 'Rust',
      'swift': 'Swift',
      'kt': 'Kotlin',
      'scala': 'Scala',
      'dart': 'Dart',
      'jl': 'Julia',
      'r': 'R',
      'pl': 'Perl'
    };
    
    return extToLang[ext] || null;
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