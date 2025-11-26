-- Migration 009: Add Experiment Status
-- Purpose: Enable draft experiments that can be reviewed before execution

-- =============================================================================
-- Add status column to experiments table
-- =============================================================================

-- Add status enum type
DO $$ BEGIN
  CREATE TYPE experiment_status AS ENUM ('draft', 'running', 'completed', 'failed');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Add status column with default 'completed' for existing experiments
ALTER TABLE experiments
ADD COLUMN IF NOT EXISTS status experiment_status DEFAULT 'completed';

-- Add config_file_path for tracking source YAML file
ALTER TABLE experiments
ADD COLUMN IF NOT EXISTS config_file_path VARCHAR(500);

-- Add run_started_at and run_completed_at for tracking execution
ALTER TABLE experiments
ADD COLUMN IF NOT EXISTS run_started_at TIMESTAMP;

ALTER TABLE experiments
ADD COLUMN IF NOT EXISTS run_completed_at TIMESTAMP;

-- Add error_message for failed experiments
ALTER TABLE experiments
ADD COLUMN IF NOT EXISTS error_message TEXT;

-- Index for filtering by status
CREATE INDEX IF NOT EXISTS idx_experiments_status ON experiments(status);

-- Index for draft experiments (common filter)
CREATE INDEX IF NOT EXISTS idx_experiments_draft ON experiments(status) WHERE status = 'draft';

-- =============================================================================
-- Comments
-- =============================================================================

COMMENT ON COLUMN experiments.status IS 'Experiment status: draft (not run yet), running, completed, failed';
COMMENT ON COLUMN experiments.config_file_path IS 'Path to source YAML config file';
COMMENT ON COLUMN experiments.run_started_at IS 'When the experiment started running';
COMMENT ON COLUMN experiments.run_completed_at IS 'When the experiment finished (success or failure)';
COMMENT ON COLUMN experiments.error_message IS 'Error message if experiment failed';
