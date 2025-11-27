# Internal Usecase Roadmap: VOC-to-Feedback Pipeline

> Discord, Linear, Notion 플랫폼 데이터를 연결하여 VOC → 개발 → 피드백 흐름을 추적하는 내부 유즈케이스

**작성일**: 2024-11-27
**상태**: Planning
**관련 프로젝트**: Momo v4.

---

## 1. Overview

### 1.1 목표

Discord CS 채널의 VOC(Voice of Customer)가 Linear 개발 이슈로 전환되고, 구현된 기능이 Notion 피드백으로 검증되는 전체 흐름을 추적하는 Knowledge Graph 구축

### 1.2 데이터 소스

| 플랫폼      | 데이터 유형        | 수량                        | 연동 방식           |
| ----------- | ------------------ | --------------------------- | ------------------- |
| **Discord** | CS 채널 메시지     | 6개                         | Bot API (구현 필요) |
| **Linear**  | 개발 이슈          | 49개 (30 Done, 19 Canceled) | MCP (연결됨)        |
| **Notion**  | 미팅 노트 / 피드백 | 다수                        | API (구현 필요)     |

### 1.3 핵심 연결 관계

```
Discord CS (VOC)
       │
       │ [voc_triggered / resulted_in_issue]
       ▼
Linear Issue (개발)
       │
       │ [feature_validated / voc_mentioned_in]
       ▼
Notion Feedback (검증)
```

---

## 2. Phase A: VOC → 개발 이슈 연결 추적

### 2.1 목표

Discord에서 발생한 고객 문의/요청이 어떤 Linear 이슈로 전환되었는지 추적

### 2.2 현재 VOC 데이터 (6개)

| #   | VOC 내용                         | 관련 Linear 이슈          | 연결 상태 |
| --- | -------------------------------- | ------------------------- | --------- |
| 1   | Gmail 메시지 중복 표시 (1개→3개) | TEN-159, TEN-156          | Done ✅   |
| 2   | 결제 카드 변경 불가              | 없음                      | 미해결    |
| 3   | CC/BCC 기능 요청                 | **TEN-160**               | Done ✅   |
| 4   | Todo에서 이메일 답장 불가        | TEN-171, TEN-168          | Done ✅   |
| 5   | Slack 연동 메시지 안 보임        | TEN-162, TEN-164, TEN-165 | Done ✅   |
| 6   | www 도메인 설정 오류             | 없음 (인프라)             | 미해결    |

### 2.3 구현 작업

#### 2.3.1 Discord 데이터 수집

```typescript
// CanonicalObject 변환
{
  id: "discord|tenxai|cs_message|voc-001",
  platform: "discord",
  object_type: "cs_message",
  title: "Gmail 메시지 중복 표시 문의",
  body: "Not blocking my workflow but I saw one message in my gmail client but 3 messages in my momo dashboard.",
  actors: {
    created_by: "user:alberttri23@gmail.com"
  },
  timestamps: {
    created_at: "2025-XX-XXTXX:XX:XXZ",
    updated_at: "2025-XX-XXTXX:XX:XXZ"
  },
  properties: {
    voc_category: "bug",
    customer_email: "alberttri23@gmail.com",
    sentiment: "neutral"
  },
  relations: {
    resulted_in_issue: "linear|tenxai|issue|TEN-159"
  }
}
```

#### 2.3.2 Linear 이슈에 역방향 연결 추가

```typescript
// Linear Issue에 triggered_by_ticket 추가
{
  id: "linear|tenxai|issue|TEN-159",
  // ... 기존 필드 ...
  relations: {
    triggered_by_ticket: "discord|tenxai|cs_message|voc-001"
  }
}
```

#### 2.3.3 수동 매핑 작업

| 작업                           | 예상 시간 | 담당 |
| ------------------------------ | --------- | ---- |
| 6개 VOC → CanonicalObject 변환 | 30분      | -    |
| VOC ↔ Linear 이슈 매핑        | 30분      | -    |
| 매핑 검증                      | 15분      | -    |

### 2.4 완료 기준

- [ ] 6개 VOC가 CanonicalObject로 변환됨
- [ ] 4개 VOC-Issue 연결이 `relations` 필드에 저장됨
- [ ] RelationInferrer로 `triggered_by` 관계 추출 확인

---

