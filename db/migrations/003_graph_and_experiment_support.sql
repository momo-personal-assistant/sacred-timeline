-- =============================================================================
-- Migration 003: Graph and Experiment Support
-- =============================================================================
-- This migration adds support for:
-- 1. Schema versioning (for canonical_objects)
-- 2. Sync state tracking (for incremental ingestion)
-- 3. Chunks table (for RAG chunking strategies)
-- 4. Ground truth relations (for validation against synthetic datasets)
-- 5. Experiment runs (for tracking chunking/embedding/retrieval experiments)

-- =============================================================================
-- 1. ADD SCHEMA VERSION TO CANONICAL OBJECTS
-- =============================================================================

ALTER TABLE canonical_objects
ADD COLUMN IF NOT EXISTS schema_version VARCHAR(10) DEFAULT 'v1.0' NOT NULL;

CREATE INDEX IF NOT EXISTS idx_canonical_schema_version
ON canonical_objects(schema_version);

COMMENT ON COLUMN canonical_objects.schema_version IS 'Schema version for migration tracking (v1.0, v1.1, etc.)';

-- =============================================================================
-- 2. CREATE SYNC_STATE TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS sync_state (
  platform VARCHAR(50) PRIMARY KEY,
  last_sync_time TIMESTAMPTZ NOT NULL,
  last_sync_cursor VARCHAR(500),  -- For cursor-based pagination
  method VARCHAR(20),  -- 'full' | 'incremental' | 'webhook'
  records_synced INTEGER DEFAULT 0,
  errors INTEGER DEFAULT 0,
  status VARCHAR(20) DEFAULT 'idle',  -- 'idle' | 'running' | 'failed'
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sync_state_updated ON sync_state(updated_at);

-- Trigger to auto-update updated_at
CREATE OR REPLACE FUNCTION update_sync_state_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_sync_state_updated
  BEFORE UPDATE ON sync_state
  FOR EACH ROW
  EXECUTE FUNCTION update_sync_state_updated_at();

COMMENT ON TABLE sync_state IS 'Tracks incremental sync state for each platform';
COMMENT ON COLUMN sync_state.last_sync_cursor IS 'Pagination cursor for resuming sync';
COMMENT ON COLUMN sync_state.method IS 'Sync method: full, incremental, or webhook';

-- =============================================================================
-- 3. CREATE CHUNKS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS chunks (
  id VARCHAR(500) PRIMARY KEY,  -- Format: "platform|workspace|type|id:chunk:N"
  canonical_object_id VARCHAR(255) NOT NULL REFERENCES canonical_objects(id) ON DELETE CASCADE,
  chunk_index INTEGER NOT NULL,
  content TEXT NOT NULL,
  method VARCHAR(50) NOT NULL,  -- 'semantic' | 'fixed-size' | 'relational'

  -- Metadata
  metadata JSONB,
  /*
  Example structure:
  {
    "chunk_type": "main|comment|code",
    "char_start": 0,
    "char_end": 500,
    "platform": "github",
    "object_type": "issue",
    "author": "user:alice",
    "created_at": "2025-11-23T10:00:00Z"
  }
  */

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(canonical_object_id, method, chunk_index)
);

CREATE INDEX IF NOT EXISTS idx_chunks_canonical ON chunks(canonical_object_id);
CREATE INDEX IF NOT EXISTS idx_chunks_method ON chunks(method);
CREATE INDEX IF NOT EXISTS idx_chunks_metadata ON chunks USING GIN(metadata);

COMMENT ON TABLE chunks IS 'Chunked text from canonical objects for RAG retrieval';
COMMENT ON COLUMN chunks.method IS 'Chunking strategy used: semantic, fixed-size, or relational';
COMMENT ON COLUMN chunks.chunk_index IS 'Sequential index within the parent object';

-- =============================================================================
-- 4. CREATE GROUND_TRUTH_RELATIONS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS ground_truth_relations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_id VARCHAR(255) NOT NULL,
  to_id VARCHAR(255) NOT NULL,
  relation_type VARCHAR(50) NOT NULL,
  /*
  Relation types:
  - triggered_by: Slack thread triggered by Zendesk ticket
  - resulted_in: Slack thread resulted in Linear issue
  - belongs_to: Ticket/Issue belongs to Company
  - assigned_to: Issue assigned to User
  - created_by: Object created by User
  - decided_by: Decision made by User
  - participated_in: User participated in Slack thread
  - similar_to: Objects are similar (keyword overlap)
  - duplicate_of: Potential duplicate
  - related_to: Generic relation
  */

  source VARCHAR(20) NOT NULL,  -- 'explicit' | 'inferred' | 'computed'
  confidence FLOAT DEFAULT 1.0,  -- 0-1 confidence score for inferred relations

  metadata JSONB,
  /*
  Example structure:
  {
    "keywords": ["authentication", "timeout"],
    "similarity_score": 0.92,
    "inferred_by": "embedding-similarity",
    "created_at": "2025-11-23T10:00:00Z"
  }
  */

  scenario VARCHAR(50),  -- 'normal' | 'sales_heavy' | 'dev_heavy' | 'pattern' | 'stress'

  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(from_id, to_id, relation_type, scenario)
);

