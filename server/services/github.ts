
import { Octokit } from '@octokit/rest';
import simpleGit, { SimpleGit } from 'simple-git';
import fs from 'fs/promises';
import path from 'path';

export class GitHubService {
  private client: Octokit;
  private git: SimpleGit;

  constructor(apiKey?: string) {
    const envApiKey = process.env.GITHUB_TOKEN;
    
    console.log('--- GitHubService Initialization ---');
    console.log('process.env.GITHUB_TOKEN:', process.env.GITHUB_TOKEN ? (process.env.GITHUB_TOKEN.substring(0, 5) + '...') : 'undefined');
    console.log('process.env.NODE_ENV:', process.env.NODE_ENV);
    console.log('------------------------------------');

    if (!apiKey && !envApiKey) {
      console.warn('No GitHub API key provided. Please set GITHUB_TOKEN environment variable.');
    } else {
      console.log('GitHub API Key loaded (first 5 chars):', (apiKey || envApiKey || '').substring(0, 5) + '...');
    }

    this.client = new Octokit({
      auth: apiKey || envApiKey || ''
    });
    this.git = simpleGit();
  }

  async listUserRepos() {
    try {
      const repos = await this.client.repos.listForAuthenticatedUser();
      return repos.data;
    } catch (error) {
      console.error('Error listing user repositories:', error);
      throw new Error(`Failed to list user repositories: ${error}`);
    }
  }

  async getRepoContent(owner: string, repo: string, path: string = '') {
    try {
      const content = await this.client.repos.getContent({
        owner,
        repo,
        path,
      });
      return content.data;
    } catch (error) {
      console.error(`Error getting repository content for ${owner}/${repo}/${path}:`, error);
      throw new Error(`Failed to get repository content: ${error}`);
    }
  }

  async indexRepo(owner: string, repo: string): Promise<string> {
    const githubToken = process.env.GITHUB_TOKEN;

    if (!githubToken) {
        // Fallback to clone if no token is provided for API access, assuming it's a public repo
        // or the clone method handles authentication differently (e.g., SSH keys)
        // For now, we throw as the clone method also relies on this token for private repos
        throw new Error('GITHUB_TOKEN environment variable is not set. Cannot index private repositories directly via API or clone.');
    }

    try {
      // Attempt to fetch contents directly from GitHub API first
      const apiIndexedContent = await this.fetchRepoContentsFromApi(owner, repo, githubToken);
      if (apiIndexedContent) {
        console.log(`Repository ${owner}/${repo} indexed successfully via GitHub API.`);
        return apiIndexedContent;
      }
    } catch (apiError) {
      console.warn(`Failed to index repository ${owner}/${repo} via GitHub API (Error: ${apiError.message}). Falling back to cloning.`);
      // Fall through to cloning if API indexing fails
    }

    // Fallback to cloning if API indexing fails or is not preferred for some reason
    const authenticatedRepoUrl = `https://${githubToken}:x-oauth-basic@github.com/${owner}/${repo}.git`;
    const tempDir = path.join(process.cwd(), 'temp', repo);

    try {
      await fs.rm(tempDir, { recursive: true, force: true });
      await this.git.clone(authenticatedRepoUrl, tempDir);

      let indexedContent = '';
      const files = await this.readFilesRecursively(tempDir);

      for (const file of files) {
        const content = await fs.readFile(file, 'utf-8');
        indexedContent += `--- FILE: ${path.relative(tempDir, file)} ---\n\n${content}\n\n`;
      }

      await fs.rm(tempDir, { recursive: true, force: true });
      console.log(`Repository ${owner}/${repo} indexed successfully via cloning.`);
      return indexedContent;
    } catch (cloneError) {
      console.error(`Error indexing repository ${owner}/${repo} via cloning:`, cloneError);
      throw new Error(`Failed to index repository: ${cloneError.message}`);
    }
  }

  private async fetchRepoContentsFromApi(owner: string, repo: string, githubToken: string): Promise<string | null> {
    const octokit = new Octokit({ auth: githubToken });
    let indexedContent = '';

    try {
      // Get the default branch of the repository
      const { data: repoInfo } = await octokit.repos.get({ owner, repo });
      const defaultBranch = repoInfo.default_branch;

      // Get the tree of the default branch, recursively
      const { data: tree } = await octokit.git.getTree({
        owner,
        repo,
        tree_sha: defaultBranch,
        recursive: 'true',
      });

      const filesToProcess = tree.tree.filter(item =>
        item.type === 'blob' && // Only files
        item.path &&
        !this.isIgnoredPath(item.path) && // Ignore heavy/irrelevant folders
        !this.isBinaryExtension(item.path) // Ignore binary files
      );

      for (const file of filesToProcess) {
        if (file.sha) {
          try {
            const { data: fileContent } = await octokit.git.getBlob({
              owner,
              repo,
              file_sha: file.sha,
            });
            // The content is base64 encoded
            const decodedContent = Buffer.from(fileContent.content, 'base64').toString('utf8');
            indexedContent += `--- FILE: ${file.path} ---\n\n${decodedContent}\n\n`;
          } catch (contentError) {
            console.warn(`Could not fetch content for ${file.path}: ${contentError.message}`);
          }
        }
      }
      return indexedContent;

    } catch (error) {
      console.error(`Failed to fetch repository contents from GitHub API for ${owner}/${repo}: ${error.message}`);
      return null; // Return null to trigger fallback to cloning
    }
  }

  private isIgnoredPath(filePath: string): boolean {
    const ignoredFolders = ['node_modules', 'dist', 'build', '.git', '.github', '.vscode', '.idea'];
    return ignoredFolders.some(folder => filePath.includes(`/${folder}/`) || filePath.startsWith(`${folder}/`));
  }

  private isBinaryExtension(filePath: string): boolean {
    const binaryExtensions = [
      '.png', '.jpg', '.jpeg', '.gif', '.pdf', '.zip', '.tar.gz', '.tgz', '.mp4', '.avi', '.mov', '.mp3',
      '.wav', '.ogg', '.exe', '.dll', '.bin', '.obj', '.class', '.jar', '.war', '.ear', '.svg', '.ico',
      '.webp', '.bmp', '.woff', '.woff2', '.ttf', '.eot', '.db', '.sqlite', '.bak', '.log', '.lock',
      '.pnp', '.yarn', '.gradle', '.jar', '.log', '.md', '.markdown', // Consider markdown as text, but can be ignored if too noisy
    ];
    // Remove query parameters or hash from path if present
    const cleanPath = filePath.split('?')[0].split('#')[0];
    const extension = path.extname(cleanPath).toLowerCase();
    return binaryExtensions.includes(extension);
  }

  private async readFilesRecursively(dir: string): Promise<string[]> {
    const dirents = await fs.readdir(dir, { withFileTypes: true });
    const files = await Promise.all(dirents.map(async (dirent) => {
      const res = path.resolve(dir, dirent.name);
      if (dirent.isDirectory()) {
        // Ignore common unnecessary directories
        if (['.git', 'node_modules', 'dist', 'build'].includes(dirent.name)) {
          return [];
        }
        return this.readFilesRecursively(res);
      } else {
        // Ignore binary files
        const binaryExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.pdf', '.zip', '.tar.gz'];
        if (binaryExtensions.some(ext => dirent.name.endsWith(ext))) {
          return [];
        }
        return [res];
      }
    }));
    return Array.prototype.concat(...files);
  }
}

export const gitHubService = new GitHubService();
