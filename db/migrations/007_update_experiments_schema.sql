-- Migration 007: Update Experiments Schema for YAML-based Configuration System
-- Purpose: Add support for paper tracking, git commits, and simplified config structure

-- Add new columns to experiments table
ALTER TABLE experiments
  ADD COLUMN IF NOT EXISTS baseline BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS paper_ids TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS git_commit VARCHAR(40);

-- Migrate data from is_baseline to baseline
UPDATE experiments SET baseline = is_baseline WHERE is_baseline IS NOT NULL;

-- Create index for new columns
CREATE INDEX IF NOT EXISTS idx_experiments_baseline ON experiments(baseline) WHERE baseline = TRUE;
CREATE INDEX IF NOT EXISTS idx_experiments_paper_ids ON experiments USING GIN(paper_ids);
CREATE INDEX IF NOT EXISTS idx_experiments_git_commit ON experiments(git_commit);

COMMENT ON COLUMN experiments.baseline IS 'Whether this experiment is the current baseline configuration';
COMMENT ON COLUMN experiments.paper_ids IS 'Array of paper IDs that inspired this experiment';
COMMENT ON COLUMN experiments.git_commit IS 'Git commit hash when experiment was run';
