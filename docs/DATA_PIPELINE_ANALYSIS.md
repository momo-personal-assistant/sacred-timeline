# 데이터 파이프라인 구조 분석 보고서

**작성일**: 2025-11-27
**심각도**: 🔴 CRITICAL
**상태**: 실제 데이터 없음 - 전체 샘플 데이터만 존재

---

## 🚨 핵심 문제

**현재 Momo DB의 모든 데이터는 실제 API에서 가져온 것이 아니라 수동으로 생성된 샘플 데이터입니다.**

### 데이터베이스 현황

| Platform | Object Type  | Count | **실제 데이터 여부** |
| -------- | ------------ | ----- | -------------------- |
| discord  | voc          | 6     | ❌ 하드코딩된 샘플   |
| linear   | issue        | 82    | ❌ 생성된 샘플       |
| notion   | feedback     | 3     | ❌ 하드코딩된 샘플   |
| notion   | meeting_note | 1     | ❌ 하드코딩된 샘플   |
| slack    | thread       | 17    | ❌ 생성된 샘플       |
| zendesk  | ticket       | 17    | ❌ 생성된 샘플       |

**총 126개 오브젝트 - 모두 샘플 데이터**

---

## 📊 플랫폼별 상세 분석

### 1. Linear (82 issues)

#### ❌ 현재 상태: API 통합 없음

**증거:**

```bash
# .env 파일
LINEAR_API_KEY=                    # 비어있음!
```

**데이터 출처:**

1. **scripts/seed-momo-data.ts** (49 issues)
   - Lines 68-463: 하드코딩된 이슈 배열
   - 예시:

   ```typescript
   {
     id: 'TEN-190',
     title: 'dark mode bug broooo',
     actor: 'Cailyn Yong',  // 실제 사람이지만 Linear API에서 가져온게 아님
     status: 'Done',
   }
   ```

2. **data/samples/linear.json** (나머지)
   - `scripts/generate-samples/linear.ts`로 생성된 **가짜 데이터**
   - 가짜 사용자: `alice@company.com`, `bob@company.com`, `charlie@company.com`
   - 가짜 이슈: `PROD-100`, `PROD-101` 등

**DB에 실제로 들어간 데이터:**

```sql
SELECT DISTINCT actors->>'created_by' FROM canonical_objects WHERE platform = 'linear';

-- 결과:
alice@company.com      ← 가짜
bob@company.com        ← 가짜
charlie@company.com    ← 가짜
user:Cailyn Yong       ← 하드코딩
user:Jongmin Park      ← 하드코딩
```

#### 🔍 실제 API 통합이 없는 이유

**Linear API 클라이언트가 존재하지 않습니다:**

- `@linear/sdk` 패키지 설치 안됨
- Linear GraphQL 쿼리 코드 없음
- OAuth 인증 흐름 없음
- `scripts/sync-linear-to-db.ts`는 단순히 JSON 파일을 읽어서 DB에 넣는 스크립트일 뿐

---

### 2. Notion (4 items)

#### ❌ 현재 상태: API 통합 없음

**증거:**

```bash
# .env 파일
NOTION_API_KEY=                    # 비어있음!
NOTION_DATABASE_ID=                # 비어있음!
```

**데이터 출처:**
**scripts/seed-notion-feedback.ts** (4 items)

```typescript
const notionFeedbackData: NotionPage[] = [
  {
    id: 'notion-001',
    created_time: '2025-10-15T14:00:00.000Z', // 하드코딩된 타임스탬프
    properties: {
      title: [{ plain_text: 'User Feedback Session - Gmail CC/BCC Feature' }],
    },
    keywords: ['cc', 'bcc', 'gmail', 'ui', 'TEN-160'], // 수동으로 작성
    linked_issues: ['TEN-160'], // 수동으로 연결
  },
  // ... 3개 더
];
```

#### 🔍 Phase B "검증"의 실체

**제가 Phase B에서 한 작업:**

