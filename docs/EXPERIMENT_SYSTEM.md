# Experiment System

## Overview

이 시스템은 Meta/Google/Anthropic 등 대기업의 ML 연구 방식을 따릅니다.

**핵심 원칙**:

- 코드 수정 없이 실험 가능
- 모든 실험 자동 추적
- Git으로 실험 히스토리 관리
- 재현 가능한 실험

## System Architecture

```
config/
├── default.yaml              # 기본 설정 (현재 프로덕션)
├── templates/                # 실험 템플릿들
│   ├── chunking.yaml         # Chunk size/overlap 실험용
│   ├── embedding.yaml        # 임베딩 모델 변경용
│   ├── retrieval.yaml        # Retrieval 파라미터 조정용
│   └── hybrid.yaml           # Hybrid search 실험용
└── experiments/              # 실제 실행한 실험들
    ├── 2025-11-24-contextual-001.yaml
    ├── 2025-11-24-hybrid-002.yaml
    └── ...

scripts/
└── run-experiment.ts         # 실험 실행 스크립트
```

## How It Works

### 1. 설정 파일 구조

```yaml
# config/default.yaml
name: 'baseline'
description: 'Current production configuration'

embedding:
  model: 'text-embedding-3-small'
  provider: 'openai'
  chunk_size: 512
  chunk_overlap: 50
  strategy: 'semantic'

retrieval:
  similarity_threshold: 0.75
  keyword_overlap_threshold: 0.3
  top_k: 10

validation:
  run_on_save: true
  auto_save_experiment: false
```

### 2. 실험 실행

```bash
# 기본 설정으로 실행
pnpm run experiment

# 특정 실험 설정으로 실행
pnpm run experiment config/experiments/my-experiment.yaml

# 결과:
# - Chunks 재생성 (필요시)
# - Validation 실행
# - 결과 DB 저장
# - Activity feed 업데이트
```

### 3. 자동 추적

실험 실행 시 자동으로:

- 설정 파일 스냅샷 저장
- Git commit hash 기록
- Timestamp 기록
- F1/Precision/Recall 저장
- Paper IDs 연결 (있는 경우)

## Typical Workflow

### Case 1: 파라미터 튜닝

```bash
# 1. 템플릿 복사
cp config/templates/chunking.yaml config/experiments/exp-001.yaml

# 2. 설정 수정
vim config/experiments/exp-001.yaml
# chunk_size: 512 → 768

# 3. 실행
pnpm run experiment config/experiments/exp-001.yaml

# 4. 결과 확인
# - Activity 탭에서 실시간 확인
# - Experiments 탭에서 비교
```

### Case 2: 여러 실험 비교

```bash
# 실험 1
pnpm run experiment config/experiments/chunk-512.yaml

# 실험 2
pnpm run experiment config/experiments/chunk-768.yaml

# 실험 3
pnpm run experiment config/experiments/chunk-1024.yaml

# Experiments 탭에서 3개 비교
# → 베스트 선택 → production 반영
```

### Case 3: Paper 구현

```bash
# 1. Paper summary 읽기
cat docs/research/papers/summaries/001-contextual-retrieval.md

# 2. 실험 설정 작성
cat > config/experiments/paper-001.yaml << EOF
name: "Contextual Retrieval (Paper 001)"
paper_ids: ["001"]

embedding:
  strategy: "contextual"
  add_document_context: true
  chunk_size: 512
EOF

# 3. 실행
pnpm run experiment config/experiments/paper-001.yaml

# 4. 자동으로:
# - Paper status 업데이트 (📋 → 🧪)
# - Experiment-paper 링크 생성
# - Activity feed에 기록
```

## Configuration Reference

### Embedding Section

```yaml
embedding:
  model: 'text-embedding-3-small' # 모델명
  provider: 'openai' # openai | voyageai | cohere
  chunk_size: 512 # 청크 크기
  chunk_overlap: 50 # 청크 오버랩
  strategy: 'semantic' # semantic | fixed | contextual
```

### Retrieval Section

```yaml
retrieval:
  similarity_threshold: 0.75 # 벡터 유사도 임계값
  keyword_overlap_threshold: 0.3 # 키워드 오버랩 임계값
  top_k: 10 # 상위 K개 결과
  hybrid_search: false # Hybrid search 활성화
  bm25_weight: 0.3 # BM25 가중치 (hybrid 시)
  vector_weight: 0.7 # Vector 가중치 (hybrid 시)
```

