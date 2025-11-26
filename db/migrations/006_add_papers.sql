-- Migration 006: Add Papers Table
-- Purpose: Track research papers for RAG system optimization

-- =============================================================================
-- Papers Table
-- =============================================================================

CREATE TABLE IF NOT EXISTS papers (
  id VARCHAR(10) PRIMARY KEY,           -- '001', '002', '003', ...
  filename VARCHAR(255) NOT NULL,       -- Original PDF filename
  title VARCHAR(255),                   -- Extracted title
  authors VARCHAR(255),                 -- Extracted authors

  -- Categorization
  tags TEXT[],                          -- ['chunking', 'embeddings', 'hybrid-search', ...]
  status VARCHAR(50) DEFAULT '📋 To Experiment',  -- 📋 To Experiment | 🧪 Testing | ✅ Validated | ❌ Rejected
  priority VARCHAR(20) DEFAULT 'medium',          -- high | medium | low
  momo_relevance VARCHAR(20) DEFAULT 'medium',    -- high | medium | low (relevance to Momo project)

  -- Paths
  pdf_path TEXT NOT NULL,               -- docs/research/papers/sources/filename (any text format)
  summary_path TEXT,                    -- docs/research/papers/summaries/001-filename.md

  -- Analysis
  analyzed_at TIMESTAMP,                -- When Claude analyzed this paper
  expected_f1_gain FLOAT,               -- Expected F1 improvement (e.g., 5.0 = +5%)
  implementation_effort VARCHAR(20),    -- low | medium | high

  -- Metadata
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(filename)
);

-- Indexes
CREATE INDEX idx_papers_status ON papers(status);
CREATE INDEX idx_papers_priority ON papers(priority DESC);
CREATE INDEX idx_papers_tags ON papers USING GIN(tags);
CREATE INDEX idx_papers_analyzed_at ON papers(analyzed_at DESC);

-- =============================================================================
-- Link Experiments to Papers
-- =============================================================================

-- Add paper_ids to experiments table
ALTER TABLE experiments
ADD COLUMN IF NOT EXISTS paper_ids TEXT[];

-- Create junction table for detailed paper-experiment relationships
CREATE TABLE IF NOT EXISTS experiment_papers (
  experiment_id INTEGER REFERENCES experiments(id) ON DELETE CASCADE,
  paper_id VARCHAR(10) REFERENCES papers(id) ON DELETE CASCADE,
  contribution TEXT,  -- What this paper contributed to the experiment
  created_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (experiment_id, paper_id)
);

-- Index for lookups
CREATE INDEX idx_experiment_papers_experiment ON experiment_papers(experiment_id);
CREATE INDEX idx_experiment_papers_paper ON experiment_papers(paper_id);

-- =============================================================================
-- Helper Functions
-- =============================================================================

-- Get next available paper ID
CREATE OR REPLACE FUNCTION get_next_paper_id()
RETURNS VARCHAR(10) AS $$
DECLARE
  max_id VARCHAR(10);
  next_num INTEGER;
BEGIN
  SELECT id INTO max_id
  FROM papers
  ORDER BY id DESC
  LIMIT 1;

  IF max_id IS NULL THEN
    RETURN '001';
  END IF;

  next_num := CAST(max_id AS INTEGER) + 1;
  RETURN LPAD(next_num::TEXT, 3, '0');
END;
$$ LANGUAGE plpgsql;

-- Get papers by status
CREATE OR REPLACE FUNCTION get_papers_by_status(status_filter VARCHAR DEFAULT NULL)
RETURNS TABLE (
  id VARCHAR(10),
  title VARCHAR(255),
  priority VARCHAR(20),
  expected_f1_gain FLOAT,
  experiment_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id,
    p.title,
    p.priority,
    p.expected_f1_gain,
    COUNT(ep.experiment_id) as exp_count
  FROM papers p
  LEFT JOIN experiment_papers ep ON p.id = ep.paper_id
  WHERE status_filter IS NULL OR p.status = status_filter
  GROUP BY p.id, p.title, p.priority, p.expected_f1_gain
  ORDER BY
    CASE p.priority
      WHEN 'high' THEN 1
      WHEN 'medium' THEN 2
      WHEN 'low' THEN 3
    END,
    p.expected_f1_gain DESC NULLS LAST;
END;
$$ LANGUAGE plpgsql;

-- Get best experiment for a paper
CREATE OR REPLACE FUNCTION get_best_experiment_for_paper(paper_id_filter VARCHAR)
RETURNS TABLE (
  experiment_id INTEGER,
  experiment_name VARCHAR(255),
  avg_f1_score FLOAT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    e.id,
    e.name,
    AVG(er.f1_score) as avg_f1
  FROM experiments e
  JOIN experiment_results er ON e.id = er.experiment_id
  JOIN experiment_papers ep ON e.id = ep.experiment_id
  WHERE ep.paper_id = paper_id_filter
  GROUP BY e.id, e.name
  ORDER BY avg_f1 DESC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- Update paper status based on experiments
CREATE OR REPLACE FUNCTION update_paper_status_from_experiments()
RETURNS TRIGGER AS $$
DECLARE
  paper_id_val VARCHAR(10);
  avg_f1 FLOAT;
BEGIN
  -- For each paper_id in the new experiment
  FOREACH paper_id_val IN ARRAY NEW.paper_ids
  LOOP
    -- Get average F1 for this paper's experiments
    SELECT AVG(er.f1_score) INTO avg_f1
    FROM experiment_results er
    WHERE er.experiment_id = NEW.id;

    -- Update paper status based on results
    IF avg_f1 >= 0.70 THEN
      UPDATE papers
      SET status = '✅ Validated',
          updated_at = NOW()
      WHERE id = paper_id_val AND status != '✅ Validated';
    ELSIF avg_f1 IS NOT NULL THEN
      UPDATE papers
      SET status = '🧪 Testing',
          updated_at = NOW()
      WHERE id = paper_id_val AND status = '📋 To Experiment';
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update paper status when experiments are created
CREATE TRIGGER trigger_update_paper_status
AFTER INSERT ON experiments
FOR EACH ROW
WHEN (NEW.paper_ids IS NOT NULL)
EXECUTE FUNCTION update_paper_status_from_experiments();

-- =============================================================================
-- Comments
-- =============================================================================

COMMENT ON TABLE papers IS 'Research papers for RAG system optimization';
COMMENT ON COLUMN papers.id IS 'Sequential ID: 001, 002, 003, ...';
COMMENT ON COLUMN papers.status IS 'Workflow status: 📋 To Experiment | 🧪 Testing | ✅ Validated | ❌ Rejected';
COMMENT ON COLUMN papers.momo_relevance IS 'How relevant is this paper to Momo project';
COMMENT ON COLUMN papers.expected_f1_gain IS 'Expected F1 score improvement in percentage points';
COMMENT ON FUNCTION get_next_paper_id() IS 'Returns the next sequential paper ID';
COMMENT ON FUNCTION get_papers_by_status(VARCHAR) IS 'Get papers filtered by status, ordered by priority';
