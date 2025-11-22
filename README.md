# Unified Memory

A high-performance, production-ready unified memory system built with Next.js, Node.js, and Qdrant vector database. This monorepo provides a complete platform for ingesting, transforming, storing, and retrieving memories from multiple sources with semantic search capabilities.

## Architecture

```
unified-memory/
├── apps/
│   └── api/              # Next.js API with REST endpoints
├── services/
│   ├── ingestion/        # Data ingestion pipeline
│   └── transformers/     # Platform-specific transformers
├── packages/
│   ├── shared/           # Shared types and utilities
│   └── db/               # Qdrant database client
├── config/               # Configuration files
├── docs/                 # Documentation
└── docker/               # Dockerfiles for services
```

### Core Components

- **API Service** (Next.js): REST API for memory operations with type-safe endpoints
- **Ingestion Service**: Event-driven pipeline for data intake from multiple sources
- **Transformers Service**: Platform-specific data normalization (Slack, Discord, Email, etc.)
- **Qdrant Vector DB**: High-performance vector storage for semantic search
- **Shared Packages**: Type-safe utilities and database clients used across services

## Tech Stack

- **Runtime**: Node.js 18+
- **Framework**: Next.js 14+ (App Router)
- **Language**: TypeScript 5.3+
- **Package Manager**: pnpm 8+
- **Vector Database**: Qdrant
- **Validation**: Zod
- **Code Quality**: ESLint, Prettier, Husky
- **Containerization**: Docker, Docker Compose

## Prerequisites

- **Node.js** >= 18.0.0
- **pnpm** >= 8.0.0
- **Docker** and **Docker Compose** (for Qdrant)

```bash
# Install pnpm globally
npm install -g pnpm

# Verify installations
node --version
pnpm --version
docker --version
```

## Getting Started

### 1. Clone and Install

```bash
# Install dependencies
pnpm install

# Install pre-commit hooks
pnpm prepare
```

### 2. Environment Setup

```bash
# Copy environment template
cp .env.example .env

# Edit .env with your configuration
# At minimum, you need:
# - QDRANT_URL (default: http://localhost:6333)
# - Your embeddings provider API key (OpenAI, Cohere, etc.)
```

### 3. Start Qdrant

```bash
# Start Qdrant vector database
pnpm docker:up

# Verify Qdrant is running
curl http://localhost:6333/health
```

### 4. Build Shared Packages

```bash
# Build shared packages (required for workspace dependencies)
pnpm --filter @unified-memory/shared build
pnpm --filter @unified-memory/db build
```

### 5. Start Development Servers

```bash
# Option 1: Start all services in parallel
pnpm dev

# Option 2: Start services individually
pnpm dev:api          # API on port 3000
pnpm dev:ingestion    # Ingestion on port 3001
pnpm dev:transformers # Transformers on port 3002
```

### 6. Verify Setup

```bash
# Check API health
curl http://localhost:3000/api/health

# Expected response:
# {
#   "status": "healthy",
#   "timestamp": "2024-...",
#   "services": {
#     "api": "up",
#     "database": "up"
#   }
# }
```

## Development Workflow

### Running Services

```bash
# Development mode (hot reload)
pnpm dev

# Build for production
pnpm build

# Run production build
pnpm start
```

### Code Quality

```bash
# Lint all packages
pnpm lint

# Fix linting issues
pnpm lint:fix

# Format code
pnpm format

# Type checking
pnpm type-check
```

### Working with the Monorepo

```bash
# Install a dependency in a specific package
pnpm --filter api add axios
pnpm --filter @unified-memory/shared add zod

# Run a script in a specific package
pnpm --filter api dev
pnpm --filter ingestion build

# Add a workspace dependency
# In apps/api/package.json:
# "@unified-memory/shared": "workspace:*"
```

## API Documentation

### Health Check

```bash
GET /api/health
```

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "services": {
    "api": "up",
    "database": "up"
  }
}
```

### Create Memory

```bash
POST /api/memory
Content-Type: application/json

{
  "content": "Important meeting notes from today",
  "metadata": {
    "source": "slack",
    "channel": "engineering"
  },
  "tags": ["meeting", "engineering"]
}
```

### Search Memories

```bash
GET /api/memory?query=meeting&limit=10&offset=0
```

**Response:**
```json
{
  "memories": [...],
  "pagination": {
    "limit": 10,
    "offset": 0,
    "total": 42
  }
}
```

## Docker Deployment

### Local Development with Docker

```bash
# Start all services with Docker Compose
docker-compose up

