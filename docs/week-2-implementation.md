# Week 2 Implementation: Embedding & Retrieval Layer

## Overview

Week 2 focuses on implementing the core retrieval pipeline for the Persistent Memory RAG system. Following the Vertical Slice Iterative approach, we built a simple but functional end-to-end system that can:

1. Chunk canonical objects into smaller pieces
2. Generate embeddings using OpenAI
3. Store embeddings in PostgreSQL with pgvector
4. Search for relevant information using vector similarity
5. Validate results against ground truth relations

## Architecture

```
Canonical Objects
       |
       v
   Chunking (3 strategies)
       |
       v
   Embedding (OpenAI)
       |
       v
   Vector Storage (pgvector)
       |
       v
   Vector Search + Graph Traversal
       |
       v
   Results + Relations
```

## Components Implemented

### 1. Embedding Package (`packages/embedding`)

**Purpose**: Generate embeddings and chunk text for semantic search

**Files**:

- `openai-embedder.ts` - OpenAI API wrapper for embeddings
- `chunker.ts` - Text chunking strategies
- `index.ts` - Package exports

**Key Features**:

- OpenAI text-embedding-3-small integration
- Batch processing for efficiency
- Cost estimation
- Three chunking strategies:
  - **Fixed-size**: Simple overlap-based chunking
  - **Semantic**: Paragraph-aware chunking
  - **Relational**: Structure-preserving (title + body)

**Usage**:

```typescript
import { OpenAIEmbedder, Chunker } from '@momo/embedding';

// Initialize embedder
const embedder = new OpenAIEmbedder({
  apiKey: process.env.OPENAI_API_KEY,
  model: 'text-embedding-3-small',
  batchSize: 100,
});

// Initialize chunker
const chunker = new Chunker({
  strategy: 'semantic',
  maxChunkSize: 500,
  overlap: 50,
  preserveMetadata: true,
});

// Chunk and embed
const chunks = chunker.chunk(canonicalObject);
const result = await embedder.embedBatch(chunks.map((c) => c.content));
```

### 2. Database Schema Updates (Migration 004)

**Purpose**: Add embedding support to chunks table

**Changes**:

- Added `embedding vector(1536)` column
- Added `embedding_model`, `embedding_tokens`, `embedded_at` metadata columns
- Created HNSW index for fast vector similarity search
- Added `search_chunks_by_embedding()` PostgreSQL function

**Key SQL**:

```sql
-- Add embedding column
ALTER TABLE chunks
ADD COLUMN embedding vector(1536);

-- Create HNSW index
CREATE INDEX idx_chunks_embedding
ON chunks
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- Search function
CREATE FUNCTION search_chunks_by_embedding(
  query_embedding vector(1536),
  similarity_threshold float DEFAULT 0.7,
  result_limit int DEFAULT 10
) RETURNS TABLE (...);
```

### 3. Query Package (`packages/query`)

**Purpose**: Retrieve relevant information using vector search and graph traversal

**Files**:

- `retriever.ts` - Main retrieval logic
- `index.ts` - Package exports

**Key Features**:

- Vector similarity search using pgvector
- Graph traversal using inferred relations
- Configurable similarity threshold and result limit
- Expansion to related objects

**Usage**:

```typescript
import { Retriever } from '@momo/query';

const retriever = new Retriever(db, embedder, relationInferrer, {
  similarityThreshold: 0.7,
  chunkLimit: 20,
  includeRelations: true,
});

const result = await retriever.retrieve('authentication issues');
// Returns: { chunks, objects, relations, stats }
```

### 4. Scripts

#### `scripts/embed-chunks.ts`

**Purpose**: Generate and store embeddings for all canonical objects

**Usage**:

```bash
# Embed with semantic chunking
pnpm tsx scripts/embed-chunks.ts semantic

# Embed with fixed-size chunking
pnpm tsx scripts/embed-chunks.ts fixed-size

# Embed with relational chunking
pnpm tsx scripts/embed-chunks.ts relational
```

**Process**:

1. Fetch all canonical objects from database
2. Chunk using specified strategy
3. Generate embeddings in batches
4. Store chunks + embeddings in database
5. Report statistics (tokens, cost, time)

#### `scripts/query.ts`

**Purpose**: Test retrieval with sample queries

**Usage**:

```bash
pnpm tsx scripts/query.ts "authentication issues"
pnpm tsx scripts/query.ts "SSO project status"
```

**Output**:

- Top matching chunks with similarity scores
- Related canonical objects
- Inferred relations
- Statistics (retrieval time, counts)

#### `scripts/validate-relations.ts`

**Purpose**: Validate relation inference against ground truth

**Usage**:

```bash
# Validate single scenario
pnpm tsx scripts/validate-relations.ts normal

# Validate all scenarios
pnpm tsx scripts/validate-relations.ts all
```

**Metrics Calculated**:

- **Precision**: TP / (TP + FP) - How many inferred relations are correct?
- **Recall**: TP / (TP + FN) - How many ground truth relations did we find?
- **F1 Score**: 2 × (Precision × Recall) / (Precision + Recall) - Harmonic mean

**Output**:

- Per-scenario metrics
- Average metrics across scenarios
- Detailed JSON results file
- Breakdown of TP, FP, FN

## Setup & Configuration

### 1. Environment Variables

Add to `.env`:

```bash
# OpenAI API Key (required for embedding)
OPENAI_API_KEY=sk-...

# Embedding model (optional, defaults to text-embedding-3-small)
OPENAI_EMBEDDING_MODEL=text-embedding-3-small

# Vector dimensions (must match model, default 1536)
VECTOR_DIMENSIONS=1536
```

### 2. Install Dependencies

```bash
pnpm install
```

