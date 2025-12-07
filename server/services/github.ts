
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
      console.warn('No GitHub API key provided. Please set GITHUB_API_TOKEN environment variable.');
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
    const repoUrl = `https://github.com/${owner}/${repo}.git`;
    const tempDir = path.join(process.cwd(), 'temp', repo);

    try {
      await fs.rm(tempDir, { recursive: true, force: true });
      await this.git.clone(repoUrl, tempDir);

      let indexedContent = '';
      const files = await this.readFilesRecursively(tempDir);

      for (const file of files) {
        const content = await fs.readFile(file, 'utf-8');
        indexedContent += `--- FILE: ${path.relative(tempDir, file)} ---\n\n${content}\n\n`;
      }

      await fs.rm(tempDir, { recursive: true, force: true });
      return indexedContent;
    } catch (error) {
      console.error(`Error indexing repository ${owner}/${repo}:`, error);
      throw new Error(`Failed to index repository: ${error}`);
    }
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
