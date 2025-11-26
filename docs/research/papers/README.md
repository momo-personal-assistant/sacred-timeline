# Research Papers Management

This system helps you systematically analyze research papers and apply their insights to improve the Momo RAG system.

## 📁 Directory Structure

```
docs/research/papers/
├── sources/           # Place your research documents here (PDF, MD, TXT, HTML, etc.)
│   ├── paper1.pdf
│   ├── blog-post.md
│   ├── notes.txt
│   └── ...
│
├── summaries/         # Auto-generated practical guides
│   ├── 001-paper1.md
│   ├── 002-blog-post.md
│   ├── 003-notes.md
│   └── ...
│
└── README.md          # This file
```

## 🚀 Quick Start

### Step 1: Add Papers

Copy your research documents to the `sources/` folder (supports PDF, MD, TXT, HTML, and more):

```bash
cp ~/Downloads/my-rag-paper.pdf docs/research/papers/sources/
cp ~/Downloads/anthropic-blog.md docs/research/papers/sources/
cp ~/Downloads/technique-notes.txt docs/research/papers/sources/
```

### Step 2: Analyze Papers

Run the slash command in Claude Code:

```
/analyze-papers
```

This will:

- Scan for new PDFs
- Assign IDs (001, 002, ...)
- Analyze each paper in parallel
- Generate practical implementation guides
- Save to `summaries/` folder
- Update database

### Step 3: Review Summaries

Check the generated summaries:

```bash
ls docs/research/papers/summaries/
cat docs/research/papers/summaries/001-my-rag-paper.md
```

### Step 4: Check Status

See what papers you have:

```
/papers-status
```

### Step 5: Implement

1. Pick the highest-priority paper
2. Read its summary
3. Follow the experiment plan
4. Run validation tests
5. Save experiment (tag with paper_id)

## 📊 Database Schema

Papers are stored in the `papers` table:

```sql
-- Core fields
id              VARCHAR(10)   -- '001', '002', ...
filename        VARCHAR(255)  -- Original PDF filename
title           VARCHAR(255)  -- Extracted title
authors         VARCHAR(255)  -- Extracted authors

-- Categorization
tags            TEXT[]        -- ['chunking', 'embeddings', ...]
status          VARCHAR(50)   -- 📋 To Experiment | 🧪 Testing | ✅ Validated | ❌ Rejected
priority        VARCHAR(20)   -- high | medium | low
momo_relevance  VARCHAR(20)   -- high | medium | low

-- Analysis
expected_f1_gain         FLOAT   -- Expected improvement (+5.0 = +5%)
implementation_effort    VARCHAR -- low | medium | high

-- Paths
pdf_path        TEXT          -- docs/research/papers/pdfs/filename.pdf
summary_path    TEXT          -- docs/research/papers/summaries/001-filename.md

-- Timestamps
analyzed_at     TIMESTAMP     -- When Claude analyzed this
created_at      TIMESTAMP     -- When added to system
```

## 🔗 Linking Papers to Experiments

When you save an experiment in the Validation tab, you can tag it with paper IDs:

```typescript
// In the Validation panel UI
Save as Experiment:
  Name: "Contextual Chunking"
  Papers: [✓] 001 - Contextual Retrieval
  Contribution: "Applied document-level context to chunks"
```

This creates a record in `experiment_papers` table linking the experiment to the paper.

## 📋 Slash Commands

### /analyze-papers

Analyzes new research documents in the `sources/` folder.

**What it does**:

- Scans for new documents (PDF, MD, TXT, HTML, etc. - not in database)
- Assigns sequential IDs
- Reads each document in parallel
- Extracts key insights
- Generates practical guides
- Updates database

**When to use**:

- After adding new documents to `sources/` folder
- Can run multiple times safely (only processes new papers)
- Supports all text-based formats: PDF, Markdown, TXT, HTML, etc.

### /papers-status

Shows status of all papers.

**What it shows**:

- Total count by status
- High-priority unimplemented papers
- Papers with experiments
- Recommended next papers to implement

**When to use**:

- To see what papers you have
- To decide what to implement next
- To track progress

## 📝 Summary File Format

Each summary follows this structure:

