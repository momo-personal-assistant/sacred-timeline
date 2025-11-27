SET search_path = public;

-- ============================================================================
-- Step 1: Core Tables (memories, canonical_objects, chunks)
-- ============================================================================

-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Create memories table with vector storage
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

-- Indexes for memories
CREATE INDEX IF NOT EXISTS memories_embedding_idx ON memories USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
CREATE INDEX IF NOT EXISTS memories_metadata_idx ON memories USING GIN (metadata);
CREATE INDEX IF NOT EXISTS memories_tags_idx ON memories USING GIN (tags);
CREATE INDEX IF NOT EXISTS memories_platform_idx ON memories (platform);
CREATE INDEX IF NOT EXISTS memories_created_at_idx ON memories (created_at DESC);

-- Trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_memories_updated_at BEFORE UPDATE ON memories FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create canonical_objects table
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
  raw JSONB,
  schema_version VARCHAR(10) DEFAULT 'v1.0' NOT NULL
);

-- Indexes for canonical_objects
CREATE INDEX IF NOT EXISTS idx_canonical_platform ON canonical_objects(platform);
CREATE INDEX IF NOT EXISTS idx_canonical_created ON canonical_objects((timestamps->>'created_at'));
CREATE INDEX IF NOT EXISTS idx_canonical_deleted ON canonical_objects(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_canonical_actors ON canonical_objects USING GIN(actors);
CREATE INDEX IF NOT EXISTS idx_canonical_properties ON canonical_objects USING GIN(properties);
CREATE INDEX IF NOT EXISTS idx_canonical_search ON canonical_objects USING GIN(to_tsvector('english', COALESCE(search_text, '')));
CREATE INDEX IF NOT EXISTS idx_canonical_schema_version ON canonical_objects(schema_version);

-- Trigger functions for canonical_objects
CREATE OR REPLACE FUNCTION update_canonical_search_text()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_text := COALESCE(NEW.title, '') || ' ' || COALESCE(NEW.body, '');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_canonical_search_text BEFORE INSERT OR UPDATE OF title, body ON canonical_objects FOR EACH ROW EXECUTE FUNCTION update_canonical_search_text();

CREATE OR REPLACE FUNCTION update_canonical_indexed_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.indexed_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_canonical_indexed_at BEFORE INSERT OR UPDATE ON canonical_objects FOR EACH ROW EXECUTE FUNCTION update_canonical_indexed_at();

-- Create sync_state table
CREATE TABLE IF NOT EXISTS sync_state (
  platform VARCHAR(50) PRIMARY KEY,
  last_sync_time TIMESTAMPTZ NOT NULL,
  last_sync_cursor VARCHAR(500),
  method VARCHAR(20),
  records_synced INTEGER DEFAULT 0,
  errors INTEGER DEFAULT 0,
  status VARCHAR(20) DEFAULT 'idle',
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sync_state_updated ON sync_state(updated_at);

CREATE OR REPLACE FUNCTION update_sync_state_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_sync_state_updated BEFORE UPDATE ON sync_state FOR EACH ROW EXECUTE FUNCTION update_sync_state_updated_at();

-- Create chunks table
CREATE TABLE IF NOT EXISTS chunks (
  id VARCHAR(500) PRIMARY KEY,
  canonical_object_id VARCHAR(255) NOT NULL REFERENCES canonical_objects(id) ON DELETE CASCADE,
  chunk_index INTEGER NOT NULL,
  content TEXT NOT NULL,
  method VARCHAR(50) NOT NULL,
  metadata JSONB,
  embedding vector(1536),
  embedding_model VARCHAR(100),
  embedding_tokens INTEGER,
  embedded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(canonical_object_id, method, chunk_index)
);

-- Indexes for chunks
CREATE INDEX IF NOT EXISTS idx_chunks_canonical ON chunks(canonical_object_id);
CREATE INDEX IF NOT EXISTS idx_chunks_method ON chunks(method);
CREATE INDEX IF NOT EXISTS idx_chunks_metadata ON chunks USING GIN(metadata);
CREATE INDEX IF NOT EXISTS idx_chunks_embedding ON chunks USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64);
CREATE INDEX IF NOT EXISTS idx_chunks_embedded_at ON chunks(embedded_at);
CREATE INDEX IF NOT EXISTS idx_chunks_embedding_model ON chunks(embedding_model);

-- Create ground_truth_relations table
CREATE TABLE IF NOT EXISTS ground_truth_relations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_id VARCHAR(255) NOT NULL,
  to_id VARCHAR(255) NOT NULL,
  relation_type VARCHAR(50) NOT NULL,
  source VARCHAR(20) NOT NULL,
  confidence FLOAT DEFAULT 1.0,
  metadata JSONB,
  scenario VARCHAR(50),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(from_id, to_id, relation_type, scenario)
);

CREATE INDEX IF NOT EXISTS idx_gt_from ON ground_truth_relations(from_id);
CREATE INDEX IF NOT EXISTS idx_gt_to ON ground_truth_relations(to_id);
CREATE INDEX IF NOT EXISTS idx_gt_type ON ground_truth_relations(relation_type);
CREATE INDEX IF NOT EXISTS idx_gt_scenario ON ground_truth_relations(scenario);
CREATE INDEX IF NOT EXISTS idx_gt_source ON ground_truth_relations(source);
