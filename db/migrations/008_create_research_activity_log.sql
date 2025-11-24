-- =============================================================================
-- Migration 008: Create research_activity_log table
-- =============================================================================
-- This table provides complete visibility into R&D operations for debugging
-- and understanding what happened during experiments and data operations.

-- =============================================================================
-- CREATE TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS research_activity_log (
  -- Identifiers
  id SERIAL PRIMARY KEY,

  -- Operation metadata
  operation_type VARCHAR(50) NOT NULL,  -- 'data_insert', 'data_delete', 'experiment_run', 'error', 'fix', 'script_execution', 'migration'
  operation_name VARCHAR(255) NOT NULL,  -- e.g., 'create-sample-data', 'run-experiment', 'DELETE canonical_objects'
  description TEXT,  -- Human-readable description

  -- Execution details
  status VARCHAR(20) NOT NULL DEFAULT 'started',  -- 'started', 'completed', 'failed'
  triggered_by VARCHAR(50) DEFAULT 'manual',  -- 'manual', 'script', 'api', 'migration'

  -- Structured data (JSONB for flexibility)
  details JSONB,
  /*
  Example structures:

  For data operations:
  {
    "action": "DELETE",
    "table": "canonical_objects",
    "rows_affected": 150,
    "before_count": 150,
    "after_count": 0,
    "query": "DELETE FROM canonical_objects"
  }

  For experiment runs:
  {
    "experiment_id": 5,
    "experiment_name": "2025-11-24-hybrid-search",
    "config": {...},
    "results": {
      "f1_score": 0.091,
      "precision": 0.071,
      "recall": 0.125
    },
    "chunks_created": 10,
    "embeddings_created": 10
  }

  For errors:
  {
    "error_message": "column 'type' does not exist",
    "error_stack": "...",
    "query": "SELECT from_id, to_id, type FROM ground_truth_relations",
    "line_number": 98
  }

  For fixes:
  {
    "error_id": 123,
    "fix_description": "Changed 'type' to 'relation_type as type'",
    "before": "SELECT ... type ...",
    "after": "SELECT ... relation_type as type ...",
    "files_modified": ["scripts/run-experiment.ts"]
  }
  */

  -- Context and traceability
  git_commit VARCHAR(40),  -- Git commit hash at time of operation
  parent_log_id INTEGER,  -- Reference to parent operation (for chained operations)
  experiment_id INTEGER,  -- Reference to experiment if applicable

  -- Performance
  duration_ms INTEGER,  -- How long the operation took
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,

  -- Constraints
  FOREIGN KEY (parent_log_id) REFERENCES research_activity_log(id) ON DELETE SET NULL,
  FOREIGN KEY (experiment_id) REFERENCES experiments(id) ON DELETE SET NULL
);

-- =============================================================================
-- CREATE INDEXES
-- =============================================================================

-- 1. Query by operation type
CREATE INDEX IF NOT EXISTS idx_activity_log_operation_type
ON research_activity_log(operation_type);

-- 2. Query by status
CREATE INDEX IF NOT EXISTS idx_activity_log_status
ON research_activity_log(status);

-- 3. Query by time (most common - recent activities)
CREATE INDEX IF NOT EXISTS idx_activity_log_started_at
ON research_activity_log(started_at DESC);

-- 4. Query by experiment
CREATE INDEX IF NOT EXISTS idx_activity_log_experiment_id
ON research_activity_log(experiment_id)
WHERE experiment_id IS NOT NULL;

-- 5. GIN index for details searches
CREATE INDEX IF NOT EXISTS idx_activity_log_details
ON research_activity_log USING GIN(details);

-- 6. Query by git commit (track what changed when)
CREATE INDEX IF NOT EXISTS idx_activity_log_git_commit
ON research_activity_log(git_commit)
WHERE git_commit IS NOT NULL;

-- =============================================================================
-- HELPER FUNCTIONS
-- =============================================================================

-- Function to automatically calculate duration when completed
CREATE OR REPLACE FUNCTION update_activity_log_duration()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status IN ('completed', 'failed') AND NEW.completed_at IS NULL THEN
    NEW.completed_at := NOW();
  END IF;

  IF NEW.completed_at IS NOT NULL AND NEW.started_at IS NOT NULL THEN
    NEW.duration_ms := EXTRACT(EPOCH FROM (NEW.completed_at - NEW.started_at)) * 1000;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-calculate duration
CREATE TRIGGER trigger_update_activity_log_duration
  BEFORE UPDATE OF status, completed_at
  ON research_activity_log
  FOR EACH ROW
  EXECUTE FUNCTION update_activity_log_duration();

-- =============================================================================
-- HELPER VIEWS
-- =============================================================================

-- View for recent activities (last 24 hours)
CREATE OR REPLACE VIEW recent_research_activities AS
SELECT
  id,
  operation_type,
  operation_name,
  description,
  status,
  duration_ms,
  started_at,
  git_commit,
  experiment_id
FROM research_activity_log
WHERE started_at >= NOW() - INTERVAL '24 hours'
ORDER BY started_at DESC;

-- View for failed operations
CREATE OR REPLACE VIEW failed_research_activities AS
SELECT
  id,
  operation_type,
  operation_name,
  description,
  details,
  started_at,
  git_commit
FROM research_activity_log
WHERE status = 'failed'
ORDER BY started_at DESC;

-- =============================================================================
-- COMMENTS
-- =============================================================================

COMMENT ON TABLE research_activity_log IS 'Complete audit log of all R&D operations for debugging and understanding the research process';
COMMENT ON COLUMN research_activity_log.operation_type IS 'Type of operation: data_insert, data_delete, experiment_run, error, fix, script_execution, migration';
COMMENT ON COLUMN research_activity_log.operation_name IS 'Name of the operation or script being executed';
COMMENT ON COLUMN research_activity_log.details IS 'Structured JSON data about the operation (counts, errors, results, etc.)';
COMMENT ON COLUMN research_activity_log.duration_ms IS 'Duration of operation in milliseconds (auto-calculated)';
COMMENT ON COLUMN research_activity_log.git_commit IS 'Git commit hash at the time of operation for traceability';
COMMENT ON COLUMN research_activity_log.parent_log_id IS 'ID of parent operation for chained operations (e.g., fix following an error)';

-- =============================================================================
-- ROLLBACK (DOWN MIGRATION)
-- =============================================================================
-- To rollback this migration, run the following commands:
/*
DROP VIEW IF EXISTS failed_research_activities;
DROP VIEW IF EXISTS recent_research_activities;
DROP TRIGGER IF EXISTS trigger_update_activity_log_duration ON research_activity_log;
DROP FUNCTION IF EXISTS update_activity_log_duration();
DROP INDEX IF EXISTS idx_activity_log_git_commit;
DROP INDEX IF EXISTS idx_activity_log_details;
DROP INDEX IF EXISTS idx_activity_log_experiment_id;
DROP INDEX IF EXISTS idx_activity_log_started_at;
DROP INDEX IF EXISTS idx_activity_log_status;
DROP INDEX IF EXISTS idx_activity_log_operation_type;
DROP TABLE IF EXISTS research_activity_log;
*/
