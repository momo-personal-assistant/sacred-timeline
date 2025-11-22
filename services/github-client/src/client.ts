/**
 * GitHub API Client
 *
 * Purpose: Provide a clean, type-safe interface to GitHub REST API
 * Features:
 * - Authentication with Personal Access Token
 * - Rate limit tracking and handling
 * - Repository management
 * - Comprehensive error handling
 */

import { Octokit } from '@octokit/rest';

import {
  GitHubAuthenticationError,
  GitHubRateLimitError,
  GitHubPermissionError,
  GitHubNetworkError,
  GitHubNotFoundError,
  GitHubClientError,
} from './errors';
import type { GitHubClientConfig, Repository, RateLimitStatus, RateLimit } from './types';

export class GitHubClient {
  private octokit: Octokit;
  private config: GitHubClientConfig;
  private isAuthenticated = false;

  constructor(config: GitHubClientConfig) {
    this.config = config;
    this.octokit = new Octokit({
      auth: config.token,
      userAgent: config.userAgent || 'unified-memory-github-client',
      baseUrl: config.baseUrl || 'https://api.github.com',
    });
  }

  /**
   * Authenticate and verify the GitHub token
   */
  async authenticate(): Promise<boolean> {
    try {
      const { data } = await this.octokit.rest.users.getAuthenticated();
      this.isAuthenticated = true;
      console.log(`✅ Authenticated as GitHub user: ${data.login}`);
      return true;
    } catch (error) {
      this.isAuthenticated = false;
      throw this.handleError(error, 'Authentication failed');
    }
  }

  /**
   * Get repository metadata
   */
  async getRepository(owner: string, repo: string): Promise<Repository> {
    this.ensureAuthenticated();

    try {
      const { data } = await this.octokit.rest.repos.get({
        owner,
        repo,
      });

      return this.mapRepositoryResponse(data);
    } catch (error) {
      throw this.handleError(error, `Failed to get repository ${owner}/${repo}`);
    }
  }

  /**
   * List accessible repositories
   */
  async listRepositories(
    options: {
      type?: 'all' | 'owner' | 'member';
      sort?: 'created' | 'updated' | 'pushed' | 'full_name';
      direction?: 'asc' | 'desc';
      perPage?: number;
      page?: number;
    } = {}
  ): Promise<Repository[]> {
    this.ensureAuthenticated();

    const { type = 'all', sort = 'updated', direction = 'desc', perPage = 30, page = 1 } = options;

    try {
      const { data } = await this.octokit.rest.repos.listForAuthenticatedUser({
        type,
        sort,
        direction,
        per_page: perPage,
        page,
      });

      return data.map((repo) => this.mapRepositoryResponse(repo));
    } catch (error) {
      throw this.handleError(error, 'Failed to list repositories');
    }
  }

  /**
   * Get current rate limit status
   */
  async getRateLimit(): Promise<RateLimitStatus> {
    try {
      const { data } = await this.octokit.rest.rateLimit.get();

      return {
        core: this.mapRateLimitResponse(data.resources.core),
        search: this.mapRateLimitResponse(data.resources.search),
        graphql: this.mapRateLimitResponse(data.resources.graphql),
      };
    } catch (error) {
      throw this.handleError(error, 'Failed to get rate limit');
    }
  }

  /**
   * Check if rate limit is approaching (< 10% remaining)
   */
  async isRateLimitLow(): Promise<boolean> {
    const rateLimit = await this.getRateLimit();
    const threshold = rateLimit.core.limit * 0.1; // 10% threshold
    return rateLimit.core.remaining < threshold;
  }

  /**
   * Wait until rate limit resets
   */
  async waitForRateLimitReset(): Promise<void> {
    const rateLimit = await this.getRateLimit();
    const now = Date.now();
    const resetTime = rateLimit.core.resetDate.getTime();
    const waitMs = resetTime - now;

    if (waitMs > 0) {
      console.log(`⏳ Waiting ${Math.ceil(waitMs / 1000 / 60)} minutes for rate limit reset...`);
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }
  }

  /**
   * Check authentication status
   */
  public getAuthenticationStatus(): boolean {
    return this.isAuthenticated;
  }

  // =============================================================================
  // Private Helper Methods
  // =============================================================================

  private ensureAuthenticated(): void {
    if (!this.isAuthenticated) {
      throw new GitHubAuthenticationError('Not authenticated. Call authenticate() first.');
    }
  }

  private mapRepositoryResponse(data: {
    id: number;
    name: string;
    full_name: string;
    description: string | null;
    owner: {
      login: string;
      id: number;
      type: string;
      avatar_url: string;
      html_url: string;
    };
    private: boolean;
    html_url: string;
    created_at: string;
    updated_at: string;
    pushed_at: string | null;
    default_branch: string;
    language: string | null;
    stargazers_count: number;
    watchers_count: number;
    forks_count: number;
    open_issues_count: number;
  }): Repository {
    return {
      id: data.id,
      name: data.name,
      full_name: data.full_name,
      description: data.description,
      owner: {
        login: data.owner.login,
        id: data.owner.id,
        type: data.owner.type,
        avatar_url: data.owner.avatar_url,
        html_url: data.owner.html_url,
      },
      private: data.private,
      html_url: data.html_url,
      created_at: data.created_at,
      updated_at: data.updated_at,
      pushed_at: data.pushed_at,
      default_branch: data.default_branch,
      language: data.language,
      stargazers_count: data.stargazers_count,
      watchers_count: data.watchers_count,
      forks_count: data.forks_count,
      open_issues_count: data.open_issues_count,
    };
  }

  private mapRateLimitResponse(data: {
    limit: number;
    remaining: number;
    reset: number;
    used: number;
  }): RateLimit {
    return {
      limit: data.limit,
      remaining: data.remaining,
      reset: data.reset,
      used: data.used,
      resetDate: new Date(data.reset * 1000),
    };
  }

  private handleError(error: unknown, context: string): GitHubClientError {
    const err = error as {
      code?: string;
      message?: string;
      status?: number;
      response?: { headers?: Record<string, string> };
    };

    // Network errors
    if (err.code === 'ENOTFOUND' || err.code === 'ECONNREFUSED') {
      return new GitHubNetworkError(`${context}: ${err.message}`, error);
    }

    // HTTP status code errors
    if (err.status) {
      switch (err.status) {
        case 401:
          return new GitHubAuthenticationError(`${context}: Invalid or expired token`, error);

        case 403:
          // Check if it's a rate limit error
          if (err.message?.includes('rate limit')) {
            const resetTime = err.response?.headers?.['x-ratelimit-reset'];
            const resetDate = resetTime
              ? new Date(parseInt(resetTime) * 1000)
              : new Date(Date.now() + 3600000); // Default to 1 hour
            return new GitHubRateLimitError(
              `${context}: Rate limit exceeded. Resets at ${resetDate.toISOString()}`,
              resetDate,
              error
            );
          }
          return new GitHubPermissionError(`${context}: Insufficient permissions`, error);

        case 404:
          return new GitHubNotFoundError(`${context}: Resource not found`, error);

        default:
          return new GitHubClientError(`${context}: ${err.message}`, err.status, error);
      }
    }

    // Generic error
    return new GitHubClientError(`${context}: ${err.message}`, undefined, error);
  }
}