1. ✅ NotionTransformer 클래스 작성 (데이터 변환 로직만)
2. ✅ API 엔드포인트 작성 (`/api/momo/feedback`, `/api/momo/sync-notion`)
3. ✅ 수동으로 작성한 4개 샘플 데이터 DB에 삽입
4. ✅ UI에 Feedback 탭 추가

**하지 않은 작업:**

- ❌ Notion API 클라이언트 구현
- ❌ Notion OAuth 인증
- ❌ 실제 Notion에서 데이터 가져오기
- ❌ Notion Webhook 설정

**검증 결과의 의미:**

- "4개 피드백 검증 성공" = 4개 **가짜 데이터**가 DB에 잘 들어갔다는 뜻
- "8개 관계 검증 성공" = 제가 수동으로 설정한 **가짜 관계**가 잘 저장됐다는 뜻

---

### 3. Discord VOC (6 items)

#### ❌ 현재 상태: API 통합 없음

**증거:**

```bash
# .env 파일
DISCORD_BOT_TOKEN=                 # 비어있음!
```

**데이터 출처:**
**scripts/seed-momo-data.ts** (6 VOC items)

```typescript
const MOMO_VOC_DATA = [
  {
    id: 'voc-001',
    title: 'Gmail 이메일 중복 표시 문제',
    body: '회사 메일 스레드 중에, 지메일로 이메일을 보내면...',
    actor: 'alberttri23@gmail.com', // 하드코딩
    timestamp: '2024-11-14', // 하드코딩
    linkedIssue: 'TEN-159', // 수동 연결
  },
  // ... 5개 더
];
```

---

### 4. Slack (17 threads)

**증거:**

```bash
# .env 파일
SLACK_BOT_TOKEN=                   # 비어있음!
```

**데이터 출처:** 샘플 생성기로 만든 가짜 데이터

---

### 5. Zendesk (17 tickets)

**데이터 출처:** 샘플 생성기로 만든 가짜 데이터

---

## 🏗️ 현재 아키텍처 vs 예상 아키텍처

### ❌ 현재 (잘못된) 아키텍처

```
┌─────────────────────┐
│  Sample Scripts     │  ← scripts/seed-*.ts
│  (Hardcoded Data)   │  ← scripts/generate-samples/*.ts
└──────────┬──────────┘
           │
           │ Direct INSERT
           ▼
┌─────────────────────┐
│   PostgreSQL DB     │
│ (canonical_objects) │
└──────────┬──────────┘
           │
           │ SELECT
           ▼
┌─────────────────────┐
│    Next.js API      │  ← /api/momo/issues
│                     │  ← /api/momo/feedback
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│    UI (Momo DB)     │  ← 가짜 데이터 표시
└─────────────────────┘
```

**문제점:**

- ❌ 실제 API 호출 없음
- ❌ 실시간 데이터 동기화 없음
- ❌ OAuth 인증 없음
- ❌ Webhook 없음

---

### ✅ 올바른 아키텍처

```
┌─────────────────────┐
│  External APIs      │
│  ┌──────────────┐   │
│  │ Linear API   │   │  ← GraphQL queries
│  │ Notion API   │   │  ← REST API
│  │ Discord API  │   │  ← Bot events
│  │ Slack API    │   │  ← Events API
│  └──────────────┘   │
└──────────┬──────────┘
           │
           │ OAuth + API Keys
           ▼
┌─────────────────────┐
│   API Clients       │
│  ┌──────────────┐   │
│  │ LinearClient │   │  ← @linear/sdk
│  │ NotionClient │   │  ← @notionhq/client
│  │ DiscordClient│   │  ← discord.js
│  │ SlackClient  │   │  ← @slack/web-api
│  └──────────────┘   │
└──────────┬──────────┘
           │
           │ Fetch + Transform
           ▼
┌─────────────────────┐
│   Transformers      │
│  ┌──────────────┐   │
│  │ LinearTrans. │   │  ← 이미 존재 (변환 로직만)
│  │ NotionTrans. │   │  ← 이미 존재 (변환 로직만)
│  │ SlackTrans.  │   │  ← 이미 존재
│  └──────────────┘   │
└──────────┬──────────┘
           │
           │ CanonicalObject
           ▼
┌─────────────────────┐
│   Ingestion Layer   │
│  ┌──────────────┐   │
│  │ Sync Service │   │  ← 주기적 동기화
│  │ Webhook Hdlr │   │  ← 실시간 이벤트
│  └──────────────┘   │
└──────────┬──────────┘
           │
           │ Upsert
           ▼
┌─────────────────────┐
│   PostgreSQL DB     │
│ (canonical_objects) │  ← **실제** 데이터
└──────────┬──────────┘
           │
           │ Query
           ▼
┌─────────────────────┐
│    Next.js API      │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│    UI (Momo DB)     │  ← **실제** 데이터 표시
└─────────────────────┘
```

