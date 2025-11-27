# EXP-006: Multi-Signal Fusion for Relation Inference

```yaml
# Experiment Metadata
experiment_id: EXP-006
title: 'Multi-Signal Fusion for Relation Inference - Experiment Plan'
date: 2025-11-27
status: running
type: plan

# Performance Metrics
baseline_f1: 0.283
target_f1: 0.50

# Related Resources
related_experiments: ['EXP-005']

# Tags
tags: ['multi-signal-fusion', 'experiment-plan', 'relation-inference']

# Decision
decision: approved
```

## Overview

**Date**: 2025-11-27
**Objective**: Improve F1 score from 28.3% to 50%+ by implementing multi-signal fusion
**Current Baseline**: F1 28.3% (EXP-005 with project-based data, threshold 0.35)
**Target**: F1 50%+ within 1-2 weeks
**Strategy**: Incremental improvement through 5 stages

---

## Experiment Status

### ✅ Stage 1: Threshold Tuning - **COMPLETE**

- **Result**: F1 43.6% (threshold 0.30)
- **Improvement**: +54% over baseline
- **Details**: [EXP-006 Stage 1 Results](./EXP-006-stage-1-results.md)

### ✅ Stage 2: Project Metadata - **COMPLETE** 🎉

- **Result**: F1 86.1% (Precision 75.7%, Recall 100%)
- **Improvement**: +97% over Stage 1
- **Details**: [EXP-006 Stage 2 Results](./EXP-006-stage-2-results.md)
- **Status**: **TARGET EXCEEDED** - Original target was F1 50%+

### ⏸️ Stage 3-5: **ON HOLD**

Current F1 (86.1%) already exceeds all targets. Next steps TBD.

---

## Current State

### Baseline Performance (EXP-005)

- **Data**: 66 project-based objects, 241 GT relations
- **Algorithm**: Semantic similarity (0.7) + Keyword overlap (0.3)
- **Threshold**: 0.35
- **Results**: F1=28.3%, Precision=30.2%, Recall=26.6%

### Key Issues

1. **False Positives** (30% of inferred relations wrong)
   - Semantically similar objects from different projects

2. **False Negatives** (73% of GT relations missed)
   - Operationally related but semantically dissimilar
   - Example: "Implement OAuth2" vs "Login button not working"

---

## Experiment Plan

### Stage 1: Threshold Tuning (Quick Win)

**Goal**: Find optimal threshold without code changes
**Time**: 1 hour
**Effort**: Low

#### Tasks

1. Create 4 experiment configs:
   - `threshold-0.30.yaml`
   - `threshold-0.31.yaml`
   - `threshold-0.32.yaml`
   - `threshold-0.33.yaml`

2. Run all experiments in parallel

3. Analyze results:
   - Plot F1 vs threshold
   - Plot Precision/Recall tradeoff
   - Identify optimal threshold

#### Expected Outcomes

- **Hypothesis**: Lower threshold (0.30-0.32) may improve recall
- **Expected F1**: 30-35% (modest improvement)
- **Deliverable**: Optimal threshold for next stages

#### Success Criteria

- ✅ All 4 experiments complete
- ✅ F1 improvement > 0% (any improvement counts)
- ✅ Optimal threshold identified

---

### Stage 2: Project Metadata Similarity

**Goal**: Add project metadata as explicit signal
**Time**: 2-3 hours
**Effort**: Medium

#### Background

Current data includes:

- `metadata.project_name`: "User Authentication System Overhaul"
- `metadata.project_description`: "Replace legacy auth with modern OAuth2 + 2FA"

These are strong signals for operational relationships.

#### Implementation Plan

**Step 1: Add project similarity function**

Location: `packages/pipeline/src/stages/relation-inference/similarity.ts`

