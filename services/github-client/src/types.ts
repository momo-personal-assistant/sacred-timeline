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
  pushed_at: string;
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
  type: 'User' | 'Organization';
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
