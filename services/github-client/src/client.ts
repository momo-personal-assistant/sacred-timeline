/**
 * GitHub API Client
 *
 * Purpose: Provide a clean, type-safe interface to GitHub REST API
 * Features:
 * - Authentication with Personal Access Token
 * - Rate limit tracking and handling
 * - Repository management
 * - Comprehensive error handling
 *
 * Note: We use `any` types for Octokit responses because GitHub's API
 * response types are not fully typed in @octokit/rest.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { Octokit } from '@octokit/rest';

import {
  GitHubAuthenticationError,
  GitHubRateLimitError,
  GitHubPermissionError,
  GitHubNetworkError,
  GitHubNotFoundError,
  GitHubClientError,
} from './errors';
import type {
  GitHubClientConfig,
  Repository,
  RateLimitStatus,
  RateLimit,
  Issue,
  IssueComment,
  IssuesFilter,
  PullRequest,
  PullRequestReview,
  PullRequestComment,
  PullRequestsFilter,
  User,
  Label,
  Milestone,
  PullRequestBranch,
} from './types';

export class GitHubClient {
  private octokit: Octokit;
  private isAuthenticated = false;

  constructor(config: GitHubClientConfig) {
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

      return data.map((repo: any) => this.mapRepositoryResponse(repo));
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

      if (!data.resources.core || !data.resources.search || !data.resources.graphql) {
        throw new Error('Invalid rate limit response from GitHub API');
      }

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
  // Issues Methods
  // =============================================================================

  /**
   * Get issues from a repository with optional filtering
   */
  async getIssues(owner: string, repo: string, filters: IssuesFilter = {}): Promise<Issue[]> {
    this.ensureAuthenticated();

    const {
      state = 'all',
      labels,
      since,
      sort = 'created',
      direction = 'desc',
      perPage = 100,
      page = 1,
    } = filters;

    try {
      const { data } = await this.octokit.rest.issues.listForRepo({
        owner,
        repo,
        state,
        labels,
        since,
        sort,
        direction,
        per_page: perPage,
        page,
      });

      // Filter out pull requests (GitHub's issues API includes PRs)
      const issues = data.filter((issue: any) => !('pull_request' in issue));

      return issues.map((issue: any) => this.mapIssueResponse(issue));
    } catch (error) {
      throw this.handleError(error, `Failed to get issues for ${owner}/${repo}`);
    }
  }

  /**
   * Get comments for a specific issue
   */
  async getIssueComments(
    owner: string,
    repo: string,
    issueNumber: number
  ): Promise<IssueComment[]> {
    this.ensureAuthenticated();

    try {
      const { data } = await this.octokit.rest.issues.listComments({
        owner,
        repo,
        issue_number: issueNumber,
        per_page: 100,
      });

      return data.map((comment: any) => this.mapIssueCommentResponse(comment));
    } catch (error) {
      throw this.handleError(error, `Failed to get comments for issue #${issueNumber}`);
    }
  }

  /**
   * Get all issues with automatic pagination
   */
  async getAllIssues(
    owner: string,
    repo: string,
    filters: Omit<IssuesFilter, 'page' | 'perPage'> = {}
  ): Promise<Issue[]> {
    this.ensureAuthenticated();

    const allIssues: Issue[] = [];
    let page = 1;
    const perPage = 100;
    let hasMore = true;

    while (hasMore) {
      const issues = await this.getIssues(owner, repo, { ...filters, page, perPage });

      if (issues.length === 0) {
        hasMore = false;
      } else {
        allIssues.push(...issues);
        page++;

        // If we got fewer than perPage, we've reached the end
        if (issues.length < perPage) {
          hasMore = false;
        }
      }

      // Log progress
      console.log(`📄 Fetched ${allIssues.length} issues so far...`);
    }

    console.log(`✅ Fetched total of ${allIssues.length} issues from ${owner}/${repo}`);
    return allIssues;
  }

  // =============================================================================
  // Pull Requests Methods
  // =============================================================================

  /**
   * Get pull requests from a repository with optional filtering
   */
  async getPullRequests(
    owner: string,
    repo: string,
    filters: PullRequestsFilter = {}
  ): Promise<PullRequest[]> {
    this.ensureAuthenticated();

    const {
      state = 'all',
      head,
      base,
      sort = 'created',
      direction = 'desc',
      perPage = 100,
      page = 1,
    } = filters;

    try {
      const { data } = await this.octokit.rest.pulls.list({
        owner,
        repo,
        state,
        head,
        base,
        sort,
        direction,
        per_page: perPage,
        page,
      });

      return data.map((pr: any) => this.mapPullRequestResponse(pr));
    } catch (error) {
      throw this.handleError(error, `Failed to get pull requests for ${owner}/${repo}`);
    }
  }

  /**
   * Get reviews for a specific pull request
   */
  async getPullRequestReviews(
    owner: string,
    repo: string,
    prNumber: number
  ): Promise<PullRequestReview[]> {
    this.ensureAuthenticated();

    try {
      const { data } = await this.octokit.rest.pulls.listReviews({
        owner,
        repo,
        pull_number: prNumber,
        per_page: 100,
      });

      return data.map((review: any) => this.mapPullRequestReviewResponse(review));
    } catch (error) {
      throw this.handleError(error, `Failed to get reviews for PR #${prNumber}`);
    }
  }

  /**
   * Get review comments for a specific pull request
   */
  async getPullRequestComments(
    owner: string,
    repo: string,
    prNumber: number
  ): Promise<PullRequestComment[]> {
    this.ensureAuthenticated();

    try {
      const { data } = await this.octokit.rest.pulls.listReviewComments({
        owner,
        repo,
        pull_number: prNumber,
        per_page: 100,
      });

      return data.map((comment: any) => this.mapPullRequestCommentResponse(comment));
    } catch (error) {
      throw this.handleError(error, `Failed to get review comments for PR #${prNumber}`);
    }
  }

  /**
   * Get all pull requests with automatic pagination
   */
  async getAllPullRequests(
    owner: string,
    repo: string,
    filters: Omit<PullRequestsFilter, 'page' | 'perPage'> = {}
  ): Promise<PullRequest[]> {
    this.ensureAuthenticated();

    const allPRs: PullRequest[] = [];
    let page = 1;
    const perPage = 100;
    let hasMore = true;

    while (hasMore) {
      const prs = await this.getPullRequests(owner, repo, { ...filters, page, perPage });

      if (prs.length === 0) {
        hasMore = false;
      } else {
        allPRs.push(...prs);
        page++;

        // If we got fewer than perPage, we've reached the end
        if (prs.length < perPage) {
          hasMore = false;
        }
      }

      // Log progress
      console.log(`📄 Fetched ${allPRs.length} pull requests so far...`);
    }

    console.log(`✅ Fetched total of ${allPRs.length} pull requests from ${owner}/${repo}`);
    return allPRs;
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

  private mapUserResponse(data: {
    login: string;
    id: number;
    avatar_url: string;
    html_url: string;
    type: string;
  }): User {
    return {
      login: data.login,
      id: data.id,
      avatar_url: data.avatar_url,
      html_url: data.html_url,
      type: data.type as 'User' | 'Bot' | 'Organization',
    };
  }

  private mapLabelResponse(data: {
    id: number;
    name: string;
    color: string;
    description: string | null;
  }): Label {
    return {
      id: data.id,
      name: data.name,
      color: data.color,
      description: data.description,
    };
  }

  private mapMilestoneResponse(data: {
    id: number;
    number: number;
    title: string;
    description: string | null;
    state: string;
    created_at: string;
    updated_at: string;
    due_on: string | null;
    closed_at: string | null;
  }): Milestone {
    return {
      id: data.id,
      number: data.number,
      title: data.title,
      description: data.description,
      state: data.state as 'open' | 'closed',
      created_at: data.created_at,
      updated_at: data.updated_at,
      due_on: data.due_on,
      closed_at: data.closed_at,
    };
  }

  private mapIssueResponse(data: any): Issue {
    return {
      id: data.id,
      number: data.number,
      title: data.title,
      body: data.body,
      state: data.state,
      state_reason: data.state_reason,
      user: this.mapUserResponse(data.user),
      labels: data.labels.map((label: any) => this.mapLabelResponse(label)),
      assignees: data.assignees?.map((assignee: any) => this.mapUserResponse(assignee)) || [],
      milestone: data.milestone ? this.mapMilestoneResponse(data.milestone) : null,
      comments: data.comments,
      created_at: data.created_at,
      updated_at: data.updated_at,
      closed_at: data.closed_at,
      html_url: data.html_url,
      repository_url: data.repository_url,
      locked: data.locked,
      author_association: data.author_association,
    };
  }

  private mapIssueCommentResponse(data: any): IssueComment {
    return {
      id: data.id,
      body: data.body,
      user: this.mapUserResponse(data.user),
      created_at: data.created_at,
      updated_at: data.updated_at,
      html_url: data.html_url,
      author_association: data.author_association,
    };
  }

  private mapPullRequestBranchResponse(data: any): PullRequestBranch {
    return {
      label: data.label,
      ref: data.ref,
      sha: data.sha,
      user: this.mapUserResponse(data.user),
      repo: data.repo ? this.mapRepositoryResponse(data.repo) : null,
    };
  }

  private mapPullRequestResponse(data: any): PullRequest {
    return {
      id: data.id,
      number: data.number,
      title: data.title,
      body: data.body,
      state: data.state,
      user: this.mapUserResponse(data.user),
      labels: data.labels.map((label: any) => this.mapLabelResponse(label)),
      assignees: data.assignees?.map((assignee: any) => this.mapUserResponse(assignee)) || [],
      requested_reviewers:
        data.requested_reviewers?.map((reviewer: any) => this.mapUserResponse(reviewer)) || [],
      milestone: data.milestone ? this.mapMilestoneResponse(data.milestone) : null,
      head: this.mapPullRequestBranchResponse(data.head),
      base: this.mapPullRequestBranchResponse(data.base),
      created_at: data.created_at,
      updated_at: data.updated_at,
      closed_at: data.closed_at,
      merged_at: data.merged_at,
      merged_by: data.merged_by ? this.mapUserResponse(data.merged_by) : null,
      merge_commit_sha: data.merge_commit_sha,
      html_url: data.html_url,
      commits: data.commits,
      additions: data.additions,
      deletions: data.deletions,
      changed_files: data.changed_files,
      comments: data.comments,
      review_comments: data.review_comments,
      mergeable: data.mergeable,
      merged: data.merged,
      draft: data.draft,
      locked: data.locked,
      author_association: data.author_association,
    };
  }

  private mapPullRequestReviewResponse(data: any): PullRequestReview {
    return {
      id: data.id,
      user: this.mapUserResponse(data.user),
      body: data.body,
      state: data.state,
      html_url: data.html_url,
      pull_request_url: data.pull_request_url,
      submitted_at: data.submitted_at,
      commit_id: data.commit_id,
      author_association: data.author_association,
    };
  }

  private mapPullRequestCommentResponse(data: any): PullRequestComment {
    return {
      id: data.id,
      body: data.body,
      user: this.mapUserResponse(data.user),
      created_at: data.created_at,
      updated_at: data.updated_at,
      html_url: data.html_url,
      path: data.path,
      position: data.position,
      original_position: data.original_position,
      diff_hunk: data.diff_hunk,
      commit_id: data.commit_id,
      in_reply_to_id: data.in_reply_to_id,
      author_association: data.author_association,
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
