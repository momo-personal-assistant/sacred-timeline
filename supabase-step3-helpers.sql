-- ============================================================================
-- Step 3: Activity Logging and Helper Functions
-- ============================================================================

-- Create research_activity_log table
CREATE TABLE IF NOT EXISTS research_activity_log (
  id SERIAL PRIMARY KEY,
  operation_type VARCHAR(50) NOT NULL,
  operation_name VARCHAR(255) NOT NULL,
  description TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'started',
  triggered_by VARCHAR(50) DEFAULT 'manual',
  details JSONB,
  git_commit VARCHAR(40),
  parent_log_id INTEGER,
  experiment_id INTEGER,
  duration_ms INTEGER,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  FOREIGN KEY (parent_log_id) REFERENCES research_activity_log(id) ON DELETE SET NULL,
  FOREIGN KEY (experiment_id) REFERENCES experiments(id) ON DELETE SET NULL
);

-- Indexes for research_activity_log
CREATE INDEX IF NOT EXISTS idx_activity_log_operation_type ON research_activity_log(operation_type);
CREATE INDEX IF NOT EXISTS idx_activity_log_status ON research_activity_log(status);
CREATE INDEX IF NOT EXISTS idx_activity_log_started_at ON research_activity_log(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_log_experiment_id ON research_activity_log(experiment_id) WHERE experiment_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_activity_log_details ON research_activity_log USING GIN(details);
CREATE INDEX IF NOT EXISTS idx_activity_log_git_commit ON research_activity_log(git_commit) WHERE git_commit IS NOT NULL;

-- Trigger function for activity log duration
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

CREATE TRIGGER trigger_update_activity_log_duration BEFORE UPDATE OF status, completed_at ON research_activity_log FOR EACH ROW EXECUTE FUNCTION update_activity_log_duration();

-- Create views
CREATE OR REPLACE VIEW recent_research_activities AS
SELECT id, operation_type, operation_name, description, status, duration_ms, started_at, git_commit, experiment_id
FROM research_activity_log
WHERE started_at >= NOW() - INTERVAL '24 hours'
ORDER BY started_at DESC;

CREATE OR REPLACE VIEW failed_research_activities AS
SELECT id, operation_type, operation_name, description, details, started_at, git_commit
FROM research_activity_log
WHERE status = 'failed'
ORDER BY started_at DESC;

-- Helper function: search memories
CREATE OR REPLACE FUNCTION search_memories(
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.7,
  match_count int DEFAULT 10,
  filter_platform varchar DEFAULT NULL,
  filter_tags text[] DEFAULT NULL
)
RETURNS TABLE (
  id uuid, content text, metadata jsonb, tags text[],
  platform varchar, similarity float, created_at timestamptz
) AS $$
BEGIN
  RETURN QUERY
  SELECT m.id, m.content, m.metadata, m.tags, m.platform,
    1 - (m.embedding <=> query_embedding) AS similarity, m.created_at
  FROM memories m
  WHERE 1 - (m.embedding <=> query_embedding) > match_threshold
    AND (filter_platform IS NULL OR m.platform = filter_platform)
    AND (filter_tags IS NULL OR m.tags && filter_tags)
  ORDER BY m.embedding <=> query_embedding
  LIMIT match_count;
END;
$$ LANGUAGE plpgsql;

-- Helper function: search chunks
CREATE OR REPLACE FUNCTION search_chunks_by_embedding(
  query_embedding vector(1536),
  similarity_threshold float DEFAULT 0.7,
  result_limit int DEFAULT 10,
  filter_method varchar DEFAULT NULL
)
RETURNS TABLE (
  id VARCHAR(500), canonical_object_id VARCHAR(255),
  content TEXT, method VARCHAR(50), metadata JSONB, similarity float
) AS $$
BEGIN
  RETURN QUERY
  SELECT c.id, c.canonical_object_id, c.content, c.method, c.metadata,
    1 - (c.embedding <=> query_embedding) AS similarity
  FROM chunks c
  WHERE c.embedding IS NOT NULL
    AND (filter_method IS NULL OR c.method = filter_method)
    AND (1 - (c.embedding <=> query_embedding)) >= similarity_threshold
  ORDER BY c.embedding <=> query_embedding
  LIMIT result_limit;
END;
$$ LANGUAGE plpgsql;

-- Helper function: get next paper ID
CREATE OR REPLACE FUNCTION get_next_paper_id()
RETURNS VARCHAR(10) AS $$
DECLARE
  max_id VARCHAR(10);
  next_num INTEGER;
BEGIN
  SELECT id INTO max_id FROM papers ORDER BY id DESC LIMIT 1;
  IF max_id IS NULL THEN RETURN '001'; END IF;
  next_num := CAST(max_id AS INTEGER) + 1;
  RETURN LPAD(next_num::TEXT, 3, '0');
END;
$$ LANGUAGE plpgsql;

-- Helper function: trigger for paper status updates
CREATE OR REPLACE FUNCTION update_paper_status_from_experiments()
RETURNS TRIGGER AS $$
DECLARE
  paper_id_val VARCHAR(10);
  avg_f1 FLOAT;
BEGIN
  FOREACH paper_id_val IN ARRAY NEW.paper_ids
  LOOP
    SELECT AVG(er.f1_score) INTO avg_f1
    FROM experiment_results er WHERE er.experiment_id = NEW.id;
    IF avg_f1 >= 0.70 THEN
      UPDATE papers SET status = '✅ Validated', updated_at = NOW()
      WHERE id = paper_id_val AND status != '✅ Validated';
    ELSIF avg_f1 IS NOT NULL THEN
      UPDATE papers SET status = '🧪 Testing', updated_at = NOW()
      WHERE id = paper_id_val AND status = '📋 To Experiment';
    END IF;
  END LOOP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_paper_status AFTER INSERT ON experiments FOR EACH ROW WHEN (NEW.paper_ids IS NOT NULL) EXECUTE FUNCTION update_paper_status_from_experiments();

-- Helper function: get best experiment
CREATE OR REPLACE FUNCTION get_best_experiment(scenario_filter VARCHAR DEFAULT NULL)
RETURNS TABLE (experiment_id INTEGER, experiment_name VARCHAR(255), avg_f1_score FLOAT, config JSONB) AS $$
BEGIN
  RETURN QUERY
  SELECT e.id, e.name, AVG(er.f1_score) as avg_f1, e.config
  FROM experiments e
  JOIN experiment_results er ON e.id = er.experiment_id
  WHERE scenario_filter IS NULL OR er.scenario = scenario_filter
  GROUP BY e.id, e.name, e.config
  ORDER BY avg_f1 DESC LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- Helper function: compare experiments
CREATE OR REPLACE FUNCTION compare_experiments(exp1_id INTEGER, exp2_id INTEGER)
RETURNS TABLE (scenario VARCHAR(100), exp1_f1 FLOAT, exp2_f1 FLOAT, improvement FLOAT) AS $$
BEGIN
  RETURN QUERY
  SELECT COALESCE(er1.scenario, er2.scenario) as scenario,
    er1.f1_score as exp1_f1, er2.f1_score as exp2_f1,
    CASE WHEN er1.f1_score IS NOT NULL AND er1.f1_score > 0
      THEN ((er2.f1_score - er1.f1_score) / er1.f1_score * 100)
      ELSE NULL END as improvement
  FROM experiment_results er1
  FULL OUTER JOIN experiment_results er2 ON er1.scenario = er2.scenario AND er2.experiment_id = exp2_id
  WHERE er1.experiment_id = exp1_id OR er2.experiment_id = exp2_id
  ORDER BY scenario;
END;
$$ LANGUAGE plpgsql;