## 3. Phase B: 개발 결과 → 피드백 연결

### 3.1 목표

Linear에서 완료된 기능이 Notion 피드백에서 어떻게 평가되는지 추적

### 3.2 연결 전략

Notion에 이슈 번호가 없으므로 다음 방법으로 연결:

1. **키워드 매칭**: 기능명 (cc, bcc, slack, gmail 등)
2. **시간 범위 매칭**: 이슈 완료 시점 ±7일 내 미팅 노트
3. **수동 라벨링**: 작은 데이터셋이므로 가능

### 3.3 구현 작업

#### 3.3.1 Notion API 연동

```typescript
// 환경 변수 (이미 정의됨)
NOTION_API_KEY=
NOTION_DATABASE_ID=

// Notion Transformer 구현 필요
// packages/transformers/src/notion-transformer.ts
```

#### 3.3.2 Notion → CanonicalObject 변환

```typescript
{
  id: "notion|tenxai|meeting_note|abc123",
  platform: "notion",
  object_type: "meeting_note",
  title: "2025-10-XX User Feedback Session",
  body: "CC/BCC 기능 피드백: 잘 작동하지만 UI 개선 필요...",
  actors: {
    participants: ["user:cailyn", "user:interviewer"]
  },
  timestamps: {
    created_at: "2025-10-XX...",
    updated_at: "2025-10-XX..."
  },
  properties: {
    note_type: "user_feedback",
    keywords: ["cc", "bcc", "gmail", "ui"]
  },
  relations: {
    linked_issues: ["linear|tenxai|issue|TEN-160"]
  }
}
```

#### 3.3.3 매칭 알고리즘

```typescript
// 키워드 기반 매칭
function findRelatedFeedback(issue: CanonicalObject, feedbacks: CanonicalObject[]) {
  const issueKeywords = extractKeywords(issue.title + ' ' + issue.body);

  return feedbacks.filter((feedback) => {
    const feedbackKeywords = feedback.properties?.keywords || [];
    const overlap = intersection(issueKeywords, feedbackKeywords);
    return overlap.length > 0;
  });
}

// 시간 기반 매칭
function findFeedbackInTimeRange(issue: CanonicalObject, feedbacks: CanonicalObject[]) {
  const completedAt = issue.timestamps.closed_at || issue.timestamps.updated_at;
  const rangeStart = subtractDays(completedAt, 7);
  const rangeEnd = addDays(completedAt, 30);

  return feedbacks.filter((feedback) => {
    const feedbackDate = feedback.timestamps.created_at;
    return feedbackDate >= rangeStart && feedbackDate <= rangeEnd;
  });
}
```

### 3.4 완료 기준

- [ ] Notion API 연동 완료
- [ ] 미팅 노트가 CanonicalObject로 변환됨
- [ ] Done 이슈와 피드백 간 연결 매핑 완료
- [ ] `feature_validated` 관계 추출 확인

---

## 4. Phase C: 의사결정 히스토리 분석

### 4.1 목표

Done vs Canceled 이슈 비교로 팀의 의사결정 패턴 파악

### 4.2 현재 데이터

#### Done 이슈 (30개) - 핵심 기능

| 이슈    | 기능              |
| ------- | ----------------- |
| TEN-153 | Google OAuth      |
| TEN-162 | Slack OAuth       |
| TEN-170 | Unified inbox     |
| TEN-188 | AI filtering      |
| TEN-160 | Gmail UI (CC/BCC) |
| ...     | ...               |

#### Canceled 이슈 (19개) - 포기된 기능

| 이슈    | 기능                      | 추정 포기 이유        |
| ------- | ------------------------- | --------------------- |
| TEN-134 | Socket.IO Server          | SSE로 대체            |
| TEN-155 | Supabase setup            | 다른 DB 선택          |
| TEN-167 | Rule-based categorization | AI filtering으로 대체 |
| TEN-176 | Slack reminder bot        | 리소스 부족           |
| TEN-172 | Mobile optimization       | 우선순위 낮음         |
| ...     | ...                       | ...                   |

### 4.3 분석 관점

1. **기술적 전환**: Socket.IO → SSE, Rule-based → AI
2. **범위 축소**: Mobile, Reminder 등 부가 기능 제외
3. **인프라 변경**: Supabase → 다른 선택

### 4.4 구현 작업

