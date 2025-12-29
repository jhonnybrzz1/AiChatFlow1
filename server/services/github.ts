
import { Octokit } from '@octokit/rest';
import simpleGit, { SimpleGit } from 'simple-git';
import fs from 'fs/promises';
import path from 'path';

// Aumentado para 1 milhão de tokens para lidar com repositórios maiores
// Isso ainda deixa margem para o prompt do modelo (256k tokens total)
const MAX_INDEX_TOKENS = 1000000;

export class GitHubService {
  public client: Octokit;
  private git: SimpleGit;

  constructor(apiKey?: string) {
    const envApiKey = process.env.GITHUB_ACCESS_TOKEN || process.env.GITHUB_TOKEN;

    console.log('--- GitHubService Initialization ---');
    console.log('process.env.GITHUB_ACCESS_TOKEN:', process.env.GITHUB_ACCESS_TOKEN ? (process.env.GITHUB_ACCESS_TOKEN.substring(0, 5) + '...') : 'undefined');
    console.log('process.env.GITHUB_TOKEN:', process.env.GITHUB_TOKEN ? (process.env.GITHUB_TOKEN.substring(0, 5) + '...') : 'undefined');
    console.log('process.env.NODE_ENV:', process.env.NODE_ENV);
    console.log('------------------------------------');

    if (!apiKey && !envApiKey) {
      console.warn('No GitHub API key provided. Please set GITHUB_ACCESS_TOKEN environment variable.');
    } else {
      console.log('GitHub API Key loaded (first 5 chars):', (apiKey || envApiKey || '').substring(0, 5) + '...');
      // Validate token format
      const token = apiKey || envApiKey;
      if (token && !token.startsWith('ghp_') && !token.startsWith('github_pat_')) {
        console.warn('Warning: GitHub token may be in an incorrect format. Should start with "ghp_" or "github_pat_".');
      }
    }

    // Initialize Octokit with proper configuration
    const auth = apiKey || envApiKey || '';
    if (!auth) {
      console.warn('Warning: No GitHub authentication token provided. API calls may fail.');
    }

    // Create Octokit client with error handling
    try {
      this.client = new Octokit({
        auth: auth,
        userAgent: 'AiChatFlow/1.0.0',
        baseUrl: 'https://api.github.com',
        request: {
          timeout: 30000, // 30 seconds timeout to allow for larger repositories
        }
      });
      console.log('Octokit client initialized successfully');

      // Test the client with a simple authenticated request
      console.log('Testing Octokit client with authenticated request...');
    } catch (error) {
      console.error('Failed to initialize Octokit client:', error);
      // Create a client that will fail gracefully
      this.client = new Octokit({ auth: auth }); // Still use auth to avoid complete failure
    }

    // Initialize simple-git with proper error handling
    try {
      this.git = simpleGit();
      console.log('simple-git initialized successfully');
    } catch (gitError) {
      console.error('Failed to initialize simple-git:', gitError);
      // Create a minimal git instance that will fail gracefully
      this.git = {
        clone: async () => {
          throw new Error('simple-git not available. Cannot perform git operations.');
        }
      } as any;
    }
  }

  async listUserRepos() {
    // Check if we have a valid token before making the API call
    const githubToken = process.env.GITHUB_ACCESS_TOKEN || process.env.GITHUB_TOKEN;
    if (!githubToken) {
      throw new Error('GITHUB_ACCESS_TOKEN or GITHUB_TOKEN environment variable is not set.');
    }

    // Validate token format
    if (!githubToken.startsWith('ghp_') && !githubToken.startsWith('github_pat_')) {
      throw new Error('Invalid GitHub token format. Must start with "ghp_" or "github_pat_".');
    }

    try {
      console.log('Listing user repositories from GitHub API');
      const repos = await this.client.repos.listForAuthenticatedUser();
      console.log(`Successfully listed ${repos.data.length} repositories from GitHub API`);
      return repos.data;
    } catch (error) {
      console.error('Error listing user repositories:', error);
      console.error(`Error type: ${typeof error}`);
      if (error && typeof error === 'object' && 'type' in error) {
        console.error(`Error event type: ${(error as any).type}`);
      }
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStatus = (error as any)?.status || 'Unknown status';
      console.error(`GitHub API error details - Status: ${errorStatus}, Message: ${errorMessage}`);
      throw new Error(`Failed to list user repositories: [${errorStatus}] ${errorMessage}`);
    }
  }

