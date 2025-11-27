# Metrics System Design

> 레이어별 지표 수집 및 시각화 시스템 설계 명세서

## 1. 설계 목표

### 1.1 핵심 문제

- 현재: End-to-End F1 점수만으로는 "어디가 문제인지" 파악 불가
- 목표: **레이어별 지표를 통해 다음 실험 방향을 데이터 기반으로 결정**

### 1.2 Success Criteria

- 각 파이프라인 레이어별 품질 지표 확인 가능
- 실험 간 레이어별 비교 가능
- 병목 레이어 즉시 식별 가능

---

## 2. 아키텍처 개요

```
┌─────────────────────────────────────────────────────────────────┐
│                     METRICS COLLECTION FLOW                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Pipeline Execution                                              │
│       │                                                          │
│       ▼                                                          │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │               Stage Execution + Metrics                   │   │
│  │                                                           │   │
│  │  ChunkingStage ──▶ ChunkingMetrics                       │   │
│  │       │                                                   │   │
│  │       ▼                                                   │   │
│  │  EmbeddingStage ──▶ EmbeddingMetrics                     │   │
│  │       │                                                   │   │
│  │       ▼                                                   │   │
│  │  StorageStage ──▶ (GraphMetrics via RelationInferrer)    │   │
│  │       │                                                   │   │
│  │       ▼                                                   │   │
│  │  ValidationStage ──▶ ValidationMetrics + RetrievalMetrics│   │
│  │                                                           │   │
│  └──────────────────────────────────────────────────────────┘   │
│       │                                                          │
│       ▼                                                          │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                  PipelineContext.stats                    │   │
│  │  {                                                        │   │
│  │    chunking: ChunkingMetrics,                             │   │
│  │    embedding: EmbeddingMetrics,                           │   │
│  │    graph: GraphMetrics,                                   │   │
│  │    retrieval: RetrievalMetrics,                           │   │
│  │    validation: ValidationMetrics,                         │   │
│  │    temporal: TemporalMetrics,                             │   │
│  │  }                                                        │   │
│  └──────────────────────────────────────────────────────────┘   │
│       │                                                          │
│       ▼                                                          │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                    Storage Layer                          │   │
│  │                                                           │   │
│  │  experiments ──▶ experiment_layer_metrics (1:N)           │   │
│  │                                                           │   │
│  └──────────────────────────────────────────────────────────┘   │
│       │                                                          │
│       ▼                                                          │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                    UI Dashboard                           │   │
│  │                                                           │   │
│  │  /research                                                │   │
│  │    ├── ExperimentList (sidebar)                          │   │
│  │    ├── ExperimentDetail                                  │   │
│  │    │     ├── ConfigDiff                                  │   │
│  │    │     ├── LayerMetricsCards                           │   │
│  │    │     └── ComparisonCharts                            │   │
│  │    └── LayerDrilldown                                    │   │
│  │                                                           │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. 메트릭 타입 정의

### 3.1 레이어별 메트릭 인터페이스

```typescript
// packages/shared/src/types/metrics.ts

/**
 * Chunking Layer Metrics
 */
export interface ChunkingMetrics {
  // 기존 (from ChunkingStats)
  total_chunks: number;
  avg_chunk_size: number;
  min_chunk_size: number;
  max_chunk_size: number;
  std_chunk_size: number;

  // 추가: 품질 지표
  size_distribution: {
    buckets: number[]; // [0-128, 128-256, 256-512, 512-1024, 1024+]
    counts: number[];
  };

  // Future: Coherence score (requires LLM or embedding-based calculation)
  coherence_score?: number;
}

/**
 * Embedding Layer Metrics
 */
export interface EmbeddingMetrics {
  // 기존
  total_tokens: number;
  cost_usd: number;

  // 추가: 품질 지표
  embeddings_generated: number;
  avg_embedding_time_ms: number;

  // 추가: 분포 분석
  similarity_distribution?: {
    // Pairwise similarity 분포 (샘플링)
    mean: number;
    std: number;
    min: number;
    max: number;
    percentiles: { p25: number; p50: number; p75: number; p95: number };
  };

  // Future: Clustering quality
  silhouette_score?: number;
}

/**
 * Knowledge Graph Layer Metrics
 */
export interface GraphMetrics {
  // 기존 (from RelationInferrer.getStats)
  total_relations: number;
  by_type: Record<string, number>;
  by_source: Record<string, number>;
  avg_confidence: number;

  // 추가: Ground Truth 비교 (if available)
  entity_metrics?: {
    precision: number;
    recall: number;
    f1: number;
  };
  relation_metrics?: {
    precision: number;
    recall: number;
    f1: number;
  };