# Start in detached mode
docker-compose up -d

# View logs
docker-compose logs -f

# Stop all services
docker-compose down
```

### Build Production Images

```bash
# Build all images
docker-compose build

# Build specific service
docker build -f docker/api.Dockerfile -t unified-memory-api .
```

## Project Structure

```
unified-memory/
├── apps/
│   └── api/
│       ├── src/
│       │   ├── app/
│       │   │   ├── api/          # API routes
│       │   │   │   ├── health/
│       │   │   │   └── memory/
│       │   │   ├── layout.tsx
│       │   │   └── page.tsx
│       │   └── lib/              # App-specific utilities
│       ├── next.config.js
│       ├── package.json
│       └── tsconfig.json
│
├── services/
│   ├── ingestion/
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   └── processors/       # Data processors
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   └── transformers/
│       ├── src/
│       │   ├── index.ts
│       │   └── platforms/        # Platform transformers
│       ├── package.json
│       └── tsconfig.json
│
├── packages/
│   ├── shared/
│   │   ├── src/
│   │   │   ├── types/
│   │   │   │   ├── memory.ts
│   │   │   │   └── platform.ts
│   │   │   └── utils/
│   │   │       └── logger.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   └── db/
│       ├── src/
│       │   ├── qdrant/
│       │   │   └── client.ts
│       │   └── index.ts
│       ├── package.json
│       └── tsconfig.json
│
├── docker/                       # Dockerfiles
├── config/                       # Configuration files
├── docs/                         # Documentation
├── .github/workflows/            # CI/CD workflows
├── docker-compose.yml
├── package.json                  # Root workspace config
├── pnpm-workspace.yaml
├── tsconfig.json                 # Base TypeScript config
├── .eslintrc.js
├── .prettierrc
└── README.md
```

## Environment Variables

See `.env.example` for all available configuration options. Key variables:

| Variable | Description | Required |
|----------|-------------|----------|
| `QDRANT_URL` | Qdrant database URL | Yes |
| `QDRANT_COLLECTION_NAME` | Collection name for memories | Yes |
| `OPENAI_API_KEY` | OpenAI API key for embeddings | Yes* |
| `PORT` | API service port | No (default: 3000) |
| `NODE_ENV` | Environment (development/production) | No |

*Required if using OpenAI for embeddings. Alternative: Cohere, local models.

## Testing

```bash
# Run all tests
pnpm test

# Run tests for specific package
pnpm --filter api test

# Run tests in watch mode
pnpm test:watch
```

## Troubleshooting

### Qdrant Connection Issues

```bash
# Check if Qdrant is running
docker ps | grep qdrant

# Check Qdrant logs
docker logs unified-memory-qdrant

# Restart Qdrant
pnpm docker:down && pnpm docker:up
```

### TypeScript Errors in Monorepo

```bash
# Rebuild all shared packages
pnpm --filter @unified-memory/shared build
pnpm --filter @unified-memory/db build

# Clear TypeScript cache
pnpm clean
rm -rf **/tsconfig.tsbuildinfo
```

### Port Already in Use

```bash
# Find process using port 3000
lsof -i :3000

# Kill the process
kill -9 <PID>
```

## Next Steps

1. **Implement Embeddings**: Add your embeddings provider (OpenAI, Cohere, or local model)
2. **Add Platform Transformers**: Implement platform-specific transformers for Slack, Discord, etc.
3. **Set Up Authentication**: Add API key authentication or OAuth
4. **Configure CI/CD**: Set up GitHub Actions for automated testing and deployment
5. **Add Monitoring**: Integrate Sentry, DataDog, or similar for production monitoring

## Contributing

1. Create a feature branch
2. Make your changes
3. Run `pnpm lint` and `pnpm type-check`
4. Commit with descriptive message
5. Submit a pull request

Pre-commit hooks will automatically:
- Lint and format your code
- Run type checking
- Ensure code quality standards

## License

MIT

## Support

For issues or questions:
- Create an issue in the repository
- Check existing documentation in `/docs`
- Review the `.env.example` for configuration options

---

**Built with precision. Ready for production.**
