# Configuration-Driven Experiment System

This directory contains YAML configuration files for running RAG experiments without modifying code.

## Quick Start

### Run baseline experiment

```bash
pnpm run experiment
```

This uses `config/default.yaml` (current production settings).

### Run with a template

```bash
# Try different chunk sizes
pnpm run experiment config/templates/chunking.yaml

# Try different embedding models
pnpm run experiment config/templates/embedding.yaml

# Tune retrieval parameters
pnpm run experiment config/templates/retrieval.yaml

# Enable hybrid search
pnpm run experiment config/templates/hybrid.yaml
```

### Run a saved experiment

```bash
pnpm run experiment config/experiments/2025-11-24-chunking-001.yaml
```

## Directory Structure

```
config/
├── default.yaml              # Baseline configuration (production settings)
├── templates/                # Starting points for experiments
│   ├── chunking.yaml         # Chunk size/overlap experiments
│   ├── embedding.yaml        # Embedding model experiments
│   ├── retrieval.yaml        # Retrieval parameter experiments
│   └── hybrid.yaml           # Hybrid search experiments
└── experiments/              # Your saved experiments
    ├── 2025-11-24-chunking-001.yaml
    ├── 2025-11-24-hybrid-002.yaml
    └── ...
```

## Configuration File Structure

Every config file has this structure:

```yaml
name: 'experiment-name'
description: "What you're testing"

# Embedding Configuration
embedding:
  model: 'text-embedding-3-small' # or text-embedding-3-large
  dimensions: 1536 # 1536 or 3072
  batchSize: 100

# Chunking Configuration
chunking:
  strategy: 'semantic' # fixed-size | semantic | relational
  maxChunkSize: 500 # characters per chunk
  overlap: 50 # character overlap
  preserveMetadata: true

# Retrieval Configuration
retrieval:
  similarityThreshold: 0.35 # 0-1 (higher = more strict)
  chunkLimit: 20 # max chunks to retrieve
  includeRelations: true # enable graph expansion
  relationDepth: 1 # graph traversal depth

# Relation Inference Configuration
relationInference:
  similarityThreshold: 0.85 # semantic similarity threshold
  keywordOverlapThreshold: 0.65 # keyword Jaccard threshold
  includeInferred: true # compute relations (vs explicit only)
  useSemanticSimilarity: false # enable hybrid approach
  semanticWeight: 0.7 # 0-1 (semantic vs keyword weight)

# Validation Configuration
validation:
  runOnSave: true # auto-validate after embedding
  autoSaveExperiment: false # auto-save to experiments table
  scenarios: # validation scenarios
    - 'normal'
    - 'sales_heavy'
    - 'dev_heavy'

# Metadata
metadata:
  baseline: false # mark as baseline
  git_commit: null # auto-populated
  paper_ids: [] # link to research papers
```

## Typical Workflow

### 1. Start with a template

```bash
# Copy template
cp config/templates/chunking.yaml config/experiments/exp-001.yaml
```

### 2. Modify parameters

```yaml
# Edit exp-001.yaml
chunking:
  maxChunkSize: 768 # Changed from 500
  overlap: 75 # Changed from 50
```

### 3. Run experiment

```bash
pnpm run experiment config/experiments/exp-001.yaml
```

### 4. Review results

Check the terminal output:

```
╔════════════════════════════════════════════════════════════╗
║                    Experiment Complete                     ║
╚════════════════════════════════════════════════════════════╝

📊 Results:
   F1 Score: 68.2%      ← Up from 65.9%!
   Precision: 59.1%
   Recall: 80.3%

⏱️  Duration: 45.2s
```

### 5. Save good experiments

If F1 improved, enable auto-save:

```yaml
validation:
  autoSaveExperiment: true # Changed from false
```

Re-run to save to database:

```bash
pnpm run experiment config/experiments/exp-001.yaml
```

### 6. Compare in UI

Open `http://localhost:3000` → Experiments tab to compare all experiments.

### 7. Promote to production

If experiment is best:

```bash
# Backup current baseline
cp config/default.yaml config/experiments/2025-11-24-baseline-backup.yaml

# Promote experiment to baseline
cp config/experiments/exp-001.yaml config/default.yaml

# Update metadata
vim config/default.yaml
# Set: metadata.baseline = true

# Commit
git add config/
git commit -m "Promote exp-001 to baseline: F1 65.9% → 68.2%"
```

## Parameter Tuning Guide

### Chunking

| Parameter    | Effect                                | Recommendation                |
| ------------ | ------------------------------------- | ----------------------------- |
| maxChunkSize | Larger = more context, fewer chunks   | Start: 500, Try: 256-1024     |
| overlap      | Higher = better continuity, redundant | Start: 50, Try: 25-100        |
| strategy     | Affects boundary detection            | semantic > fixed-size usually |

### Embedding

| Model                  | Dimensions | Cost (per 1M tokens) | Quality |
| ---------------------- | ---------- | -------------------- | ------- |
| text-embedding-3-small | 1536       | $0.02                | Good    |
| text-embedding-3-large | 3072       | $0.13                | Better  |

