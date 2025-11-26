-- Ground Truth Queries for Retrieval Evaluation
-- This table stores test queries and their expected relevant documents

CREATE TABLE IF NOT EXISTS ground_truth_queries (
  id SERIAL PRIMARY KEY,
  query_text TEXT NOT NULL,
  scenario VARCHAR(50) DEFAULT 'normal',
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Expected relevant documents for each query
CREATE TABLE IF NOT EXISTS ground_truth_query_results (
  id SERIAL PRIMARY KEY,
  query_id INTEGER REFERENCES ground_truth_queries(id) ON DELETE CASCADE,
  canonical_object_id VARCHAR(255) NOT NULL,
  relevance_score INTEGER DEFAULT 1 CHECK (relevance_score BETWEEN 0 AND 3),
  -- 0: Not relevant, 1: Somewhat relevant, 2: Relevant, 3: Highly relevant
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(query_id, canonical_object_id)
);

CREATE INDEX IF NOT EXISTS idx_ground_truth_queries_scenario ON ground_truth_queries(scenario);
CREATE INDEX IF NOT EXISTS idx_ground_truth_query_results_query_id ON ground_truth_query_results(query_id);

-- Insert sample test queries based on our existing test data
INSERT INTO ground_truth_queries (query_text, scenario, description) VALUES
  ('API rate limit issues', 'normal', 'Find documents about API rate limiting problems'),
  ('documentation outdated', 'normal', 'Find documents about documentation being outdated'),
  ('onboarding process problems', 'normal', 'Find documents about onboarding difficulties'),
  ('webhook configuration help', 'normal', 'Find documents about webhook setup')
ON CONFLICT DO NOTHING;

-- Map expected relevant documents to queries
-- Note: These object IDs should match your actual test data
-- Query 1: API rate limit issues
INSERT INTO ground_truth_query_results (query_id, canonical_object_id, relevance_score) VALUES
  (1, 'issue_789', 3),  -- "Rate limit too low for production use"
  (1, 'PR-456', 3),     -- "feat: increase default rate limit to 5000/day"
  (1, 'ENG-123', 3),    -- "API Rate Limit 증가 검토"
  (1, 'slack_11', 2)    -- Rate limit complaint message
ON CONFLICT DO NOTHING;

-- Query 2: documentation outdated
INSERT INTO ground_truth_query_results (query_id, canonical_object_id, relevance_score) VALUES
  (2, 'slack_7', 3),    -- "문서가 outdated된 것 같아요"
  (2, 'DOC-45', 3)      -- "API 문서 업데이트 - webhook 섹션 추가"
ON CONFLICT DO NOTHING;

-- Query 3: onboarding process problems
INSERT INTO ground_truth_query_results (query_id, canonical_object_id, relevance_score) VALUES
  (3, 'slack_5', 3)     -- "온보딩 과정이 너무 복잡해요"
ON CONFLICT DO NOTHING;

-- Query 4: webhook configuration
INSERT INTO ground_truth_query_results (query_id, canonical_object_id, relevance_score) VALUES
  (4, 'DOC-45', 3),     -- "API 문서 업데이트 - webhook 섹션 추가"
  (4, 'slack_9', 3)     -- "webhook 설정 방법을 못 찾겠어요"
ON CONFLICT DO NOTHING;
