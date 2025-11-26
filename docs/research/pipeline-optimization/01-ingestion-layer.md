# Ingestion Layer 최적화 전략

> 다중 플랫폼 데이터 수집 파이프라인의 최적화 방안

## 1. Rate Limiting 및 API Quota 관리

### 핵심 전략

| 전략                             | 설명                                         | 효과                                 |
| -------------------------------- | -------------------------------------------- | ------------------------------------ |
| **Traffic Shaping**              | 클라이언트 측 요청을 대역폭 제약 내에서 유지 | 재시도만 사용하는 것보다 높은 처리량 |
| **Key-Level Limiting**           | API 키당 제한 할당, 계층화된 옵션            | 사용자 유형별 차등 관리              |
| **Exponential Backoff + Jitter** | 재시도 간격을 지수적으로 증가 + 랜덤 지터    | Thundering Herd 문제 회피            |

### Best Practices

- **재시도 횟수 제한**: 3-5회 (사용자 상호작용 시)
- **에러 타입 고려**: 404 Not Found는 재시도 불필요
- **최대 Backoff 시간 제한**: Capped Exponential Backoff
- **멱등성(Idempotency) 설계**: 안전한 재시도 보장

**출처:**

- [Moesif - API Rate Limiting Best Practices](https://www.moesif.com/blog/technical/rate-limiting/Best-Practices-for-API-Rate-Limits-and-Quotas-With-Moesif-to-Avoid-Angry-Customers/)
- [AWS - Retry with Backoff Pattern](https://docs.aws.amazon.com/prescriptive-guidance/latest/cloud-design-patterns/retry-backoff.html)

---

## 2. Incremental vs Full Sync 전략

### Full Sync의 문제점

- 10,000개 문서 중 100개 추가 시 전체 파이프라인 재실행 비효율
- 지식 베이스가 커질수록 재구축 시간 증가
- 야간 재구축 실행 중 오래된 데이터 수용 필요

### Incremental Update 전략

```
┌─────────────────────────────────────────────────────────────┐
│  변경 감지 → 영향받는 청크 식별 → 임베딩 재생성 → 인덱스 업데이트  │
└─────────────────────────────────────────────────────────────┘
```

| 작업          | 처리 방법                                        |
| ------------- | ------------------------------------------------ |
| **문서 추가** | 새 콘텐츠 청킹 → 임베딩 생성 → DB 삽입           |
| **문서 수정** | 변경된 청크 식별 → 이전 벡터 제거 → 새 벡터 추가 |
| **문서 삭제** | 연결된 모든 청크/벡터 식별 및 제거               |

### 실제 성과

- **금융 서비스 회사**: Full Sync 14시간 → Incremental 8분 (매일 50-100개 새 문서)

**출처:**

- [CustomGPT - RAG Data Sync](https://customgpt.ai/rag-data-sync/)
- [Particula Tech - Update RAG Knowledge](https://particula.tech/blog/update-rag-knowledge-without-rebuilding)

---

## 3. 멀티소스 데이터 정규화

### Common Data Model (CDM) 필수

다양한 스키마와 형식의 데이터 소스를 표준화

```typescript
// Canonical Object 예시
interface CanonicalObject {
  id: string; // "slack|workspace|thread|ts"
  platform: Platform; // slack, zendesk, linear, github...
  object_type: string; // thread, ticket, issue...
  title: string;
  body: string;
  actors: {
    created_by: string;
    participants: string[];
  };
  timestamps: {
    created_at: string;
    updated_at: string;
  };
  relations: Record<string, string>;
}
```

### 스키마 기반 접근법

- 스키마 레지스트리에 저장 및 버전 관리
- 진입점에서 검증
- 여러 단계에서 유효성 검사

**출처:**

- [Integrate.io - Data Normalization](https://www.integrate.io/blog/data-normalization/)
- [DZone - ETL Architecture](https://dzone.com/articles/etl-architecture-multi-source-data-integration)

---

## 4. 중복 제거 (Deduplication)

### 3단계 프로세스

```
청킹(Chunking) → 해시값 생성 → 중복 발견 및 삭제
```

### 중복 제거 전략

| 전략                  | 특징                      | 사용 사례        |
| --------------------- | ------------------------- | ---------------- |
| **Exact Matching**    | SHA-256 해싱, 빠르고 정확 | 동일 문서 감지   |
| **Semantic Matching** | 벡터 임베딩 기반          | 유사 콘텐츠 감지 |
| **MinHash LSH**       | 대규모 시나리오용         | 수십억 문서 처리 |

### Milvus 2.6 / Zilliz Cloud

- MinHash LSH 네이티브 통합
- 벡터 인덱싱 워크플로의 핵심 부분으로 중복 제거

**출처:**

- [Zilliz - Data Deduplication at Trillion Scale](https://zilliz.com/blog/data-deduplication-at-trillion-scale-solve-the-biggest-bottleneck-of-llm-training)
- [Modern Treasury - Deduplication at Scale](https://www.moderntreasury.com/journal/deduplication-at-scale)

---

## 5. 에러 핸들링

### Circuit Breaker 패턴

서비스 장기 문제 시 모든 요청 일시 중단

### Dead Letter Queue (DLQ)

- 실패한 작업 자동 재시도
- 문제 레코드를 DLQ로 라우팅하여 분석/재처리

### Graceful Degradation

- 중요하지 않은 에러 시 전체 파이프라인 충돌 방지
- 폴백 데이터(기본값 또는 플레이스홀더) 제공

### LlamaIndex / LangChain 예시

```python
# LangChain - max_retries 설정
llm = ChatOpenAI(max_retries=3)

# LangChain - 폴백 모델 정의
llm_with_fallback = primary_llm.with_fallbacks([fallback_llm])
```

**출처:**

- [Milvus - LlamaIndex Error Handling](https://milvus.io/ai-quick-reference/how-do-i-handle-errors-and-exceptions-in-llamaindex-workflows)
- [Milvus - LangChain Error Management](https://milvus.io/ai-quick-reference/how-do-i-handle-error-management-and-retries-in-langchain-workflows)

---

## 6. Real-time vs Batch Ingestion

### 비교

| 특성            | Batch       | Real-time   | Micro-Batching |
| --------------- | ----------- | ----------- | -------------- |
| **처리 시점**   | 예약된 간격 | 즉시        | 짧은 간격      |
| **지연 시간**   | 높음        | 매우 낮음   | 낮음           |
| **리소스 효율** | 높음        | 높은 부하   | 중간           |
| **사용 사례**   | 주간 보고서 | 실시간 재고 | 대부분의 RAG   |

### Streaming RAG (2024 신기술)

- Kafka 스트림의 문서가 벡터 DB 인덱스로 지속적으로 공급
- 분 단위로 변경되는 정보 처리 가능

### Apache Kafka + Flink 아키텍처

```
Data Source → Kafka → Flink (전처리) → Embedding Model → Vector DB
```

**출처:**

- [Kai Waehner - Real-Time GenAI with RAG](https://www.kai-waehner.de/blog/2024/05/30/real-time-genai-with-rag-using-apache-kafka-and-flink-to-prevent-hallucinations/)
- [AWS - Real-Time Streaming for RAG](https://docs.aws.amazon.com/architecture-diagrams/latest/exploring-real-time-streaming-for-retrieval-augmented-generation/exploring-real-time-streaming-for-retrieval-augmented-generation.html)

---

## 7. 벡터 데이터베이스 비교

| DB           | 특징                             | 성능                       |
| ------------ | -------------------------------- | -------------------------- |
| **Pinecone** | 완전 관리형, 실시간 ingestion    | p99 < 50ms (10M 벡터 미만) |
| **Weaviate** | 수평 확장, GraphQL API           | 내장 벡터화 모듈           |
| **Milvus**   | GPU 지향 설계, 하이브리드 인덱스 | < 20ms (적절한 튜닝)       |
| **Chroma**   | 임베디드, 네트워크 지연 제거     | 13% 더 빠른 쿼리           |

---

## 권장사항

1. **변경 감지 우선 구현** - 가장 높은 임팩트
2. **Incremental Update** - 전체 재구축 회피
3. **Exponential Backoff + Jitter** - API 안정성
4. **MinHash LSH** - 대규모 중복 제거
5. **Micro-Batching** - 실시간과 배치의 균형

---

_연구일: 2024-11-26_