```typescript
export function calculateProjectSimilarity(
  meta1: { project_name?: string; project_description?: string },
  meta2: { project_name?: string; project_description?: string }
): number {
  // Exact match = 1.0
  if (meta1.project_name && meta2.project_name) {
    if (meta1.project_name === meta2.project_name) {
      return 1.0;
    }
  }

  // No project metadata = 0.0
  if (!meta1.project_name || !meta2.project_name) {
    return 0.0;
  }

  // Fuzzy match using string similarity
  return stringSimilarity(meta1.project_name, meta2.project_name);
}

function stringSimilarity(str1: string, str2: string): number {
  // Simple implementation: normalized Levenshtein distance
  // Or use library like 'string-similarity'
  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;

  if (longer.length === 0) return 1.0;

  const editDistance = levenshteinDistance(longer, shorter);
  return (longer.length - editDistance) / longer.length;
}
```

**Step 2: Modify RelationInferrer**

Location: `packages/pipeline/src/stages/relation-inference/inferrer.ts`

```typescript
// Current formula
const score = semanticWeight * semanticSim + (1 - semanticWeight) * keywordSim;

// New formula
const projectSim = calculateProjectSimilarity(obj1.metadata, obj2.metadata);
const projectWeight = 0.3; // Tunable parameter
const score =
  semanticWeight * semanticSim +
  (1 - semanticWeight - projectWeight) * keywordSim +
  projectWeight * projectSim;
```

**Step 3: Add config parameters**

```yaml
relationInference:
  similarityThreshold: 0.35
  semanticWeight: 0.5 # Reduced from 0.7
  keywordWeight: 0.2 # Explicit
  projectWeight: 0.3 # New signal
  useProjectMetadata: true
```

#### Expected Outcomes

- **Expected F1**: 35-40%
- **Reason**: Project metadata is strong signal for our synthetic data
- **Side effect**: May reduce false positives from different projects

#### Success Criteria

- ✅ Project similarity function implemented
- ✅ Config parameters added
- ✅ Experiment run successfully
- ✅ F1 improvement ≥ 5% over baseline

---

### Stage 3: Actor Overlap

**Goal**: Add actor overlap as signal
**Time**: 2-3 hours
**Effort**: Medium

#### Background

Current data includes:

- `actors.created_by`: email of creator
- `actors.assignees`: list of assignee emails
- `actors.participants`: (Slack only) list of participants

Hypothesis: Items with shared actors are likely related.

#### Implementation Plan

**Step 1: Add actor overlap function**

```typescript
export function calculateActorOverlap(
  actors1: { created_by?: string; assignees?: string[]; participants?: string[] },
  actors2: { created_by?: string; assignees?: string[]; participants?: string[] }
): number {
  // Collect all actors
  const actorSet1 = new Set<string>();
  if (actors1.created_by) actorSet1.add(actors1.created_by);
  if (actors1.assignees) actors1.assignees.forEach((a) => actorSet1.add(a));
  if (actors1.participants) actors1.participants.forEach((a) => actorSet1.add(a));

  const actorSet2 = new Set<string>();
  if (actors2.created_by) actorSet2.add(actors2.created_by);
  if (actors2.assignees) actors2.assignees.forEach((a) => actorSet2.add(a));
  if (actors2.participants) actors2.participants.forEach((a) => actorSet2.add(a));

  // Jaccard similarity
  const intersection = [...actorSet1].filter((a) => actorSet2.has(a)).length;
  const union = new Set([...actorSet1, ...actorSet2]).size;

  return union > 0 ? intersection / union : 0.0;
}
```

**Step 2: Update scoring formula**

```typescript
const projectSim = calculateProjectSimilarity(obj1.metadata, obj2.metadata);
const actorOverlap = calculateActorOverlap(obj1.actors, obj2.actors);

const score = w1 * semanticSim + w2 * keywordSim + w3 * projectSim + w4 * actorOverlap;
```

**Step 3: Add config**

```yaml
relationInference:
  semanticWeight: 0.4
  keywordWeight: 0.15
  projectWeight: 0.3
  actorWeight: 0.15
  useActorOverlap: true
```

#### Expected Outcomes

