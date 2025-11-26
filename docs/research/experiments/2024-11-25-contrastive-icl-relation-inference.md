# EXP-002: Contrastive ICL Relation Inference

```yaml
# Experiment Metadata
experiment_id: EXP-002
title: 'Contrastive In-Context Learning for Relation Inference'
date: 2024-11-25
author: 'Research Team'
status: completed
decision: rejected

# Related Resources
related_papers: ['003-Enhancing RAG Best Practices']
related_experiments: ['EXP-001']
config_file: 'config/experiments/2024-11-25-contrastive-icl.yaml'

# Tags
tags: ['relation-inference', 'contrastive-icl', 'llm', 'paper-003']
```

---

## 1. Background (배경)

### 1.1 Problem Statement

기존 relation inference는 cosine similarity + keyword overlap 기반으로 동작하며, EXP-001(baseline)에서 F1 65.9%를 달성했습니다. 이 성능을 개선하기 위해 LLM 기반 판단을 도입하고자 했습니다.

### 1.2 Current State

- **Baseline Method**: Cosine similarity (threshold 0.85) + Keyword overlap (threshold 0.65)
- **Baseline F1**: 65.9%
- **주요 문제**: False positive가 많이 발생 (precision 부족)

### 1.3 Related Work

**Paper 003: "Enhancing RAG: A Study of Best Practices" (University of Tubingen)**

핵심 발견:

- Contrastive In-Context Learning이 모든 RAG 변형 중 최고 성능
- TruthfulQA에서 +3.93% ROUGE-L 향상
- MMLU에서 +15% ROUGE-L 향상
- 정답/오답 예시를 함께 제공하여 모델의 판단력 향상

---

## 2. Hypothesis (가설)

### 2.1 Main Hypothesis

> "Contrastive In-Context Learning을 relation inference에 적용하면, LLM이 두 청크 간의 관계를 더 정확하게 판단하여 F1 score가 12% 이상 향상될 것이다."

### 2.2 Expected Outcomes

| Metric    | Baseline (EXP-001) | Expected | Improvement |
| --------- | ------------------ | -------- | ----------- |
| F1 Score  | 65.9%              | 78%+     | +12%+       |
| Precision | ~60%               | 70%+     | +10%+       |
| Recall    | ~80%               | 80%      | 유지        |

### 2.3 Success Criteria

- [ ] F1 Score >= 72% (최소 +6%)
- [ ] Precision >= 60%
- [ ] Recall >= 80%

---

## 3. Method (실험 방법)

### 3.1 Approach

1. 기존 cosine similarity 기반 inference를 비활성화
2. LLM (gpt-4o-mini)에 contrastive examples와 함께 두 청크를 제공
3. LLM이 RELATED/NOT_RELATED를 판단
4. 양방향 relation 생성

### 3.2 Implementation

#### Modified Files

```
packages/graph/src/relation-inferrer.ts  - Contrastive ICL 로직 추가
scripts/run-experiment.ts                - useContrastiveICL 플래그 지원
config/experiments/2024-11-25-contrastive-icl.yaml - 실험 설정
```

#### Key Code Changes

**relation-inferrer.ts:597-622** - Prompt 생성:

```typescript
private buildContrastivePrompt(chunk1: string, chunk2: string): string {
  // Format positive/negative examples
  // Replace placeholders with actual chunks
  return promptTemplate
    .replace('{{positiveExamples}}', positiveExamplesStr)
    .replace('{{negativeExamples}}', negativeExamplesStr)
    .replace('{{chunk1}}', chunk1)
    .replace('{{chunk2}}', chunk2);
}
```

**relation-inferrer.ts:704-706** - 청크 내용 추출:

```typescript
// Use title as chunk content for relation inference
const chunk1 = obj1.title || obj1.id;
const chunk2 = obj2.title || obj2.id;
```

### 3.3 Contrastive Examples

**Positive Examples:**

1. "Q3 매출이 15% 증가" ↔ "3분기 재무 실적이 예상 초과" → RELATED
2. "버그 수정: 로그인 오류 해결" ↔ "인증 시스템 안정성 개선" → RELATED
3. "새로운 API 엔드포인트 추가" ↔ "REST API 문서 업데이트 필요" → RELATED

**Negative Examples:**

1. "팀 미팅 월요일로 예정" ↔ "Q4 제품 출시 계획" → NOT_RELATED
2. "서버 메모리 사용량 높음" ↔ "신규 채용 공고 게시" → NOT_RELATED
3. "고객 피드백 수집 완료" ↔ "CI/CD 파이프라인 구성" → NOT_RELATED

### 3.4 Config

```yaml
relationInference:
  useSemanticSimilarity: false
  useContrastiveICL: true

  llmConfig:
    model: 'gpt-4o-mini'
    temperature: 0.1
    maxTokens: 100
```

---

## 4. Results (결과)

### 4.1 Test Output

