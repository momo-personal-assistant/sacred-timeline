# Architecture Overview

## System Design

The Unified Memory system is designed as a microservices architecture with the following key principles:

### Design Principles

1. **Separation of Concerns**: Each service has a single, well-defined responsibility
2. **Type Safety**: End-to-end TypeScript for compile-time guarantees
3. **Scalability**: Services can be scaled independently based on load
4. **Resilience**: Graceful degradation and comprehensive error handling
5. **Developer Experience**: Hot reload, clear logs, easy debugging

## Services Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         Client Layer                         │
│                    (External Consumers)                      │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                      API Service (Next.js)                   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │  REST API    │  │  Validation  │  │  Auth        │     │
│  │  Routes      │  │  (Zod)       │  │  Middleware  │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                     Shared Packages                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │  @unified-   │  │  @unified-   │  │  Types &     │     │
│  │  memory/db   │  │  memory/     │  │  Utils       │     │
│  │              │  │  shared      │  │              │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
└──────────────────────────┬──────────────────────────────────┘
                           │
        ┌──────────────────┼──────────────────┐
        │                  │                  │
        ▼                  ▼                  ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│  Ingestion   │  │ Transformers │  │ PostgreSQL   │
│  Service     │  │  Service     │  │  + pgvector  │
│              │  │              │  │              │
│  - Webhooks  │  │  - Slack     │  │  - Vectors   │
│  - Batch     │  │  - Discord   │  │  - Search    │
│  - Streaming │  │  - Email     │  │  - ACID      │
└──────────────┘  └──────────────┘  └──────────────┘
```

## Data Flow

### Memory Creation Flow

1. **Input**: Client sends POST /api/memory with content
2. **Validation**: API validates request with Zod schema
3. **Transform**: If platform-specific, send to transformer service
4. **Embeddings**: Generate vector embeddings (OpenAI/Cohere/local)
5. **Storage**: Store in PostgreSQL with pgvector
6. **Response**: Return created memory with ID

### Memory Search Flow

1. **Input**: Client sends GET /api/memory with query
2. **Embeddings**: Generate query embeddings
3. **Vector Search**: Query PostgreSQL with pgvector (<=> operator)
4. **Ranking**: Apply metadata filters and ranking (SQL WHERE)
5. **Response**: Return top-k results with metadata

## Database Schema (PostgreSQL)

### Table Structure

```sql
CREATE TABLE memories (
  id UUID PRIMARY KEY,
  embedding vector(1536),              -- pgvector type
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',         -- Flexible JSON storage
  tags TEXT[] DEFAULT '{}',            -- Array of tags
  platform VARCHAR(50),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Vector similarity index (IVFFlat)
CREATE INDEX ON memories USING ivfflat (embedding vector_cosine_ops);

-- Metadata and tag indexes
CREATE INDEX ON memories USING GIN (metadata);
CREATE INDEX ON memories USING GIN (tags);
```

### Key Features

- **ACID Transactions**: Full PostgreSQL reliability
- **JSONB**: Flexible metadata with GIN indexing for fast queries
- **Vector Search**: pgvector extension with cosine/L2/inner product distance
- **Array Support**: Native TEXT[] for tags
- **Triggers**: Auto-update timestamps

## Scalability Considerations

### Horizontal Scaling

- **API Service**: Stateless, can run multiple instances behind load balancer
- **Ingestion Service**: Queue-based processing enables multiple workers
- **Transformers Service**: Stateless transformation, easily parallelized
- **PostgreSQL**: Native replication, sharding with pg_partman, connection pooling with PgBouncer

### Performance Optimizations

1. **Caching**: Redis layer for frequently accessed memories (future)
2. **Batching**: Batch embeddings generation to reduce API calls
3. **Async Processing**: Non-blocking I/O for all operations
4. **Connection Pooling**: Reuse database connections

## Security

### Current Implementation

- Input validation with Zod schemas
- CORS configuration in Next.js
- Environment-based configuration

### Future Enhancements

- API key authentication
- Rate limiting
- JWT-based auth for users
- Encryption at rest for sensitive data
- Audit logging

## Monitoring & Observability

### Recommended Stack

- **Metrics**: Prometheus + Grafana
- **Logging**: Structured JSON logs (upgrade to Pino/Winston)
- **Tracing**: OpenTelemetry for distributed tracing
- **Errors**: Sentry for error tracking
- **Uptime**: Health check endpoints + monitoring service

## Technology Choices

### Why Next.js?

- Built-in API routes (no separate Express needed)
- Excellent TypeScript support
- Hot reload for fast development
- Can add web UI later without new infrastructure

### Why pgvector (PostgreSQL)?

- **Unified Database**: Relational + vector data in one system (no separate DB)
- **ACID Transactions**: Full consistency guarantees for critical operations
- **Mature Ecosystem**: 30+ years of PostgreSQL reliability and tooling
- **Cost-Effective**: Use existing PostgreSQL infrastructure, no additional DB
- **Rich Queries**: Combine vector search with complex SQL filters (JOINs, aggregations)
- **pgvector Performance**: Competitive with specialized vector DBs for < 10M vectors
- **Production-Ready**: Used by major companies (Supabase, Neon, Timescale) for vector search

### Why pnpm?

- Fastest package manager for monorepos
- Efficient disk space usage (content-addressable storage)
- Strict dependency management
- Great workspace support

### Why TypeScript?

- Catch errors at compile time
- Better IDE support and autocomplete
- Self-documenting code with types
- Easier refactoring and maintenance
