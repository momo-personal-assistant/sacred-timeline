# Clustering Layer 최적화 전략

> 벡터 클러스터링 및 계층적 인덱싱 연구

## 1. 핵심 클러스터링 알고리즘

### HDBSCAN

**특징:**

- 밀도가 다른 클러스터를 자동 감지
- 클러스터 수 사전 지정 불필요
- 노이즈 데이터 효과적 처리

**파라미터:**

- `min_cluster_size`: 최소 클러스터 크기 (주요 파라미터)
- 직관적인 설정으로 탐색적 분석에 이상적

**적용 사례:**

- Milvus + BGE-M3 임베딩 기반 클러스터링
- GPT-2 Sparse AutoEncoder의 고차원(16K) 가중치 행렬 분석

### K-means + IVF (Inverted File Index)

**특징:**

- 벡터 공간을 클러스터로 분할
- 쿼리 시 가장 유사한 클러스터만 검색
- Product Quantization(PQ)과 결합 가능

**성능:**

- 768차원 벡터: 3KB → 96바이트 (PQ 적용)
- 메모리에 30배 더 많은 벡터 저장 가능

**출처:**

- [Arize - Understanding HDBSCAN](https://arize.com/blog-course/understanding-hdbscan-a-deep-dive-into-hierarchical-density-based-clustering/)
- [Milvus - HDBSCAN Clustering](https://milvus.io/docs/hdbscan_clustering_with_milvus.md)

---

## 2. RAPTOR: 계층적 클러스터링

### 개념

```
┌─────────────────────────────────────────────────────────────┐
│  원본 텍스트 청크 (리프 노드)                                 │
│        ↓                                                     │
│  클러스터링 (GMM)                                            │
│        ↓                                                     │
│  요약 생성 (GPT-3.5-turbo)                                   │
│        ↓                                                     │
│  재귀적 반복 → 트리 구조 생성                                 │
└─────────────────────────────────────────────────────────────┘
```

### 기술 구현

- SBERT 인코더: 100토큰 단위 청크 임베딩
- Gaussian Mixture Model(GMM): 유사 그룹 클러스터링
- UMAP: 차원 축소, n_neighbors로 로컬/글로벌 균형

### 성능 결과

| 벤치마크  | 성과                              |
| --------- | --------------------------------- |
| QuALITY   | GPT-4 결합 시 **20% 향상**        |
| QASPER    | **55.7% F1** (SOTA)               |
| UnifiedQA | 36.7% F1 (SBERT 36.23% 대비 향상) |

### Collapsed Tree 검색

- 모든 레벨 동시 쿼리
- 복잡한 다단계 추론 작업에 우수

**출처:**

- [RAPTOR - ICLR 2024](https://arxiv.org/abs/2401.18059)
- [GitHub - parthsarthi03/raptor](https://github.com/parthsarthi03/raptor)

---

## 3. GraphRAG

### 개념

Microsoft Research 2024년 도입, GitHub 10K+ stars

**핵심 기술:**

- 소스 문서에서 Knowledge Graph 자동 구축
- Leiden 알고리즘으로 계층적 커뮤니티 클러스터링
- 다양한 추상화 레벨의 커뮤니티 요약 생성

### 기존 RAG와 차이점

| 특성        | Naive RAG     | GraphRAG              |
| ----------- | ------------- | --------------------- |
| 데이터 구조 | 청킹 + 임베딩 | 엔티티 + 관계 그래프  |
| 검색 방식   | 벡터 유사도   | 그래프 순회           |
| 질문 유형   | 단순 검색     | "connecting the dots" |

### 성과

- Naive RAG 대비 우수: comprehensiveness, diversity, empowerment
- Multi-hop QA 리콜 **6.4포인트 향상**

**출처:**

- [Microsoft Research - GraphRAG](https://www.microsoft.com/en-us/research/blog/graphrag-unlocking-llm-discovery-on-narrative-private-data/)
- [arXiv:2404.16130](https://arxiv.org/pdf/2404.16130)

---

## 4. CRAG: Clustered Retrieved Augmented Generation

### 3단계 추가 파이프라인

```
표준 RAG + 클러스터링 + 요약 + 집계
```

### 성과

- **토큰 수 46-90% 감소** (품질 유지)
- 비용 절감
- 모델 지연 시간 감소

**출처:**

- [arXiv:2406.00029](https://arxiv.org/html/2406.00029v1)

---

## 5. 추가 계층적 접근법

### ArchRAG

- 속성 기반 커뮤니티 + LLM 기반 계층적 클러스터링
- GraphRAG 대비 **250배 토큰 절감**
- 특정 질문에서 10% 높은 정확도

### HiRAG

- 비지도 계층적 인덱싱
- 상위 레이어: 거친 입자의 고수준 지식
- 하위 레이어: 의미적으로 유사한 엔티티 연결

### LeanRAG

- "시맨틱 아일랜드" 및 구조-검색 불일치 해결
- 완전히 탐색 가능한 시맨틱 네트워크 구축

**출처:**

- [arXiv - ArchRAG](https://arxiv.org/html/2502.09891)
- [arXiv - HiRAG](https://arxiv.org/html/2503.10150)

---

## 6. 동적 클러스터링

### Speculative RAG

**작동 방식:**

1. K-means 클러스터링 + 명령 인식 임베딩
2. 검색된 문서를 다양한 관점의 서브셋으로 클러스터링
3. 각 클러스터에서 하나의 문서 샘플링
4. RAG Drafter (작은 모델)이 병렬로 초안 생성
5. RAG Verifier (큰 모델)이 검증

**장점:**

- 반복적인 문서 검토 우회
- 지연 시간 크게 감소
- 응답 품질 향상

### 실시간 RAG

**주요 컴포넌트:**

- 실시간 데이터 수집/전처리
- Bytewax 등 실시간 파이프라인으로 벡터 DB 지속 업데이트
- GPU 가속 쿼리 최적화

**출처:**

- [RAGFlow - Rise and Evolution of RAG 2024](https://ragflow.io/blog/the-rise-and-evolution-of-rag-in-2024-a-year-in-review)
- [Striim - Real-Time RAG](https://www.striim.com/blog/real-time-rag-streaming-vector-embeddings-and-low-latency-ai-search/)

---

## 7. 그래뉼러리티 최적화

### Mix-of-Granularity (MoG)

**개념:**

- 입력 쿼리에 따라 최적 그래뉼러리티 동적 선택
- Mix-of-Expert에서 영감받은 라우터 사용

### Mix-of-Granularity-Graph (MoGG)

- 참조 문서를 그래프 형태로 재구성
- 거리가 먼 정보도 동시 검색 가능
- 고정된 top-k 선택의 한계 극복

**출처:**

- [arXiv:2406.00456](https://arxiv.org/html/2406.00456v1)

---

## 8. 검색 최적화

### 하이브리드 검색 (BlendedRAG)

IBM Research 2024년 4월 발표:

```
벡터 검색 + 희소 벡터 검색 + 전문 검색 = 최적 recall
```

### 고급 인덱싱 구조

| 인덱스     | 특징                              | 성능                 |
| ---------- | --------------------------------- | -------------------- |
| **HNSW**   | 기본 선택, 메타데이터 필터링 결합 | 95%+ recall, < 100ms |
| **MSTG**   | 트리 + 그래프 결합                | 메모리 효율적        |
| **IVF-PQ** | 대규모 데이터셋                   | 메모리 30배 절감     |

**출처:**

- [Machine Learning Mastery - Next-Gen RAG Retrieval](https://machinelearningmastery.com/beyond-vector-search-5-next-gen-rag-retrieval-strategies/)

---

## 9. 벡터 데이터베이스 선택

### 오픈소스

| DB         | 특징                          |
| ---------- | ----------------------------- |
| **FAISS**  | 가장 인기, 다양한 인덱싱 전략 |
| **Milvus** | 분산 클러스터, 수십억 벡터    |
| **Chroma** | 임베디드, 빠른 시작           |

### 클라우드 네이티브

| DB           | 특징                         |
| ------------ | ---------------------------- |
| **Pinecone** | 서버리스, 자동 확장          |
| **Weaviate** | GraphQL API, 하이브리드 검색 |
| **Qdrant**   | Kubernetes 효율적            |

**출처:**

- [Dev.to - Vector Databases Guide 2025](https://dev.to/klement_gunndu_e16216829c/vector-databases-guide-rag-applications-2025-55oj)

---

## 10. 성능 지표

### 주요 벤치마크 결과

| 시스템         | 메트릭       | 향상                           |
| -------------- | ------------ | ------------------------------ |
| **CRAG**       | 토큰 수      | 46-90% 감소                    |
| **CORAG**      | ROUGE        | 25% 향상 (vs NaiveRAG, RAPTOR) |
| **계층적 RAG** | 요약         | 11% 향상                       |
|                | 기계 번역    | 8% 향상                        |
|                | 대화         | 12% 향상                       |
|                | Hit@1        | 47% 향상                       |
| **GraphRAG**   | Multi-hop QA | 6.4p 향상                      |
| **ArchRAG**    | 토큰 비용    | 250배 감소                     |

---

## 권장사항

### 기본 구성

1. **HDBSCAN** 또는 **K-means + IVF**로 초기 클러스터링
2. **HNSW** 인덱스 + 메타데이터 필터링

### 고급 구성

1. **RAPTOR** 계층적 요약 트리
2. **GraphRAG** 엔티티/관계 기반 검색
3. **BlendedRAG** 하이브리드 검색

### 비용 최적화

1. **CRAG** 토큰 감소
2. **ArchRAG** 250배 비용 절감

---

_연구일: 2024-11-26_
