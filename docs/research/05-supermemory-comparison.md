# SuperMemory vs 현재 시스템 비교 분석

**Date**: 2025-11-25
**Author**: RND Team
**Purpose**: SuperMemory의 ingestion, indexing, chunking 전략 분석 및 현재 시스템 개선점 도출

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Ingestion 비교](#2-ingestion-비교)
3. [Indexing 비교](#3-indexing-비교)
4. [Chunking 비교](#4-chunking-비교)
5. [시스템 설계 철학](#5-시스템-설계-철학)
6. [개선 우선순위](#6-개선-우선순위)
7. [구현 체크리스트](#7-구현-체크리스트)
8. [참고자료](#8-참고자료)

---

## 1. Executive Summary

### SuperMemory의 5가지 핵심 설계 철학

1. **비동기 처리가 기본**: 입력 → 즉시 반환 → 백그라운드 처리 → 폴링 추적
2. **다중 버전 전략**: 임베딩, 모델, 전략 모두 여러 버전 동시 저장
3. **메타데이터가 핵심**: metadata, processingMetadata, containerTags로 유연한 확장
4. **임계값으로 품질 조절**: chunkThreshold + documentThreshold = 정확도/재현율 균형
5. **컨텍스트 보존 우선**: position 필드 + 컨텍스트 청크 + embeddedContent 분리

### 현재 시스템 대비 주요 차이점

| 영역            | SuperMemory               | 현재 시스템 | Gap         |
| --------------- | ------------------------- | ----------- | ----------- |
| 비동기 처리     | 상태 추적 시스템          | ❌ 없음     | 🔴 Critical |
| 임베딩 버전     | 다중 버전 저장            | 단일 버전   | 🟡 Medium   |
| 검색 임계값     | 2단계 (chunk + document)  | 1단계       | 🟡 Medium   |
| 컨텍스트 청크   | position ± 1 반환         | ❌ 없음     | 🟢 Low      |
| 전처리 분리     | embeddedContent ≠ content | ❌ 없음     | 🟢 Low      |
| 메타데이터 필터 | AND/OR 연산 지원          | ❌ 없음     | 🟡 Medium   |
| 처리 이력       | processingMetadata        | ❌ 없음     | 🔴 Critical |

---

## 2. Ingestion 비교

### 2.1 비동기 처리 + 상태 추적

**SuperMemory 방식:**

```
POST /v3/documents → 즉시 ID 반환
  ↓
백그라운드 워커가 처리
  ↓
GET /v3/documents/:id → 5초마다 폴링
  ↓
상태: queued → extracting → chunking → embedding → indexing → done
```

**현재 시스템:**

- `packages/ingestion/src/index.ts`가 거의 비어있음 (synthetic-loader만 export)
- 동기 처리로 추정
- 상태 추적 시스템 없음

**문제점:**

- 대용량 문서 처리 시 타임아웃
- 실패 지점 파악 어려움
- 재시도 메커니즘 없음

**개선 방안:**

1. DB 스키마 추가:

```sql
CREATE TABLE document_status (
  id VARCHAR(255) PRIMARY KEY REFERENCES canonical_objects(id),
  status VARCHAR(20) NOT NULL,  -- queued|extracting|chunking|embedding|indexing|done|failed
  current_step VARCHAR(50),
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

2. Bull/BullMQ 큐 시스템 도입:

```typescript
// packages/ingestion/src/queue.ts
import Queue from 'bull';

export const documentQueue = new Queue('document-processing', {
  redis: { host: 'localhost', port: 6379 },
});

documentQueue.process(async (job) => {
  const { documentId } = job.data;

  // 1. Extract
  await updateStatus(documentId, 'extracting');
  const extracted = await extractContent(documentId);

  // 2. Chunk
  await updateStatus(documentId, 'chunking');
  const chunks = await chunkDocument(extracted);

  // 3. Embed
  await updateStatus(documentId, 'embedding');
  await embedChunks(chunks);

  // 4. Index
  await updateStatus(documentId, 'indexing');
  await indexChunks(chunks);

  await updateStatus(documentId, 'done');
});
```

3. API 엔드포인트:

```typescript
// POST /api/documents
// → 즉시 ID 반환, 백그라운드 큐에 추가

// GET /api/documents/:id/status
// → 현재 처리 상태 반환
```

### 2.2 processingMetadata 부재

**SuperMemory 방식:**

```json
{
  "chunkingStrategy": "semantic",
  "tokenCount": 15420,
  "steps": [
    {
      "name": "chunking",
      "timestamp": "2025-11-25T10:00:00Z",
      "metadata": {
        "chunksCreated": 42,
        "averageChunkSize": 367
      }
    },
    {
      "name": "embedding",
      "timestamp": "2025-11-25T10:01:30Z",
      "metadata": {
        "model": "text-embedding-3-small",
        "totalTokens": 15420,
        "cost": 0.0003
      }
    }
  ]
}
```

**현재 시스템:**

- `canonical_objects` 테이블에 이런 메타데이터 없음

**개선 방안:**

DB 스키마 수정:

```sql
ALTER TABLE canonical_objects
ADD COLUMN processing_metadata JSONB;

COMMENT ON COLUMN canonical_objects.processing_metadata IS '처리 이력 및 메타데이터 (디버깅, 성능 분석용)';
```

활용 예시:

```typescript
// 각 처리 단계마다 메타데이터 추가
async function appendProcessingMetadata(objectId: string, step: string, metadata: any) {
  await db.query(
    `
    UPDATE canonical_objects
    SET processing_metadata = COALESCE(processing_metadata, '{"steps": []}'::jsonb)
      || jsonb_build_object(
        'steps', processing_metadata->'steps' || jsonb_build_array(
          jsonb_build_object(
            'name', $2,
            'timestamp', NOW(),
            'metadata', $3::jsonb
          )
        )
      )
    WHERE id = $1
  `,
    [objectId, step, JSON.stringify(metadata)]
  );
}
```

---

## 3. Indexing 비교

### 3.1 다중 버전 임베딩 미지원

**SuperMemory 방식:**

```typescript
// 문서 레벨
summaryEmbedding; // 현재 버전
summaryEmbeddingNew; // 새 모델 버전

// 청크 레벨
embedding; // 현재 버전
embeddingNew; // 새 모델 버전
matryokshaEmbedding; // 대안 모델
```

**이유:**

- 무중단 모델 업그레이드
- A/B 테스트
- 점진적 마이그레이션

**현재 시스템:**

```sql
-- chunks 테이블
embedding vector(1536)  -- 단일 버전만
```

**개선 방안:**

DB 스키마 수정:

```sql
-- 청크 레벨
ALTER TABLE chunks
ADD COLUMN embedding_v2 vector(1536),
ADD COLUMN embedding_alternative vector(1536),
ADD COLUMN active_embedding_version VARCHAR(20) DEFAULT 'v1';

-- 문서 레벨
ALTER TABLE canonical_objects
ADD COLUMN summary_embedding vector(1536),
ADD COLUMN summary_embedding_v2 vector(1536);

-- 인덱스 추가
CREATE INDEX idx_chunks_embedding_v2
ON chunks USING hnsw (embedding_v2 vector_cosine_ops);

CREATE INDEX idx_canonical_summary_embedding
ON canonical_objects USING hnsw (summary_embedding vector_cosine_ops);
```

사용 예시:

```typescript
// 점진적 마이그레이션
async function migrateToNewEmbeddingModel() {
  const chunks = await db.query(`
    SELECT id, content
    FROM chunks
    WHERE embedding_v2 IS NULL
    LIMIT 100
  `);

  for (const chunk of chunks.rows) {
    const newEmbedding = await newEmbedder.embed(chunk.content);
    await db.query(
      `
      UPDATE chunks
      SET embedding_v2 = $1
      WHERE id = $2
    `,
      [newEmbedding, chunk.id]
    );
  }
}

// A/B 테스트
async function searchWithVersion(query: string, version: 'v1' | 'v2') {
  const embeddingColumn = version === 'v1' ? 'embedding' : 'embedding_v2';
  // ...
}
```

### 3.2 2단계 임계값 전략 없음

**SuperMemory 방식:**

```typescript
chunkThreshold: 0.6; // 청크 필터링 (유사도 >= 0.6)
documentThreshold: 0.3; // 문서 필터링 (평균 유사도 >= 0.3)

// 동작:
// 1. 청크 검색 → 73개 발견
// 2. 문서 그룹화 → 15개 문서
// 3. 문서 평균 유사도 >= 0.3 → 8개 문서
```

**효과:**

- 노이즈 제거
- 정확도/재현율 균형
- 일부 청크만 매칭되는 문서 필터링

**현재 시스템:**

```typescript
// packages/query/src/retriever.ts:57
similarityThreshold: 0.35; // 단일 임계값
```

**개선 방안:**

Retriever 수정:

```typescript
// packages/query/src/retriever.ts
export interface RetrieverConfig {
  chunkThreshold?: number;      // 청크 레벨 임계값
  documentThreshold?: number;   // 문서 레벨 임계값
  chunkLimit?: number;
  includeRelations?: boolean;
  relationDepth?: number;
}

export class Retriever {
  private config: Required<RetrieverConfig>;

  constructor(/* ... */, config: RetrieverConfig = {}) {
    this.config = {
      chunkThreshold: config.chunkThreshold ?? 0.6,
      documentThreshold: config.documentThreshold ?? 0.3,
      // ...
    };
  }

  async retrieve(query: string): Promise<RetrievalResult> {
    // 1. 청크 검색 (chunkThreshold)
    const chunks = await this.searchChunks(query, this.config.chunkThreshold);

    // 2. 문서별 그룹화 및 평균 유사도 계산
    const documentScores = new Map<string, number[]>();
    for (const chunk of chunks) {
      const scores = documentScores.get(chunk.canonical_object_id) || [];
      scores.push(chunk.similarity);
      documentScores.set(chunk.canonical_object_id, scores);
    }

    // 3. 문서 레벨 필터링 (documentThreshold)
    const qualifiedDocIds = Array.from(documentScores.entries())
      .filter(([_, scores]) => {
        const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
        return avgScore >= this.config.documentThreshold;
      })
      .map(([docId, _]) => docId);

    // 4. 필터링된 문서의 청크만 반환
    const filteredChunks = chunks.filter(c =>
      qualifiedDocIds.includes(c.canonical_object_id)
    );

    // ...
  }
}
```

### 3.3 메타데이터 필터링 부재

**SuperMemory 방식:**

```typescript
filters: {
  AND: [
    { key: 'category', value: 'tech' },
    { key: 'timestamp', numericOperator: '>', value: '1742745777' },
  ];
}

// 벡터 검색 + 구조화 필터 = 하이브리드 검색
```

**현재 시스템:**

- `search_chunks_by_embedding` 함수에 메타데이터 필터 없음

**개선 방안:**

SQL 함수 수정:

```sql
-- db/migrations/009_add_metadata_filtering.sql
CREATE OR REPLACE FUNCTION search_chunks_by_embedding(
  query_embedding vector(1536),
  similarity_threshold float DEFAULT 0.7,
  result_limit int DEFAULT 10,
  filter_method varchar DEFAULT NULL,
  metadata_filter jsonb DEFAULT NULL  -- 👈 추가
)
RETURNS TABLE (
  id VARCHAR(500),
  canonical_object_id VARCHAR(255),
  content TEXT,
  method VARCHAR(50),
  metadata JSONB,
  similarity float
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id,
    c.canonical_object_id,
    c.content,
    c.method,
    c.metadata,
    1 - (c.embedding <=> query_embedding) AS similarity
  FROM chunks c
  WHERE
    c.embedding IS NOT NULL
    AND (filter_method IS NULL OR c.method = filter_method)
    AND (1 - (c.embedding <=> query_embedding)) >= similarity_threshold
    -- 메타데이터 필터 추가
    AND (
      metadata_filter IS NULL
      OR (
        -- AND 조건 처리
        metadata_filter ? 'AND' AND c.metadata @> ALL(
          SELECT jsonb_array_elements(metadata_filter->'AND')
        )
      )
      OR (
        -- OR 조건 처리
        metadata_filter ? 'OR' AND c.metadata @> ANY(
          SELECT jsonb_array_elements(metadata_filter->'OR')
        )
      )
    )
  ORDER BY c.embedding <=> query_embedding
  LIMIT result_limit;
END;
$$ LANGUAGE plpgsql;
```

사용 예시:

```typescript
// 특정 플랫폼의 최근 데이터만 검색
const results = await retriever.retrieve(query, {
  metadataFilter: {
    AND: [{ platform: 'github' }, { created_at: { $gte: '2025-01-01' } }],
  },
});
```

### 3.4 문서 레벨 임베딩 없음

**SuperMemory 방식:**

- `summaryEmbedding`: 문서 전체 요약을 임베딩
- 빠른 문서 레벨 검색
- 청크 검색과 병행 사용

**개선 방안:**

이미 위 3.1에서 제안함:

```sql
ALTER TABLE canonical_objects
ADD COLUMN summary_embedding vector(1536);
```

활용:

```typescript
// 1단계: 문서 레벨로 빠르게 필터링
const relevantDocs = await searchDocumentsBySummary(query, threshold: 0.5);

// 2단계: 해당 문서들의 청크만 검색
const chunks = await searchChunksInDocuments(query, relevantDocs);
```

---

## 4. Chunking 비교

### 4.1 컨텍스트 청크 미지원

**SuperMemory 방식:**

```typescript
onlyMatchingChunks: false

// 반환:
[
  { position: 5, content: "...", isRelevant: false },  // 이전
  { position: 6, content: "...", isRelevant: true  },  // 매칭
  { position: 7, content: "...", isRelevant: false },  // 다음
]
```

**효과:**

- LLM이 더 많은 문맥 확보
- 문장 중간 청크도 이해 가능

**현재 시스템:**

- Retriever가 매칭된 청크만 반환

**개선 방안:**

Retriever 수정:

```typescript
// packages/query/src/retriever.ts
export interface RetrieverConfig {
  // ...
  includeContext?: boolean;  // 👈 추가
  contextWindow?: number;    // 기본값: 1 (전후 1개씩)
}

async retrieve(query: string): Promise<RetrievalResult> {
  // 기존 청크 검색
  const chunks = await this.searchChunks(query);

  // 컨텍스트 청크 추가
  if (this.config.includeContext) {
    const contextChunks = await this.fetchContextChunks(
      chunks,
      this.config.contextWindow
    );

    // 매칭 청크와 컨텍스트 청크 합치기
    const allChunks = this.mergeWithContext(chunks, contextChunks);
    return { ...result, chunks: allChunks };
  }

  return result;
}

private async fetchContextChunks(
  matchedChunks: ChunkResult[],
  window: number
): Promise<ChunkResult[]> {
  const contextChunks: ChunkResult[] = [];

  for (const chunk of matchedChunks) {
    // chunk_index ± window 범위의 청크 가져오기
    const neighbors = await this.db.query(`
      SELECT id, canonical_object_id, content, chunk_index, metadata
      FROM chunks
      WHERE canonical_object_id = $1
        AND chunk_index BETWEEN $2 AND $3
        AND id != $4
      ORDER BY chunk_index
    `, [
      chunk.canonical_object_id,
      chunk.metadata.chunk_index - window,
      chunk.metadata.chunk_index + window,
      chunk.id
    ]);

    contextChunks.push(...neighbors.rows.map(row => ({
      ...row,
      similarity: 0,  // 컨텍스트 청크는 유사도 없음
      isRelevant: false
    })));
  }

  return contextChunks;
}

private mergeWithContext(
  matched: ChunkResult[],
  context: ChunkResult[]
): ChunkResult[] {
  // 매칭 청크에 isRelevant: true 마킹
  const markedMatched = matched.map(c => ({ ...c, isRelevant: true }));

  // chunk_index 순서로 정렬
  return [...markedMatched, ...context].sort((a, b) => {
    if (a.canonical_object_id !== b.canonical_object_id) {
      return a.canonical_object_id.localeCompare(b.canonical_object_id);
    }
    return (a.metadata?.chunk_index || 0) - (b.metadata?.chunk_index || 0);
  });
}
```

### 4.2 embeddedContent 분리 없음

**SuperMemory 방식:**

```typescript
{
  content: "Machine Learning is amazing!",      // 원본 (유저에게 표시)
  embeddedContent: "machine learn amaz"          // 전처리 (임베딩용)
}

// 전처리: 소문자, 스테밍, 불용어 제거, 특수문자 제거
```

**효과:**

- 임베딩 품질 향상
- 의미만 추출
- 원본은 content에 보존

**현재 시스템:**

- `chunks` 테이블에 `content` 하나만

**개선 방안:**

DB 스키마:

```sql
ALTER TABLE chunks
ADD COLUMN embedded_content TEXT;

COMMENT ON COLUMN chunks.embedded_content IS '전처리된 텍스트 (임베딩 생성용)';
```

Chunker 수정:

```typescript
// packages/embedding/src/chunker.ts

// 불용어 리스트
const STOP_WORDS = new Set([
  'the',
  'a',
  'an',
  'and',
  'or',
  'but',
  'is',
  'are',
  'was',
  'were',
  'in',
  'on',
  'at',
  'to',
  'for',
  'of',
  'with',
  'by',
  'from',
  'as',
  // ... 더 많은 불용어
]);

export class Chunker {
  /**
   * 임베딩을 위한 텍스트 전처리
   */
  private processForEmbedding(text: string): string {
    return text
      .toLowerCase() // 소문자 변환
      .replace(/[^\w\s]/g, ' ') // 특수문자 제거
      .split(/\s+/) // 단어 분리
      .filter((word) => word.length > 0) // 빈 문자열 제거
      .filter((word) => !STOP_WORDS.has(word)) // 불용어 제거
      .map((word) => this.stem(word)) // 스테밍
      .join(' ');
  }

  /**
   * 간단한 영어 스테밍 (Porter Stemmer 간소화 버전)
   */
  private stem(word: string): string {
    // 간단한 규칙 기반 스테밍
    return word.replace(/ing$/, '').replace(/ed$/, '').replace(/s$/, '').replace(/ly$/, '');
  }

  /**
   * 청크 생성 시 embedded_content도 함께 생성
   */
  chunk(obj: CanonicalObject): Chunk[] {
    const chunks: Chunk[] = [];
    // ... 기존 청킹 로직 ...

    // 각 청크에 embedded_content 추가
    for (const chunk of chunks) {
      chunk.embedded_content = this.processForEmbedding(chunk.content);
    }

    return chunks;
  }
}
```

Embedder 수정:

```typescript
// packages/embedding/src/openai-embedder.ts

// 임베딩 생성 시 embedded_content 사용
async embedChunk(chunk: Chunk): Promise<void> {
  const textToEmbed = chunk.embedded_content || chunk.content;
  const embedding = await this.embed(textToEmbed);

  await db.query(`
    UPDATE chunks
    SET embedding = $1,
        embedded_content = $2
    WHERE id = $3
  `, [embedding, chunk.embedded_content, chunk.id]);
}
```

### 4.3 청크 품질 관리 지표 부족

**SuperMemory 방식:**

- 너무 많은 청크 (>100) → 전략 재검토
- 너무 큰 청크 (>1000 토큰) → 검색 품질 저하
- 너무 작은 청크 (<100 토큰) → 문맥 손실

**현재 시스템:**

- `getStats` 함수는 있지만 품질 검증 없음

**개선 방안:**

Chunker에 검증 함수 추가:

```typescript
// packages/embedding/src/chunker.ts

export interface ChunkQualityReport {
  isValid: boolean;
  warnings: string[];
  stats: {
    total_chunks: number;
    avg_chunk_size: number;
    min_chunk_size: number;
    max_chunk_size: number;
  };
}

export class Chunker {
  /**
   * 청크 품질 검증
   */
  validateChunkQuality(chunks: Chunk[]): ChunkQualityReport {
    const warnings: string[] = [];
    const stats = this.getStats(chunks);

    // 청크 수 체크
    if (chunks.length > 100) {
      warnings.push(
        `청크가 너무 많음 (${chunks.length}개). ` + `maxChunkSize를 늘리거나 다른 전략 고려 필요.`
      );
    }

    if (chunks.length < 3 && chunks.length > 0) {
      warnings.push(
        `청크가 너무 적음 (${chunks.length}개). ` + `maxChunkSize를 줄이거나 overlap 증가 고려.`
      );
    }

    // 청크 크기 체크
    if (stats.max_chunk_size > 1000) {
      warnings.push(
        `최대 청크 크기가 너무 큼 (${stats.max_chunk_size} chars). ` +
          `검색 품질이 저하될 수 있음. maxChunkSize 감소 권장.`
      );
    }

    if (stats.min_chunk_size < 100 && chunks.length > 1) {
      warnings.push(
        `최소 청크 크기가 너무 작음 (${stats.min_chunk_size} chars). ` +
          `문맥 손실 가능. overlap 증가 또는 청킹 전략 변경 고려.`
      );
    }

    // 청크 크기 편차 체크
    if (stats.std_chunk_size > stats.avg_chunk_size * 0.5) {
      warnings.push(
        `청크 크기 편차가 큼 (std: ${stats.std_chunk_size}). ` +
          `일관성 없는 청킹. semantic 전략 고려.`
      );
    }

    return {
      isValid: warnings.length === 0,
      warnings,
      stats,
    };
  }

  /**
   * 청크 생성 + 품질 검증
   */
  chunkWithValidation(obj: CanonicalObject): {
    chunks: Chunk[];
    quality: ChunkQualityReport;
  } {
    const chunks = this.chunk(obj);
    const quality = this.validateChunkQuality(chunks);

    // 경고가 있으면 로깅
    if (!quality.isValid) {
      console.warn(`청크 품질 경고 (${obj.id}):`, quality.warnings.join('\n'));
    }

    return { chunks, quality };
  }
}
```

processingMetadata에 기록:

```typescript
const { chunks, quality } = chunker.chunkWithValidation(obj);

await appendProcessingMetadata(obj.id, 'chunking', {
  strategy: chunker.config.strategy,
  chunksCreated: chunks.length,
  averageChunkSize: quality.stats.avg_chunk_size,
  warnings: quality.warnings,
  isValid: quality.isValid,
});
```

---

## 5. 시스템 설계 철학

### SuperMemory의 핵심 원칙

1. **Fail-Safe 설계**
   - 모든 처리 단계를 상태로 추적
   - 실패 지점에서 재시도 가능
   - processingMetadata로 디버깅 용이

2. **점진적 업그레이드**
   - 다중 버전 임베딩으로 무중단 마이그레이션
   - 새 전략과 기존 전략 병행 운영
   - 성능 비교 후 전환

3. **유연한 확장성**
   - JSONB로 메타데이터 자유롭게 추가
   - 새로운 플랫폼 추가 용이
   - 플랫폼별 특수 속성 수용

4. **품질 우선**
   - 2단계 임계값으로 노이즈 제거
   - 청크 품질 검증
   - 컨텍스트 보존

5. **실용성**
   - PostgreSQL + pgvector (새 DB 불필요)
   - 표준 웹 기술 스택
   - 프로덕션 검증된 패턴

---

## 6. 개선 우선순위

### 🔴 Critical (즉시 적용)

**1. embeddedContent 분리**

- **Impact**: 임베딩 품질 직접 개선
- **Effort**: Low (DB 컬럼 추가 + 전처리 함수)
- **구현 시간**: 1일
- **참고**: [Section 4.2](#42-embeddedcontent-분리-없음)

**2. processingMetadata 추가**

- **Impact**: 디버깅 및 모니터링 크게 개선
- **Effort**: Low (DB 컬럼 추가 + 헬퍼 함수)
- **구현 시간**: 1일
- **참고**: [Section 2.2](#22-processingmetadata-부재)

### 🟡 High (1-2주 내)

**3. 2단계 임계값**

- **Impact**: 검색 정확도 향상
- **Effort**: Medium (Retriever 로직 수정)
- **구현 시간**: 2일
- **참고**: [Section 3.2](#32-2단계-임계값-전략-없음)

**4. 컨텍스트 청크 지원**

- **Impact**: LLM 응답 품질 개선
- **Effort**: Medium (Retriever 수정)
- **구현 시간**: 2일
- **참고**: [Section 4.1](#41-컨텍스트-청크-미지원)

**5. 청크 품질 검증**

- **Impact**: 전략 최적화 가능
- **Effort**: Low (검증 함수 추가)
- **구현 시간**: 1일
- **참고**: [Section 4.3](#43-청크-품질-관리-지표-부족)

**6. 비동기 처리 + 상태 추적**

- **Impact**: 확장성 및 UX 크게 개선
- **Effort**: High (큐 시스템 + DB 스키마 + API)
- **구현 시간**: 5일
- **참고**: [Section 2.1](#21-비동기-처리--상태-추적)

### 🟢 Medium (1개월 내)

**7. 다중 버전 임베딩**

- **Impact**: 무중단 모델 업그레이드
- **Effort**: Medium (DB 스키마 + 마이그레이션 로직)
- **구현 시간**: 3일
- **참고**: [Section 3.1](#31-다중-버전-임베딩-미지원)

**8. 문서 레벨 임베딩**

- **Impact**: 검색 속도 향상
- **Effort**: Medium (DB 스키마 + 검색 로직)
- **구현 시간**: 3일
- **참고**: [Section 3.4](#34-문서-레벨-임베딩-없음)

**9. 메타데이터 필터링**

- **Impact**: 검색 정확도 향상
- **Effort**: Medium (SQL 함수 수정)
- **구현 시간**: 2일
- **참고**: [Section 3.3](#33-메타데이터-필터링-부재)

---

## 7. 구현 체크리스트

### Phase 1: Quick Wins (1주)

- [ ] **embeddedContent 분리**
  - [ ] DB 마이그레이션: `ALTER TABLE chunks ADD COLUMN embedded_content TEXT`
  - [ ] Chunker에 전처리 함수 추가
  - [ ] 기존 청크 재처리 스크립트
  - [ ] 관련 PR: _TBD_

- [ ] **processingMetadata 추가**
  - [ ] DB 마이그레이션: `ALTER TABLE canonical_objects ADD COLUMN processing_metadata JSONB`
  - [ ] 헬퍼 함수 구현
  - [ ] 각 처리 단계에 메타데이터 로깅 추가
  - [ ] 관련 PR: _TBD_

- [ ] **청크 품질 검증**
  - [ ] `validateChunkQuality` 함수 구현
  - [ ] 경고 로깅 추가
  - [ ] 품질 리포트를 processingMetadata에 저장
  - [ ] 관련 PR: _TBD_

### Phase 2: Search Improvements (1-2주)

- [ ] **2단계 임계값**
  - [ ] RetrieverConfig에 `documentThreshold` 추가
  - [ ] 문서 그룹화 및 평균 유사도 로직 구현
  - [ ] 테스트 작성
  - [ ] 관련 PR: _TBD_

- [ ] **컨텍스트 청크**
  - [ ] RetrieverConfig에 `includeContext` 추가
  - [ ] `fetchContextChunks` 함수 구현
  - [ ] `mergeWithContext` 함수 구현
  - [ ] 테스트 작성
  - [ ] 관련 PR: _TBD_

### Phase 3: Infrastructure (2-3주)

- [ ] **비동기 처리 시스템**
  - [ ] Bull/BullMQ 설치 및 설정
  - [ ] `document_status` 테이블 생성
  - [ ] 큐 프로세서 구현
  - [ ] API 엔드포인트 추가 (POST /documents, GET /documents/:id/status)
  - [ ] 프론트엔드 폴링 로직
  - [ ] 관련 PR: _TBD_

### Phase 4: Advanced Features (1개월)

- [ ] **다중 버전 임베딩**
  - [ ] DB 스키마 수정 (embedding_v2, embedding_alternative)
  - [ ] 점진적 마이그레이션 스크립트
  - [ ] A/B 테스트 로직
  - [ ] 관련 PR: _TBD_

- [ ] **문서 레벨 임베딩**
  - [ ] `summary_embedding` 컬럼 추가
  - [ ] 요약 생성 로직 (LLM 또는 첫 N개 청크)
  - [ ] 2단계 검색 로직 (문서 → 청크)
  - [ ] 관련 PR: _TBD_

- [ ] **메타데이터 필터링**
  - [ ] SQL 함수에 `metadata_filter` 파라미터 추가
  - [ ] AND/OR 조건 처리 로직
  - [ ] Retriever API 업데이트
  - [ ] 관련 PR: _TBD_

---

## 8. 참고자료

### SuperMemory 소스 분석

- **Ingestion**
  - 비동기 처리 패턴
  - Optimistic UI
  - 플랫폼별 메타데이터 저장

- **Indexing**
  - 다중 버전 임베딩 전략
  - 2단계 임계값 (chunk + document)
  - PostgreSQL pgvector 활용
  - 메타데이터 필터링 (AND/OR)

- **Chunking**
  - 상태 추적 (queued → done)
  - processingMetadata 기록
  - position 필드로 순서 보존
  - 컨텍스트 청크 제공
  - embeddedContent 전처리
  - 청크 품질 통계

### 관련 문서

- [01-ingestion-patterns.md](./01-ingestion-patterns.md) - Linear/Zendesk 데이터 수집
- [02-indexing-strategies.md](./02-indexing-strategies.md) - Canonical data model
- [03-chunking-research.md](./03-chunking-research.md) - 청킹 전략 비교
- [04-embedding-models.md](./04-embedding-models.md) - 임베딩 모델 평가

### 구현 참고

- PostgreSQL pgvector: https://github.com/pgvector/pgvector
- Bull Queue: https://github.com/OptimalBits/bull
- Porter Stemmer: https://tartarus.org/martin/PorterStemmer/

---

## 변경 이력

- **2025-11-25**: 초안 작성 (RND Team)
- **구현 완료 시 업데이트 예정**
  - 각 체크리스트 항목 완료 시 PR 링크 추가
  - 구현 과정에서 발견한 추가 개선사항 기록
