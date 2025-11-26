# Memory Research Tool - Product Specification

> Claude Code를 활용한 승인 기반 실험 자동화 도구

## 1. Overview

### 1.1 Background

[mshumer/autonomous-researcher](https://github.com/mshumer/autonomous-researcher)를 참고하되, 연구자 중심의 워크플로우에 맞게 재설계한 도구.

**autonomous-researcher의 접근:**

- 질문 입력 → AI가 알아서 실험 → 결과 (Paper 형식)
- 완전 자율 실행, 사용자 개입 최소화

**우리의 접근:**

- 소스 + 의도 입력 → 계획 리뷰 → **승인 후 실행** → 결과 비교 → Baseline 승격
- 사용자 승인 기반, 점진적 개선에 초점

### 1.2 핵심 차별점

| 항목      | autonomous-researcher | Memory Research Tool         |
| --------- | --------------------- | ---------------------------- |
| 실행 방식 | 완전 자율             | **승인 기반**                |
| 입력      | 질문만                | 소스(논문) + 의도            |
| 계획      | AI가 알아서           | **리뷰 & 수정 가능**         |
| 결과물    | 학술 Paper            | 웹 문서 + 차트               |
| 비교      | 없음                  | **Baseline 대비 비교**       |
| 후속      | 없음                  | **Baseline 승격**            |
| 실행 환경 | Modal GPU 샌드박스    | **Claude Code CLI**          |
| 비용      | API 호출 비용         | **Claude Code Max (무제한)** |

### 1.3 Target User

- 1차: 내부 연구용 (본인)
- 2차: Persistent Memory 연구자

### 1.4 Tech Stack

```
Frontend:  React + TypeScript + Tailwind CSS (기존 apps/demo 활용)
Backend:   Next.js API Routes
Execution: Claude Code CLI (subprocess)
Storage:   PostgreSQL + config YAML files
```

---

## 2. Architecture

### 2.1 System Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        Memory Research Tool                              │
│                                                                         │
│   ┌─────────────────────────────────────────────────────────────────┐   │
│   │                     Web UI (localhost:3000)                      │   │
│   │   ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐           │   │
│   │   │  Input  │→ │  Plan   │→ │ Execute │→ │ Result  │           │   │
│   │   │  Phase  │  │  Phase  │  │  Phase  │  │  Phase  │           │   │
│   │   └─────────┘  └─────────┘  └─────────┘  └─────────┘           │   │
│   └─────────────────────────────────────────────────────────────────┘   │
│                                    │                                    │
│                                    ▼                                    │
│   ┌─────────────────────────────────────────────────────────────────┐   │
│   │                    Next.js API Routes                            │   │
│   │   /api/experiments/plan      - 계획 생성                         │   │
│   │   /api/experiments/execute   - 실행 (SSE 스트리밍)               │   │
│   │   /api/experiments/compare   - 결과 비교                         │   │
│   │   /api/baseline/promote      - Baseline 승격                     │   │
│   └─────────────────────────────────────────────────────────────────┘   │
│                                    │                                    │
│                                    ▼                                    │
│   ┌─────────────────────────────────────────────────────────────────┐   │
│   │                    Claude Code CLI                               │   │
│   │   child_process.spawn('claude', ['--print', prompt])            │   │
│   │   - 로컬 파일 시스템 접근                                        │   │
│   │   - 코드 생성 & 실행                                             │   │
│   │   - 결과 stdout 스트리밍                                         │   │
│   └─────────────────────────────────────────────────────────────────┘   │
│                                    │                                    │
│                                    ▼                                    │
│   ┌─────────────────────────────────────────────────────────────────┐   │
│   │                    Config & Storage                              │   │
│   │   config/default.yaml        - Baseline 설정                     │   │
│   │   config/experiments/*.yaml  - 실험 기록                         │   │
│   │   PostgreSQL                 - 실험 결과 데이터                   │   │
│   └─────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Component Structure

```
apps/demo/src/
├── app/
│   ├── research/                    # 연구 도구 메인 페이지
│   │   └── page.tsx
│   └── api/
│       ├── experiments/
│       │   ├── plan/route.ts        # 계획 생성 API
│       │   ├── execute/route.ts     # 실행 API (SSE)
│       │   └── compare/route.ts     # 비교 API
│       └── baseline/
│           └── promote/route.ts     # Baseline 승격 API
│
├── components/
│   ├── research/
│   │   ├── ResearchLayout.tsx       # 전체 레이아웃 (Main + Sidebar)
│   │   ├── InputPhase.tsx           # Phase 1: 입력
│   │   ├── PlanPhase.tsx            # Phase 2: 계획 리뷰
│   │   ├── ExecutePhase.tsx         # Phase 3: 실행
│   │   ├── ResultPhase.tsx          # Phase 4: 결과
│   │   ├── ExperimentSidebar.tsx    # 실험 히스토리 사이드바
│   │   ├── PlanEditor.tsx           # 계획 편집기 (직접 편집)
│   │   ├── FeedbackInput.tsx        # AI 피드백 입력
│   │   ├── ExecutionConsole.tsx     # 실행 콘솔 (터미널 스타일)
│   │   ├── ResultChart.tsx          # 결과 차트
│   │   └── BaselinePromote.tsx      # Baseline 승격 UI
│   └── ui/                          # 공통 UI 컴포넌트
│       ├── ProgressBar.tsx
│       ├── StatusBadge.tsx
│       └── StreamingMarkdown.tsx
│
├── lib/
│   ├── claude-executor.ts           # Claude Code CLI 실행
│   ├── experiment-store.ts          # 실험 상태 관리
│   └── config-manager.ts            # YAML 설정 관리
│
└── types/
    └── experiment.ts                # 실험 관련 타입 정의
```

### 2.3 Reference: autonomous-researcher Components

| autonomous-researcher   | 우리 버전               | 역할                           |
| ----------------------- | ----------------------- | ------------------------------ |
| `LabNotebook.tsx`       | `ResearchLayout.tsx`    | 메인 레이아웃, Phase 관리      |
| `CredentialPrompt.tsx`  | (불필요)                | Claude Code Max 사용           |
| `Console.tsx`           | `ExecutionConsole.tsx`  | 터미널 스타일 로그 출력        |
| `AgentNotebook.tsx`     | `ExecutePhase.tsx`      | 실행 과정 표시                 |
| `NotebookCell.tsx`      | (통합)                  | 개별 실행 단계                 |
| `FindingsRail.tsx`      | `ExperimentSidebar.tsx` | 사이드바 (히스토리)            |
| `ResearchPaper.tsx`     | `ResultPhase.tsx`       | 결과 표시 (Paper 대신 웹 문서) |
| `StatusBadge.tsx`       | `StatusBadge.tsx`       | 상태 표시                      |
| `StreamingMarkdown.tsx` | `StreamingMarkdown.tsx` | 스트리밍 마크다운 렌더링       |

---

## 3. User Flow

### 3.1 Phase 1: Input (입력)

**목적:** 실험의 소스와 의도를 정의

**UI 구성:**

```
┌─────────────────────────────────────────────────────────────────────────┐
│  📎 소스 (논문/문서)                                                    │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  [드래그 앤 드롭 또는 클릭하여 파일 추가]                          │   │
│  │                                                                  │   │
│  │  ✓ voyage-3-large.md                              [x 제거]       │   │
│  │  ✓ enhancing-rag-best-practices.md                [x 제거]       │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  💬 실험 의도                                                           │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  voyage-3-large 임베딩으로 현재 baseline 대비                     │   │
│  │  F1 스코어가 개선되는지 테스트하고 싶어                            │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  📊 비교 대상                                                           │
│  [✓] Baseline (default.yaml - F1: 65.9%)                               │
│  [ ] EXP-003 (F1: 92.3%)                                               │
│                                                                         │
│                              [📋 계획 생성]                             │
└─────────────────────────────────────────────────────────────────────────┘
```

**입력 데이터:**

```typescript
interface ExperimentInput {
  sources: File[]; // 첨부된 논문/문서
  intent: string; // 실험 의도
  compareWith: string[]; // 비교 대상 실험 ID
}
```

**API 호출:**

```
POST /api/experiments/plan
Body: { sources, intent, compareWith }
Response: { experimentId, plan }
```

### 3.2 Phase 2: Plan Review (계획 리뷰 & 승인)

**목적:** AI가 생성한 계획을 리뷰하고 수정/승인

**UI 구성:**

```
┌─────────────────────────────────────────────────────────────────────────┐
│  📋 실험 계획서: EXP-004                                    [DRAFT]     │
│  ═══════════════════════════════════════════════════════════════════   │
│                                                                         │
│  **가설**                                              [✏️ 편집]        │
│  voyage-3-large 임베딩이 text-embedding-3-small 대비                   │
│  F1 스코어 10% 이상 향상될 것                                           │
│                                                                         │
│  **실험 단계**                                          [✏️ 편집]        │
│  1. packages/embedding에 voyage-embedder.ts 구현                       │
│  2. Voyage API 연동 및 테스트                                          │
│  3. 기존 테스트 데이터로 임베딩 생성                                    │
│  4. 파이프라인 실행 및 F1 측정                                         │
│  5. Baseline 대비 비교                                                 │
│                                                                         │
│  **설정 변경 (from baseline)**                          [✏️ 편집]        │
│  embedding.model: "text-embedding-3-small" → "voyage-3-large"          │
│  embedding.dimensions: 1536 → 1024                                     │
│                                                                         │
│  ───────────────────────────────────────────────────────────────────   │
│                                                                         │
│  💬 피드백 (AI에게 수정 요청)                                           │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  "dimension 호환성 확인 단계를 추가해줘"                          │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│  [🔄 피드백 반영]                                                       │
│                                                                         │
│        [🔄 계획 수정]        [✅ 승인 & 실행]        [❌ 취소]          │
└─────────────────────────────────────────────────────────────────────────┘
```

**수정 방식:**

1. **직접 편집**: [✏️ 편집] 버튼 → 인라인 편집 모드
2. **AI 피드백**: 피드백 입력 → [🔄 피드백 반영] → AI가 계획 수정

**계획 데이터:**

```typescript
interface ExperimentPlan {
  id: string; // EXP-004
  status: 'draft' | 'approved' | 'running' | 'completed';
  hypothesis: string; // 가설
  steps: ExperimentStep[]; // 실험 단계
  configChanges: ConfigDiff[]; // 설정 변경사항
  expectedMetrics: {
    f1_min: number;
    precision_min: number;
    recall_min: number;
  };
  compareWith: string[]; // 비교 대상
}

interface ExperimentStep {
  order: number;
  description: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  output?: string;
}
```

### 3.3 Phase 3: Execution (실행)

**목적:** 승인된 계획을 Claude Code로 실행하고 모니터링

**UI 구성:**

```
┌─────────────────────────────────────────────────────────────────────────┐
│  🔬 EXP-004 실행 중...                                                  │
│  ═══════════════════════════════════════════════════════════════════   │
│                                                                         │
│  Progress:  ████████████░░░░░░  Step 3/5                               │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  ✅ 1. voyage-embedder.ts 구현                                   │   │
│  │       └─ Created: packages/embedding/src/voyage-embedder.ts     │   │
│  │                                                                  │   │
│  │  ✅ 2. Voyage API 연동 테스트                                    │   │
│  │       └─ API 연결 성공                                          │   │
│  │                                                                  │   │
│  │  🔄 3. 임베딩 생성 중...                                         │   │
│  │       └─ 45/100 documents embedded                              │   │
│  │                                                                  │   │
│  │  ⏳ 4. F1 측정                                                   │   │
│  │  ⏳ 5. Baseline 비교                                             │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  Console                                                               │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  14:23:01  $ claude --print "implement voyage embedder..."      │   │
│  │  14:23:15  Created voyage-embedder.ts                           │   │
│  │  14:23:16  $ pnpm test:embedding                                │   │
│  │  14:23:20  ✓ All tests passed                                   │   │
│  │  14:23:21  Generating embeddings... 45/100                      │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│                              [⏸ 일시정지]  [🛑 중단]                    │
└─────────────────────────────────────────────────────────────────────────┘
```

**실행 방식:**

```typescript
// Claude Code CLI 실행
const claude = spawn('claude', ['--print', stepPrompt], {
  cwd: projectRoot,
});

// SSE로 실시간 스트리밍
claude.stdout.on('data', (data) => {
  sseController.enqueue(
    `data: ${JSON.stringify({
      type: 'output',
      content: data.toString(),
    })}\n\n`
  );
});
```

**API:**

```
POST /api/experiments/execute
Body: { experimentId }
Response: SSE stream
  - { type: 'step_start', step: 1 }
  - { type: 'output', content: '...' }
  - { type: 'step_complete', step: 1 }
  - { type: 'complete', results: {...} }
```

### 3.4 Phase 4: Result & Baseline Promotion (결과 & 승격)

**목적:** 결과 확인, Baseline 비교, 승격 결정

**UI 구성:**

```
┌─────────────────────────────────────────────────────────────────────────┐
│  📊 EXP-004 결과                                          [COMPLETED]   │
│  ═══════════════════════════════════════════════════════════════════   │
│                                                                         │
│  **최종 스코어 비교**                                                   │
│  ┌───────────────────────────────────────────────────────────────┐     │
│  │              F1 Score                                         │     │
│  │                                                               │     │
│  │   Baseline (EXP-001)         ████████████░░░  65.9%           │     │
│  │   EXP-004 (current)          ██████████████░░  78.2%          │     │
│  │                                                               │     │
│  │   차이: +12.3%  ✅ 가설 검증됨                                 │     │
│  └───────────────────────────────────────────────────────────────┘     │
│                                                                         │
│  **상세 메트릭**                                                        │
│  ┌───────────────────────────────────────────────────────────────┐     │
│  │   Metric      Baseline    EXP-004     Diff                    │     │
│  │   ────────────────────────────────────────────────────────── │     │
│  │   F1          65.9%       78.2%       +12.3%  ✅              │     │
│  │   Precision   70.2%       82.1%       +11.9%  ✅              │     │
│  │   Recall      62.1%       74.8%       +12.7%  ✅              │     │
│  └───────────────────────────────────────────────────────────────┘     │
│                                                                         │
│  **결론**                                                               │
│  voyage-3-large 임베딩이 baseline 대비 F1 12.3% 향상.                  │
│                                                                         │
│  **생성/수정된 파일**                                                   │
│  • packages/embedding/src/voyage-embedder.ts (신규)                    │
│  • config/experiments/EXP-004.yaml (저장됨)                            │
│                                                                         │
│  ═══════════════════════════════════════════════════════════════════   │
│                                                                         │
│  🎯 Baseline 승격                                                       │
│  ┌───────────────────────────────────────────────────────────────┐     │
│  │  EXP-004가 현재 baseline보다 우수합니다.                        │     │
│  │                                                                │     │
│  │  승격 시 변경:                                                 │     │
│  │  • config/default.yaml 업데이트                               │     │
│  │    - embedding.model: "voyage-3-large"                        │     │
│  │    - embedding.dimensions: 1024                               │     │
│  │                                                                │     │
│  │       [✅ Baseline으로 승격]      [📁 결과만 저장]              │     │
│  └───────────────────────────────────────────────────────────────┘     │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

**Baseline 승격 로직:**

```typescript
async function promoteToBaseline(experimentId: string) {
  // 1. 실험 config 읽기
  const expConfig = await readYaml(`config/experiments/${experimentId}.yaml`);

  // 2. default.yaml 업데이트
  const baseline = await readYaml('config/default.yaml');

  // 변경된 설정 병합
  if (expConfig.embedding) baseline.embedding = expConfig.embedding;
  if (expConfig.chunking) baseline.chunking = expConfig.chunking;
  if (expConfig.retrieval) baseline.retrieval = expConfig.retrieval;

  // 메타데이터 업데이트
  baseline.metadata.baseline = true;
  baseline.metadata.promoted_from = experimentId;
  baseline.metadata.promoted_at = new Date().toISOString();
  baseline.metadata.f1_score = expConfig.results.f1;

  // 3. 저장
  await writeYaml('config/default.yaml', baseline);

  // 4. 실험 yaml에 승격 표시
  expConfig.metadata.promoted_to_baseline = true;
  await writeYaml(`config/experiments/${experimentId}.yaml`, expConfig);
}
```

---

## 4. Sidebar: Experiment History

**UI 구성:**

```
┌────────────────────────┐
│  📚 실험 히스토리       │
│  ─────────────────────│
│                        │
│  ⭐ Baseline           │
│     F1: 65.9%          │
│     text-embedding-3   │
│                        │
│  ─────────────────────│
│                        │
│  📄 EXP-004 (latest)   │
│     F1: 78.2%          │
│     +12.3% vs base     │
│     [진행중...]         │
│                        │
│  📄 EXP-003            │
│     F1: 92.3%          │
│     +26.4% vs base     │
│                        │
│  📄 EXP-002            │
│     F1: 4.8%           │
│     -61.1% vs base     │
│                        │
│  ─────────────────────│
│  [+ 새 실험]           │
└────────────────────────┘
```

**기능:**

- 모든 실험 히스토리 표시
- Baseline 대비 성능 비교
- 클릭 시 해당 실험 상세 보기
- 진행 중인 실험 상태 표시

---

## 5. Data Models

### 5.1 Experiment Config (YAML)

```yaml
# config/experiments/EXP-004.yaml

name: 'EXP-004: Voyage Embedding'
description: |
  voyage-3-large 임베딩으로 baseline 대비 성능 테스트

created_at: '2024-11-26'
status: 'completed' # draft | approved | running | completed | failed

# 소스 문서
sources:
  - 'docs/research/papers/voyage-3-large.md'
  - 'docs/research/papers/enhancing-rag-best-practices.md'

# 가설
hypothesis: 'voyage-3-large가 text-embedding-3-small 대비 F1 10% 이상 향상'

# 실험 단계
steps:
  - order: 1
    description: 'voyage-embedder.ts 구현'
    status: 'completed'
    output: 'Created packages/embedding/src/voyage-embedder.ts'

  - order: 2
    description: 'API 연동 테스트'
    status: 'completed'
    output: 'API 연결 성공'

  - order: 3
    description: '임베딩 생성'
    status: 'completed'
    output: '100 documents embedded'

  - order: 4
    description: 'F1 측정'
    status: 'completed'
    output: 'F1: 78.2%'

  - order: 5
    description: 'Baseline 비교'
    status: 'completed'
    output: '+12.3% vs baseline'

# 설정 변경
embedding:
  model: 'voyage-3-large'
  dimensions: 1024
  batchSize: 100

# 결과
results:
  f1: 0.782
  precision: 0.821
  recall: 0.748

  comparison:
    baseline_f1: 0.659
    diff: '+12.3%'
    hypothesis_verified: true

# 생성된 파일
artifacts:
  - path: 'packages/embedding/src/voyage-embedder.ts'
    type: 'created'
  - path: 'config/experiments/EXP-004.yaml'
    type: 'created'

# 메타데이터
metadata:
  baseline: false
  promoted_to_baseline: false
  git_commit: 'abc123'
  execution_time: '15m 32s'
  paper_ids:
    - 'voyage-3-large'
    - 'enhancing-rag-best-practices'
```

### 5.2 TypeScript Types

```typescript
// types/experiment.ts

export type ExperimentStatus = 'draft' | 'approved' | 'running' | 'completed' | 'failed';

export type StepStatus = 'pending' | 'running' | 'completed' | 'failed';

export interface ExperimentStep {
  order: number;
  description: string;
  status: StepStatus;
  output?: string;
  startedAt?: string;
  completedAt?: string;
}

export interface ExperimentResults {
  f1: number;
  precision: number;
  recall: number;
  comparison: {
    baseline_f1: number;
    diff: string;
    hypothesis_verified: boolean;
  };
}

export interface ExperimentArtifact {
  path: string;
  type: 'created' | 'modified' | 'deleted';
}

export interface Experiment {
  id: string;
  name: string;
  description: string;
  created_at: string;
  status: ExperimentStatus;

  sources: string[];
  hypothesis: string;
  steps: ExperimentStep[];

  embedding?: EmbeddingConfig;
  chunking?: ChunkingConfig;
  retrieval?: RetrievalConfig;

  results?: ExperimentResults;
  artifacts?: ExperimentArtifact[];

  metadata: {
    baseline: boolean;
    promoted_to_baseline: boolean;
    git_commit?: string;
    execution_time?: string;
    paper_ids: string[];
  };
}

export interface ExperimentListItem {
  id: string;
  name: string;
  status: ExperimentStatus;
  f1?: number;
  diff_vs_baseline?: string;
  created_at: string;
}
```

---

## 6. API Specification

### 6.1 POST /api/experiments/plan

**Request:**

```typescript
{
  sources: string[];      // 파일 경로 배열
  intent: string;         // 실험 의도
  compareWith: string[];  // 비교 대상 실험 ID
}
```

**Response:**

```typescript
{
  experimentId: string;
  plan: Experiment; // 생성된 계획 (status: 'draft')
}
```

### 6.2 POST /api/experiments/plan/:id/feedback

**Request:**

```typescript
{
  feedback: string; // AI에게 전달할 피드백
}
```

**Response:**

```typescript
{
  plan: Experiment; // 수정된 계획
}
```

### 6.3 PUT /api/experiments/plan/:id

**Request:**

```typescript
{
  hypothesis?: string;
  steps?: ExperimentStep[];
  embedding?: Partial<EmbeddingConfig>;
  // ... 직접 편집한 필드들
}
```

**Response:**

```typescript
{
  plan: Experiment; // 업데이트된 계획
}
```

### 6.4 POST /api/experiments/execute/:id

**Request:** (no body)

**Response:** SSE Stream

```
data: {"type":"step_start","step":1,"description":"voyage-embedder.ts 구현"}

data: {"type":"output","content":"Creating file..."}

data: {"type":"step_complete","step":1,"output":"Created voyage-embedder.ts"}

data: {"type":"step_start","step":2,"description":"API 연동 테스트"}

...

data: {"type":"complete","results":{"f1":0.782,"precision":0.821,"recall":0.748}}
```

### 6.5 POST /api/baseline/promote

**Request:**

```typescript
{
  experimentId: string;
}
```

**Response:**

```typescript
{
  success: boolean;
  baseline: {
    previous_f1: number;
    new_f1: number;
    promoted_from: string;
  }
}
```

### 6.6 GET /api/experiments

**Response:**

```typescript
{
  experiments: ExperimentListItem[];
  baseline: {
    id: string;
    f1: number;
  };
}
```

---

## 7. Implementation Plan

### Phase 1: Foundation (Week 1)

- [ ] 프로젝트 구조 설정 (apps/demo/src/app/research)
- [ ] 타입 정의 (types/experiment.ts)
- [ ] Config 관리 유틸 (lib/config-manager.ts)
- [ ] Claude Code 실행 유틸 (lib/claude-executor.ts)

### Phase 2: Core UI (Week 2)

- [ ] ResearchLayout 컴포넌트
- [ ] InputPhase 컴포넌트
- [ ] ExperimentSidebar 컴포넌트
- [ ] 기본 라우팅 설정

### Phase 3: Plan & Review (Week 3)

- [ ] POST /api/experiments/plan API
- [ ] PlanPhase 컴포넌트
- [ ] PlanEditor (직접 편집)
- [ ] FeedbackInput (AI 피드백)

### Phase 4: Execution (Week 4)

- [ ] POST /api/experiments/execute API (SSE)
- [ ] ExecutePhase 컴포넌트
- [ ] ExecutionConsole 컴포넌트
- [ ] ProgressBar, StatusBadge

### Phase 5: Results & Promotion (Week 5)

- [ ] ResultPhase 컴포넌트
- [ ] ResultChart 컴포넌트
- [ ] BaselinePromote 컴포넌트
- [ ] POST /api/baseline/promote API

### Phase 6: Polish (Week 6)

- [ ] 에러 핸들링
- [ ] 로딩 상태
- [ ] 애니메이션 (Framer Motion)
- [ ] 반응형 디자인

---

## 8. Future Enhancements

### 8.1 Electron Wrapper

- 웹 버전 완성 후 Electron으로 래핑
- 네이티브 파일 시스템 접근 개선
- 메뉴바 통합

### 8.2 Multi-Agent Support

- autonomous-researcher의 Agent Swarm 모드 참고
- 복잡한 실험을 여러 단계로 분리 실행

### 8.3 Experiment Templates

- 자주 사용하는 실험 패턴 템플릿화
- "Embedding 비교", "Chunking 전략 비교" 등

### 8.4 Visualization Enhancement

- 실험 간 트렌드 차트
- 설정 변경 히스토리 타임라인
- A/B 테스트 결과 시각화

---

## Appendix: Reference

- [autonomous-researcher](https://github.com/mshumer/autonomous-researcher) - Matt Shumer
- [Claude Code Documentation](https://docs.anthropic.com/claude-code)
- 현재 프로젝트 구조: `config/`, `docs/research/experiments/`
