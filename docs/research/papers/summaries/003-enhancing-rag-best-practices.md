---
paper_id: '003'
title: 'Enhancing Retrieval-Augmented Generation: A Study of Best Practices'
authors: Siran Li, Linus Stenzel, Carsten Eickhoff, Seyed Ali Bahrainian (University of Tubingen)
tags: [retrieval, chunking, in-context-learning, focus-mode, query-expansion, rag]
status: 'To Experiment'
priority: high
momo_relevance: high
expected_f1_gain: 12
implementation_effort: medium
---

# RAG Best Practices - Practical Guide for Momo

## Executive Summary

- **Contrastive In-Context Learning (ICL) RAG achieves the best results**, showing significant improvements especially on specialized knowledge tasks (MMLU: +14% improvement)
- **Focus Mode RAG (sentence-level retrieval) ranks second**, demonstrating that retrieving fewer, more relevant sentences outperforms retrieving full documents
- **Knowledge base size is less important than document quality** - relevance matters more than coverage

---

## Key Insights

### Insight 1: Contrastive In-Context Learning RAG

**Problem**:
Standard RAG retrieves relevant context but doesn't teach the model how to use it effectively. The model may still produce incorrect answers despite having correct information available.

**Solution**:
Include both correct AND incorrect examples (contrastive examples) in the prompt. This helps the model learn to distinguish between correct and incorrect patterns.

**Impact**:

- TruthfulQA: +3.93% ROUGE-L, +3.15% FActScore
- MMLU: +15% ROUGE-L, +10.71% FActScore (74.44 vs 63.73 baseline)
- Outperformed ALL other RAG variants tested

**Momo Application**:
For Momo's relation inference, include examples of:

- Correct related pairs: "These two messages ARE related because..."
- Incorrect pairs: "These two messages are NOT related because..."

This contrastive approach can significantly improve relation accuracy.

### Insight 2: Focus Mode - Sentence-Level Retrieval

**Problem**:
Retrieving full documents or large chunks includes irrelevant information that can dilute the context and confuse the generation model.

**Solution**:
Instead of retrieving entire documents, split retrieved documents into sentences and re-rank them. Only provide the most relevant sentences to the LLM.

**Impact**:

- Second-best performance after Contrastive ICL
- 80Doc80S (80 docs -> 80 sentences) achieved best results on TruthfulQA
- 120Doc120S achieved best results on MMLU
- +1.65% ROUGE-L improvement

**Momo Application**:
After initial chunk retrieval, perform a second-pass sentence-level re-ranking. For relation inference, this means extracting only the most semantically relevant sentences from memory chunks.

### Insight 3: Knowledge Base Quality > Quantity

**Problem**:
Common assumption is that larger knowledge bases lead to better results.

**Solution**:
The paper found minimal performance differences between 1K and 10K document knowledge bases. Quality and relevance of documents matter more than raw size.

**Impact**:

- No statistically significant improvement from larger knowledge bases
- Suggests focusing on document quality over quantity

**Momo Application**:
Focus on improving chunking quality and semantic hash deduplication rather than adding more data. Current EXP-001 semantic hash approach aligns with this insight.

### Insight 4: Retrieval Stride Considerations

**Problem**:
Some approaches update context during generation (retrieval stride), but this can disrupt coherence.

**Solution**:
Larger retrieval strides (less frequent updates) preserve context stability and improve coherence. Frequent retrieval updates (stride 1-2) actually hurt performance.

**Impact**:

- Stride 1: -3.61% ROUGE-L degradation
- Baseline (no stride): Best performance

**Momo Application**:
For Momo's retrieval, stick with single-retrieval approach rather than implementing dynamic context updates during generation.

---

## Experiment Plan

### Experiment 1: Contrastive In-Context Learning for Relation Inference

**Hypothesis**:
Adding contrastive examples (related + unrelated pairs) to the relation inference prompt will improve F1 by 10-15% by helping the model better discriminate between true and false relations.

**Files to modify**:

- `packages/relation-inference/src/relation-inferrer.ts` - Add contrastive prompt template
- `scripts/validate-relations.ts` - Update validation to use contrastive approach

**Implementation**:

```typescript
// packages/relation-inference/src/contrastive-inferrer.ts
export class ContrastiveRelationInferrer {
  private contrastiveExamples = {
    positive: [
      {
        chunk1: 'Q3 revenue increased by 15%',
        chunk2: 'Third quarter financial results exceeded expectations',
        label: 'RELATED',
        reason: 'Both discuss Q3 financial performance',
      },
    ],
    negative: [
      {
        chunk1: 'Team meeting scheduled for Monday',
        chunk2: 'Product launch planned for Q4',
        label: 'NOT_RELATED',
        reason: 'Different topics: scheduling vs product planning',
      },
    ],
  };

  async inferRelation(chunk1: string, chunk2: string): Promise<RelationResult> {
    const prompt = `
Given these examples:

RELATED Example:
Chunk A: "${this.contrastiveExamples.positive[0].chunk1}"
Chunk B: "${this.contrastiveExamples.positive[0].chunk2}"
Result: RELATED - ${this.contrastiveExamples.positive[0].reason}

NOT RELATED Example:
Chunk A: "${this.contrastiveExamples.negative[0].chunk1}"
Chunk B: "${this.contrastiveExamples.negative[0].chunk2}"
Result: NOT_RELATED - ${this.contrastiveExamples.negative[0].reason}

Now determine if these chunks are related:
Chunk A: "${chunk1}"
Chunk B: "${chunk2}"
Result:`;

    return await this.llm.complete(prompt);
  }
}
```

**Test commands**:

```bash
# Run experiment with contrastive ICL
pnpm run experiment config/experiments/contrastive-icl.yaml

# Validate results
pnpm tsx scripts/validate-relations.ts all
```

**Success Criteria**:

- F1 Score: 65.9% -> 78%+
- Precision: 53.5% -> 65%+ (fewer false positives)
- Should see dramatic reduction in incorrect relation predictions

**Estimated Effort**: 1-2 days

### Experiment 2: Focus Mode - Sentence-Level Re-ranking

**Hypothesis**:
Adding a sentence-level re-ranking step after initial chunk retrieval will improve precision by filtering out irrelevant content within chunks.

**Files to modify**:

- `packages/retrieval/src/retriever.ts` - Add sentence extraction and re-ranking
- `packages/chunking/src/sentence-splitter.ts` - New utility for sentence splitting

**Implementation**:

```typescript
// packages/retrieval/src/focus-mode-retriever.ts
export class FocusModeRetriever {
  async retrieveWithFocus(
    query: string,
    topK: number = 20,
    topSentences: number = 10
  ): Promise<string[]> {
    // Step 1: Retrieve top K chunks
    const chunks = await this.baseRetriever.retrieve(query, topK);

    // Step 2: Split chunks into sentences
    const sentences: { text: string; chunkId: string }[] = [];
    for (const chunk of chunks) {
      const chunkSentences = this.splitToSentences(chunk.content);
      sentences.push(
        ...chunkSentences.map((s) => ({
          text: s,
          chunkId: chunk.id,
        }))
      );
    }

    // Step 3: Re-rank sentences by relevance to query
    const rankedSentences = await this.rankByRelevance(query, sentences);

    // Step 4: Return top N most relevant sentences
    return rankedSentences.slice(0, topSentences).map((s) => s.text);
  }

  private splitToSentences(text: string): string[] {
    return text.split(/(?<=[.!?])\s+/).filter((s) => s.length > 10);
  }
}
```

**Test commands**:

```bash
# Run focus mode experiment
pnpm run experiment config/experiments/focus-mode.yaml

# Compare with baseline
pnpm tsx scripts/compare-experiments.ts baseline focus-mode
```

**Success Criteria**:

- F1 Score: 65.9% -> 72%+
- Precision improvement (less noise in context)
- Response quality improvement (more focused answers)

**Estimated Effort**: 1 day

### Experiment 3: Query Expansion for Relation Discovery

**Hypothesis**:
Expanding queries with related keywords before retrieval will improve recall by finding semantically related documents that don't share exact terms.

**Files to modify**:

- `packages/retrieval/src/query-expander.ts` - New query expansion module

**Implementation**:

```typescript
// packages/retrieval/src/query-expander.ts
export class QueryExpander {
  async expand(query: string, numExpansions: number = 3): Promise<string[]> {
    const prompt = `Generate ${numExpansions} keyword phrases related to: "${query}"

Output format: keyword1, keyword2, keyword3`;

    const response = await this.llm.complete(prompt);
    const keywords = response.split(',').map((k) => k.trim());

    return [query, ...keywords];
  }
}

// Usage in retriever
const expander = new QueryExpander();
const expandedQueries = await expander.expand(originalQuery);
const results = await Promise.all(
  expandedQueries.map((q) => this.retrieve(q, topK / expandedQueries.length))
);
return this.mergeAndRerank(results.flat());
```

**Success Criteria**:

- Recall: 77.5% -> 82%+
- F1 improvement on commonsense-style queries

**Estimated Effort**: 0.5 days

---

## Expected Impact

| Metric    | Current | Expected | Gain |
| --------- | ------- | -------- | ---- |
| F1 Score  | 65.9%   | 78%+     | +12% |
| Precision | 53.5%   | 68%+     | +14% |
| Recall    | 77.5%   | 85%+     | +7%  |

**Implementation Effort**: Medium (1-2 days for Contrastive ICL)
**Risk Level**: Low (additive improvements, easy to A/B test)
**Dependencies**: None (works with existing infrastructure)

---

## Implementation Risks

### Risk 1: Contrastive Example Quality

- **Issue**: Poor contrastive examples may not help or could hurt performance
- **Mitigation**: Curate high-quality examples from ground truth data; iterate on example selection

### Risk 2: Sentence Splitting Edge Cases

- **Issue**: Some sentences may be incomplete or lose context when split
- **Mitigation**: Include surrounding context; use minimum sentence length threshold

### Risk 3: Query Expansion Noise

- **Issue**: Expanded keywords may introduce irrelevant results
- **Mitigation**: Use small expansion (3 keywords); apply re-ranking to filter noise

---

## Priority Recommendation

**Priority**: HIGH

**Reasoning**:
Contrastive In-Context Learning showed the largest gains in the paper (10-15% improvement) and directly addresses Momo's challenge of relation inference accuracy. The implementation is straightforward - primarily prompt engineering - making this a high-ROI improvement. Combined with Focus Mode, these techniques could push Momo's F1 from 65.9% to 78%+.

---

## Related Techniques

- In-Context Learning (ICL)
- Few-shot prompting
- Contrastive learning
- Re-ranking methods
- Query expansion (pseudo-relevance feedback)
- Sentence embeddings

---

## Quick Reference

**TL;DR**: Implement Contrastive In-Context Learning (showing both correct and incorrect examples) for ~12% F1 improvement, plus Focus Mode sentence-level retrieval for additional gains.

**Best suited for**: Improving relation inference accuracy and reducing false positives

**Quick win?**: Contrastive ICL can be done in 4-6 hours; Focus Mode in 1 day