#### 4.4.1 Decision Relation 추가

```typescript
// RelationType 확장
type RelationType =
  // 기존...
  | 'decision_replaced_by' // Canceled → Done (대체된 경우)
  | 'decision_deprioritized' // Canceled (우선순위 낮음)
  | 'decision_blocked_by'; // 다른 이슈에 의해 블록됨
```

#### 4.4.2 분석 쿼리

```typescript
// 대체 관계 분석
const replacementPairs = [
  { canceled: 'TEN-134', replacedBy: 'TEN-173', reason: 'Socket.IO → SSE' },
  { canceled: 'TEN-167', replacedBy: 'TEN-188', reason: 'Rule-based → AI' },
];

// 시간축 분석
const decisionTimeline = issues
  .filter((i) => i.properties?.status === 'Canceled')
  .sort((a, b) => new Date(a.timestamps.updated_at) - new Date(b.timestamps.updated_at));
```

### 4.5 완료 기준

- [ ] Done/Canceled 이슈 분류 완료
- [ ] 대체 관계 매핑 완료
- [ ] 의사결정 타임라인 생성
- [ ] 인사이트 문서화

---

## 5. Knowledge Graph 구축

### 5.1 목표

Phase A, B, C의 모든 연결을 통합한 Knowledge Graph 구축

### 5.2 노드 타입

```typescript
enum NodeType {
  // 플랫폼 객체
  VOC = 'voc', // Discord CS 메시지
  ISSUE = 'issue', // Linear 이슈
  FEEDBACK = 'feedback', // Notion 피드백
  MEETING_NOTE = 'meeting', // Notion 미팅 노트

  // 엔티티
  USER = 'user', // 사용자/고객
  FEATURE = 'feature', // 기능 영역
  PROJECT = 'project', // 프로젝트
}
```

### 5.3 엣지 타입 (Relations)

```typescript
enum RelationType {
  // VOC 관련
  VOC_TRIGGERED = 'voc_triggered', // VOC → Issue
  VOC_RESOLVED_BY = 'voc_resolved_by', // VOC → Issue (해결됨)

  // 개발 관련
  IMPLEMENTED_FEATURE = 'implemented', // Issue → Feature
  ASSIGNED_TO = 'assigned_to', // Issue → User
  BELONGS_TO = 'belongs_to', // Issue → Project

  // 피드백 관련
  VALIDATED_BY = 'validated_by', // Issue → Feedback
  MENTIONED_IN = 'mentioned_in', // Issue → Meeting

  // 의사결정 관련
  REPLACED_BY = 'replaced_by', // Canceled → Done
  SIMILAR_TO = 'similar_to', // 키워드/임베딩 기반
}
```

### 5.4 그래프 시각화 예시

```
                         ┌────────────────────┐
                         │   alberttri23      │
                         │   (Customer)       │
                         └─────────┬──────────┘
                                   │ created
                    ┌──────────────┼──────────────┐
                    ▼              ▼              ▼
            ┌───────────┐  ┌───────────┐  ┌───────────┐
            │  VOC-001  │  │  VOC-003  │  │  VOC-005  │
            │  중복버그 │  │  CC/BCC   │  │  Slack    │
            └─────┬─────┘  └─────┬─────┘  └─────┬─────┘
                  │              │              │
                  │ triggered    │ triggered    │ triggered
                  ▼              ▼              ▼
            ┌───────────┐  ┌───────────┐  ┌───────────┐
            │  TEN-159  │  │  TEN-160  │  │  TEN-164  │
            │  Gmail    │  │  Gmail UI │  │  Slack    │
            │  Sync     │  │  CC/BCC   │  │  Fetch    │
            └─────┬─────┘  └─────┬─────┘  └─────┬─────┘
                  │              │              │
                  │ assigned     │ assigned     │ assigned
                  ▼              ▼              ▼
            ┌─────────────────────────────────────────┐
            │              Cailyn Yong                │
            │              (Developer)                │
            └─────────────────────────────────────────┘
```

### 5.5 구현 작업

#### 5.5.1 기존 RelationInferrer 활용

```typescript
// packages/graph/src/relation-inferrer.ts 이미 구현됨
const inferrer = new RelationInferrer({
  similarityThreshold: 0.85,
  keywordOverlapThreshold: 0.65,
  includeInferred: true,
  useSchemaSignal: true, // EXP-007
  useDocumentThreshold: true, // EXP-008
});

// 관계 추출
const relations = inferrer.inferAll(canonicalObjects);
```

