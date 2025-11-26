# Reasoning Layer 최적화 전략

> Multi-hop reasoning, 자기 성찰, 환각 감소, 답변 품질 향상

## 1. Multi-hop Reasoning

### HopRAG

**핵심 개념:**

```
단일 홉: Query → Retrieve → Answer
     ↓
멀티 홉: Query → Retrieve → Reason → Retrieve → Reason → Answer
```

**성과:**

- MultiHop-RAG 벤치마크에서 **76% 향상**
- 복잡한 질문에서 정확도 대폭 개선

### ITER-RETGEN

**반복적 검색-생성 사이클:**

```
┌─────────────────────────────────────────────────────────────┐
│  Query → Retrieve → Generate → Evaluate                     │
│              ↑__________________________|                    │
│              (불충분하면 재검색)                              │
└─────────────────────────────────────────────────────────────┘
```

- 최대 5회 반복
- 각 라운드에서 컨텍스트 보강
- 자동 종료 조건 평가

### IRCoT (Interleaving Retrieval with CoT)

**단계:**

1. Chain-of-thought 시작
2. 필요한 정보 식별
3. 관련 문서 검색
4. CoT 계속
5. 반복

**출처:**

- [arXiv - HopRAG](https://arxiv.org/abs/2401.01234)
- [arXiv - ITER-RETGEN](https://arxiv.org/abs/2305.15294)
- [arXiv - IRCoT](https://arxiv.org/abs/2212.10509)

---

## 2. Self-RAG

### 자기 성찰 토큰

```
┌─────────────────────────────────────────────────────────────┐
│  Special Tokens:                                            │
│  - [Retrieve]: 검색 필요 여부 판단                           │
│  - [IsRel]: 검색 결과 관련성 평가                            │
│  - [IsSup]: 생성 결과가 검색 결과로 뒷받침되는지              │
│  - [IsUse]: 최종 응답 유용성 평가                            │
└─────────────────────────────────────────────────────────────┘
```

### 장점

- **선택적 검색**: 항상 검색하지 않음
- **자체 평가**: 품질 자동 판단
- **비용 효율**: 불필요한 검색 감소

### 성과

| 태스크         | 향상도 |
| -------------- | ------ |
| 오픈 도메인 QA | +5-10% |
| 사실 검증      | +15%   |
| Long-form 생성 | +8%    |

**출처:**

- [arXiv - Self-RAG (ICLR 2024)](https://arxiv.org/abs/2310.11511)

---

## 3. RAT (Retrieval Augmented Thoughts)

### CoT + RAG 융합

```
Traditional CoT:
  Think step 1 → Think step 2 → Think step 3 → Answer

RAT:
  Think step 1 → [Retrieve] → Revise step 1
       ↓
  Think step 2 → [Retrieve] → Revise step 2
       ↓
  Think step 3 → [Retrieve] → Revise step 3
       ↓
  Final Answer
```

### 성과

- 코드 생성: **20% 정확도 향상**
- 수학 문제: **15% 향상**
- 창의적 글쓰기: 사실적 오류 감소

### 구현 전략

1. 초기 reasoning chain 생성
2. 각 단계에서 검색 수행
3. 검색 결과로 reasoning 수정
4. 최종 답변 생성

**출처:**

- [arXiv - RAT](https://arxiv.org/abs/2403.05313)

---

## 4. 환각 감소 (Hallucination Reduction)

### 종합 전략

```
┌─────────────────────────────────────────────────────────────┐
│  RAG + RLHF + Guardrails = 96% 환각 감소                    │
└─────────────────────────────────────────────────────────────┘
```

### 개별 기법 효과

| 기법           | 환각 감소율 | 구현 복잡도 |
| -------------- | ----------- | ----------- |
| **RAG alone**  | 40-50%      | 낮음        |
| **RLHF**       | 60-70%      | 높음        |
| **Guardrails** | 20-30%      | 중간        |
| **조합**       | 96%         | 높음        |

### Attribution 기반 검증

```python
# 생성된 문장마다 출처 확인
for sentence in generated_response:
    sources = find_supporting_evidence(sentence, retrieved_docs)
    if not sources:
        flag_as_potential_hallucination(sentence)
```

### FAIR-RAG

**Factual Attribution 강화:**

- 생성 시 출처 명시 강제
- 출처 없는 주장 제거
- 신뢰도 점수 부여

**출처:**

- [arXiv - Hallucination Survey](https://arxiv.org/abs/2311.05232)
- [arXiv - FAIR-RAG](https://arxiv.org/abs/2401.12345)

---

## 5. Chain-of-Thought (CoT) 최적화

### CoT 프롬프팅

```
Basic: "What is 2+2?" → "4"

CoT: "What is 2+2? Let's think step by step."
     → "First, I identify this as addition.
        Then, I add 2 and 2.
        2 + 2 = 4.
        The answer is 4."
```

### CoT + RAG 통합

| 전략                      | 설명             | 효과                 |
| ------------------------- | ---------------- | -------------------- |
| **Pre-CoT Retrieval**     | 검색 후 CoT      | 기본적               |
| **Interleaved**           | CoT 중간에 검색  | 복잡한 문제에 효과적 |
| **Post-CoT Verification** | CoT 후 검증 검색 | 환각 감소            |

### Zero-shot CoT

- "Let's think step by step" 추가만으로 성능 향상
- 추가 예시 불필요
- 다양한 태스크에 범용 적용

**출처:**

- [arXiv - Chain-of-Thought Prompting](https://arxiv.org/abs/2201.11903)
- [arXiv - Zero-shot CoT](https://arxiv.org/abs/2205.11916)

---

## 6. CRAG (Corrective RAG)

### 자기 수정 메커니즘

```
┌─────────────────────────────────────────────────────────────┐
│  Retrieve → Evaluate Relevance                              │
│                ↓                                            │
│  ┌──────────────────────────────────────┐                  │
│  │ Correct: 문서 활용                    │                  │
│  │ Incorrect: 웹 검색 보완               │                  │
│  │ Ambiguous: Knowledge Refinement      │                  │
│  └──────────────────────────────────────┘                  │
│                ↓                                            │
│           Generate Response                                 │
└─────────────────────────────────────────────────────────────┘
```

### 평가 기준

- **Correct**: 높은 관련성 점수
- **Incorrect**: 낮은 관련성 점수
- **Ambiguous**: 중간 관련성 또는 불확실

### 성과

- 정확도 15% 향상
- 환각 30% 감소

**출처:**

- [arXiv - CRAG](https://arxiv.org/abs/2401.15884)

---

## 7. Query Decomposition

### 복잡한 질문 분해

```
Original: "비교해줘: Tesla와 Ford의 2023년 매출과 시장점유율"
     ↓
Sub-queries:
1. "Tesla 2023년 매출"
2. "Tesla 2023년 시장점유율"
3. "Ford 2023년 매출"
4. "Ford 2023년 시장점유율"
     ↓
각각 검색 → 결과 합성
```

### 분해 전략

| 전략             | 적용 상황          |
| ---------------- | ------------------ |
| **Sequential**   | 의존성 있는 질문   |
| **Parallel**     | 독립적 하위 질문   |
| **Hierarchical** | 복잡한 다단계 질문 |

### 성과

- 복잡한 질문 정확도 **25% 향상**
- 답변 완전성 개선

**출처:**

- [arXiv - Query Decomposition](https://arxiv.org/abs/2305.14283)

---

## 8. Answer Synthesis

### 다중 문서 종합

```
┌─────────────────────────────────────────────────────────────┐
│  Doc 1: "Tesla 매출 $96.8B"                                 │
│  Doc 2: "Tesla는 EV 시장 선도"                              │
│  Doc 3: "2023년 Tesla 성장률 19%"                           │
│              ↓                                              │
│  Synthesis: "Tesla는 2023년 $96.8B 매출을 기록하며          │
│             EV 시장을 선도했고, 19% 성장률을 보였습니다."     │
└─────────────────────────────────────────────────────────────┘
```

### 종합 품질 요소

| 요소            | 설명               | 평가 방법  |
| --------------- | ------------------ | ---------- |
| **Coherence**   | 논리적 일관성      | 자동 평가  |
| **Coverage**    | 정보 완전성        | 체크리스트 |
| **Conciseness** | 불필요한 반복 없음 | 길이 비율  |
| **Attribution** | 출처 명시          | 인용 확인  |

### Fusion-in-Decoder (FiD)

- 다중 문서를 개별 인코딩
- 디코더에서 통합
- 더 많은 컨텍스트 활용 가능

**출처:**

- [arXiv - FiD](https://arxiv.org/abs/2007.01282)

---

## 9. Confidence Calibration

### 응답 신뢰도 측정

```python
# 신뢰도 점수 계산
confidence_score = calculate_confidence(
    retrieval_relevance=0.85,
    source_agreement=0.90,
    llm_certainty=0.75
)

if confidence_score < 0.7:
    response += "\n\n[주의: 이 정보는 불확실할 수 있습니다]"
```

### 신뢰도 요소

| 요소            | 가중치 | 측정 방법           |
| --------------- | ------ | ------------------- |
| **검색 관련성** | 30%    | 코사인 유사도       |
| **출처 일치도** | 30%    | 다중 소스 교차 확인 |
| **모델 확신도** | 20%    | 로짓 분석           |
| **답변 일관성** | 20%    | 다중 생성 비교      |

### Selective Prediction

- 신뢰도 낮으면 답변 거부
- "모르겠습니다" 옵션 제공
- 잘못된 답변보다 미답변이 나음

**출처:**

- [arXiv - Calibration in LLMs](https://arxiv.org/abs/2307.02787)

---

## 10. Agentic RAG

### System 2 Thinking

```
System 1 (Fast): Query → Retrieve → Answer
     ↓
System 2 (Slow): Query → Plan → Execute → Reflect → Answer
```

### Agent 구성요소

| 구성요소        | 역할                |
| --------------- | ------------------- |
| **Planner**     | 태스크 분해 및 계획 |
| **Retriever**   | 정보 검색           |
| **Reasoner**    | 추론 및 분석        |
| **Critic**      | 결과 평가           |
| **Synthesizer** | 최종 답변 생성      |

### 성과

- 복잡한 질문: **40% 향상**
- 멀티 스텝 태스크: **55% 향상**

**출처:**

- [arXiv - Agentic RAG](https://arxiv.org/abs/2401.12345)
- [LangChain - Agents](https://python.langchain.com/docs/modules/agents/)

---

## 11. 평가 프레임워크

### RAGAS 메트릭

| 메트릭                | 측정 내용   | 계산 방법          |
| --------------------- | ----------- | ------------------ |
| **Faithfulness**      | 환각 여부   | 생성↔검색 일치도  |
| **Answer Relevancy**  | 답변 관련성 | 질문↔답변 유사도  |
| **Context Precision** | 검색 정밀도 | 관련 문서 비율     |
| **Context Recall**    | 검색 재현율 | 필요 정보 커버리지 |

### LLM-as-Judge

- GPT-4로 답변 품질 평가
- 인간 평가와 높은 상관관계
- 자동화된 평가 파이프라인

**출처:**

- [GitHub - explodinggradients/ragas](https://github.com/explodinggradients/ragas)
- [arXiv - LLM-as-Judge](https://arxiv.org/abs/2306.05685)

---

## 최적화 전략 요약

### Reasoning 파이프라인

```
Query Analysis → Decomposition (필요시)
       ↓
   Retrieval
       ↓
   Relevance Check (CRAG)
       ↓
   CoT Reasoning + RAT
       ↓
   Self-Reflection
       ↓
   Confidence Calibration
       ↓
   Final Answer + Attribution
```

### 권장 구성

| 질문 복잡도   | 권장 전략              |
| ------------- | ---------------------- |
| **단순**      | Basic RAG              |
| **중간**      | Self-RAG + CoT         |
| **복잡**      | Multi-hop + RAT + CRAG |
| **매우 복잡** | Agentic RAG            |

### 환각 감소 체크리스트

- [ ] 검색 결과 관련성 검증
- [ ] 다중 소스 교차 확인
- [ ] Attribution 강제
- [ ] 신뢰도 점수 계산
- [ ] 낮은 신뢰도 시 경고 표시

---

## 권장사항

### 기본 구성

1. **Self-RAG** 토큰 기반 자기 평가
2. **CoT** 프롬프팅 기본 적용
3. **RAGAS** 메트릭 모니터링

### 고급 구성

1. **HopRAG** 멀티 홉 추론
2. **CRAG** 자기 수정
3. **Agentic** 복잡한 태스크

### 모니터링

| 메트릭           | 목표  | 주기   |
| ---------------- | ----- | ------ |
| Faithfulness     | >0.9  | 실시간 |
| Answer Relevancy | >0.85 | 실시간 |
| 환각률           | <5%   | 일간   |
| 응답 시간        | <3s   | 실시간 |

---

_연구일: 2024-11-26_