```
[RelationInferrer] Contrastive ICL inference:
  - Objects: 10
  - Positive examples: 3
  - Negative examples: 3
  - LLM model: gpt-4o-mini
  - Progress: 45/45 pairs (10 related)

[RelationInferrer] Contrastive ICL Summary:
  - Total pairs: 45
  - Related pairs: 10
  - Relations created: 20

   Precision: 2.9%
   Recall: 12.5%
   F1 Score: 4.8%

⏱️ Duration: 33.8s
```

### 4.2 Metrics

| Metric          | Baseline (EXP-001) | EXP-002  | Delta      |
| --------------- | ------------------ | -------- | ---------- |
| F1 Score        | 65.9%              | **4.8%** | **-91.3%** |
| Precision       | -                  | 2.9%     | -          |
| Recall          | -                  | 12.5%    | -          |
| True Positives  | -                  | ~1       | -          |
| False Positives | -                  | ~19      | -          |
| False Negatives | -                  | ~7       | -          |

### 4.3 VS Baseline

- **F1 Change: -47.6%** (absolute drop from ~52.4% to 4.8%)
- **가설 완전 실패**: 향상 대신 91% 하락

---

## 5. Analysis (분석)

### 5.1 Hypothesis Validation

- [x] Main hypothesis: **REJECTED**

### 5.2 Root Cause Analysis - 3가지 핵심 문제 발견

#### Problem 1: Type Mismatch (치명적)

**Ground Truth Relation Types:**
| Type | Count |
|------|-------|
| works_at | 1 |
| assigned_to | 2 |
| triggered_by | 1 |
| related_to | 2 |
| created_by | 1 |
| resulted_in | 1 |
| **Total** | **8** |

**Inferred Relation Type:**

- 모든 relation이 `similar_to` 타입으로 생성됨 (relation-inferrer.ts:657)

**Validation Logic (run-experiment.ts:184):**

```typescript
const normalizeRelation = (rel: Relation) => `${rel.from_id}|${rel.to_id}|${rel.type}`;
```

**결과:**

```
Ground truth: alice|techcorp|works_at
Inferred:     alice|techcorp|similar_to
→ 타입이 달라서 절대 매칭되지 않음!
```

#### Problem 2: Example-Data Domain Mismatch

**Contrastive Examples:**

- "Q3 매출이 15% 증가" (재무 보고서)
- "버그 수정: 로그인 오류" (기술 이슈)
- "새로운 API 엔드포인트" (개발 작업)

**Actual Canonical Objects:**
| ID | Title |
|----|-------|
| user\|alice | Alice Johnson |
| user\|bob | Bob Smith |
| company\|techcorp | TechCorp |
| zendesk_ticket\|1234 | Login Error - TechCorp |
| slack_thread\|thread1 | Login Bug Discussion |
| linear_issue\|eng123 | Fix authentication issue |

**문제:**

- Examples는 문장 형태의 내용인데, 실제 데이터는 짧은 제목뿐
- 도메인이 완전히 다름 (재무/기술 vs 사람/회사/티켓)

#### Problem 3: Insufficient Context

**LLM에 전달되는 내용 (relation-inferrer.ts:705-706):**

```typescript
const chunk1 = obj1.title || obj1.id; // "Alice Johnson"
const chunk2 = obj2.title || obj2.id; // "TechCorp"
```

**LLM이 받는 프롬프트:**

```
청크 A: "Alice Johnson"
청크 B: "TechCorp"

응답: RELATED 또는 NOT_RELATED
```

→ "Alice Johnson"과 "TechCorp"만으로 works_at 관계를 추론하는 것은 **불가능**

### 5.3 Why the Metrics are So Bad

**계산 분석:**

- Ground truth: 8 relations (다양한 타입)
- Inferred: 20 relations (모두 `similar_to`)
- Type mismatch로 인해 거의 모든 매칭 실패
- 만약 `related_to` 타입 2개가 우연히 매칭되었다면:
  - TP ≈ 1
  - FP ≈ 19
  - FN ≈ 7
  - Precision = 1/20 = 5% (실제 2.9%)
  - Recall = 1/8 = 12.5% ✓

### 5.4 Limitations & Trade-offs

1. **Type-Agnostic Inference**: LLM은 "관련 있음/없음"만 판단, 구체적인 관계 유형(works_at, assigned_to 등)은 추론 불가
2. **Context 부족**: Title만으로는 의미있는 관계 추론이 불가능
3. **Example Quality**: In-domain examples 없이는 ICL 효과가 없음
4. **비용/지연**: 45 pairs × API call = 33.8초 (baseline 대비 느림)

---

## 6. Decision (결정)

### 6.1 Recommendation

**REJECTED** - 현재 구현으로는 production 적용 불가

### 6.2 Rationale

1. Type mismatch 문제가 해결되더라도, title만으로는 관계 추론 불가능
2. Ground truth에 맞는 specific relation type 추론이 필요
3. 비용/지연 대비 효과가 없음

### 6.3 Required Fixes for Re-testing

만약 재실험을 원한다면 다음 수정이 필요:

1. **Type-aware inference**: LLM이 관계 유형까지 판단하도록 프롬프트 수정

   ```
   응답: works_at | assigned_to | related_to | triggered_by | NOT_RELATED
   ```

