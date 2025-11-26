# Architecture Overview

> Memory Research Tool의 파이프라인 아키텍처 및 시스템 설계

## 1. Design Principles

1. **Write/Read Path 분리**: 색인과 검색은 독립적인 최적화 경로
2. **Stage 독립성**: 각 파이프라인 단계는 독립적으로 테스트/벤치마크 가능
3. **Configuration-Driven**: 코드 수정 없이 YAML로 파이프라인 동작 변경
4. **Baseline 기반 개선**: 모든 실험은 baseline 대비 측정

---

## 2. Pipeline Architecture

### 2.1 Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              MEMORY PIPELINE                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │                         WRITE PATH (색인)                            │   │
│   │                                                                      │   │
│   │   Ingestion → Transform → Consolidation → Chunking → Embedding      │   │
│   │       │           │            │             │            │          │   │
│   │       ▼           ▼            ▼             ▼            ▼          │   │
│   │   Knowledge Graph ─────────────────────────────────────────→ Storage │   │
│   │                                                                      │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │                         READ PATH (검색)                             │   │
│   │                                                                      │   │
│   │   Query → Embedding → Retrieval → Graph Expansion → Temporal Boost  │   │
│   │                                                           │          │   │
│   │                                                           ▼          │   │
│   │                                                       Reasoning      │   │
│   │                                                                      │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Write Path (색인 시점)

데이터가 시스템에 들어와서 검색 가능한 형태로 저장되기까지의 흐름.

| Stage                  | 역할            | 입력              | 출력                  |
| ---------------------- | --------------- | ----------------- | --------------------- |
| **1. Ingestion**       | Raw 데이터 수집 | API, 파일, 웹훅   | Raw Documents         |
| **2. Transform**       | 정규화          | Raw Documents     | Canonical Objects     |
| **3. Consolidation**   | 중복 제거       | Canonical Objects | Unique Objects        |
| **4. Chunking**        | 시맨틱 분할     | Unique Objects    | Chunks                |
| **5. Embedding**       | 벡터 생성       | Chunks            | Chunks + Vectors      |
| **6. Knowledge Graph** | 관계 추출       | Canonical Objects | Relations             |
| **7. Storage**         | 영속화          | All               | PostgreSQL + pgvector |

```
┌──────────────────────────────────────────────────────────────────────────┐
│                          WRITE PATH DETAIL                                │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│  ┌─────────────┐                                                          │
│  │  Ingestion  │  Raw data 수집                                           │
│  │             │  - API polling (Slack, Linear, GitHub)                  │
│  │             │  - File upload (PDF, Markdown)                          │
│  │             │  - Webhook receivers                                    │
│  └──────┬──────┘                                                          │
│         │ Raw Documents                                                   │
│         ▼                                                                 │
│  ┌─────────────┐                                                          │
│  │  Transform  │  플랫폼별 → Canonical 포맷                               │
│  │             │  - Slack message → CanonicalObject                      │
│  │             │  - Linear issue → CanonicalObject                       │
│  │             │  - semantic_hash 생성                                   │
│  └──────┬──────┘                                                          │
│         │ Canonical Objects                                               │
│         ▼                                                                 │
│  ┌──────────────────┐                                                     │
│  │  Consolidation   │  중복 제거                                          │
│  │                  │  - semantic_hash 기반 exact match                  │
│  │                  │  - (Future) embedding 유사도 기반                  │
│  └──────┬───────────┘                                                     │
│         │ Unique Objects                                                  │
│         ▼                                                                 │
│  ┌─────────────┐                                                          │
│  │  Chunking   │  시맨틱 분할                                             │
│  │             │  - Strategy: semantic | fixed-size | sentence           │
│  │             │  - Overlap 설정                                         │
│  │             │  - 메타데이터 보존                                       │
│  └──────┬──────┘                                                          │
│         │ Chunks                                                          │
│         ▼                                                                 │
│  ┌─────────────┐                                                          │
│  │  Embedding  │  벡터 생성                                               │
│  │             │  - Model: text-embedding-3-small/large, voyage-3        │
│  │             │  - Dimensions: 1536 / 3072                              │
│  │             │  - Batch processing                                     │
│  └──────┬──────┘                                                          │
│         │ Chunks + Vectors                                                │
│         │                                                                 │
│         │      ┌───────────────────┐                                      │
│         │      │  Knowledge Graph  │  관계 추출 (병렬 처리)               │
│         ├─────▶│                   │  - Explicit: 명시적 참조            │
│         │      │                   │  - Inferred: 임베딩 유사도          │
│         │      │                   │  - Contrastive ICL (LLM 기반)       │
│         │      └─────────┬─────────┘                                      │
│         │                │ Relations                                      │
│         ▼                ▼                                                │
│  ┌─────────────────────────────┐                                          │
│  │          Storage            │                                          │
│  │  ┌───────────────────────┐  │                                          │
│  │  │  canonical_objects    │  │  엔티티                                  │
│  │  │  chunks (+ embedding) │  │  청크 + 벡터                             │
│  │  │  relations            │  │  관계                                    │
│  │  │  ground_truth         │  │  평가용 정답                             │
│  │  └───────────────────────┘  │                                          │
│  └─────────────────────────────┘                                          │
│                                                                           │
└──────────────────────────────────────────────────────────────────────────┘
```

