# Contributing Guide

## Development Setup

See the main [README.md](../README.md) for initial setup instructions.

## Code Standards

### TypeScript

- Use explicit types, avoid `any` when possible
- Prefer interfaces for object shapes
- Use enums for fixed sets of values
- Document complex types with comments

### Naming Conventions

- **Files**: kebab-case (e.g., `memory-service.ts`)
- **Classes**: PascalCase (e.g., `MemoryService`)
- **Functions**: camelCase (e.g., `createMemory`)
- **Constants**: UPPER_SNAKE_CASE (e.g., `MAX_RETRIES`)
- **Types/Interfaces**: PascalCase (e.g., `Memory`, `CreateMemoryInput`)

### Code Organization

```typescript
// 1. Imports (grouped and sorted)
import { external } from 'external-package';

import type { InternalType } from '@unified-memory/shared';

import { localUtil } from './utils';

// 2. Types and interfaces
interface Config {
  port: number;
}

// 3. Constants
const DEFAULT_PORT = 3000;

// 4. Implementation
class Service {
  // ...
}

// 5. Exports
export { Service };
```

### Error Handling

```typescript
// ✅ Good: Specific error types
try {
  await riskyOperation();
} catch (error) {
  if (error instanceof ValidationError) {
    return { error: 'Invalid input' };
  }
  throw error; // Re-throw unknown errors
}

// ❌ Bad: Swallowing all errors
try {
  await riskyOperation();
} catch {
  // Silent failure
}
```

## Testing Guidelines

### Unit Tests

```typescript
describe('MemoryService', () => {
  it('should create a memory with valid input', async () => {
    const memory = await service.createMemory({
      content: 'test content',
    });
    expect(memory.id).toBeDefined();
  });

  it('should reject invalid input', async () => {
    await expect(
      service.createMemory({ content: '' })
    ).rejects.toThrow();
  });
});
```

### Integration Tests

- Test API endpoints end-to-end
- Use test database (separate PostgreSQL database or schema)
- Clean up test data after each run

## Git Workflow

### Branch Naming

- `feature/description` - New features
- `fix/description` - Bug fixes
- `refactor/description` - Code refactoring
- `docs/description` - Documentation updates

### Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add search by date range
fix: correct embedding dimension mismatch
docs: update API documentation
refactor: simplify memory creation logic
test: add tests for transformer service
```

### Pull Request Process

1. Create a feature branch from `main`
2. Make your changes
3. Ensure all tests pass: `pnpm test`
4. Ensure code quality: `pnpm lint && pnpm type-check`
5. Update documentation if needed
6. Submit PR with clear description
7. Address review feedback
8. Squash and merge when approved

## Adding Dependencies

### When to Add a Dependency

- Does it solve a real problem?
- Is it actively maintained?
- Does it have good TypeScript support?
- Is the bundle size acceptable?

### How to Add Dependencies

```bash
# API app dependency
pnpm --filter api add package-name

# Shared package dependency
pnpm --filter @unified-memory/shared add package-name

# Dev dependency (root)
pnpm add -D -w package-name
```

## Adding New Features

### Creating a New Service

1. Create directory in `services/`
2. Add package.json with workspace dependencies
3. Set up TypeScript config
4. Implement service with proper error handling
5. Add Dockerfile in `docker/`
6. Update docker-compose.yml
7. Document in README

### Creating a New API Endpoint

1. Create route in `apps/api/src/app/api/`
2. Define request/response schemas with Zod
3. Implement handler with error handling
4. Add tests
5. Update API documentation

### Adding a Platform Transformer

1. Create transformer in `services/transformers/src/platforms/`
2. Implement `TransformerInput` → `TransformerOutput`
3. Register in transformer service
4. Add platform to `.env.example`
5. Update documentation

## Code Review Checklist

### For Reviewers

- [ ] Code follows style guide
- [ ] Tests are comprehensive
- [ ] No security vulnerabilities introduced
- [ ] Error handling is appropriate
- [ ] Documentation is updated
- [ ] No unnecessary dependencies added
- [ ] Performance impact is acceptable

### For Authors

Before requesting review:

- [ ] Self-review your code
- [ ] Run `pnpm lint:fix && pnpm format`
- [ ] Run `pnpm type-check`
- [ ] All tests pass
- [ ] Add/update tests for changes
- [ ] Update documentation
- [ ] No debug code or console.logs (except in logging)

## Common Patterns

### Logging

```typescript
import { createLogger } from '@unified-memory/shared';

const logger = createLogger('service-name');

logger.info('Operation started', { userId: '123' });
logger.error('Operation failed', { error: error.message });
```

### Configuration

```typescript
// Load from environment with defaults
const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  postgresHost: process.env.POSTGRES_HOST || 'localhost',
  postgresPort: parseInt(process.env.POSTGRES_PORT || '5432', 10),
};
```

### Validation

```typescript
import { z } from 'zod';

const InputSchema = z.object({
  content: z.string().min(1),
});

const validated = InputSchema.parse(input);
```

## Performance Guidelines

- Avoid N+1 queries (batch operations when possible)
- Use streaming for large datasets
- Implement pagination for list endpoints
- Cache expensive computations
- Profile before optimizing

## Security Guidelines

- Never log sensitive data (API keys, passwords)
- Validate all user input
- Use parameterized queries (PostgreSQL prevents SQL injection)
- Keep dependencies updated
- Run security audits: `pnpm audit`

## Getting Help

- Check existing documentation in `/docs`
- Review similar code in the codebase
- Ask questions in PR comments
- Create an issue for larger discussions