#### 5.5.2 그래프 저장

```sql
-- 이미 정의된 스키마 (db/migrations/)
-- canonical_objects 테이블 + relations 추가 필요

CREATE TABLE IF NOT EXISTS relations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_id VARCHAR(255) NOT NULL,
  to_id VARCHAR(255) NOT NULL,
  type VARCHAR(50) NOT NULL,
  source VARCHAR(20) NOT NULL,  -- explicit, inferred, computed
  confidence DECIMAL(3,2) NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  FOREIGN KEY (from_id) REFERENCES canonical_objects(id),
  FOREIGN KEY (to_id) REFERENCES canonical_objects(id)
);

CREATE INDEX idx_relations_from ON relations(from_id);
CREATE INDEX idx_relations_to ON relations(to_id);
CREATE INDEX idx_relations_type ON relations(type);
```

### 5.6 완료 기준

- [ ] 모든 CanonicalObject DB 저장
- [ ] 모든 Relation 추출 및 저장
- [ ] 그래프 쿼리 테스트 ("VOC-003과 관련된 모든 것")
- [ ] 시각화 (선택사항)

---

## 6. Temporal Layer (Knowledge Graph 이후)

### 6.1 목표

시간 축 분석으로 VOC → 개발 → 피드백 처리 시간 및 패턴 파악

### 6.2 Bi-temporal 인덱싱

```typescript
interface TemporalMetadata {
  event_time: string; // 실제 발생 시간 (VOC 작성, 이슈 생성)
  ingestion_time: string; // 시스템 수집 시간
  resolution_time?: string; // 해결 시간 (이슈 Done)
}
```

### 6.3 분석 가능한 메트릭

| 메트릭                | 계산 방법                              | 의미             |
| --------------------- | -------------------------------------- | ---------------- |
| VOC → Issue 전환 시간 | `issue.created_at - voc.created_at`    | VOC 대응 속도    |
| Issue 처리 시간       | `issue.closed_at - issue.created_at`   | 개발 속도        |
| 전체 사이클 타임      | `feedback.created_at - voc.created_at` | 전체 피드백 루프 |

### 6.4 Time-Decay 메커니즘

```typescript
// 최신 정보 우선 검색
const time_decay_factor = Math.pow(0.5, days_since_creation / half_life);
const fusion_score = semantic_similarity * 0.7 + time_decay_factor * 0.3;
```

### 6.5 완료 기준

- [ ] Temporal 메타데이터 추가
- [ ] 처리 시간 메트릭 계산
- [ ] 시간축 시각화
- [ ] 트렌드 분석

---

## 7. (Optional) Clustering Layer

### 7.1 현재 상태

- 데이터 양: VOC 6개, 이슈 49개
- **권장**: 수동 라벨링이 더 효과적
- **조건**: 100+ VOC 시점에 재검토

### 7.2 향후 적용 가능한 클러스터링

| 클러스터 유형   | 방법    | 용도                       |
| --------------- | ------- | -------------------------- |
| VOC 유형        | HDBSCAN | Bug vs Feature vs Question |
| 기능 영역       | K-means | Gmail vs Slack vs UI       |
| 사용자 세그먼트 | GMM     | 파워유저 vs 캐주얼         |

---

## 8. 기술 스택 & 기존 코드 활용

### 8.1 활용 가능한 기존 코드

| 패키지                   | 용도                  | 상태                              |
| ------------------------ | --------------------- | --------------------------------- |
| `@unified-memory/shared` | CanonicalObject 타입  | ✅ 사용 가능                      |
| `@momo/graph`            | RelationInferrer      | ✅ 사용 가능                      |
| `@momo/embedding`        | 임베딩 생성           | ✅ 사용 가능                      |
| `@momo/transformers`     | 플랫폼 변환기         | Slack만 구현, Notion/Discord 필요 |
| `@unified-memory/db`     | PostgreSQL 클라이언트 | ✅ 사용 가능                      |

### 8.2 구현 필요한 코드

