-- ============================================================================
-- Supabase Setup Script for Unified Memory
-- ============================================================================
-- This script creates all necessary tables and extensions for production deployment.
-- Run this in Supabase SQL Editor: Dashboard > SQL Editor > New Query

-- ============================================================================
-- Step 1: Enable Extensions
-- ============================================================================
CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================================================
-- Step 2: Create memories table
-- ============================================================================
CREATE TABLE IF NOT EXISTS memories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  embedding vector(1536) NOT NULL,
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  tags TEXT[] DEFAULT '{}',
  platform VARCHAR(50),
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Indexes
CREATE INDEX IF NOT EXISTS memories_embedding_idx
ON memories
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

CREATE INDEX IF NOT EXISTS memories_metadata_idx
ON memories
USING GIN (metadata);

CREATE INDEX IF NOT EXISTS memories_tags_idx
ON memories
USING GIN (tags);

CREATE INDEX IF NOT EXISTS memories_platform_idx
ON memories (platform);

CREATE INDEX IF NOT EXISTS memories_created_at_idx
ON memories (created_at DESC);

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_memories_updated_at
BEFORE UPDATE ON memories
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- Step 3: Create canonical_objects table (Main table for MOMO)
-- ============================================================================
CREATE TABLE IF NOT EXISTS canonical_objects (
  id VARCHAR(255) PRIMARY KEY,
  platform VARCHAR(20) NOT NULL,
  object_type VARCHAR(50) NOT NULL,
  title TEXT,
  body TEXT,
  attachments JSONB,
  actors JSONB NOT NULL,
  timestamps JSONB NOT NULL,
  relations JSONB,
  properties JSONB,
  summary JSONB,
  search_text TEXT,
  semantic_hash VARCHAR(64),
  visibility VARCHAR(20) NOT NULL DEFAULT 'team',
  deleted_at TIMESTAMPTZ,
  indexed_at TIMESTAMPTZ,
  raw JSONB
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_canonical_platform
ON canonical_objects(platform);

CREATE INDEX IF NOT EXISTS idx_canonical_created
ON canonical_objects((timestamps->>'created_at'));

CREATE INDEX IF NOT EXISTS idx_canonical_deleted
ON canonical_objects(deleted_at)
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_canonical_actors
ON canonical_objects
USING GIN(actors);

CREATE INDEX IF NOT EXISTS idx_canonical_properties
ON canonical_objects
USING GIN(properties);

CREATE INDEX IF NOT EXISTS idx_canonical_search
ON canonical_objects
USING GIN(to_tsvector('english', COALESCE(search_text, '')));

-- Triggers
CREATE OR REPLACE FUNCTION update_canonical_search_text()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_text := COALESCE(NEW.title, '') || ' ' || COALESCE(NEW.body, '');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_canonical_search_text
  BEFORE INSERT OR UPDATE OF title, body
  ON canonical_objects
  FOR EACH ROW
  EXECUTE FUNCTION update_canonical_search_text();

CREATE OR REPLACE FUNCTION update_canonical_indexed_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.indexed_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_canonical_indexed_at
  BEFORE INSERT OR UPDATE
  ON canonical_objects
  FOR EACH ROW
  EXECUTE FUNCTION update_canonical_indexed_at();

-- ============================================================================
-- Verification Query
-- ============================================================================
-- Run this to verify the setup was successful:
SELECT
  'Tables created:' as status,
  COUNT(*) as table_count
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('memories', 'canonical_objects');

SELECT
  'pgvector extension:' as status,
  extname as extension_name,
  extversion as version
FROM pg_extension
WHERE extname = 'vector';