---

## 🛠️ 구조적 해결 방안

### Phase 1: API 클라이언트 구현 (필수)

#### 1.1 Linear API 통합

**필요 작업:**

```typescript
// packages/clients/src/linear-client.ts (신규 생성)
import { LinearClient as SDK } from '@linear/sdk';

export class LinearClient {
  private client: SDK;

  constructor(apiKey: string) {
    this.client = new SDK({ apiKey });
  }

  async fetchIssues(options: {
    teamId?: string;
    states?: string[];
    updatedSince?: Date;
  }): Promise<LinearIssue[]> {
    const issues = await this.client.issues({
      filter: {
        team: { id: { eq: options.teamId } },
        state: { name: { in: options.states } },
        updatedAt: { gte: options.updatedSince },
      },
    });

    return issues.nodes.map((issue) => ({
      id: issue.id,
      identifier: issue.identifier,
      title: issue.title,
      description: issue.description,
      state: issue.state,
      assignee: issue.assignee,
      creator: issue.creator,
      // ... 전체 필드 매핑
    }));
  }

  async fetchComments(issueId: string): Promise<LinearComment[]> {
    // 구현
  }
}
```

**설치 필요:**

```bash
pnpm add @linear/sdk
```

**환경 변수 설정:**

```bash
LINEAR_API_KEY=lin_api_xxxxxxxxxxxx  # Linear Settings에서 생성
LINEAR_TEAM_ID=xxxxxxxxxxxx           # tenxai team ID
```

#### 1.2 Notion API 통합

**필요 작업:**

```typescript
// packages/clients/src/notion-client.ts (신규 생성)
import { Client } from '@notionhq/client';

export class NotionClient {
  private client: Client;

  constructor(apiKey: string) {
    this.client = new Client({ auth: apiKey });
  }

  async fetchDatabasePages(databaseId: string): Promise<NotionPage[]> {
    const response = await this.client.databases.query({
      database_id: databaseId,
      sorts: [{ timestamp: 'last_edited_time', direction: 'descending' }],
    });

    return response.results.map((page) => ({
      id: page.id,
      created_time: page.created_time,
      last_edited_time: page.last_edited_time,
      properties: this.parseProperties(page.properties),
      // ... 전체 필드 파싱
    }));
  }

  async fetchPageContent(pageId: string): Promise<string> {
    const blocks = await this.client.blocks.children.list({
      block_id: pageId,
    });

    return this.blocksToMarkdown(blocks.results);
  }

  private parseProperties(properties: any): NotionProperties {
    // Notion property types 파싱
  }

  private blocksToMarkdown(blocks: any[]): string {
    // Notion blocks → Markdown 변환
  }
}
```

**설치 필요:**

```bash
pnpm add @notionhq/client
```

**Notion 설정 필요:**

1. Notion Integration 생성: https://www.notion.so/my-integrations
2. Database에 Integration 연결
3. API Key 복사

**환경 변수:**

```bash
NOTION_API_KEY=secret_xxxxxxxxxxxx
NOTION_DATABASE_ID=xxxxxxxxxxxx      # Feedback database ID
```

