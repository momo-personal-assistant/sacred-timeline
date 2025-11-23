# Chunking Strategies Research

**Date**: 2025-11-23
**Author**: RND Week 1
**Purpose**: RAG chunking 전략 이해 및 Momo 프로젝트 최적 전략 도출

---

## Table of Contents

1. [RAG 개요 및 Chunking의 중요성](#1-rag-개요-및-chunking의-중요성)
2. [Chunking 전략 비교](#2-chunking-전략-비교)
3. [LlamaIndex vs LangChain 접근법](#3-llamaindex-vs-langchain-접근법)
4. [Vector DB 관점: Pinecone & Weaviate](#4-vector-db-관점-pinecone--weaviate)
5. [Momo 프로젝트 적용 방안](#5-momo-프로젝트-적용-방안)
6. [실험 계획 및 평가 지표](#6-실험-계획-및-평가-지표)

---

## 1. RAG 개요 및 Chunking의 중요성

### 1.1 RAG (Retrieval-Augmented Generation)이란?

**Definition**: LLM의 생성 능력 + 외부 지식 검색을 결합한 아키텍처

```
User Query
    ↓
Embedding Model (query → vector)
    ↓
Vector Search (find similar chunks)
    ↓
Retrieved Chunks (top-k most relevant)
    ↓
LLM (generate answer using chunks as context)
    ↓
Response
```

**Why RAG?**

- ✅ **최신 정보**: LLM 학습 이후 데이터 활용
- ✅ **도메인 특화**: 회사 내부 문서, 코드베이스 활용
- ✅ **Hallucination 감소**: 실제 문서 기반 답변
- ✅ **비용 효율**: Fine-tuning 대비 저렴

**Momo Use Case**:

```
User: "Alice가 작업 중인 authentication 관련 이슈는?"
    ↓
Vector Search: [
  Chunk 1: "Linear issue ENG-123: Add JWT auth (assigned: alice)",
  Chunk 2: "GitHub PR #456: Implement OAuth (author: alice)",
  Chunk 3: "Zendesk ticket #789: Auth login error (mentions alice)"
]
    ↓
LLM: "Alice는 현재 ENG-123 (JWT 인증 추가)과 PR #456 (OAuth 구현)을 작업 중입니다..."
```

### 1.2 Why Chunking Matters

**The Core Challenge**: 긴 문서 → 어떻게 나눌 것인가?

#### Scenario: Linear Issue with 50 Comments (10,000 tokens)

**Option A: 전체를 하나의 chunk로**

```
Pros:
- 모든 맥락 보존

Cons:
- ❌ Embedding quality 저하 (너무 많은 주제 혼합)
- ❌ Retrieval precision 저하 ("noisy" embedding)
- ❌ LLM context 낭비 (10K tokens = 비용↑, 속도↓)
```

**Option B: 각 comment를 별도 chunk로**

```
Pros:
- ✅ Precise retrieval (각 comment = 명확한 주제)
- ✅ Efficient LLM context (필요한 comment만 전달)

Cons:
- ⚠️ Context loss (issue title, description과의 연결 끊김)
- ⚠️ Fragmentation (대화 흐름 파악 어려움)
```

**Option C: Semantic chunking with overlap**

```
Pros:
- ✅ Balance between precision and context
- ✅ Overlap preserves continuity

Cons:
- ⚠️ More complex implementation
- ⚠️ Storage overhead (overlap = duplication)
```

### 1.3 Key Metrics

#### Retrieval Quality

- **Precision**: 검색된 chunks 중 relevant한 비율
- **Recall**: Relevant chunks 중 검색된 비율
- **MRR (Mean Reciprocal Rank)**: 첫 relevant chunk의 순위
- **NDCG (Normalized Discounted Cumulative Gain)**: Ranking quality

#### Efficiency

- **Chunk Count**: Total chunks (storage & query cost)
- **Avg Chunk Size**: Tokens per chunk (LLM context usage)
- **Embedding Cost**: API calls for embedding generation
- **Query Latency**: Time to retrieve + generate

#### Context Quality

- **Coherence**: Chunk가 self-contained한가?
- **Continuity**: Overlap으로 흐름 유지되는가?
- **Completeness**: 필요한 정보가 포함되었는가?

**Trade-off Visualization**:

```
Chunk Size ←→ Retrieval Precision
            ↕
        Context Quality

Small chunks (100 tokens):
- High precision (focused)
- Low context (fragmented)

Large chunks (1000 tokens):
- Low precision (noisy)
- High context (complete)

Sweet Spot (300-500 tokens):
- Balanced precision
- Sufficient context
- Optimal for most RAG use cases
```

---

## 2. Chunking 전략 비교

### 2.1 Strategy A: Fixed-Size Chunking

**Algorithm**: 고정된 크기로 기계적 분할

```python
def fixed_size_chunking(text: str, chunk_size: int = 500, overlap: int = 50) -> list[str]:
    chunks = []
    start = 0
    while start < len(text):
        end = start + chunk_size
        chunk = text[start:end]
        chunks.append(chunk)
        start += (chunk_size - overlap)  # Slide window
    return chunks
```

**Example**:

```
Input: "Linear issue ENG-123: Add authentication. Description: We need to implement JWT-based auth for our API. This should support refresh tokens and... [continues for 2000 chars]"

Chunk 1 (chars 0-500): "Linear issue ENG-123: Add authentication. Description: We need to implement JWT-based auth for our API. This should support refresh tokens and handle token expiration. Implementation plan: 1. Create token service 2. Add middleware 3. Update user model..."

Chunk 2 (chars 450-950, 50 overlap): "...service 2. Add middleware 3. Update user model. Comment 1 (Alice): I'll start with the token service. Comment 2 (Bob): Make sure to use bcrypt for password hashing..."
```

#### Pros ✅

1. **Simplicity**: 구현 매우 간단 (5 lines of code)
2. **Speed**: 빠른 처리 (no AI/ML required)
3. **Predictability**: Chunk count = ceil(text_length / (chunk_size - overlap))
4. **Consistent Size**: 모든 chunks가 비슷한 크기 (LLM context 예측 가능)

#### Cons ❌

1. **Semantic Breaks**: 문장/문단 중간에서 끊김
   ```
   Bad: "We need to implement JWT-based auth for our API. This sh|ould support refresh tokens..."
                                                             ↑ Cut here
   ```
2. **Context Loss**: 관련 내용이 다른 chunk로 분리
3. **No Structure Awareness**: Code blocks, lists, tables 무시

#### When to Use

- ✅ **Uniform documents**: 구조가 단순하고 일정한 문서 (뉴스 기사, 블로그)
- ✅ **Speed critical**: 실시간 processing 필요
- ❌ **Not for code**: 코드는 구조가 중요 (함수 단위 등)
- ❌ **Not for conversations**: Thread 맥락 유지 필요

### 2.2 Strategy B: Semantic Chunking

**Algorithm**: Embedding 유사도 기반 동적 분할

```python
def semantic_chunking(sentences: list[str], embeddings: list[vector], threshold: float = 0.75) -> list[str]:
    chunks = []
    current_chunk = [sentences[0]]

    for i in range(1, len(sentences)):
        similarity = cosine_similarity(embeddings[i-1], embeddings[i])

        if similarity >= threshold:
            # High similarity = same topic, add to current chunk
            current_chunk.append(sentences[i])
        else:
            # Low similarity = new topic, start new chunk
            chunks.append(' '.join(current_chunk))
            current_chunk = [sentences[i]]

    chunks.append(' '.join(current_chunk))
    return chunks
```

**Example**:

```
Input: Linear issue with multiple comments on different topics

Sentences:
1. "Add JWT authentication to our API"
2. "This should support refresh tokens"
3. "I'll start working on the token service"
4. "By the way, we also need to fix the UI bug"
5. "The login button is not responsive on mobile"

Similarities:
[1 ↔ 2]: 0.92 (both about JWT)
[2 ↔ 3]: 0.85 (both about implementation)
[3 ↔ 4]: 0.25 (topic shift!)
[4 ↔ 5]: 0.88 (both about UI bug)

Result:
Chunk 1: "Add JWT authentication to our API. This should support refresh tokens. I'll start working on the token service."
Chunk 2: "By the way, we also need to fix the UI bug. The login button is not responsive on mobile."
```

#### Pros ✅

1. **Semantic Coherence**: Chunks는 의미적으로 연결됨
2. **Topic Grouping**: 주제 변경 시 자동 분할
3. **Research-Backed**: 2-3% better recall than fixed-size (benchmarks)

#### Cons ❌

1. **Cost**: 모든 문장을 embedding해야 함
   - 10K word document = ~300 sentences = 300 API calls (or local model inference)
   - Cost: 300 × $0.00002 (OpenAI) = $0.006 per document
2. **Latency**: Embedding generation 시간 소요
3. **Variable Size**: Chunks 크기가 불균일 (10 tokens ~ 2000 tokens)
4. **Complexity**: Threshold tuning 필요

#### When to Use

- ✅ **Multi-topic documents**: 여러 주제가 섞인 문서 (회의록, issue threads)
- ✅ **Quality > Speed**: 정확도가 중요한 경우
- ❌ **Real-time**: 빠른 처리 필요한 경우
- ❌ **Budget-constrained**: API cost가 부담되는 경우

### 2.3 Strategy C: Recursive Character Splitting

**Algorithm**: 계층적 separator로 점진적 분할

```python
def recursive_split(text: str, separators: list[str], chunk_size: int = 500) -> list[str]:
    # Default separators: ["\n\n", "\n", ". ", " ", ""]
    # Try separators in order until chunks are small enough

    if len(text) <= chunk_size:
        return [text]

    for separator in separators:
        if separator in text:
            splits = text.split(separator)
            chunks = []

            for split in splits:
                if len(split) <= chunk_size:
                    chunks.append(split)
                else:
                    # Recursively split with next separator
                    chunks.extend(recursive_split(split, separators[1:], chunk_size))

            return chunks

    # Fallback: character-level split
    return [text[i:i+chunk_size] for i in range(0, len(text), chunk_size)]
```

**Example**:

```
Input:
"# Issue Title\n\nThis is the description.\n\nComment 1: I agree with this approach. Let's move forward.\n\nComment 2: One concern - have we considered security?"

Separators: ["\n\n", "\n", ". ", " "]

Step 1 (split by "\n\n"):
- "# Issue Title"
- "This is the description."
- "Comment 1: I agree with this approach. Let's move forward."
- "Comment 2: One concern - have we considered security?"

All splits <= chunk_size → Done!

Result:
Chunk 1: "# Issue Title"
Chunk 2: "This is the description."
Chunk 3: "Comment 1: I agree with this approach. Let's move forward."
Chunk 4: "Comment 2: One concern - have we considered security?"
```

#### Pros ✅

1. **Structure-Aware**: 자연스러운 경계 (paragraphs, sentences)
2. **Balanced**: Fixed-size의 predictability + 의미 경계 존중
3. **No Embeddings**: Semantic보다 빠르고 저렴
4. **LangChain Default**: 실전에서 검증됨

#### Cons ❌

1. **Not Truly Semantic**: Separator 기반이지 의미 기반 아님
2. **Requires Good Separators**: 문서 구조에 의존
3. **Edge Cases**: Separator 없으면 fallback to character split

#### When to Use

- ✅ **Structured text**: Markdown, HTML, code with clear structure
- ✅ **Balance needed**: Quality와 speed 모두 중요
- ✅ **General purpose**: 대부분의 use case에 적합

### 2.4 Strategy Comparison Table

| Aspect                        | Fixed-Size           | Semantic                | Recursive                  |
| ----------------------------- | -------------------- | ----------------------- | -------------------------- |
| **Implementation Complexity** | ⭐ (trivial)         | ⭐⭐⭐⭐⭐ (complex)    | ⭐⭐⭐ (moderate)          |
| **Semantic Quality**          | ⭐⭐ (poor)          | ⭐⭐⭐⭐⭐ (excellent)  | ⭐⭐⭐⭐ (good)            |
| **Speed**                     | ⭐⭐⭐⭐⭐ (instant) | ⭐⭐ (slow, embeddings) | ⭐⭐⭐⭐ (fast)            |
| **Cost**                      | ⭐⭐⭐⭐⭐ (free)    | ⭐⭐ (embedding costs)  | ⭐⭐⭐⭐⭐ (free)          |
| **Chunk Size Consistency**    | ⭐⭐⭐⭐⭐ (uniform) | ⭐ (highly variable)    | ⭐⭐⭐ (somewhat variable) |
| **Structure Awareness**       | ❌ (none)            | ✅ (via semantics)      | ✅ (via separators)        |
| **Best For**                  | Simple docs          | Multi-topic docs        | General purpose            |

**Benchmarks (from research)**:

- Semantic chunking: +2-3% recall vs recursive
- Recursive chunking: 10x faster than semantic
- Fixed-size: 100x faster than semantic, but -5% recall

---

## 3. LlamaIndex vs LangChain 접근법

### 3.1 LlamaIndex Philosophy

**Core Principle**: "Index-first" approach

```python
from llama_index import SimpleDirectoryReader, VectorStoreIndex
from llama_index.node_parser import SemanticSplitterNodeParser

# Load documents
documents = SimpleDirectoryReader('data/').load_data()

# Semantic chunking
splitter = SemanticSplitterNodeParser(
    buffer_size=1,  # Number of sentences to group before checking similarity
    breakpoint_percentile_threshold=95,  # Only split at top 5% dissimilarity
    embed_model=OpenAIEmbedding()
)

nodes = splitter.get_nodes_from_documents(documents)

# Create index
index = VectorStoreIndex(nodes)

# Query
query_engine = index.as_query_engine()
response = query_engine.query("What are Alice's current tasks?")
```

**Key Features**:

1. **Semantic Splitter**: Adaptively picks breakpoints based on embedding similarity
2. **Node Abstraction**: Chunks = "Nodes" with metadata
3. **Hierarchical Chunking**: Parent-child relationships between chunks

**LlamaIndex Chunking Options**:

```python
# 1. Simple fixed-size
from llama_index.node_parser import SimpleNodeParser
parser = SimpleNodeParser.from_defaults(chunk_size=512, chunk_overlap=50)

# 2. Semantic (recommended)
from llama_index.node_parser import SemanticSplitterNodeParser
parser = SemanticSplitterNodeParser(embed_model=embed_model)

# 3. Sentence-based
from llama_index.node_parser import SentenceSplitter
parser = SentenceSplitter(chunk_size=512, chunk_overlap=128)
```

### 3.2 LangChain Philosophy

**Core Principle**: "Chain-first" approach (composable transformations)

```python
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain.embeddings import OpenAIEmbeddings
from langchain.vectorstores import Pinecone

# Recursive chunking
text_splitter = RecursiveCharacterTextSplitter(
    chunk_size=1000,
    chunk_overlap=200,
    separators=["\n\n", "\n", ". ", " ", ""]
)

chunks = text_splitter.split_text(long_text)

# Embed and store
embeddings = OpenAIEmbeddings()
vectorstore = Pinecone.from_texts(chunks, embeddings)

# Query
docs = vectorstore.similarity_search("Alice's tasks", k=5)
```

**Key Features**:

1. **RecursiveCharacterTextSplitter**: Hierarchical splitting (default choice)
2. **Multiple Splitters**: Character, token, markdown, code-specific
3. **Modular**: Splitter ↔ Vectorstore ↔ LLM 독립적

**LangChain Chunking Options**:

```python
# 1. Recursive (recommended, default)
from langchain.text_splitter import RecursiveCharacterTextSplitter
splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=200)

# 2. Character (simple)
from langchain.text_splitter import CharacterTextSplitter
splitter = CharacterTextSplitter(separator="\n\n", chunk_size=1000)

# 3. Token-based (GPT-4 token limits)
from langchain.text_splitter import TokenTextSplitter
splitter = TokenTextSplitter(chunk_size=512, chunk_overlap=50)

# 4. Code-specific
from langchain.text_splitter import PythonCodeTextSplitter
splitter = PythonCodeTextSplitter(chunk_size=500)
```

### 3.3 Comparison: LlamaIndex vs LangChain

| Aspect               | LlamaIndex                      | LangChain                         |
| -------------------- | ------------------------------- | --------------------------------- |
| **Default Strategy** | Semantic (AI-powered)           | Recursive (rule-based)            |
| **Philosophy**       | Semantic-first, quality-focused | Pragmatic, speed-focused          |
| **Best For**         | High-quality retrieval          | General-purpose RAG               |
| **Complexity**       | Higher (more abstraction)       | Lower (more control)              |
| **Cost**             | Higher (embedding per sentence) | Lower (no embedding for chunking) |
| **Speed**            | Slower (embedding calls)        | Faster (rule-based)               |
| **Flexibility**      | Opinionated (index-centric)     | Flexible (chain-centric)          |

**Momo's Choice**: **LangChain RecursiveCharacterTextSplitter** for baseline, **Semantic Chunking** for comparison

**Rationale**:

- ✅ Recursive = proven, fast, good enough for 80% of cases
- ✅ Semantic = higher quality, useful for comparison/experimentation
- ✅ LangChain = more flexible, easier to customize

---

## 4. Vector DB 관점: Pinecone & Weaviate

### 4.1 Pinecone Best Practices

**Core Recommendations**:

#### 1. Chunk Size Guidelines

```
Too Large (>1000 tokens):
- Mixed topics → "noisy" embedding
- Low retrieval precision
- Expensive LLM context

Too Small (<100 tokens):
- Fragmented context
- Too many chunks → slower search
- Missing surrounding information

Sweet Spot (200-500 tokens):
- Clear, focused topic per chunk
- Efficient retrieval
- Sufficient context for LLM
```

**Pinecone's Rule of Thumb**:

> "If the chunk makes sense to a human without surrounding context, it will make sense to the LLM."

#### 2. Metadata Strategy

**DON'T**: Store full text in metadata

```python
# ❌ Bad: Pinecone indexes all metadata, wastes space
metadata = {
    "text": "Linear issue ENG-123: Add authentication...",  # Don't do this!
    "platform": "linear",
    "id": "ENG-123"
}
```

**DO**: Store only searchable attributes

```python
# ✅ Good: Only metadata for filtering
metadata = {
    "platform": "linear",
    "object_type": "issue",
    "assignee": "alice",
    "labels": ["auth", "backend"],
    "created_at": 1700000000,
    "url": "https://linear.app/..."
}
```

#### 3. Hybrid Search Pattern

**Problem**: Pure vector search misses exact phrases

**Solution**: Combine semantic + keyword

```python
from pinecone_text.sparse import BM25Encoder

# BM25 (keyword) encoder
bm25 = BM25Encoder().fit(corpus)

# Dense (semantic) embedding
dense_embedding = openai_embed(query)

# Sparse (keyword) embedding
sparse_embedding = bm25.encode_queries(query)

# Hybrid query
results = index.query(
    vector=dense_embedding,
    sparse_vector=sparse_embedding,
    top_k=10,
    filter={"platform": "linear"}
)
```

**When to Use**:

- ✅ Legal/Finance: Exact terminology matters ("Section 3.2")
- ✅ Code search: Function names ("def authenticate()")
- ✅ Acronyms: "JWT" vs "JSON Web Token"

#### 4. Pre-Chunking vs On-Demand

**Pre-Chunking (Recommended)**:

```python
# Offline: Process documents → chunks → embeddings → store in Pinecone
for document in documents:
    chunks = text_splitter.split(document.text)
    embeddings = embed_model.embed(chunks)
    index.upsert(zip(ids, embeddings, metadatas))

# Online: Query only (fast!)
query_embedding = embed_model.embed(user_query)
results = index.query(query_embedding, top_k=5)
```

**Pros**:

- ✅ Fast query time (pre-computed)
- ✅ Scalable (millions of chunks)

**On-Demand**:

```python
# Online: Chunk → embed → search on every query
chunks = text_splitter.split(documents)
embeddings = embed_model.embed(chunks)
results = similarity_search(query_embedding, embeddings)
```

**Cons**:

- ❌ Slow (re-compute every time)
- ❌ Only works for small datasets

**Momo**: Use pre-chunking (canonical_objects → chunks → store)

### 4.2 Weaviate Best Practices

**Core Recommendations**:

#### 1. Content-Specific Chunking

```python
# FAQ: Small chunks (1 question + answer)
faq_chunks = [
    "Q: How to reset password? A: Go to Settings > Security > Reset Password",
    "Q: How to enable 2FA? A: Settings > Security > Two-Factor Authentication"
]

# Narrative: Large chunks with overlap
narrative_chunks = chunk_with_overlap(
    text=novel,
    chunk_size=1500,
    overlap=300  # Preserve story flow
)

# Technical docs: Section-based
tech_chunks = split_by_headers(documentation)  # H1, H2, H3
```

**Lesson**: One-size-fits-all chunking는 없다. Document type에 맞게 조정.

#### 2. Hybrid Search Implementation

**Weaviate's Native Hybrid**:

```python
import weaviate

client = weaviate.Client("http://localhost:8080")

# Hybrid search (BM25 + vector)
result = client.query.get("CanonicalObject", ["title", "body"]) \
    .with_hybrid(
        query="authentication issue",
        alpha=0.75  # 0 = pure BM25, 1 = pure vector, 0.75 = balanced
    ) \
    .with_limit(10) \
    .do()
```

**Alpha Tuning**:

- `alpha=0.0`: Pure keyword (BM25) - good for exact matches
- `alpha=0.5`: Balanced - good for general queries
- `alpha=1.0`: Pure semantic - good for conceptual queries

#### 3. Cleaning Before Chunking

**Common Pitfalls** (from Weaviate blog):

```python
# ❌ Bad: Ingest without cleaning
chunks = split(raw_html)  # Includes <script>, boilerplate, etc.

# ✅ Good: Clean first
from bs4 import BeautifulSoup

def clean_html(html: str) -> str:
    soup = BeautifulSoup(html, 'html.parser')

    # Remove script, style tags
    for tag in soup(['script', 'style', 'nav', 'footer']):
        tag.decompose()

    # Extract text
    text = soup.get_text()

    # Normalize whitespace
    text = ' '.join(text.split())

    return text

chunks = split(clean_html(raw_html))
```

**Weaviate Quote**:

> "Most RAG failures are self-inflicted, not database-inflicted. Nail ingestion & cleaning."

---

## 5. Momo 프로젝트 적용 방안

### 5.1 Chunking 전략 설계 (3가지)

#### Strategy A: Fixed-Size (Baseline)

```typescript
interface FixedSizeConfig {
  chunkSize: number; // 500 characters
  overlap: number; // 100 characters
}

function chunkFixedSize(obj: CanonicalObject, config: FixedSizeConfig): Chunk[] {
  const fullText = `${obj.title}\n\n${obj.body}`;
  const chunks: Chunk[] = [];

  let start = 0;
  let index = 0;

  while (start < fullText.length) {
    const end = start + config.chunkSize;
    const chunkText = fullText.slice(start, end);

    chunks.push({
      id: `${obj.id}:chunk:${index}`,
      canonical_object_id: obj.id,
      chunk_index: index,
      content: chunkText,
      method: 'fixed-size',
      metadata: {
        char_start: start,
        char_end: end,
        platform: obj.platform,
        object_type: obj.object_type,
      },
    });

    start += config.chunkSize - config.overlap;
    index++;
  }

  return chunks;
}
```

**Parameters to Test**:

- Chunk sizes: 300, 500, 1000 characters
- Overlaps: 0, 50, 100, 200 characters

#### Strategy B: Semantic (Comment/Thread-Based)

```typescript
interface SemanticConfig {
  preserveMetadata: boolean; // Include issue title in each comment chunk?
  groupByThread: boolean; // Group comments by thread_id?
}

function chunkSemantic(obj: CanonicalObject, config: SemanticConfig): Chunk[] {
  const chunks: Chunk[] = [];

  // Chunk 0: Main content (issue/ticket description)
  const mainContent = config.preserveMetadata ? `${obj.title}\n\n${obj.body}` : obj.body;

  chunks.push({
    id: `${obj.id}:chunk:0`,
    canonical_object_id: obj.id,
    chunk_index: 0,
    content: mainContent,
    method: 'semantic',
    metadata: {
      chunk_type: 'main',
      platform: obj.platform,
      object_type: obj.object_type,
    },
  });

  // Chunk 1-N: Each comment as separate chunk
  const comments = extractComments(obj); // From relations or sub-objects

  comments.forEach((comment, idx) => {
    const commentContent = config.preserveMetadata
      ? `Issue: ${obj.title}\n\nComment by ${comment.author}: ${comment.body}`
      : comment.body;

    chunks.push({
      id: `${obj.id}:chunk:${idx + 1}`,
      canonical_object_id: obj.id,
      chunk_index: idx + 1,
      content: commentContent,
      method: 'semantic',
      metadata: {
        chunk_type: 'comment',
        comment_id: comment.id,
        author: comment.author,
        created_at: comment.created_at,
        platform: obj.platform,
      },
    });
  });

  return chunks;
}
```

**Parameters to Test**:

- `preserveMetadata`: true vs false (trade-off: context vs conciseness)
- `groupByThread`: true vs false (for threaded discussions)

#### Strategy C: Relational (Thread-Aware)

```typescript
interface RelationalConfig {
  maxThreadLength: number; // Max tokens per thread chunk
  preserveHierarchy: boolean; // Include parent-child structure?
}

function chunkRelational(obj: CanonicalObject, config: RelationalConfig): Chunk[] {
  const chunks: Chunk[] = [];

  // Build thread tree
  const threads = buildThreadTree(obj);

  threads.forEach((thread, threadIdx) => {
    let currentChunk = `Thread ${threadIdx + 1}:\n\n`;
    let tokenCount = countTokens(currentChunk);

    thread.comments.forEach((comment) => {
      const indent = '  '.repeat(comment.depth);
      const commentText = `${indent}${comment.author}: ${comment.body}\n`;
      const commentTokens = countTokens(commentText);

      if (tokenCount + commentTokens > config.maxThreadLength) {
        // Save current chunk, start new one
        chunks.push({
          id: `${obj.id}:thread:${threadIdx}:chunk:${chunks.length}`,
          canonical_object_id: obj.id,
          chunk_index: chunks.length,
          content: currentChunk,
          method: 'relational',
          metadata: {
            thread_id: thread.id,
            comment_count: thread.comments.length,
          },
        });

        currentChunk = commentText;
        tokenCount = commentTokens;
      } else {
        currentChunk += commentText;
        tokenCount += commentTokens;
      }
    });

    // Save final chunk
    if (currentChunk.trim()) {
      chunks.push({
        id: `${obj.id}:thread:${threadIdx}:chunk:${chunks.length}`,
        canonical_object_id: obj.id,
        chunk_index: chunks.length,
        content: currentChunk,
        method: 'relational',
        metadata: {
          thread_id: thread.id,
        },
      });
    }
  });

  return chunks;
}
```

**Parameters to Test**:

- `maxThreadLength`: 300, 500, 1000 tokens
- `preserveHierarchy`: true vs false (indented threads vs flat)

### 5.2 Storage Schema

**Option A: Separate Chunks Table (Recommended)**

```sql
CREATE TABLE chunks (
  id VARCHAR(500) PRIMARY KEY,  -- "platform|workspace|type|id:chunk:N"
  canonical_object_id VARCHAR(255) NOT NULL REFERENCES canonical_objects(id),
  chunk_index INTEGER NOT NULL,
  content TEXT NOT NULL,
  method VARCHAR(50) NOT NULL,  -- 'fixed-size' | 'semantic' | 'relational'

  -- Metadata
  metadata JSONB,  -- chunk-specific metadata

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(canonical_object_id, method, chunk_index)
);

CREATE INDEX idx_chunks_canonical ON chunks(canonical_object_id);
CREATE INDEX idx_chunks_method ON chunks(method);
```

**Option B: JSONB in canonical_objects**

```sql
ALTER TABLE canonical_objects
ADD COLUMN chunks JSONB;  -- Array of {id, content, method, metadata}
```

**Decision**: **Option A (Separate Table)**

**Rationale**:

- ✅ **Scalability**: 1 object = N chunks (millions of chunks)
- ✅ **Query Performance**: Index chunks separately
- ✅ **Flexibility**: Different embedding strategies per chunk
- ❌ Option B: JSONB becomes huge, slow queries

### 5.3 Chunk → Embedding Pipeline

```typescript
// packages/chunking/src/pipeline.ts

import { OpenAIEmbeddings } from '@langchain/openai';

interface ChunkingPipeline {
  strategy: 'fixed-size' | 'semantic' | 'relational';
  embedModel: 'openai' | 'cohere' | 'voyage';
}

async function processObject(obj: CanonicalObject, pipeline: ChunkingPipeline) {
  // Step 1: Chunk
  const chunks = await chunkByStrategy(obj, pipeline.strategy);

  // Step 2: Embed (batch for efficiency)
  const embedder = getEmbedder(pipeline.embedModel);
  const embeddings = await embedder.embedDocuments(chunks.map((c) => c.content));

  // Step 3: Store in chunks table
  await db.insertChunks(chunks);

  // Step 4: Store embeddings in vector DB
  await vectorDB.upsert(
    chunks.map((chunk, idx) => ({
      id: chunk.id,
      values: embeddings[idx],
      metadata: {
        canonical_object_id: obj.id,
        platform: obj.platform,
        chunk_index: chunk.chunk_index,
        method: chunk.method,
        ...chunk.metadata,
      },
    }))
  );
}
```

**Optimization**: Batch embed 100 chunks at a time (API efficiency)

---

## 6. 실험 계획 및 평가 지표

### 6.1 Experiment Design

#### Test Set: Worst Cases (20 samples)

```typescript
interface WorstCase {
  case_id: string;
  description: string;
  challenge: string;
  canonical_object: CanonicalObject;
}

const worstCases: WorstCase[] = [
  {
    case_id: 'WC-001',
    description: 'Linear issue with 50+ comments',
    challenge: 'Long thread, multiple topics mixed',
    canonical_object: {
      /* ... */
    },
  },
  {
    case_id: 'WC-002',
    description: 'Zendesk ticket with 500-line code block',
    challenge: 'Code must not be split mid-function',
    canonical_object: {
      /* ... */
    },
  },
  // ... 18 more
];
```

#### Configurations to Test

```typescript
const experiments: ExperimentConfig[] = [
  // Strategy A variants
  { strategy: 'fixed-size', chunkSize: 300, overlap: 50 },
  { strategy: 'fixed-size', chunkSize: 500, overlap: 100 },
  { strategy: 'fixed-size', chunkSize: 1000, overlap: 200 },

  // Strategy B variants
  { strategy: 'semantic', preserveMetadata: true },
  { strategy: 'semantic', preserveMetadata: false },

  // Strategy C variants
  { strategy: 'relational', maxThreadLength: 500 },
  { strategy: 'relational', maxThreadLength: 1000 },
];
```

### 6.2 Automated Metrics

```typescript
interface ChunkingMetrics {
  // Size distribution
  chunkSizeStats: {
    min: number;
    max: number;
    avg: number;
    std: number;
    p50: number; // Median
    p95: number;
  };

  // Relation preservation
  relationStats: {
    totalReferences: number; // Total refs in original
    brokenReferences: number; // Refs pointing to different chunk
    preservationRate: number; // (total - broken) / total
  };

  // Efficiency
  efficiency: {
    totalChunks: number;
    avgTokensPerChunk: number;
    storageOverhead: number; // Overlap duplication ratio
  };
}

async function computeMetrics(
  originalObject: CanonicalObject,
  chunks: Chunk[]
): Promise<ChunkingMetrics> {
  // 1. Chunk size distribution
  const sizes = chunks.map((c) => c.content.length);
  const chunkSizeStats = {
    min: Math.min(...sizes),
    max: Math.max(...sizes),
    avg: sizes.reduce((a, b) => a + b, 0) / sizes.length,
    std: standardDeviation(sizes),
    p50: percentile(sizes, 0.5),
    p95: percentile(sizes, 0.95),
  };

  // 2. Relation preservation
  const relationStats = analyzeRelations(originalObject, chunks);

  // 3. Efficiency
  const efficiency = {
    totalChunks: chunks.length,
    avgTokensPerChunk: chunks.reduce((sum, c) => sum + countTokens(c.content), 0) / chunks.length,
    storageOverhead: calculateOverlap(chunks),
  };

  return { chunkSizeStats, relationStats, efficiency };
}
```

### 6.3 Manual Evaluation

```typescript
interface ManualEvaluation {
  case_id: string;
  strategy: string;
  scores: {
    coherence: number; // 1-5: Chunk가 self-contained한가?
    continuity: number; // 1-5: Overlap으로 흐름 유지되는가?
    completeness: number; // 1-5: 필요한 정보가 포함되었는가?
    readability: number; // 1-5: 사람이 읽기 편한가?
  };
  notes: string;
}

// Manual review template
const evaluationForm = `
Case: ${worstCase.case_id} - ${worstCase.description}
Strategy: ${strategy}

Total Chunks: ${chunks.length}

Chunk 1:
\"\"\"
${chunks[0].content}
\"\"\"

Coherence (1-5): [ ]  // Does this chunk make sense on its own?
Continuity (1-5): [ ]  // Does overlap preserve context?
Completeness (1-5): [ ]  // Is all necessary info included?
Readability (1-5): [ ]  // Is it easy to understand?

Notes: _____________
`;
```

### 6.4 Evaluation Process

#### Step 1: Run Experiments

```bash
$ npm run experiment:chunking

Running experiment: fixed-size-300-50...
  Processed 20 worst cases
  Generated 547 chunks
  Avg chunk size: 298 chars
  Relation preservation: 92.3%

Running experiment: semantic-preserve-metadata...
  Processed 20 worst cases
  Generated 312 chunks
  Avg chunk size: 487 chars
  Relation preservation: 98.7%

...

Results saved to: experiments/chunking/results/
```

#### Step 2: Generate Reports

```typescript
// experiments/chunking/analyze.ts

const results = await loadAllResults();

// Compare strategies
const comparison = {
  strategies: ['fixed-size-500', 'semantic-preserve', 'relational-500'],
  metrics: {
    chunkCount: [547, 312, 201],
    avgChunkSize: [498, 487, 724],
    relationPreservation: [92.3, 98.7, 99.2],
  },
  manualScores: {
    coherence: [3.2, 4.5, 4.8],
    continuity: [2.8, 4.2, 4.9],
    completeness: [3.5, 4.3, 4.7],
  },
};

// Output: experiments/chunking/results/comparison.md
generateMarkdownReport(comparison);
```

#### Step 3: Manual Review (20 worst cases × 3 strategies = 60 reviews)

- Review top 3 strategies based on automated metrics
- Score each on 1-5 scale
- Document edge cases and failures

---

## 7. Summary & Recommendations

### 7.1 Key Learnings

1. **No One-Size-Fits-All**: Document type matters
   - FAQ → Small chunks (question+answer)
   - Narrative → Large chunks with overlap
   - Threads → Thread-aware chunking

2. **Semantic > Fixed-Size**: +2-3% recall, but higher cost
   - Use for quality-critical applications
   - Fixed-size as baseline for comparison

3. **Recursive = Practical Default**: Balance of quality & speed
   - LangChain's default for good reason
   - Works well for structured text

4. **Overlap is Critical**: Preserves context across boundaries
   - 10-20% overlap recommended
   - Too much = storage waste, too little = context loss

5. **Clean Before Chunk**: Garbage in = garbage out
   - Strip boilerplate, normalize text
   - Most RAG failures = poor data quality

### 7.2 Momo Recommendations

**Primary Strategy**: **Semantic (Comment-Based)** with metadata preservation

**Rationale**:

- ✅ Linear/Zendesk = multi-topic threads (semantic chunking excels)
- ✅ Each comment = natural semantic unit
- ✅ Metadata preservation = better retrieval context
- ⚠️ Higher cost acceptable (quality > speed for Momo)

**Fallback Strategy**: **Recursive** for comparison

**Implementation Plan**:

1. **Phase 7**: Implement all 3 strategies
2. **Phase 8**: Build experiment framework
3. **Phase 9**: Run experiments on worst cases
4. **Decision**: Choose based on metrics + manual review

**Expected Outcome**:

- Semantic strategy will win on quality metrics
- Relational strategy may win on thread coherence
- Fixed-size will be fastest but lowest quality

---

## References

1. [A Guide to Chunking Strategies for RAG (Zilliz)](https://zilliz.com/learn/guide-to-chunking-strategies-for-rag)
2. [Breaking up is hard to do: Chunking in RAG (Stack Overflow Blog)](https://stackoverflow.blog/2024/12/27/breaking-up-is-hard-to-do-chunking-in-rag-applications/)
3. [LlamaIndex Semantic Chunker Documentation](https://docs.llamaindex.ai/en/stable/examples/node_parsers/semantic_chunking/)
4. [LangChain Text Splitters](https://python.langchain.com/docs/concepts/text_splitters/)
5. [Chunking Strategies for RAG (Weaviate)](https://weaviate.io/blog/chunking-strategies-for-rag)
6. [Chunking Strategies for LLM Applications (Pinecone)](https://www.pinecone.io/learn/chunking-strategies/)

---

**Document Version**: 1.0
**Last Updated**: 2025-11-23
**Next Review**: After Phase 9 (Experiment Results)