  async getRepoContent(owner: string, repo: string, path: string = '') {
    // Check if we have a valid token before making the API call
    const githubToken = process.env.GITHUB_ACCESS_TOKEN || process.env.GITHUB_TOKEN;
    if (!githubToken) {
      throw new Error('GITHUB_ACCESS_TOKEN or GITHUB_TOKEN environment variable is not set.');
    }

    // Validate token format
    if (!githubToken.startsWith('ghp_') && !githubToken.startsWith('github_pat_')) {
      throw new Error('Invalid GitHub token format. Must start with "ghp_" or "github_pat_".');
    }

    try {
      console.log(`Fetching repository content for ${owner}/${repo}/${path}`);
      const content = await this.client.repos.getContent({
        owner,
        repo,
        path,
      });
      console.log(`Successfully fetched repository content for ${owner}/${repo}/${path}`);
      return content.data;
    } catch (error) {
      console.error(`Error getting repository content for ${owner}/${repo}/${path}:`, error);
      console.error(`Error type: ${typeof error}`);
      if (error && typeof error === 'object' && 'type' in error) {
        console.error(`Error event type: ${(error as any).type}`);
      }
      // Provide more specific error information
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStatus = (error as any)?.status || 'Unknown status';
      console.error(`GitHub API error details - Status: ${errorStatus}, Message: ${errorMessage}`);
      throw new Error(`Failed to get repository content: [${errorStatus}] ${errorMessage}`);
    }
  }

  async indexRepo(owner: string, repo: string): Promise<string> {
    const githubToken = process.env.GITHUB_ACCESS_TOKEN || process.env.GITHUB_TOKEN;

    if (!githubToken) {
        throw new Error('GITHUB_ACCESS_TOKEN or GITHUB_TOKEN environment variable is not set. Cannot index private repositories directly via API or clone (requires token).');
    }

    // Validate token format
    if (!githubToken.startsWith('ghp_') && !githubToken.startsWith('github_pat_')) {
      throw new Error('Invalid GitHub token format. Must start with "ghp_" or "github_pat_".');
    }

    console.log(`Starting index process for ${owner}/${repo}...`);

    try {
      // Attempt to fetch contents directly from GitHub API first
      console.log(`Attempting to index repository ${owner}/${repo} via GitHub API...`);
      const apiIndexedContent = await this.fetchRepoContentsFromApi(owner, repo, githubToken);
      if (apiIndexedContent) {
        console.log(`Repository ${owner}/${repo} indexed successfully via GitHub API.`);
        return apiIndexedContent;
      }
    } catch (apiError: unknown) {
      console.error(`Failed to index repository ${owner}/${repo} via GitHub API. Falling back to cloning.`);
      
      // Enhanced error handling for different error types
      let errorMessage = 'Unknown error';
      let errorStatus = 'Unknown status';
      let errorType = 'unknown';
      
      if (apiError instanceof Error) {
        errorMessage = apiError.message;
        errorType = 'Error';
      } else if (apiError && typeof apiError === 'object') {
        errorMessage = (apiError as any).message || 'Unknown error';
        errorStatus = (apiError as any).status || 'Unknown status';
        errorType = (apiError as any).type || 'unknown';
        
        // Check for ErrorEvent specifically
        if ((apiError as any).type === 'error') {
          errorType = 'ErrorEvent';
          console.error(`ErrorEvent detected during GitHub API indexing`);
          console.error(`ErrorEvent details:`, {
            type: (apiError as any).type,
            timeStamp: (apiError as any).timeStamp,
            defaultPrevented: (apiError as any).defaultPrevented,
            cancelable: (apiError as any).cancelable
          });
        }
      }
      
      console.error(`Error details - Type: ${errorType}, Status: ${errorStatus}, Message: ${errorMessage}`);
      
      // Check if this is an authentication/permission error
      if (errorMessage.includes('401') || errorMessage.includes('403')) {
        console.error(`Authentication/Permission error for ${owner}/${repo}. Check GitHub token permissions.`);
      }
      
      // Check for network/connection errors
      if (errorMessage.includes('ETIMEDOUT') || errorMessage.includes('ECONNRESET') || errorMessage.includes('ENOTFOUND')) {
        console.error(`Network/Connection error for ${owner}/${repo}. Check internet connection.`);
      }
      
      // Fall through to cloning if API indexing fails
      console.log(`Falling back to Git cloning method...`);
    }

    // Fallback to cloning if API indexing fails or is not preferred for some reason
    const authenticatedRepoUrl = `https://${githubToken}:x-oauth-basic@github.com/${owner}/${repo}.git`;
    const tempDir = path.join(process.cwd(), 'temp', repo);

    try {
      console.log(`Attempting to clone repository ${owner}/${repo} via Git...`);
      
      // simple-git doesn't have event listeners in the standard interface
      // This was causing TypeScript errors, so we'll handle errors via try-catch
      
      await fs.rm(tempDir, { recursive: true, force: true });
      console.log(`Cleaned temp directory: ${tempDir}`);
      
      console.log(`Cloning from: ${authenticatedRepoUrl}`);
      console.log(`Cloning to: ${tempDir}`);
      
      await this.git.clone(authenticatedRepoUrl, tempDir);
      console.log(`Repository cloned successfully to ${tempDir}`);

      let indexedContent = '';
      const files = await this.readFilesRecursively(tempDir);
      console.log(`Found ${files.length} files to index in ${tempDir}`);

      for (const file of files) {
        const content = await fs.readFile(file, 'utf-8');
        indexedContent += `--- FILE: ${path.relative(tempDir, file)} ---\n\n${content}\n\n`;
      }

      await fs.rm(tempDir, { recursive: true, force: true });
      console.log(`Repository ${owner}/${repo} indexed successfully via cloning.`);
      return indexedContent;
    } catch (cloneError: unknown) {
      console.error(`Error indexing repository ${owner}/${repo} via cloning:`, cloneError);
      
      // Enhanced error handling for clone errors
      let errorMessage = 'Unknown error';
      let errorType = 'unknown';
      
      if (cloneError instanceof Error) {
        errorMessage = cloneError.message;
        errorType = 'Error';
      } else if (cloneError && typeof cloneError === 'object') {
        errorMessage = (cloneError as any).message || 'Unknown error';
        errorType = (cloneError as any).type || 'unknown';
        
        if ((cloneError as any).type === 'error') {
          errorType = 'ErrorEvent';
          console.error('ErrorEvent detected during git cloning:', {
            type: (cloneError as any).type,
            timeStamp: (cloneError as any).timeStamp,
            defaultPrevented: (cloneError as any).defaultPrevented,
            cancelable: (cloneError as any).cancelable
          });
        }
      }
      
      console.error(`Clone error details - Type: ${errorType}, Message: ${errorMessage}`);
      
      // Check for specific git errors
      if (errorMessage.includes('not found') || errorMessage.includes('404')) {
        console.error(`Repository not found or inaccessible: ${owner}/${repo}`);
      } else if (errorMessage.includes('authentication') || errorMessage.includes('401') || errorMessage.includes('403')) {
        console.error(`Git authentication failed for ${owner}/${repo}`);
      } else if (errorMessage.includes('git not found') || errorMessage.includes('command not found')) {
        console.error(`Git command not available on this system`);
      }
      
      throw new Error(`Failed to index repository via cloning: [${errorType}] ${errorMessage}`);
    }
  }

