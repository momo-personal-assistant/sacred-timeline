# ML 실험 품질 보장 가이드

> 현업 AI/ML 엔지니어 관점에서의 실험 방법론 Best Practices

## 목차

1. [통계적 유의성 검증](#1-통계적-유의성-검증)
2. [재현성(Reproducibility) 보장](#2-재현성reproducibility-보장)
3. [데이터셋 관리 및 Data Leakage 방지](#3-데이터셋-관리-및-data-leakage-방지)
4. [Multi-Objective 평가 프레임워크](#4-multi-objective-평가-프레임워크)
5. [Ablation Study 설계](#5-ablation-study-설계)
6. [Production 배포 및 Rollback 전략](#6-production-배포-및-rollback-전략)
7. [실패한 실험에서 학습하기](#7-실패한-실험에서-학습하기)
8. [종합 체크리스트](#8-종합-체크리스트)

---

## 1. 통계적 유의성 검증

### 1.1 왜 중요한가?

단일 실험 결과로 "F1 78.2% vs 65.9% = 12.3% 향상"이라고 결론내리면, 이 차이가 **실제 개선인지 우연에 의한 노이즈인지** 구분할 수 없습니다. 현업에서는 반드시 통계적 유의성을 검증합니다.

### 1.2 Bootstrap Confidence Interval 방법

[Bootstrap](<https://en.wikipedia.org/wiki/Bootstrapping_(statistics)>)은 데이터 분포에 대한 가정 없이 신뢰구간을 추정하는 강력한 방법입니다.

```python
import numpy as np

def bootstrap_compare(model_a_scores, model_b_scores, n_bootstrap=1000):
    """
    두 모델의 성능 차이에 대한 Bootstrap 신뢰구간 계산

    참고: https://stats.stackexchange.com/questions/639334/
    """
    diffs = []
    n = len(model_a_scores)

    for _ in range(n_bootstrap):
        # 복원 추출 (resampling with replacement)
        indices = np.random.choice(n, size=n, replace=True)
        diff = np.mean(model_a_scores[indices]) - np.mean(model_b_scores[indices])
        diffs.append(diff)

    # 95% 신뢰구간
    ci_lower = np.percentile(diffs, 2.5)
    ci_upper = np.percentile(diffs, 97.5)

    # 0이 신뢰구간에 포함되지 않으면 유의미한 차이
    is_significant = ci_lower > 0 or ci_upper < 0

    return {
        'mean_diff': np.mean(diffs),
        'ci_95': (ci_lower, ci_upper),
        'is_significant': is_significant,
        'interpretation': '유의미한 차이' if is_significant else '우연일 가능성'
    }

# 사용 예시
result = bootstrap_compare(new_model_f1_scores, baseline_f1_scores)
print(f"평균 차이: {result['mean_diff']:.3f}")
print(f"95% CI: [{result['ci_95'][0]:.3f}, {result['ci_95'][1]:.3f}]")
print(f"결론: {result['interpretation']}")
```

**핵심 원칙:**

- 최소 **n=1000 bootstrap 샘플** 사용
- **95% CI에 0이 포함되지 않으면** 유의미한 차이로 판단
- [Facebook의 오픈소스 bootstrapped 라이브러리](https://github.com/facebookarchive/bootstrapped) 활용 가능

### 1.3 반복 실험 프로토콜

```yaml
# experiment_config.yaml
experiment:
  # 최소 반복 횟수
  min_runs: 5

  # 고정된 시드 목록 (재현성 + 분산 측정)
  random_seeds: [42, 123, 456, 789, 1011]

  # 리포팅 형식
  reporting:
    format: 'mean ± std'
    confidence_level: 0.95

  # 유의성 판단 기준
  significance:
    method: 'bootstrap_ci' # 또는 "paired_t_test"
    threshold: 0.05
```

### 1.4 올바른 리포팅 형식

```markdown
# 잘못된 리포팅

"F1: 78.2% (12.3% 향상)"

# 올바른 리포팅

"F1: 78.2% ± 1.3% (n=5 runs)
95% CI: [76.9%, 79.5%]
Baseline 대비: +12.3% ± 0.8%
Bootstrap p-value: < 0.01
결론: 통계적으로 유의미한 개선"
```

**참고 자료:**

- [Bootstrap for A/B Testing - Getir Engineering](https://medium.com/getir/bootstrapping-for-a-b-testing-893f01fa6700)
- [Spotify - Comparing Quantiles at Scale](https://engineering.atspotify.com/2022/03/comparing-quantiles-at-scale-in-online-a-b-testing)
- [ML Evaluation with Bootstrap](https://gpttutorpro.com/machine-learning-evaluation-mastery-how-to-use-bootstrap-for-model-evaluation-and-comparison/)

---

## 2. 재현성(Reproducibility) 보장

### 2.1 재현성 위기

[2024년 연구](https://onlinelibrary.wiley.com/doi/10.1002/aaai.70002)에 따르면, ML 연구의 재현성 문제는 심각한 수준입니다:

- 코드가 공유되어도 불완전하거나 문서화가 부족한 경우가 많음
- Random seed만 고정해서는 완전한 재현이 불가능
- GPU 하드웨어 차이도 결과에 영향

### 2.2 Random Seed 관리의 5계층

ML 실험에서 비결정성의 원인은 다층적입니다.

```python
import random
import numpy as np
import torch
import os

def set_all_seeds(seed: int):
    """
    모든 레벨의 시드 고정

    참고: https://neptune.ai/blog/how-to-solve-reproducibility-in-ml
    """
    # 1. Python random
    random.seed(seed)

    # 2. NumPy
    np.random.seed(seed)

    # 3. PyTorch CPU
    torch.manual_seed(seed)

    # 4. PyTorch GPU (모든 GPU)
    torch.cuda.manual_seed_all(seed)

    # 5. cuDNN 결정적 모드
    torch.backends.cudnn.deterministic = True
    torch.backends.cudnn.benchmark = False

    # 6. Python hash seed
    os.environ['PYTHONHASHSEED'] = str(seed)

    # TensorFlow 사용 시
    # tf.random.set_seed(seed)

# 실험 시작 시 호출
set_all_seeds(42)
```

**주의사항:**

- GPU 하드웨어가 다르면 같은 시드라도 결과가 달라질 수 있음 ([연구 결과](https://www.osti.gov/servlets/purl/2003351))
- Multi-threading도 비결정성의 원인
- 프레임워크 버전 차이도 결과에 영향

### 2.3 환경 버전 관리

```yaml
# experiment_environment.yaml
environment:
  # Python 버전
  python_version: '3.11.4'

  # CUDA 버전
  cuda_version: '12.1'
  cudnn_version: '8.9.0'

  # 핵심 라이브러리 버전
  dependencies:
    torch: '2.1.0'
    transformers: '4.35.0'
    sentence-transformers: '2.2.2'
    numpy: '1.24.3'
    scikit-learn: '1.3.0'

  # 하드웨어 정보
  hardware:
    gpu_model: 'NVIDIA A100-SXM4-80GB'
    gpu_count: 1
    cpu: 'AMD EPYC 7742'
    ram_gb: 256

  # Docker 이미지 (완전한 재현용)
  docker:
    image: 'myorg/ml-research:v1.2.3'
    dockerfile_hash: 'sha256:abc123...'
```

### 2.4 ML 재현성의 5대 핵심 요소

[2024년 연구](https://onlinelibrary.wiley.com/doi/10.1002/aaai.70002)에서 19개 ML 도구를 분석한 결과, 5가지 핵심 요소가 도출되었습니다:

| 요소                   | 설명                | 도구 예시         |
| ---------------------- | ------------------- | ----------------- |
| **Code Versioning**    | 코드 버전 관리      | Git               |
| **Data Access**        | 데이터 접근 및 공유 | S3, GCS           |
| **Data Versioning**    | 데이터 버전 관리    | DVC, LakeFS       |
| **Experiment Logging** | 실험 기록           | MLflow, W&B       |
| **Pipeline Creation**  | 파이프라인 정의     | Kubeflow, Airflow |

### 2.5 실험 추적 도구 비교

| 도구                                      | 강점                  | 약점                | 추천 상황            |
| ----------------------------------------- | --------------------- | ------------------- | -------------------- |
| **[MLflow](https://mlflow.org/)**         | 오픈소스, 자체 호스팅 | UI가 기본적         | 사내 인프라 선호     |
| **[Weights & Biases](https://wandb.ai/)** | 뛰어난 시각화, 협업   | 유료, 클라우드 의존 | 딥러닝 연구팀        |
| **[DVC](https://dvc.org/)**               | Git 워크플로우 통합   | 학습 곡선           | 데이터 중심 프로젝트 |
| **[Neptune](https://neptune.ai/)**        | 메타데이터 관리       | 설정 복잡           | 대규모 실험          |
| **[Comet](https://www.comet.com/)**       | 실시간 모니터링       | 기능 중복           | 빠른 반복 개발       |

**참고 자료:**

- [DagShub - Best Experiment Tracking Tools 2024](https://dagshub.com/blog/best-8-experiment-tracking-tools-for-machine-learning-2023/)
- [DataCamp - Top MLOps Tools 2025](https://www.datacamp.com/blog/top-mlops-tools)
- [Neptune.ai - DVC Alternatives](https://neptune.ai/blog/dvc-alternatives-for-experiment-tracking)

---

## 3. 데이터셋 관리 및 Data Leakage 방지

### 3.1 Data Leakage의 심각성

[2023년 리뷰](<https://en.wikipedia.org/wiki/Leakage_(machine_learning)>)에 따르면, Data leakage가 **17개 분야 294개 학술 논문**에 영향을 미쳤습니다. 이는 재현성 위기의 주요 원인 중 하나입니다.

> "Data leakage is a widespread failure mode in machine-learning (ML)-based science"

### 3.2 Data Leakage의 유형

| 유형                         | 설명                             | 예시                       |
| ---------------------------- | -------------------------------- | -------------------------- |
| **Target Leakage**           | 예측 시점에 알 수 없는 정보 사용 | 미래 데이터로 과거 예측    |
| **Train-Test Contamination** | 테스트 데이터가 훈련에 노출      | 전처리 전 스케일링         |
| **Group Leakage**            | 같은 그룹이 train/test에 분산    | 같은 환자의 X-ray가 양쪽에 |
| **Temporal Leakage**         | 시계열에서 미래 정보 사용        | 랜덤 분할된 시계열         |
| **Duplicate Leakage**        | 중복 샘플이 양쪽에 존재          | 데이터 증강 후 분할        |

### 3.3 3-Way Split 전략

```
전체 데이터셋
      │
      ├─────────────────────────────────────────┐
      │                                          │
      ▼                                          │
┌──────────┐     ┌──────────┐     ┌──────────┐  │
│  Train   │     │Validation│     │   Test   │  │
│  (70%)   │     │  (15%)   │     │  (15%)   │  │
└────┬─────┘     └────┬─────┘     └────┬─────┘  │
     │                │                │         │
     ▼                ▼                │         │
  모델 학습      하이퍼파라미터        │         │
                   튜닝              │         │
                                     │         │
                                     ▼         │
                              최종 평가에만     │
                                 사용!        │
                                     │         │
                              ◀──────┘         │
                           (개발 중 절대 보지 않음)
```

### 3.4 올바른 전처리 순서

```python
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler

# 1. 먼저 데이터 분할
X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, random_state=42
)

# 2. Train 데이터에서만 scaler fit
scaler = StandardScaler()
X_train_scaled = scaler.fit_transform(X_train)  # fit + transform

# 3. Test 데이터는 transform만 (fit 하지 않음!)
X_test_scaled = scaler.transform(X_test)  # transform only

# ❌ 잘못된 방법
# scaler.fit(X)  # 전체 데이터로 fit하면 leakage!
# X_train_scaled = scaler.transform(X_train)
# X_test_scaled = scaler.transform(X_test)
```

### 3.5 시계열 데이터 분할

```python
# ❌ 잘못된 방법: 랜덤 분할
train, test = train_test_split(timeseries_data, random_state=42)

# ✅ 올바른 방법: 시간순 분할
train = timeseries_data[timeseries_data['date'] < '2024-01-01']
test = timeseries_data[timeseries_data['date'] >= '2024-01-01']

# 또는 TimeSeriesSplit 사용
from sklearn.model_selection import TimeSeriesSplit
tscv = TimeSeriesSplit(n_splits=5)
for train_idx, test_idx in tscv.split(X):
    X_train, X_test = X[train_idx], X[test_idx]
```

### 3.6 Group K-Fold Cross-Validation

동일 그룹(사용자, 환자, 세션 등)이 train/test에 분산되면 leakage가 발생합니다.

```python
from sklearn.model_selection import GroupKFold

# 환자 ID 기준으로 분할 (같은 환자는 같은 fold에만)
gkf = GroupKFold(n_splits=5)

for fold, (train_idx, test_idx) in enumerate(gkf.split(X, y, groups=patient_ids)):
    X_train, X_test = X[train_idx], X[test_idx]
    y_train, y_test = y[train_idx], y[test_idx]

    # 각 fold에서 환자는 train 또는 test 중 하나에만 존재
    train_patients = set(patient_ids[train_idx])
    test_patients = set(patient_ids[test_idx])

    assert train_patients.isdisjoint(test_patients), "Leakage detected!"
```

### 3.7 Data Leakage 감지 체크리스트

```markdown
## 실험 전 체크리스트

□ 전처리(scaling, imputation)가 split 후에 수행되는가?
□ Feature engineering에 target 정보가 사용되지 않았는가?
□ 시계열 데이터가 시간순으로 분할되었는가?
□ 동일 그룹(사용자, 세션)이 train/test에 분산되지 않았는가?
□ 중복 샘플이 여러 split에 존재하지 않는가?
□ 데이터 증강이 split 후에 수행되는가?

## 실험 후 이상 징후

□ Train accuracy와 Test accuracy 차이가 비정상적으로 큰가? (>20%)
□ Test accuracy가 비현실적으로 높은가? (>99%)
□ Cross-validation 결과가 일관적이지 않은가?
□ Feature importance에 예상치 못한 변수가 상위에 있는가?
```

**참고 자료:**

- [IBM - Data Leakage in Machine Learning](https://www.ibm.com/think/topics/data-leakage-machine-learning)
- [AWS - Splits and Data Leakage](https://docs.aws.amazon.com/prescriptive-guidance/latest/ml-operations-planning/splits-leakage.html)
- [Machine Learning Mastery - Data Preparation without Leakage](https://machinelearningmastery.com/data-preparation-without-data-leakage/)
- [Analytics Vidhya - Data Leakage Effects](https://www.analyticsvidhya.com/blog/2021/07/data-leakage-and-its-effect-on-the-performance-of-an-ml-model/)

---

## 4. Multi-Objective 평가 프레임워크

### 4.1 단일 메트릭의 위험성

F1 Score만으로 모델을 평가하면:

- Precision 90%, Recall 20%인 모델도 baseline이 될 수 있음
- Latency가 10배 느려도 감지하지 못함
- 비용이 급증해도 알 수 없음

### 4.2 RAG 시스템용: RAGAS Framework

[RAGAS](https://docs.ragas.io/)는 RAG 시스템 평가의 사실상 표준입니다 ([EACL 2024 논문](https://aclanthology.org/2024.eacl-demo.16/)).

| 지표                  | 측정 대상   | Ground Truth 필요? | 계산 방법                                | 목표  |
| --------------------- | ----------- | ------------------ | ---------------------------------------- | ----- |
| **Faithfulness**      | 환각 여부   | 아니오             | 답변의 주장이 컨텍스트로 뒷받침되는 비율 | >0.90 |
| **Answer Relevancy**  | 답변 관련성 | 아니오             | 질문-답변 임베딩 유사도                  | >0.85 |
| **Context Precision** | 검색 정밀도 | 예                 | top-k 중 관련 문서 비율                  | >0.85 |
| **Context Recall**    | 검색 재현율 | 예                 | 필요 정보 중 검색된 비율                 | >0.90 |

```python
from ragas import evaluate
from ragas.metrics import (
    faithfulness,
    answer_relevancy,
    context_precision,
    context_recall
)
from datasets import Dataset

# 평가 데이터 준비
eval_data = {
    "question": ["질문1", "질문2"],
    "answer": ["답변1", "답변2"],
    "contexts": [["컨텍스트1"], ["컨텍스트2"]],
    "ground_truth": ["정답1", "정답2"]  # Context metrics에만 필요
}
dataset = Dataset.from_dict(eval_data)

# Ground Truth 없이 평가 가능한 지표
results = evaluate(
    dataset,
    metrics=[faithfulness, answer_relevancy]
)

print(f"Faithfulness: {results['faithfulness']:.3f}")
print(f"Answer Relevancy: {results['answer_relevancy']:.3f}")
```

### 4.3 Production 환경 Multi-Objective 매트릭스

```yaml
# evaluation_matrix.yaml
evaluation:
  # 품질 지표 (Quality) - 40%
  quality:
    f1_score:
      threshold: '>0.75'
      weight: 0.15
      alert_below: 0.70
    faithfulness:
      threshold: '>0.90'
      weight: 0.15
      alert_below: 0.85
    answer_relevancy:
      threshold: '>0.85'
      weight: 0.10
      alert_below: 0.80

  # 성능 지표 (Performance) - 35%
  performance:
    latency_p50_ms:
      threshold: '<100'
      weight: 0.10
      alert_above: 150
    latency_p95_ms:
      threshold: '<300'
      weight: 0.10
      alert_above: 450
    latency_p99_ms:
      threshold: '<1000'
      weight: 0.10
      alert_above: 1500
    throughput_qps:
      threshold: '>100'
      weight: 0.05
      alert_below: 50

  # 비용 지표 (Cost) - 15%
  cost:
    cost_per_1k_queries_usd:
      threshold: '<1.00'
      weight: 0.10
      alert_above: 1.50
    tokens_per_query:
      threshold: '<2000'
      weight: 0.05
      alert_above: 3000

  # 안정성 지표 (Reliability) - 10%
  reliability:
    error_rate:
      threshold: '<0.001'
      weight: 0.05
      alert_above: 0.01
    availability:
      threshold: '>0.999'
      weight: 0.05
      alert_below: 0.99

  # 승격 기준
  promotion_criteria:
    - '모든 threshold 충족'
    - '기존 baseline 대비 quality 지표 regression 없음'
    - '통계적 유의성 검증 완료 (p < 0.05)'
```

### 4.4 트레이드오프 시각화

```
                    High Quality
                         ↑
                         │
              Pareto     │    ★ 이상적 영역
              Frontier ──┼──────────
                    ╱    │         ╲
                   ╱     │          ╲
    Low Latency ──┼──────┼───────────→ High Latency
                   ╲     │          ╱
                    ╲    │         ╱
                     ────┼──────────
                         │
                         │
                    Low Quality

승격 기준: Pareto Frontier 위에 있거나 기존보다 개선
```

### 4.5 LLM 추론 성능 트레이드오프

LLM 기반 시스템에서는 특히 throughput-latency 트레이드오프가 중요합니다 ([MLC Blog](https://blog.mlc.ai/2024/10/10/optimizing-and-characterizing-high-throughput-low-latency-llm-inference)).

| 구성              | TTFT | Throughput | 비용 | 추천 상황   |
| ----------------- | ---- | ---------- | ---- | ----------- |
| 1 replica × 8 GPU | 높음 | 최대       | 낮음 | 배치 처리   |
| 8 replica × 1 GPU | 최저 | 중간       | 높음 | 실시간 응답 |
| 4 replica × 2 GPU | 중간 | 높음       | 중간 | 균형        |

**참고 자료:**

- [RAGAS Documentation](https://docs.ragas.io/)
- [RAGAS - Available Metrics](https://docs.ragas.io/en/stable/concepts/metrics/available_metrics/)
- [Anyscale - Reproducible Performance Metrics for LLM](https://www.anyscale.com/blog/reproducible-performance-metrics-for-llm-inference)
- [Nature - Evaluation Metrics and Statistical Tests for ML](https://www.nature.com/articles/s41598-024-56706-x)

---

## 5. Ablation Study 설계

### 5.1 Ablation Study란?

[Wikipedia 정의](<https://en.wikipedia.org/wiki/Ablation_(artificial_intelligence)>):

> "Ablation study aims to determine the contribution of a component to an AI system by removing the component, and then analyzing the resultant performance."

[Francois Chollet](https://twitter.com/fchollet) (Keras 창시자)의 말:

> "Understanding causality in your system is the most straightforward way to generate reliable knowledge. And ablation is a very low-effort way to look into causality."

### 5.2 체계적 Ablation 프로세스

```
전체 시스템: Component A + B + C + D
                     │
                     ▼
┌────────────────────────────────────────────────────────┐
│                   Ablation Study                        │
├────────────────────────────────────────────────────────┤
│                                                         │
│   Step 1: Full System          → 78.2% (baseline)      │
│   Step 2: A + B + C (D 제거)   → 77.8% (-0.4%)        │
│   Step 3: A + B + D (C 제거)   → 65.2% (-13.0%)       │
│   Step 4: A + C + D (B 제거)   → 76.9% (-1.3%)        │
│   Step 5: B + C + D (A 제거)   → 71.5% (-6.7%)        │
│                                                         │
│   결론:                                                 │
│   - Component C: 필수 (기여도 13.0%)                   │
│   - Component A: 중요 (기여도 6.7%)                    │
│   - Component B: 선택적 (기여도 1.3%)                  │
│   - Component D: 불필요 (기여도 0.4%)                  │
│                                                         │
└────────────────────────────────────────────────────────┘
```

### 5.3 예시: 임베딩 모델 변경 실험

"voyage-3-large로 바꿨더니 좋아졌다"만으로는 **왜 좋아졌는지** 알 수 없습니다.

```yaml
# ablation_experiments.yaml
ablation:
  hypothesis: 'voyage-3-large가 text-embedding-3-small보다 F1 10% 이상 향상'

  experiments:
    # Baseline (기준점)
    - name: 'baseline'
      embedding_model: 'text-embedding-3-small'
      dimensions: 1536
      expected: '기준점'

    # 변수 1: 모델만 변경 (차원 유지)
    - name: 'model_only'
      embedding_model: 'voyage-3-large'
      dimensions: 1536 # 강제로 맞춤 (truncate or pad)
      question: '모델 자체의 품질이 원인인가?'

    # 변수 2: 차원만 변경 (모델 유지)
    - name: 'dim_only'
      embedding_model: 'text-embedding-3-small'
      dimensions: 1024 # 축소
      question: '차원 축소가 도움이 되는가?'

    # 변수 3: 둘 다 변경 (최종 설정)
    - name: 'both'
      embedding_model: 'voyage-3-large'
      dimensions: 1024
      question: '시너지 효과가 있는가?'

  interpretation:
    model_only_wins: '모델 품질이 핵심 요인'
    dim_only_wins: '차원 축소로 노이즈 제거 효과'
    both_wins_only: '두 변수의 상호작용 효과'
    both_wins_more: '두 변수 모두 독립적으로 기여'
```

### 5.4 Ablation 결과 리포팅 템플릿

```markdown
## Ablation Study: Embedding Model 변경

### 실험 설정

| Configuration | Embedding Model        | Dimensions |
| ------------- | ---------------------- | ---------- |
| baseline      | text-embedding-3-small | 1536       |
| model_only    | voyage-3-large         | 1536       |
| dim_only      | text-embedding-3-small | 1024       |
| both          | voyage-3-large         | 1024       |

### 결과

| Configuration | F1 (mean±std) | Δ vs Baseline | p-value | Critical? |
| ------------- | ------------- | ------------- | ------- | --------- |
| baseline      | 65.9% ± 1.1%  | -             | -       | -         |
| model_only    | 74.5% ± 1.3%  | +8.6%         | <0.001  | ✅ Yes    |
| dim_only      | 66.2% ± 1.2%  | +0.3%         | 0.72    | ❌ No     |
| both          | 78.2% ± 1.3%  | +12.3%        | <0.001  | ✅ Yes    |

### 분석

- **모델 변경 효과**: +8.6% (통계적 유의)
- **차원 축소 효과**: +0.3% (유의하지 않음)
- **상호작용 효과**: 12.3% - 8.6% - 0.3% = +3.4%

### 결론

1. 성능 향상의 주 원인은 **voyage-3-large 모델의 품질**
2. 차원 축소 자체는 효과 없음
3. 단, 모델과 결합 시 추가적인 시너지 효과 존재
4. 권장: voyage-3-large + 1024 dimensions 조합 사용
```

### 5.5 Ablation 자동화 도구

```python
from itertools import combinations
from typing import Dict, List, Callable

class AblationStudy:
    """
    체계적인 Ablation Study 수행

    참고: https://pykeen.readthedocs.io/en/stable/tutorial/running_ablation.html
    """
    def __init__(self, components: Dict[str, any], evaluator: Callable):
        self.components = components
        self.evaluator = evaluator
        self.results = {}

    def run_full(self) -> float:
        """전체 시스템 평가"""
        return self.evaluator(**self.components)

    def run_ablation(self, remove: str) -> float:
        """특정 컴포넌트 제거 후 평가"""
        config = {k: v for k, v in self.components.items() if k != remove}
        return self.evaluator(**config)

    def analyze(self) -> Dict:
        """전체 ablation 분석 수행"""
        full_score = self.run_full()
        self.results['full'] = full_score

        contributions = {}
        for component in self.components:
            ablated_score = self.run_ablation(component)
            self.results[f'without_{component}'] = ablated_score
            contributions[component] = full_score - ablated_score

        # 기여도 순 정렬
        sorted_contributions = dict(
            sorted(contributions.items(), key=lambda x: x[1], reverse=True)
        )

        return {
            'full_score': full_score,
            'contributions': sorted_contributions,
            'critical_components': [
                k for k, v in sorted_contributions.items() if v > 0.05
            ],
            'removable_components': [
                k for k, v in sorted_contributions.items() if v < 0.01
            ]
        }
```

**참고 자료:**

- [Baeldung - ML Ablation Study](https://www.baeldung.com/cs/ml-ablation-study)
- [PyKEEN - Running Ablation Studies](https://pykeen.readthedocs.io/en/stable/tutorial/running_ablation.html)
- [ML.recipes - Ablation Studies](https://ml.recipes/notebooks/6-ablation-study.html)
- [Capital One - XAI Ablation Methods](https://www.capitalone.com/tech/machine-learning/xai-ablation-study/)

---

## 6. Production 배포 및 Rollback 전략

### 6.1 Progressive Delivery (점진적 배포)

[Progressive Delivery](https://www.getunleash.io/blog/rolling-deployment-vs-progressive-delivery)는 전통적인 배포 전략에 실시간 모니터링과 자동화된 의사결정을 결합한 방식입니다.

```
┌─────────────────────────────────────────────────────────────┐
│                    Progressive Delivery                      │
│                                                             │
│   Stage 1      Stage 2      Stage 3      Stage 4    Final   │
│     1%   ──→     5%   ──→    25%   ──→    50%  ──→  100%   │
│     │            │            │            │          │     │
│     ▼            ▼            ▼            ▼          ▼     │
│   [모니터링]   [분석]      [검증]      [확인]    [완료]   │
│     │            │            │            │                │
│     └────────────┴────────────┴────────────┘                │
│                         │                                    │
│                         ▼                                    │
│              이상 감지 시 자동 롤백                          │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 6.2 Canary Deployment with Argo Rollouts

[Argo Rollouts](https://argo-rollouts.readthedocs.io/en/stable/features/canary/)를 이용한 Kubernetes Canary 배포:

```yaml
# canary-rollout.yaml
apiVersion: argoproj.io/v1alpha1
kind: Rollout
metadata:
  name: embedding-service
spec:
  replicas: 10
  strategy:
    canary:
      # 단계별 트래픽 증가
      steps:
        - setWeight: 5
        - pause: { duration: 30m }

        # 자동 분석 수행
        - analysis:
            templates:
              - templateName: success-rate-analysis
            args:
              - name: service-name
                value: embedding-service

        - setWeight: 25
        - pause: { duration: 1h }

        - analysis:
            templates:
              - templateName: latency-analysis

        - setWeight: 50
        - pause: { duration: 2h }

        - setWeight: 100

      # 롤백 조건
      analysis:
        successCondition: result[0] >= 0.95 # 95% 성공률
        failureCondition: result[0] < 0.90 # 90% 미만이면 실패

---
# 분석 템플릿
apiVersion: argoproj.io/v1alpha1
kind: AnalysisTemplate
metadata:
  name: success-rate-analysis
spec:
  metrics:
    - name: success-rate
      interval: 5m
      successCondition: result[0] >= 0.95
      failureLimit: 3
      provider:
        prometheus:
          address: http://prometheus:9090
          query: |
            sum(rate(http_requests_total{service="{{args.service-name}}",status="200"}[5m]))
            /
            sum(rate(http_requests_total{service="{{args.service-name}}"}[5m]))
```

### 6.3 자동 롤백 조건 설정

```yaml
# rollback_triggers.yaml
rollback:
  # 즉시 롤백 조건 (Critical)
  critical:
    - metric: 'error_rate'
      condition: '> 0.05' # 5%
      window: '2m'
      action: 'immediate_rollback'

    - metric: 'latency_p99_ms'
      condition: '> 5000' # 5초
      window: '5m'
      action: 'immediate_rollback'

  # 경고 후 롤백 (Warning)
  warning:
    - metric: 'latency_p95_ms'
      condition: '> baseline * 1.5'
      window: '10m'
      action: 'alert_then_rollback'
      grace_period: '15m'

    - metric: 'faithfulness_score'
      condition: '< 0.85'
      window: '15m'
      action: 'alert_then_rollback'
      grace_period: '30m'

  # 점진적 롤백 (Gradual)
  gradual:
    - metric: 'cost_per_query'
      condition: '> baseline * 1.3'
      window: '1h'
      action: 'gradual_rollback'
      steps: [50, 25, 0] # 트래픽 감소
```

### 6.4 Feature Flag 기반 롤백

[Feature Flags](https://www.getunleash.io/blog/canary-release-vs-progressive-delivery)를 사용하면 배포 없이 즉시 롤백할 수 있습니다.

```typescript
// feature_flag_rollback.ts
import { UnleashClient } from 'unleash-proxy-client';

const unleash = new UnleashClient({
  url: 'https://unleash.example.com/api/frontend',
  clientKey: 'proxy-secret',
  appName: 'embedding-service',
});

async function getEmbedding(text: string, userId: string): Promise<number[]> {
  // Feature Flag로 새 모델 활성화 여부 확인
  const useNewModel = unleash.isEnabled('new_embedding_model', {
    userId,
    properties: {
      region: getUserRegion(userId),
      tier: getUserTier(userId),
    },
  });

  if (useNewModel) {
    try {
      return await voyageEmbed(text);
    } catch (error) {
      // 에러 시 자동 fallback
      console.error('New model failed, falling back:', error);
      metrics.increment('embedding.fallback');
      return await openAIEmbed(text);
    }
  }

  return await openAIEmbed(text);
}

// 롤백: Unleash UI에서 토글 off → 즉시 모든 요청이 기존 모델 사용
// 배포 필요 없음!
```

### 6.5 ML 모델 롤백 체크리스트

```markdown
## 배포 전

□ Canary 비율 설정 (시작: 1-5%)
□ 모니터링 대시보드 준비
□ 롤백 조건 정의 및 자동화
□ Feature Flag 설정 (fallback 포함)
□ On-call 담당자 지정

## 배포 중

□ 각 단계별 메트릭 확인
□ Error rate < threshold
□ Latency p99 < threshold
□ Quality metrics >= baseline
□ 이상 징후 시 즉시 롤백

## 배포 후

□ 24시간 모니터링
□ A/B 테스트 결과 분석
□ 비용 변화 확인
□ 사용자 피드백 수집
□ Baseline 승격 여부 결정
```

**참고 자료:**

- [Unleash - Progressive Delivery](https://www.getunleash.io/blog/rolling-deployment-vs-progressive-delivery)
- [Argo Rollouts - Canary](https://argo-rollouts.readthedocs.io/en/stable/features/canary/)
- [Codefresh - Canary Deployments](https://codefresh.io/learn/software-deployment/what-are-canary-deployments/)
- [Split.io - Progressive Delivery](https://www.split.io/glossary/progressive-delivery/)

---

## 7. 실패한 실험에서 학습하기

### 7.1 왜 중요한가?

현재 Product Spec에서 가장 크게 누락된 부분입니다. 실패한 실험은 성공한 실험만큼이나 가치 있는 정보를 제공합니다:

- **왜 실패했는지** 알면 다음 실험 설계가 개선됨
- 같은 실수를 반복하지 않음
- 시스템에 대한 이해가 깊어짐

### 7.2 실패 분석 프로세스

```yaml
# failed_experiment_template.yaml
failed_experiment:
  # 필수 기록 항목
  mandatory:
    experiment_id: 'EXP-002'
    hypothesis: '왜 이 실험이 성공할 것이라 예상했는가?'
    expected_result: '예상한 결과는 무엇이었는가?'
    actual_result: '실제로 무슨 일이 일어났는가?'

  # 근본 원인 분석 (5 Whys)
  root_cause_analysis:
    - why_1: '왜 F1이 급락했는가?'
    - why_2: '왜 문맥이 파괴되었는가?'
    - why_3: '왜 청크 크기를 너무 작게 설정했는가?'
    - why_4: '왜 사전 테스트를 하지 않았는가?'
    - why_5: '왜 청킹 전략에 대한 연구가 부족했는가?'

  # 학습 및 개선
  learnings:
    - insight: '무엇을 배웠는가?'
    - improvement: '프로세스를 어떻게 개선할 것인가?'
    - next_experiment: '다음에 어떤 실험을 할 것인가?'
```

### 7.3 실패 기록 템플릿 예시

```markdown
## EXP-002: 실패 분석

### 기본 정보

- **실험 ID**: EXP-002
- **실험일**: 2024-11-25
- **담당자**: @researcher

### 가설

청크 크기를 256→128로 줄이면 더 정밀한 검색이 가능하여
정밀도가 향상될 것이다.

### 예상 결과

- F1: 65.9% → 70%+ (약 5% 향상)
- Precision: 개선
- Recall: 유지 또는 소폭 하락

### 실제 결과

- F1: 65.9% → **4.8%** (급격한 하락)
- Precision: 92% → 12%
- Recall: 62% → 3%

### 근본 원인 분석 (5 Whys)

**Why 1: 왜 F1이 급락했는가?**
→ Precision과 Recall 모두 급격히 하락

**Why 2: 왜 Precision/Recall이 하락했는가?**
→ 검색된 청크가 쿼리에 대한 충분한 컨텍스트를 제공하지 못함

**Why 3: 왜 컨텍스트가 부족했는가?**
→ 128 토큰 청크에서 "이것", "그것" 등 대명사가 참조 대상을 잃음
→ 문장이 중간에 잘려서 의미가 불완전

**Why 4: 왜 이런 문제를 예상하지 못했는가?**
→ 작은 청크 = 더 정밀한 검색이라는 단순한 가정
→ 의미론적 완결성에 대한 고려 부족

**Why 5: 왜 사전 테스트를 하지 않았는가?**
→ 소규모 샘플로 검증하는 프로세스가 없었음

### 학습

1. **청크 크기와 품질은 비선형 관계**
   - 너무 작으면 문맥 파괴
   - 너무 크면 노이즈 증가
   - 최적점이 존재 (우리 데이터에서는 256-512 추정)

2. **의미론적 완결성이 핵심**
   - 토큰 수보다 의미 단위가 중요
   - 문장/문단 경계 존중 필요

3. **점진적 변경 원칙**
   - 256→128 (50% 감소)는 너무 급진적
   - 256→200→150 등 단계적 접근 필요

### 프로세스 개선

1. 대규모 실험 전 **소규모 샘플 (n=100)로 사전 검증** 추가
2. 파라미터 변경 시 **최대 20% 범위**로 제한
3. **Ablation 실험 병행**: 왜 좋아지는지/나빠지는지 이해

### 다음 실험

- **EXP-005**: Semantic Chunking 시도
  - 토큰 수가 아닌 의미 단위로 분할
  - 문장 임베딩 유사도로 경계 결정
  - 가설: 의미 기반 분할이 고정 크기보다 효과적
```

### 7.4 실패 패턴 데이터베이스

```yaml
# failure_patterns.yaml
patterns:
  - pattern: '급격한 파라미터 변경'
    symptoms:
      - '성능 급락'
      - '예상치 못한 부작용'
    prevention:
      - '변경폭 20% 이내로 제한'
      - '사전 소규모 테스트'
    examples: ['EXP-002']

  - pattern: '단일 메트릭 최적화'
    symptoms:
      - '한 메트릭은 개선되나 다른 메트릭 악화'
      - 'Production에서 예상치 못한 문제'
    prevention:
      - 'Multi-objective 평가'
      - 'Trade-off 분석'
    examples: ['EXP-007', 'EXP-011']

  - pattern: 'Data Leakage'
    symptoms:
      - '비현실적으로 높은 정확도'
      - 'Production과 평가 결과 괴리'
    prevention:
      - '엄격한 train/test 분리'
      - '시간순 분할 (시계열)'
    examples: ['EXP-015']
```

---

## 8. 종합 체크리스트

### 8.1 실험 전 (Before Experiment)

```markdown
## 가설 및 설계

□ 가설이 구체적이고 검증 가능한가?

- ❌ "성능이 좋아질 것"
- ✅ "F1이 baseline 대비 10% 이상 향상될 것"
  □ 가설의 근거가 명확한가? (논문, 이전 실험 결과 등)
  □ 실패 시 배울 수 있는 것이 있는가?

## Baseline 및 비교

□ Baseline이 명확히 정의되어 있는가?
□ Baseline 성능이 측정되어 있는가?
□ 비교 조건이 공정한가? (동일 데이터, 환경)

## 평가 설계

□ 평가 지표가 복수이며 적절한가? (Quality, Performance, Cost)
□ 각 지표의 threshold가 정의되어 있는가?
□ 통계적 검증 방법이 결정되어 있는가? (Bootstrap CI, t-test 등)

## 재현성

□ Random seed가 고정되어 있는가?
□ 환경 버전이 기록되어 있는가? (Python, 라이브러리, CUDA)
□ 실험 추적 도구가 설정되어 있는가? (MLflow, W&B 등)

## 데이터

□ Train/Validation/Test split이 적절한가?
□ Data leakage 가능성이 점검되었는가?
□ Test set이 hold-out 되어 있는가?

## 실험 계획

□ 반복 실험 계획이 있는가? (n≥3, 다른 시드)
□ Ablation 실험이 계획되어 있는가?
□ 예상 소요 시간과 비용이 산정되어 있는가?
```

### 8.2 실험 중 (During Experiment)

```markdown
## 기록

□ 모든 실행이 실험 추적 도구에 기록되는가?
□ 하이퍼파라미터, 메트릭이 자동 로깅되는가?
□ 중간 결과(checkpoints)가 저장되는가?

## 모니터링

□ 학습 곡선이 정상적인가?
□ 메모리/GPU 사용량이 적절한가?
□ 예상치 못한 에러가 발생하지 않는가?

## 조기 중단

□ 이상 징후 발생 시 조기 중단 기준이 있는가?
□ 확실히 실패한 실험을 오래 실행하고 있지 않은가?

## Ablation

□ 병행 ablation 실험이 진행 중인가?
□ 컴포넌트별 기여도를 측정하고 있는가?
```

### 8.3 실험 후 (After Experiment)

```markdown
## 결과 검증

□ 통계적 유의성이 검증되었는가?
□ Bootstrap CI 또는 p-value 계산
□ 95% CI에 0이 포함되지 않음 (또는 p < 0.05)
□ 결과가 mean ± std 형식으로 리포팅되는가?
□ 모든 평가 지표가 threshold를 충족하는가?

## 실패 분석 (해당 시)

□ 근본 원인 분석(5 Whys)이 수행되었는가?
□ 학습 내용이 문서화되었는가?
□ 다음 실험 방향이 도출되었는가?

## 성공 검증 (해당 시)

□ Ablation 결과로 "왜 좋아졌는지" 설명 가능한가?
□ Baseline 대비 모든 핵심 지표에서 regression이 없는가?
□ Edge case 테스트가 완료되었는가?

## 배포 준비

□ Canary 배포 계획이 있는가?
□ 롤백 조건이 정의되어 있는가?
□ 모니터링 대시보드가 준비되어 있는가?
□ Feature flag가 설정되어 있는가?

## 문서화

□ 실험 결과가 팀과 공유되었는가?
□ 코드와 설정이 버전 관리되었는가?
□ 재현을 위한 모든 정보가 기록되었는가?
```

### 8.4 승격 전 최종 점검 (Before Promotion)

```markdown
## 품질 검증

□ 통계적 유의성 검증 완료 (n≥3 runs, p<0.05)
□ 모든 Quality 지표가 baseline 이상
□ 모든 Performance 지표가 threshold 이내
□ Cost가 예산 범위 이내

## 안정성 검증

□ 카테고리별 성능 breakdown에서 regression 없음
□ Edge case 테스트 통과
□ 에러 핸들링 검증 완료

## 운영 준비

□ Canary 배포 (1% → 5% → 25% → 50% → 100%)
□ 자동 롤백 조건 설정
□ 모니터링 알림 설정
□ On-call 담당자 지정

## 최종 승인

□ Tech Lead 리뷰 완료
□ Production 배포 승인
```

---

## 참고 자료

### 통계적 유의성

- [Wikipedia - Bootstrapping (statistics)](<https://en.wikipedia.org/wiki/Bootstrapping_(statistics)>)
- [Cross Validated - Bootstrap for ML model comparison](https://stats.stackexchange.com/questions/639334/using-bootstrap-to-compare-performance-of-two-machine-learning-models)
- [Facebook bootstrapped library](https://github.com/facebookarchive/bootstrapped)
- [Spotify Engineering - Comparing Quantiles at Scale](https://engineering.atspotify.com/2022/03/comparing-quantiles-at-scale-in-online-a-b-testing)
- [Getir - Bootstrapping for A/B Testing](https://medium.com/getir/bootstrapping-for-a-b-testing-893f01fa6700)

### 재현성

- [Data Science Journal - Reproducible ML Workflow (2024)](https://datascience.codata.org/articles/10.5334/dsj-2024-023)
- [AI Magazine - Reproducibility in ML (2025)](https://onlinelibrary.wiley.com/doi/10.1002/aaai.70002)
- [Neptune.ai - How to Solve Reproducibility in ML](https://neptune.ai/blog/how-to-solve-reproducibility-in-ml)
- [OSTI - Managing Randomness for Reproducible ML](https://www.osti.gov/servlets/purl/2003351)
- [Medium - ML Reproducibility Challenges](https://medium.com/@kocyigit.emre.30/machine-learning-challenges-2-reproducibility-e33aaa551f91)

### 데이터셋 관리

- [IBM - Data Leakage in Machine Learning](https://www.ibm.com/think/topics/data-leakage-machine-learning)
- [AWS - Splits and Data Leakage](https://docs.aws.amazon.com/prescriptive-guidance/latest/ml-operations-planning/splits-leakage.html)
- [Wikipedia - Leakage (machine learning)](<https://en.wikipedia.org/wiki/Leakage_(machine_learning)>)
- [Machine Learning Mastery - Data Preparation without Leakage](https://machinelearningmastery.com/data-preparation-without-data-leakage/)
- [Analytics Vidhya - Data Leakage Effects](https://www.analyticsvidhya.com/blog/2021/07/data-leakage-and-its-effect-on-the-performance-of-an-ml-model/)

### 평가 프레임워크

- [RAGAS Documentation](https://docs.ragas.io/)
- [RAGAS - Available Metrics](https://docs.ragas.io/en/stable/concepts/metrics/available_metrics/)
- [RAGAS Paper (EACL 2024)](https://aclanthology.org/2024.eacl-demo.16/)
- [Medium - Evaluating RAG with RAGAS](https://medium.com/data-science/evaluating-rag-applications-with-ragas-81d67b0ee31a)
- [Nature - Evaluation Metrics for ML (2024)](https://www.nature.com/articles/s41598-024-56706-x)

### Ablation Studies

- [Wikipedia - Ablation (artificial intelligence)](<https://en.wikipedia.org/wiki/Ablation_(artificial_intelligence)>)
- [Baeldung - ML Ablation Study](https://www.baeldung.com/cs/ml-ablation-study)
- [PyKEEN - Running Ablation Studies](https://pykeen.readthedocs.io/en/stable/tutorial/running_ablation.html)
- [ML.recipes - Ablation Studies](https://ml.recipes/notebooks/6-ablation-study.html)
- [Capital One - XAI Ablation Methods](https://www.capitalone.com/tech/machine-learning/xai-ablation-study/)

### MLOps & Deployment

- [DagShub - Best Experiment Tracking Tools 2024](https://dagshub.com/blog/best-8-experiment-tracking-tools-for-machine-learning-2023/)
- [DataCamp - Top MLOps Tools 2025](https://www.datacamp.com/blog/top-mlops-tools)
- [Neptune.ai - DVC Alternatives](https://neptune.ai/blog/dvc-alternatives-for-experiment-tracking)
- [Unleash - Progressive Delivery](https://www.getunleash.io/blog/rolling-deployment-vs-progressive-delivery)
- [Argo Rollouts - Canary Deployment](https://argo-rollouts.readthedocs.io/en/stable/features/canary/)
- [Codefresh - Canary Deployments](https://codefresh.io/learn/software-deployment/what-are-canary-deployments/)

### LLM 성능 최적화

- [Anyscale - Reproducible Performance Metrics for LLM](https://www.anyscale.com/blog/reproducible-performance-metrics-for-llm-inference)
- [MLC Blog - High-Throughput Low-Latency LLM Inference](https://blog.mlc.ai/2024/10/10/optimizing-and-characterizing-high-throughput-low-latency-llm-inference)
- [arXiv - Sarathi-Serve: Throughput-Latency Tradeoff](https://arxiv.org/html/2403.02310v1)

---

_작성일: 2024-11-26_
_버전: 1.0_
