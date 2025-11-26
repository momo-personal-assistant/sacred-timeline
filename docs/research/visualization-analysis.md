# Experiments Visualization Analysis

## 📊 Current Data Structure

### Available Data Points

```typescript
interface Experiment {
  id: number;
  name: string;
  description: string;
  config: {
    embedding: { model; dimensions; batchSize };
    chunking: { strategy; maxChunkSize; overlap };
    retrieval: { similarityThreshold; chunkLimit };
    relationInference: { keywordOverlapThreshold; useSemanticSimilarity };
  };
  results: {
    f1_score: number; // 0-1 (primary metric)
    precision: number; // 0-1
    recall: number; // 0-1
    true_positives: number;
    false_positives: number;
    false_negatives: number;
    retrieval_time_ms: number;
  };
  is_baseline: boolean;
  created_at: string; // ISO timestamp
  git_commit: string | null;
  paper_ids: string[];
}
```

## 🎯 Visualization Goals

### 1. **Temporal Analysis** (가장 중요)

**질문:** 실험이 시간에 따라 개선되고 있는가?

**차트:** Performance Timeline (Line Chart)

- **X축:** created_at (날짜/시간)
- **Y축:** f1_score (0-100%)
- **라인:**
  - Baseline (점선)
  - Experiments (실선)
  - Precision/Recall (토글 가능)
- **인터랙션:**
  - 점 클릭 시 해당 실험 상세 보기
  - Hover 시 tooltip (name, config summary, scores)

**인사이트:**

- Week 1 → Week 2 성능 개선 추이
- 성능 회귀 감지 (갑자기 낮아진 경우)
- Baseline 대비 개선폭

**예시:**

```
100% ┤
 80% ┤     ●━━●━━━●━━━━●  (Experiments)
 60% ┤  ●┈┈┈┈┈┈┈┈┈┈┈┈┈┈●  (Baseline)
 40% ┤
 20% ┤
  0% ┼─────────────────────
     Jan 1  Jan 5  Jan 10
```

### 2. **Comparative Analysis**

**질문:** 모든 실험 중 어떤 것이 가장 좋은가?

**차트:** Experiments Comparison (Bar Chart)

- **X축:** Experiment names (최신순 or F1 score 순)
- **Y축:** Scores (0-100%)
- **막대:**
  - F1 Score (primary, blue)
  - Precision (gray, 토글)
  - Recall (gray, 토글)
- **색상:**
  - Best performer (green highlight)
  - Baseline (outlined)
  - Below threshold (red)

**인사이트:**

- 한눈에 best/worst performer 파악
- Baseline과 experiments 직접 비교
- 60% 이상/이하 시각적 구분

**예시:**

```
100% ┤     ▓
 80% ┤  ▓  ▓  ▓
 60% ┤  ▓  ▓  ▓  ▓
 40% ┤  ▓  ▓  ▓  ▓  ▓
 20% ┤  ▓  ▓  ▓  ▓  ▓
  0% ┼──────────────────
     E1 E2 E3 E4 E5
```

### 3. **Trade-off Analysis**

**질문:** Precision과 Recall 사이의 trade-off는?

**차트:** Precision-Recall Scatter

- **X축:** Precision (0-100%)
- **Y축:** Recall (0-100%)
- **점:** 각 실험
- **색상:**
  - F1 score gradient (높을수록 진한 파란색)
- **크기:** retrieval_time_ms (빠를수록 작은 점)
- **이상적 영역:** 오른쪽 위 (P=100%, R=100%)

**인사이트:**

- High precision, low recall → 보수적 (FP 적음)
- Low precision, high recall → 공격적 (FN 적음)
- Best: 오른쪽 위 + 빠른 속도

**예시:**

```
Recall
100% ┤         ●← ideal
 80% ┤      ●  ●
 60% ┤   ●  ●
 40% ┤ ●  ●
 20% ┤ ●
  0% ┼──────────────
     0  20 40 60 80 100%
             Precision
```

### 4. **Configuration Impact** (Optional, Phase 2)

**질문:** 어떤 config 조합이 최고인가?

**차트:** Configuration Heatmap

- **행:** embedding models (ada-002, text-embedding-3-small, etc.)
- **열:** chunking strategies (fixed, recursive, semantic)
- **셀 색상:** F1 score (높을수록 진한 색)
- **클릭:** 해당 조합의 실험들 필터링

**인사이트:**

- "text-embedding-3-large + recursive" 조합이 최고
- "ada-002 + fixed" 조합은 항상 낮음
- 특정 embedding은 chunking에 덜 민감

**예시:**

```
                fixed  recursive  semantic
ada-002         █░░    ██░░       ███░
text-embed-3s   ██░    ████       ███░
text-embed-3l   ███    █████      ████
```

## 🏗️ Implementation Plan

### Phase 1: Core Charts (Priority 1-2)

**Target:** 이번 세션에서 완료
**Charts:**

1. ✅ Performance Timeline (Line Chart) - 2시간
2. ✅ Experiments Comparison (Bar Chart) - 1시간
3. ✅ Precision-Recall Scatter - 1시간

**UI/UX:**

- Experiments Panel 상단에 "📊 Analytics" 토글 버튼
- 토글 시 차트 섹션 expand/collapse
- 각 차트는 Card 컴포넌트로 감싸기
- Mobile responsive (md: grid-cols-2, sm: grid-cols-1)