```markdown
---
paper_id: 001
title: Contextual Retrieval
authors: Anthropic
tags: [chunking, retrieval, context]
status: 📋 To Experiment
priority: high
momo_relevance: high
expected_f1_gain: 10
implementation_effort: medium
---

# Contextual Retrieval - Practical Guide for Momo

## 📋 Executive Summary

- 3 bullet points

## 🎯 Key Insights

### Insight 1: ...

**Problem**: ...
**Solution**: ...
**Impact**: ...
**Momo Application**: ...

## 🔬 Experiment Plan

### Experiment 1: ...

**Files to modify**: ...
**Implementation**: (code example)
**Test commands**: ...
**Success Criteria**: F1 65.9% → 75%

## 📊 Expected Impact

| Metric | Current | Expected | Gain |
...

## 🚧 Implementation Risks

...

## 📝 Priority Recommendation

high - (reasoning)
```

## 🎯 Workflow Example

### Week 1: Bulk Analysis

```bash
# 1. Download 10 papers (any format)
cp ~/Downloads/rag-papers/*.pdf docs/research/papers/sources/
cp ~/Downloads/blog-posts/*.md docs/research/papers/sources/
cp ~/Downloads/notes/*.txt docs/research/papers/sources/

# 2. Analyze all at once
/analyze-papers

# Output:
# ✅ Analyzed 10 papers
# High priority: 3
# Medium priority: 6
# Low priority: 1

# 3. Check status
/papers-status

# 4. Read top 3 summaries
cat docs/research/papers/summaries/001-*.md
```

### Week 2: Implementation

```bash
# 1. Implement paper 001
# (Follow experiment plan in summary)

# 2. Run validation
# (Use Validation tab in demo app)

# 3. Save experiment
# Tag with paper_id: 001

# 4. Check updated status
/papers-status

# Now paper 001 shows as "Testing" or "Validated"
```

### Week 3: Progress Check

```bash
/papers-status

# Shows:
# - 3 validated papers
# - Best F1 improvements
# - Next recommended papers
```

## 🔧 Database Queries

### Get all papers

```sql
SELECT * FROM papers ORDER BY id;
```

### Get high-priority unimplemented papers

```sql
SELECT id, title, expected_f1_gain
FROM papers
WHERE status = '📋 To Experiment'
  AND priority = 'high'
ORDER BY expected_f1_gain DESC;
```

### Get papers with experiments

```sql
SELECT
  p.id,
  p.title,
  COUNT(ep.experiment_id) as experiment_count
FROM papers p
LEFT JOIN experiment_papers ep ON p.id = ep.paper_id
GROUP BY p.id, p.title
HAVING COUNT(ep.experiment_id) > 0;
```

### Get next paper ID

```sql
SELECT get_next_paper_id();
```

## 🎨 Status Emojis

- 📋 **To Experiment**: Paper analyzed but not yet implemented
- 🧪 **Testing**: Experiment running, results pending
- ✅ **Validated**: Experiment successful, technique adopted
- ❌ **Rejected**: Experiment failed or not worth pursuing

## 💡 Tips

1. **Batch Analysis**: Add multiple PDFs at once, run `/analyze-papers` once
2. **Quick Wins First**: Implement high-priority + low-effort papers first
3. **Tag Experiments**: Always link experiments to their source papers
4. **Track Progress**: Use `/papers-status` regularly
5. **Update Status**: Paper status auto-updates when experiments are saved

## 🔗 Integration with Experiments

Papers integrate seamlessly with the existing Experiments system:

1. **Analyze** a paper → Get practical guide
2. **Implement** the suggestion → Modify code
3. **Validate** → Run validation tests
4. **Save** → Create experiment tagged with paper_id
5. **Track** → Paper status auto-updates

## 📚 Current System Context

- **Current F1 Score**: 65.9%
- **Stack**: PostgreSQL + pgvector, OpenAI embeddings, semantic chunking
- **Target**: 90%+ F1 score
- **Gap**: 24.1% to close

Papers help you systematically close this gap by:

- Identifying proven techniques
- Providing implementation guides
- Tracking what works and what doesn't
- Building institutional knowledge

## 🚧 Troubleshooting

### No papers showing up after /analyze-papers

Check:

1. Are documents in `docs/research/papers/sources/`?
2. Did the database migration run? (006_add_papers.sql)
3. Check database: `SELECT * FROM papers;`
4. Are the files text-based? (Binary formats like DOCX won't work)

### Summaries not being generated

- Ensure documents are text-based and readable
- PDF: Not encrypted or password-protected
- Check file permissions
- Verify disk space for summary files

### Can't link experiment to paper

- Ensure paper exists in database
- Check paper_id format (should be '001', '002', etc.)
- Verify experiments table has paper_ids column

## 📖 Further Reading

- See existing research docs in `docs/research/`
- Check `CHANGELOG.md` for paper-driven improvements
- Review experiment results in the demo app
