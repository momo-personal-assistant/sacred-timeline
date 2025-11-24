# 📚 How to Use the Papers System

## Quick Start Guide

### 1️⃣ Add Your Research Documents

Simply copy research papers to the `sources/` folder (supports PDF, MD, TXT, HTML, and more):

```bash
cp ~/Downloads/contextual-retrieval.pdf docs/research/papers/sources/
cp ~/Downloads/anthropic-blog.md docs/research/papers/sources/
cp ~/Downloads/rag-notes.txt docs/research/papers/sources/
```

That's it! No need to rename files or organize them.

**Supported formats**:

- ✅ PDF (research papers from arXiv, etc.)
- ✅ Markdown (.md) (blog posts, GitHub docs)
- ✅ Text (.txt) (notes, summaries)
- ✅ HTML (web articles)
- ✅ Any text-based format

### 2️⃣ Analyze Papers

In Claude Code, run:

```
/analyze-papers
```

You'll see output like:

```
🔍 Scanning docs/research/papers/sources/...

Found 3 documents (PDF, MD, TXT)
Checking database for existing papers...

📋 New papers to analyze (3):
1. contextual-retrieval.pdf
2. anthropic-blog.md
3. rag-notes.txt

Assigning IDs: 001, 002, 003

💾 Saving to database... ✅

🔬 Starting parallel analysis...

[Analyzing 001: contextual-retrieval.pdf...]
[Analyzing 002: hybrid-search.pdf...]
[Analyzing 003: cohere-embeddings.pdf...]

✍️ Writing summaries...
✅ docs/research/papers/summaries/001-contextual-retrieval.md
✅ docs/research/papers/summaries/002-hybrid-search.md
✅ docs/research/papers/summaries/003-cohere-embeddings.md

💾 Updating database... ✅

✅ Analysis Complete!

📊 Summary:
- Total papers analyzed: 3
- High priority: 2 (001, 002)
- Medium priority: 1 (003)

🎯 Recommended Implementation Order:

1. 001: Contextual Retrieval
   Expected F1: +10% (65.9% → 75.9%)
   Effort: Medium

2. 002: Hybrid Search
   Expected F1: +8% (65.9% → 73.9%)
   Effort: Medium

3. 003: Cohere Embeddings
   Expected F1: +5% (65.9% → 70.9%)
   Effort: Low
```

### 3️⃣ Read Summaries

Check the generated practical guides:

```bash
cat docs/research/papers/summaries/001-contextual-retrieval.md
```

Each summary contains:

- **Executive Summary**: 3-line overview
- **Key Insights**: What the paper discovered
- **Experiment Plan**: Exactly what to implement
- **Code Examples**: Ready-to-use code snippets
- **Success Criteria**: How to measure success
- **Expected Impact**: F1 score improvements

### 4️⃣ Check Status

Anytime, run:

```
/papers-status
```

Output:

```
📚 Research Papers Status

📊 Overview
Total papers: 3

By Status:
  📋 To Experiment: 3

By Priority:
  High: 2
  Medium: 1

🎯 High Priority Papers (Not Yet Implemented)

001. Contextual Retrieval
   Expected F1: +10% (65.9% → 75.9%)
   Effort: medium
   Tags: chunking, retrieval, context

002. Hybrid Search
   Expected F1: +8% (65.9% → 73.9%)
   Effort: medium
   Tags: hybrid-search, bm25, vector-search

🚀 Next Recommended Papers

1. 001: Contextual Retrieval
   Priority: high | Relevance: high
   Expected F1: +10% (effort: medium)
```

### 5️⃣ Implement

Let's implement paper 001:

**Step 1**: Read the summary

```bash
cat docs/research/papers/summaries/001-contextual-retrieval.md
```

**Step 2**: Follow the experiment plan

The summary will tell you exactly:

- Which files to modify (e.g., `packages/embedding/chunker.ts`)
- What code to add (with examples)
- What commands to run

**Step 3**: Make the changes

```typescript
// Example from the summary
// packages/embedding/chunker.ts

class Chunker {
  addContext(chunk: Chunk, object: CanonicalObject): string {
    const context = `Document: ${object.title} | Type: ${object.platform_type}`;
    return `${context}\n\n${chunk.content}`;
  }
}
```

**Step 4**: Run the experiment

```bash
pnpm tsx scripts/embed-chunks.ts contextual
pnpm tsx scripts/validate-relations.ts all
```

**Step 5**: Check results in Validation tab

Open `http://localhost:3000` → Validation tab

- See the new F1 score
- If good, click "Save as Experiment"

**Step 6**: Tag the experiment

When saving:

- Name: "Contextual Chunking"
- Papers: Select ✓ 001 - Contextual Retrieval
- Contribution: "Applied document-level context to chunks"

**Step 7**: Verify

Run `/papers-status` again:

```
001. Contextual Retrieval
   Status: ✅ Validated  ← Changed!
   Experiments: 1
   Best F1: 75.9%
```

### 6️⃣ Repeat

Move to the next high-priority paper!

## 🎯 Real-World Scenario

### Scenario: You want to improve F1 from 65.9% to 90%

**Week 1: Discovery**

```bash
# Download 10 promising RAG resources (any format)
cp ~/Downloads/rag-papers/*.pdf docs/research/papers/sources/
cp ~/Downloads/blog-posts/*.md docs/research/papers/sources/
cp ~/Downloads/notes/*.txt docs/research/papers/sources/

# Analyze all at once
/analyze-papers

# Result: 10 documents analyzed
# - 4 high priority
# - 5 medium priority
# - 1 low priority
```

**Week 2: Quick Wins**

