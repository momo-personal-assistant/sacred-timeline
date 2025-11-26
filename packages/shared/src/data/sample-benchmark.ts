import {
  BenchmarkDataset,
  BenchmarkQuery,
  createBenchmarkDataset,
  GitHubEvent,
  LinearEvent,
  QueryType,
  SlackEvent,
} from '../types/benchmark';
import { Platform } from '../types/platform';

// =============================================================================
// SAMPLE BENCHMARK: Product Feedback Analysis
// =============================================================================
// Scenario: CS team receives feedback from multiple channels
// Goal: Identify most urgent product improvements
// =============================================================================

// -----------------------------------------------------------------------------
// SAMPLE EVENTS
// -----------------------------------------------------------------------------

const slackEvents: SlackEvent[] = [
  // API Rate Limit complaints in #support
  {
    id: 'slack_001',
    timestamp: '2024-01-15T10:32:00Z',
    platform: Platform.SLACK,
    workspace: 'acme-corp',
    actor: 'customer_alice',
    action: 'sent',
    object_type: 'message',
    object_id: 'msg_001',
    context: {
      channel_id: 'C001',
      channel_name: 'support',
      text: 'API rate limit이 너무 낮아요. 하루 1000건 제한으로는 업무가 안됩니다.',
      mentions: ['support_team'],
    },
  },
  {
    id: 'slack_002',
    timestamp: '2024-01-15T14:20:00Z',
    platform: Platform.SLACK,
    workspace: 'acme-corp',
    actor: 'customer_bob',
    action: 'sent',
    object_type: 'message',
    object_id: 'msg_002',
    context: {
      channel_id: 'C001',
      channel_name: 'support',
      text: '저희도 rate limit 때문에 배치 작업이 자주 실패해요',
      mentions: [],
    },
  },
  {
    id: 'slack_003',
    timestamp: '2024-01-16T09:15:00Z',
    platform: Platform.SLACK,
    workspace: 'acme-corp',
    actor: 'customer_charlie',
    action: 'sent',
    object_type: 'message',
    object_id: 'msg_003',
    context: {
      channel_id: 'C001',
      channel_name: 'support',
      text: 'API 호출 제한 늘려주실 수 있나요? 현재 limit이 너무 빡빡합니다',
      mentions: ['engineer_dave'],
    },
  },
  // Documentation complaints
  {
    id: 'slack_004',
    timestamp: '2024-01-16T11:30:00Z',
    platform: Platform.SLACK,
    workspace: 'acme-corp',
    actor: 'customer_diana',
    action: 'sent',
    object_type: 'message',
    object_id: 'msg_004',
    context: {
      channel_id: 'C001',
      channel_name: 'support',
      text: 'API 문서에서 webhook 설정 방법을 못 찾겠어요',
      mentions: [],
    },
  },
  {
    id: 'slack_005',
    timestamp: '2024-01-17T15:00:00Z',
    platform: Platform.SLACK,
    workspace: 'acme-corp',
    actor: 'customer_eve',
    action: 'sent',
    object_type: 'message',
    object_id: 'msg_005',
    context: {
      channel_id: 'C001',
      channel_name: 'support',
      text: '문서가 outdated된 것 같아요. v2 API 내용이 없네요',
      mentions: [],
    },
  },
  // Internal discussion about rate limit (noise - should be filtered)
  {
    id: 'slack_006',
    timestamp: '2024-01-17T16:00:00Z',
    platform: Platform.SLACK,
    workspace: 'acme-corp',
    actor: 'engineer_dave',
    action: 'sent',
    object_type: 'message',
    object_id: 'msg_006',
    context: {
      channel_id: 'C002',
      channel_name: 'engineering',
      text: 'Slack API rate limit 때문에 봇이 가끔 응답 못함. 백오프 로직 추가해야할듯',
      mentions: [],
    },
  },
  // More rate limit complaints (different time)
  {
    id: 'slack_007',
    timestamp: '2024-01-20T10:00:00Z',
    platform: Platform.SLACK,
    workspace: 'acme-corp',
    actor: 'customer_frank',
    action: 'sent',
    object_type: 'message',
    object_id: 'msg_007',
    context: {
      channel_id: 'C001',
      channel_name: 'support',
      text: '엔터프라이즈 플랜인데도 rate limit이 충분하지 않아요',
      mentions: ['sales_team'],
    },
  },
  // Onboarding feedback
  {
    id: 'slack_008',
    timestamp: '2024-01-18T09:30:00Z',
    platform: Platform.SLACK,
    workspace: 'acme-corp',
    actor: 'customer_grace',
    action: 'sent',
    object_type: 'message',
    object_id: 'msg_008',
    context: {
      channel_id: 'C003',
      channel_name: 'feedback',
      text: '온보딩 과정이 너무 복잡해요. 더 간단한 튜토리얼이 있으면 좋겠어요',
      mentions: [],
    },
  },
];

