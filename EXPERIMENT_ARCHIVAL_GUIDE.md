# Experiment Archival Guide

## 📋 개요

이전 실험들을 정리하여 UI를 깔끔하게 유지하면서도 히스토리는 보존하는 시스템입니다.

## 🎯 Archival 전략

### Keep Visible (보존)

```
#29: baseline (28.3%) - 베이스라인 ⭐
#52: threshold-0.30 (43.6%) - 최적 threshold
#56: stage-2-project-metadata (86.1%) - 최고 성능 ⭐
#25: 2025-11-24-hybrid-search (53.3%)
```

### Archive (숨김)

```
실패한 실험 (F1 < 10%):
  #20: EXP-001: Semantic Hash (9.1%)
  #21: EXP-002: Contrastive ICL (4.8%)
  #45: slack-integration-baseline (0.9%)
  #47: threshold-0.5 (2.0%)
  #48: exp-004-hybrid (0%)
  #49: exp-004b-balanced (1.7%)

중복 Threshold 실험:
  #53: threshold-0.31 (41.1%)
  #54: threshold-0.32 (35.5%)
  #55: threshold-0.33 (32.9%)
```

## 🚀 실행 방법

### 1. 스크립트 실행

```bash
# 실험 아카이브 스크립트 실행
npx tsx scripts/archive-old-experiments.ts
```

**이 스크립트가 하는 일:**

1. ✅ `archived` 컬럼을 DB에 추가 (없으면)
2. ✅ 선택된 실험들을 `archived = true`로 마킹
3. ✅ `docs/experiments/archived/OLD-EXPERIMENTS-SUMMARY.md` 생성
4. ✅ 각 실험의 결과와 교훈을 요약 문서에 포함

### 2. API 변경사항

**이미 적용됨:**

- GET `/api/experiments` - 기본적으로 archived 실험 제외
- GET `/api/experiments?archived=true` - archived 실험 포함

### 3. 확인

```bash
# 아카이브 전 실험 개수
curl -s http://localhost:3001/api/experiments | jq '.total'
# 예상: 14개

# 아카이브 실행
npx tsx scripts/archive-old-experiments.ts

# 아카이브 후 실험 개수
curl -s http://localhost:3001/api/experiments | jq '.total'
# 예상: 4개 (baseline, threshold-0.30, stage-2-project-metadata, hybrid-search)

# 아카이브된 실험 보기
curl -s "http://localhost:3001/api/experiments?archived=true" | jq '.total'
# 예상: 14개 (전체)
```

## 📁 생성되는 문서

### `docs/experiments/archived/OLD-EXPERIMENTS-SUMMARY.md`

```markdown
# Old Experiments Summary

## 🗂️ Archived Experiments

| ID  | Name                       | F1 Score | Reason            |
| --- | -------------------------- | -------- | ----------------- |
| 20  | EXP-001: Semantic Hash     | 9.1%     | Exploratory phase |
| 21  | EXP-002: Contrastive ICL   | 4.8%     | Exploratory phase |
| 45  | slack-integration-baseline | 0.9%     | Failed experiment |
| ... | ...                        | ...      | ...               |

## 💡 Key Learnings

### Failed Approaches

1. **Pure Semantic Similarity** - Lesson: Need project context
2. **Wrong Thresholds** - Lesson: 0.30 is optimal

### What Worked

- Project metadata signal → 86.1% F1 ✅
```

## 🔄 앞으로의 워크플로우

### 새 실험 생성 시:

1. **Plan 문서 작성** (`plans/`)

   ```bash
   cp docs/experiments/templates/experiment-template.md \
      docs/experiments/plans/EXP-007-my-new-idea.md
   ```

2. **실험 실행**

   ```bash
   npm run experiment -- --config config/experiments/exp-007.yaml
   ```

3. **결과 문서화** (`completed/` or `rejected/`)
   - Stage별로 분리 가능 (EXP-007-STAGE-1, EXP-007-STAGE-2...)
   - 완료되면 `completed/`로 이동
   - 실패하면 `rejected/`로 이동 + 이유 작성

4. **이전 실험 정리**
   - 중간 tuning 실험들은 주기적으로 archive
   - 최종 결과만 UI에 보이도록 유지

## 🎨 UI 변경사항 (선택사항)

### Option 1: 토글 버튼 추가

```tsx
<Button onClick={() => setShowArchived(!showArchived)}>
  {showArchived ? 'Hide Archived' : 'Show Archived'}
</Button>
```

### Option 2: 필터 드롭다운

```tsx
<Select value={filter} onValueChange={setFilter}>
  <SelectOption value="active">Active Only</SelectOption>
  <SelectOption value="all">Include Archived</SelectOption>
</Select>
```

현재는 **API 레벨에서 자동 필터링**되므로 UI 변경 없이도 작동합니다.

## ✅ 체크리스트

- [ ] 스크립트 실행: `npx tsx scripts/archive-old-experiments.ts`
- [ ] DB 확인: `archived` 컬럼 추가됨
- [ ] Summary 문서 확인: `docs/experiments/archived/OLD-EXPERIMENTS-SUMMARY.md`
- [ ] API 테스트: archived 실험이 기본 리스트에서 제외됨
- [ ] UI 확인: 4개의 주요 실험만 사이드바에 표시
- [ ] (Optional) README 업데이트

## 🔗 관련 문서

- [Experiment Documentation Structure](./docs/experiments/README.md)
- [Experiment Template](./docs/experiments/templates/experiment-template.md)
- [EXP-006 Multi-Signal Fusion Plan](./docs/experiments/plans/EXP-006-multi-signal-fusion-plan.md)

---

**Last Updated**: 2025-11-27
**Status**: Ready to Execute