### Validation Section

```yaml
validation:
  run_on_save: true # 실험 후 자동 validation
  auto_save_experiment: false # 자동으로 DB 저장 (보통 false)
```

## Benefits

### Before (코드 수정 방식)

```
실험 1회 = 5-10분
- chunker.ts 파일 열기
- 숫자 수정
- 저장
- embed-chunks.ts 실행
- validate-relations.ts 실행
- 결과 수기 기록
```

### After (Config 방식)

```
실험 1회 = 30초
- YAML 파일 수정
- pnpm run experiment
- 모든 것 자동 처리
```

### Advantages

1. **속도**: 10배 빠른 iteration
2. **추적**: Git으로 모든 실험 기록
3. **재현**: 언제든 정확한 재현 가능
4. **협업**: 설정 파일 공유로 협업 용이
5. **표준**: Meta/Google이 쓰는 업계 표준 방식

## Advanced Usage

### Parameter Sweeps (나중에 구현)

```yaml
# config/sweeps/chunking-sweep.yaml
name: "Chunking Parameter Sweep"

sweep:
  chunk_size: [256, 512, 768, 1024]
  chunk_overlap: [25, 50, 75, 100]

# 실행: 4 x 4 = 16개 실험 자동 실행
pnpm run sweep config/sweeps/chunking-sweep.yaml
```

### Experiment Comparison (나중에 구현)

```bash
# 두 실험 비교
pnpm run compare exp-001 exp-002

# 출력:
# ┌──────────┬─────────┬─────────┬────────┐
# │ Metric   │ Exp-001 │ Exp-002 │ Delta  │
# ├──────────┼─────────┼─────────┼────────┤
# │ F1       │ 0.723   │ 0.756   │ +3.3%  │
# │ ...      │ ...     │ ...     │ ...    │
# └──────────┴─────────┴─────────┴────────┘
```

## Integration with Papers System

Paper 분석 → 실험 → 검증 → 프로덕션 전체 흐름이 연결됩니다:

```
1. /analyze-papers
   → summaries/001-paper.md 생성

2. Summary 읽고 실험 설정 작성
   → config/experiments/paper-001.yaml

3. 실험 실행
   → pnpm run experiment config/experiments/paper-001.yaml

4. Activity 탭에서 결과 확인
   → F1 score 개선 확인

5. Experiments 탭에서 베스트 선택
   → config/default.yaml 업데이트

6. Git commit
   → git commit -m "Apply paper 001: F1 65.9% → 75.2%"
```

## Best Practices

### 1. 실험 명명 규칙

```
config/experiments/YYYY-MM-DD-description-NNN.yaml
예: 2025-11-24-contextual-chunking-001.yaml
```

### 2. Git Workflow

```bash
# 실험 전
git add config/experiments/exp-001.yaml
git commit -m "Add experiment: chunk size 768"

# 실험 후
git add config/experiments/exp-001.yaml  # 결과 포함
git commit -m "Exp 001 results: F1 68.2%"

# 좋은 실험이면
cp config/experiments/exp-001.yaml config/default.yaml
git commit -m "Adopt exp 001 as baseline"
```

### 3. 점진적 개선

```
Week 1: Baseline (F1 65.9%)
Week 2: Chunking 실험 → 68.2% (exp-001)
Week 3: Hybrid search → 72.1% (exp-005)
Week 4: Contextual retrieval → 75.8% (exp-012)
```

## FAQ

**Q: 복잡한 알고리즘 변경도 YAML로 가능한가?**
A: 아니요. 새로운 알고리즘은 코드로 구현 필요. Config는 파라미터 조정용.

**Q: Playground UI는 언제 만드나?**
A: Config 시스템이 안정화된 후. UI는 Config 위에 wrapper.

**Q: 기존 실험들은?**
A: Experiments 테이블 그대로 사용. Config는 추가 기능.

**Q: 다른 팀원도 사용 가능한가?**
A: 네. YAML 파일만 수정하면 됨. 코드 지식 불필요.

## Next Steps

1. **Phase 1** (현재): Config 시스템 구축
2. **Phase 2**: Parameter sweeps 자동화
3. **Phase 3**: Experiment 비교 도구
4. **Phase 4**: (선택) Playground UI 추가