### 2.3 Read Path (검색 시점)

사용자 쿼리가 들어와서 응답이 생성되기까지의 흐름.

| Stage                  | 역할           | 입력             | 출력             |
| ---------------------- | -------------- | ---------------- | ---------------- |
| **1. Query**           | 쿼리 수신      | User Query       | Query String     |
| **2. Embedding**       | 쿼리 벡터화    | Query String     | Query Vector     |
| **3. Retrieval**       | 유사도 검색    | Query Vector     | Top-K Chunks     |
| **4. Graph Expansion** | 관계 기반 확장 | Top-K Chunks     | Expanded Results |
| **5. Temporal Boost**  | 최신성 가중치  | Expanded Results | Reranked Results |
| **6. Reasoning**       | 응답 생성      | Reranked Results | Response         |

```
┌──────────────────────────────────────────────────────────────────────────┐
│                          READ PATH DETAIL                                 │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│  ┌─────────────┐                                                          │
│  │    Query    │  "프로젝트 A 관련 이슈 알려줘"                           │
│  └──────┬──────┘                                                          │
│         │                                                                 │
│         ▼                                                                 │
│  ┌─────────────┐                                                          │
│  │  Embedding  │  쿼리 → 벡터                                             │
│  │             │  (Write Path와 동일 모델 사용)                          │
│  └──────┬──────┘                                                          │
│         │ Query Vector [1536]                                             │
│         ▼                                                                 │
│  ┌─────────────┐                                                          │
│  │  Retrieval  │  pgvector 코사인 유사도 검색                             │
│  │             │  SELECT * FROM chunks                                   │
│  │             │  ORDER BY embedding <=> query_vec                       │
│  │             │  LIMIT k                                                │
│  └──────┬──────┘                                                          │
│         │ Top-K Chunks                                                    │
│         ▼                                                                 │
│  ┌─────────────────┐                                                      │
│  │ Graph Expansion │  관계 기반 결과 확장                                 │
│  │                 │  - 검색된 엔티티의 관련 엔티티 포함                  │
│  │                 │  - relation depth 설정 가능                         │
│  └──────┬──────────┘                                                      │
│         │ Expanded Results                                                │
│         ▼                                                                 │
│  ┌────────────────┐                                                       │
│  │ Temporal Boost │  최신성 가중치                                        │
│  │                │  score = similarity + recency * boost_weight         │
│  │                │  최근 데이터 우선순위 상향                            │
│  └──────┬─────────┘                                                       │
│         │ Reranked Results                                                │
│         ▼                                                                 │
│  ┌─────────────┐                                                          │
│  │  Reasoning  │  응답 생성                                               │
│  │             │  - (MVP) Template-based formatting                      │
│  │             │  - (Future) LLM-based synthesis                         │
│  └──────┬──────┘                                                          │
│         │                                                                 │
│         ▼                                                                 │
│  ┌─────────────┐                                                          │
│  │  Response   │  구조화된 응답 + 소스 참조                               │
│  └─────────────┘                                                          │
│                                                                           │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Package Structure

### 3.1 Pipeline Stage → Package Mapping

| Pipeline Stage  | Package               | 구현 상태            |
| --------------- | --------------------- | -------------------- |
| Ingestion       | `@momo/ingestion`     | MVP (synthetic only) |
| Transform       | `@momo/transformers`  | MVP (Slack only)     |
| Consolidation   | `@momo/consolidation` | MVP (hash-based)     |
| Chunking        | `@momo/chunking`      | **TODO: 분리 필요**  |
| Embedding       | `@momo/embedding`     | Production-ready     |
| Knowledge Graph | `@momo/graph`         | Production-ready     |
| Storage         | `@unified-memory/db`  | Production-ready     |
| Retrieval       | `@momo/query`         | MVP                  |
| Temporal        | `@momo/temporal`      | MVP                  |
| Reasoning       | `@momo/reasoning`     | MVP (template-based) |

### 3.2 현재 문제점 및 리팩토링 필요 사항

```
현재 구조:
@momo/embedding
├── chunker.ts        ← Chunking 로직
└── openai-embedder.ts ← Embedding 로직

