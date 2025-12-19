
import { Octokit } from '@octokit/rest';
import simpleGit, { SimpleGit } from 'simple-git';
import fs from 'fs/promises';
import path from 'path';

// Aproximadamente 200 mil tokens para deixar uma margem de segurança
// para o prompt do modelo (256k tokens total)
const MAX_INDEX_TOKENS = 200000; 

export class GitHubService {
  public client: Octokit;
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
        throw new Error('GITHUB_TOKEN environment variable is not set. Cannot index private repositories directly via API or clone (requires token).');
    }

    try {
      // Attempt to fetch contents directly from GitHub API first
      console.log(`Attempting to index repository ${owner}/${repo} via GitHub API...`);
      const apiIndexedContent = await this.fetchRepoContentsFromApi(owner, repo, githubToken);
      if (apiIndexedContent) {
        console.log(`Repository ${owner}/${repo} indexed successfully via GitHub API.`);
        return apiIndexedContent;
      }
    } catch (apiError: unknown) {
      console.warn(`Failed to index repository ${owner}/${repo} via GitHub API. Error: ${(apiError as Error).message}. Falling back to cloning.`);
      // Check if this is an authentication/permission error
      if ((apiError as Error).message.includes('401') || (apiError as Error).message.includes('403')) {
        console.error(`Authentication/Permission error for ${owner}/${repo}. Check GitHub token permissions.`);
      }
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
    } catch (cloneError: unknown) {
      console.error(`Error indexing repository ${owner}/${repo} via cloning:`, cloneError);
      throw new Error(`Failed to index repository: ${(cloneError as Error).message}`);
    }
  }

  private async fetchRepoContentsFromApi(owner: string, repo: string, githubToken: string): Promise<string | null> {
    const octokit = new Octokit({ auth: githubToken });
    let indexedContent = '';
    let currentTokens = 0;

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

      // Sort files by size or relevance if needed, for now just process as is
      for (const file of filesToProcess) {
        if (currentTokens >= MAX_INDEX_TOKENS) {
            console.warn(`Token limit (${MAX_INDEX_TOKENS}) reached for ${owner}/${repo}. Skipping remaining files.`);
            break;
        }

        if (file.sha) {
          try {
            const { data: fileContent } = await octokit.git.getBlob({
              owner,
              repo,
              file_sha: file.sha,
            });
            // The content is base64 encoded
            const decodedContent = Buffer.from(fileContent.content, 'base64').toString('utf8');
            
            // Estimate tokens (simple character count for now, real tokenizers are more complex)
            const fileTokens = decodedContent.length / 4; // Rough estimate: 1 token ~ 4 characters

            if (currentTokens + fileTokens >= MAX_INDEX_TOKENS) {
                console.warn(`Adding ${file.path} would exceed token limit. Skipping.`);
                break;
            }

            indexedContent += `--- FILE: ${file.path} ---\n\n${decodedContent}\n\n`;
            currentTokens += fileTokens;

          } catch (contentError: unknown) {
            console.warn(`Could not fetch content for ${file.path}: ${(contentError as Error).message}`);
          }
        }
      }
      return indexedContent;

    } catch (error: unknown) {
      console.error(`Failed to fetch repository contents from GitHub API for ${owner}/${repo}: ${(error as Error).message}`);
      return null; // Return null to trigger fallback to cloning
    }
  }

  private isIgnoredPath(filePath: string): boolean {
    const ignoredFolders = ['node_modules', 'dist', 'build', '.git', '.github', '.vscode', '.idea', 'temp', 'uploads', 'documents'];
    return ignoredFolders.some(folder => filePath.includes(`/${folder}/`) || filePath.startsWith(`${folder}/`));
  }

  private isBinaryExtension(filePath: string): boolean {
    const binaryExtensions = [
      '.png', '.jpg', '.jpeg', '.gif', '.pdf', '.zip', '.tar.gz', '.tgz', '.mp4', '.avi', '.mov', '.mp3',
      '.wav', '.ogg', '.exe', '.dll', '.bin', '.obj', '.class', '.jar', '.war', '.ear', '.svg', '.ico',
      '.webp', '.bmp', '.woff', '.woff2', '.ttf', '.eot', '.db', '.sqlite', '.bak', '.log', '.pnp',
      // Added more common binary/irrelevant extensions
      '.lock', '.cache', '.pak', '.dat', '.db', '.DS_Store', '.log', '.bin', '.tmp', '.temp',
      '.sublime-workspace', '.vscode-workspace', '.project', '.classpath', '.settings', '.iml',
      '.pyd', '.so', '.dylib', '.a', '.lib', '.o', '.out', '.elf', '.d', '.suo', '.user', '.pdb',
      '.vs', '.psd', '.ai', '.eps', '.sketch', '.fig', '.xd', '.ase', '.gpl', '.blend', '.obj', '.fbx',
      '.mtl', '.stl', '.dae', '.3ds', '.max', '.maya', '.c4d', '.unity', '.upk', '.udk', '.pak',
      '.uasset', '.umap', '.unitypackage', '.asset', '.prefab', '.controller', '.mat', '.anim',
      '.mesh', '.fbx', '.obj', '.gltf', '.glb', '.vox', '.vdb', '.hdr', '.exr', '.tga', '.dds', '.pvr',
      '.ktx', '.basis', '.astc', '.crn', '.vtf', '.vpk', '.wad', '.bsp', '.mdl', '.vmf', '.vmt',
      '.cfg', '.ini', '.json', // JSON is text, but often config files are too noisy. Can be reconsidered.
      '.txt' // Text files are usually important, but might contain very large logs. Handle with care.
    ];
    // Remove query parameters or hash from path if present
    const cleanPath = filePath.split('?')[0].split('#')[0];
    const extension = path.extname(cleanPath).toLowerCase();
    
    // Explicitly do NOT ignore markdown files, as they often contain valuable context.
    if (extension === '.md' || extension === '.markdown') {
        return false;
    }

    return binaryExtensions.includes(extension);
  }

  private async readFilesRecursively(dir: string): Promise<string[]> {
    const dirents = await fs.readdir(dir, { withFileTypes: true });
    const files = await Promise.all(dirents.map(async (dirent) => {
      const res = path.resolve(dir, dirent.name);
      if (dirent.isDirectory()) {
        // Ignore common unnecessary directories
        if (['.git', 'node_modules', 'dist', 'build', 'temp', 'uploads', 'documents'].includes(dirent.name)) {
          return [];
        }
        return this.readFilesRecursively(res);
      } else {
        // Ignore binary files
        if (this.isBinaryExtension(res)) { // Use the more comprehensive check
          return [];
        }
        return [res];
      }
    }));
    return Array.prototype.concat(...files);
  }
}

export const gitHubService = new GitHubService();