### Phase 2: Advanced Features (Optional)

**Target:** 나중에
**Features:**

- Configuration Heatmap
- Export charts as PNG/SVG
- Date range picker for timeline
- Multi-metric comparison toggle
- Animation on data update

## 📐 Design Specifications

### Colors (from globals.css)

```css
--chart-1: hsl(12, 76%, 61%) /* Primary - Blue */ --chart-2: hsl(173, 58%, 39%)
  /* Secondary - Teal */ --chart-3: hsl(197, 37%, 24%) /* Tertiary - Dark Blue */
  --chart-4: hsl(43, 74%, 66%) /* Warning - Yellow */ --chart-5: hsl(27, 87%, 67%)
  /* Danger - Orange */ Success: hsl(142, 76%, 36%) /* Green for best */
  Destructive: hsl(0, 84%, 60%) /* Red for poor */;
```

### Typography

- Chart Title: text-base font-semibold
- Axis Labels: text-xs text-muted-foreground
- Tooltips: text-sm
- Values: font-mono tabular-nums

### Spacing

- Chart container: aspect-video (16:9)
- Grid gaps: gap-4 (1rem)
- Card padding: p-4

## 🎨 Interactive Features

### 1. Timeline Chart

```typescript
onPointClick: (experiment) => setSelectedExperiment(experiment)
onHover: Show tooltip with name, config summary, scores
toggleMetrics: F1/Precision/Recall visibility
dateRange: Filter by time period
```

### 2. Bar Chart

```typescript
onBarClick: (experiment) => setSelectedExperiment(experiment)
sortBy: ['created_at', 'f1_score', 'name']
filterBy: baseline/experiments toggle
threshold: Show 60% baseline
```

### 3. Scatter Plot

```typescript
onPointClick: (experiment) => setSelectedExperiment(experiment)
quadrantLines: Show P=60%, R=60% dividers
colorBy: F1 score gradient
sizeBy: retrieval_time_ms
```

## 📊 Chart Library: Recharts

### Why Recharts?

✅ Already installed (2.15.4)
✅ shadcn/ui integration ready
✅ Declarative API (React components)
✅ Rich tooltip/legend support
✅ TypeScript support
✅ Active maintenance

### Key Components We'll Use

```typescript
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
```

## 🔄 Data Transformation

### Timeline Data

```typescript
const timelineData = experiments
  .filter((exp) => exp.results !== null)
  .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
  .map((exp) => ({
    date: format(new Date(exp.created_at), 'MMM dd'),
    f1: exp.results.f1_score * 100,
    precision: exp.results.precision * 100,
    recall: exp.results.recall * 100,
    name: exp.name,
    isBaseline: exp.is_baseline,
    experiment: exp, // full data for click
  }));
```

### Bar Chart Data

```typescript
const barData = experiments
  .filter((exp) => exp.results !== null)
  .sort((a, b) => b.results.f1_score - a.results.f1_score)
  .map((exp) => ({
    name: exp.name.length > 15 ? exp.name.slice(0, 12) + '...' : exp.name,
    f1: exp.results.f1_score * 100,
    precision: exp.results.precision * 100,
    recall: exp.results.recall * 100,
    fill: exp.is_baseline ? 'var(--chart-2)' : 'var(--chart-1)',
    experiment: exp,
  }));
```

### Scatter Data

```typescript
const scatterData = experiments
  .filter((exp) => exp.results !== null)
  .map((exp) => ({
    x: exp.results.precision * 100,
    y: exp.results.recall * 100,
    z: exp.results.retrieval_time_ms,
    f1: exp.results.f1_score,
    name: exp.name,
    experiment: exp,
  }));
```

## 🚀 Success Metrics

### User Impact

- ✅ Reduce experiment analysis time from 30min → 5min
- ✅ Identify best performer in < 10 seconds
- ✅ Spot performance regressions immediately
- ✅ Make data-driven config decisions

### Technical Quality

- ✅ Charts load in < 500ms
- ✅ Smooth interactions (60fps)
- ✅ Mobile responsive
- ✅ Accessible (keyboard nav, ARIA labels)
- ✅ TypeScript type safety

## 📝 Implementation Checklist

### Step 1: Create Chart Components

- [ ] `ExperimentTimelineChart.tsx` - Line chart for temporal analysis
- [ ] `ExperimentComparisonChart.tsx` - Bar chart for comparison
- [ ] `PrecisionRecallScatter.tsx` - Scatter plot for trade-offs

### Step 2: Integrate into ExperimentsPanel

- [ ] Add "📊 Show Analytics" toggle button
- [ ] Create collapsible chart section
- [ ] Pass experiments data to charts
- [ ] Handle chart click → select experiment

### Step 3: Polish

- [ ] Add loading states
- [ ] Add empty states ("No data to visualize")
- [ ] Add tooltips with rich info
- [ ] Test with real experiment data
- [ ] Responsive design testing

### Step 4: Documentation

- [ ] Add comments to chart components
- [ ] Update README with screenshots
- [ ] Add usage examples

## 🎓 Learning Resources

- Recharts docs: https://recharts.org/en-US/
- shadcn chart examples: Already in `chart-area-interactive.tsx`
- Color theory: Use consistent palette from globals.css