---

### Phase 2: 동기화 서비스 구현

#### 2.1 Sync Service 구조

```typescript
// services/ingestion/src/sync-service.ts (신규 생성)
import { LinearClient } from '@unified-memory/clients';
import { NotionClient } from '@unified-memory/clients';
import { LinearTransformer, NotionTransformer } from '@unified-memory/transformers';
import { UnifiedMemoryDB } from '@unified-memory/db';

export class SyncService {
  private linearClient: LinearClient;
  private notionClient: NotionClient;
  private db: UnifiedMemoryDB;

  constructor(config: SyncConfig) {
    this.linearClient = new LinearClient(config.linearApiKey);
    this.notionClient = new NotionClient(config.notionApiKey);
    this.db = new UnifiedMemoryDB(config.dbConfig);
  }

  async syncLinearIssues(): Promise<SyncResult> {
    console.log('🔄 Syncing Linear issues...');

    // 1. Fetch from Linear API
    const issues = await this.linearClient.fetchIssues({
      teamId: process.env.LINEAR_TEAM_ID,
      updatedSince: this.getLastSyncTime('linear'),
    });

    console.log(`   Fetched ${issues.length} issues from Linear`);

    // 2. Transform to canonical format
    const transformer = new LinearTransformer();
    const canonicalObjects = issues.map((issue) => transformer.transform(issue));

    // 3. Upsert to DB
    let inserted = 0;
    let updated = 0;

    for (const obj of canonicalObjects) {
      const exists = await this.db.getCanonicalObject(obj.id);
      if (exists) {
        await this.db.updateCanonicalObject(obj.id, obj);
        updated++;
      } else {
        await this.db.createCanonicalObject(obj);
        inserted++;
      }
    }

    console.log(`   ✅ Inserted: ${inserted}, Updated: ${updated}`);

    // 4. Update last sync time
    await this.updateLastSyncTime('linear');

    return { inserted, updated, total: issues.length };
  }

  async syncNotionFeedback(): Promise<SyncResult> {
    console.log('🔄 Syncing Notion feedback...');

    // 1. Fetch from Notion API
    const pages = await this.notionClient.fetchDatabasePages(process.env.NOTION_DATABASE_ID!);

    console.log(`   Fetched ${pages.length} pages from Notion`);

    // 2. Fetch page content for each
    for (const page of pages) {
      page.content = await this.notionClient.fetchPageContent(page.id);
    }

    // 3. Transform to canonical format
    const transformer = new NotionTransformer();
    const canonicalObjects = pages.map((page) => transformer.transform(page));

    // 4. Upsert to DB
    let inserted = 0;
    let updated = 0;

    for (const obj of canonicalObjects) {
      const exists = await this.db.getCanonicalObject(obj.id);
      if (exists) {
        await this.db.updateCanonicalObject(obj.id, obj);
        updated++;
      } else {
        await this.db.createCanonicalObject(obj);
        inserted++;
      }
    }

    console.log(`   ✅ Inserted: ${inserted}, Updated: ${updated}`);

    return { inserted, updated, total: pages.length };
  }

  async syncAll(): Promise<void> {
    await this.db.initialize();

    try {
      const linearResult = await this.syncLinearIssues();
      const notionResult = await this.syncNotionFeedback();

      console.log('\n✅ Sync completed:');
      console.log(`   Linear: ${linearResult.total} issues`);
      console.log(`   Notion: ${notionResult.total} pages`);
    } finally {
      await this.db.close();
    }
  }

  private getLastSyncTime(platform: string): Date {
    // sync_metadata 테이블에서 마지막 동기화 시간 가져오기
  }

  private async updateLastSyncTime(platform: string): Promise<void> {
    // sync_metadata 테이블 업데이트
  }
}
```

#### 2.2 CLI 스크립트

