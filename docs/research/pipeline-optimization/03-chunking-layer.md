# Chunking Layer 최적화 전략

> 텍스트 분할 전략의 최신 연구 및 모범 사례

## 1. 청킹 전략 비교

### 주요 전략

| 전략              | 장점                     | 단점                   | 사용 사례                |
| ----------------- | ------------------------ | ---------------------- | ------------------------ |
| **Fixed-size**    | 계산적으로 단순, 빠름    | 의미 단위 분리 가능    | 일반 텍스트, 균일한 문서 |
| **Semantic**      | 의미적 일관성 유지       | 계산 비용 높음         | 복잡한 문서, 고품질 필요 |
| **Recursive**     | 균형잡힌 접근, 구조 인식 | 중간 수준 복잡도       | 대부분의 RAG 기본값      |
| **Late Chunking** | 문맥 손실 방지           | 새로운 기술, 지원 제한 | 문맥 의존적 콘텐츠       |

### 성능 비교 (NVIDIA 벤치마크 2024)

| 전략           | 정확도      | 표준편차 |
| -------------- | ----------- | -------- |
| **Page-level** | 0.648 (1위) | 0.107    |
| Fixed 1024     | 0.621       | 0.118    |
| Semantic       | 0.615       | 0.125    |

**출처:**

