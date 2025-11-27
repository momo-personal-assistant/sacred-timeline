# Experiment Documentation

## 📁 Folder Structure

```
docs/experiments/
├── completed/          # Completed experiments with results
│   ├── EXP-005-project-based-data.md
│   ├── EXP-006-stage-1-results.md
│   └── EXP-006-stage-2-results.md
├── plans/              # Experiment plans (in progress or future)
│   └── EXP-006-multi-signal-fusion-plan.md
├── rejected/           # Experiments that were rejected or failed
│   └── EXP-004-relation-inference-optimization.md
└── templates/          # Templates for new experiments
    └── experiment-template.md
```

---

## 📝 Document Format

All experiment documents follow a unified YAML frontmatter format:

### Standard Frontmatter

````yaml
```yaml
# Experiment Metadata
experiment_id: EXP-XXX-STAGE-X
title: "Clear experiment title"
date: YYYY-MM-DD
author: "Your Name"
status: completed | draft | running | failed | rejected
type: results | plan | research

# Performance Metrics (for completed experiments)
baseline_f1: 0.00
result_f1: 0.00
precision: 0.00
recall: 0.00

# Related Resources
related_experiments: ['EXP-XXX']
config_file: 'config/experiments/xxx.yaml'
related_papers: ['001-paper-name']

# Tags
tags: ['tag1', 'tag2', 'tag3']

# Decision
decision: approved | rejected | pending
rejection_reason: "Optional: Why this was rejected"
````

````

---

## 🎯 Experiment Lifecycle

### 1. Planning Phase
- Create experiment plan in `plans/` folder
- Set `status: draft` or `status: running`
- Set `type: plan`
- Define hypothesis, methodology, expected outcomes

### 2. Execution Phase
- Run experiments using config files
- Results automatically saved to database
- Document interim findings

### 3. Completion Phase
- Create results document in `completed/` folder
- Set `status: completed`
- Set `type: results`
- Include metrics, analysis, lessons learned

### 4. Rejection (if applicable)
- Move to `rejected/` folder
- Set `status: rejected` or `status: failed`
- Add `rejection_reason` explaining why
- Document learnings for future reference

---

## 📊 Current Experiments

### Completed ✅

| ID | Title | F1 Score | Status |
|----|-------|----------|--------|
| **EXP-006-STAGE-2** | Project Metadata Signal | **86.1%** | ✅ Best result |
| **EXP-006-STAGE-1** | Threshold Tuning | 43.6% | ✅ Completed |
| **EXP-005** | Project-Based Data Generation | 28.3% | ✅ Baseline |

### In Progress 🔄

| ID | Title | Status |
|----|-------|--------|
| **EXP-006** | Multi-Signal Fusion Plan | Running (Stage 2 complete) |

### Rejected ❌

| ID | Title | F1 Score | Reason |
|----|-------|----------|--------|
| **EXP-004** | Hybrid Strategy | 1.9% | Data quality issues |

---

## 🚀 Quick Start

### Creating a New Experiment

1. **Copy the template**:
   ```bash
   cp docs/experiments/templates/experiment-template.md \
      docs/experiments/plans/EXP-XXX-my-experiment.md
````

2. **Fill in the frontmatter**:
   - Set unique `experiment_id`
   - Write clear `title`
   - Set appropriate `status` and `type`
   - Add relevant `tags`

3. **Write your plan**:
   - Define objective and hypothesis
   - Describe methodology
   - List expected outcomes

4. **Create config file**:

   ```bash
   cp config/experiments/threshold-0.30.yaml \
      config/experiments/my-experiment.yaml
   ```

5. **Run the experiment**:

   ```bash
   npm run experiment -- --config config/experiments/my-experiment.yaml
   ```

6. **Document results**:
   - Move plan to `completed/` or `rejected/`
   - Update frontmatter with actual results
   - Add analysis and lessons learned

---

## 📈 Metrics Evolution

### Progress Timeline

```
EXP-004: 1.9% F1 (baseline)
   ↓
EXP-005: 28.3% F1 (+1400% improvement)
   ↓
EXP-006 Stage 1: 43.6% F1 (+54% improvement)
   ↓
EXP-006 Stage 2: 86.1% F1 (+97% improvement)
```

**Total improvement**: 1.9% → 86.1% = **45x improvement**

---

## 🔧 Migration Guide

If you have old experiment documents without YAML frontmatter:

1. **Add frontmatter**:
   - Use the template in `templates/experiment-template.md`
   - Extract metadata from document content
   - Ensure all required fields are filled

2. **Move to appropriate folder**:

   ```bash
   # Completed experiments
   mv your-doc.md docs/experiments/completed/

   # Plans or in-progress
   mv your-plan.md docs/experiments/plans/

   # Rejected or failed
   mv your-failed-exp.md docs/experiments/rejected/
   ```

3. **Update links**:
   - Fix any relative links in the document
   - Update references in other documents

---

## 🎨 Tagging System

Use consistent tags for easy filtering:

### Signal Types

- `multi-signal-fusion`
- `project-metadata`
- `semantic-similarity`
- `keyword-overlap`
- `actor-overlap`
- `temporal-proximity`

### Methods

- `threshold-tuning`
- `ground-truth`
- `synthetic-data`
- `project-based-data`

### Components

- `relation-inference`
- `embedding`
- `retrieval`
- `chunking`

### Series

- `exp-004`
- `exp-005`
- `exp-006`

---

## 📖 Best Practices

### DO ✅

- Write clear, concise titles
- Include baseline and result metrics
- Document what worked AND what didn't
- Link to related experiments
- Use consistent tag naming
- Keep documents focused and scannable

### DON'T ❌

- Create documents without frontmatter
- Mix different experiment types in one document
- Forget to update status when completing
- Leave broken links
- Use vague or misleading titles

---

## 🔗 Related Documentation

- [Experiment Configuration Guide](../../config/experiments/README.md)
- [Pipeline Documentation](../../packages/pipeline/README.md)
- [Relation Inference Design](../research/relation-inference.md)

---

## 💡 Tips

1. **Be concise**: Focus on key insights, not exhaustive details
2. **Use tables**: Make metrics easy to compare
3. **Include code**: Show actual implementation snippets
4. **Link everything**: Connect related experiments and resources
5. **Update regularly**: Keep status and results current
6. **Learn from failures**: Rejected experiments are valuable too

---

**Last Updated**: 2025-11-27
**Maintained By**: Research Team