2. **Full context 제공**: Title 대신 canonical object의 전체 내용 + metadata 제공

   ```typescript
   const chunk1 = `${obj1.title}\n${obj1.content}\nType: ${obj1.type}`;
   ```

3. **In-domain examples**: Ground truth에서 실제 예시 추출

   ```yaml
   positive:
     - chunk1: 'Alice Johnson (User, works at TechCorp)'
       chunk2: 'TechCorp (Company)'
       label: 'works_at'
   ```

4. **Validation 로직 수정**: Type-flexible 매칭 옵션 추가

   ```typescript
   // Option 1: Type-flexible matching
   const normalizeRelation = (rel: Relation) =>
     `${rel.from_id}|${rel.to_id}`;  // type 제외

   // Option 2: Type mapping
   const typeMap = { similar_to: ['related_to', 'works_at', ...] };
   ```

### 6.4 Next Steps

- [x] ~~EXP-003: Type-aware relation inference 실험 설계~~ → **취소 (아래 추가 분석 참조)**
- [x] **EXP-003: Schema-based relation extraction** → 새로운 방향

---

## 8. Additional Analysis (추가 분석)

### 8.1 Type-Agnostic 재평가

Type mismatch 문제를 제거하고 재평가 진행:

```
스크립트: scripts/analyze-type-agnostic.ts
방법: from_id|to_id만 비교 (type 무시)
```

**결과:**

| Metric    | Type 포함 | Type-Agnostic | Baseline |
| --------- | --------- | ------------- | -------- |
| Precision | 2.9%      | 30.0%         | -        |
| Recall    | 12.5%     | 37.5%         | -        |
| F1 Score  | 4.8%      | **33.3%**     | 65.9%    |

**분석:**

- Type-agnostic으로 해도 baseline(65.9%)보다 **32.6% 낮음**
- Type mismatch는 원인의 일부일 뿐, 근본 문제는 다른 곳에 있음

### 8.2 Contrastive ICL 실패 조건 분석

Contrastive ICL이 실패하는 7가지 조건 중 해당하는 것:

| #   | 실패 조건                     | 해당 여부     |
| --- | ----------------------------- | ------------- |
| 1   | Positive/Negative 차이가 약함 | 부분적        |
| 2   | 부정 예시 설계 오류           | **해당**      |
| 3   | 비교 학습에 부적합한 태스크   | 부분적        |
| 4   | **Prompt 구조적 정보 부족**   | **핵심 원인** |
| 5   | 모델 용량 부족                | 아니오        |
| 6   | Shortcut learning             | **해당**      |
| 7   | 예시 간 일관성 부족           | 아니오        |

**핵심**: Title만으로는 LLM이 "구분 규칙"을 유추할 힌트가 없음

### 8.3 결정적 발견: 데이터에 이미 관계 정보 존재

```sql
SELECT id, actors FROM canonical_objects;

-- 결과:
-- zendesk_ticket|1234: {"assignee": "bob", "created_by": "alice"}
-- slack_thread|thread1: {"created_by": "bob", "participants": ["bob", "charlie"]}
```

**발견:**

- `actors` 필드에 관계 정보가 이미 있음
- LLM 추론이 필요 없음 - 스키마에서 직접 읽으면 됨
- 이것이 현업에서 사용하는 표준 방식

### 8.4 최종 결론

```
LLM 기반 관계 추론 vs 스키마 기반 추출

| 항목 | LLM 추론 | 스키마 기반 |
|------|----------|------------|
| 정확도 | 33.3% F1 | ~100% |
| 비용 | $0.01/45쌍 | $0 |
| 속도 | 30초 | <1초 |
| 확장성 | O(n²) | O(n) |
```

**결론**: 스키마에 관계 정보가 있으면 LLM 추론은 불필요하고 비효율적

---

## 9. References

- Paper 003: "Enhancing RAG: A Study of Best Practices" (University of Tubingen)
- EXP-001: Baseline relation inference (F1: 65.9%)
- Config: `config/experiments/2024-11-25-contrastive-icl.yaml`

---

## Lessons Learned

1. **Validation과 Inference의 일관성 확인**: 생성하는 relation type과 ground truth type이 일치해야 함
2. **Sufficient Context**: LLM 기반 추론에는 충분한 컨텍스트가 필수
3. **In-domain Examples**: ICL은 target domain과 유사한 예시가 있어야 효과적
4. **점진적 실험**: 한 번에 여러 변수를 바꾸지 말고, 단일 변수씩 테스트

---

## Changelog

| Date       | Author        | Change                                |
| ---------- | ------------- | ------------------------------------- |
| 2024-11-25 | Research Team | Initial experiment run                |
| 2024-11-25 | Research Team | Root cause analysis and documentation |
| 2024-11-25 | Research Team | Type-agnostic 재평가 (33.3% F1)       |
| 2024-11-25 | Research Team | 스키마 데이터 발견, EXP-003 방향 전환 |