  // 추가: Graph 구조 분석
  graph_stats: {
    total_nodes: number;
    total_edges: number;
    avg_degree: number;
    connected_components: number;
  };
}

/**
 * Retrieval Layer Metrics
 */
export interface RetrievalMetrics {
  // 검색 품질 (Ground Truth 필요)
  ndcg_at_k: { k5: number; k10: number; k20: number };
  mrr: number; // Mean Reciprocal Rank
  recall_at_k: { k5: number; k10: number; k20: number };
  precision_at_k: { k5: number; k10: number; k20: number };

  // 검색 성능
  avg_retrieval_time_ms: number;
  queries_evaluated: number;
}

/**
 * Temporal Layer Metrics
 */
export interface TemporalMetrics {
  // Time-decay 효과
  time_decay_applied: boolean;
  avg_recency_boost: number;

  // Before/After 비교
  retrieval_quality_without_temporal?: number;
  retrieval_quality_with_temporal?: number;
  improvement_percentage?: number;
}

/**
 * End-to-End Validation Metrics (기존 확장)
 */
export interface ValidationMetrics {
  // 기존
  f1_score: number;
  precision: number;
  recall: number;
  true_positives: number;
  false_positives: number;
  false_negatives: number;

  // 추가: 신뢰구간 (multiple runs 시)
  confidence_interval?: {
    f1_lower: number;
    f1_upper: number;
    n_runs: number;
  };
}

/**
 * 통합 Pipeline Metrics
 */
export interface PipelineMetrics {
  chunking: ChunkingMetrics;
  embedding: EmbeddingMetrics;
  graph: GraphMetrics;
  retrieval?: RetrievalMetrics; // Ground Truth 있을 때만
  temporal?: TemporalMetrics;
  validation: ValidationMetrics;

  // 메타데이터
  pipeline_duration_ms: number;
  timestamp: string;
}
```

### 3.2 PipelineContext.stats 확장

```typescript
// packages/pipeline/src/types.ts 수정

export interface PipelineContext {
  // ... existing fields

