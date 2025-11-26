# Knowledge Graph Layer 최적화 전략

> 지식 그래프 구축, 엔티티/관계 추출, 그래프 기반 RAG 연구

## 1. Entity Extraction (엔티티 추출)

### LLM vs Non-LLM 기반 비교

| 방식                   | 성능         | 비용      | 확장성    |
| ---------------------- | ------------ | --------- | --------- |
| **LLM 기반**           | 65.83%       | 높음      | 제한적    |
| **Dependency-based**   | 61.87% (94%) | 낮음      | 우수      |
| **SpaCy NP extractor** | 실용적       | 매우 낮음 | 매우 우수 |

### 권장 접근법

- **SpaCy + LLM 병행**: 비용과 품질 균형
- 기본 추출은 SpaCy, 복잡한 케이스는 LLM

### Graphusion 3단계 파이프라인

1. Topic modeling으로 seed entity 추출
2. LLM으로 candidate triplet 추출
3. Entity merging, conflict resolution, novel triplet discovery

**출처:**

- [arXiv - Efficient Knowledge Graph Construction](https://arxiv.org/html/2507.03226v2)
- [arXiv - Graphusion Framework](https://arxiv.org/html/2410.17600v1)

---

## 2. Relation Extraction (관계 추출)

### RP-ISS 모델 (Nature 2024)

```
┌─────────────────────────────────────────────────────────────┐
│  RoBERTa (Semantic) + Edge-based GNN (Structural)           │
│                    ↓                                        │
│         Node embedding memory bank                          │
│                    ↓                                        │
│         비동기 업데이트 (계산 부담 감소)                       │
└─────────────────────────────────────────────────────────────┘
```

### RExAS: Adaptive Self-attention

- Dependency-parsed text 없이 weighted adjacency 학습
- Graph Convolution Network와 결합
- 처리 속도 개선

### KEGI: Knowledge Enhanced Graph Inference

- 산업 도메인의 annotated data 부족 해결
- BiLSTM-CRF에 도메인 특화 지식 통합
- 긴 단락 처리 가능

**출처:**

- [Nature - RP-ISS Model](https://www.nature.com/articles/s41598-024-63279-2)
- [Springer - RExAS](https://link.springer.com/chapter/10.1007/978-3-031-84543-7_20)

---

## 3. Graph Schema Design

### Episodic vs Semantic Memory 구분

| 메모리 유형  | 설명                | 예시                        |
| ------------ | ------------------- | --------------------------- |
| **Episodic** | 맥락 포함 개인 기억 | "어제 회의에서 결정된 내용" |
| **Semantic** | 일반적 지식         | "프로젝트 X의 아키텍처"     |

### RDF Quadruple 확장

```turtle
# 기존 RDF Triple
(Agent, atLocation, Library)

# Temporal Quadruple
(Agent, atLocation, Library, {timestamp: 42, confidence: 0.95})
```

### Graphiti Framework (Neo4j 기반)

- Temporally aware knowledge graph
- **Incremental, real-time 업데이트**
- Predefined entity types 불필요 (LLM이 동적 분류)

**출처:**

- [arXiv - Human-Like Memory Systems](https://arxiv.org/html/2408.05861v1)
- [Medium - Graphiti Guide](https://medium.com/@saeedhajebi/building-ai-agents-with-knowledge-graph-memory-a-comprehensive-guide-to-graphiti-3b77e6084dec)

---

## 4. Incremental Graph Updates

### IncRML: 변경 감지 및 자동 업데이트

```
데이터 소스 변경 감지 → 변경 분류 → LDES로 퍼블리싱
                ↓
      업데이트된 멤버만 재생성
```

### FastKGE: Incremental LoRA

- 새로운 node/relation에 low-rank adapter만 업데이트
- 재훈련 불필요
- **훈련 비용 68% 감소**, 성능 유지

### IncDE: Knowledge Distillation

- Graph distance와 structural centrality로 새 triple 정렬
- Distillation loss로 기존 표현 유지
- Node/edge importance에 따른 가중치 부여

**출처:**

- [Semantic Web Journal - IncRML](https://www.semantic-web-journal.net/content/incrml-incremental-knowledge-graph-construction-heterogeneous-data-sources)
- [AI Models - FastKGE](https://www.aimodels.fyi/papers/arxiv/fast-continual-knowledge-graph-embedding-via-incremental)

---

## 5. Graph Embedding

### Embedding Constraints

| 제약                   | 효과                                         |
| ---------------------- | -------------------------------------------- |
| **Non-negativity**     | 0~1 양수값으로 sparsity 유도                 |
| **Entailment rules**   | symmetry, inversion, composition 직접 인코딩 |
| **Subgraph embedding** | 전체 구조의 contextual information 포착      |

### GRAG: GNN-based Retriever

- GNN으로 그래프 데이터 인코딩
- Query와의 similarity로 entity scoring
- **Graph multi-hop reasoning benchmark에서 SOTA 초과**

### Graph Attention Networks (GATs)

- Subgraph의 contextual embeddings 생성
- 관계 및 구조 정보 통합

**출처:**

- [Towards Data Science - Embeddings + KG](https://towardsdatascience.com/embeddings-knowledge-graphs-the-ultimate-tools-for-rag-systems-cbbcca29f0fd/)
- [arXiv - GRAG](https://arxiv.org/html/2405.16506v1)

---

## 6. Query Optimization

### Query Parametrization

- 일반적 쿼리 구조의 최적화/캐싱
- 실행 속도 향상

### Asynchronous Querying

- LLM이 KG 응답을 기다리지 않음
- 여러 데이터베이스 쿼리 동시 발행

### NVIDIA RAPIDS cuGraph

- GPU-accelerated graph analytics
- 대규모 그래프에서 효율성 대폭 향상

### LightRAG

- GraphRAG 계산 비용 해결
- **10배 토큰 감소**, 유사한 정확도
- Real-time application에 적합

**출처:**

- [Wisecube AI - KG-based Q&A](https://www.wisecube.ai/blog/optimizing-llm-precision-with-knowledge-graph-based-natural-language-qa-systems/)
- [NVIDIA - LLM-Driven Knowledge Graphs](https://developer.nvidia.com/blog/insights-techniques-and-evaluation-for-llm-driven-knowledge-graphs/)

---

## 7. Contradiction Handling (충돌 해결)

### CRDL 접근법: Detect-Then-Resolve

```
1. Conflict Detection
     ↓
2. LLM으로 진실 식별
     ↓
3. 관계/속성 유형별 필터링
```

### Neuro-Symbolic AI

- Symbolic + Neural representation 통합
- Contradiction detection 개선
- KGRL 강건성, 신뢰성, 예측 성능 향상

### Conflict Resolution 정책

| 정책                    | 설명                          |
| ----------------------- | ----------------------------- |
| **Trusted source 우선** | 신뢰도 높은 소스 정보 채택    |
| **Timestamp 활용**      | 최신 정보 우선                |
| **Knowledge Alignment** | 중복, 세분화 차이, 모순 식별  |
| **Knowledge Fusion**    | 충돌 제거, 일관성/완전성 유지 |

### 대규모 KG 오류율

- DBpedia, Wikidata: 약 **2.8% error rate**
- 다중 소스 통합 시 데이터 품질 관리 필수

**출처:**

- [MDPI - Detect-Then-Resolve](https://www.mdpi.com/2227-7390/12/15/2318)
- [Springer - Neuro-Symbolic AI](https://link.springer.com/chapter/10.1007/978-3-031-99554-5_42)

---

## 8. Entity Disambiguation

### 2단계 방법 (ISWC 2024)

```
1. Candidate entity + taxonomy subgraph 생성
     ↓
2. Pruning algorithm으로 후보 반복 제거
     ↓
3. 최종 하나의 entity 선택
```

### DisambiguART

- 관련 맥락 재평가로 정확한 의미 할당
- Ontology/다른 KG와의 alignment 시 ambiguity 처리

### Neo4j 중복 처리

- Entity type별 그룹화
- LLM으로 중복 식별 및 속성 병합

**출처:**

- [ACM - ISWC 2024](https://dl.acm.org/doi/10.1007/978-3-031-77844-5_9)
- [Neo4j - Unstructured to KG](https://neo4j.com/blog/developer/unstructured-text-to-knowledge-graph/)

---

## 9. Microsoft GraphRAG

### 핵심 기능

- 입력 corpus에서 **Knowledge Graph 자동 추출**
- Community summaries + graph ML 출력 활용
- 쿼리 이전에 semantic structure 미리 확인 가능

### Naive RAG 한계 극복

- "connecting the dots" 질문 처리
- 여러 정보 조각을 공유 속성으로 연결

### LazyGraphRAG (2024년 말)

- KG 추출에 **LLM 의존성 제거**
- 계산 비용 및 복잡성 감소

**출처:**

- [Microsoft Research - GraphRAG](https://www.microsoft.com/en-us/research/blog/graphrag-unlocking-llm-discovery-on-narrative-private-data/)
- [GitHub - microsoft/graphrag](https://github.com/microsoft/graphrag)

---

## 10. Neo4j GraphRAG

### Native Vector Search + Knowledge Graph

```
HNSW 인덱스 (진입점) → 그래프 순회 (추가 컨텍스트)
         ↓
Implicit semantics (embedding) + Explicit semantics (relationships)
         ↓
      정확하고 맥락 풍부한 답변
```

### Tool Selection & Routing

- LangChain-Neo4j (structured) + Vector search (semantic)
- Agent로 래핑하여 질문 유형에 따라 자동 선택

### GraphRAG Python Package 기능

- Vector search
- Full-text search
- Graph traversal
- Text-to-Cypher

**출처:**

- [Neo4j - RAG Tutorial](https://neo4j.com/blog/developer/rag-tutorial/)
- [Analytics Vidhya - GraphRAG with Neo4j](https://www.analyticsvidhya.com/blog/2024/11/graphrag-with-neo4j/)

---

## 권장 구현 전략

### 1단계: Entity/Relation Extraction

- SpaCy 기반 + LLM 병행
- 비용과 품질 균형

### 2단계: Schema Design

- Temporal quadruple 구조 채택
- Episodic/Semantic 메모리 구분

### 3단계: Update Strategy

- IncRML 변경 감지
- FastKGE incremental embedding

### 4단계: Query Optimization

- Query parametrization + caching
- Hybrid retrieval (vector + graph + full-text)

### 5단계: Quality Assurance

- Contradiction detection & resolution
- Entity disambiguation
- Error rate < 3% 목표

---

## Production-Ready 도구

| 도구             | 특징             | 사용 사례       |
| ---------------- | ---------------- | --------------- |
| **FalkorDB**     | 성능 중시        | 대규모 그래프   |
| **Cognee**       | Agentic systems  | 에이전트 메모리 |
| **AutoSchemaKG** | 동적 스키마 발견 | 자동화          |
| **Neo4j**        | 성숙한 생태계    | Enterprise      |
| **LightRAG**     | 10배 토큰 감소   | 비용 최적화     |

---

_연구일: 2024-11-26_
