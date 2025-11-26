# Temporal Layer 최적화 전략

> 시간 인식 검색, 시간적 지식 그래프, 정보 신선도 관리

## 1. 핵심 시간 인식 RAG 시스템

### TG-RAG: Temporal GraphRAG

**이중 레벨 시간 그래프 구조:**

```
┌─────────────────────────────────────────────────────────────┐
│  Temporal Knowledge Graph (타임스탬프 있는 관계)              │
│              +                                              │
│  Hierarchical Time Graph (계층적 시간 노드)                  │
└─────────────────────────────────────────────────────────────┘
```

**핵심 특징:**

- 다중 granularity 시간 요약
- 주요 이벤트와 광범위한 트렌드 동시 포착
- 벡터 임베딩만으로는 시간별 차이 구분 어려움 해결

### TimeRAG

**TimeR4 파이프라인:**

```
Retrieve → Rewrite → Retrieve → Rerank
```

- 암묵적 시간 쿼리를 명시적으로 변환
- 시간 제약 기반 재순위 메커니즘

### VersionRAG

**성과:**

- DeepSeek-R1 70B로 **90% 정확도** (Naive RAG 58% 대비 32%p 향상)
- 그래프 순회(버전/변경 쿼리) + 벡터 검색(콘텐츠 쿼리) 모드 선택
- 시점별 상태 재구성 가능 (규제 준수/감사용)

**출처:**

