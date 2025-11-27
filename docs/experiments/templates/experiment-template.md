# [EXPERIMENT_ID]: [Title]

```yaml
# Experiment Metadata
experiment_id: [EXP-XXX-STAGE-X or EXP-XXX]
title: 'Concise experiment title'
date: YYYY-MM-DD
author: 'Your Name'
status: completed | draft | running | failed | rejected
type: results | plan | research

# Performance Metrics (for completed experiments)
baseline_f1: 0.00 # Previous best F1
result_f1: 0.00 # Achieved F1
precision: 0.00
recall: 0.00

# Related Resources
related_experiments: ['EXP-XXX']
config_file: 'config/experiments/xxx.yaml'
related_papers: ['001-paper-name']

# Tags
tags: ['tag1', 'tag2', 'tag3']

# Decision (for research/rejected experiments)
decision: approved | rejected | pending
rejection_reason: 'Why this approach was not pursued'
```

---

## 📋 Overview

**실험 목적 (Objective)**:

- What problem are you solving?
- What is the hypothesis?

**이전 상태 (Previous State)**:

- Baseline F1: X.X%
- Key issues

**목표 (Target)**:

- Target F1: X.X%+
- Expected improvement

---

## 🔬 Methodology

### Approach

- What changes are being made?
- Why this approach?

### Implementation

```yaml
# Key configuration changes
parameter: value
```

**Files Modified**:

- `path/to/file.ts` - Description of changes

---

## 📊 Results

### Metrics Summary

| Metric    | Baseline | Result   | Δ         |
| --------- | -------- | -------- | --------- |
| F1 Score  | X.X%     | **X.X%** | **+X.X%** |
| Precision | X.X%     | X.X%     | +X.X%     |
| Recall    | X.X%     | X.X%     | +X.X%     |

### Key Findings

1. **Finding 1**: Description
2. **Finding 2**: Description

---

## 🔍 Analysis

### What Worked

- Success factor 1
- Success factor 2

### What Didn't Work

- Issue 1
- Issue 2

### Error Analysis

**False Positives** (X% of inferred):

- Root cause
- Examples

**False Negatives** (X% missed):

- Root cause
- Examples

---

## 💡 Lessons Learned

### Technical Insights

1. Insight 1
2. Insight 2

### Recommendations

1. Recommendation 1
2. Recommendation 2

---

## 📋 Next Steps

- [ ] Action item 1
- [ ] Action item 2
- [ ] Action item 3

---

## 🔗 Related Documents

- [Related Experiment 1](./path-to-doc.md)
- [Related Paper](../research/papers/xxx.md)

---

## 💾 Reproduce Experiment

```bash
# Run the experiment
npm run experiment -- --config config/experiments/xxx.yaml

# Expected results:
# F1: X.X%
# Precision: X.X%
# Recall: X.X%
```