- [NVIDIA - Best Chunking Strategy](https://developer.nvidia.com/blog/finding-the-best-chunking-strategy-for-accurate-ai-responses/)

---

## 2. Late Chunking

### 개념

전통적 방식: 청킹 → 임베딩
Late Chunking: 전체 문서 임베딩 → 청킹

```
┌─────────────────────────────────────────────────────────────┐
│  전체 문서 → Long-context Embedding → 청크로 분할 → 개별 벡터  │
└─────────────────────────────────────────────────────────────┘
```

### 성과

- Top-20 청크 검색 실패율 **35% 감소** (5.7% → 3.7%)
- Contextual BM25와 결합 시 **49% 감소** (5.7% → 2.9%)

### 해결하는 문제

- 대명사 참조 손실 ("그것", "이 제품"의 맥락)
- 용어 모호성
- 문맥 간 연결 파괴

### 지원 모델

- Jina embeddings-v3
- 8192 토큰 이상 지원 모델

**출처:**

- [Jina AI - Late Chunking](https://jina.ai/news/late-chunking-in-long-context-embedding-models/)
- [arXiv:2409.04701](https://arxiv.org/abs/2409.04701)

---

## 3. Contextual Retrieval (Anthropic)

### 개념

각 청크에 문맥 설명(50-100 토큰)을 앞에 추가

```markdown
## 청크 원본

"Q3 매출은 15% 증가했습니다."

## 문맥 추가 후

"이 청크는 2024년 3분기 실적 보고서에서 발췌한 것으로,
ACME Corp의 재무 성과를 다루고 있습니다.
Q3 매출은 15% 증가했습니다."
```

### 성과

| 기법                    | 검색 실패율 감소 |
| ----------------------- | ---------------- |
| Contextual Embeddings만 | 35%              |
| + Contextual BM25       | 49%              |
| + Reranking             | **67%**          |

### 비용

- Prompt Caching으로 비용 효율적
- 100만 문서 토큰당 $1.02

### 권장사항

- **20만 토큰 이하** 지식 베이스: 전체를 프롬프트에 포함이 더 효율적

**출처:**

- [Anthropic - Contextual Retrieval](https://www.anthropic.com/news/contextual-retrieval)
- [DataCamp - Contextual Retrieval Tutorial](https://www.datacamp.com/tutorial/contextual-retrieval-anthropic)

---

## 4. 최적 청크 크기 및 오버랩

### 연구 결과 요약

| 쿼리 유형       | 최적 크기     | 오버랩  |
| --------------- | ------------- | ------- |
| **사실적 쿼리** | 256-512 토큰  | 10-15%  |
| **분석적 쿼리** | 1024+ 토큰    | 15-20%  |
| **일반적 권장** | 512-1024 토큰 | **15%** |

### Context Window 활용 연구 (2024)

- 5가지 청크 크기 테스트: 128, 256, 512, 1024, 2048
- **512 또는 1024 토큰**이 가장 일관되게 우수
- Llama3-70B 최적 활용률: 60-70%

### 시작 설정

```python
from langchain.text_splitter import RecursiveCharacterTextSplitter

splitter = RecursiveCharacterTextSplitter(
    chunk_size=512,      # 400-512 토큰
    chunk_overlap=77,    # 15% 오버랩
    separators=["\n\n", "\n", " ", ""]
)
```

**출처:**

- [arXiv:2407.19794](https://arxiv.org/html/2407.19794v1)
- [LanceDB - Chunking Techniques](https://blog.lancedb.com/chunking-techniques-with-langchain-and-llamaindex/)

---

## 5. 부모-자식 문서 관계

### 구조

```
┌─────────────────────────────────────────────────────────────┐
│  부모 청크 (500-2000 토큰): 넓은 문맥 보존                    │
│     ├── 자식 청크 1 (100-500 토큰): 정밀 검색                 │
│     ├── 자식 청크 2: ...                                     │
│     └── 자식 청크 3: ...                                     │
└─────────────────────────────────────────────────────────────┘
```

### 작동 방식

1. **검색**: 자식 청크로 정밀 매칭
2. **생성**: 부모 문서로 넓은 문맥 제공

### 장점

- 더 나은 문맥 보존 + 정밀한 매칭
- 복잡한 쿼리: 포괄적 문맥
- 단순한 쿼리: 집중된 답변

**출처:**

- [DZone - Parent Document Retrieval](https://dzone.com/articles/parent-document-retrieval-useful-technique-in-rag)

---

## 6. 콘텐츠 타입별 청킹

### 6.1 구조화된 데이터 (테이블, 리스트)

**테이블 처리 전략:**

- 레이아웃 인식 파서 사용 (Unstructured.io, Adobe PDF Extract)
- **테이블 분할 금지**: 행-열 관계 보존 필수
- HTML `<table>` 태그, CSV, Markdown 파이프로 구조 명시

**리스트 처리:**

- 리스트를 하나의 의미 단위로 유지
- 계층 구조 들여쓰기/넘버링 보존

### 6.2 대화/스레드

**대화 청킹 특성:**

- 쿼리+응답 연결: 함께 임베딩
- 문장 기반 임베딩: 각 발화에 적절한 가중치
- Late Chunking 활용: 전체 스레드 문맥 유지

### 6.3 코드

**AST 기반 전략:**

```
┌─────────────────────────────────────────────────────────────┐
│  소스 코드 → Tree-sitter AST → 함수/클래스 단위 청킹          │
└─────────────────────────────────────────────────────────────┘
```

**장점:**

- 구문적 무결성 유지
- 제어 흐름 구조 보존
- 반환 값 정보 손실 방지

**측정 단위:**

- 라인 수가 아닌 **비공백 문자 수**로 측정 (언어/스타일 간 일관성)

**출처:**

- [arXiv - cAST: Code Chunking with AST](https://arxiv.org/html/2506.15655v1)
- [CMU - CAST Paper](https://www.cs.cmu.edu/~sherryw/assets/pubs/2025-cast.pdf)

---

## 7. 고급 기술

### 7.1 Proposition-based Chunking

- 텍스트를 독립적인 명제(proposition)로 분해
- 저자가 "쓴 것"이 아닌 "의미한 것" 인덱싱
- 가장 강력하지만 계산 비용 높음

### 7.2 Agentic Chunking

- AI 에이전트가 문서 분석 후 동적으로 전략 선택
- 여러 전략 동시 적용 가능
- 고가치 복잡 문서에 적합

### 7.3 Cluster-Semantic Chunking

- 청킹을 글로벌 최적화 문제로 재구성
- 초기에 약 50토큰의 세밀한 세그먼트로 분할
- 의미론적 유사성으로 병합

**출처:**

- [Stack Overflow - Breaking up is hard to do](https://stackoverflow.blog/2024/12/27/breaking-up-is-hard-to-do-chunking-in-rag-applications/)
- [IBM - Agentic Chunking](https://www.ibm.com/think/tutorials/use-agentic-chunking-to-optimize-llm-inputs-with-langchain-watsonx-ai)

---

## 8. 학술 연구

### Max-Min Semantic Chunking (2025)

- 의미적 유사성 + Max-Min 알고리즘
- 3개 데이터셋에서 통계적으로 유의미한 성능 향상

### CRUD-RAG (2024)

- 단일 문서 QA: 작은 청크가 적합
- 다중 문서 QA: 큰 청크가 리콜/정밀도 향상
- **작업 유형에 따라 최적 크기 다름**

### Financial Report Chunking (2024)

- 단락 수준을 넘어 구조적 요소로 청킹
- 튜닝 없이 최적의 청크 크기 달성

**출처:**

- [Springer - Max-Min Semantic Chunking](https://link.springer.com/article/10.1007/s10791-025-09638-7)
- [arXiv:2401.17043 - CRUD-RAG](https://arxiv.org/pdf/2401.17043)

---

## 권장 설정

### 기본 시작점

```python
# RecursiveCharacterTextSplitter
chunk_size = 512        # 400-512 토큰
chunk_overlap = 77      # 15%
separators = ["\n\n", "\n", " ", ""]
```

### 성능 개선 순서

1. **Late Chunking** 시도 (35-49% 검색 실패율 감소)
2. **Contextual Retrieval** 추가 (+ reranking = 67% 감소)
3. **콘텐츠별 맞춤 전략** 적용

### 콘텐츠별 최적 전략

| 콘텐츠      | 전략                | 크기        |
| ----------- | ------------------- | ----------- |
| 일반 텍스트 | Recursive/Semantic  | 512-1024    |
| 코드        | AST 기반            | 구문 경계   |
| 테이블      | 분할 금지           | 전체 유지   |
| 대화        | Late Chunking       | 스레드 단위 |
| 복잡 문서   | Proposition/Agentic | 동적        |

---

_연구일: 2024-11-26_
