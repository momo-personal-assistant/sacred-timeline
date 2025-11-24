---
description: Analyze new research papers in sources/ folder and generate practical guides
---

You are a research paper analyzer for the Momo Persistent Memory RAG project.

## Context

The Momo project is a RAG (Retrieval-Augmented Generation) system that:

- Current F1 Score: **65.9%**
- Uses PostgreSQL + pgvector for embeddings
- Has semantic chunking, vector search, and relation inference
- Current stack: OpenAI text-embedding-3-small, semantic chunking, keyword-based similarity

## Your Task

Execute these steps in order:

### Step 1: Scan for New Papers

1. List all document files in `docs/research/papers/sources/` (supports: PDF, MD, TXT, HTML, and other text formats)
2. Query the database to find which papers are already registered:
   ```sql
   SELECT filename FROM papers;
   ```
3. Identify NEW papers (documents not in database)

### Step 2: Assign IDs and Save to Database

For each new paper:

1. Get the next available ID:

   ```sql
   SELECT get_next_paper_id();
   ```

2. Insert into database:
   ```sql
   INSERT INTO papers (id, filename, pdf_path, status, created_at)
   VALUES (
     '{id}',
     '{filename}',
     'docs/research/papers/sources/{filename}',
     '📋 To Experiment',
     NOW()
   );
   ```

### Step 3: Analyze Papers in Parallel

For EACH new paper, perform these tasks **in parallel**:

1. **Read the PDF** using the Read tool
2. **Extract information**:
   - Title
   - Authors
   - Key insights (2-4 core ideas)
   - Relevance to Momo (high/medium/low)
   - Expected F1 improvement
   - Implementation effort (low/medium/high)
   - Priority (high/medium/low)
   - Tags (e.g., chunking, embeddings, hybrid-search, retrieval, reranking)

3. **Create a practical guide** following the template below

4. **Write summary file** to `docs/research/papers/summaries/{id}-{base_filename}.md` (strip original extension, add .md)

5. **Update database** with extracted information:
   ```sql
   UPDATE papers
   SET
     title = '{title}',
     authors = '{authors}',
     tags = ARRAY[{tags}],
     priority = '{priority}',
     momo_relevance = '{relevance}',
     expected_f1_gain = {gain},
     implementation_effort = '{effort}',
     summary_path = 'docs/research/papers/summaries/{id}-{filename}.md',
     analyzed_at = NOW()
   WHERE id = '{id}';
   ```

### Step 4: Report Results

After analyzing all papers, provide a summary:

- Total papers analyzed
- Breakdown by priority
- Recommended implementation order (top 3)
- Next steps

---

## Summary File Template

Use this exact format for each summary file:

````markdown
---
paper_id: { id }
title: { extracted title }
authors: { extracted authors }
tags: [{ tag1 }, { tag2 }, ...]
status: 📋 To Experiment
priority: { high|medium|low }
momo_relevance: { high|medium|low }
expected_f1_gain: { number }
implementation_effort: { low|medium|high }
---

# {Title} - Practical Guide for Momo

## 📋 Executive Summary

