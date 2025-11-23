# Ingestion Patterns Research

**Date**: 2025-11-23
**Author**: RND Week 1
**Purpose**: 데이터 수집 및 통합 패턴 이해 및 Momo 프로젝트 적용 방안 도출

---

## Table of Contents

1. [Linear API 분석](#1-linear-api-분석)
2. [Zendesk API 분석](#2-zendesk-api-분석)
3. [Modern ETL/ELT Patterns](#3-modern-etlelt-patterns)
4. [Change Data Capture (CDC) Patterns](#4-change-data-capture-cdc-patterns)
5. [Momo 프로젝트 적용 방안](#5-momo-프로젝트-적용-방안)
6. [의사결정 및 근거](#6-의사결정-및-근거)

---

## 1. Linear API 분석

### 1.1 API 구조

- **Type**: GraphQL API (Relay-style cursor pagination)
- **Internal Use**: Linear가 자체 앱에서 사용하는 동일한 API
- **SDK**: TypeScript SDK 제공 (@linear/sdk)
- **Schema**: Apollo Studio에서 공개적으로 탐색 가능
  - URL: https://studio.apollographql.com/public/Linear-API/schema/reference
  - GitHub: https://github.com/linear/linear/blob/master/packages/sdk/src/schema.graphql

### 1.2 인증 방식

- **OAuth 2.0**: Third-party 앱용 표준 OAuth 플로우
- **Personal API Keys**: 자동화 통합용 직접 인증
- **File Storage**: 별도 인증 메커니즘 (파일 업로드용)

**권장**: 초기 데이터 수집은 Personal API Key 사용, 프로덕션은 OAuth 고려

### 1.3 핵심 데이터 모델

#### Issue Type (핵심 엔티티)

```graphql
type Issue implements Node {
  id: ID!
  createdAt: DateTime!
  updatedAt: DateTime!
  archivedAt: DateTime

  # Content
  title: String!
  description: String

  # Metadata
  priority: Int
  estimate: Float

  # Relations
  assignee: User
  creator: User!
  team: Team!
  project: Project
  cycle: Cycle
  parent: Issue

  # Collections (paginated)
  comments(first: Int, after: String): CommentConnection!
  children(first: Int, after: String): IssueConnection! # sub-issues
  labels(first: Int): IssueLabelConnection!
  attachments(first: Int): AttachmentConnection!

  # State
  state: WorkflowState!

  # Relations
  relations(first: Int): IssueRelationConnection!
}
```

#### Comment Type

```graphql
type Comment implements Node {
  id: ID!
  createdAt: DateTime!
  updatedAt: DateTime!
  editedAt: DateTime
  archivedAt: DateTime

  # Content
  body: String! # Plain text
  bodyData: String! # ProseMirror format (structured)
  # Authors
  user: User # Regular user
  botActor: ActorBot # Bot author
  externalUser: ExternalUser # External system user
  # Relations
  issue: Issue!
  parent: Comment # Thread support
  children(first: Int): CommentConnection!

  # Additional
  reactions: [Reaction!]!
  resolvedAt: DateTime
  resolvingUser: User
}
```

#### Project Type

```graphql
type Project implements Node {
  id: ID!
  createdAt: DateTime!
  updatedAt: DateTime!

  # Content
  name: String!
  description: String

  # Metadata
  state: String! # planned, started, completed, canceled
  priority: Int

  # Relations
  lead: User
  teams(first: Int): TeamConnection!
  issues(first: Int): IssueConnection!

  # Dates
  startDate: TimelessDate
  targetDate: TimelessDate
  completedAt: DateTime
}
```

#### Attachment Type

```graphql
type Attachment implements Node {
  id: ID!
  createdAt: DateTime!
  updatedAt: DateTime!

  title: String!
  url: String! # Unique identifier
  subtitle: String

  # Relations
  issue: Issue!
  creator: User
  externalUserCreator: ExternalUser

  # Metadata
  metadata: JSONObject! # File metadata
  source: JSONObject # Integration source
  sourceType: String # "github", "figma", etc.
}
```

### 1.4 관계 구조 (Relations)

Linear의 강력한 관계 시스템:

```typescript
// Issue Relations
{
  "parent-child": "Issue.parent -> Issue",
  "blocking": "IssueRelation with type BLOCKS",
  "related": "IssueRelation with type RELATED",
  "duplicate": "IssueRelation with type DUPLICATE",
  "issue-project": "Issue.project -> Project",
  "issue-cycle": "Issue.cycle -> Cycle",
  "comment-thread": "Comment.parent -> Comment"
}
```

**중요**: Relations는 양방향으로 탐색 가능 (blocked by, blocks 등)

### 1.5 Pagination (Relay Cursor-Based)

```typescript
// TypeScript SDK 사용 예시
import { LinearClient } from '@linear/sdk';

const client = new LinearClient({ apiKey: process.env.LINEAR_API_KEY });

// First page
const issues = await client.issues({
  first: 50,
  orderBy: 'updatedAt', // 최신 업데이트 순
});

// Check pagination
console.log(issues.pageInfo.hasNextPage);
console.log(issues.pageInfo.endCursor);

// Next page
const nextIssues = await client.issues({
  first: 50,
  after: issues.pageInfo.endCursor,
});

// OR use helper method
const moreIssues = await issues.fetchNext();
```

**PageInfo Structure**:

```typescript
{
  hasNextPage: boolean,
  hasPreviousPage: boolean,
  startCursor: string,
  endCursor: string
}
```

### 1.6 Rate Limiting

- **Status**: 진화 중 (evolving)
- **Policy**: GraphQL 호출에 rate limit 적용
- **Documentation**: 별도 페이지에서 상세 정보 제공 (정확한 limit 미공개)

**권장**:

- Exponential backoff 구현
- Rate limit 헤더 모니터링
- Batch 요청 시 적절한 delay 추가

### 1.7 Incremental Sync 전략

**핵심**: `updatedAt` 필드 활용

```typescript
// 마지막 sync 이후 업데이트된 이슈만 가져오기
const lastSyncTime = '2025-11-22T00:00:00Z';

const updatedIssues = await client.issues({
  filter: {
    updatedAt: {
      gte: lastSyncTime, // greater than or equal
    },
  },
  first: 100,
});
```

**Best Practice**:

1. 첫 sync: 전체 데이터 수집
2. 이후 sync: `updatedAt` 필터로 delta만 수집
3. `updatedAt` 타임스탬프 저장 (다음 sync 기준)

### 1.8 샘플 응답 구조

```json
{
  "issue": {
    "id": "LIN-123",
    "identifier": "ENG-456",
    "title": "Implement user authentication",
    "description": "Add JWT-based authentication...",
    "priority": 1,
    "estimate": 5,
    "createdAt": "2025-11-01T10:00:00Z",
    "updatedAt": "2025-11-20T15:30:00Z",
    "state": {
      "id": "state-123",
      "name": "In Progress",
      "type": "started"
    },
    "assignee": {
      "id": "user-123",
      "displayName": "John Doe",
      "email": "john@example.com"
    },
    "labels": {
      "nodes": [
        { "id": "label-1", "name": "backend" },
        { "id": "label-2", "name": "security" }
      ]
    },
    "comments": {
      "nodes": [
        {
          "id": "comment-1",
          "body": "Starting work on this...",
          "createdAt": "2025-11-20T15:30:00Z",
          "user": { "displayName": "John Doe" }
        }
      ],
      "pageInfo": {
        "hasNextPage": false
      }
    }
  }
}
```

---

## 2. Zendesk API 분석

### 2.1 API 구조

- **Type**: REST API (JSON)
- **Version**: v2 (stable)
- **Base URL**: `https://{subdomain}.zendesk.com/api/v2/`
- **OpenAPI Spec**: 다운로드 가능 (코드 생성 지원)

### 2.2 인증 방식

- **API Token Authentication**: `{email}/token:{api_token}` (Basic Auth)
- **OAuth 2.0**: Client credentials + grant type flows
- **권장**: API Token (간단), OAuth (multi-tenant)

### 2.3 핵심 데이터 모델

#### Ticket Structure

```json
{
  "ticket": {
    "id": 12345,
    "created_at": "2025-11-01T10:00:00Z",
    "updated_at": "2025-11-20T15:30:00Z",

    // Content
    "subject": "Unable to login",
    "description": "I'm getting an error when...",
    "type": "incident",
    "priority": "high",
    "status": "open",

    // Actors
    "requester_id": 67890,
    "assignee_id": 11111,
    "submitter_id": 67890,
    "organization_id": 22222,

    // Collections
    "tags": ["login", "bug", "urgent"],
    "custom_fields": [{ "id": 360001, "value": "production" }],

    // Relations
    "via": {
      "channel": "email",
      "source": { "from": { "address": "user@example.com" } }
    },

    // Metrics
    "satisfaction_rating": { "score": "good" },
    "metric_set": {
      /* SLA metrics */
    }
  }
}
```

#### Comment (Ticket Comment) Structure

```json
{
  "comment": {
    "id": 98765,
    "type": "Comment",
    "body": "I've looked into this issue...",
    "html_body": "<p>I've looked into this issue...</p>",
    "plain_body": "I've looked into this issue...",
    "public": true,

    "author_id": 11111,
    "created_at": "2025-11-20T15:30:00Z",

    "attachments": [
      {
        "id": 55555,
        "file_name": "screenshot.png",
        "content_url": "https://...",
        "content_type": "image/png",
        "size": 123456
      }
    ],

    "via": {
      "channel": "web"
    }
  }
}
```

#### User Structure

```json
{
  "user": {
    "id": 67890,
    "name": "Jane Smith",
    "email": "jane@example.com",
    "role": "end-user",
    "organization_id": 22222,
    "created_at": "2025-01-15T08:00:00Z",
    "updated_at": "2025-11-20T10:00:00Z",

    "user_fields": {
      "account_type": "premium"
    }
  }
}
```

### 2.4 관계 구조

```typescript
{
  "ticket-requester": "Ticket.requester_id -> User.id",
  "ticket-assignee": "Ticket.assignee_id -> User.id",
  "ticket-organization": "Ticket.organization_id -> Organization.id",
  "ticket-comments": "GET /api/v2/tickets/{id}/comments.json",
  "comment-attachments": "Comment.attachments[]",
  "ticket-thread": "Comments ordered by created_at (conversation flow)"
}
```

**Thread Model**:

- Ticket = Main thread
- Comments = Replies in chronological order
- `public` field = 고객에게 보이는지 여부 (internal notes vs public replies)

### 2.5 Pagination

**Cursor-Based Pagination**:

```bash
# First page
GET /api/v2/tickets.json?page[size]=100

# Response includes
{
  "tickets": [...],
  "meta": {
    "has_more": true,
    "after_cursor": "eyJvIjoibmljZSB0cnkiLCJpZCI6MX0=",
    "before_cursor": null
  },
  "links": {
    "next": "https://.../tickets.json?page[size]=100&page[after]=eyJv...",
    "prev": null
  }
}

# Next page
GET /api/v2/tickets.json?page[size]=100&page[after]=eyJv...
```

### 2.6 Rate Limiting

- **Standard**: 700 requests/minute (계정별)
- **Headers**:
  - `X-Rate-Limit`: Total allowed
  - `X-Rate-Limit-Remaining`: Remaining requests
  - `Retry-After`: Seconds to wait (429 응답 시)

**전략**:

- 헤더 모니터링
- 429 받으면 exponential backoff
- 여유 있게 500 req/min으로 제한 설정

### 2.7 Incremental Exports (핵심!)

**Dedicated Endpoint**: `/api/v2/incremental/*`

```bash
# Tickets incremental export
GET /api/v2/incremental/tickets.json?start_time=1732233600

# Response
{
  "tickets": [...],
  "end_time": 1732320000,
  "count": 50,
  "next_page": "https://.../incremental/tickets.json?start_time=1732320000"
}
```

**특징**:

- Unix timestamp 기반
- `end_time` 반환 → 다음 sync의 `start_time`으로 사용
- 최대 1000개까지 한 번에 반환
- **최적화**: Full sync 필요 없이 delta만 가져옴

**Best Practice**:

1. 첫 sync: `/api/v2/tickets.json` (전체)
2. 이후: `/api/v2/incremental/tickets.json?start_time={last_end_time}`
3. `end_time` 값 저장

### 2.8 Idempotency Support (중요!)

```bash
POST /api/v2/tickets.json
Idempotency-Key: unique-key-12345

# Response headers
x-idempotency-lookup: miss  # or "hit" if already processed
```

**용도**: 네트워크 실패 시 재시도해도 중복 생성 방지 (2시간 캐시)

---

## 3. Modern ETL/ELT Patterns

### 3.1 Airbyte vs Fivetran 패러다임

| Aspect         | Fivetran               | Airbyte                         |
| -------------- | ---------------------- | ------------------------------- |
| **Deployment** | Fully managed SaaS     | Open-source, self-hosted        |
| **Philosophy** | Set-and-forget         | Customizable control            |
| **Best For**   | Enterprise, low-effort | Budget-conscious, custom needs  |
| **Pricing**    | Per connector/row      | Free (self-host) or usage-based |

**Lesson for Momo**: Self-hosted approach like Airbyte → full control, cost-effective

### 3.2 Core Ingestion Patterns

#### A. Batch Integration

- **Frequency**: Hourly, daily, weekly
- **Use Case**: Historical data, reports, backups
- **Tools**: Cron jobs, Airflow, dbt
- **Pros**: Simple, predictable
- **Cons**: Latency (not real-time)

#### B. Real-Time Integration

- **Frequency**: Continuous streaming
- **Use Case**: Alerts, live dashboards
- **Tools**: Kafka, Kinesis, webhooks
- **Pros**: Low latency
- **Cons**: Complex, higher cost

#### C. Change Data Capture (CDC)

- **Frequency**: Near real-time
- **Use Case**: Database replication, event sourcing
- **Tools**: Debezium, Maxwell, database logs
- **Pros**: Efficient (only deltas)
- **Cons**: Requires database access

#### D. Hybrid (추천)

- **Batch for historical**: 첫 sync는 batch로 전체 데이터
- **Incremental for updates**: 이후는 delta만
- **Webhooks for critical events**: 실시간 알림 필요한 것만

### 3.3 Best Practices (2024-2025)

#### Data Quality & Reliability

```typescript
interface IngestionPipeline {
  // Checkpointing: 중간 저장으로 재시작 가능
  checkpoint(state: SyncState): Promise<void>;

  // Error retries: Exponential backoff
  retry(fn: () => Promise<T>, maxRetries: number): Promise<T>;

  // Incremental sync: 중복 방지
  fetchDelta(lastSyncTimestamp: Date): Promise<Data[]>;

  // Validation: Schema validation
  validate(data: unknown): data is ValidData;

  // Deduplication: Semantic hash 기반
  deduplicate(records: Record[]): Record[];
}
```

#### Automation & Monitoring

- **Real-time metrics**: Throughput, latency, error rates
- **Alerting**: Threshold 초과 시 알림
- **Auto-recovery**: 실패 시 자동 재시도
- **Workflow orchestration**: Airflow, Prefect, Temporal

#### Security & Compliance

- **Encryption**: TLS in-transit, at-rest encryption
- **Access control**: RBAC, least privilege
- **Audit logging**: 모든 ingestion 기록
- **Data classification**: PII 식별 및 보호

#### Scalability

- **Horizontal scaling**: 여러 노드에 분산
- **Auto-scaling**: 수요에 따라 자동 조정
- **Fault tolerance**: 노드 실패해도 시스템 유지
- **Backpressure handling**: 다운스트림 느릴 때 조절

### 3.4 ELT-First Revolution

**Traditional ETL**:

```
Source → Transform (staging) → Load → Warehouse
```

**Modern ELT**:

```
Source → Load (raw) → Transform (in warehouse)
```

**Why ELT?**

- Cloud warehouses (Snowflake, BigQuery) = 강력한 compute
- Raw data 보존 = 유연한 분석
- Faster ingestion = 변환 나중에
- Schema evolution = 나중에 구조 변경 가능

**Momo 적용**:

```
Linear/Zendesk → Load to canonical_objects (raw JSONB) → Transform as needed
```

---

## 4. Change Data Capture (CDC) Patterns

### 4.1 CDC란?

**Definition**: 데이터베이스에서 변경된 데이터(deltas)만 식별하고 추적하는 패턴

**Core Principle**:

- 전체 reload 대신 변경분만
- Batch windows 필요 없음
- Near real-time 가능

### 4.2 CDC Methods

#### A. Log-Based CDC (Most Efficient)

```
Database Transaction Log → CDC Processor → Target
```

**How it works**:

- DB의 transaction log/WAL 읽기 (e.g., MySQL binlog, Postgres WAL)
- Insert/Update/Delete 이벤트 파싱
- Target에 스트리밍

**Pros**:

- Source에 부하 최소
- Real-time
- 모든 변경 캡처

**Cons**:

- DB 접근 권한 필요
- API 기반 SaaS에는 불가능

#### B. Timestamp/Version-Based CDC

```sql
SELECT * FROM issues WHERE updated_at > :last_sync_time
```

**How it works**:

- `updated_at` 컬럼 기준으로 필터링
- 마지막 sync 시간 이후만 조회

**Pros**:

- 간단
- API에 적용 가능 (Linear, Zendesk 모두 지원)

**Cons**:

- Delete 감지 어려움 (soft delete면 가능)
- Clock skew 문제

#### C. Trigger-Based CDC

```sql
CREATE TRIGGER after_issue_update
AFTER UPDATE ON issues
FOR EACH ROW
  INSERT INTO change_log VALUES (NEW.id, NOW());
```

**Cons**: DB 성능 영향, API 불가

#### D. Snapshot (Diff-Based) Comparison

```
Current State - Previous State = Changes
```

**Cons**: 비효율적, 대량 데이터에 부적합

### 4.3 Incremental Loading Patterns

**Microbatch Loading**:

```typescript
// Every minute
setInterval(async () => {
  const changes = await fetchDelta(lastSyncTime);
  await loadToWarehouse(changes);
  lastSyncTime = Date.now();
}, 60 * 1000);
```

**Streaming Loading**:

```typescript
// Continuous stream
webhookStream.pipe(transform).pipe(loadToWarehouse);
```

### 4.4 CDC for Data Warehousing

**Benefits**:

- **Freshness**: 최신 데이터 유지
- **Performance**: Delta만 전송 → 네트워크/저장소 절약
- **Zero-downtime migrations**: 실시간 복제로 전환 무중단

**Modern Targets**:

- Snowflake, BigQuery, Redshift (warehouses)
- S3, GCS (lakes)
- Kafka, Kinesis (streams)
- Databricks (lakehouses)

### 4.5 Handling Deletes

**Challenge**: API는 delete를 알려주지 않음

**Solutions**:

1. **Soft Deletes**: `archivedAt` 필드 (Linear 지원!)

   ```typescript
   const deleted = items.filter((i) => i.archivedAt !== null);
   ```

2. **Full Refresh Periodically**: 주기적으로 전체 sync해서 누락 확인

3. **Webhook Events**: Delete 이벤트 구독 (Linear 지원)

---

## 5. Momo 프로젝트 적용 방안

### 5.1 선택한 아키텍처: Hybrid Batch + Incremental

#### Phase 1: Initial Full Sync (Batch)

```typescript
// 첫 실행: 전체 데이터 수집
async function initialSync() {
  // Linear
  const allIssues = await linearClient.issues({ first: 100 });
  await loadToCanonical(allIssues.nodes, 'linear');

  while (allIssues.pageInfo.hasNextPage) {
    const next = await allIssues.fetchNext();
    await loadToCanonical(next.nodes, 'linear');
  }

  // Zendesk
  const allTickets = await zendeskClient.get('/api/v2/tickets.json?page[size]=100');
  await loadToCanonical(allTickets.tickets, 'zendesk');

  // ... pagination loop

  // Store sync state
  await saveSyncState({
    platform: 'linear',
    lastSyncTime: new Date(),
    method: 'full',
  });
}
```

#### Phase 2: Incremental Sync (Delta)

```typescript
// 이후 실행: 변경분만
async function incrementalSync(platform: 'linear' | 'zendesk') {
  const lastSync = await getSyncState(platform);

  if (platform === 'linear') {
    const updated = await linearClient.issues({
      filter: { updatedAt: { gte: lastSync.lastSyncTime } },
      first: 100,
    });
    await loadToCanonical(updated.nodes, 'linear');
  }

  if (platform === 'zendesk') {
    const timestamp = Math.floor(lastSync.lastSyncTime.getTime() / 1000);
    const updated = await zendeskClient.get(
      `/api/v2/incremental/tickets.json?start_time=${timestamp}`
    );
    await loadToCanonical(updated.tickets, 'zendesk');
  }

  await saveSyncState({
    platform,
    lastSyncTime: new Date(),
    method: 'incremental',
  });
}
```

#### Phase 3: Webhook Integration (Real-time, Optional)

```typescript
// Linear webhook handler
app.post('/webhooks/linear', async (req, res) => {
  const event = req.body;

  if (event.action === 'update' && event.type === 'Issue') {
    const issue = await linearClient.issue(event.data.id);
    await loadToCanonical([issue], 'linear');
  }

  res.sendStatus(200);
});
```

### 5.2 데이터 파이프라인 구조

```
┌─────────────────────────────────────────────────────────────┐
│                        Data Sources                          │
├──────────────────┬──────────────────┬────────────────────────┤
│  Linear GraphQL  │   Zendesk REST   │   GitHub REST (done)  │
└────────┬─────────┴────────┬─────────┴────────┬───────────────┘
         │                  │                  │
         ▼                  ▼                  ▼
┌─────────────────────────────────────────────────────────────┐
│                    Collector Layer                           │
│  - linear-collector.ts                                       │
│  - zendesk-collector.ts                                      │
│  - github-collector.ts (existing)                            │
│                                                              │
│  Responsibilities:                                           │
│  - API authentication                                        │
│  - Pagination handling                                       │
│  - Rate limiting                                             │
│  - Error handling & retries                                  │
│  - Checkpointing                                             │
└────────┬────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│                   Transformer Layer                          │
│  - linear-transformer.ts                                     │
│  - zendesk-transformer.ts                                    │
│  - github-transformer.ts                                     │
│                                                              │
│  Responsibilities:                                           │
│  - Platform-specific → CanonicalObject                       │
│  - Relation mapping                                          │
│  - Metadata extraction                                       │
│  - Validation                                                │
│  - Deduplication (semantic hash)                             │
└────────┬────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│                  Database Layer (PostgreSQL)                 │
│                                                              │
│  canonical_objects table:                                    │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ id: "linear|workspace|issue|123"                    │   │
│  │ platform: "linear"                                  │   │
│  │ object_type: "issue"                                │   │
│  │ title, body, actors, timestamps, relations, raw     │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                              │
│  sync_state table (new):                                     │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ platform: "linear"                                  │   │
│  │ last_sync_time: "2025-11-23T10:00:00Z"             │   │
│  │ method: "incremental"                               │   │
│  │ records_synced: 150                                 │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### 5.3 Sync State 관리

**New Table**: `sync_state`

```sql
CREATE TABLE sync_state (
  platform VARCHAR(50) PRIMARY KEY,
  last_sync_time TIMESTAMPTZ NOT NULL,
  last_sync_cursor VARCHAR(500),  -- For cursor-based pagination
  method VARCHAR(20),              -- 'full' | 'incremental' | 'webhook'
  records_synced INTEGER,
  errors INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 5.4 Error Handling & Reliability

```typescript
class IngestionService {
  private async retryWithBackoff<T>(fn: () => Promise<T>, maxRetries = 5): Promise<T> {
    for (let i = 0; i < maxRetries; i++) {
      try {
        return await fn();
      } catch (error) {
        if (i === maxRetries - 1) throw error;

        const delay = Math.min(1000 * Math.pow(2, i), 30000);
        console.warn(`Retry ${i + 1}/${maxRetries} after ${delay}ms`);
        await sleep(delay);
      }
    }
    throw new Error('Max retries exceeded');
  }

  private async handleRateLimit(headers: Record<string, string>) {
    const remaining = parseInt(headers['x-rate-limit-remaining'] || '999');

    if (remaining < 10) {
      const resetTime = parseInt(headers['x-rate-limit-reset'] || '0');
      const waitMs = Math.max(0, resetTime * 1000 - Date.now());
      console.warn(`Rate limit near, waiting ${waitMs}ms`);
      await sleep(waitMs);
    }
  }
}
```

### 5.5 Monitoring & Metrics

```typescript
interface IngestionMetrics {
  platform: string;
  startTime: Date;
  endTime: Date;
  recordsFetched: number;
  recordsStored: number;
  duplicatesSkipped: number;
  errors: number;
  avgLatencyMs: number;
}

// Prometheus metrics (optional)
const ingestionDuration = new Histogram({
  name: 'ingestion_duration_seconds',
  help: 'Duration of ingestion runs',
  labelNames: ['platform', 'method'],
});

const ingestionRecords = new Counter({
  name: 'ingestion_records_total',
  help: 'Total records ingested',
  labelNames: ['platform', 'status'],
});
```

---

## 6. 의사결정 및 근거

### Decision 1: Incremental Sync over Full Refresh

**선택**: Timestamp-based incremental sync (Linear `updatedAt`, Zendesk incremental API)

**근거**:

- ✅ **효율성**: 전체 sync 대비 99% 네트워크/시간 절약 (100개 중 1-2개만 변경됨)
- ✅ **API 친화적**: Linear/Zendesk 모두 timestamp 필터 지원
- ✅ **간단성**: Log-based CDC는 DB 접근 필요 (API 불가)
- ⚠️ **Trade-off**: Delete 감지 어려움 → `archivedAt` soft delete로 해결
- ⚠️ **Fallback**: 주기적(weekly) full sync로 누락 방지

**구현**:

```typescript
const INCREMENTAL_INTERVAL = 5 * 60 * 1000; // 5분마다
const FULL_SYNC_INTERVAL = 7 * 24 * 60 * 60 * 1000; // 7일마다

setInterval(incrementalSync, INCREMENTAL_INTERVAL);
setInterval(fullSync, FULL_SYNC_INTERVAL);
```

### Decision 2: Hybrid Batch + Real-time

**선택**:

- Batch incremental (5분 간격) for 일반 데이터
- Webhooks (optional) for 중요 이벤트

**근거**:

- ✅ **실용성**: 5분 latency면 대부분 use case 충족
- ✅ **비용**: Continuous streaming = 복잡도/비용 증가
- ✅ **확장성**: 나중에 webhook 추가 가능
- ⚠️ **Trade-off**: Real-time 아님 (최대 5분 지연)

### Decision 3: ELT Pattern (Load Raw, Transform Later)

**선택**: Raw JSON을 `canonical_objects.raw` JSONB에 저장

**근거**:

- ✅ **유연성**: 나중에 필요한 필드 추가 가능 (schema evolution)
- ✅ **디버깅**: 원본 데이터 항상 확인 가능
- ✅ **재처리**: Transformer 로직 변경 시 raw에서 재변환
- ⚠️ **Storage**: JSONB는 공간 차지 → acceptable (압축됨)

### Decision 4: Semantic Deduplication

**선택**: `semantic_hash` 필드로 중복 감지

**근거**:

- ✅ **정확성**: ID만으로는 같은 내용의 다른 ID 감지 못함
- ✅ **효율성**: Hash 비교 = O(1)
- **Algorithm**: SHA-256(title + body + key metadata)

```typescript
function generateSemanticHash(obj: CanonicalObject): string {
  const content = `${obj.title}|${obj.body}|${obj.actors.created_by}`;
  return crypto.createHash('sha256').update(content).digest('hex');
}
```

### Decision 5: Linear TypeScript SDK over Raw GraphQL

**선택**: `@linear/sdk` 사용

**근거**:

- ✅ **Type Safety**: 완전한 TypeScript 타입
- ✅ **편의성**: Pagination helpers (`fetchNext()`)
- ✅ **유지보수**: Linear가 직접 관리
- ⚠️ **Vendor Lock-in**: Linear에 종속 → acceptable (GraphQL은 표준)

### Decision 6: PostgreSQL JSONB over Separate Tables

**선택**: `canonical_objects` 하나의 테이블 (JSONB 컬럼들)

**근거**:

- ✅ **유연성**: 플랫폼별 스키마 차이 수용
- ✅ **조회 성능**: GIN index on JSONB = 빠름
- ✅ **간단성**: N개 플랫폼 = N개 테이블 필요 없음
- ⚠️ **Trade-off**: 강타입 제약 없음 → application-level validation 필요

---

## 7. Next Steps

### 7.1 Phase 1 완료 체크리스트

- [x] Linear API 분석
- [x] Zendesk API 분석
- [x] ETL/CDC 패턴 리서치
- [ ] Linear/Zendesk SDK 샘플 코드 작성 (Phase 6에서 구현)

### 7.2 Phase 2로 넘어가기 전 확인사항

1. Linear API key 확보 (`LINEAR_API_KEY` 환경변수)
2. Zendesk subdomain + API token 확보 (`ZENDESK_SUBDOMAIN`, `ZENDESK_API_TOKEN`)
3. Sync state 테이블 마이그레이션 준비
4. Rate limiting 전략 최종 확인

### 7.3 연구 결과 요약

| Platform    | API Type | Incremental Method       | Pagination   | Rate Limit                  |
| ----------- | -------- | ------------------------ | ------------ | --------------------------- |
| **Linear**  | GraphQL  | `updatedAt` filter       | Relay cursor | Evolving (monitor headers)  |
| **Zendesk** | REST v2  | `/incremental/` endpoint | Cursor-based | 700 req/min                 |
| **GitHub**  | REST v3  | `since` parameter        | Link header  | 5000 req/hr (authenticated) |

**공통 패턴**:

- ✅ 모두 timestamp-based incremental 지원
- ✅ 모두 cursor pagination 지원
- ✅ 모두 rate limiting 있음 → backoff 전략 필수

---

## References

1. [Linear Developers Documentation](https://linear.app/developers)
2. [Linear GraphQL Schema (GitHub)](https://github.com/linear/linear/blob/master/packages/sdk/src/schema.graphql)
3. [Zendesk API Reference](https://developer.zendesk.com/api-reference/)
4. [Airbyte Data Ingestion Best Practices](https://airbyte.com/blog/best-practices-data-ingestion-pipeline)
5. [Change Data Capture Patterns (Confluent)](https://www.confluent.io/learn/change-data-capture/)
6. [PostgreSQL JSONB Indexing](https://www.postgresql.org/docs/current/datatype-json.html)

---

**Document Version**: 1.0
**Last Updated**: 2025-11-23
**Next Review**: After Phase 2 (Indexing Strategies)
