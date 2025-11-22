# GitHub Client

GitHub API client for unified memory system.

## Features

- ✅ Authentication with Personal Access Token or GitHub App
- ✅ Repository metadata retrieval
- ✅ List accessible repositories
- ✅ Rate limit tracking and automatic handling
- ✅ Comprehensive error handling
- ✅ TypeScript support with full type safety

## Installation

```bash
pnpm --filter @unified-memory/github-client install
```

## Setup

### 1. Create GitHub Personal Access Token

1. Go to [GitHub Settings > Developer settings > Personal access tokens > Tokens (classic)](https://github.com/settings/tokens)
2. Click "Generate new token (classic)"
3. Give it a descriptive name (e.g., "Unified Memory Client")
4. Select scopes:
   - `repo` - Full control of private repositories
   - `read:org` - Read org and team membership
   - `read:user` - Read user profile data
   - `read:project` - Read project data (optional)
5. Click "Generate token"
6. **Copy the token immediately** (you won't be able to see it again)

### 2. Add Token to Environment

Add the token to your `.env` file:

```bash
GITHUB_TOKEN=ghp_your_token_here
```

## Usage

### Basic Authentication

```typescript
import { GitHubClient } from '@unified-memory/github-client';

const client = new GitHubClient({
  token: process.env.GITHUB_TOKEN!,
});

// Authenticate and verify token
await client.authenticate();
```

### Get Repository

```typescript
const repo = await client.getRepository('octocat', 'Hello-World');
console.log(repo.name); // "Hello-World"
console.log(repo.full_name); // "octocat/Hello-World"
console.log(repo.description); // "My first repository on GitHub!"
```

### List Repositories

```typescript
// List all accessible repositories
const repos = await client.listRepositories();

// List only owned repositories, sorted by updated date
const ownedRepos = await client.listRepositories({
  type: 'owner',
  sort: 'updated',
  direction: 'desc',
  perPage: 50,
});
```

### Rate Limit Management

```typescript
// Get current rate limit status
const rateLimit = await client.getRateLimit();
console.log(`Remaining: ${rateLimit.core.remaining}/${rateLimit.core.limit}`);
console.log(`Resets at: ${rateLimit.core.resetDate}`);

// Check if rate limit is low (< 10%)
if (await client.isRateLimitLow()) {
  console.log('⚠️  Rate limit is running low');
}

// Wait for rate limit to reset
await client.waitForRateLimitReset();
```

### Error Handling

```typescript
import {
  GitHubAuthenticationError,
  GitHubRateLimitError,
  GitHubPermissionError,
  GitHubNotFoundError,
  GitHubNetworkError,
} from '@unified-memory/github-client';

try {
  const repo = await client.getRepository('owner', 'repo');
} catch (error) {
  if (error instanceof GitHubAuthenticationError) {
    console.error('Invalid token:', error.message);
  } else if (error instanceof GitHubRateLimitError) {
    console.error('Rate limit exceeded. Reset at:', error.resetAt);
  } else if (error instanceof GitHubPermissionError) {
    console.error('Insufficient permissions:', error.message);
  } else if (error instanceof GitHubNotFoundError) {
    console.error('Repository not found');
  } else if (error instanceof GitHubNetworkError) {
    console.error('Network error:', error.message);
  }
}
```

## API Reference

### `GitHubClient`

#### Constructor

```typescript
new GitHubClient(config: GitHubClientConfig)
```

**Config:**

- `token` (required): GitHub Personal Access Token
- `userAgent` (optional): Custom user agent string
- `baseUrl` (optional): API base URL (for GitHub Enterprise)

#### Methods

##### `authenticate(): Promise<boolean>`

Verify the GitHub token and authenticate.

##### `getRepository(owner: string, repo: string): Promise<Repository>`

Get repository metadata.

##### `listRepositories(options?): Promise<Repository[]>`

List accessible repositories.

**Options:**

- `type`: 'all' | 'owner' | 'member' (default: 'all')
- `sort`: 'created' | 'updated' | 'pushed' | 'full_name' (default: 'updated')
- `direction`: 'asc' | 'desc' (default: 'desc')
- `perPage`: number (default: 30)
- `page`: number (default: 1)

##### `getRateLimit(): Promise<RateLimitStatus>`

Get current rate limit status for core, search, and GraphQL APIs.

##### `isRateLimitLow(): Promise<boolean>`

Check if rate limit is below 10%.

##### `waitForRateLimitReset(): Promise<void>`

Wait until rate limit resets.

##### `getAuthenticationStatus(): boolean`

Check if client is authenticated.

## Rate Limits

GitHub API has the following rate limits for authenticated requests:

- **Core API**: 5,000 requests per hour
- **Search API**: 30 requests per minute
- **GraphQL API**: 5,000 points per hour

The client automatically tracks these limits and provides helpers to manage them.

## Development

### Build

```bash
pnpm run build
```

### Type Check

```bash
pnpm run type-check
```

### Lint

```bash
pnpm run lint
pnpm run lint:fix
```

## Resources

- [GitHub REST API Documentation](https://docs.github.com/en/rest)
- [Octokit REST Documentation](https://octokit.github.io/rest.js/)
- [Creating a Personal Access Token](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/creating-a-personal-access-token)