- **Expected F1**: 40-45%
- **Reason**: Actor overlap adds another dimension beyond semantic similarity

#### Success Criteria

- ✅ Actor overlap function implemented
- ✅ F1 improvement ≥ 5% over Stage 2

---

### Stage 4: Temporal Proximity

**Goal**: Add temporal proximity as signal
**Time**: 2-3 hours
**Effort**: Medium

#### Background

Current data includes:

- `timestamps.created_at`
- `timestamps.updated_at`

Hypothesis: Items created/updated around the same time are likely related.

#### Implementation Plan

**Step 1: Add temporal proximity function**

```typescript
export function calculateTemporalProximity(
  ts1: { created_at: string; updated_at?: string },
  ts2: { created_at: string; updated_at?: string }
): number {
  const time1 = new Date(ts1.created_at).getTime();
  const time2 = new Date(ts2.created_at).getTime();

  const diffMs = Math.abs(time1 - time2);
  const diffDays = diffMs / (1000 * 60 * 60 * 24);

  // Exponential decay: same day = 1.0, 7 days = 0.37, 30 days = 0.02
  const decayRate = 7; // days
  return Math.exp(-diffDays / decayRate);
}
```

**Step 2: Update scoring formula**

```typescript
const temporalProx = calculateTemporalProximity(obj1.timestamps, obj2.timestamps);

const score =
  w1 * semanticSim + w2 * keywordSim + w3 * projectSim + w4 * actorOverlap + w5 * temporalProx;
```

**Step 3: Add config**

```yaml
relationInference:
  semanticWeight: 0.35
  keywordWeight: 0.15
  projectWeight: 0.3
  actorWeight: 0.1
  temporalWeight: 0.1
  temporalDecayDays: 7
  useTemporalProximity: true
```

#### Expected Outcomes

- **Expected F1**: 45-50%
- **Reason**: Temporal signal helps identify items from same work phase

#### Success Criteria

- ✅ Temporal proximity function implemented
- ✅ F1 improvement ≥ 5% over Stage 3
- ✅ **Target F1 50% achieved**

---

### Stage 5: Weight Optimization (Grid Search)

**Goal**: Find optimal weight combination
**Time**: 3-4 hours (mostly compute time)
**Effort**: Medium-High

#### Background

After implementing all 5 signals (semantic, keyword, project, actor, temporal), we need to find the optimal weight combination.

Current: Manual tuning based on intuition
Proposed: Systematic grid search

#### Implementation Plan

**Step 1: Create grid search script**

```typescript
// scripts/optimize-weights.ts

const weightCombinations = [
  // semantic, keyword, project, actor, temporal
  [0.4, 0.1, 0.3, 0.15, 0.05],
  [0.3, 0.1, 0.4, 0.15, 0.05],
  [0.35, 0.15, 0.3, 0.1, 0.1],
  [0.25, 0.15, 0.4, 0.15, 0.05],
  // ... more combinations
];

for (const weights of weightCombinations) {
  // Create experiment config
  // Run experiment
  // Record F1 score
}

// Report best combination
```

**Step 2: Run grid search**

- Generate ~20-30 weight combinations
- Run all experiments
- Compare F1 scores
- Select best performing combination

**Step 3: Validate best weights**

- Run 3 times with different random seeds (if applicable)
- Ensure results are stable
- Document final weight configuration

#### Expected Outcomes

- **Expected F1**: 48-52% (fine-tuning of Stage 4 results)
- **Deliverable**: Production-ready weight configuration

#### Success Criteria

- ✅ Grid search completes successfully
- ✅ Best weights identified and validated
- ✅ F1 ≥ 50% achieved
- ✅ Results documented

---

## Timeline

### Week 1 (Nov 27 - Dec 3)

- **Day 1 (Today)**: Stage 1 - Threshold tuning
- **Day 2**: Stage 2 - Project metadata
- **Day 3**: Stage 3 - Actor overlap
- **Day 4**: Testing and validation
- **Day 5**: Documentation

