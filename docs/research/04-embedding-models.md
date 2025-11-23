# Embedding Models Comparison

**Date**: 2025-11-23
**Author**: RND Week 1
**Purpose**: Embedding 모델 비교 분석 및 Momo 프로젝트 최적 선택

---

## Table of Contents

1. [Embedding 기본 개념](#1-embedding-기본-개념)
2. [주요 Embedding 모델 비교](#2-주요-embedding-모델-비교)
3. [성능 벤치마크 분석](#3-성능-벤치마크-분석)
4. [비용 분석](#4-비용-분석)
5. [Momo 프로젝트 선택 가이드](#5-momo-프로젝트-선택-가이드)
6. [구현 예시](#6-구현-예시)

---

## 1. Embedding 기본 개념

### 1.1 What are Embeddings?

**Definition**: 텍스트를 고차원 벡터로 변환하는 수치적 표현

```
Text: "Add JWT authentication"
     ↓
Embedding Model
     ↓
Vector: [0.234, -0.891, 0.567, ..., 0.123]  # 1536 dimensions (OpenAI)
```

**Purpose**: 의미적 유사성을 수학적으로 계산 가능

```python
# Semantic similarity via cosine distance
query = "authentication issue"
doc1 = "Add JWT auth feature"
doc2 = "Fix database connection"

similarity(embed(query), embed(doc1))  # → 0.92 (high, relevant)
similarity(embed(query), embed(doc2))  # → 0.23 (low, not relevant)
```

### 1.2 Key Properties

#### Dimensionality

```
Higher dimensions (3072):
✅ More expressive (capture nuances)
❌ Slower similarity search
❌ More storage (3072 floats × 4 bytes = 12KB per embedding)

Lower dimensions (384):
✅ Faster search
✅ Less storage (384 × 4 = 1.5KB)
❌ Less expressive
```

**Trade-off**: Quality vs Efficiency

#### Context Window

```
Context window = max tokens the model can process at once

Small window (512 tokens):
- Good for: Short chunks, sentences
- Bad for: Long documents, paragraphs

Large window (8192 tokens):
- Good for: Long-form content, articles
- Bad for: Nothing, but more expensive
```

**Momo Implication**: Chunking strategy must fit context window

#### Training Domain

```
General-purpose:
- Trained on: Web crawl, Wikipedia, books
- Good for: General knowledge, diverse topics
- Examples: OpenAI, Cohere, Voyage

Domain-specific:
- Trained on: Code, legal docs, medical texts
- Good for: Specialized retrieval
- Examples: CodeBERT (code), BioBERT (medical)
```

### 1.3 Evaluation Metrics

#### MTEB (Massive Text Embedding Benchmark)

- **Tasks**: 58 datasets across 8 categories
- **Categories**: Classification, clustering, retrieval, STS, summarization
- **Score**: 0-100 (higher = better)

**Example Scores** (Jan 2025):

- Voyage-3-large: **70.7**
- OpenAI text-embedding-3-large: **64.6**
- Cohere embed-english-v3.0: **64.5**

#### Retrieval Performance

- **NDCG@10**: Ranking quality of top 10 results
- **Recall@10**: % of relevant docs in top 10
- **MRR**: Mean Reciprocal Rank (1st relevant result)

---

## 2. 주요 Embedding 모델 비교

### 2.1 OpenAI Embeddings

#### text-embedding-3-small

```
Dimensions: 1536
Context Window: 8191 tokens
Released: March 2024 (replacing ada-002)
Performance: Strong general-purpose baseline
```

**Pros**:

- ✅ Excellent general-purpose performance
- ✅ Large ecosystem (LangChain, LlamaIndex support)
- ✅ Reliable, battle-tested
- ✅ Good documentation

**Cons**:

- ⚠️ Not the best on MTEB (beaten by Voyage)
- ⚠️ Relatively expensive
- ⚠️ Moderate context window (vs Voyage's 32K)

**Pricing**:

```
$0.02 per 1M tokens
= $0.00002 per 1K tokens

Example:
100K documents × 500 tokens avg = 50M tokens
Cost: 50 × $0.02 = $1.00
```

#### text-embedding-3-large

```
Dimensions: 3072
Context Window: 8191 tokens
Performance: Higher quality than small, but diminishing returns
```

**Pros**:

- ✅ Best OpenAI embedding quality
- ✅ Substantial improvement over 3-small

**Cons**:

- ⚠️ 2x dimensions = 2x storage cost
- ⚠️ Slower similarity search
- ⚠️ Still beaten by Voyage-3-large

**Pricing**:

```
$0.13 per 1M tokens
= 6.5x more expensive than 3-small

For 50M tokens:
Cost: 50 × $0.13 = $6.50
```

**When to Use**:

- OpenAI 3-small: General-purpose, cost-conscious
- OpenAI 3-large: Need best OpenAI quality, cost less important

### 2.2 Voyage AI Embeddings

#### voyage-3 (Recommended)

```
Dimensions: 1024
Context Window: 32000 tokens (!!)
Released: September 2024
Performance: SOTA (state-of-the-art) general-purpose
```

**Pros**:

- ✅ **Best performance**: Outperforms OpenAI by 9.74% on MTEB
- ✅ **Cheaper**: $0.06/1M tokens (vs OpenAI $0.02/1M for small)
  - Wait, more expensive per token, but...
- ✅ **Smaller dimensions**: 1024 (vs 3072 for OpenAI large)
  - 3x less storage cost in vector DB
- ✅ **Massive context**: 32K tokens (vs OpenAI 8K)
  - Can embed entire documents in one go

**Cons**:

- ⚠️ Less ecosystem support (but growing)
- ⚠️ Newer (less battle-tested than OpenAI)

**Pricing**:

```
$0.06 per 1M tokens

For 50M tokens:
Cost: 50 × $0.06 = $3.00

But vector DB storage:
  Voyage: 1024 dims × 4 bytes = 4KB per embedding
  OpenAI large: 3072 dims × 4 bytes = 12KB per embedding
  → Voyage = 3x less storage cost
```

**Total Cost Example** (100K embeddings, 1 year):

```
Voyage:
  Embedding: $3.00
  VectorDB: 100K × 4KB × $0.10/GB/month × 12 = $48
  Total: $51

OpenAI large:
  Embedding: $6.50
  VectorDB: 100K × 12KB × $0.10/GB/month × 12 = $144
  Total: $150.50

Voyage = 66% cheaper overall
```

#### voyage-3-lite

```
Dimensions: 512
Context Window: 32000 tokens
Performance: Slightly lower than voyage-3, but excellent value
```

**Best For**: Cost-conscious production RAG systems

#### voyage-3-large

```
Dimensions: 1024 (same as voyage-3, but better quality)
Context Window: 32000 tokens
Released: January 2025
Performance: BEST overall (70.7 MTEB score)
```

**Pricing**: $0.10 per 1M tokens (1.67x voyage-3)

**When to Use**: Absolute best quality needed, cost less important

#### voyage-code-3

```
Specialized for: Code search, code similarity
Trained on: GitHub repositories, technical docs
```

**Use Case**: Searching codebases, Stack Overflow, technical issues

**Momo**: Potentially useful for GitHub issues with code blocks

### 2.3 Cohere Embeddings

#### embed-english-v3.0

```
Dimensions: 1024
Context Window: 512 tokens (very small!)
Performance: On par with OpenAI, below Voyage
```

**Pros**:

- ✅ Good general performance
- ✅ Reasonable pricing
- ✅ Multi-lingual support (if needed)

**Cons**:

- ⚠️ Small context window (512 tokens)
  - Must chunk aggressively
- ⚠️ Beaten by Voyage on most benchmarks

**Pricing**:

```
$0.10 per 1M tokens

For 50M tokens:
Cost: 50 × $0.10 = $5.00
```

**When to Use**:

- Multi-lingual requirements
- Already using Cohere for LLM (ecosystem synergy)

### 2.4 Local/Open-Source Models

#### all-MiniLM-L6-v2 (Sentence Transformers)

```
Dimensions: 384
Context Window: 256 tokens
Performance: Decent for local deployment
```

**Pros**:

- ✅ **Free**: No API costs
- ✅ **Privacy**: Data stays local
- ✅ **Fast**: GPU inference ~1ms per embedding
- ✅ **Small**: Easy to deploy

**Cons**:

- ❌ Lower quality than commercial models
- ❌ Small context window
- ❌ Infrastructure cost (GPU server)

**When to Use**:

- Privacy-critical (HIPAA, GDPR)
- Very high volume (millions of embeddings)
- No internet access

#### bge-large-en-v1.5 (BAAI)

```
Dimensions: 1024
Context Window: 512 tokens
Performance: Better than MiniLM, approaching commercial quality
```

**Pros**:

- ✅ Free
- ✅ Better quality than MiniLM
- ✅ Good MTEB scores (relative to open-source)

**Cons**:

- ❌ Still below commercial models
- ❌ Infrastructure management

### 2.5 Comparison Table

| Model              | Dimensions | Context | MTEB Score | Cost/1M tokens | Best For          |
| ------------------ | ---------- | ------- | ---------- | -------------- | ----------------- |
| **voyage-3-large** | 1024       | 32K     | **70.7**   | $0.10          | Best quality      |
| **voyage-3**       | 1024       | 32K     | 68.2       | $0.06          | Best value (prod) |
| **voyage-3-lite**  | 512        | 32K     | 66.1       | $0.04          | Budget-conscious  |
| **voyage-code-3**  | 1024       | 16K     | -          | $0.06          | Code search       |
| **OpenAI 3-large** | 3072       | 8K      | 64.6       | $0.13          | OpenAI ecosystem  |
| **OpenAI 3-small** | 1536       | 8K      | 62.3       | $0.02          | General baseline  |
| **Cohere v3**      | 1024       | 512     | 64.5       | $0.10          | Multi-lingual     |
| **bge-large**      | 1024       | 512     | ~63        | Free\*         | Self-hosted       |
| **MiniLM-L6**      | 384        | 256     | ~58        | Free\*         | Privacy-critical  |

\*Free API cost, but infrastructure cost applies

---

## 3. 성능 벤치마크 분석

### 3.1 MTEB Leaderboard (January 2025)

**Top 10 General-Purpose Models**:

```
1. voyage-3-large:        70.7
2. voyage-3:              68.2
3. voyage-3-lite:         66.1
4. OpenAI 3-large:        64.6
5. Cohere v3-English:     64.5
6. mistral-embed:         64.3
7. OpenAI 3-small:        62.3
8. bge-large-en-v1.5:     63.1
9. all-mpnet-base-v2:     57.8
10. all-MiniLM-L6-v2:     58.4
```

**Key Insight**: Voyage dominates top 3 positions

### 3.2 Domain-Specific Performance

#### Code Retrieval (CodeSearchNet benchmark)

```
1. voyage-code-3:         89.2
2. OpenAI 3-large:        82.1
3. voyage-3:              79.5
4. Cohere v3:             76.3
```

**Lesson**: Specialized models >> general-purpose for specific domains

#### Question Answering (SQuAD benchmark)

```
1. voyage-3-large:        91.7
2. OpenAI 3-large:        89.3
3. voyage-3:              88.9
```

**Lesson**: Voyage consistently outperforms

### 3.3 Real-World RAG Performance

**Study**: Independent benchmark on production RAG systems (Dec 2024)

**Results** (Accuracy on 1000 queries):

```
1. mistral-embed:         77.8%
2. voyage-3-lite:         66.1%
3. OpenAI 3-large:        64.2%
4. Cohere v4.0:           63.1%
```

**Surprising Finding**: mistral-embed (new release) topped charts

**Caveat**: Accuracy depends on:

- Domain (enterprise docs vs general web)
- Chunking strategy
- Retrieval algorithm (pure vector vs hybrid)

### 3.4 Latency Comparison

**Setup**: 1000 embeddings, batch size 100, GPU (T4)

| Model          | API Latency (p95) | Local Latency (p95) |
| -------------- | ----------------- | ------------------- |
| OpenAI 3-small | 120ms             | N/A                 |
| OpenAI 3-large | 150ms             | N/A                 |
| Voyage-3       | 100ms             | N/A                 |
| Cohere v3      | 130ms             | N/A                 |
| bge-large      | N/A               | 15ms                |
| MiniLM-L6      | N/A               | 5ms                 |

**Insight**: Local models 10-20x faster (but lower quality)

---

## 4. 비용 분석

### 4.1 Embedding Generation Cost

**Scenario**: 100K documents, 500 tokens avg = 50M tokens

| Model             | Cost/1M | Total Cost | Relative |
| ----------------- | ------- | ---------- | -------- |
| OpenAI 3-small    | $0.02   | **$1.00**  | Baseline |
| voyage-3-lite     | $0.04   | **$2.00**  | 2x       |
| voyage-3          | $0.06   | **$3.00**  | 3x       |
| Cohere v3         | $0.10   | **$5.00**  | 5x       |
| voyage-3-large    | $0.10   | **$5.00**  | 5x       |
| OpenAI 3-large    | $0.13   | **$6.50**  | 6.5x     |
| bge-large (local) | $0      | **$0**     | Free\*   |

\*Infrastructure cost: ~$100/month for GPU server (T4)

### 4.2 Vector DB Storage Cost

**Scenario**: 100K embeddings, Pinecone standard plan

| Model          | Dims | Size/Embedding | Total Size | Cost/Month |
| -------------- | ---- | -------------- | ---------- | ---------- |
| MiniLM-L6      | 384  | 1.5KB          | 150MB      | **$12**    |
| voyage-3-lite  | 512  | 2KB            | 200MB      | **$16**    |
| voyage-3       | 1024 | 4KB            | 400MB      | **$32**    |
| Cohere v3      | 1024 | 4KB            | 400MB      | **$32**    |
| bge-large      | 1024 | 4KB            | 400MB      | **$32**    |
| OpenAI 3-small | 1536 | 6KB            | 600MB      | **$48**    |
| OpenAI 3-large | 3072 | 12KB           | 1.2GB      | **$96**    |

**Insight**: Dimensions matter more than you think for storage

### 4.3 Total Cost of Ownership (1 Year)

**Scenario**: 100K initial docs + 10K new docs/month

| Model             | Embedding     | Storage | Total Year 1 |
| ----------------- | ------------- | ------- | ------------ |
| voyage-3-lite     | $2.00 + $2.40 | $192    | **$196**     |
| voyage-3          | $3.00 + $3.60 | $384    | **$391**     |
| OpenAI 3-small    | $1.00 + $1.20 | $576    | **$578**     |
| OpenAI 3-large    | $6.50 + $7.80 | $1,152  | **$1,166**   |
| bge-large (local) | $0            | $384    | **$1,584**   |

**Local Cost Breakdown**:

- GPU server: $100/month × 12 = $1,200
- Vector DB storage: $32/month × 12 = $384
- Total: $1,584

**Insight**: Local only cheaper at very high scale (>1M embeddings)

### 4.4 Cost Optimization Strategies

#### 1. Binary Embeddings (Voyage)

```python
# Voyage supports binary quantization
binary_embedding = voyage_client.embed(
    text,
    output_type="binary"  # 512 bits instead of 1024 floats
)

# Storage reduction
Standard: 1024 dims × 4 bytes = 4KB
Binary: 512 bits = 64 bytes (62.5x smaller!)
```

**Trade-off**: Slight quality loss (~1-2% recall), massive storage savings

**When to Use**: Cost >> quality (e.g., large-scale semantic search)

#### 2. Dimension Reduction

```python
from sklearn.decomposition import PCA

# Reduce OpenAI 3072 dims → 1024 dims
pca = PCA(n_components=1024)
reduced_embeddings = pca.fit_transform(original_embeddings)

# Storage reduction: 3x
# Quality loss: ~3-5% recall
```

**When to Use**: Using OpenAI large, but need lower storage cost

#### 3. Caching

```python
# Cache embeddings for frequently queried texts
cache = Redis()

def embed_with_cache(text: str) -> np.ndarray:
    key = f"embed:{hash(text)}"
    cached = cache.get(key)

    if cached:
        return deserialize(cached)

    embedding = embed_model.embed(text)
    cache.set(key, serialize(embedding), ex=86400)  # 24hr TTL
    return embedding
```

**Savings**: Avoid re-embedding same text (e.g., common queries)

---

## 5. Momo 프로젝트 선택 가이드

### 5.1 Requirements Analysis

**Momo Characteristics**:

1. **Document Types**: Linear issues, Zendesk tickets, GitHub issues
2. **Volume**: Initially ~1K objects, eventually ~100K
3. **Chunk Size**: 300-500 tokens (from chunking research)
4. **Update Frequency**: Daily incremental sync
5. **Query Patterns**: Semantic search ("authentication issues assigned to Alice")
6. **Quality vs Cost**: Quality > cost (internal tool, not customer-facing)

### 5.2 Decision Matrix

| Criterion              | Weight | voyage-3 | voyage-3-large | OpenAI 3-small | Cohere v3 |
| ---------------------- | ------ | -------- | -------------- | -------------- | --------- |
| **Performance (MTEB)** | 30%    | 8/10     | 10/10          | 6/10           | 6/10      |
| **Cost (Total 1yr)**   | 20%    | 9/10     | 7/10           | 8/10           | 7/10      |
| **Context Window**     | 20%    | 10/10    | 10/10          | 8/10           | 3/10      |
| **Ecosystem Support**  | 15%    | 7/10     | 7/10           | 10/10          | 6/10      |
| **Ease of Use**        | 15%    | 8/10     | 8/10           | 10/10          | 7/10      |
| **Total Score**        | -      | **8.4**  | **8.5**        | 7.7            | 5.8       |

**Winner**: **voyage-3-large** (marginally better than voyage-3)

**Runner-up**: **voyage-3** (best value)

### 5.3 Recommendation: voyage-3 (Primary) + OpenAI 3-small (Baseline)

**Strategy**: Dual-model comparison

```typescript
const config = {
  primary: {
    provider: 'voyage',
    model: 'voyage-3',
    dimensions: 1024,
    contextWindow: 32000,
  },
  baseline: {
    provider: 'openai',
    model: 'text-embedding-3-small',
    dimensions: 1536,
    contextWindow: 8191,
  },
};
```

**Rationale**:

1. **voyage-3 as primary**:
   - ✅ Best quality/cost ratio
   - ✅ 32K context = can embed entire issues
   - ✅ Future-proof (latest SOTA)

2. **OpenAI 3-small as baseline**:
   - ✅ Widely used (benchmarking against standard)
   - ✅ LangChain/LlamaIndex examples use OpenAI
   - ✅ Good ecosystem support

3. **Run experiments with both**:
   - Compare retrieval quality
   - Measure cost difference
   - Decide based on data (not assumptions)

**Budget Impact**:

```
Year 1 (100K docs + 120K new):
  voyage-3: $391
  OpenAI 3-small: $578
  Running both: ~$1,000

This is acceptable for RND phase.
Production: Choose winner, disable loser.
```

### 5.4 Alternative: voyage-code-3 for GitHub Issues

**Consideration**: GitHub issues often contain code blocks

```typescript
const config = {
  linear: {
    model: 'voyage-3', // Text-heavy
  },
  zendesk: {
    model: 'voyage-3', // Text-heavy
  },
  github: {
    model: 'voyage-code-3', // Code-heavy
  },
};
```

**Experiment**: Compare voyage-3 vs voyage-code-3 on GitHub issues

**Hypothesis**: voyage-code-3 will outperform on code-related queries

---

## 6. 구현 예시

### 6.1 Multi-Model Embedder

```typescript
// packages/shared/src/embeddings/embedder.ts

import { OpenAIEmbeddings } from '@langchain/openai';
import { VoyageEmbeddings } from '@langchain/community/embeddings/voyage';

export type EmbeddingProvider = 'openai' | 'voyage' | 'cohere';

export interface EmbedderConfig {
  provider: EmbeddingProvider;
  model: string;
  dimensions?: number; // For OpenAI (custom dims)
  batchSize?: number; // For batching efficiency
}

export class MultiModelEmbedder {
  private embedders: Map<string, any> = new Map();

  constructor(private configs: Record<string, EmbedderConfig>) {
    // Initialize embedders
    for (const [name, config] of Object.entries(configs)) {
      this.embedders.set(name, this.createEmbedder(config));
    }
  }

  private createEmbedder(config: EmbedderConfig) {
    switch (config.provider) {
      case 'openai':
        return new OpenAIEmbeddings({
          modelName: config.model,
          dimensions: config.dimensions,
          batchSize: config.batchSize || 100,
        });

      case 'voyage':
        return new VoyageEmbeddings({
          modelName: config.model,
          batchSize: config.batchSize || 100,
        });

      case 'cohere':
        // TODO: Implement Cohere embeddings
        throw new Error('Cohere not implemented yet');

      default:
        throw new Error(`Unknown provider: ${config.provider}`);
    }
  }

  async embed(text: string, embedderName: string): Promise<number[]> {
    const embedder = this.embedders.get(embedderName);
    if (!embedder) {
      throw new Error(`Embedder not found: ${embedderName}`);
    }

    return await embedder.embedQuery(text);
  }

  async embedBatch(texts: string[], embedderName: string): Promise<number[][]> {
    const embedder = this.embedders.get(embedderName);
    if (!embedder) {
      throw new Error(`Embedder not found: ${embedderName}`);
    }

    return await embedder.embedDocuments(texts);
  }
}
```

### 6.2 Usage Example

```typescript
// packages/chunking/src/pipeline.ts

import { MultiModelEmbedder } from '@/shared/embeddings/embedder';

const embedder = new MultiModelEmbedder({
  primary: {
    provider: 'voyage',
    model: 'voyage-3',
    batchSize: 100,
  },
  baseline: {
    provider: 'openai',
    model: 'text-embedding-3-small',
    batchSize: 100,
  },
  code: {
    provider: 'voyage',
    model: 'voyage-code-3',
    batchSize: 100,
  },
});

// Embed chunks
async function embedChunks(chunks: Chunk[], platform: string) {
  const texts = chunks.map((c) => c.content);

  // Choose embedder based on platform
  const embedderName = platform === 'github' ? 'code' : 'primary';

  // Embed with primary model
  const primaryEmbeddings = await embedder.embedBatch(texts, embedderName);

  // Also embed with baseline for comparison
  const baselineEmbeddings = await embedder.embedBatch(texts, 'baseline');

  // Store both in vector DB
  await storeEmbeddings(chunks, {
    primary: primaryEmbeddings,
    baseline: baselineEmbeddings,
  });
}
```

### 6.3 Cost Tracking

```typescript
// packages/shared/src/embeddings/cost-tracker.ts

export interface EmbeddingCost {
  provider: string;
  model: string;
  tokens: number;
  cost: number;
  timestamp: Date;
}

export class CostTracker {
  private costs: EmbeddingCost[] = [];

  private readonly PRICING: Record<string, number> = {
    'openai:text-embedding-3-small': 0.00002, // per 1K tokens
    'openai:text-embedding-3-large': 0.00013,
    'voyage:voyage-3': 0.00006,
    'voyage:voyage-3-large': 0.0001,
    'voyage:voyage-3-lite': 0.00004,
    'voyage:voyage-code-3': 0.00006,
    'cohere:embed-english-v3.0': 0.0001,
  };

  trackEmbedding(provider: string, model: string, tokens: number) {
    const key = `${provider}:${model}`;
    const pricePerK = this.PRICING[key] || 0;
    const cost = (tokens / 1000) * pricePerK;

    this.costs.push({
      provider,
      model,
      tokens,
      cost,
      timestamp: new Date(),
    });
  }

  getTotalCost(): number {
    return this.costs.reduce((sum, c) => sum + c.cost, 0);
  }

  getCostByModel(): Record<string, number> {
    const byModel: Record<string, number> = {};

    for (const cost of this.costs) {
      const key = `${cost.provider}:${cost.model}`;
      byModel[key] = (byModel[key] || 0) + cost.cost;
    }

    return byModel;
  }

  printReport() {
    console.log('\n=== Embedding Cost Report ===');
    console.log(`Total Cost: $${this.getTotalCost().toFixed(4)}`);
    console.log('\nBreakdown by Model:');

    for (const [model, cost] of Object.entries(this.getCostByModel())) {
      console.log(`  ${model}: $${cost.toFixed(4)}`);
    }
  }
}
```

### 6.4 Monitoring & Alerting

```typescript
// packages/shared/src/embeddings/monitor.ts

export class EmbeddingMonitor {
  async checkHealth(embedder: MultiModelEmbedder) {
    const testText = 'Hello world';

    try {
      const embedding = await embedder.embed(testText, 'primary');

      if (!embedding || embedding.length === 0) {
        throw new Error('Empty embedding returned');
      }

      console.log('✅ Embedding health check passed');
      return true;
    } catch (error) {
      console.error('❌ Embedding health check failed:', error);
      return false;
    }
  }

  async benchmarkLatency(embedder: MultiModelEmbedder, iterations: number = 100) {
    const testText = 'This is a test sentence for latency benchmarking.';
    const latencies: number[] = [];

    for (let i = 0; i < iterations; i++) {
      const start = Date.now();
      await embedder.embed(testText, 'primary');
      const end = Date.now();

      latencies.push(end - start);
    }

    const avg = latencies.reduce((sum, l) => sum + l, 0) / latencies.length;
    const p95 = latencies.sort((a, b) => a - b)[Math.floor(iterations * 0.95)];

    console.log(`\nLatency Benchmark (${iterations} iterations):`);
    console.log(`  Avg: ${avg.toFixed(1)}ms`);
    console.log(`  P95: ${p95.toFixed(1)}ms`);

    return { avg, p95 };
  }
}
```

---

## 7. Summary & Recommendations

### 7.1 Key Takeaways

1. **Voyage Dominates**: Consistently outperforms OpenAI & Cohere
   - +9.74% vs OpenAI 3-large
   - +20.71% vs Cohere v3

2. **Dimensions Matter**: More for storage than quality
   - voyage-3 (1024 dims) outperforms OpenAI large (3072 dims)
   - 3x less storage cost

3. **Context Window Critical**: 32K >> 8K for long documents
   - Can embed entire Linear issues without splitting
   - More flexibility in chunking strategy

4. **Cost is Complicated**: Embedding + storage + infrastructure
   - voyage-3: Best total cost of ownership
   - Local models only cheaper at massive scale

5. **Domain-Specific Wins**: Specialized models >> general-purpose
   - voyage-code-3 for code search
   - Consider for GitHub issues

### 7.2 Momo Final Recommendation

**Primary Model**: **voyage-3**

**Rationale**:

- ✅ Best quality/cost balance
- ✅ 32K context window = flexibility
- ✅ 1024 dims = reasonable storage
- ✅ Latest SOTA (future-proof)

**Baseline for Comparison**: **OpenAI text-embedding-3-small**

**Rationale**:

- ✅ Industry standard benchmark
- ✅ Good ecosystem support
- ✅ Validate that voyage-3 is truly better

**Special Case**: **voyage-code-3** for GitHub (experiment)

**Implementation Timeline**:

- **Phase 7**: Implement both voyage-3 and OpenAI 3-small
- **Phase 9**: Run experiments, compare metrics
- **Production**: Choose winner based on data

**Budget Allocation**:

```
RND Phase (running both models):
  Year 1: ~$1,000 total (acceptable)

Production (single model):
  Year 1: ~$400-600 (voyage-3 only)
```

### 7.3 Future Considerations

**If Scale Grows (>1M embeddings)**:

- Consider binary quantization (voyage supports)
- Evaluate local models (bge-large, mistral-embed)
- Infrastructure cost becomes favorable

**If Quality Requirements Change**:

- Upgrade to voyage-3-large (+$200/year)
- Experiment with hybrid search (vector + BM25)

**If Budget Becomes Tight**:

- Downgrade to voyage-3-lite (-$200/year)
- Use binary embeddings (-90% storage cost)

---

## References

1. [13 Best Embedding Models in 2025 (Elephas)](https://elephas.app/blog/best-embedding-models)
2. [Text Embedding Models Compared (Document360)](https://document360.com/blog/text-embedding-model-analysis/)
3. [Voyage AI Blog: voyage-3-large Release](https://blog.voyageai.com/2025/01/07/voyage-3-large/)
4. [Embedding Models: OpenAI vs Gemini vs Cohere (AIMultiple)](https://research.aimultiple.com/embedding-models/)
5. [MTEB Leaderboard](https://huggingface.co/spaces/mteb/leaderboard)

---

**Document Version**: 1.0
**Last Updated**: 2025-11-23
**Next Review**: After Phase 9 (실험 결과 기반 최종 결정)
