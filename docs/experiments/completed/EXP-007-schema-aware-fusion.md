# EXP-007: Schema-Aware Fusion - Results

```yaml
# Experiment Metadata
experiment_id: EXP-007
title: 'Schema-Aware Fusion for Relation Inference'
date: 2025-11-27
author: 'William Jung'
status: completed
type: results

# Performance Metrics
baseline_f1: 0.861
result_f1: 0.860
precision: 0.760
recall: 0.990

# Related Resources
related_experiments: ['EXP-006-STAGE-2', 'EXP-003']
config_file: 'config/experiments/exp-007-four-signal-fusion.yaml'

# Tags
tags: ['four-signal-fusion', 'schema-signal', 'actor-overlap', 'relation-inference', 'exp-007']

# Decision
decision: completed
```

**실험 날짜**: 2025-11-27
**실험 ID**: #60
**담당자**: William Jung

---

## 🎯 목표 (Objective)

EXP-006에서 달성한 F1 86.1%를 90%+로 향상시키기 위해 Schema-based signal (actor overlap, explicit links) 추가

Add schema-based signal (actor overlap, explicit links, parent-child relationships) as a fourth signal to improve F1 from 86.1% to target 90%+

---

## 📊 결과 요약 (Results Summary)

### **유사 성능 유지 (Comparable Performance)**

| Metric          | EXP-006 (Baseline) | EXP-007 (Schema-Aware) | Change |
| --------------- | ------------------ | ---------------------- | ------ |
| **F1 Score**    | 86.1%              | **86.0%**              | -0.1%  |
| **Precision**   | 75.7%              | **76.0%**              | +0.4%  |
| **Recall**      | 100.0%             | **99.0%**              | -1.0%  |
| Relations       | 488                | 472                    | -3.3%  |
| True Positives  | 241                | 238                    | -1.2%  |
| False Positives | 77                 | 75                     | -2.6%  |
| False Negatives | 0                  | 3                      | +3     |

### Key Findings

1. **성능 유지**: F1 86.0%로 기존 성능 유지
2. **Precision 미세 개선**: 75.7% → 76.0% (+0.3%p)
3. **Schema 신호 효과 제한적**: 합성 데이터에서 actor 분포가 분산되어 있어 효과 미미
4. **4-Signal 인프라 구축 완료**: 향후 실제 데이터에서 활용 가능

---

## 🔬 구현 세부사항 (Implementation Details)

### Formula Evolution

#### EXP-006 (3-Signal Fusion)

```typescript
score = 0.49 * semantic_sim + 0.21 * keyword_sim + 0.3 * project_sim;
threshold = 0.3;
```

#### EXP-007 (4-Signal Fusion)

```typescript
// Four-signal fusion
baseWeight = 1 - (projectWeight + schemaWeight) = 1 - (0.25 + 0.20) = 0.55
semanticW = 0.7 * 0.55 = 0.385
keywordW = 0.3 * 0.55 = 0.165
projectW = 0.25
schemaW = 0.20

score = 0.385 * semantic_sim + 0.165 * keyword_sim + 0.25 * project_sim + 0.20 * schema_sim
threshold = 0.30
```

### Schema Similarity Signals

| Signal                     | Description                            | Weight       | Condition            |
| -------------------------- | -------------------------------------- | ------------ | -------------------- |
| **Same Assignee**          | Objects assigned to same person        | 1.0          | Any assignee overlap |
| **Same Creator**           | Objects created by same person         | 0.7          | Exact match          |
| **Participant Overlap**    | Slack threads with common participants | 0.5 \* ratio | Overlap / min(size)  |
| **Explicit Link**          | Direct issue/PR links                  | 1.0          | One links to other   |
| **Parent-Child**           | Direct hierarchy                       | 1.0          | parent_id match      |
| **Same Parent (Siblings)** | Same parent node                       | 0.8          | Shared parent_id     |

### Schema Similarity Calculation

```typescript
private calculateSchemaSimilarity(obj1: CanonicalObject, obj2: CanonicalObject): number {
  let score = 0;
  let signals = 0;

  // Parse actors (handle JSON string from DB)
  const actors1 = typeof obj1.actors === 'string' ? JSON.parse(obj1.actors) : obj1.actors || {};
  const actors2 = typeof obj2.actors === 'string' ? JSON.parse(obj2.actors) : obj2.actors || {};

  // Signal 1: Same assignee
  const assignees1 = new Set(actors1.assignees || []);
  const assignees2 = new Set(actors2.assignees || []);
  if (assignees1.size > 0 && assignees2.size > 0) {
    const overlap = [...assignees1].filter(a => assignees2.has(a)).length;
    if (overlap > 0) score += 1.0;
    signals++;
  }

  // Signal 2: Same creator
  if (actors1.created_by && actors2.created_by) {
    if (actors1.created_by === actors2.created_by) score += 0.7;
    signals++;
  }

  // ... (additional signals)

  return signals === 0 ? 0 : Math.min(score / signals, 1.0);
}
```

### Files Modified

1. **`packages/graph/src/relation-inferrer.ts`**
   - Added `calculateSchemaSimilarity()` method (lines 321-418)
   - Added `useSchemaSignal` and `schemaWeight` options (lines 76-81)
   - Integrated 4-signal fusion logic (lines 605-642)
   - Added schema metadata to relations (lines 649-652)

