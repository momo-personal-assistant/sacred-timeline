# EXP-008 Stage 1: Two-Stage Threshold - Results

```yaml
# Experiment Metadata
experiment_id: EXP-008-STAGE-1
title: 'Two-Stage Threshold (SuperMemory Pattern)'
date: 2025-11-27
author: 'William Jung'
status: completed
type: results

# Performance Metrics
baseline_f1: 0.860
result_f1: 0.860
precision: 0.760
recall: 0.990

# Related Resources
related_experiments: ['EXP-007']
config_file: 'config/experiments/exp-008-stage-1-two-stage-threshold.yaml'

# Tags
tags: ['two-stage-threshold', 'document-threshold', 'supermemory-pattern', 'exp-008']

# Decision
decision: infrastructure-complete
```

**실험 날짜**: 2025-11-27
**실험 ID**: #63, #64
**담당자**: William Jung

---

## 🎯 목표 (Objective)

SuperMemory의 Two-Stage Threshold 패턴을 적용하여 False Positive를 줄이고 Precision을 개선

Apply SuperMemory's two-stage threshold pattern to reduce false positives and improve precision.

---

## 📊 결과 요약 (Results Summary)

### **인프라 구축 완료, 효과 검증은 추후 필요**

| Metric                 | EXP-007 (Baseline) | EXP-008 Stage 1 | Change |
| ---------------------- | ------------------ | --------------- | ------ |
| **F1 Score**           | 86.0%              | **86.0%**       | ±0%    |
| **Precision**          | 76.0%              | **76.0%**       | ±0%    |
| **Recall**             | 99.0%              | **99.0%**       | ±0%    |
| Relations              | 472                | 472             | ±0     |
| Project Pairs Filtered | N/A                | 0               | -      |

### Key Findings

1. **인프라 구축 완료**: Two-stage threshold 로직 성공적으로 구현
2. **합성 데이터에서 효과 없음**: Ground Truth가 같은 프로젝트 내 관계로만 구성
3. **Stage 1에서 이미 필터링**: Cross-project 관계는 chunk threshold에서 이미 제거됨
4. **실제 데이터에서 효과 예상**: Cross-project 노이즈가 있는 환경에서 효과적일 것

---

## 🔬 구현 세부사항 (Implementation Details)

### Two-Stage Threshold Logic

```typescript
// Stage 1: Chunk-level threshold (existing)
if (combinedSim >= 0.3) {
  // Individual pair passes
}

// Stage 2: Document-level threshold (NEW)
// Group by project pairs
const projectPairScores = new Map<string, { scores: number[]; relations: Relation[] }>();

// Filter by average score
for (const [key, data] of projectPairScores) {
  const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
  const matchCount = scores.length;

  // Same-project pairs always pass
  // Cross-project pairs need: avgScore >= documentThreshold AND matchCount >= minChunkMatches
  if (isSameProject || (avgScore >= 0.25 && matchCount >= 1)) {
    // Keep relations
  }
}
```

### Files Modified

1. **`packages/graph/src/relation-inferrer.ts`**
   - Added `useDocumentThreshold`, `documentThreshold`, `minChunkMatches` options
   - Added `applyDocumentThreshold()` method for Stage 2 filtering
   - Added logging for document-level filtering stats

2. **`packages/pipeline/src/types.ts`**
   - Added two-stage threshold options to `PipelineConfig.relationInference`

3. **`packages/pipeline/src/stages/validation-stage.ts`**
   - Pass two-stage threshold options to RelationInferrer

4. **`config/experiments/exp-008-stage-1-two-stage-threshold.yaml`**
   - Created experiment configuration

---

## 📈 상세 분석 (Detailed Analysis)

### Why No Effect in Current Data?

#### 1. **Ground Truth 구조**

```
Ground Truth Relations:
- linear-auth-revamp-1 <-> linear-auth-revamp-2 (같은 프로젝트)
- zendesk-search-enhancement-1 <-> linear-search-enhancement-1 (같은 프로젝트)
- ...

모든 GT 관계가 같은 프로젝트 내에서만 정의됨
```

#### 2. **Stage 1에서 이미 필터링**

```
Cross-project pair example:
  - linear-auth-revamp-1 <-> linear-search-enhancement-1
  - semantic sim: 0.15
  - project sim: 0.0
  - combined sim: 0.058 (< 0.30 threshold)
  - Result: FILTERED at Stage 1 (chunk level)
```

