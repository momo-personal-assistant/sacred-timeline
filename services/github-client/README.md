# GitHub Client

Type-safe GitHub API client for the unified memory system.

## Features

- ✅ Authentication with Personal Access Token
- ✅ Repository management
- ✅ Issues fetching with filters and pagination
- ✅ Pull Requests fetching with filters and pagination
- ✅ Comments and reviews retrieval
- ✅ Rate limit tracking and handling
- ✅ Comprehensive error handling
- ✅ Full TypeScript support

## Installation

```bash
pnpm install
```

## Setup

1. Create a GitHub Personal Access Token:
   - Go to GitHub Settings > Developer settings > Personal access tokens
   - Click "Generate new token"
   - Select scopes: `repo`, `read:org`, `read:user`
   - Copy the token

2. Set environment variable:

```bash
export GITHUB_TOKEN=your_token_here
```

## Usage

### Basic Setup

```typescript
import { GitHubClient } from '@unified-memory/github-client';

const client = new GitHubClient({
  token: process.env.GITHUB_TOKEN!,
});

// Authenticate
await client.authenticate();
```

### Fetching Issues

```typescript
// Get issues with filters
const issues = await client.getIssues('owner', 'repo', {
  state: 'open',
  labels: 'bug,enhancement',
  since: '2024-01-01T00:00:00Z',
  sort: 'updated',
  direction: 'desc',
  perPage: 50,
  page: 1,
});

// Get all issues (automatic pagination)
const allIssues = await client.getAllIssues('owner', 'repo', {
  state: 'all',
});

// Get issue comments
const comments = await client.getIssueComments('owner', 'repo', 123);
```

### Fetching Pull Requests

```typescript
// Get pull requests with filters
const prs = await client.getPullRequests('owner', 'repo', {
  state: 'closed',
  sort: 'updated',
  direction: 'desc',
  perPage: 50,
  page: 1,
});

// Get all pull requests (automatic pagination)
const allPRs = await client.getAllPullRequests('owner', 'repo', {
  state: 'all',
});

// Get PR reviews
const reviews = await client.getPullRequestReviews('owner', 'repo', 456);

// Get PR review comments
const reviewComments = await client.getPullRequestComments('owner', 'repo', 456);
```

### Rate Limiting

```typescript
// Get rate limit status
const rateLimit = await client.getRateLimit();
console.log(`Remaining: ${rateLimit.core.remaining}/${rateLimit.core.limit}`);

// Check if rate limit is low (< 10%)
const isLow = await client.isRateLimitLow();
if (isLow) {
  await client.waitForRateLimitReset();
}
```

## API Reference

### Issues

- `getIssues(owner, repo, filters?)`: Fetch issues from a repository
- `getIssueComments(owner, repo, issueNumber)`: Get comments for an issue
- `getAllIssues(owner, repo, filters?)`: Fetch all issues with automatic pagination

#### IssuesFilter Options

```typescript
interface IssuesFilter {
  state?: 'open' | 'closed' | 'all';
  labels?: string; // Comma-separated list
  since?: string; // ISO 8601 format
  sort?: 'created' | 'updated' | 'comments';
  direction?: 'asc' | 'desc';
  perPage?: number;
  page?: number;
}
```

### Pull Requests

- `getPullRequests(owner, repo, filters?)`: Fetch pull requests from a repository
- `getPullRequestReviews(owner, repo, prNumber)`: Get reviews for a PR
- `getPullRequestComments(owner, repo, prNumber)`: Get review comments for a PR
- `getAllPullRequests(owner, repo, filters?)`: Fetch all PRs with automatic pagination

#### PullRequestsFilter Options

```typescript
interface PullRequestsFilter {
  state?: 'open' | 'closed' | 'all';
  head?: string; // Filter by head branch (user:ref-name)
  base?: string; // Filter by base branch
  sort?: 'created' | 'updated' | 'popularity' | 'long-running';
  direction?: 'asc' | 'desc';
  perPage?: number;
  page?: number;
}
```

## Testing

Run integration tests with your GitHub token:

```bash
GITHUB_TOKEN=your_token npm test
```

The tests use public repositories (`octocat/Hello-World`) for testing.

## Error Handling

The client throws typed errors for different scenarios:

- `GitHubAuthenticationError`: Invalid or expired token
- `GitHubRateLimitError`: Rate limit exceeded
- `GitHubPermissionError`: Insufficient permissions
- `GitHubNotFoundError`: Resource not found
- `GitHubNetworkError`: Network connection issues
- `GitHubClientError`: General API errors

```typescript
try {
  const issues = await client.getIssues('owner', 'repo');
} catch (error) {
  if (error instanceof GitHubRateLimitError) {
    console.log('Rate limit exceeded, waiting...');
    await client.waitForRateLimitReset();
  } else if (error instanceof GitHubNotFoundError) {
    console.log('Repository not found');
  }
}
```

## Development

```bash
# Build
pnpm build

# Type check
pnpm type-check

# Lint
pnpm lint

# Run tests
GITHUB_TOKEN=your_token pnpm test
```

## License

MIT