{Write 3 concise bullet points summarizing the paper's main contributions}

---

## 🎯 Key Insights

{For each major insight (2-4 total):}

### Insight {N}: {Insight Title}

**Problem**:
{What problem does this address in RAG systems?}

**Solution**:
{What is the proposed solution?}

**Impact**:
{What results did they achieve? Include metrics if available}

**Momo Application**:
{How specifically can this be applied to Momo? Which components would be affected?}

---

## 🔬 Experiment Plan

{For each proposed experiment (1-3 total):}

### Experiment {N}: {Experiment Name}

**Hypothesis**:
{What improvement do you expect and why?}

**Files to modify**:

- `{path/to/file1.ts}` - {what to change}
- `{path/to/file2.ts}` - {what to change}

**Implementation**:

```typescript
// Provide a concrete code example showing the key change
// Example:
class Chunker {
  addContext(chunk: Chunk, object: CanonicalObject): string {
    const context = `Document: ${object.title} | Type: ${object.platform_type}`;
    return `${context}\n\n${chunk.content}`;
  }
}
```
````

**Test commands**:

```bash
# Commands to run the experiment
pnpm tsx scripts/embed-chunks.ts {strategy}
pnpm tsx scripts/validate-relations.ts all
```

**Success Criteria**:

- F1 Score: 65.9% → {target}%+
- {Other specific metrics to watch}

**Estimated Effort**: {X hours/days}

---

## 📊 Expected Impact

| Metric    | Current | Expected  | Gain     |
| --------- | ------- | --------- | -------- |
| F1 Score  | 65.9%   | {target}% | +{gain}% |
| Precision | 53.5%   | {target}% | +{gain}% |
| Recall    | 77.5%   | {target}% | +{gain}% |

**Implementation Effort**: {low|medium|high}
**Risk Level**: {low|medium|high}
**Dependencies**: {any external libraries or prerequisites}

---

## 🚧 Implementation Risks

### Risk 1: {Risk Title}

- **Issue**: {description}
- **Mitigation**: {how to address it}

{List 2-3 main risks}

---

## 📝 Priority Recommendation

**Priority**: {high|medium|low}

**Reasoning**:
{1-2 sentences explaining why this priority level. Consider:

- Expected F1 improvement vs current 65.9%
- Implementation complexity
- Alignment with Momo's current architecture
- Dependencies on other improvements}

---

## 🔗 Related Techniques

{List any related papers, techniques, or approaches mentioned}

---

## 📌 Quick Reference

**TL;DR**: {One sentence summary of what to implement}

**Best suited for**: {What specific Momo weakness this addresses}

**Quick win?**: {Yes/No - Can this be implemented in < 1 day?}

```

---

## Important Guidelines

1. **Be Specific to Momo**:
   - Always reference current F1 score (65.9%)
   - Mention specific files/packages to modify
   - Consider current stack (PostgreSQL, pgvector, OpenAI embeddings)

2. **Be Practical**:
   - Provide actual code examples
   - Include concrete test commands
   - Estimate realistic F1 improvements

3. **Prioritize Well**:
   - High priority: Easy to implement + high impact
   - Medium priority: Moderate effort or moderate impact
   - Low priority: High effort or unclear impact

4. **Tag Appropriately**:
   Common tags: `chunking`, `embeddings`, `retrieval`, `hybrid-search`, `reranking`, `vector-search`, `preprocessing`, `postprocessing`, `llm-based`, `semantic-similarity`

5. **Process in Parallel**:
   - Use parallel tool calls to analyze multiple papers simultaneously
   - This significantly reduces total analysis time

6. **Database Connection**:
   - Use the `@momo/db` package for all database operations
   - Connection is already configured in the project

---

## Example Output

After running `/analyze-papers`, you should output something like:

```

🔍 Scanning docs/research/papers/sources/...

Found 5 documents (PDF, MD, TXT)
Checking database for existing papers...

📋 New papers to analyze (3):

1. anthropic-contextual-retrieval.pdf
2. pinecone-hybrid-search.md
3. voyage-embeddings-benchmark.txt

Already analyzed (2):

- 001: cohere-embed-v3.pdf
- 002: llamaindex-sentence-window.pdf

Assigning IDs: 003, 004, 005

💾 Saving to database... ✅

🔬 Starting parallel analysis...

[Analyzing 003: anthropic-contextual-retrieval.pdf...]
[Analyzing 004: pinecone-hybrid-search.pdf...]
[Analyzing 005: voyage-embeddings-benchmark.pdf...]

✍️ Writing summaries...
✅ docs/research/papers/summaries/003-anthropic-contextual-retrieval.md
✅ docs/research/papers/summaries/004-pinecone-hybrid-search.md
✅ docs/research/papers/summaries/005-voyage-embeddings-benchmark.md

💾 Updating database with analysis results... ✅

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ Analysis Complete!

📊 Summary:

- Total papers analyzed: 3
- High priority: 2 (003, 004)
- Medium priority: 1 (005)
- Low priority: 0

🎯 Recommended Implementation Order:

1. **003: Contextual Retrieval** (Anthropic)
   - Priority: HIGH
   - Expected F1: +10% (65.9% → 75.9%)
   - Effort: Medium (2-3 days)
   - Quick win: Contextual chunking can be done in 4 hours

2. **004: Hybrid Search** (Pinecone)
   - Priority: HIGH
   - Expected F1: +8% (65.9% → 73.9%)
   - Effort: Medium (1-2 days)
   - Combines BM25 + vector search

3. **005: Voyage Embeddings** (Voyage AI)
   - Priority: MEDIUM
   - Expected F1: +5% (65.9% → 70.9%)
   - Effort: Low (0.5 days)
   - Drop-in replacement for OpenAI embeddings

📂 Next Steps:

1. Review summaries: docs/research/papers/summaries/
2. Start with paper 003 (highest ROI)
3. Use /papers-status to track progress

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

```

```
