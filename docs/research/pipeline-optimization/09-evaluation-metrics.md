# Evaluation Metrics for Memory Pipeline

> AI 엔지니어/연구원이 실제 사용하는 평가 지표 종합

## 목적에 맞는 핵심 지표

팀의 Persistent Memory 시스템 목적:

- 여러 플랫폼(Slack, Linear, GitHub 등)의 정보 통합
- 팀의 지식을 검색 가능하게 유지
- 시간에 따른 정보 변화 추적

---

## 1. 공통 지표 (End-to-End)

### RAGAS Framework (가장 널리 사용)

| 지표                  | 측정 내용   | 계산 방법                                      | 목표값 |
| --------------------- | ----------- | ---------------------------------------------- | ------ |
| **Faithfulness**      | 환각 여부   | 생성 답변의 주장 중 컨텍스트로 뒷받침되는 비율 | >0.90  |
| **Answer Relevancy**  | 답변 관련성 | 질문-답변 임베딩 유사도                        | >0.85  |
| **Context Precision** | 검색 정밀도 | top-k 중 관련 문서 비율                        | >0.85  |
| **Context Recall**    | 검색 재현율 | 필요 정보 중 검색된 비율                       | >0.90  |

```python
# RAGAS 점수 계산
ragas_score = (faithfulness + answer_relevancy +
               context_precision + context_recall) / 4
```

### 검색 품질 지표 (Retrieval)

| 지표            | 공식                          | 해석                        | 사용 시점          |
| --------------- | ----------------------------- | --------------------------- | ------------------ |
| **NDCG@K**      | DCG/IDCG                      | 순위 품질 (위치 고려)       | BEIR/MTEB 벤치마크 |
| **MRR**         | 1/첫 번째 관련 문서 순위      | 첫 번째 관련 문서 찾는 속도 | 단일 정답 검색     |
| **Recall@K**    | 관련 문서 수 / 전체 관련 문서 | 커버리지                    | 정보 손실 방지     |
| **Precision@K** | 관련 문서 수 / K              | 정확도                      | 노이즈 감소        |

```typescript
// 검색 품질 계산
const ndcg_at_10 = calculateNDCG(results, groundTruth, 10);
const mrr = 1 / rankOfFirstRelevant;
const recall_at_10 = relevantInTop10 / totalRelevant;
const precision_at_10 = relevantInTop10 / 10;
```

### 지연 시간 (Latency)

| 백분위  | 목표값 | 알림 임계값 | 용도          |
| ------- | ------ | ----------- | ------------- |
| **P50** | <100ms | >150ms      | 일반 응답     |
| **P95** | <300ms | >450ms      | 대부분 사용자 |
| **P99** | <1s    | >1.5s       | 최악 케이스   |

---

## 2. Ingestion Layer 지표

### 수집 성능

| 지표               | 계산                  | 목표          |
| ------------------ | --------------------- | ------------- |
| **처리량**         | 문서/초               | >100 docs/sec |
| **API 성공률**     | 성공 요청 / 전체 요청 | >99.5%        |
| **중복 제거율**    | 제거된 중복 / 전체    | 30-50%        |
| **변경 감지 시간** | Full sync 대비        | 14시간 → 8분  |

### 데이터 품질

```typescript
interface IngestionMetrics {
  // 처리량
  documents_per_second: number;
  api_success_rate: number; // >99.5%

  // 중복 제거
  deduplication_rate: number; // 30-50%
  false_positive_rate: number; // <1% (잘못된 중복 제거)

  // 지연
  sync_latency_ms: number;
  change_detection_time_ms: number;
}
```

---

## 3. Embedding Layer 지표

### 임베딩 품질

| 지표                | 측정 내용            | 목표  |
| ------------------- | -------------------- | ----- |
| **MTEB Score**      | 벤치마크 종합 점수   | >65   |
| **STS Correlation** | 의미 유사도 상관관계 | >0.85 |
| **Recall@10**       | 검색 재현율          | >0.85 |

### 클러스터링 품질

| 지표                     | 범위   | 좋은 값 |
| ------------------------ | ------ | ------- |
| **Silhouette Score**     | -1 ~ 1 | >0.7    |
| **Davies-Bouldin Index** | 0 ~ ∞  | <1.5    |

### 효율성 지표

```typescript
interface EmbeddingMetrics {
  // 품질
  mteb_score: number; // 벤치마크 점수
  semantic_recall_at_10: number; // >0.85

  // 효율성
  embeddings_per_second: number; // 처리량
  memory_per_vector_kb: number; // 저장 비용

  // 양자화 영향
  quantization_accuracy_loss: number; // <5%
}
```