2. **`packages/pipeline/src/types.ts`**
   - Added `useSchemaSignal?: boolean` to relationInference config
   - Added `schemaWeight?: number` to relationInference config

3. **`packages/pipeline/src/stages/validation-stage.ts`**
   - Pass schema options to RelationInferrer constructor

4. **`config/experiments/exp-007-four-signal-fusion.yaml`**
   - Created new experiment configuration

---

## 📈 상세 분석 (Detailed Analysis)

### Why Schema Signal Had Limited Effect

#### 1. **합성 데이터의 Actor 분포**

```sql
-- Same project (search-enhancement) actor comparison
id1                          | id2                          | same_creator
linear-search-enhancement-1  | linear-search-enhancement-2  | true  (quinn)
linear-search-enhancement-1  | linear-search-enhancement-3  | false (quinn vs peter)
linear-search-enhancement-2  | linear-search-enhancement-4  | false (quinn vs peter)
linear-search-enhancement-3  | linear-search-enhancement-4  | true  (peter)
```

- 같은 프로젝트 내에서도 creator/assignee가 분산됨
- Schema 신호가 1이 되는 케이스가 제한적

#### 2. **Project 신호와의 중복**

- Schema 신호가 높은 페어 = 이미 같은 프로젝트
- Project 신호만으로도 이미 threshold를 통과
- 추가 개선 여지가 제한적

#### 3. **Explicit Links 부재**

- 합성 데이터에 cross-object links가 없음
- `linked_issues`, `linked_prs` 필드가 비어있음
- 실제 데이터에서는 더 효과적일 것으로 예상

### Precision 개선 분석

```
EXP-006: 77 FP → EXP-007: 75 FP (-2 FP)
```

- Schema 신호가 일부 false positive를 걸러냄
- 같은 프로젝트지만 다른 담당자 = 관련성 낮음

---

## 🎓 교훈 (Lessons Learned)

### What Worked

1. **4-Signal 인프라 구축 완료**
   - Schema 신호 계산 로직 구현
   - 확장 가능한 multi-signal fusion 아키텍처

2. **JSON 파싱 처리**
   - DB에서 가져온 JSON 문자열 자동 파싱
   - `actors`, `relations` 필드 모두 지원

3. **Backward Compatibility**
   - 기존 3-signal fusion 코드 유지
   - `useSchemaSignal: false`로 기존 동작 보장

### What Could Be Improved

1. **실제 데이터 테스트 필요**
   - 합성 데이터의 actor 분포가 비현실적
   - 실제 Linear/Zendesk에서는 같은 담당자가 관련 이슈 처리하는 패턴 강함

2. **Explicit Links 데이터 필요**
   - `linked_issues`, `linked_prs` 데이터 추가 필요
   - Parent-child 관계 데이터도 보강 필요

3. **Weight 최적화**
   - Grid search로 최적 weight 조합 탐색 필요
   - 현재 weight는 heuristic 기반

---

## 📋 다음 단계 (Next Steps)

### Option 1: Real Data Validation

- **우선순위: 높음**
- 실제 Linear/Zendesk/Slack 데이터에서 테스트
- Actor 패턴이 더 일관적일 것으로 예상
- 예상 효과: Schema 신호가 더 강력하게 작용

### Option 2: Temporal Proximity Signal

- **우선순위: 중간**
- 시간적으로 가까운 이벤트 = 관련 가능성 높음
- 5-Signal Fusion으로 확장

### Option 3: Weight Grid Search

- **우선순위: 중간**
- 4가지 신호의 최적 weight 조합 탐색
- 현재 heuristic 기반 → data-driven 최적화

### Option 4: Production Schema Enhancement

- **우선순위: 낮음 (장기)**
- CanonicalObject에 `project_id` 필드 추가
- `metadata` 필드에 구조화된 프로젝트 정보 저장

---

## 🔗 관련 문서 (Related Documents)

- [EXP-006: Multi-Signal Fusion Results](./EXP-006-stage-2-results.md)
- [EXP-003: Schema-Based Relations (Early Attempt)](../rejected/EXP-004-relation-inference-optimization.md)
- [EXP-007 Config](../../config/experiments/exp-007-four-signal-fusion.yaml)

---

## 💾 실험 재현 (Reproduce Experiment)

```bash
# Run EXP-007 experiment
pnpm tsx scripts/run-experiment.ts config/experiments/exp-007-four-signal-fusion.yaml

# Expected results:
# F1: 86.0%
# Precision: 76.0%
# Recall: 99.0%
```

---

## 📌 결론 (Conclusion)

**EXP-007은 4-Signal Fusion 인프라를 성공적으로 구축했습니다.**

- 🎯 Target: F1 90%+
- ✅ Achieved: F1 86.0% (기존 성능 유지)
- 🔧 Infrastructure: 4-Signal fusion 완성
- 📈 Next: Real data validation recommended

**합성 데이터에서는 Schema 신호의 효과가 제한적이지만, 실제 데이터에서는 더 큰 효과가 기대됩니다.**

In synthetic data, the schema signal had limited effect because actors are uniformly distributed across projects. In production data where the same person typically handles related issues, the schema signal should provide significant improvements.

**Recommendation**: Test on real production data where actor patterns are more realistic, then optimize weights based on results.