```typescript
// scripts/sync-all.ts (신규 생성)
import { SyncService } from '../services/ingestion/src/sync-service';

async function main() {
  const syncService = new SyncService({
    linearApiKey: process.env.LINEAR_API_KEY!,
    notionApiKey: process.env.NOTION_API_KEY!,
    dbConfig: {
      host: process.env.POSTGRES_HOST!,
      port: parseInt(process.env.POSTGRES_PORT!),
      database: process.env.POSTGRES_DB!,
      user: process.env.POSTGRES_USER!,
      password: process.env.POSTGRES_PASSWORD!,
    },
  });

  await syncService.syncAll();
}

main();
```

**사용법:**

```bash
# .env 파일에 API 키 설정 후
npx tsx scripts/sync-all.ts
```

---

### Phase 3: 실시간 동기화 (Webhooks)

#### 3.1 Linear Webhook

```typescript
// apps/demo/src/app/api/webhooks/linear/route.ts (신규)
import { NextResponse } from 'next/server';
import { LinearTransformer } from '@unified-memory/transformers';
import { UnifiedMemoryDB } from '@unified-memory/db';

export async function POST(request: Request) {
  // 1. Verify webhook signature
  const signature = request.headers.get('linear-signature');
  if (!verifyLinearSignature(signature, await request.text())) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  const event = await request.json();

  // 2. Handle different event types
  switch (event.type) {
    case 'Issue':
      await handleIssueEvent(event);
      break;
    case 'Comment':
      await handleCommentEvent(event);
      break;
  }

  return NextResponse.json({ success: true });
}

async function handleIssueEvent(event: LinearWebhookEvent) {
  const db = new UnifiedMemoryDB(/*...*/);
  const transformer = new LinearTransformer();

  const canonicalObject = transformer.transform(event.data);

  if (event.action === 'create') {
    await db.createCanonicalObject(canonicalObject);
  } else if (event.action === 'update') {
    await db.updateCanonicalObject(canonicalObject.id, canonicalObject);
  }
}
```

**Linear Webhook 설정:**

1. Linear Settings → API → Webhooks
2. URL: `https://your-domain.com/api/webhooks/linear`
3. Events: Issue created, Issue updated, Comment created

#### 3.2 Notion Webhook (복잡함 - 대안: Polling)

Notion은 Webhook이 제한적이므로 주기적 polling 추천:

```typescript
// Cron job (예: Vercel Cron)
// apps/demo/src/app/api/cron/sync-notion/route.ts
export async function GET() {
  // 5분마다 실행
  const syncService = new SyncService(/*...*/);
  await syncService.syncNotionFeedback();

  return NextResponse.json({ success: true });
}
```

---

## 📋 단계별 실행 계획

### 🎯 Quick Win (1-2일)

**목표:** 최소한의 실제 데이터 가져오기

1. **Linear API 연결 (4시간)**

   ```bash
   # 1. Linear API key 발급
   # 2. packages/clients/src/linear-client.ts 생성
   # 3. scripts/sync-linear.ts 생성
   # 4. 실행 및 검증
   npx tsx scripts/sync-linear.ts
   ```

2. **DB 샘플 데이터 제거 (30분)**

   ```bash
   # 가짜 데이터 삭제
   PGPASSWORD=unified_memory_dev psql -h localhost -p 5434 -U unified_memory -d unified_memory -c "
   DELETE FROM canonical_objects WHERE actors->>'created_by' LIKE '%@company.com';
   DELETE FROM canonical_objects WHERE id LIKE 'linear|tenxai|issue|PROD-%';
   "
   ```

3. **실제 Linear 이슈 동기화 (1시간)**
   - tenxai team의 실제 이슈 100개 가져오기
   - DB에 저장
   - UI에서 확인

4. **검증 (30분)**
   - Momo DB에서 실제 Linear 데이터 확인
   - actor가 실제 tenxai 팀원인지 확인
   - TEN-XXX 이슈 ID 확인

**예상 결과:**

```
✅ Linear: 100+ 실제 이슈
❌ Notion: 아직 샘플 (다음 단계에서 처리)
```