**차원별 트레이드오프:**

| 차원 | 메모리 | 상대 정확도 | 지연 |
| ---- | ------ | ----------- | ---- |
| 64   | 256B   | 88%         | 2ms  |
| 256  | 1KB    | 95%         | 4ms  |
| 1024 | 4KB    | 99%         | 8ms  |

---

## 4. Chunking Layer 지표

### 청킹 품질

| 지표                         | 측정 내용                      | 목표 |
| ---------------------------- | ------------------------------ | ---- |
| **Coherence**                | 청크가 완결된 의미 단위인지    | >0.8 |
| **Boundary Quality**         | 자연스러운 경계에서 분할되는지 | >0.8 |
| **Information Preservation** | 중요 정보 보존율               | >95% |

### 검색 영향

```typescript
interface ChunkingMetrics {
  // 품질
  coherence_score: number; // 완결성
  boundary_quality: number; // 경계 품질

  // 정보 보존
  entity_coverage: number; // 엔티티 커버리지
  relationship_preservation: number;

  // 효율
  overlap_waste_ratio: number; // 오버랩 낭비 <15%
  context_utilization: number; // 컨텍스트 활용률 60-80%
}
```

**청크 크기별 성능:**

| 크기 | 사실적 쿼리 | 분석적 쿼리 | 권장        |
| ---- | ----------- | ----------- | ----------- |
| 256  | 최적        | 불충분      | 단순 QA     |
| 512  | 우수        | 양호        | 일반        |
| 1024 | 양호        | 최적        | 복잡한 추론 |

---

## 5. Clustering Layer 지표

### 클러스터링 품질

| 지표            | 설명               | 목표 |
| --------------- | ------------------ | ---- |
| **Modularity**  | 커뮤니티 구조 강도 | >0.3 |
| **Conductance** | 경계 품질          | <0.5 |

### RAPTOR/GraphRAG 성능

```typescript
interface ClusteringMetrics {
  // 클러스터링
  modularity: number; // >0.3
  conductance: number; // <0.5

  // 요약 품질
  summary_coverage: number; // 엔티티 커버리지 >80%
  summary_accuracy: number; // 사실 정확도 >90%

  // 효율
  token_reduction: number; // 46-90% 감소 (CRAG)
  accuracy_vs_baseline: number; // +20% (RAPTOR)
}
```

---

## 6. Knowledge Graph Layer 지표

### 엔티티/관계 추출

| 지표               | 측정               | 목표 |
| ------------------ | ------------------ | ---- |
| **Entity F1**      | NER 성능           | >70% |
| **Relation F1**    | 관계 추출 성능     | >65% |
| **Graph Coverage** | 중요 정보 커버리지 | >90% |

### 그래프 품질

```typescript
interface KnowledgeGraphMetrics {
  // 추출 품질
  entity_precision: number;
  entity_recall: number;
  entity_f1: number; // >70%

  relation_precision: number;
  relation_recall: number;
  relation_f1: number; // >65%

  // 그래프 일관성
  contradiction_rate: number; // <3%
  duplicate_entity_rate: number; // <5%

  // 쿼리 성능
  multi_hop_success_rate: number; // >70%
  graph_query_latency_ms: number; // <200ms
}
```

**관계 유형별 추출 방법:**

| 관계 유형                                 | 방법             | 정확도 |
| ----------------------------------------- | ---------------- | ------ |
| **Operational** (created_by, assigned_to) | Schema 직접 읽기 | ~100%  |
| **Semantic** (triggered_by, resulted_in)  | LLM 추론         | 52-65% |

---

## 7. Temporal Layer 지표

### 시간 인식 검색

| 지표                  | 측정                | 목표 |
| --------------------- | ------------------- | ---- |
| **Temporal Accuracy** | 시점별 쿼리 정확도  | >90% |
| **Freshness Score**   | 최신 정보 우선 검색 | >0.9 |
| **Version Retrieval** | 버전별 상태 재구성  | 100% |

### Time-Decay 효과

```typescript
interface TemporalMetrics {
  // 시간 인식
  temporal_query_accuracy: number; // 시점 쿼리 >90%
  freshness_score: number; // 최신성 가중치 효과

  // 버전 관리
  version_retrieval_accuracy: number; // 100%
  bi_temporal_correctness: number; // 이중 시간축 정확도

  // 시간 감쇠
  time_decay_improvement: number; // +30% 개선
}
```

**Half-life 설정 가이드:**

| 도메인      | Half-life | 이유        |
| ----------- | --------- | ----------- |
| 뉴스        | 7일       | 빠른 갱신   |
| 문서        | 90일      | 장기 유효   |
| 재무 데이터 | 1일       | 실시간 변동 |
| 로드맵      | 180일     | 장기 계획   |

