-- Migration 010: Layer Metrics for Component-wise Evaluation
-- Purpose: Store per-layer metrics for pipeline experiments
-- Enables: Data-driven debugging by identifying bottleneck layers

-- Layer metrics storage
CREATE TABLE IF NOT EXISTS layer_metrics (
  id SERIAL PRIMARY KEY,
  experiment_id INTEGER REFERENCES experiments(id) ON DELETE CASCADE,
  layer VARCHAR(20) NOT NULL CHECK (layer IN ('chunking', 'embedding', 'graph', 'retrieval', 'validation')),
  evaluation_method VARCHAR(30) DEFAULT 'ground_truth' CHECK (evaluation_method IN ('ground_truth', 'llm_judge')),
  metrics JSONB NOT NULL,
  duration_ms INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Each layer can have one metric per evaluation method per experiment
  UNIQUE(experiment_id, layer, evaluation_method)
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_layer_metrics_experiment ON layer_metrics(experiment_id);
CREATE INDEX IF NOT EXISTS idx_layer_metrics_layer ON layer_metrics(layer);
CREATE INDEX IF NOT EXISTS idx_layer_metrics_method ON layer_metrics(evaluation_method);

-- GIN index for JSONB queries (e.g., filtering by specific metric values)
CREATE INDEX IF NOT EXISTS idx_layer_metrics_data ON layer_metrics USING GIN(metrics);

-- Comments for documentation
COMMENT ON TABLE layer_metrics IS 'Per-layer metrics for pipeline experiments, enabling component-wise debugging';
COMMENT ON COLUMN layer_metrics.layer IS 'Pipeline layer: chunking, embedding, graph, retrieval, validation';
COMMENT ON COLUMN layer_metrics.evaluation_method IS 'How metrics were computed: ground_truth (vs labels) or llm_judge (LLM scoring)';
COMMENT ON COLUMN layer_metrics.metrics IS 'Layer-specific metrics as JSON (schema varies by layer)';
COMMENT ON COLUMN layer_metrics.duration_ms IS 'Time taken to compute this layer in milliseconds';