const linearEvents: LinearEvent[] = [
  // Internal ticket for rate limit
  {
    id: 'linear_001',
    timestamp: '2024-01-15T15:00:00Z',
    platform: Platform.LINEAR,
    workspace: 'acme-corp',
    actor: 'pm_helen',
    action: 'created',
    object_type: 'issue',
    object_id: 'ENG-123',
    context: {
      title: 'API Rate Limit 증가 검토',
      description:
        '고객들로부터 rate limit 관련 불만이 다수 접수됨. 현재 1000/day -> 5000/day 검토 필요',
      status: 'backlog',
      priority: 2,
      labels: ['customer-feedback', 'api'],
    },
  },
  {
    id: 'linear_002',
    timestamp: '2024-01-16T10:00:00Z',
    platform: Platform.LINEAR,
    workspace: 'acme-corp',
    actor: 'engineer_dave',
    action: 'moved',
    object_type: 'issue',
    object_id: 'ENG-123',
    context: {
      title: 'API Rate Limit 증가 검토',
      status: 'in_progress',
      priority: 2,
    },
  },
  // Documentation ticket
  {
    id: 'linear_003',
    timestamp: '2024-01-17T11:00:00Z',
    platform: Platform.LINEAR,
    workspace: 'acme-corp',
    actor: 'pm_helen',
    action: 'created',
    object_type: 'issue',
    object_id: 'DOC-45',
    context: {
      title: 'API 문서 업데이트 - webhook 섹션 추가',
      description: '고객 문의: webhook 설정 방법 문서화 필요',
      status: 'backlog',
      priority: 3,
      labels: ['documentation'],
    },
  },
];

const githubEvents: GitHubEvent[] = [
  // PR for rate limit fix
  {
    id: 'github_001',
    timestamp: '2024-01-18T14:00:00Z',
    platform: Platform.GITHUB,
    workspace: 'acme-corp',
    actor: 'engineer_dave',
    action: 'created',
    object_type: 'pull_request',
    object_id: 'PR-456',
    context: {
      title: 'feat: increase default rate limit to 5000/day',
      body: 'Addresses customer feedback. Linked to ENG-123.',
      labels: ['enhancement'],
      repo: 'acme-api',
      branch: 'feature/rate-limit-increase',
    },
  },
  {
    id: 'github_002',
    timestamp: '2024-01-18T16:00:00Z',
    platform: Platform.GITHUB,
    workspace: 'acme-corp',
    actor: 'engineer_ivan',
    action: 'reviewed',
    object_type: 'review',
    object_id: 'review_001',
    context: {
      title: 'Approved with suggestions',
      body: 'LGTM, but consider adding per-tier limits',
      target_id: 'PR-456',
    },
  },
  // GitHub issue from external user
  {
    id: 'github_003',
    timestamp: '2024-01-19T09:00:00Z',
    platform: Platform.GITHUB,
    workspace: 'acme-corp',
    actor: 'external_user_1',
    action: 'created',
    object_type: 'issue',
    object_id: 'issue_789',
    context: {
      title: 'Rate limit too low for production use',
      body: 'Current 1000/day limit is insufficient. Please consider increasing.',
      labels: ['enhancement', 'api'],
      repo: 'acme-api',
    },
  },
];

// -----------------------------------------------------------------------------
// SAMPLE QUERIES
// -----------------------------------------------------------------------------

