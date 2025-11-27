-- Benchmark Results Storage
-- Stores results from CLI benchmark runs for UI display

-- Each benchmark run
CREATE TABLE IF NOT EXISTS benchmark_runs (
  id SERIAL PRIMARY KEY,
  run_at TIMESTAMPTZ DEFAULT NOW(),
  overall_f1 FLOAT NOT NULL,
  overall_precision FLOAT NOT NULL,
  overall_recall FLOAT NOT NULL,
  total_queries INTEGER NOT NULL,
  passed_queries INTEGER NOT NULL,
  pipeline_stats JSONB,  -- {chunking: {...}, embedding: {...}, etc}
  duration_ms INTEGER,
  git_commit VARCHAR(40),
  notes TEXT
);

-- Individual query results within a benchmark run
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
  status VARCHAR(20) DEFAULT 'pass',  -- pass, warning, fail
  details JSONB,  -- {expected: [...], found: [...], missing: [...]}
  UNIQUE(run_id, query_id)
);

CREATE INDEX IF NOT EXISTS idx_benchmark_runs_run_at ON benchmark_runs(run_at DESC);
CREATE INDEX IF NOT EXISTS idx_benchmark_query_results_run_id ON benchmark_query_results(run_id);
