# EXP-008: Two-Stage Threshold + Embedding Preprocessing

```yaml
# Experiment Metadata
experiment_id: EXP-008
title: 'Two-Stage Threshold + Embedding Preprocessing - Experiment Plan'
date: 2025-11-27
status: planned
type: plan

# Performance Metrics
baseline_f1: 0.860
target_f1: 0.90

# Related Resources
related_experiments: ['EXP-006', 'EXP-007']
reference_docs: ['05-supermemory-comparison.md', '003-enhancing-rag-best-practices.md']

# Tags
tags: ['two-stage-threshold', 'embedded-content', 'supermemory', 'precision-optimization']

# Decision
decision: approved
```

## Overview

**Date**: 2025-11-27
**Objective**: Precision 개선을 통해 F1 86% → 90%+ 달성
**Current Baseline**: F1 86.0%, Precision 76.0%, Recall 99.0% (EXP-007)
**Target**: F1 90%+, Precision 85%+
**Strategy**: SuperMemory의 검증된 패턴 적용 (2단계 임계값 + embeddedContent 전처리)

---

## Background

### SuperMemory 문서에서 발견한 핵심 인사이트

| 기법                       | SuperMemory                   | 현재 시스템        | Gap        |
| -------------------------- | ----------------------------- | ------------------ | ---------- |
| **2단계 임계값**           | chunk + document threshold    | 단일 threshold     | **Medium** |
| **embeddedContent 전처리** | 불용어 제거, 스테밍 후 임베딩 | 원본 그대로 임베딩 | **Medium** |
| 컨텍스트 청크              | position ± 1 반환             | 미지원             | Low        |
| 메타데이터 필터            | AND/OR 연산 지원              | 미지원             | Low        |

### 왜 이 기법들을 선택했는가?

1. **실제 데이터 없이도 효과 검증 가능** - 합성 데이터에서도 명확한 개선 예상
2. **구현 복잡도 낮음** - 1-2일 내 완료 가능
3. **SuperMemory에서 검증됨** - 프로덕션 환경에서 사용되는 패턴
4. **Precision 개선에 직접적** - False Positive 감소가 목표

---

## Experiment Plan

### Stage 1: Two-Stage Threshold (2단계 임계값)

**Goal**: Chunk threshold + Document threshold로 노이즈 제거
**Time**: 4-6시간
**Effort**: Medium

#### 현재 방식 (단일 임계값)

```typescript
// 현재: 단일 threshold
if (combinedSim >= 0.3) {
  // 관계 생성
}

// 문제점:
// - 하나의 청크만 높은 유사도 → 전체 문서가 관련됨으로 판정
// - 노이즈가 많이 포함됨
```

#### 개선 방식 (2단계 임계값)

```typescript
// Step 1: Chunk-level filtering
const chunkThreshold = 0.3;
const matchingChunks = chunks.filter((c) => c.similarity >= chunkThreshold);

// Step 2: Document-level aggregation
const documentScores = new Map<string, number[]>();
for (const chunk of matchingChunks) {
  const scores = documentScores.get(chunk.documentId) || [];
  scores.push(chunk.similarity);
  documentScores.set(chunk.documentId, scores);
}

// Step 3: Document threshold filtering
const documentThreshold = 0.25;
const qualifiedDocuments = Array.from(documentScores.entries())
  .filter(([_, scores]) => {
    const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
    return avgScore >= documentThreshold;
  })
  .map(([docId, _]) => docId);

// 효과:
// - 단일 청크만 매칭되는 문서 필터링
// - 일관되게 유사한 문서만 선택
// - Precision 향상
```

#### Implementation Plan

**Files to modify:**

1. `packages/graph/src/relation-inferrer.ts`
   - `RelationInferrerOptions`에 `documentThreshold` 추가
   - `inferSimilarityWithEmbeddings`에 2단계 필터링 로직 추가

2. `packages/pipeline/src/types.ts`
   - `PipelineConfig.relationInference`에 `documentThreshold` 추가

3. `packages/pipeline/src/stages/validation-stage.ts`
   - `documentThreshold` 옵션 전달

4. `config/experiments/exp-008-two-stage-threshold.yaml`
   - 새 실험 설정

#### Expected Outcomes

| Metric    | Before | Expected | Improvement |
| --------- | ------ | -------- | ----------- |
| F1        | 86.0%  | 88-89%   | +2-3%       |
| Precision | 76.0%  | 82-85%   | +6-9%       |
| Recall    | 99.0%  | 95-97%   | -2-4%       |

**Tradeoff**: Recall이 약간 감소하지만, Precision 개선으로 F1 상승

#### Success Criteria

- [ ] 2단계 임계값 로직 구현
- [ ] Config에 `documentThreshold` 파라미터 추가
- [ ] Precision ≥ 80%
- [ ] F1 ≥ 87%

---

### Stage 2: Embedded Content Preprocessing (임베딩 전처리)

**Goal**: 불용어 제거 + 스테밍으로 임베딩 품질 개선
**Time**: 2-3시간
**Effort**: Low-Medium

#### 현재 방식