const queries: BenchmarkQuery[] = [
  // Single-hop queries
  {
    id: 'q_001',
    type: QueryType.SINGLE_HOP,
    question: '누가 rate limit 불만을 처음 제기했나?',
    expected_answer: 'customer_alice',
    expected_entity_type: 'user',
    difficulty: 'easy',
  },
  {
    id: 'q_002',
    type: QueryType.SINGLE_HOP,
    question: 'ENG-123 이슈의 현재 상태는?',
    expected_answer: 'in_progress',
    expected_entity_type: 'status',
    difficulty: 'easy',
  },

  // Multi-hop queries
  {
    id: 'q_003',
    type: QueryType.MULTI_HOP,
    question: 'rate limit 관련 Slack 불만을 해결하기 위해 만들어진 PR은?',
    expected_answer: 'PR-456',
    reasoning_path: ['Slack 불만 → ENG-123 이슈 생성', 'ENG-123 → PR-456 연결'],
    hop_count: 2,
    difficulty: 'medium',
  },
  {
    id: 'q_004',
    type: QueryType.MULTI_HOP,
    question: 'customer_alice의 불만을 해결하기 위해 작업한 엔지니어는?',
    expected_answer: 'engineer_dave',
    reasoning_path: [
      'customer_alice → rate limit 불만',
      'rate limit 불만 → ENG-123',
      'ENG-123 → engineer_dave 작업',
    ],
    hop_count: 3,
    difficulty: 'hard',
  },

  // Temporal queries
  {
    id: 'q_005',
    type: QueryType.TEMPORAL,
    question: 'rate limit 불만이 급증한 시기는?',
    expected_answer: '2024-01-15 ~ 2024-01-17',
    time_range: {
      relative: 'peak_period',
    },
    temporal_operator: 'during',
    difficulty: 'medium',
  },
  {
    id: 'q_006',
    type: QueryType.TEMPORAL,
    question: 'ENG-123이 생성된 후 PR이 올라오기까지 얼마나 걸렸나?',
    expected_answer: '3일 (72시간)',
    temporal_operator: 'duration',
    difficulty: 'medium',
  },

  // Aggregation queries
  {
    id: 'q_007',
    type: QueryType.AGGREGATION,
    question: '가장 많이 언급된 제품 이슈는?',
    expected_answer: 'API rate limit',
    expected_count_range: [5, 8],
    aggregation_type: 'top_k',
    difficulty: 'medium',
  },
  {
    id: 'q_008',
    type: QueryType.AGGREGATION,
    question: 'API rate limit 관련 불만이 총 몇 건?',
    expected_answer: 6,
    expected_count_range: [5, 7],
    expected_sources: {
      [Platform.SLACK]: 4,
      [Platform.GITHUB]: 1,
      [Platform.LINEAR]: 1,
    },
    aggregation_type: 'count',
    difficulty: 'medium',
  },

  // Filtered aggregation queries
  {
    id: 'q_009',
    type: QueryType.FILTERED_AGGREGATION,
    question: '우리 제품 관련 API rate limit 불만만 몇 건? (외부 API 제외)',
    expected_answer: 5,
    expected_count_range: [4, 6],
    filter_criteria: {
      include: ['our_product', 'customer_feedback'],
      exclude: ['slack_api', 'external_api'],
      context_required: 'our_product',
    },
    excluded_items: ['slack_006'], // Slack API 관련 내부 논의 제외
    difficulty: 'hard',
  },

  // Ranked queries
  {
    id: 'q_010',
    type: QueryType.RANKED,
    question: '시급도 순으로 상위 3개 제품 이슈는?',
    expected_answer: ['API rate limit', '문서 부족', '온보딩 복잡'],
    top_k: 3,
    ranking_factors: ['frequency', 'recency', 'severity'],
    expected_scores: {
      'API rate limit': 0.9,
      '문서 부족': 0.5,
      '온보딩 복잡': 0.3,
    },
    difficulty: 'hard',
  },

  // Attribution queries
  {
    id: 'q_011',
    type: QueryType.ATTRIBUTION,
    question: 'API rate limit 불만의 출처는?',
    expected_answer: 'Slack #support에서 4건, GitHub에서 1건',
    expected_sources: {
      slack_support: 4,
      github_issues: 1,
    },
    expected_citations: [
      {
        source_id: 'slack_001',
        platform: Platform.SLACK,
        snippet: 'API rate limit이 너무 낮아요',
      },
      {
        source_id: 'github_003',
        platform: Platform.GITHUB,
        snippet: 'Rate limit too low for production use',
      },
    ],
    difficulty: 'medium',
  },

  // Cross-source queries
  {
    id: 'q_012',
    type: QueryType.CROSS_SOURCE,
    question: 'Slack에서 논의된 rate limit 이슈가 어떤 Linear 티켓으로 이어졌나?',
    expected_answer: 'ENG-123',
    source_platform: Platform.SLACK,
    target_platform: Platform.LINEAR,
    link_type: 'triggered',
    difficulty: 'medium',
  },
  {
    id: 'q_013',
    type: QueryType.CROSS_SOURCE,
    question: 'Linear 티켓 ENG-123과 연결된 GitHub PR은?',
    expected_answer: 'PR-456',
    source_platform: Platform.LINEAR,
    target_platform: Platform.GITHUB,
    link_type: 'resolved',
    difficulty: 'easy',
  },
];

// -----------------------------------------------------------------------------
// EXPORT BENCHMARK DATASET
// -----------------------------------------------------------------------------

export const SAMPLE_BENCHMARK: BenchmarkDataset = createBenchmarkDataset({
  id: 'benchmark_001',
  name: 'Product Feedback Analysis - API Rate Limit',
  version: '1.0.0',
  description:
    'Sample benchmark for testing cross-source aggregation and filtering. ' +
    'Scenario: Multiple CS channels report API rate limit issues.',
  created_at: new Date().toISOString(),
  config: {
    time_range: {
      start: '2024-01-15T00:00:00Z',
      end: '2024-01-21T00:00:00Z',
    },
    platforms: [Platform.SLACK, Platform.LINEAR, Platform.GITHUB],
    workspace_id: 'acme-corp',
  },
  events: [...slackEvents, ...linearEvents, ...githubEvents],
  queries,
});

// Export individual components for testing
export const SAMPLE_EVENTS = {
  slack: slackEvents,
  linear: linearEvents,
  github: githubEvents,
};

export const SAMPLE_QUERIES = queries;