This installs:

- `openai` - OpenAI API client
- Other workspace dependencies

### 3. Run Migrations

```bash
# Migration 004 adds embedding support
PGPASSWORD=unified_memory_dev psql -h localhost -p 5434 \
  -U unified_memory -d unified_memory \
  -f db/migrations/004_add_embeddings_to_chunks.sql
```

## Workflow

### Complete Pipeline

```bash
# 1. Ingest synthetic data (Week 1)
pnpm tsx scripts/ingest-synthetic.ts normal

# 2. Generate embeddings (Week 2)
pnpm tsx scripts/embed-chunks.ts semantic

# 3. Test retrieval (Week 2)
pnpm tsx scripts/query.ts "authentication issues"

# 4. Validate relations (Week 2)
pnpm tsx scripts/validate-relations.ts normal
```

### Expected Results

After running the full pipeline:

**Database State**:

- 88 canonical objects (from Week 1)
- ~200-300 chunks (depending on strategy)
- 213 ground truth relations

**Validation Metrics** (baseline with keyword-based similarity):

- Precision: ~30-50% (many false positives due to simple algorithm)
- Recall: ~20-40% (missing many implicit relations)
- F1 Score: ~25-45%

**Note**: These are baseline metrics. Week 3-4 will focus on improving them through:

- Better embedding models (Cohere, Voyage AI)
- Advanced chunking strategies
- LLM-based relation extraction
- Contextual retrieval techniques

## Performance Characteristics

### Embedding Generation

**Costs** (text-embedding-3-small @ $0.02 per 1M tokens):

- 100 objects × 500 chars avg = ~12,000 tokens
- Cost: ~$0.0002 (negligible)

**Speed**:

- Batch size 100: ~1-2 seconds per batch
- 300 chunks: ~6-10 seconds total

### Vector Search

**Query Latency**:

- HNSW index: ~10-50ms for top-20 results
- Including object fetch: ~50-100ms
- Including relation inference: ~100-200ms

**Accuracy** (with HNSW):

- Recall@10: ~95% (vs exact search)
- Recall@20: ~98%

## Known Limitations

### 1. Simple Relation Inference

**Issue**: Currently uses keyword overlap only
**Impact**: Low precision/recall (30-50%)
**Fix (Week 3-4)**: Implement LLM-based relation extraction

### 2. No Temporal Awareness

**Issue**: Doesn't consider timestamps or state changes
**Impact**: Can't distinguish current vs historical state
**Fix (Week 5)**: Implement Temporal Layer

### 3. No Consolidation

**Issue**: All events treated equally, no summarization
**Impact**: Information overload for old data
**Fix (Week 6)**: Implement Consolidation Layer

### 4. No Reasoning

**Issue**: No importance scoring or risk detection
**Impact**: Can't prioritize critical information
**Fix (Week 6)**: Implement Reasoning Layer

## Comparison to Week 1

| Aspect            | Week 1                          | Week 2                       |
| ----------------- | ------------------------------- | ---------------------------- |
| **Goal**          | Working ingestion               | Working retrieval            |
| **Packages**      | ingestion, transformers, graph  | + embedding, query           |
| **Database**      | canonical_objects, ground_truth | + chunks with embeddings     |
| **Capabilities**  | Ingest + simple relations       | + Vector search + validation |
| **Validation**    | Manual inspection               | Automated P/R/F1 metrics     |
| **External APIs** | None                            | OpenAI embeddings            |

## Next Steps (Week 3)

### Focus: Embedding Optimization

**Tasks**:

1. Compare embedding models:
   - OpenAI text-embedding-3-small (baseline)
   - OpenAI text-embedding-3-large
   - Cohere embed-english-v3.0
   - Voyage AI voyage-3

2. Optimize chunking:
   - Experiment with different chunk sizes (200, 500, 1000 chars)
   - Try different overlap ratios (10%, 20%, 30%)
   - Test hybrid strategies (title + body separately)

3. Implement Contextual Retrieval:
   - Add context to chunks (document title, metadata)
   - Test Anthropic's "Contextual Retrieval" approach
   - Measure impact on precision/recall

4. Measure everything:
   - Run validation after each change
   - Track P/R/F1 across scenarios
   - Optimize for F1 score

**Success Criteria**:

- F1 score > 60% (up from ~40%)
- Query latency < 100ms (p95)
- Cost < $0.01 per 1000 queries

## References

### Internal

- `packages/embedding/` - Embedding and chunking code
- `packages/query/` - Retrieval code
- `scripts/embed-chunks.ts` - Embedding generation
- `scripts/validate-relations.ts` - Validation script
- `db/migrations/004_add_embeddings_to_chunks.sql` - Schema

### External

- [OpenAI Embeddings Guide](https://platform.openai.com/docs/guides/embeddings)
- [pgvector Documentation](https://github.com/pgvector/pgvector)
- [Anthropic Contextual Retrieval](https://www.anthropic.com/news/contextual-retrieval)
- [HNSW Algorithm](https://arxiv.org/abs/1603.09320)

## Glossary

- **Chunk**: Small piece of text from a canonical object
- **Embedding**: Vector representation of text (1536 dimensions)
- **Vector Search**: Finding similar embeddings using cosine similarity
- **HNSW**: Hierarchical Navigable Small World - fast approximate nearest neighbor search
- **Ground Truth**: Known correct relations for validation
- **Precision**: Fraction of retrieved relations that are correct
- **Recall**: Fraction of correct relations that were retrieved
- **F1 Score**: Harmonic mean of precision and recall
- **TP (True Positive)**: Correctly inferred relation
- **FP (False Positive)**: Incorrectly inferred relation
- **FN (False Negative)**: Missed ground truth relation
