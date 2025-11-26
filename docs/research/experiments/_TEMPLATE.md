# Experiment Report Template

> 이 템플릿을 복사하여 새 실험 문서를 작성하세요.
> 파일명: `YYYY-MM-DD-experiment-name.md`

---

```yaml
# Experiment Metadata
experiment_id: EXP-XXX
title: '[실험 제목]'
date: YYYY-MM-DD
author: '[작성자]'
status: planned | in_progress | completed | abandoned
decision: pending | adopted | rejected | needs_more_data

# Related Resources
related_papers: [] # e.g., ["001-Canonical Data Models"]
related_experiments: [] # e.g., ["EXP-001", "EXP-002"]
config_file: '' # e.g., "config/experiments/exp-xxx.yaml"

# Tags
tags: [] # e.g., ["relation-inference", "duplicate-detection", "performance"]
```

---

## 1. Background (배경)

### 1.1 Problem Statement

<!-- 해결하려는 문제가 무엇인가? -->

### 1.2 Current State

<!-- 현재 시스템은 어떻게 동작하는가? -->

### 1.3 Related Work

<!-- 관련 논문, 기존 실험, 참고 자료 -->

---

## 2. Hypothesis (가설)

### 2.1 Main Hypothesis

<!-- 핵심 가설: "X를 하면 Y가 개선될 것이다" -->

### 2.2 Expected Outcomes

<!-- 기대하는 결과 -->

| Metric  | Current | Expected | Improvement |
| ------- | ------- | -------- | ----------- |
| [지표1] | -       | -        | -           |
| [지표2] | -       | -        | -           |

### 2.3 Success Criteria

<!-- 실험 성공 기준 -->

- [ ] Criterion 1
- [ ] Criterion 2

---

## 3. Method (실험 방법)

### 3.1 Approach

<!-- 어떤 방식으로 접근하는가? -->

### 3.2 Implementation

#### Modified Files

```
path/to/file1.ts  - [변경 내용]
path/to/file2.ts  - [변경 내용]
```

#### Key Code Changes

```typescript
// 핵심 코드 변경 사항
```

### 3.3 Test Plan

<!-- 어떻게 테스트할 것인가? -->

```bash
# 테스트 실행 방법
pnpm tsx scripts/test-xxx.ts
```

### 3.4 Config (실험 설정)

```yaml
# config/experiments/exp-xxx.yaml
name: '[실험명]'
description: '[설명]'

# 실험 파라미터
parameters:
  param1: value1
  param2: value2

# 비교 대상 (baseline)
baseline:
  param1: original_value1
  param2: original_value2
```

---

## 4. Results (결과)

### 4.1 Test Output

```
[테스트 실행 결과]
```

### 4.2 Metrics

| Metric  | Baseline | Experiment | Delta |
| ------- | -------- | ---------- | ----- |
| [지표1] | -        | -          | -     |
| [지표2] | -        | -          | -     |

### 4.3 Observations

<!-- 관찰된 사항들 -->

---

## 5. Analysis (분석)

### 5.1 Hypothesis Validation

<!-- 가설이 검증되었는가? -->

- [ ] Main hypothesis: **Validated / Partially Validated / Rejected**

### 5.2 Unexpected Findings

<!-- 예상치 못한 발견 -->

### 5.3 Limitations

<!-- 한계점 -->

### 5.4 Trade-offs

<!-- 트레이드오프 -->

---

## 6. Decision (결정)

### 6.1 Recommendation

<!-- 권장 사항: Adopt / Reject / Further Testing -->

### 6.2 Rationale

<!-- 결정 이유 -->

### 6.3 Next Steps

<!-- 다음 단계 -->

- [ ] Step 1
- [ ] Step 2

---

## 7. References

- [Reference 1](link)
- [Reference 2](link)

---

## Changelog

| Date       | Author   | Change        |
| ---------- | -------- | ------------- |
| YYYY-MM-DD | [Author] | Initial draft |
