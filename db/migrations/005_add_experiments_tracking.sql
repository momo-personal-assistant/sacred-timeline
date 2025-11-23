-- Migration 005: Add Experiments Tracking
-- Purpose: Track all experiments for comparing embedding models, chunking strategies, etc.

-- =============================================================================
-- Experiments Table
-- =============================================================================

CREATE TABLE IF NOT EXISTS experiments (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),

  -- Configuration
  embedding_model VARCHAR(100),
  chunking_strategy VARCHAR(50),
  similarity_threshold FLOAT,
  keyword_overlap_threshold FLOAT,
  chunk_limit INTEGER,

  -- Custom configuration (for flexibility)
  config JSONB,

  -- Metadata
  tags TEXT[],
  is_baseline BOOLEAN DEFAULT FALSE,

  UNIQUE(name)
);

-- Index for faster queries
CREATE INDEX idx_experiments_created_at ON experiments(created_at DESC);
CREATE INDEX idx_experiments_tags ON experiments USING GIN(tags);
CREATE INDEX idx_experiments_is_baseline ON experiments(is_baseline) WHERE is_baseline = TRUE;

-- =============================================================================
-- Experiment Results Table
-- =============================================================================

CREATE TABLE IF NOT EXISTS experiment_results (
  id SERIAL PRIMARY KEY,
  experiment_id INTEGER NOT NULL REFERENCES experiments(id) ON DELETE CASCADE,
  scenario VARCHAR(100) NOT NULL,

  -- Metrics
  precision FLOAT NOT NULL,
  recall FLOAT NOT NULL,
  f1_score FLOAT NOT NULL,

  -- Breakdown
  true_positives INTEGER NOT NULL,
  false_positives INTEGER NOT NULL,
  false_negatives INTEGER NOT NULL,
  ground_truth_total INTEGER NOT NULL,
  inferred_total INTEGER NOT NULL,

  -- Performance
  retrieval_time_ms INTEGER,

  -- Detailed results (optional)
  matched_relations JSONB,

  created_at TIMESTAMP NOT NULL DEFAULT NOW(),

  UNIQUE(experiment_id, scenario)
);

-- Index for faster queries
CREATE INDEX idx_experiment_results_experiment_id ON experiment_results(experiment_id);
CREATE INDEX idx_experiment_results_scenario ON experiment_results(scenario);
CREATE INDEX idx_experiment_results_f1_score ON experiment_results(f1_score DESC);

-- =============================================================================
-- Query Logs Table
-- =============================================================================

CREATE TABLE IF NOT EXISTS query_logs (
  id SERIAL PRIMARY KEY,
  experiment_id INTEGER REFERENCES experiments(id) ON DELETE SET NULL,

  -- Query
  query_text TEXT NOT NULL,

  -- Results
  total_chunks INTEGER NOT NULL,
  total_objects INTEGER NOT NULL,
  total_relations INTEGER NOT NULL,
  retrieval_time_ms INTEGER NOT NULL,

  -- Top similarity score
  max_similarity FLOAT,
  avg_similarity FLOAT,

  -- Full results (optional, for analysis)
  results JSONB,

  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Index for faster queries
CREATE INDEX idx_query_logs_created_at ON query_logs(created_at DESC);
CREATE INDEX idx_query_logs_experiment_id ON query_logs(experiment_id);
CREATE INDEX idx_query_logs_query_text ON query_logs USING GIN(to_tsvector('english', query_text));

-- =============================================================================
-- Helper Functions
-- =============================================================================

-- Get best experiment by F1 score
CREATE OR REPLACE FUNCTION get_best_experiment(scenario_filter VARCHAR DEFAULT NULL)
RETURNS TABLE (
  experiment_id INTEGER,
  experiment_name VARCHAR(255),
  avg_f1_score FLOAT,
  config JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    e.id,
    e.name,
    AVG(er.f1_score) as avg_f1,
    e.config
  FROM experiments e
  JOIN experiment_results er ON e.id = er.experiment_id
  WHERE scenario_filter IS NULL OR er.scenario = scenario_filter
  GROUP BY e.id, e.name, e.config
  ORDER BY avg_f1 DESC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- Compare two experiments
CREATE OR REPLACE FUNCTION compare_experiments(exp1_id INTEGER, exp2_id INTEGER)
RETURNS TABLE (
  scenario VARCHAR(100),
  exp1_f1 FLOAT,
  exp2_f1 FLOAT,
  improvement FLOAT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE(er1.scenario, er2.scenario) as scenario,
    er1.f1_score as exp1_f1,
    er2.f1_score as exp2_f1,
    CASE
      WHEN er1.f1_score IS NOT NULL AND er1.f1_score > 0
      THEN ((er2.f1_score - er1.f1_score) / er1.f1_score * 100)
      ELSE NULL
    END as improvement
  FROM experiment_results er1
  FULL OUTER JOIN experiment_results er2
    ON er1.scenario = er2.scenario
    AND er2.experiment_id = exp2_id
  WHERE er1.experiment_id = exp1_id OR er2.experiment_id = exp2_id
  ORDER BY scenario;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- Sample Data (Baseline)
-- =============================================================================

-- Insert baseline experiment (from Week 2)
INSERT INTO experiments (
  name,
  description,
  embedding_model,
  chunking_strategy,
  similarity_threshold,
  keyword_overlap_threshold,
  chunk_limit,
  is_baseline,
  tags
) VALUES (
  'Week 2 Baseline',
  'Initial baseline with text-embedding-3-small and semantic chunking',
  'text-embedding-3-small',
  'semantic',
  0.35,
  0.65,
  10,
  TRUE,
  ARRAY['baseline', 'week2']
)
ON CONFLICT (name) DO NOTHING;

COMMENT ON TABLE experiments IS 'Tracks different experimental configurations for embeddings and retrieval';
COMMENT ON TABLE experiment_results IS 'Stores validation metrics for each experiment and scenario';
COMMENT ON TABLE query_logs IS 'Logs all queries for analysis and debugging';