```typescript
// 원본 텍스트 그대로 임베딩
const embedding = await embed('Login failed! User authentication error.');
```

#### 개선 방식

```typescript
// 전처리된 텍스트로 임베딩
const original = "Login failed! User authentication error.";
const embedded = "login fail user authent error";  // 소문자, 불용어제거, 스테밍
const embedding = await embed(embedded);

// DB 저장
{
  content: original,           // 원본 (사용자 표시용)
  embedded_content: embedded   // 전처리 (임베딩용)
}
```

#### Implementation Plan

**Files to modify:**

1. `packages/chunking/src/chunker.ts`
   - `preprocessForEmbedding()` 함수 추가
   - 청크 생성 시 `embedded_content` 필드 추가

2. `packages/embedding/src/openai-embedder.ts`
   - `embedded_content`가 있으면 해당 필드로 임베딩 생성

3. `db/migrations/XXX_add_embedded_content.sql`
   - `ALTER TABLE chunks ADD COLUMN embedded_content TEXT`

#### Preprocessing Logic

```typescript
const STOP_WORDS = new Set([
  'the',
  'a',
  'an',
  'and',
  'or',
  'but',
  'is',
  'are',
  'was',
  'were',
  'in',
  'on',
  'at',
  'to',
  'for',
  'of',
  'with',
  'by',
  'from',
  'as',
  'this',
  'that',
  'these',
  'those',
  'it',
  'its',
  'be',
  'been',
  'being',
  'have',
  'has',
  'had',
  'do',
  'does',
  'did',
  'will',
  'would',
  'could',
  'should',
  'may',
  'might',
  'must',
  'can',
]);

function preprocessForEmbedding(text: string): string {
  return text
    .toLowerCase() // 소문자 변환
    .replace(/[^\w\s]/g, ' ') // 특수문자 제거
    .split(/\s+/) // 단어 분리
    .filter((word) => word.length > 2) // 2글자 이하 제거
    .filter((word) => !STOP_WORDS.has(word)) // 불용어 제거
    .map((word) => stem(word)) // 스테밍
    .join(' ');
}

function stem(word: string): string {
  // 간단한 규칙 기반 스테밍
  return word
    .replace(/ing$/, '')
    .replace(/ed$/, '')
    .replace(/s$/, '')
    .replace(/ly$/, '')
    .replace(/ment$/, '')
    .replace(/tion$/, '');
}
```

#### Expected Outcomes

| Metric    | Before | Expected | Improvement |
| --------- | ------ | -------- | ----------- |
| F1        | 88-89% | 90-92%   | +2-3%       |
| Precision | 82-85% | 85-88%   | +3%         |
| Recall    | 95-97% | 95-97%   | ±0%         |

**Note**: 기존 데이터 재임베딩 필요 (비용 발생)

#### Success Criteria

- [ ] `preprocessForEmbedding` 함수 구현
- [ ] DB에 `embedded_content` 컬럼 추가
- [ ] 기존 청크 재처리 스크립트 작성
- [ ] F1 ≥ 90%

---

## Timeline

### Day 1 (4-6시간)

| 시간 | 작업                            |
| ---- | ------------------------------- |
| 1-2h | Stage 1: 2단계 임계값 로직 구현 |
| 1h   | Stage 1: Config 파라미터 추가   |
| 1h   | Stage 1: 실험 실행 및 결과 분석 |
| 1h   | Stage 1: 문서화                 |

### Day 2 (3-4시간)

| 시간 | 작업                                       |
| ---- | ------------------------------------------ |
| 1h   | Stage 2: 전처리 함수 구현                  |
| 1h   | Stage 2: DB 마이그레이션 + 재처리 스크립트 |
| 1-2h | Stage 2: 실험 실행 및 결과 분석            |
| 1h   | Stage 2: 최종 문서화                       |

**총 소요 시간**: 7-10시간 (1.5일)

---

## Config Examples

### Stage 1 Config

```yaml
# config/experiments/exp-008-stage-1-two-stage-threshold.yaml
name: 'exp-008-stage-1-two-stage-threshold'
description: 'Two-stage threshold: chunk + document level filtering'
created_at: '2025-11-27'

embedding:
  model: 'text-embedding-3-small'
  dimensions: 1536
  batchSize: 100

relationInference:
  # Stage 1: Chunk-level threshold
  similarityThreshold: 0.30

  # Stage 1: Document-level threshold (NEW)
  useDocumentThreshold: true
  documentThreshold: 0.25

  # Existing signals
  useSemanticSimilarity: true
  semanticWeight: 0.7
  useProjectMetadata: true
  projectWeight: 0.25
  useSchemaSignal: true
  schemaWeight: 0.20

metadata:
  experiment_series: 'EXP-008'
  stage: '1-two-stage-threshold'
  hypothesis: 'Document-level threshold reduces noise from single-chunk matches'
  baseline_f1: 86.0
  target_f1: 88
```

### Stage 2 Config