---

## 8. Consolidation Layer 지표

### 메모리 통합

| 지표                           | 측정               | 목표   |
| ------------------------------ | ------------------ | ------ |
| **Deduplication Rate**         | 중복 제거율        | 30-50% |
| **Information Retention**      | 정보 보존율        | >97%   |
| **Entity Resolution Accuracy** | 엔티티 병합 정확도 | >95%   |

### 장기 메모리 품질

```typescript
interface ConsolidationMetrics {
  // 중복 제거
  deduplication_rate: number; // 30-50%
  false_merge_rate: number; // 잘못된 병합 <1%

  // 정보 보존
  information_retention: number; // >97%
  entity_resolution_accuracy: number; // >95%

  // 압축
  compression_ratio: number; // 3-5x
  reconstruction_accuracy: number; // >90%

  // 일관성
  cross_session_consistency: number; // >98%
}
```

### LongMemEval 벤치마크 (5가지 능력)

| 능력                        | 설명             | 목표 |
| --------------------------- | ---------------- | ---- |
| **Information Extraction**  | 과거 정보 추출   | >85% |
| **Multi-Session Reasoning** | 세션 간 추론     | >80% |
| **Knowledge Updates**       | 변경된 정보 처리 | >90% |
| **Temporal Reasoning**      | 시간 인식        | >85% |
| **Abstention**              | "모름" 판단      | >95% |

---

## 9. Reasoning Layer 지표

### Multi-hop 추론

| 지표                 | 측정         | 목표       |
| -------------------- | ------------ | ---------- |
| **Exact Match (EM)** | 완벽 정답률  | >80%       |
| **F1 Score**         | 토큰 레벨 F1 | >85%       |
| **Hop Success Rate** | N-hop 성공률 | 3-hop >70% |

### 환각 감소

```typescript
interface ReasoningMetrics {
  // 정확도
  exact_match: number; // >80%
  f1_score: number; // >85%

  // 환각
  hallucination_rate: number; // <5%
  faithfulness: number; // >90%

  // 귀속
  attribution_precision: number; // >95%
  attribution_coverage: number; // >98%

  // 자기 수정 (CRAG/Self-RAG)
  correction_rate: number; // >80%
  correction_accuracy: number; // >90%
}
```

**환각 감소 조합 효과:**

| 기법         | 환각 감소율 |
| ------------ | ----------- |
| RAG alone    | 40-50%      |
| + RLHF       | 60-70%      |
| + Guardrails | 20-30%      |
| **조합**     | **96%**     |

---

## 10. Production 모니터링 지표

### 실시간 모니터링

```typescript
interface ProductionMetrics {
  // 성능
  latency: {
    p50_ms: number; // <100ms
    p95_ms: number; // <300ms
    p99_ms: number; // <1s
  };
  throughput: number; // queries/sec
  error_rate: number; // <0.1%

  // 품질
  hallucination_rate: number; // <5%
  faithfulness_score: number; // >0.9
  user_satisfaction_nps: number; // >60

  // 비용
  cost_per_query_cents: number;
  tokens_per_query: number;
}
```

### Drift 감지

| 유형              | 감지 방법                        | 조치               |
| ----------------- | -------------------------------- | ------------------ |
| **Latency Drift** | P99 24시간 평균 > baseline + 30% | 캐시/인덱스 점검   |
| **Quality Drift** | 정확도 15%+ 하락                 | 임베딩/데이터 점검 |
| **Cost Drift**    | 쿼리당 비용 30%+ 증가            | 토큰 사용량 최적화 |

---

## 11. 팀 메모리 시스템 특화 지표

### Cross-Source 연결

| 지표                           | 측정                            | 목표 |
| ------------------------------ | ------------------------------- | ---- |
| **Platform Linking Accuracy**  | Slack→Linear→GitHub 연결 정확도 | >85% |
| **Relation Discovery Rate**    | 자동 발견된 관계 비율           | >70% |
| **Cross-Source Query Success** | 멀티 플랫폼 쿼리 성공률         | >80% |

### 팀 컨텍스트 이해

```typescript
interface TeamMemoryMetrics {
  // 플랫폼 연결
  platform_linking_accuracy: number; // >85%
  relation_discovery_rate: number; // >70%

  // 쿼리 성능
  cross_source_accuracy: number; // >80%
  multi_hop_accuracy: number; // >75%

  // 시간 인식
  temporal_query_accuracy: number; // >90%
  knowledge_freshness: number; // 최신 정보 우선

  // 귀속
  source_attribution_accuracy: number; // >95%
}
```

