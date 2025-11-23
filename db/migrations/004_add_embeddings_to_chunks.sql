-- =============================================================================
-- Migration 004: Add Embeddings to Chunks
-- =============================================================================
-- This migration adds embedding support to the chunks table for vector search

-- =============================================================================
-- 1. ADD EMBEDDING COLUMN TO CHUNKS
-- =============================================================================

ALTER TABLE chunks
ADD COLUMN IF NOT EXISTS embedding vector(1536);  -- Default for text-embedding-3-small

-- Create HNSW index for fast vector similarity search
CREATE INDEX IF NOT EXISTS idx_chunks_embedding
ON chunks
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- Alternative: IVFFlat index (faster build, slower search)
-- CREATE INDEX IF NOT EXISTS idx_chunks_embedding_ivfflat
-- ON chunks
-- USING ivfflat (embedding vector_cosine_ops)
-- WITH (lists = 100);

COMMENT ON COLUMN chunks.embedding IS 'Vector embedding for semantic search (1536 dimensions for text-embedding-3-small)';

-- =============================================================================
-- 2. ADD EMBEDDING METADATA COLUMNS
-- =============================================================================

ALTER TABLE chunks
ADD COLUMN IF NOT EXISTS embedding_model VARCHAR(100),
ADD COLUMN IF NOT EXISTS embedding_tokens INTEGER,
ADD COLUMN IF NOT EXISTS embedded_at TIMESTAMPTZ;

COMMENT ON COLUMN chunks.embedding_model IS 'Model used to generate embedding (e.g., text-embedding-3-small)';
COMMENT ON COLUMN chunks.embedding_tokens IS 'Number of tokens used for embedding';
COMMENT ON COLUMN chunks.embedded_at IS 'When the embedding was generated';

-- =============================================================================
-- 3. CREATE HELPER FUNCTIONS
-- =============================================================================

-- Function to search chunks by vector similarity
CREATE OR REPLACE FUNCTION search_chunks_by_embedding(
  query_embedding vector(1536),
  similarity_threshold float DEFAULT 0.7,
  result_limit int DEFAULT 10,
  filter_method varchar DEFAULT NULL
)
RETURNS TABLE (
  id VARCHAR(500),
  canonical_object_id VARCHAR(255),
  content TEXT,
  method VARCHAR(50),
  metadata JSONB,
  similarity float
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id,
    c.canonical_object_id,
    c.content,
    c.method,
    c.metadata,
    1 - (c.embedding <=> query_embedding) AS similarity
  FROM chunks c
  WHERE
    c.embedding IS NOT NULL
    AND (filter_method IS NULL OR c.method = filter_method)
    AND (1 - (c.embedding <=> query_embedding)) >= similarity_threshold
  ORDER BY c.embedding <=> query_embedding
  LIMIT result_limit;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION search_chunks_by_embedding IS 'Search chunks by vector similarity with optional filtering';

-- =============================================================================
-- 4. ADD INDEX ON EMBEDDING METADATA
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_chunks_embedded_at ON chunks(embedded_at);
CREATE INDEX IF NOT EXISTS idx_chunks_embedding_model ON chunks(embedding_model);

-- =============================================================================
-- USAGE EXAMPLES
-- =============================================================================
/*
-- Search for similar chunks
SELECT * FROM search_chunks_by_embedding(
  '[0.1, 0.2, ...]'::vector(1536),
  0.8,  -- similarity threshold
  20,   -- limit
  'semantic'  -- optional: filter by chunking method
);

-- Get chunks without embeddings
SELECT id, canonical_object_id, method, created_at
FROM chunks
WHERE embedding IS NULL
ORDER BY created_at DESC;

-- Get embedding statistics
SELECT
  embedding_model,
  COUNT(*) as chunks_count,
  SUM(embedding_tokens) as total_tokens,
  AVG(embedding_tokens) as avg_tokens,
  MIN(embedded_at) as first_embedded,
  MAX(embedded_at) as last_embedded
FROM chunks
WHERE embedding IS NOT NULL
GROUP BY embedding_model;
*/
