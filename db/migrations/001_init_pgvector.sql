-- ============================================================================
-- Unified Memory - PostgreSQL with pgvector initialization
-- ============================================================================
-- This migration creates the initial schema for the unified memory system
-- using PostgreSQL with the pgvector extension for vector similarity search.

-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Create memories table with vector storage
CREATE TABLE IF NOT EXISTS memories (
  -- Primary key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Vector embedding (dimension: 1536 for OpenAI text-embedding-3-small)
  -- Adjust dimension based on your embedding model:
  -- - OpenAI text-embedding-3-small: 1536
  -- - OpenAI text-embedding-3-large: 3072
  -- - Cohere embed-english-v3.0: 1024
  embedding vector(1536) NOT NULL,

  -- Core content
  content TEXT NOT NULL,

  -- Metadata storage (JSONB for flexible schema and indexing)
  metadata JSONB DEFAULT '{}'::jsonb,

  -- Tags for categorization
  tags TEXT[] DEFAULT '{}',

  -- Source platform identifier
  platform VARCHAR(50),

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- ============================================================================
-- Indexes for performance
-- ============================================================================

-- Vector similarity search index (IVFFlat with cosine distance)
-- IVFFlat is an approximate nearest neighbor (ANN) algorithm
-- Lists parameter: number of clusters (rule of thumb: rows/1000 for < 1M rows)
CREATE INDEX IF NOT EXISTS memories_embedding_idx
ON memories
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- Note: After inserting data, you may want to recreate this index with:
-- lists = max(rows / 1000, 10) for optimal performance

-- Metadata search index (GIN for JSONB)
CREATE INDEX IF NOT EXISTS memories_metadata_idx
ON memories
USING GIN (metadata);

-- Tags search index (GIN for array)
CREATE INDEX IF NOT EXISTS memories_tags_idx
ON memories
USING GIN (tags);

-- Platform filtering index (B-tree)
CREATE INDEX IF NOT EXISTS memories_platform_idx
ON memories (platform);

-- Timestamp index for time-based queries
CREATE INDEX IF NOT EXISTS memories_created_at_idx
ON memories (created_at DESC);

-- ============================================================================
-- Update timestamp trigger
-- ============================================================================

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to call the function before each update
CREATE TRIGGER update_memories_updated_at
BEFORE UPDATE ON memories
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- Helper functions for vector search
-- ============================================================================

-- Function to search memories by vector similarity with metadata filtering
CREATE OR REPLACE FUNCTION search_memories(
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.7,
  match_count int DEFAULT 10,
  filter_platform varchar DEFAULT NULL,
  filter_tags text[] DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  content text,
  metadata jsonb,
  tags text[],
  platform varchar,
  similarity float,
  created_at timestamptz
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    m.id,
    m.content,
    m.metadata,
    m.tags,
    m.platform,
    1 - (m.embedding <=> query_embedding) AS similarity,
    m.created_at
  FROM memories m
  WHERE
    -- Similarity threshold filter
    1 - (m.embedding <=> query_embedding) > match_threshold
    -- Optional platform filter
    AND (filter_platform IS NULL OR m.platform = filter_platform)
    -- Optional tags filter (array overlap)
    AND (filter_tags IS NULL OR m.tags && filter_tags)
  ORDER BY m.embedding <=> query_embedding
  LIMIT match_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Comments for documentation
-- ============================================================================

COMMENT ON TABLE memories IS 'Stores text memories with vector embeddings for semantic search';
COMMENT ON COLUMN memories.embedding IS 'Vector embedding generated from content (dimension: 1536)';
COMMENT ON COLUMN memories.metadata IS 'Flexible JSON storage for platform-specific data';
COMMENT ON COLUMN memories.tags IS 'Array of tags for categorization and filtering';
COMMENT ON INDEX memories_embedding_idx IS 'IVFFlat index for approximate nearest neighbor search using cosine distance';
