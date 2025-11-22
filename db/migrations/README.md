# Database Migrations

This directory contains SQL migration scripts for the PostgreSQL database with pgvector extension.

## Running Migrations

### Option 1: Docker Compose (Automatic)

Migrations in this directory are automatically run when PostgreSQL starts for the first time:

```bash
pnpm docker:up
```

The `docker-compose.yml` mounts this directory to `/docker-entrypoint-initdb.d/`, which PostgreSQL executes on initialization.

### Option 2: Manual Execution

```bash
# Connect to PostgreSQL
psql -h localhost -U unified_memory -d unified_memory

# Run migration
\i db/migrations/001_init_pgvector.sql
```

### Option 3: Using psql directly

```bash
psql -h localhost -U unified_memory -d unified_memory -f db/migrations/001_init_pgvector.sql
```

## Migration Files

- `001_init_pgvector.sql` - Initial schema setup with pgvector extension

## Schema Overview

### Table: `memories`

Stores text memories with vector embeddings for semantic search.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key (auto-generated) |
| `embedding` | vector(1536) | Vector embedding from content |
| `content` | TEXT | Original text content |
| `metadata` | JSONB | Flexible platform-specific data |
| `tags` | TEXT[] | Array of tags for categorization |
| `platform` | VARCHAR(50) | Source platform identifier |
| `created_at` | TIMESTAMPTZ | Creation timestamp (auto) |
| `updated_at` | TIMESTAMPTZ | Last update timestamp (auto) |

### Indexes

- **memories_embedding_idx** (IVFFlat): Vector similarity search (cosine distance)
- **memories_metadata_idx** (GIN): JSONB metadata filtering
- **memories_tags_idx** (GIN): Array tag filtering
- **memories_platform_idx** (B-tree): Platform filtering
- **memories_created_at_idx** (B-tree): Time-based queries

### Helper Functions

#### `search_memories()`

Performs vector similarity search with optional metadata filtering.

**Parameters:**
- `query_embedding` (vector): Query vector to search for
- `match_threshold` (float): Minimum similarity score (0-1)
- `match_count` (int): Maximum number of results
- `filter_platform` (varchar): Optional platform filter
- `filter_tags` (text[]): Optional tags filter (array overlap)

**Example:**
```sql
SELECT * FROM search_memories(
  '[0.1, 0.2, ..., 0.9]'::vector(1536),
  0.7,  -- 70% similarity threshold
  10,   -- top 10 results
  'slack',  -- only Slack messages
  ARRAY['meeting', 'engineering']  -- with these tags
);
```

## Vector Operators

pgvector provides three distance operators:

- `<=>` : Cosine distance (recommended for normalized embeddings)
- `<->` : L2 (Euclidean) distance
- `<#>` : Inner product (negative, for maximum inner product search)

**Similarity Score:** `1 - (embedding <=> query)` gives a 0-1 score where 1 is identical.

## Index Tuning

### IVFFlat Lists Parameter

The `lists` parameter controls the number of clusters for the IVFFlat index:

- **Small datasets (< 100K rows):** `lists = 100`
- **Medium datasets (100K - 1M rows):** `lists = rows / 1000`
- **Large datasets (> 1M rows):** Consider HNSW index instead

Rebuild index after significant data growth:

```sql
DROP INDEX memories_embedding_idx;
CREATE INDEX memories_embedding_idx
ON memories
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 500);  -- Adjust based on row count
```

### HNSW Index (Alternative for Large Datasets)

For better recall on large datasets, use HNSW:

```sql
CREATE INDEX memories_embedding_hnsw_idx
ON memories
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);
```

## Troubleshooting

### Extension not found

```bash
# Install pgvector extension in PostgreSQL
# Already included in pgvector/pgvector Docker image
```

### Slow queries

1. Check index usage: `EXPLAIN ANALYZE SELECT ...`
2. Increase `lists` parameter for IVFFlat
3. Consider HNSW index for large datasets
4. Adjust `probes` for search: `SET ivfflat.probes = 10;`

### Out of memory

Reduce embedding dimension or use quantization for large datasets.