  stats: {
    chunking?: ChunkingMetrics;
    embedding?: EmbeddingMetrics;
    graph?: GraphMetrics;
    retrieval?: RetrievalMetrics;
    temporal?: TemporalMetrics;
    validation?: ValidationMetrics;
  };
}
```

---

## 4. 데이터베이스 스키마 확장

### 4.1 experiment_layer_metrics 테이블

```sql
-- 실험별 레이어 메트릭 저장
CREATE TABLE experiment_layer_metrics (
  id SERIAL PRIMARY KEY,
  experiment_id INTEGER REFERENCES experiments(id) ON DELETE CASCADE,

  -- Chunking metrics
  chunking_total_chunks INTEGER,
  chunking_avg_size FLOAT,
  chunking_min_size INTEGER,
  chunking_max_size INTEGER,
  chunking_std_size FLOAT,
  chunking_size_distribution JSONB,  -- buckets & counts
  chunking_coherence_score FLOAT,

  -- Embedding metrics
  embedding_total_tokens INTEGER,
  embedding_cost_usd FLOAT,
  embedding_count INTEGER,
  embedding_avg_time_ms FLOAT,
  embedding_similarity_distribution JSONB,  -- mean, std, percentiles
  embedding_silhouette_score FLOAT,

  -- Graph metrics
  graph_total_relations INTEGER,
  graph_by_type JSONB,
  graph_by_source JSONB,
  graph_avg_confidence FLOAT,
  graph_entity_f1 FLOAT,
  graph_relation_f1 FLOAT,
  graph_stats JSONB,  -- nodes, edges, degree, components

  -- Retrieval metrics
  retrieval_ndcg_k5 FLOAT,
  retrieval_ndcg_k10 FLOAT,
  retrieval_ndcg_k20 FLOAT,
  retrieval_mrr FLOAT,
  retrieval_recall_k10 FLOAT,
  retrieval_avg_time_ms FLOAT,

  -- Temporal metrics
  temporal_decay_applied BOOLEAN,
  temporal_avg_boost FLOAT,
  temporal_improvement_pct FLOAT,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_layer_metrics_experiment ON experiment_layer_metrics(experiment_id);
```

---

## 5. UI 컴포넌트 설계

### 5.1 페이지 구조

```
/research
├── Layout
│   ├── Sidebar (ExperimentList)
│   │   ├── Baseline indicator
│   │   ├── Experiment cards (sorted by date)
│   │   └── New experiment button → opens CLI guidance
│   │
│   └── Main Content
│       ├── ExperimentHeader
│       │   ├── Name, status, timestamp
│       │   └── Actions (promote to baseline, etc.)
│       │
│       ├── ConfigDiff (vs baseline)
│       │
│       ├── LayerMetricsGrid
│       │   ├── ChunkingCard
│       │   ├── EmbeddingCard
│       │   ├── GraphCard
│       │   ├── RetrievalCard
│       │   └── ValidationCard (end-to-end)
│       │
│       └── ComparisonSection
│           ├── Metric selector
│           └── Bar/Line chart (baseline vs current)
```

### 5.2 LayerMetricsCard 컴포넌트

```tsx
// apps/demo/src/components/research/LayerMetricsCard.tsx

interface LayerMetricsCardProps {
  layer: 'chunking' | 'embedding' | 'graph' | 'retrieval' | 'validation';
  current: LayerMetrics;
  baseline?: LayerMetrics;
}

function LayerMetricsCard({ layer, current, baseline }: LayerMetricsCardProps) {
  return (
    <Card>
      <CardHeader>
        <LayerIcon layer={layer} />
        <LayerTitle>{getLayerTitle(layer)}</LayerTitle>
        <HealthIndicator metrics={current} baseline={baseline} />
      </CardHeader>

      <CardContent>
        <MetricsTable>
          {getLayerMetrics(layer).map((metric) => (
            <MetricRow
              key={metric.key}
              label={metric.label}
              current={current[metric.key]}
              baseline={baseline?.[metric.key]}
              format={metric.format}
              improvement={calculateImprovement(current, baseline, metric.key)}
            />
          ))}
        </MetricsTable>

        {/* Distribution chart if applicable */}
        {current.distribution && <DistributionChart data={current.distribution} />}
      </CardContent>
    </Card>
  );
}
```

### 5.3 Health Indicator 로직

```typescript
// 각 레이어별 "건강도" 판단 기준

const healthThresholds = {
  chunking: {
    good: { coherence: 0.8, std_ratio: 0.3 }, // std/avg < 0.3
    warning: { coherence: 0.6, std_ratio: 0.5 },
  },
  embedding: {
    good: { silhouette: 0.7, cost_per_1k: 0.01 },
    warning: { silhouette: 0.5, cost_per_1k: 0.05 },
  },
  graph: {
    good: { relation_f1: 0.7, avg_confidence: 0.8 },
    warning: { relation_f1: 0.5, avg_confidence: 0.6 },
  },
  retrieval: {
    good: { ndcg_k10: 0.8, mrr: 0.7 },
    warning: { ndcg_k10: 0.6, mrr: 0.5 },
  },
  validation: {
    good: { f1: 0.8, precision: 0.75 },
    warning: { f1: 0.6, precision: 0.5 },
  },
};

function getHealthStatus(layer: string, metrics: LayerMetrics): 'good' | 'warning' | 'critical' {
  const thresholds = healthThresholds[layer];
  // Compare metrics against thresholds
  // Return appropriate status
}
```

---

## 6. 구현 우선순위

### Phase 1: Foundation (이번 PR)

- [ ] 메트릭 타입 정의 (`packages/shared/src/types/metrics.ts`)
- [ ] PipelineContext.stats 확장
- [ ] 기존 Stage에서 메트릭 수집 로직 추가
- [ ] DB 스키마 마이그레이션

### Phase 2: Storage & API

- [ ] Orchestrator에서 메트릭 저장 로직 추가
- [ ] API 엔드포인트 (`/api/experiments/[id]/metrics`)
- [ ] 실험 목록 API 확장

### Phase 3: UI

- [ ] ExperimentList 컴포넌트
- [ ] LayerMetricsCard 컴포넌트
- [ ] ComparisonChart 컴포넌트
- [ ] /research 페이지 통합

### Phase 4: Advanced

- [ ] Coherence score 계산 (LLM 기반)
- [ ] Silhouette score 계산
- [ ] Retrieval metrics (NDCG, MRR)
- [ ] Temporal metrics

---

## 7. 열린 질문

1. **Coherence score 계산 방법**: LLM 호출 비용 vs 임베딩 기반 휴리스틱?
2. **Retrieval metrics**: Ground Truth 없을 때 대안?
3. **메트릭 저장 빈도**: 매 실험마다 vs 요청 시 계산?
4. **UI 복잡도**: 단순 테이블 vs 인터랙티브 차트?

---

_작성일: 2024-11-26_
_버전: Draft 1.0_
