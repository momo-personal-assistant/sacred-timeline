# EXP-004: Relation Inference Optimization

```yaml
# Experiment Metadata
experiment_id: EXP-004
title: 'Relation Inference Optimization via Hybrid Strategy'
date: 2025-11-27
status: completed
type: research

# Performance Metrics
baseline_f1: 0.009
result_f1: 0.019

# Tags
tags: ['relation-inference', 'hybrid-strategy', 'threshold-tuning']

# Decision
decision: rejected
rejection_reason: 'Insufficient improvement - only 1.9% F1. Root cause identified as lack of real relationships in synthetic data. Led to EXP-005 project-based approach.'
```

## Overview

**Date**: 2025-11-27
**Objective**: Optimize relation inference F1 score using hybrid strategy (schema + semantic)
**Baseline F1**: 0.9% (threshold 0.35)
**Target F1**: 68%+ (based on previous memo)

## Background

### Problem Statement

- Current relation inference produces too many false positives
- Precision ~1% means 99% of inferred relations are wrong
- Pure semantic similarity cannot distinguish "related" from "similar topic"

### Hypothesis (from memo)

Based on previous analysis:

| Method            | Operational Relations | Semantic Relations |
| ----------------- | --------------------- | ------------------ |
| Schema-based      | ✅ Good               | ❌ Cannot find     |
| Cosine similarity | △ Partial             | △ Partial          |
| LLM               | ❌ Failed             | ❌ Failed          |

**Proposed Strategy**:

1. First: Schema-based for operational relations (high precision)
2. Second: Cosine similarity for semantic relations (recall boost)

## Experiments

### Ground Truth

- **Human labeled**: 101 pairs
  - Related: 48
  - Unrelated: 42
  - Uncertain: 11
- **Total objects**: 260 (Linear 110 + Zendesk 100 + Slack 50)

### Results

| Experiment        | Threshold | Semantic Weight | F1       | Precision | Recall    | Relations |
| ----------------- | --------- | --------------- | -------- | --------- | --------- | --------- |
| Baseline          | 0.35      | 0.7             | 0.9%     | 0.5%      | **91.4%** | 20,238    |
| **threshold-0.5** | 0.5       | 0.7             | **1.9%** | **1.0%**  | 43.8%     | 2,650     |
| exp-004-hybrid    | 0.6       | 0.5             | 0.0%     | 0.0%      | 0.0%      | 208       |
| exp-004b-balanced | 0.45      | 0.7             | 1.7%     | 0.9%      | 61.0%     | 5,086     |

### Best Configuration

```yaml
relationInference:
  similarityThreshold: 0.5
  keywordOverlapThreshold: 0.65
  useSemanticSimilarity: true
  semanticWeight: 0.7
```

**Result**: F1 = 1.9%, Precision = 1.0%, Recall = 43.8%

## Analysis

### Why F1 is Still Low (~2%)

1. **GT/Inference Mismatch**
   - GT contains 48 "related" pairs labeled by human
   - Inference finds 2,650 semantic relations
   - Only ~27 pairs overlap (TP)

2. **Synthetic Data Limitation**
   - Generated data has artificial patterns
   - Semantic similarity doesn't reflect true business relationships

3. **Schema-based Relations Not Matching GT**
   - `extractExplicit` finds: user→object, parent→child relations
   - GT contains: object→object pairs from human labeling
   - Actor relations (created_by, assigned_to) don't match human-labeled GT

### Precision-Recall Tradeoff

```
Threshold ↑ → Relations ↓ → Precision ↑ but Recall ↓
Threshold ↓ → Relations ↑ → Recall ↑ but Precision ↓

Optimal threshold depends on use case:
- High precision needed: Use 0.5+
- High recall needed: Use 0.35
```

## Conclusions

### What Worked

- Threshold tuning from 0.35 → 0.5 improved F1 from 0.9% to 1.9% (2x improvement)
- Semantic weight 0.7 is better than 0.5 (keyword sim is mostly 0)

### What Didn't Work

- Target F1 68% not achieved
- Hybrid strategy limited by GT structure mismatch
- Pure semantic similarity cannot reach high precision

### Root Cause

> **The fundamental issue is that semantic similarity alone cannot define "related"**
>
> Two items about "dashboard" are semantically similar but may not be operationally related.
> True relations require:
>
> - Same project/epic
> - Same incident
> - Explicit cross-references
> - Temporal proximity + actor overlap

## Recommendations

### Short-term (Improve Current System)

1. **More human labeling** (100 → 500+ pairs)
2. **Label operational relations** (same project, same assignee)
3. **Real data instead of synthetic**

### Medium-term (Architecture Changes)

1. **Multi-signal fusion**:

   ```
   score = w1*semantic + w2*keyword + w3*actor_overlap + w4*temporal_proximity
   ```

2. **LLM-based relation classification**:
   - Use contrastive ICL (already implemented)
   - Requires proper prompt engineering

3. **Graph-based inference**:
   - Transitive relations (A→B, B→C → A→C)
   - Community detection

### Long-term (Rethink Approach)

- Move from "pairwise similarity" to "context-aware relation extraction"
- Consider knowledge graph embedding approaches
- Integrate with actual project/issue tracking metadata

## Files

- `config/experiments/threshold-0.5.yaml` - Best performing config
- `config/experiments/exp-004-hybrid.yaml` - Failed hybrid attempt
- `config/experiments/exp-004b-balanced.yaml` - Balanced hybrid

## Next Steps

- [ ] Increase human labeling to 500+ pairs
- [ ] Test with real (non-synthetic) data
- [ ] Implement multi-signal scoring
- [ ] Try contrastive ICL with better examples