CREATE INDEX IF NOT EXISTS idx_gt_from ON ground_truth_relations(from_id);
CREATE INDEX IF NOT EXISTS idx_gt_to ON ground_truth_relations(to_id);
CREATE INDEX IF NOT EXISTS idx_gt_type ON ground_truth_relations(relation_type);
CREATE INDEX IF NOT EXISTS idx_gt_scenario ON ground_truth_relations(scenario);
CREATE INDEX IF NOT EXISTS idx_gt_source ON ground_truth_relations(source);

COMMENT ON TABLE ground_truth_relations IS 'Ground truth relations from synthetic datasets for validation';
COMMENT ON COLUMN ground_truth_relations.from_id IS 'Source object ID (format: platform|workspace|type|id)';
COMMENT ON COLUMN ground_truth_relations.to_id IS 'Target object ID (format: platform|workspace|type|id)';
COMMENT ON COLUMN ground_truth_relations.source IS 'How relation was created: explicit (in data), inferred (by algorithm), computed (similarity)';
COMMENT ON COLUMN ground_truth_relations.confidence IS 'Confidence score for inferred relations (0-1)';
COMMENT ON COLUMN ground_truth_relations.scenario IS 'Which synthetic scenario this relation belongs to';

-- =============================================================================
-- 5. CREATE EXPERIMENT_RUNS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS experiment_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  scenario VARCHAR(50) NOT NULL,  -- 'normal' | 'sales_heavy' | 'dev_heavy' | 'pattern' | 'stress'

  config JSONB NOT NULL,
  /*
  Example structure:
  {
    "chunking": {
      "strategy": "semantic",
      "params": { "preserveMetadata": true }
    },
    "embedding": {
      "model": "voyage-3",
      "params": {}
    },
    "retrieval": {
      "method": "hybrid",
      "params": { "alpha": 0.7 }
    }
  }
  */

  results JSONB NOT NULL,
  /*
  Example structure:
  {
    "chunking": {
      "total_chunks": 547,
      "avg_chunk_size": 487,
      "std_chunk_size": 123
    },
    "embedding": {
      "total_embeddings": 547,
      "embedding_time_ms": 12340,
      "cost_usd": 0.0328
    },
    "retrieval": {
      "precision_at_10": 0.85,
      "recall_at_10": 0.72,
      "ndcg_at_10": 0.89,
      "mrr": 0.91
    },
    "relations": {
      "precision": 0.87,
      "recall": 0.79,
      "f1_score": 0.83,
      "false_positives": 23,
      "false_negatives": 31
    },
    "latency": {
      "p50_ms": 45,
      "p95_ms": 120,
      "p99_ms": 230
    }
  }
  */

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_exp_name ON experiment_runs(name);
CREATE INDEX IF NOT EXISTS idx_exp_scenario ON experiment_runs(scenario);
CREATE INDEX IF NOT EXISTS idx_exp_created ON experiment_runs(created_at);

COMMENT ON TABLE experiment_runs IS 'Tracks experiment runs for chunking/embedding/retrieval optimization';
COMMENT ON COLUMN experiment_runs.name IS 'Descriptive name of the experiment';
COMMENT ON COLUMN experiment_runs.scenario IS 'Which synthetic scenario was used for testing';
COMMENT ON COLUMN experiment_runs.config IS 'Full configuration of chunking, embedding, and retrieval strategies';
COMMENT ON COLUMN experiment_runs.results IS 'Comprehensive metrics from the experiment run';

-- =============================================================================
-- ROLLBACK (DOWN MIGRATION)
-- =============================================================================
-- To rollback this migration, run the following commands:
/*
DROP TABLE IF EXISTS experiment_runs;
DROP TABLE IF EXISTS ground_truth_relations;
DROP TABLE IF EXISTS chunks;
DROP TRIGGER IF EXISTS trigger_sync_state_updated ON sync_state;
DROP FUNCTION IF EXISTS update_sync_state_updated_at();
DROP TABLE IF EXISTS sync_state;
DROP INDEX IF EXISTS idx_canonical_schema_version;
ALTER TABLE canonical_objects DROP COLUMN IF EXISTS schema_version;
*/