| 항목                          | 위치                                               | 예상 작업량 |
| ----------------------------- | -------------------------------------------------- | ----------- |
| Discord Transformer           | `packages/transformers/src/discord-transformer.ts` | 중          |
| Notion Transformer            | `packages/transformers/src/notion-transformer.ts`  | 중          |
| Linear Transformer            | `packages/transformers/src/linear-transformer.ts`  | 소          |
| Relations 테이블 마이그레이션 | `db/migrations/015_relations_table.sql`            | 소          |

### 8.3 외부 연동

| 플랫폼  | 연동 방식 | 상태      |
| ------- | --------- | --------- |
| Linear  | MCP       | ✅ 연결됨 |
| Discord | Bot API   | 구현 필요 |
| Notion  | API       | 구현 필요 |

---

## 9. 실행 계획

### Week 1: Phase A (VOC → Issue)

| 일  | 작업                      | 산출물                   |
| --- | ------------------------- | ------------------------ |
| 1   | Discord 6개 VOC 수동 입력 | `voc-001 ~ voc-006.json` |
| 2   | Linear 이슈 MCP로 추출    | `issues.json`            |
| 3   | CanonicalObject 변환      | `canonical_objects.json` |
| 4   | VOC ↔ Issue 매핑         | `relations.json`         |
| 5   | 검증 및 테스트            | 테스트 통과              |

### Week 2: Phase B (Issue → Feedback)

| 일  | 작업             | 산출물                  |
| --- | ---------------- | ----------------------- |
| 1-2 | Notion API 연동  | `notion-transformer.ts` |
| 3   | 미팅 노트 추출   | `meeting_notes.json`    |
| 4   | 키워드/시간 매칭 | 연결 관계               |
| 5   | 검증 및 보완     | 수동 검증 완료          |

### Week 3: Phase C (의사결정 분석)

| 일  | 작업               | 산출물                    |
| --- | ------------------ | ------------------------- |
| 1-2 | Done/Canceled 분류 | 분류 데이터               |
| 3   | 대체 관계 매핑     | `decision_relations.json` |
| 4-5 | 인사이트 문서화    | 분석 리포트               |

### Week 4: Knowledge Graph

| 일  | 작업                | 산출물                    |
| --- | ------------------- | ------------------------- |
| 1-2 | DB 마이그레이션     | `015_relations_table.sql` |
| 3-4 | 그래프 구축 및 저장 | DB 데이터                 |
| 5   | 쿼리 테스트         | 쿼리 결과 검증            |

### Week 5+: Temporal Layer

- 시간축 메타데이터 추가
- 메트릭 계산
- 시각화

---

## 10. 성공 지표

### 10.1 Phase A

- [ ] 6개 VOC 중 4개 이상 Linear 이슈와 연결됨 (현재 67%)
- [ ] `triggered_by` 관계 추출 정확도 > 90%

### 10.2 Phase B

- [ ] Done 이슈 중 50% 이상 Notion 피드백과 연결됨
- [ ] 키워드 매칭 precision > 70%

### 10.3 Phase C

- [ ] Canceled 이슈의 대체 관계 매핑 완료
- [ ] 의사결정 인사이트 3개 이상 도출

### 10.4 Knowledge Graph

- [ ] 그래프 쿼리 응답 시간 < 100ms
- [ ] "VOC-003 관련 모든 것" 쿼리 정확도 100%

---

## 11. 위험 요소 & 대응

| 위험                      | 가능성 | 영향 | 대응                    |
| ------------------------- | ------ | ---- | ----------------------- |
| Notion 데이터 정리 안 됨  | 높음   | 중   | 수동 라벨링으로 대응    |
| Discord 데이터 부족       | 높음   | 저   | 6개로 검증 후 확장      |
| Linear-Notion 연결 어려움 | 중     | 중   | 시간 범위 + 키워드 병행 |

---

## 12. 참고 문서

- [ARCHITECTURE.md](./ARCHITECTURE.md)
- [05-knowledge-graph-layer.md](./research/pipeline-optimization/05-knowledge-graph-layer.md)
- [06-temporal-layer.md](./research/pipeline-optimization/06-temporal-layer.md)
- [04-clustering-layer.md](./research/pipeline-optimization/04-clustering-layer.md)
- [packages/shared/src/types/canonical.ts](../packages/shared/src/types/canonical.ts)
- [packages/graph/src/relation-inferrer.ts](../packages/graph/src/relation-inferrer.ts)

---

_Last Updated: 2024-11-27_