Cross-project 관계는 project similarity = 0이므로 combined score가 낮아 Stage 1에서 이미 걸러짐

#### 3. **Same-project Bypass**

```typescript
// Same-project pairs always pass Stage 2
const isSameProject = key.split('|')[0] === key.split('|')[1];
if (isSameProject) {
  // Always keep - no filtering applied
}
```

현재 모든 관계가 같은 프로젝트 내이므로 Stage 2 필터링이 적용되지 않음

### When Will Two-Stage Threshold Be Effective?

| Scenario                               | Stage 1 | Stage 2   | Effect              |
| -------------------------------------- | ------- | --------- | ------------------- |
| Same-project, high similarity          | ✅ Pass | ✅ Bypass | Keep (correct)      |
| Same-project, low similarity           | ❌ Fail | -         | Filter (correct)    |
| Cross-project, high similarity (noise) | ✅ Pass | ❌ Filter | **Filter (target)** |
| Cross-project, low similarity          | ❌ Fail | -         | Filter (correct)    |

**Target scenario**: Cross-project 관계가 Stage 1을 통과했지만 일관성이 없는 경우 (일부 페어만 높은 유사도)

---

## 🎓 교훈 (Lessons Learned)

### What Worked

1. **로직 구현 성공**
   - Two-stage threshold 로직 정상 작동
   - Project pair 단위 aggregation 구현
   - 로깅 및 디버깅 기능 추가

2. **설정 확장성**
   - `documentThreshold`, `minChunkMatches` 파라미터화
   - 실험별 튜닝 가능

3. **Backward Compatibility**
   - `useDocumentThreshold: false`로 기존 동작 유지
   - 기존 실험 영향 없음

### What Could Be Improved

1. **실제 데이터 테스트 필요**
   - Cross-project 노이즈가 있는 실제 데이터에서 검증 필요
   - 합성 데이터의 한계

2. **Ground Truth 확장**
   - Cross-project 관계도 포함한 GT 필요
   - Negative 샘플 (관련 없는 관계) 명시적 포함

---

## 📋 다음 단계 (Next Steps)

### EXP-008 Stage 2: Embedding Preprocessing

- **우선순위: 높음**
- embeddedContent 전처리 (불용어 제거, 스테밍)
- 임베딩 품질 개선으로 직접적인 성능 향상 기대

### Real Data Validation

- **우선순위: 높음**
- 실제 Linear/Zendesk 데이터에서 테스트
- Cross-project 노이즈가 있는 환경에서 효과 검증

### Threshold Tuning

- **우선순위: 낮음**
- 실제 데이터에서 optimal documentThreshold 탐색
- minChunkMatches 최적화

---

## 🔗 관련 문서 (Related Documents)

- [EXP-008 Plan](../plans/EXP-008-two-stage-threshold-plan.md)
- [EXP-007 Results](./EXP-007-schema-aware-fusion.md)
- [SuperMemory Comparison](../research/05-supermemory-comparison.md)

---

## 💾 실험 재현 (Reproduce Experiment)

```bash
# Run EXP-008 Stage 1 experiment
pnpm tsx scripts/run-experiment.ts config/experiments/exp-008-stage-1-two-stage-threshold.yaml

# Run with stricter threshold
pnpm tsx scripts/run-experiment.ts config/experiments/exp-008-stage-1b-strict-threshold.yaml

# Expected results (on current synthetic data):
# F1: 86.0%
# Precision: 76.0%
# Recall: 99.0%
# (Same as EXP-007 - no filtering applied due to data structure)
```

---

## 📌 결론 (Conclusion)

**EXP-008 Stage 1은 Two-Stage Threshold 인프라를 성공적으로 구축했습니다.**

- ✅ Infrastructure: Two-stage threshold 로직 구현 완료
- ⚠️ Current Effect: 합성 데이터에서 효과 없음 (예상된 결과)
- 🔮 Future Potential: 실제 데이터에서 cross-project 노이즈 제거에 효과적일 것

**합성 데이터의 구조적 한계로 인해 효과를 검증할 수 없었지만, 인프라는 준비되었습니다.**

The two-stage threshold infrastructure is complete and ready for production data where cross-project noise exists. In the current synthetic data, all relations are within the same project, so Stage 2 filtering has no effect.

**Recommendation**: Proceed with Stage 2 (embedding preprocessing) which can provide direct improvements on current data, then validate both stages on real production data.