---

### 🔧 Full Implementation (1주)

**목표:** 모든 플랫폼 실제 데이터 통합

#### Day 1-2: Linear 완전 통합

- LinearClient 완성 (issues, comments, labels, users)
- Sync service 구현
- Webhook 설정
- 증분 동기화 (updatedSince)

#### Day 3-4: Notion 통합

- NotionClient 완성
- Notion database properties 파싱
- Page content (blocks) 변환
- Polling-based sync

#### Day 5: Discord/Slack 통합 (선택)

- Discord bot 설정
- Slack Events API 설정
- 실시간 메시지 수신

#### Day 6-7: 테스트 및 검증

- 전체 데이터 파이프라인 테스트
- UI 검증
- 성능 최적화

---

## 🎬 지금 당장 해야 할 것

### Option A: Quick Fix (추천)

**목표:** 최소한 Linear는 실제 데이터로

```bash
# 1. Linear API key 발급
open https://linear.app/tenxai/settings/api

# 2. .env 업데이트
echo "LINEAR_API_KEY=lin_api_YOUR_KEY_HERE" >> .env
echo "LINEAR_TEAM_ID=YOUR_TEAM_ID" >> .env

# 3. Linear SDK 설치
pnpm add @linear/sdk

# 4. Linear client 구현 (1-2시간)
# 5. Sync script 작성 (1시간)
# 6. 실행 및 검증 (30분)
```

**예상 시간:** 4-5시간
**결과:** 실제 Linear 데이터 100+ 이슈

---

### Option B: Proper Architecture

**목표:** 전체 시스템 제대로 구축

```bash
# 1. API 클라이언트 패키지 생성
mkdir -p packages/clients/src
pnpm add @linear/sdk @notionhq/client discord.js @slack/web-api

# 2. 동기화 서비스 생성
mkdir -p services/ingestion/src

# 3. 단계별 구현 (1주)
# 4. 모든 샘플 데이터 삭제
# 5. 실제 데이터로 전환
```

**예상 시간:** 1주
**결과:** 완전히 작동하는 실제 데이터 파이프라인

---

## 💡 추천 액션

제 추천은 **Option A (Quick Fix) → Option B (Proper Architecture)** 순서입니다:

1. **지금 당장 (오늘):**
   - Linear API key 발급
   - LinearClient 구현
   - 실제 이슈 100개 가져오기
   - 가짜 데이터 삭제

2. **다음 주:**
   - 나머지 플랫폼 (Notion, Discord) 통합
   - Webhook 설정
   - 자동 동기화

이렇게 하면:

- ✅ 즉시 실제 데이터를 볼 수 있음
- ✅ 점진적으로 개선 가능
- ✅ Phase B 작업 (Transformer, UI)은 재사용 가능

---

## ⚠️ 주의사항

### 제거해야 할 파일/코드

```bash
# 삭제 대상 (실제 API 통합 후)
scripts/seed-momo-data.ts              # 하드코딩된 샘플
scripts/seed-notion-feedback.ts        # 하드코딩된 Notion 샘플
scripts/generate-samples/              # 전체 샘플 생성기
data/samples/                           # 샘플 데이터 파일들
```

### 유지해야 할 파일/코드

```bash
# 재사용 가능 (실제 API 데이터와 함께 작동)
packages/transformers/                  # ✅ 변환 로직은 유효
apps/demo/src/app/api/momo/            # ✅ API 엔드포인트는 유효
apps/demo/src/components/MomoDBPanel.tsx # ✅ UI는 유효
```

---

## 📞 다음 단계

어떤 옵션으로 진행하시겠습니까?

1. **Quick Fix (4-5시간)**: Linear만 먼저 실제 데이터로
2. **Full Implementation (1주)**: 모든 플랫폼 제대로 통합
3. **Custom Plan**: 다른 우선순위나 접근 방식

선택하시면 상세 구현을 도와드리겠습니다.