- [arXiv - TG-RAG](https://arxiv.org/html/2510.13590v1)
- [arXiv - VersionRAG](https://arxiv.org/html/2510.08109)

---

## 2. Time-Decay 메커니즘

### Half-life Recency Prior

```python
# 의미적 유사도 + 시간 감쇠 융합 점수
fusion_score = semantic_similarity * time_decay_factor

# time_decay_factor 예시 (half-life = 30일)
time_decay_factor = 0.5 ** (days_since_creation / half_life)
```

**성과:**

- 최신 문서 검색 정확도 **1.00 달성**
- Freshness 문제(단순)와 Topic evolution(복잡) 분리 접근

### Ebbinghaus 망각 곡선

**SynapticRAG:**

- 시냅스 메커니즘을 통한 동적 메모리 중요도 조정
- 인간의 기억 회상과 유사한 시간적 컨텍스트 관리
- 초기에 급격한 감소, 이후 느린 감소율

**출처:**

- [arXiv - Solving Freshness in RAG](https://arxiv.org/html/2509.19376)
- [arXiv - SynapticRAG](https://arxiv.org/html/2410.13553)

---

## 3. Recency Bias 주의사항

### 문제점

- LLM 기반 재순위 시스템에서 최신성이 암묵적 관련성 신호로 작동
- 역사적 증거가 중요한 도메인에서 오래된 권위 자료 과소평가 위험

### 해결책

- Recency bias 정량화 테스트
- 도메인별 시간 가중치 조정
- 역사적 데이터의 명시적 중요도 부여

**출처:**

- [arXiv - Recency Bias in LLM-Based Reranking](https://arxiv.org/html/2509.11353)

---

## 4. Temporal Knowledge Graph Embedding

### TKGE 7가지 주요 클래스

- 시간 정보를 표준 KG 프레임워크에 통합
- 엔티티/관계의 동적 변화 모델링
- 시간 인식 추론, 엔티티 정렬, 질의응답 개선

### TRKGE: Temporal Relevance 모델

**핵심 인사이트:**

- 관계마다 시간 민감도가 다름
- 일부는 시간 비민감적, 일부는 고도로 시간 의존적
- Tensor decomposition + 시간 중요도 인식

### TEA-GNN & TREA

| 모델        | 특징                        |
| ----------- | --------------------------- |
| **TEA-GNN** | 관계/시간 정보를 GNN에 통합 |
| **TREA**    | 시간적 관계 그래프 어텐션   |

**출처:**

- [arXiv - TKGE Survey](https://arxiv.org/html/2403.04782v1)
- [SAGE Journals - TRKGE](https://journals.sagepub.com/doi/10.3233/SW-243699)

---

## 5. Bi-temporal 인덱싱

### 두 가지 시간 축

| 시간 유형          | 설명                      | 용도          |
| ------------------ | ------------------------- | ------------- |
| **Event Time**     | 이벤트가 실제 발생한 시간 | 비즈니스 로직 |
| **Ingestion Time** | 시스템에 수집된 시간      | 감사/추적     |

### Graphiti 구현

- 배치 재계산 없이 새 데이터 즉시 통합
- 시점별 쿼리(point-in-time queries) 정확성 보장

```python
# Bi-temporal 쿼리 예시
query = """
  MATCH (e:Event)
  WHERE e.event_time <= $query_time
    AND e.ingestion_time <= $system_snapshot_time
  RETURN e
"""
```

**출처:**

- [GitHub - getzep/graphiti](https://github.com/getzep/graphiti)

---

## 6. 버전 관리 및 감사

### Time-Travel RAG (LanceDB)

- 버전 관리된 데이터로 시점별 쿼리
- 과거 특정 시점의 지식 베이스 상태 재구성
- 규제 감사 및 재현성 요구사항 충족

### 버전 관리 Best Practices

| 전략                   | 설명                            |
| ---------------------- | ------------------------------- |
| **롤백 메커니즘**      | 문제 발생 시 이전 버전으로 복원 |
| **버전 태깅**          | 주요 릴리스에 태그 부여         |
| **최소 3개 버전 유지** | 현재/이전 안정/후보 릴리스      |

### Kapa.ai 프로덕션 경험

- 80% 이상의 생성 AI 프로젝트가 PoC를 넘지 못함
- Docker, CircleCI, Reddit 등과 협업
- 버전 관리가 핵심 성공 요인

**출처:**

- [LanceDB - Time-Travel RAG](https://lancedb.com/docs/tutorials/rag/time-travel-rag/)
- [ZenML - Production RAG Best Practices](https://www.zenml.io/llmops-database/production-rag-best-practices-implementation-lessons-at-scale)

---

## 7. 이벤트 순서 및 인과성

### CATENA: 시간/인과 관계 추출

- 인과 관계에서 원인이 결과보다 먼저 발생
- 시간 순서와 인과성 추출 결합
- 타임라인 요약 생성

### Causal Discovery from Temporal Data

**데이터 유형:**

- Multivariate Time-Series (MTS)
- Event Sequences (ES)

**응용 분야:**

- Root cause analysis
- 이상 탐지
- 바이오인포매틱스
- 비즈니스 인텔리전스

**출처:**

- [arXiv - CATENA](https://arxiv.org/abs/1604.08120)
- [ACM - Causal Discovery Survey](https://dl.acm.org/doi/10.1145/3705297)

---

## 8. 벤치마크 데이터셋

### ECT-QA

- 기업 실적 발표 전사본 기반
- 동적 사실 지식 평가
- 구체적/추상적 쿼리

### ChronoQA

- 30만+ 뉴스 기사 (2019-2024)
- 5,176개 질문
- 절대/집계/상대 시간 타입

**출처:**

- [Nature Scientific Data - ECT-QA](https://www.nature.com/articles/s41597-025-06098-y)
- [arXiv - ChronoQA](https://arxiv.org/html/2508.12282)

---

## 9. 실무 구현 사례

### Temporal Augmented Retrieval (TAR)

**적용 분야:**

- 소셜 미디어 분석
- 영업 회의록 처리
- 금융 서비스 크로스셀

**특징:**

- 시간에 따른 주제 진화 추적
- 토론 변화 분석

### RAGOps 프레임워크

- 외부 데이터 소스의 지속적 변화 대응
- 데이터 작업 평가/테스트 자동화
- 데이터 분포 변화 모니터링

**출처:**

- [Medium - TAR Dynamic RAG](https://adam-rida.medium.com/temporal-augmented-retrieval-tar-dynamic-rag-ad737506dfcc)
- [arXiv - RAGOps](https://arxiv.org/html/2506.03401v1)

---

## 10. 최적화 전략 요약

### Time-Decay 메커니즘

```python
# 권장 설정
half_life = 30  # 도메인에 따라 조정
decay_weight = 0.3  # semantic 0.7 + temporal 0.3
```

### 시간 인덱싱 전략

| 전략                  | 적용                         |
| --------------------- | ---------------------------- |
| **Bi-temporal**       | 이벤트 시간 + 수집 시간 분리 |
| **Multi-granularity** | 주요 이벤트 + 트렌드         |
| **Version-aware**     | 특정 버전으로 검색 제약      |

### 정보 신선도 관리

| 전략                         | 설명                        |
| ---------------------------- | --------------------------- |
| **Real-time incremental**    | 배치 처리 제거              |
| **Freshness/Evolution 분리** | 각각 다른 전략              |
| **Metadata enhancement**     | 타임스탬프, 버전, 수정 이력 |

### 시간적 쿼리 이해

| 기법                                 | 효과                    |
| ------------------------------------ | ----------------------- |
| **Retrieve-Rewrite-Retrieve-Rerank** | 암묵적 시간 쿼리 명시화 |
| **Temporal constraint reranking**    | 시간 제약 기반 재순위   |
| **Score separation**                 | 의미적/시간적 점수 분리 |

---

## 권장사항

### 기본 구성

1. **Bi-temporal 인덱싱** 적용
2. **Half-life time decay** 구현
3. **버전 관리** 체계 수립

### 고급 구성

1. **TG-RAG** 계층적 시간 그래프
2. **TKGE** 시간 인식 임베딩
3. **Causal discovery** 인과 관계 추출

### 모니터링

1. 정보 신선도 메트릭 추적
2. Recency bias 정량화
3. 시점별 정확도 평가

---

_연구일: 2024-11-26_