### Week 2 (Dec 4 - Dec 10)

- **Day 1-2**: Stage 4 - Temporal proximity
- **Day 3-4**: Stage 5 - Weight optimization
- **Day 5**: Final validation and documentation

**Total duration**: ~10 days
**Target completion**: December 10, 2025

---

## Success Metrics

### Primary Metric

- **F1 Score**: 28.3% → 50%+ (77% improvement)

### Secondary Metrics

- **Precision**: Maintain ≥ 25% (avoid too many false positives)
- **Recall**: Improve to 40-50% (find more GT relations)
- **Inference time**: Should not increase > 2x

### Validation Criteria

1. ✅ F1 ≥ 50% on project-based test set
2. ✅ No single signal dominates (balanced fusion)
3. ✅ Results stable across multiple runs
4. ✅ Computational cost acceptable for production

---

## Risk Mitigation

### Risk 1: Overfitting to synthetic data

**Mitigation**:

- Keep weights interpretable and reasonable
- Test on different project configurations
- Plan for validation on real data (EXP-007)

### Risk 2: Computational overhead

**Mitigation**:

- Profile each signal computation
- Optimize hot paths
- Consider caching actor/temporal computations

### Risk 3: Signal conflicts

**Mitigation**:

- Monitor individual signal distributions
- Check for negative correlations
- Adjust weights if conflicts detected

### Risk 4: Diminishing returns

**Mitigation**:

- Set minimum improvement threshold (5% F1 per stage)
- Stop early if improvements plateau
- Move to next experiment series if stuck

---

## Deliverables

### Code

1. ✅ `similarity.ts` - All similarity functions
2. ✅ `inferrer.ts` - Updated relation inferrer with multi-signal fusion
3. ✅ `scripts/optimize-weights.ts` - Grid search script
4. ✅ Config files for all experiments

### Documentation

1. ✅ This experiment plan (EXP-006)
2. ✅ Results summary after completion
3. ✅ Weight optimization analysis
4. ✅ Recommendations for EXP-007

### Experiments

1. ✅ Stage 1: 4 threshold experiments
2. ✅ Stage 2: 1 project metadata experiment
3. ✅ Stage 3: 1 actor overlap experiment
4. ✅ Stage 4: 1 temporal proximity experiment
5. ✅ Stage 5: 20-30 weight optimization experiments

**Total experiments**: ~30-40

---

## Next Steps (EXP-007)

After achieving F1 50%+, consider:

1. **Schema-based relation extraction** (medium-term goal)
   - Extract explicit relations (parent-child, cross-references)
   - Combine with semantic relations

2. **Graph-based inference** (medium-term goal)
   - Transitive closure
   - Community detection

3. **Real data validation** (critical)
   - Test on actual customer data
   - Validate against Jira dataset ground truth
   - Measure production performance

---

## References

- **EXP-004**: Relation inference optimization (F1 1.9%)
- **EXP-005**: Project-based data generation (F1 28.3%)
- **MSR 2022 Jira Dataset**: 270M issues, 1M links for future validation

---

## Appendix: Formula Evolution

### Baseline (EXP-005)

```
score = 0.7 * semantic + 0.3 * keyword
threshold = 0.35
```

### After Stage 2

```
score = 0.5 * semantic + 0.2 * keyword + 0.3 * project
threshold = 0.35 (optimal from Stage 1)
```

### After Stage 3

```
score = 0.4 * semantic + 0.15 * keyword + 0.3 * project + 0.15 * actor
threshold = 0.35
```

### After Stage 4

```
score = 0.35 * semantic + 0.15 * keyword + 0.3 * project + 0.1 * actor + 0.1 * temporal
threshold = 0.35
```

### After Stage 5 (optimized)

```
score = w1 * semantic + w2 * keyword + w3 * project + w4 * actor + w5 * temporal
where w1 + w2 + w3 + w4 + w5 = 1.0
(optimal weights TBD from grid search)
```
