/**
 * Custom error classes for GitHub client
 */

export class GitHubClientError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly originalError?: unknown
  ) {
    super(message);
    this.name = 'GitHubClientError';
    Error.captureStackTrace(this, this.constructor);
  }
}

export class GitHubAuthenticationError extends GitHubClientError {
  constructor(message: string = 'GitHub authentication failed', originalError?: unknown) {
    super(message, 401, originalError);
    this.name = 'GitHubAuthenticationError';
  }
}

export class GitHubRateLimitError extends GitHubClientError {
  constructor(
    message: string,
    public readonly resetAt: Date,
    originalError?: unknown
  ) {
    super(message, 403, originalError);
    this.name = 'GitHubRateLimitError';
  }
}

export class GitHubPermissionError extends GitHubClientError {
  constructor(message: string = 'Insufficient permissions', originalError?: unknown) {
    super(message, 403, originalError);
    this.name = 'GitHubPermissionError';
  }
}

export class GitHubNetworkError extends GitHubClientError {
  constructor(message: string = 'Network error occurred', originalError?: unknown) {
    super(message, undefined, originalError);
    this.name = 'GitHubNetworkError';
  }
}

export class GitHubNotFoundError extends GitHubClientError {
  constructor(message: string = 'Resource not found', originalError?: unknown) {
    super(message, 404, originalError);
    this.name = 'GitHubNotFoundError';
  }
}