### Retrieval

| Parameter           | Effect                               | Recommendation              |
| ------------------- | ------------------------------------ | --------------------------- |
| similarityThreshold | Higher = more precision, less recall | Start: 0.35, Try: 0.25-0.55 |
| chunkLimit          | Higher = more context, slower        | Start: 20, Try: 10-50       |
| relationDepth       | Higher = more graph expansion        | Start: 1, Try: 0-3          |

### Relation Inference

| Parameter               | Effect                              | Recommendation                   |
| ----------------------- | ----------------------------------- | -------------------------------- |
| keywordOverlapThreshold | Higher = stricter keyword matching  | Start: 0.65, Try: 0.5-0.8        |
| useSemanticSimilarity   | Enable hybrid semantic + keyword    | Try: true (Anthropic recommends) |
| semanticWeight          | 0 = keyword only, 1 = semantic only | Start: 0.7, Try: 0.5-0.9         |

## Common Experiments

### Experiment 1: Increase Chunk Size

**Hypothesis**: Larger chunks provide more context, improving recall.

```yaml
chunking:
  maxChunkSize: 768 # from 500
  overlap: 75 # from 50
```

**Expected**: Higher recall, possibly lower precision.

### Experiment 2: Enable Hybrid Search

**Hypothesis**: Combining semantic + keyword catches both types of matches.

```yaml
relationInference:
  useSemanticSimilarity: true # from false
  semanticWeight: 0.7
```

**Expected**: +5-8% F1 (based on Anthropic research).

### Experiment 3: Stricter Retrieval

**Hypothesis**: Higher threshold reduces false positives.

```yaml
retrieval:
  similarityThreshold: 0.45 # from 0.35
```

**Expected**: Higher precision, possibly lower recall.

### Experiment 4: Larger Embedding Model

**Hypothesis**: Better embeddings improve all metrics.

```yaml
embedding:
  model: 'text-embedding-3-large'
  dimensions: 3072
```

**Expected**: +2-5% F1, 5x higher cost.

## Linking to Research Papers

If implementing a technique from a paper:

```yaml
metadata:
  paper_ids: ['001'] # Links to docs/research/papers/001-*.md
```

This creates a link in the database between your experiment and the paper.

## Best Practices

### Naming Convention

```
config/experiments/YYYY-MM-DD-description-NNN.yaml

Examples:
- 2025-11-24-chunking-512-001.yaml
- 2025-11-24-hybrid-search-002.yaml
- 2025-11-25-contextual-retrieval-003.yaml
```

### Iterative Improvement

```
Week 1: Baseline (F1 65.9%)
Week 2: Chunk size experiments → 68.2% (exp-001)
Week 3: Hybrid search → 72.5% (exp-005)
Week 4: Large embeddings → 75.8% (exp-009)
```

### Git Workflow

```bash
# Before experiment
git add config/experiments/exp-001.yaml
git commit -m "Add chunking experiment"

# After successful experiment
git add config/experiments/exp-001.yaml  # Updated with results
git commit -m "Exp-001 results: F1 68.2%"

# If promoting to baseline
cp config/experiments/exp-001.yaml config/default.yaml
git commit -m "Promote exp-001 to baseline: F1 65.9% → 68.2%"
```

### Safety

- **Always test before promoting**: Run experiments in `experiments/`, not `default.yaml`
- **Keep backups**: Save old baseline before overwriting
- **Commit often**: Track every experiment in git
- **Review first**: Check results before enabling `autoSaveExperiment: true`

## Troubleshooting

### Error: Config file not found

```bash
# Ensure path is relative to project root
pnpm run experiment config/experiments/exp-001.yaml

# NOT:
pnpm run experiment experiments/exp-001.yaml
```

### Error: OPENAI_API_KEY not set

```bash
# Check .env file
cat .env | grep OPENAI_API_KEY

# If missing, add:
echo "OPENAI_API_KEY=sk-..." >> .env
```

### Experiment saved but not showing in UI

- Restart demo app: `cd apps/demo && pnpm dev`
- Check database: `psql -d unified_memory -c "SELECT * FROM experiments ORDER BY id DESC LIMIT 1;"`

### F1 score didn't change

- Check if you modified the right parameters
- Some changes have subtle effects
- Try more extreme values (e.g., chunk size 256 vs 1024)

## Advanced: Parameter Sweeps (Future)

Coming soon: Automatically run multiple experiments:

```yaml
# config/sweeps/chunking-sweep.yaml
sweep:
  chunking.maxChunkSize: [256, 512, 768, 1024]
  chunking.overlap: [25, 50, 75, 100]

# Will run 4 x 4 = 16 experiments
pnpm run sweep config/sweeps/chunking-sweep.yaml
```

## Need Help?

- Read `/docs/EXPERIMENT_SYSTEM.md` for system architecture
- Check `/docs/research/papers/USAGE.md` for paper analysis workflow
- View existing experiments: `ls -la config/experiments/`
- Check templates: `cat config/templates/chunking.yaml`