문제: Chunking과 Embedding이 한 패키지에 혼합됨

리팩토링 목표:
@momo/chunking        ← 청킹 전용
├── index.ts
├── chunker.ts
└── strategies/
    ├── semantic.ts
    ├── fixed-size.ts
    └── sentence.ts

@momo/embedding       ← 임베딩 전용
├── index.ts
├── embedder.ts
└── providers/
    ├── openai.ts
    └── voyage.ts
```

### 3.3 Shared Packages

| Package                  | 역할                             |
| ------------------------ | -------------------------------- |
| `@unified-memory/shared` | 공통 타입, 유틸리티, Zod 스키마  |
| `@unified-memory/db`     | PostgreSQL + pgvector 클라이언트 |

---

## 4. Database Schema

### 4.1 Core Tables

```sql
-- 정규화된 엔티티
CREATE TABLE canonical_objects (
  id UUID PRIMARY KEY,
  platform VARCHAR(50) NOT NULL,
  object_type VARCHAR(50) NOT NULL,
  external_id VARCHAR(255),
  title TEXT,
  body TEXT,
  semantic_hash VARCHAR(64),
  metadata JSONB DEFAULT '{}',
  timestamps JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 청크 + 벡터
CREATE TABLE chunks (
  id UUID PRIMARY KEY,
  canonical_object_id UUID REFERENCES canonical_objects(id),
  chunk_index INTEGER NOT NULL,
  content TEXT NOT NULL,
  method VARCHAR(50),
  metadata JSONB,
  embedding vector(1536),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 관계
CREATE TABLE relations (
  id UUID PRIMARY KEY,
  from_id UUID REFERENCES canonical_objects(id),
  to_id UUID REFERENCES canonical_objects(id),
  relation_type VARCHAR(50) NOT NULL,
  confidence FLOAT,
  source VARCHAR(50), -- 'explicit' | 'inferred' | 'contrastive_icl'
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 평가용 정답
CREATE TABLE ground_truth_relations (
  id UUID PRIMARY KEY,
  from_id UUID,
  to_id UUID,
  relation_type VARCHAR(50),
  scenario VARCHAR(50)
);

-- 실험 기록
CREATE TABLE experiments (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) UNIQUE NOT NULL,
  description TEXT,
  config JSONB NOT NULL,
  status VARCHAR(50) DEFAULT 'draft',
  is_baseline BOOLEAN DEFAULT FALSE,
  paper_ids TEXT[],
  git_commit VARCHAR(64),
  run_completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 실험 결과
CREATE TABLE experiment_results (
  id SERIAL PRIMARY KEY,
  experiment_id INTEGER REFERENCES experiments(id),
  scenario VARCHAR(50),
  f1_score FLOAT,
  precision FLOAT,
  recall FLOAT,
  true_positives INTEGER,
  false_positives INTEGER,
  false_negatives INTEGER,
  ground_truth_total INTEGER,
  inferred_total INTEGER,
  retrieval_time_ms INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 4.2 Indexes

```sql
-- Vector similarity search (IVFFlat for < 1M rows)
CREATE INDEX ON chunks USING ivfflat (embedding vector_cosine_ops);

-- Metadata search
CREATE INDEX ON canonical_objects USING GIN (metadata);
CREATE INDEX ON chunks USING GIN (metadata);

-- Relation lookup
CREATE INDEX ON relations (from_id);
CREATE INDEX ON relations (to_id);
CREATE INDEX ON relations (relation_type);
```

---

## 5. Experiment System

### 5.1 Single Pipeline, Multiple Experiments (Option B)

```
┌─────────────────────────────────────────────────────────────────┐
│                     EXPERIMENT SYSTEM                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Fixed Components:                                               │
│  ├─ Data Source: 합성 데이터 (data/synthetic/)                   │
│  ├─ Ground Truth: 평가 기준 (ground_truth_relations)             │
│  └─ Metrics: F1, Precision, Recall                              │
│                                                                  │
│  Variable Components (YAML config):                              │
│  ├─ Embedding: model, dimensions                                │
│  ├─ Chunking: strategy, maxChunkSize, overlap                   │
│  ├─ Relation Inference: thresholds, methods                     │
│  └─ Retrieval: similarityThreshold, chunkLimit                  │
│                                                                  │
│  Workflow:                                                       │
│  1. 설정 변경 (YAML)                                             │
│  2. 파이프라인 실행                                               │
│  3. Ground Truth 대비 평가                                       │
│  4. Baseline 대비 비교                                           │
│  5. (선택) Baseline 승격                                         │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 5.2 Experiment Config Structure

```yaml
# config/experiments/exp-001.yaml

name: 'EXP-001: Voyage Embedding Test'
description: 'voyage-3-large 임베딩 성능 테스트'

# Write Path 설정
chunking:
  strategy: 'semantic'
  maxChunkSize: 512
  overlap: 50

embedding:
  model: 'voyage-3-large'
  dimensions: 1024
  batchSize: 100

relationInference:
  similarityThreshold: 0.85
  keywordOverlapThreshold: 0.65
  useSemanticSimilarity: true
  useContrastiveICL: false

# Read Path 설정
retrieval:
  similarityThreshold: 0.35
  chunkLimit: 20
  includeRelations: true
  relationDepth: 1

temporal:
  recencyBoost: 0.1
  maxAgeDays: 30

# 평가 설정
validation:
  runOnSave: true
  autoSaveExperiment: true
  scenarios: ['normal']

metadata:
  baseline: false
  paper_ids: ['voyage-3-large']
```

---

## 6. Technology Stack

| Layer           | Technology       | Rationale                     |
| --------------- | ---------------- | ----------------------------- |
| Runtime         | Node.js 18+      | TypeScript 네이티브 지원      |
| Language        | TypeScript 5.3+  | Type safety, IDE 지원         |
| Package Manager | pnpm 8+          | 빠른 설치, 효율적 디스크 사용 |
| Database        | PostgreSQL 15+   | ACID, 성숙한 생태계           |
| Vector Search   | pgvector         | 단일 DB로 통합, 충분한 성능   |
| API             | Next.js 14       | API Routes + 미래 UI          |
| Validation      | Zod              | Runtime type checking         |
| UI              | React + Tailwind | (apps/demo)                   |

---

## 7. Future Considerations

### 7.1 Short-term (연구용)

- 패키지 분리 (chunking ↔ embedding)
- 파이프라인 각 단계별 벤치마크 도구
- CLI 기반 실험 실행

### 7.2 Mid-term (SaaS 준비)

- Multi-scenario 지원
- Web UI 완성 (PRODUCT_SPEC.md 기반)
- Claude Code CLI 연동

### 7.3 Long-term (확장)

- Multi-tenant (Project 개념)
- Custom data source 연동
- Electron wrapper
