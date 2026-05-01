
import { Octokit } from '@octokit/rest';
import simpleGit, { SimpleGit } from 'simple-git';
import fs from 'fs/promises';
import path from 'path';

// Aumentado para 1 milhão de tokens para lidar com repositórios maiores
// Isso ainda deixa margem para o prompt do modelo (256k tokens total)
const MAX_INDEX_TOKENS = 1000000;

const isSupportedGitHubToken = (token: string): boolean =>
  token.startsWith('github_pat_');

const supportedTokenMessage =
  'Use a fine-grained GitHub personal access token that starts with "github_pat_" and grants repository read-only permissions.';

export class GitHubService {
  public client: Octokit;
  private git: SimpleGit;

  constructor(apiKey?: string) {
    const envApiKey = process.env.GITHUB_ACCESS_TOKEN || process.env.GITHUB_TOKEN;

    console.log('--- GitHubService Initialization ---');
    console.log('process.env.GITHUB_ACCESS_TOKEN:', process.env.GITHUB_ACCESS_TOKEN ? 'present' : 'undefined');
    console.log('process.env.GITHUB_TOKEN:', process.env.GITHUB_TOKEN ? 'present' : 'undefined');
    console.log('process.env.NODE_ENV:', process.env.NODE_ENV);
    console.log('------------------------------------');

    if (!apiKey && !envApiKey) {
      console.warn('No GitHub API key provided. Please set GITHUB_ACCESS_TOKEN environment variable.');
    } else {
      console.log('GitHub API key loaded');
      // Validate token format
      const token = apiKey || envApiKey;
      if (token && !isSupportedGitHubToken(token)) {
        console.warn(`Warning: GitHub token may be in an incorrect format. ${supportedTokenMessage}`);
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
    if (!isSupportedGitHubToken(githubToken)) {
      throw new Error(`Invalid GitHub token format. ${supportedTokenMessage}`);
    }

    try {
      console.log('Listing all accessible repositories from GitHub API');
      const repos = await this.client.paginate(this.client.repos.listForAuthenticatedUser, {
        visibility: 'all',
        affiliation: 'owner,collaborator,organization_member',
        sort: 'updated',
        direction: 'desc',
        per_page: 100,
      });
      console.log(`Successfully listed ${repos.length} repositories from GitHub API`);
      return repos;
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
    if (!isSupportedGitHubToken(githubToken)) {
      throw new Error(`Invalid GitHub token format. ${supportedTokenMessage}`);
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

  async searchRepo(owner: string, repo: string, searchQuery: string): Promise<string[]> {
    const githubToken = process.env.GITHUB_ACCESS_TOKEN || process.env.GITHUB_TOKEN;
    if (!githubToken) {
      throw new Error('GITHUB_ACCESS_TOKEN or GITHUB_TOKEN environment variable is not set.');
    }
    if (!isSupportedGitHubToken(githubToken)) {
      throw new Error('Invalid GitHub token format.');
    }

    try {
      const q = `${searchQuery} repo:${owner}/${repo}`;
      console.log(`Searching code in ${owner}/${repo} with query: "${searchQuery}"`);
      const response = await this.client.search.code({ q });
      console.log(`Found ${response.data.total_count} results for query.`);
      
      // Return a list of file paths
      return response.data.items.map(item => item.path);
    } catch (error) {
      console.error(`Error searching repository ${owner}/${repo}:`, error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStatus = (error as any)?.status || 'Unknown status';
      console.error(`GitHub API error details - Status: ${errorStatus}, Message: ${errorMessage}`);
      throw new Error(`Failed to search repository: [${errorStatus}] ${errorMessage}`);
    }
  }
}

export const gitHubService = new GitHubService();
