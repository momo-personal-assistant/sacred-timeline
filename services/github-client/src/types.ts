/**
 * TypeScript types for GitHub client
 */

// =============================================================================
// Configuration
// =============================================================================

export interface GitHubClientConfig {
  token: string;
  userAgent?: string;
  baseUrl?: string; // For GitHub Enterprise
}

// =============================================================================
// Repository Types
// =============================================================================

export interface Repository {
  id: number;
  name: string;
  full_name: string; // owner/repo
  description: string | null;
  owner: RepositoryOwner;
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
}

export interface RepositoryOwner {
  login: string;
  id: number;
  type: string;
  avatar_url: string;
  html_url: string;
}

// =============================================================================
// Rate Limit Types
// =============================================================================

export interface RateLimit {
  limit: number; // Maximum requests per hour
  remaining: number; // Requests remaining
  reset: number; // Unix timestamp when limit resets
  used: number; // Requests used
  resetDate: Date; // Parsed reset date
}

export interface RateLimitStatus {
  core: RateLimit;
  search: RateLimit;
  graphql: RateLimit;
}

// =============================================================================
// Error Types
// =============================================================================

export interface GitHubErrorResponse {
  message: string;
  documentation_url?: string;
  status?: number;
}

// =============================================================================
// User Types
// =============================================================================

export interface User {
  login: string;
  id: number;
  avatar_url: string;
  html_url: string;
  type: 'User' | 'Bot' | 'Organization';
}

// =============================================================================
// Label Types
// =============================================================================

export interface Label {
  id: number;
  name: string;
  color: string;
  description: string | null;
}

// =============================================================================
// Milestone Types
// =============================================================================

export interface Milestone {
  id: number;
  number: number;
  title: string;
  description: string | null;
  state: 'open' | 'closed';
  created_at: string;
  updated_at: string;
  due_on: string | null;
  closed_at: string | null;
}

// =============================================================================
// Issue Types
// =============================================================================

export interface Issue {
  id: number;
  number: number;
  title: string;
  body: string | null;
  state: 'open' | 'closed';
  state_reason: 'completed' | 'not_planned' | 'reopened' | null;
  user: User;
  labels: Label[];
  assignees: User[];
  milestone: Milestone | null;
  comments: number; // Comment count
  created_at: string;
  updated_at: string;
  closed_at: string | null;
  html_url: string;
  repository_url: string;
  locked: boolean;
  author_association: string;
}

export interface IssueComment {
  id: number;
  body: string;
  user: User;
  created_at: string;
  updated_at: string;
  html_url: string;
  author_association: string;
}

export interface IssuesFilter {
  state?: 'open' | 'closed' | 'all';
  labels?: string; // Comma-separated list
  since?: string; // ISO 8601 format
  sort?: 'created' | 'updated' | 'comments';
  direction?: 'asc' | 'desc';
  perPage?: number;
  page?: number;
}

// =============================================================================
// Pull Request Types
// =============================================================================

export interface PullRequest {
  id: number;
  number: number;
  title: string;
  body: string | null;
  state: 'open' | 'closed';
  user: User;
  labels: Label[];
  assignees: User[];
  requested_reviewers: User[];
  milestone: Milestone | null;
  head: PullRequestBranch;
  base: PullRequestBranch;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
  merged_at: string | null;
  merged_by: User | null;
  merge_commit_sha: string | null;
  html_url: string;
  commits: number; // Commit count
  additions: number;
  deletions: number;
  changed_files: number;
  comments: number; // Comment count
  review_comments: number; // Review comment count
  mergeable: boolean | null;
  merged: boolean;
  draft: boolean;
  locked: boolean;
  author_association: string;
}

export interface PullRequestBranch {
  label: string; // Format: "owner:branch"
  ref: string; // Branch name
  sha: string; // Commit SHA
  user: User;
  repo: Repository | null;
}

export interface PullRequestReview {
  id: number;
  user: User;
  body: string | null;
  state: 'APPROVED' | 'CHANGES_REQUESTED' | 'COMMENTED' | 'DISMISSED' | 'PENDING';
  html_url: string;
  pull_request_url: string;
  submitted_at: string;
  commit_id: string;
  author_association: string;
}

export interface PullRequestComment {
  id: number;
  body: string;
  user: User;
  created_at: string;
  updated_at: string;
  html_url: string;
  path: string | null; // File path for review comments
  position: number | null; // Line position for review comments
  original_position: number | null;
  diff_hunk: string | null;
  commit_id: string | null;
  in_reply_to_id: number | null;
  author_association: string;
}

export interface PullRequestsFilter {
  state?: 'open' | 'closed' | 'all';
  head?: string; // Filter by head branch (user:ref-name)
  base?: string; // Filter by base branch
  sort?: 'created' | 'updated' | 'popularity' | 'long-running';
  direction?: 'asc' | 'desc';
  perPage?: number;
  page?: number;
}

// =============================================================================
// Pagination Types
// =============================================================================

export interface PaginationOptions {
  perPage?: number;
  page?: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    perPage: number;
    hasNextPage: boolean;
    total?: number; // If available from headers
  };
}
