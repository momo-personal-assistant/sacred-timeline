---
paper_id: '002'
title: 'voyage-3-large: State-of-the-Art General-Purpose Embedding Model'
authors: Voyage AI
tags: [embeddings, vector-search, retrieval, quantization, matryoshka]
status: 'To Experiment'
priority: high
momo_relevance: high
expected_f1_gain: 8
implementation_effort: low
---

# voyage-3-large - Practical Guide for Momo

## Executive Summary

- **voyage-3-large outperforms OpenAI text-embedding-3-large by 9.74%** across 100 datasets spanning 8 domains (law, finance, code, tech docs, etc.)
- **Matryoshka learning** enables flexible dimensionality (2048, 1024, 512, 256) with minimal quality loss - int8 @ 1024 dims is only 0.31% worse than float @ 2048
- **32K token context** vs OpenAI's 8K - critical for handling longer documents and maintaining semantic coherence

---

## Key Insights

### Insight 1: Superior Retrieval Quality Across Domains

**Problem**:
Current OpenAI text-embedding-3-small may be leaving retrieval quality on the table, especially for specialized domains.

**Solution**:
voyage-3-large uses advanced training techniques to achieve state-of-the-art performance across diverse domains including technical documentation, code, law, and finance.

**Impact**:

- 9.74% average improvement over OpenAI-v3-large
- 20.71% improvement over Cohere-v3-English
- Best-in-class for general-purpose retrieval

**Momo Application**:
Direct replacement of `text-embedding-3-small` with `voyage-3-large` in `packages/embeddings/src/openai-embedder.ts`. Since Momo handles diverse memory types (Slack messages, documents, code), voyage-3-large's multi-domain strength is highly relevant.

### Insight 2: Matryoshka Learning for Cost-Performance Tradeoff

**Problem**:
High-dimensional embeddings (1536+) consume significant vector storage and increase query latency.

**Solution**:
Matryoshka learning allows using smaller dimensions (1024, 512, 256) with graceful quality degradation. Binary quantization reduces storage by 200x with only 1.16% quality loss.

**Impact**:

- int8 @ 1024 dims: 8x less storage, only 0.31% quality loss
- binary @ 512 dims: 200x less storage, still outperforms OpenAI float @ 3072

**Momo Application**:
Momo currently uses 1536 dimensions. Could reduce to 1024 with voyage-3-large for better quality AND lower storage costs. Consider int8 quantization for production.

### Insight 3: Extended Context Length (32K tokens)

**Problem**:
OpenAI embeddings support only 8K tokens, potentially truncating important context from longer documents.

**Solution**:
voyage-3-large supports 32K token context, enabling better semantic capture of longer documents.

**Impact**:
4x longer context window enables capturing full document semantics.

**Momo Application**:
For longer Slack threads or documents, this ensures complete semantic understanding without truncation. Relevant for `packages/chunking/src/semantic-chunker.ts`.

---

## Experiment Plan

### Experiment 1: Drop-in Replacement with voyage-3-large

**Hypothesis**:
Replacing text-embedding-3-small with voyage-3-large will improve F1 score by 5-10% due to superior retrieval quality.

**Files to modify**:

- `packages/embeddings/src/openai-embedder.ts` - Add Voyage AI client
- `packages/embeddings/src/index.ts` - Export new embedder
- `config/default.yaml` - Add voyage model option

**Implementation**:

```typescript
// packages/embeddings/src/voyage-embedder.ts
import { VoyageAIClient } from 'voyageai';

export class VoyageEmbedder implements Embedder {
  private client: VoyageAIClient;

  constructor(apiKey: string, dimensions: number = 1024) {
    this.client = new VoyageAIClient({ apiKey });
    this.dimensions = dimensions;
  }

  async embed(texts: string[]): Promise<number[][]> {
    const response = await this.client.embed({
      input: texts,
      model: 'voyage-3-large',
      outputDimension: this.dimensions,
      outputDtype: 'float', // or 'int8', 'binary'
    });
    return response.embeddings;
  }
}
```

**Test commands**:

```bash
# Re-embed all chunks with voyage-3-large
pnpm tsx scripts/embed-chunks.ts --model voyage-3-large

# Run validation
pnpm tsx scripts/validate-relations.ts all
```

**Success Criteria**:

- F1 Score: 65.9% -> 72%+
- Precision improvement expected due to better semantic matching
- Monitor embedding latency (may be slightly higher)

**Estimated Effort**: 4-6 hours

### Experiment 2: Dimension Reduction with Matryoshka

**Hypothesis**:
Using 1024 dimensions instead of 1536 will maintain quality while reducing storage by 33%.

**Files to modify**:

- `packages/embeddings/src/voyage-embedder.ts` - Configurable dimensions
- Database migration for new vector dimensions

**Implementation**:

```typescript
// In experiment config
embedding:
  model: "voyage-3-large"
  dimensions: 1024  # Down from 1536
  outputDtype: "float"  # or "int8" for further compression
```

**Success Criteria**:

- F1 Score maintained within 1% of full dimensions
- 33% reduction in vector storage

**Estimated Effort**: 2 hours

---

## Expected Impact

| Metric    | Current | Expected | Gain  |
| --------- | ------- | -------- | ----- |
| F1 Score  | 65.9%   | 73%+     | +7-8% |
| Precision | 53.5%   | 62%+     | +8%   |
| Recall    | 77.5%   | 82%+     | +5%   |

**Implementation Effort**: Low
**Risk Level**: Low
**Dependencies**: Voyage AI API key, `voyageai` npm package

---

## Implementation Risks

### Risk 1: API Cost Difference

- **Issue**: Voyage AI pricing may differ from OpenAI
- **Mitigation**: First 200M tokens free; compare pricing after trial

### Risk 2: Latency Changes

- **Issue**: Different API provider may have different latency characteristics
- **Mitigation**: Benchmark latency before full migration; consider batching

### Risk 3: Database Migration

- **Issue**: If changing dimensions, need to re-embed all existing data
- **Mitigation**: Run as experiment first, keep original embeddings until validated

---

## Priority Recommendation

**Priority**: HIGH

**Reasoning**:
This is a low-effort, high-impact change. Voyage-3-large demonstrates consistent 9.74% improvement across diverse domains, and Momo's current F1 score of 65.9% suggests significant room for improvement. The drop-in replacement nature makes this a quick win.

---

## Related Techniques

- Matryoshka Representation Learning (MRL)
- Quantization-aware training
- Multi-domain embedding models
- Binary embeddings for efficient retrieval

---

## Quick Reference

**TL;DR**: Replace OpenAI embeddings with voyage-3-large for ~8% F1 improvement with minimal code changes.

**Best suited for**: Improving overall retrieval quality across Momo's diverse memory types

**Quick win?**: Yes - Can be implemented in < 1 day