---

## 12. 평가 주기 권장

### Daily (매일)

- 환각률 실시간 모니터링
- 지연 시간 P50/P95/P99
- 에러율

### Weekly (매주)

- RAGAS 4개 핵심 지표
- Multi-hop 추론 성능
- 플랫폼 연결 정확도

### Monthly (매월)

- LongMemEval 전체 평가
- 엔티티/관계 추출 품질
- 비용 효율성

### Quarterly (분기별)

- 업계 벤치마크 비교 (BEIR, MTEB)
- 장기 메모리 일관성
- 사용자 만족도 조사

---

## 13. 도구 및 프레임워크

### 평가 프레임워크

| 도구            | 용도            | 링크                                                                           |
| --------------- | --------------- | ------------------------------------------------------------------------------ |
| **RAGAS**       | RAG 전체 평가   | [docs.ragas.io](https://docs.ragas.io)                                         |
| **BEIR**        | 검색 벤치마크   | [github.com/beir-cellar/beir](https://github.com/beir-cellar/beir)             |
| **MTEB**        | 임베딩 벤치마크 | [huggingface.co/spaces/mteb](https://huggingface.co/spaces/mteb/leaderboard)   |
| **LongMemEval** | 장기 메모리     | [github.com/xiaowu0162/LongMemEval](https://github.com/xiaowu0162/LongMemEval) |

### 환각 감지

| 도구                 | 특징                |
| -------------------- | ------------------- |
| **Vectara HHEM-2.1** | 전용 환각 감지 모델 |
| **TLM**              | LLM 불확실성 측정   |
| **LettuceDetect**    | 경량 환각 감지기    |

---

## 14. Ground Truth 없는 평가 (POC/프로덕션)

### LLM-as-Judge는 전체 데이터를 읽지 않음

```
전체 플랫폼 데이터 (100만 건)
         ↓
    [Retrieval System]  ← 여기서 99.999% 필터링
         ↓
   관련 Chunks (5-10개, ~2000 토큰)
         ↓
    [LLM-as-Judge]  ← 이 작은 튜플만 평가
```

| 평가 입력         | 크기                   |
| ----------------- | ---------------------- |
| Query             | 1-2문장                |
| Retrieved Context | 5-10 청크 (~2000 토큰) |
| Generated Answer  | 1-5문단                |
| **총 Judge 입력** | **~3000-5000 토큰**    |

### Ground Truth 없이 사용 가능한 지표

| 지표                  | Ground Truth 필요? | 측정 방법           |
| --------------------- | ------------------ | ------------------- |
| **Faithfulness**      | 아니오             | 답변↔컨텍스트 일치 |
| **Answer Relevancy**  | 아니오             | 질문↔답변 유사도   |
| **Context Precision** | 예                 | -                   |
| **Context Recall**    | 예                 | -                   |

### 실제 회사들의 평가 방법

| 회사          | 방법                         | Ground Truth |
| ------------- | ---------------------------- | ------------ |
| **Anthropic** | Human Preference + Elo Score | 불필요       |
| **DeepMind**  | Multi-Judge (3 LLM 투표)     | 불필요       |
| **DoorDash**  | LLM Guardrail + Judge        | 불필요       |

### POC 평가 실무 가이드

```python
# 샘플링 기반 평가 (전체 쿼리 평가 불필요)
evaluation_queries = random.sample(all_queries, n=100)

for query in evaluation_queries:
    context = retriever.retrieve(query)  # 이미 필터링됨
    answer = generator.generate(query, context)

    # LLM-as-Judge는 이 작은 튜플만 평가
    faithfulness = judge.evaluate_faithfulness(answer, context)
    relevancy = judge.evaluate_relevancy(query, answer)
```

**출처:**

- [Anthropic - Constitutional AI](https://www.anthropic.com/research/constitutional-ai)
- [DeepMind - FACTS Grounding](https://arxiv.org/abs/2311.12785)
- [arXiv - LLM-as-Judge](https://arxiv.org/abs/2306.05685)

---

## 참고 자료

### 학술 논문

- RAGAS Framework (2024)
- LongMemEval (ICLR 2025)
- MemGPT (2024)
- Self-RAG (ICLR 2024)
- CRAG (2024)

### 기업 블로그

- Anthropic: Contextual Retrieval
- Microsoft: GraphRAG
- Databricks: LLM Auto-Eval Best Practices
- Snowflake: LLM-as-Judge for RAG

### 벤치마크 데이터셋

- HotPotQA (Multi-hop)
- ECT-QA (Temporal)
- ChronoQA (Temporal)
- MultiHop-RAG

---

_연구일: 2024-11-26_
