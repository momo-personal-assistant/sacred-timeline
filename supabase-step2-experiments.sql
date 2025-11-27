-- ============================================================================
-- Step 2: Experiments and Research Tracking
-- ============================================================================

-- Create experiment_status enum first
DO $$ BEGIN
  CREATE TYPE experiment_status AS ENUM ('draft', 'running', 'completed', 'failed');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Create experiments table
CREATE TABLE IF NOT EXISTS experiments (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  embedding_model VARCHAR(100),
  chunking_strategy VARCHAR(50),
  similarity_threshold FLOAT,
  keyword_overlap_threshold FLOAT,
  chunk_limit INTEGER,
  config JSONB,
  tags TEXT[],
  is_baseline BOOLEAN DEFAULT FALSE,
  baseline BOOLEAN DEFAULT FALSE,
  paper_ids TEXT[] DEFAULT '{}',
  git_commit VARCHAR(40),
  status experiment_status DEFAULT 'completed',
  config_file_path VARCHAR(500),
  run_started_at TIMESTAMP,
  run_completed_at TIMESTAMP,
  error_message TEXT,
  UNIQUE(name)
);

-- Indexes for experiments
CREATE INDEX IF NOT EXISTS idx_experiments_created_at ON experiments(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_experiments_tags ON experiments USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_experiments_is_baseline ON experiments(is_baseline) WHERE is_baseline = TRUE;
CREATE INDEX IF NOT EXISTS idx_experiments_baseline ON experiments(baseline) WHERE baseline = TRUE;
CREATE INDEX IF NOT EXISTS idx_experiments_paper_ids ON experiments USING GIN(paper_ids);
CREATE INDEX IF NOT EXISTS idx_experiments_git_commit ON experiments(git_commit);
CREATE INDEX IF NOT EXISTS idx_experiments_status ON experiments(status);
CREATE INDEX IF NOT EXISTS idx_experiments_draft ON experiments(status) WHERE status = 'draft';

-- Create experiment_results table
CREATE TABLE IF NOT EXISTS experiment_results (
  id SERIAL PRIMARY KEY,
  experiment_id INTEGER NOT NULL REFERENCES experiments(id) ON DELETE CASCADE,
  scenario VARCHAR(100) NOT NULL,
  precision FLOAT NOT NULL,
  recall FLOAT NOT NULL,
  f1_score FLOAT NOT NULL,
  true_positives INTEGER NOT NULL,
  false_positives INTEGER NOT NULL,
  false_negatives INTEGER NOT NULL,
  ground_truth_total INTEGER NOT NULL,
  inferred_total INTEGER NOT NULL,
  retrieval_time_ms INTEGER,
  matched_relations JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(experiment_id, scenario)
);

CREATE INDEX IF NOT EXISTS idx_experiment_results_experiment_id ON experiment_results(experiment_id);
CREATE INDEX IF NOT EXISTS idx_experiment_results_scenario ON experiment_results(scenario);
CREATE INDEX IF NOT EXISTS idx_experiment_results_f1_score ON experiment_results(f1_score DESC);

-- Create papers table
CREATE TABLE IF NOT EXISTS papers (
  id VARCHAR(10) PRIMARY KEY,
  filename VARCHAR(255) NOT NULL,
  title VARCHAR(255),
  authors VARCHAR(255),
  tags TEXT[],
  status VARCHAR(50) DEFAULT '📋 To Experiment',
  priority VARCHAR(20) DEFAULT 'medium',
  momo_relevance VARCHAR(20) DEFAULT 'medium',
  pdf_path TEXT NOT NULL,
  summary_path TEXT,
  analyzed_at TIMESTAMP,
  expected_f1_gain FLOAT,
  implementation_effort VARCHAR(20),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(filename)
);

CREATE INDEX IF NOT EXISTS idx_papers_status ON papers(status);
CREATE INDEX IF NOT EXISTS idx_papers_priority ON papers(priority DESC);
CREATE INDEX IF NOT EXISTS idx_papers_tags ON papers USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_papers_analyzed_at ON papers(analyzed_at DESC);

-- Create experiment_papers junction table
CREATE TABLE IF NOT EXISTS experiment_papers (
  experiment_id INTEGER REFERENCES experiments(id) ON DELETE CASCADE,
  paper_id VARCHAR(10) REFERENCES papers(id) ON DELETE CASCADE,
  contribution TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (experiment_id, paper_id)
);

CREATE INDEX IF NOT EXISTS idx_experiment_papers_experiment ON experiment_papers(experiment_id);
CREATE INDEX IF NOT EXISTS idx_experiment_papers_paper ON experiment_papers(paper_id);

-- Create ground_truth_queries table
CREATE TABLE IF NOT EXISTS ground_truth_queries (
  id SERIAL PRIMARY KEY,
  query_text TEXT NOT NULL,
  scenario VARCHAR(50) DEFAULT 'normal',
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ground_truth_queries_scenario ON ground_truth_queries(scenario);

-- Create ground_truth_query_results table
CREATE TABLE IF NOT EXISTS ground_truth_query_results (
  id SERIAL PRIMARY KEY,
  query_id INTEGER REFERENCES ground_truth_queries(id) ON DELETE CASCADE,
  canonical_object_id VARCHAR(255) NOT NULL,
  relevance_score INTEGER DEFAULT 1 CHECK (relevance_score BETWEEN 0 AND 3),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(query_id, canonical_object_id)
);

CREATE INDEX IF NOT EXISTS idx_ground_truth_query_results_query_id ON ground_truth_query_results(query_id);

-- Insert sample queries
INSERT INTO ground_truth_queries (query_text, scenario, description) VALUES
  ('API rate limit issues', 'normal', 'Find documents about API rate limiting problems'),
  ('documentation outdated', 'normal', 'Find documents about documentation being outdated'),
  ('onboarding process problems', 'normal', 'Find documents about onboarding difficulties'),
  ('webhook configuration help', 'normal', 'Find documents about webhook setup')
ON CONFLICT DO NOTHING;

-- Create layer_metrics table
CREATE TABLE IF NOT EXISTS layer_metrics (
  id SERIAL PRIMARY KEY,
  experiment_id INTEGER REFERENCES experiments(id) ON DELETE CASCADE,
  layer VARCHAR(20) NOT NULL CHECK (layer IN ('chunking', 'embedding', 'graph', 'retrieval', 'validation', 'temporal', 'consolidation')),
  evaluation_method VARCHAR(30) DEFAULT 'ground_truth' CHECK (evaluation_method IN ('ground_truth', 'llm_judge')),
  metrics JSONB NOT NULL,
  duration_ms INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(experiment_id, layer, evaluation_method)
);

CREATE INDEX IF NOT EXISTS idx_layer_metrics_experiment ON layer_metrics(experiment_id);
CREATE INDEX IF NOT EXISTS idx_layer_metrics_layer ON layer_metrics(layer);
CREATE INDEX IF NOT EXISTS idx_layer_metrics_method ON layer_metrics(evaluation_method);
CREATE INDEX IF NOT EXISTS idx_layer_metrics_data ON layer_metrics USING GIN(metrics);

-- Create benchmark_runs table
CREATE TABLE IF NOT EXISTS benchmark_runs (
  id SERIAL PRIMARY KEY,
  run_at TIMESTAMPTZ DEFAULT NOW(),
  overall_f1 FLOAT NOT NULL,
  overall_precision FLOAT NOT NULL,
  overall_recall FLOAT NOT NULL,
  total_queries INTEGER NOT NULL,
  passed_queries INTEGER NOT NULL,
  pipeline_stats JSONB,
  duration_ms INTEGER,
  git_commit VARCHAR(40),
  notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_benchmark_runs_run_at ON benchmark_runs(run_at DESC);

-- Create benchmark_query_results table
CREATE TABLE IF NOT EXISTS benchmark_query_results (
  id SERIAL PRIMARY KEY,
  run_id INTEGER REFERENCES benchmark_runs(id) ON DELETE CASCADE,
  query_id INTEGER REFERENCES ground_truth_queries(id) ON DELETE CASCADE,
  query_text TEXT NOT NULL,
  f1_score FLOAT NOT NULL,
  precision_score FLOAT NOT NULL,
  recall_score FLOAT NOT NULL,
  expected_count INTEGER NOT NULL,
  found_count INTEGER NOT NULL,
  retrieval_time_ms INTEGER,
  status VARCHAR(20) DEFAULT 'pass',
  details JSONB,
  UNIQUE(run_id, query_id)
);

CREATE INDEX IF NOT EXISTS idx_benchmark_query_results_run_id ON benchmark_query_results(run_id);

-- Insert baseline experiment
INSERT INTO experiments (
  name, description, embedding_model, chunking_strategy,
  similarity_threshold, keyword_overlap_threshold, chunk_limit,
  is_baseline, tags
) VALUES (
  'Week 2 Baseline',
  'Initial baseline with text-embedding-3-small and semantic chunking',
  'text-embedding-3-small', 'semantic',
  0.35, 0.65, 10, TRUE, ARRAY['baseline', 'week2']
) ON CONFLICT (name) DO NOTHING;
