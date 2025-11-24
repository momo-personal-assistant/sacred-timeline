---
description: Show current status of all research papers
---

You are providing a status report for research papers in the Momo RAG project.

## Your Task

Query the database and provide a comprehensive status report of all papers.

### Step 1: Get Overall Statistics

```sql
SELECT
  status,
  COUNT(*) as count
FROM papers
GROUP BY status
ORDER BY
  CASE status
    WHEN '✅ Validated' THEN 1
    WHEN '🧪 Testing' THEN 2
    WHEN '📋 To Experiment' THEN 3
    WHEN '❌ Rejected' THEN 4
  END;
```

### Step 2: Get Papers by Priority

```sql
SELECT
  p.id,
  p.title,
  p.status,
  p.priority,
  p.momo_relevance,
  p.expected_f1_gain,
  p.implementation_effort,
  p.analyzed_at,
  COUNT(ep.experiment_id) as experiment_count
FROM papers p
LEFT JOIN experiment_papers ep ON p.id = ep.paper_id
GROUP BY p.id, p.title, p.status, p.priority, p.momo_relevance, p.expected_f1_gain, p.implementation_effort, p.analyzed_at
ORDER BY
  CASE p.priority
    WHEN 'high' THEN 1
    WHEN 'medium' THEN 2
    WHEN 'low' THEN 3
  END,
  p.expected_f1_gain DESC NULLS LAST;
```

### Step 3: Get Papers with Experiments

```sql
SELECT
  p.id,
  p.title,
  e.id as experiment_id,
  e.name as experiment_name,
  AVG(er.f1_score) as avg_f1_score
FROM papers p
JOIN experiment_papers ep ON p.id = ep.paper_id
JOIN experiments e ON ep.experiment_id = e.id
LEFT JOIN experiment_results er ON e.id = er.experiment_id
GROUP BY p.id, p.title, e.id, e.name
ORDER BY p.id, avg_f1_score DESC;
```

### Step 4: Find Next Recommended Paper

Find the highest-priority, not-yet-implemented paper:

```sql
SELECT
  p.id,
  p.title,
  p.priority,
  p.expected_f1_gain,
  p.implementation_effort,
  p.tags
FROM papers p
WHERE p.status = '📋 To Experiment'
  AND p.analyzed_at IS NOT NULL
ORDER BY
  CASE p.priority
    WHEN 'high' THEN 1
    WHEN 'medium' THEN 2
    WHEN 'low' THEN 3
  END,
  CASE p.momo_relevance
    WHEN 'high' THEN 1
    WHEN 'medium' THEN 2
    WHEN 'low' THEN 3
  END,
  p.expected_f1_gain DESC NULLS LAST
LIMIT 3;
```

## Output Format

Present the information in a clean, easy-to-read format:

```
📚 Research Papers Status
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📊 Overview
Total papers: {total}

By Status:
  ✅ Validated: {count}
  🧪 Testing: {count}
  📋 To Experiment: {count}
  ❌ Rejected: {count}

By Priority:
  High: {count}
  Medium: {count}
  Low: {count}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🎯 High Priority Papers (Not Yet Implemented)

{For each high-priority, unimplemented paper:}
{id}. {title}
   Status: {status}
   Expected F1: +{gain}% (65.9% → {65.9 + gain}%)
   Effort: {effort}
   Tags: {tags}
   📄 Summary: docs/research/papers/summaries/{id}-{filename}.md

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ Papers with Experiments

{For each paper that has experiments:}
{id}. {title}
   Experiments: {count}
   Best F1: {max_f1}%
   Status: {status}
   {List experiments with their F1 scores}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🚀 Next Recommended Papers

{Top 3 papers to implement next, ordered by priority, relevance, and expected gain}

1. {id}: {title}
   Priority: {priority} | Relevance: {momo_relevance}
   Expected F1: +{gain}% (effort: {effort})
   Why: {1-sentence reasoning based on current F1 and gaps}

2. {id}: {title}
   ...

3. {id}: {title}
   ...

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

💡 Quick Actions

To analyze new papers:
  /analyze-papers

To view a specific paper summary:
  cat docs/research/papers/summaries/{id}-{filename}.md

To implement a paper:
  1. Read the summary
  2. Follow the experiment plan
  3. Run validation tests
  4. Save as experiment (tag with paper_id)

Current F1 Score: 65.9%
Target: 90%+
Remaining gap: {90 - current_f1}%

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

## Additional Context

- If no papers exist, suggest running `/analyze-papers` first
- If papers exist but none are analyzed, mention they need to be analyzed
- Highlight papers with high ROI (high expected gain + low effort)
- Consider current F1 score (65.9%) when making recommendations

## Example Output

```
📚 Research Papers Status
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📊 Overview
Total papers: 8

By Status:
  ✅ Validated: 2
  🧪 Testing: 1
  📋 To Experiment: 5
  ❌ Rejected: 0

By Priority:
  High: 3
  Medium: 4
  Low: 1

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🎯 High Priority Papers (Not Yet Implemented)

003. Contextual Retrieval (Anthropic)
   Status: 📋 To Experiment
   Expected F1: +10% (65.9% → 75.9%)
   Effort: medium
   Tags: chunking, retrieval, context
   📄 Summary: docs/research/papers/summaries/003-anthropic-contextual-retrieval.md

004. Hybrid Search (Pinecone)
   Status: 📋 To Experiment
   Expected F1: +8% (65.9% → 73.9%)
   Effort: medium
   Tags: hybrid-search, bm25, vector-search
   📄 Summary: docs/research/papers/summaries/004-pinecone-hybrid-search.md

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ Papers with Experiments

001. Semantic Chunking (LlamaIndex)
   Experiments: 2
   Best F1: 69.2%
   Status: ✅ Validated
   - Experiment #12: Semantic Chunking v1 → F1 67.5%
   - Experiment #15: Semantic Chunking v2 → F1 69.2%

002. OpenAI Embeddings v3
   Experiments: 1
   Best F1: 65.9%
   Status: 🧪 Testing
   - Experiment #10: Baseline with text-embedding-3-small → F1 65.9%

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🚀 Next Recommended Papers

1. 003: Contextual Retrieval (Anthropic)
   Priority: high | Relevance: high
   Expected F1: +10% (effort: medium)
   Why: Highest expected gain, addresses chunking weakness

2. 004: Hybrid Search (Pinecone)
   Priority: high | Relevance: high
   Expected F1: +8% (effort: medium)
   Why: Combines BM25 + vector for better recall

3. 005: Voyage AI Embeddings
   Priority: medium | Relevance: high
   Expected F1: +5% (effort: low)
   Why: Quick win, drop-in replacement for OpenAI

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

💡 Quick Actions

To analyze new papers:
  /analyze-papers

To view a specific paper summary:
  cat docs/research/papers/summaries/003-anthropic-contextual-retrieval.md

To implement a paper:
  1. Read the summary
  2. Follow the experiment plan
  3. Run validation tests
  4. Save as experiment (tag with paper_id)

Current F1 Score: 65.9%
Target: 90%+
Remaining gap: 24.1%

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```