```yaml
# config/experiments/exp-008-stage-2-embedded-content.yaml
name: 'exp-008-stage-2-embedded-content'
description: 'Embedding preprocessing: stopword removal + stemming'
created_at: '2025-11-27'

embedding:
  model: 'text-embedding-3-small'
  dimensions: 1536
  batchSize: 100
  # Stage 2: Use preprocessed content for embedding (NEW)
  usePreprocessedContent: true
  preprocessing:
    removeStopwords: true
    applyStemming: true
    minWordLength: 3

relationInference:
  similarityThreshold: 0.30
  useDocumentThreshold: true
  documentThreshold: 0.25
  useSemanticSimilarity: true
  semanticWeight: 0.7
  useProjectMetadata: true
  projectWeight: 0.25
  useSchemaSignal: true
  schemaWeight: 0.20

metadata:
  experiment_series: 'EXP-008'
  stage: '2-embedded-content'
  hypothesis: 'Preprocessed embeddings capture semantic meaning better'
  baseline_f1: 88.0
  target_f1: 90
```

---

## Risk Assessment

### Risk 1: Recall 감소

**Likelihood**: Medium
**Impact**: Low-Medium

**Mitigation**:

- `documentThreshold`를 보수적으로 설정 (0.20-0.25)
- Recall이 95% 이하로 떨어지면 threshold 조정

### Risk 2: 전처리가 의미를 왜곡

**Likelihood**: Low
**Impact**: Medium

**Mitigation**:

- 스테밍 규칙을 보수적으로 적용
- 전문 용어는 스테밍에서 제외
- A/B 테스트로 검증

### Risk 3: 재임베딩 비용

**Likelihood**: High
**Impact**: Low

**Mitigation**:

- 66개 객체만 재임베딩 필요 (비용 minimal)
- 프로덕션에서는 점진적 마이그레이션

---

## Success Metrics

### Primary Metric

| Metric    | Current | Target | Success |
| --------- | ------- | ------ | ------- |
| F1 Score  | 86.0%   | 90%+   | ≥ 88%   |
| Precision | 76.0%   | 85%+   | ≥ 82%   |
| Recall    | 99.0%   | 95%+   | ≥ 93%   |

### Secondary Metrics

- Relations 수: 현재 472개 → 적절한 감소 (400-450개)
- False Positives: 현재 75개 → 50개 이하
- False Negatives: 현재 3개 → 10개 이하

---

## Validation Plan

### Stage 1 검증

1. 실험 실행: `pnpm tsx scripts/run-experiment.ts config/experiments/exp-008-stage-1-two-stage-threshold.yaml`
2. 결과 확인:
   - Precision이 80% 이상인가?
   - F1이 87% 이상인가?
   - Recall이 93% 이상인가?
3. 로그 분석:
   - Document threshold로 필터링된 문서 수
   - 제거된 False Positive 수

### Stage 2 검증

1. DB 마이그레이션 실행
2. 기존 청크 재처리
3. 재임베딩 실행
4. 실험 실행 및 결과 비교

---

## Deliverables

### Code

1. `packages/graph/src/relation-inferrer.ts` - 2단계 임계값 로직
2. `packages/chunking/src/preprocessor.ts` - 전처리 함수 (신규)
3. `db/migrations/XXX_add_embedded_content.sql` - DB 마이그레이션
4. `scripts/reprocess-chunks.ts` - 재처리 스크립트 (신규)

### Documentation

1. 이 실험 계획 문서 (EXP-008)
2. Stage 1 결과 문서
3. Stage 2 결과 문서
4. 최종 권장 설정

### Experiments

1. exp-008-stage-1-two-stage-threshold
2. exp-008-stage-2-embedded-content

---

## Next Steps (EXP-009 이후)

EXP-008 완료 후 고려할 옵션:

1. **Contrastive ICL** (논문 003 기반)
   - LLM 기반 관계 분류
   - 예상 F1 +10-15%
   - 비용 발생

2. **Context Chunks** (SuperMemory 패턴)
   - 매칭 청크 ± 1개 반환
   - LLM 컨텍스트 품질 개선

3. **Real Data Validation**
   - 실제 Linear/Zendesk 데이터 테스트
   - 프로덕션 준비도 검증

---

## References

- [SuperMemory Comparison](../research/05-supermemory-comparison.md) - 2단계 임계값, embeddedContent 패턴
- [RAG Best Practices Paper](../research/papers/summaries/003-enhancing-rag-best-practices.md) - Contrastive ICL, Focus Mode
- [EXP-006 Results](./EXP-006-stage-2-results.md) - Multi-Signal Fusion 결과
- [EXP-007 Results](../completed/EXP-007-schema-aware-fusion.md) - Schema-Aware Fusion 결과

---

## Appendix: Formula Evolution

### Current (EXP-007)

```
score = 0.385*semantic + 0.165*keyword + 0.25*project + 0.20*schema
threshold = 0.30 (single)
```

### After Stage 1

```
score = 0.385*semantic + 0.165*keyword + 0.25*project + 0.20*schema
chunkThreshold = 0.30
documentThreshold = 0.25 (average of chunk scores >= 0.25)
```

### After Stage 2

```
Same formula, but embeddings generated from preprocessed content:
- Original: "Login failed! User authentication error."
- Embedded: "login fail user authent error"
```