```bash
# Check what to do first
/papers-status

# Implement top 3 papers
# Paper 001: Contextual chunking → F1 75.9% (+10%)
# Paper 004: BM25 hybrid → F1 78.2% (+2.3%)
# Paper 007: Voyage embeddings → F1 80.1% (+1.9%)
```

**Week 3: Advanced Techniques**

```bash
# Status check
/papers-status

# Now shows:
# - 3 validated papers
# - 7 remaining

# Implement next 2
# Paper 002: Query expansion → F1 83.5% (+3.4%)
# Paper 005: Re-ranking → F1 86.8% (+3.3%)
```

**Week 4: Final Push**

```bash
# Status: F1 at 86.8%
# 3.2% to reach 90%

# Implement final papers
# Paper 003: Multi-vector → F1 89.2% (+2.4%)
# Paper 006: Contextual BM25 → F1 91.1% (+1.9%)

# 🎉 Target reached!
```

## 💡 Pro Tips

### Tip 1: Batch Analysis

Don't analyze papers one by one. Add 5-10 documents (any format), then run `/analyze-papers` once.

### Tip 2: Sort by ROI

Papers with **high expected gain** + **low effort** = quick wins.

```
/papers-status

# Look for:
# Expected F1: +8%
# Effort: low  ← This!
```

### Tip 3: Check Related Techniques

Many papers reference each other. If paper 001 works well, check its "Related Techniques" section for more papers to try.

### Tip 4: Track Everything

Always tag experiments with paper_ids. This lets you:

- See which papers actually worked
- Build institutional knowledge
- Avoid re-trying failed approaches

### Tip 5: Re-run /analyze-papers Safely

You can add new documents anytime and re-run `/analyze-papers`. It only processes NEW papers.

```bash
# First run
cp paper1.pdf paper2.md sources/
/analyze-papers
# → Analyzes 001, 002

# Later...
cp notes.txt sources/
/analyze-papers
# → Only analyzes 003 (skips 001, 002)
```

## 🔍 What If...

### What if a paper doesn't apply to Momo?

Claude will mark it as:

- **Momo Relevance**: low
- **Priority**: low

It will appear at the bottom of `/papers-status`. You can ignore it or mark it as ❌ Rejected.

### What if an experiment fails?

That's valuable data!

1. Run the experiment
2. If F1 doesn't improve or gets worse
3. Save it anyway (so you remember not to retry)
4. In the database, update:

```sql
UPDATE papers
SET status = '❌ Rejected'
WHERE id = '005';
```

### What if I have 50 papers?

Perfect! Add them all to `sources/` (any format) and run `/analyze-papers`.

Claude will:

- Analyze all 50 in parallel (PDF, MD, TXT, HTML, etc.)
- Rank by priority
- Show you the top 5 to implement

You don't need to read all 50. Just implement the top ones.

### What if a paper is too complex?

Claude will mark it as:

- **Implementation Effort**: high
- **Priority**: Based on expected gain

If effort is high but gain is small → Priority: low (skip it)
If effort is high but gain is huge → Priority: medium (do it later)

## 🎨 Understanding Status Flow

```
Document added to sources/ (PDF, MD, TXT, etc.)
    ↓
/analyze-papers
    ↓
Status: 📋 To Experiment
    ↓
You implement it
    ↓
Save experiment (F1 < 70%)
    ↓
Status: 🧪 Testing
    ↓
Iterate and improve
    ↓
Save experiment (F1 >= 70%)
    ↓
Status: ✅ Validated
```

Or:

```
Try experiment
    ↓
Doesn't work
    ↓
Manual update: ❌ Rejected
```

## 📊 Example Output Files

### Example Summary: `001-contextual-retrieval.md`

````markdown
---
paper_id: 001
title: Contextual Retrieval
authors: Anthropic
tags: [chunking, retrieval, context]
priority: high
expected_f1_gain: 10
---

# Contextual Retrieval - Practical Guide for Momo

## 📋 Executive Summary

- Adding document context to chunks reduces retrieval failures by 49%
- BM25 + vector hybrid is 5.7% better than vector-only
- Combined approach reduces failures by 67%

## 🎯 Key Insights

### Insight 1: Contextual Embeddings

**Problem**: Chunks lack context. "He agreed" → Who? To what?

**Solution**: Add document metadata to each chunk.
Before: "He agreed to the proposal"
After: "Document: ENG-123 JWT Auth | Section: Comments | He agreed to the proposal"

**Impact**: Top-20 retrieval failures: 5.7% → 1.9% (67% reduction)

**Momo Application**:
Modify `packages/embedding/chunker.ts` to prepend:

- Object title
- Platform type
- Creation date

### Insight 2: BM25 Hybrid Search

...

## 🔬 Experiment Plan

### Experiment 1: Add Context to Chunks

**Files to modify**:

- `packages/embedding/chunker.ts`

**Implementation**:

```typescript
class Chunker {
  addContext(chunk: Chunk, object: CanonicalObject): string {
    const context = [
      `Document: ${object.title}`,
      `Type: ${object.platform_type}`,
      `Date: ${object.created_at.toISOString().split('T')[0]}`,
    ].join(' | ');
    return `${context}\n\n${chunk.content}`;
  }
}
```
````

**Test commands**:

```bash
pnpm tsx scripts/embed-chunks.ts contextual
pnpm tsx scripts/validate-relations.ts all
```

**Success Criteria**: F1 65.9% → 75%+

...

```

## 🚀 Next Steps

Now you're ready to:

1. Add research documents to `docs/research/papers/sources/` (PDF, MD, TXT, HTML, etc.)
2. Run `/analyze-papers`
3. Check `/papers-status`
4. Implement top paper
5. Repeat until F1 > 90%

Happy optimizing! 📈
```