  private async fetchRepoContentsFromApi(owner: string, repo: string, githubToken: string): Promise<string | null> {
    // Use the main client instance instead of creating a new one to maintain consistent auth
    let indexedContent = '';
    let currentTokens = 0;
    let filesProcessed = 0;
    let filesSkipped = 0;

    try {
      console.log(`Fetching repository info for ${owner}/${repo}`);
      // Get the default branch of the repository
      console.log(`Calling client.repos.get for ${owner}/${repo}`);
      try {
        const { data: repoInfo } = await this.client.repos.get({ owner, repo });
        console.log(`Repository info fetched for ${owner}/${repo}. Default branch: ${repoInfo.default_branch}`);
        const defaultBranch = repoInfo.default_branch;

        console.log(`Fetching tree for ${owner}/${repo}/${defaultBranch}`);
        // Get the tree of the default branch, recursively
        console.log(`Calling client.git.getTree for ${owner}/${repo}/${defaultBranch}`);

        // Try with a more robust approach - handle potential large repositories
        let tree;
        try {
          tree = await this.client.git.getTree({
            owner,
            repo,
            tree_sha: defaultBranch,
            recursive: 'true',
          });
        } catch (treeError) {
          console.error(`Error fetching tree for ${owner}/${repo}:`, treeError);
          // If recursive tree fails, try getting just the root tree
          tree = await this.client.git.getTree({
            owner,
            repo,
            tree_sha: defaultBranch,
            recursive: 'false',
          });
          console.log(`Fetched non-recursive tree for ${owner}/${repo}. Items: ${tree.data.tree.length}`);
        }

        console.log(`Tree fetched for ${owner}/${repo}. Total items: ${tree.data.tree.length}`);

        const filesToProcess = tree.data.tree.filter(item =>
          item.type === 'blob' && // Only files
          item.path &&
          !this.isIgnoredPath(item.path) && // Ignore heavy/irrelevant folders
          !this.isBinaryExtension(item.path) // Ignore binary files
        );
        console.log(`Files to process after filtering: ${filesToProcess.length}`);

        // Sort files by size or relevance if needed, for now just process as is
        for (const file of filesToProcess) {
          if (currentTokens >= MAX_INDEX_TOKENS) {
              console.warn(`Token limit (${MAX_INDEX_TOKENS}) reached for ${owner}/${repo}. Skipping remaining ${filesToProcess.length - filesProcessed} files.`);
              filesSkipped = filesToProcess.length - filesProcessed;
              break;
          }

          if (file.sha) {
            try {
              console.log(`Fetching blob for file: ${file.path}`);
              const { data: fileContent } = await this.client.git.getBlob({
                owner,
                repo,
                file_sha: file.sha,
              });
              console.log(`Blob fetched for file: ${file.path}`);
              // The content is base64 encoded
              const decodedContent = Buffer.from(fileContent.content, 'base64').toString('utf8');

              // Estimate tokens (simple character count for now, real tokenizers are more complex)
              const fileTokens = decodedContent.length / 4; // Rough estimate: 1 token ~ 4 characters

              if (currentTokens + fileTokens >= MAX_INDEX_TOKENS) {
                  console.warn(`Adding ${file.path} would exceed token limit. Skipping.`);
                  filesSkipped++;
                  continue;
              }

              indexedContent += `--- FILE: ${file.path} ---\n\n${decodedContent}\n\n`;
              currentTokens += fileTokens;
              filesProcessed++;

              // Log progress every 10 files
              if (filesProcessed % 10 === 0) {
                console.log(`Progress: ${filesProcessed}/${filesToProcess.length} files processed (${((filesProcessed/filesToProcess.length)*100).toFixed(1)}%)`);
              }

            } catch (contentError: unknown) {
              console.warn(`Could not fetch content for ${file.path}: ${(contentError as Error).message}`);
              filesSkipped++;
            }
          }
        }
        
        console.log(`Successfully indexed ${filesProcessed} files for ${owner}/${repo}`);
        if (filesSkipped > 0) {
          console.warn(`Skipped ${filesSkipped} files (${filesSkipped} due to errors, ${filesToProcess.length - filesProcessed - filesSkipped} due to token limit)`);
        }
        
        // Add summary information to the indexed content
        const summary = `

=== REPOSITORY INDEXING SUMMARY ===
Repository: ${owner}/${repo}
Files processed: ${filesProcessed}/${filesToProcess.length}
Files skipped: ${filesSkipped}
Token usage: ${currentTokens}/${MAX_INDEX_TOKENS} (${((currentTokens/MAX_INDEX_TOKENS)*100).toFixed(1)}%)
Indexed at: ${new Date().toISOString()}
`;
        
        indexedContent += summary;
        
        return indexedContent;
      } catch (repoInfoError) {
        console.error(`Error getting repository info for ${owner}/${repo}:`, repoInfoError);
        // If the repo doesn't exist or is not accessible, return null to trigger fallback
        return null;
      }
    } catch (error: unknown) {
      console.error(`Failed to fetch repository contents from GitHub API for ${owner}/${repo}:`, error);
      
      // Enhanced error handling
      let errorMessage = 'Unknown error';
      let errorStatus = 'Unknown status';
      let errorType = 'unknown';
      
      if (error instanceof Error) {
        errorMessage = error.message;
        errorStatus = (error as any).status || 'Unknown status';
        errorType = 'Error';
      } else if (error && typeof error === 'object') {
        errorMessage = (error as any).message || 'Unknown error';
        errorStatus = (error as any).status || 'Unknown status';
        errorType = (error as any).type || 'unknown';
        
        // Check for ErrorEvent specifically
        if ((error as any).type === 'error') {
          errorType = 'ErrorEvent';
          console.error(`ErrorEvent detected in fetchRepoContentsFromApi`);
          console.error(`ErrorEvent details:`, {
            type: (error as any).type,
            timeStamp: (error as any).timeStamp,
            defaultPrevented: (error as any).defaultPrevented,
            cancelable: (error as any).cancelable
          });
        }
      }

      // Check if this is an authentication error
      if (errorStatus === '401' || errorStatus === '403' || errorMessage.includes('401') || errorMessage.includes('403')) {
        console.error(`Authentication error for ${owner}/${repo}. Check GitHub token permissions.`);
      }

      // Check for network/connection errors
      if (errorMessage.includes('ETIMEDOUT') || errorMessage.includes('ECONNRESET') || errorMessage.includes('ENOTFOUND')) {
        console.error(`Network/Connection error for ${owner}/${repo}. Check internet connection.`);
      }

      // Check for rate limiting
      if (errorMessage.includes('rate limit') || errorStatus === '403') {
        console.error(`Rate limit error for ${owner}/${repo}. Too many requests.`);
      }

      console.error(`GitHub API error details - Type: ${errorType}, Status: ${errorStatus}, Message: ${errorMessage}`);
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
