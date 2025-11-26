import { z } from 'zod';

import { Platform } from './platform';

// =============================================================================
// EVENT-BASED BENCHMARK SCHEMA
// =============================================================================
// Unified Memory R&D Evaluation Framework
// Supports: Event-based sources, Conversational sources, Cross-source queries
// =============================================================================

// -----------------------------------------------------------------------------
// 1. SOURCE EVENT TYPES
// -----------------------------------------------------------------------------

/**
 * Base event from any platform
 */
export const BaseEventSchema = z.object({
  id: z.string(),
  timestamp: z.string().datetime(),
  platform: z.nativeEnum(Platform),
  workspace: z.string(),
  actor: z.string(),
  action: z.string(),
  object_type: z.string(),
  object_id: z.string(),
});

export type BaseEvent = z.infer<typeof BaseEventSchema>;

/**
 * GitHub Event
 */
export const GitHubEventSchema = BaseEventSchema.extend({
  platform: z.literal(Platform.GITHUB),
  action: z.enum([
    'created',
    'updated',
    'closed',
    'reopened',
    'merged',
    'commented',
    'reviewed',
    'assigned',
    'labeled',
    'linked',
    'committed',
  ]),
  object_type: z.enum(['issue', 'pull_request', 'commit', 'comment', 'review']),
  context: z.object({
    title: z.string().optional(),
    body: z.string().optional(),
    labels: z.array(z.string()).optional(),
    state: z.string().optional(),
    target_id: z.string().optional(), // for linked events
    repo: z.string().optional(),
    branch: z.string().optional(),
  }),
});

export type GitHubEvent = z.infer<typeof GitHubEventSchema>;

/**
 * Linear Event
 */
export const LinearEventSchema = BaseEventSchema.extend({
  platform: z.literal(Platform.LINEAR),
  action: z.enum([
    'created',
    'updated',
    'completed',
    'cancelled',
    'commented',
    'assigned',
    'labeled',
    'linked',
    'moved', // status change
  ]),
  object_type: z.enum(['issue', 'project', 'comment', 'cycle']),
  context: z.object({
    title: z.string().optional(),
    description: z.string().optional(),
    status: z.string().optional(),
    priority: z.number().optional(),
    labels: z.array(z.string()).optional(),
    project_id: z.string().optional(),
    cycle_id: z.string().optional(),
    estimate: z.number().optional(),
  }),
});

export type LinearEvent = z.infer<typeof LinearEventSchema>;

/**
 * Slack Message Event
 */
export const SlackEventSchema = BaseEventSchema.extend({
  platform: z.literal(Platform.SLACK),
  action: z.enum(['sent', 'edited', 'deleted', 'reacted', 'replied', 'mentioned']),
  object_type: z.enum(['message', 'thread', 'reaction', 'file']),
  context: z.object({
    channel_id: z.string(),
    channel_name: z.string().optional(),
    thread_ts: z.string().optional(),
    text: z.string().optional(),
    mentions: z.array(z.string()).optional(),
    reaction: z.string().optional(),
    file_url: z.string().optional(),
  }),
});

export type SlackEvent = z.infer<typeof SlackEventSchema>;

/**
 * Notion Event
 */
export const NotionEventSchema = BaseEventSchema.extend({
  platform: z.literal(Platform.NOTION),
  action: z.enum(['created', 'updated', 'deleted', 'commented', 'shared']),
  object_type: z.enum(['page', 'database', 'block', 'comment']),
  context: z.object({
    title: z.string().optional(),
    content: z.string().optional(),
    parent_id: z.string().optional(),
    database_id: z.string().optional(),
    properties: z.record(z.unknown()).optional(),
  }),
});

export type NotionEvent = z.infer<typeof NotionEventSchema>;

/**
 * Union of all event types
 */
export const PlatformEventSchema = z.discriminatedUnion('platform', [
  GitHubEventSchema,
  LinearEventSchema,
  SlackEventSchema,
  NotionEventSchema,
]);

export type PlatformEvent = z.infer<typeof PlatformEventSchema>;

// -----------------------------------------------------------------------------
// 2. QUERY TYPES
// -----------------------------------------------------------------------------

/**
 * Query type classification
 */
export enum QueryType {
  // Basic retrieval (LOCOMO-compatible)
  SINGLE_HOP = 'single_hop', // Direct fact recall
  MULTI_HOP = 'multi_hop', // Relationship inference
  TEMPORAL = 'temporal', // Time-based reasoning

  // Advanced (Cross-source + Aggregation)
  AGGREGATION = 'aggregation', // Count/frequency across sources
  FILTERED_AGGREGATION = 'filtered_aggregation', // With noise filtering
  RANKED = 'ranked', // Sorted by importance/urgency
  ATTRIBUTION = 'attribution', // Source tracking

  // Cross-source
  CROSS_SOURCE = 'cross_source', // Links between platforms
}

/**
 * Base query structure
 */
export const BaseQuerySchema = z.object({
  id: z.string(),
  type: z.nativeEnum(QueryType),
  question: z.string(),
  difficulty: z.enum(['easy', 'medium', 'hard']).optional(),
  required_sources: z.array(z.nativeEnum(Platform)).optional(),
  tags: z.array(z.string()).optional(),
});

export type BaseQuery = z.infer<typeof BaseQuerySchema>;

/**
 * Single-hop query (fact recall)
 * "누가 이슈 #123을 생성했나?"
 */
export const SingleHopQuerySchema = BaseQuerySchema.extend({
  type: z.literal(QueryType.SINGLE_HOP),
  expected_answer: z.string(),
  expected_entity_type: z.string().optional(), // user, issue, etc.
});

export type SingleHopQuery = z.infer<typeof SingleHopQuerySchema>;

/**
 * Multi-hop query (relationship inference)
 * "이슈 #123을 생성한 사람이 참여한 다른 프로젝트는?"
 */
export const MultiHopQuerySchema = BaseQuerySchema.extend({
  type: z.literal(QueryType.MULTI_HOP),
  expected_answer: z.union([z.string(), z.array(z.string())]),
  reasoning_path: z.array(z.string()).optional(), // Step-by-step path
  hop_count: z.number().optional(),
});

export type MultiHopQuery = z.infer<typeof MultiHopQuerySchema>;

/**
 * Temporal query (time-based reasoning)
 * "버그 리포트가 급증한 시기는?" / "지난 주 가장 활발한 contributor는?"
 */
export const TemporalQuerySchema = BaseQuerySchema.extend({
  type: z.literal(QueryType.TEMPORAL),
  expected_answer: z.string(),
  time_range: z
    .object({
      start: z.string().datetime().optional(),
      end: z.string().datetime().optional(),
      relative: z.string().optional(), // "last_week", "last_month"
    })
    .optional(),
  temporal_operator: z
    .enum(['before', 'after', 'between', 'during', 'sequence', 'duration'])
    .optional(),
});

export type TemporalQuery = z.infer<typeof TemporalQuerySchema>;

/**
 * Aggregation query (frequency/count)
 * "가장 많이 언급된 이슈는?" / "API rate limit 불만이 몇 건?"
 */
export const AggregationQuerySchema = BaseQuerySchema.extend({
  type: z.literal(QueryType.AGGREGATION),
  expected_answer: z.union([z.string(), z.number()]),
  expected_count_range: z.tuple([z.number(), z.number()]).optional(), // [min, max]
  expected_sources: z.record(z.nativeEnum(Platform), z.number()).optional(), // Per-source counts
  aggregation_type: z.enum(['count', 'top_k', 'distribution', 'trend']),
});

export type AggregationQuery = z.infer<typeof AggregationQuerySchema>;

/**
 * Filtered aggregation query (with noise removal)
 * "우리 제품 관련 API 이슈만 몇 건?" (external API 이슈 제외)
 */
export const FilteredAggregationQuerySchema = BaseQuerySchema.extend({
  type: z.literal(QueryType.FILTERED_AGGREGATION),
  expected_answer: z.union([z.string(), z.number()]),
  expected_count_range: z.tuple([z.number(), z.number()]).optional(),
  filter_criteria: z.object({
    include: z.array(z.string()).optional(), // Must match
    exclude: z.array(z.string()).optional(), // Must not match
    context_required: z.string().optional(), // "our_product", "internal"
  }),
  excluded_items: z.array(z.string()).optional(), // Expected noise to filter out
});

export type FilteredAggregationQuery = z.infer<typeof FilteredAggregationQuerySchema>;

/**
 * Ranked query (sorted by importance/urgency)
 * "시급도 순으로 상위 3개 이슈는?"
 */
export const RankedQuerySchema = BaseQuerySchema.extend({
  type: z.literal(QueryType.RANKED),
  expected_answer: z.array(z.string()),
  top_k: z.number(),
  ranking_factors: z.array(z.enum(['frequency', 'recency', 'severity', 'sentiment', 'impact'])),
  expected_scores: z.record(z.string(), z.number()).optional(), // Item -> score
});

export type RankedQuery = z.infer<typeof RankedQuerySchema>;

/**
 * Attribution query (source tracking)
 * "API rate limit 관련 출처는?"
 */
export const AttributionQuerySchema = BaseQuerySchema.extend({
  type: z.literal(QueryType.ATTRIBUTION),
  expected_answer: z.string(),
  expected_sources: z.record(z.string(), z.number()), // source_id -> count
  expected_citations: z
    .array(
      z.object({
        source_id: z.string(),
        platform: z.nativeEnum(Platform),
        snippet: z.string().optional(),
      })
    )
    .optional(),
});

export type AttributionQuery = z.infer<typeof AttributionQuerySchema>;

/**
 * Cross-source query (links between platforms)
 * "이 Slack 논의에서 시작된 GitHub PR은?"
 */
export const CrossSourceQuerySchema = BaseQuerySchema.extend({
  type: z.literal(QueryType.CROSS_SOURCE),
  expected_answer: z.union([z.string(), z.array(z.string())]),
  source_platform: z.nativeEnum(Platform),
  target_platform: z.nativeEnum(Platform),
  link_type: z.enum(['triggered', 'referenced', 'resolved', 'discussed', 'related']).optional(),
});

export type CrossSourceQuery = z.infer<typeof CrossSourceQuerySchema>;

/**
 * Union of all query types
 */
export const BenchmarkQuerySchema = z.discriminatedUnion('type', [
  SingleHopQuerySchema,
  MultiHopQuerySchema,
  TemporalQuerySchema,
  AggregationQuerySchema,
  FilteredAggregationQuerySchema,
  RankedQuerySchema,
  AttributionQuerySchema,
  CrossSourceQuerySchema,
]);

export type BenchmarkQuery = z.infer<typeof BenchmarkQuerySchema>;

// -----------------------------------------------------------------------------
// 3. BENCHMARK DATASET STRUCTURE
// -----------------------------------------------------------------------------

/**
 * Complete benchmark dataset
 */
export const BenchmarkDatasetSchema = z.object({
  // Metadata
  id: z.string(),
  name: z.string(),
  version: z.string(),
  description: z.string().optional(),
  created_at: z.string().datetime(),

  // Configuration
  config: z.object({
    time_range: z.object({
      start: z.string().datetime(),
      end: z.string().datetime(),
    }),
    platforms: z.array(z.nativeEnum(Platform)),
    workspace_id: z.string().optional(),
  }),

  // Source data
  events: z.array(PlatformEventSchema),

  // Evaluation queries
  queries: z.array(BenchmarkQuerySchema),

  // Statistics
  stats: z
    .object({
      total_events: z.number(),
      events_by_platform: z.record(z.nativeEnum(Platform), z.number()),
      total_queries: z.number(),
      queries_by_type: z.record(z.nativeEnum(QueryType), z.number()),
    })
    .optional(),
});

export type BenchmarkDataset = z.infer<typeof BenchmarkDatasetSchema>;

// -----------------------------------------------------------------------------
// 4. EVALUATION RESULT TYPES
// -----------------------------------------------------------------------------

/**
 * Single query evaluation result
 */
export const QueryResultSchema = z.object({
  query_id: z.string(),
  query_type: z.nativeEnum(QueryType),

  // Predicted vs Expected
  predicted_answer: z.unknown(),
  expected_answer: z.unknown(),

  // Correctness
  is_correct: z.boolean(),
  partial_score: z.number().min(0).max(1).optional(), // For partial matches

  // Attribution quality (if applicable)
  attribution: z
    .object({
      sources_found: z.array(z.string()),
      sources_expected: z.array(z.string()),
      precision: z.number(),
      recall: z.number(),
    })
    .optional(),

  // Performance
  latency_ms: z.number(),
  tokens_used: z.number().optional(),

  // Debug info
  retrieved_chunks: z.array(z.string()).optional(),
  reasoning_trace: z.string().optional(),
});

export type QueryResult = z.infer<typeof QueryResultSchema>;

/**
 * Aggregated evaluation metrics
 */
export const EvaluationMetricsSchema = z.object({
  // Overall accuracy
  overall_accuracy: z.number(),
  overall_f1: z.number().optional(),

  // Per-query-type accuracy
  accuracy_by_type: z.record(z.nativeEnum(QueryType), z.number()),

  // Specific metrics
  single_hop_accuracy: z.number().optional(),
  multi_hop_accuracy: z.number().optional(),
  temporal_accuracy: z.number().optional(),
  aggregation_accuracy: z.number().optional(),
  cross_source_accuracy: z.number().optional(),

  // Attribution metrics
  attribution_precision: z.number().optional(),
  attribution_recall: z.number().optional(),
  attribution_f1: z.number().optional(),

  // Ranking metrics
  ranking_ndcg: z.number().optional(), // Normalized Discounted Cumulative Gain
  ranking_mrr: z.number().optional(), // Mean Reciprocal Rank

  // Performance metrics
  avg_latency_ms: z.number(),
  p50_latency_ms: z.number(),
  p95_latency_ms: z.number(),
  total_tokens_used: z.number().optional(),
});

export type EvaluationMetrics = z.infer<typeof EvaluationMetricsSchema>;

/**
 * Complete evaluation report
 */
export const EvaluationReportSchema = z.object({
  // Identifiers
  id: z.string(),
  experiment_id: z.string().optional(),
  benchmark_id: z.string(),
  timestamp: z.string().datetime(),

  // Configuration used
  config: z.record(z.unknown()).optional(),

  // Results
  results: z.array(QueryResultSchema),
  metrics: EvaluationMetricsSchema,

  // Comparison (if baseline exists)
  comparison: z
    .object({
      baseline_id: z.string(),
      accuracy_delta: z.number(),
      latency_delta: z.number(),
      improvements: z.array(z.string()),
      regressions: z.array(z.string()),
    })
    .optional(),
});

export type EvaluationReport = z.infer<typeof EvaluationReportSchema>;

// -----------------------------------------------------------------------------
// 5. HELPER FUNCTIONS
// -----------------------------------------------------------------------------

/**
 * Create a new benchmark dataset
 */
export function createBenchmarkDataset(params: Omit<BenchmarkDataset, 'stats'>): BenchmarkDataset {
  const events = params.events;
  const queries = params.queries;

  // Calculate stats
  const eventsByPlatform: Record<Platform, number> = {} as Record<Platform, number>;
  for (const event of events) {
    eventsByPlatform[event.platform] = (eventsByPlatform[event.platform] || 0) + 1;
  }

  const queriesByType: Record<QueryType, number> = {} as Record<QueryType, number>;
  for (const query of queries) {
    queriesByType[query.type] = (queriesByType[query.type] || 0) + 1;
  }

  return {
    ...params,
    stats: {
      total_events: events.length,
      events_by_platform: eventsByPlatform,
      total_queries: queries.length,
      queries_by_type: queriesByType,
    },
  };
}

/**
 * Calculate evaluation metrics from results
 */
export function calculateMetrics(results: QueryResult[]): EvaluationMetrics {
  const total = results.length;
  const correct = results.filter((r) => r.is_correct).length;

  // Group by type
  const byType: Record<QueryType, QueryResult[]> = {} as Record<QueryType, QueryResult[]>;
  for (const result of results) {
    if (!byType[result.query_type]) {
      byType[result.query_type] = [];
    }
    byType[result.query_type].push(result);
  }

  // Calculate per-type accuracy
  const accuracyByType: Record<QueryType, number> = {} as Record<QueryType, number>;
  for (const [type, typeResults] of Object.entries(byType)) {
    const typeCorrect = typeResults.filter((r) => r.is_correct).length;
    accuracyByType[type as QueryType] =
      typeResults.length > 0 ? typeCorrect / typeResults.length : 0;
  }

  // Calculate attribution metrics
  const attributionResults = results.filter((r) => r.attribution);
  let attrPrecision = 0;
  let attrRecall = 0;
  if (attributionResults.length > 0) {
    attrPrecision =
      attributionResults.reduce((sum, r) => sum + (r.attribution?.precision || 0), 0) /
      attributionResults.length;
    attrRecall =
      attributionResults.reduce((sum, r) => sum + (r.attribution?.recall || 0), 0) /
      attributionResults.length;
  }
  const attrF1 =
    attrPrecision + attrRecall > 0
      ? (2 * attrPrecision * attrRecall) / (attrPrecision + attrRecall)
      : 0;

  // Calculate latency stats
  const latencies = results.map((r) => r.latency_ms).sort((a, b) => a - b);
  const avgLatency = latencies.reduce((sum, l) => sum + l, 0) / latencies.length;
  const p50Latency = latencies[Math.floor(latencies.length * 0.5)] || 0;
  const p95Latency = latencies[Math.floor(latencies.length * 0.95)] || 0;

  return {
    overall_accuracy: total > 0 ? correct / total : 0,
    accuracy_by_type: accuracyByType,
    single_hop_accuracy: accuracyByType[QueryType.SINGLE_HOP],
    multi_hop_accuracy: accuracyByType[QueryType.MULTI_HOP],
    temporal_accuracy: accuracyByType[QueryType.TEMPORAL],
    aggregation_accuracy: accuracyByType[QueryType.AGGREGATION],
    cross_source_accuracy: accuracyByType[QueryType.CROSS_SOURCE],
    attribution_precision: attrPrecision,
    attribution_recall: attrRecall,
    attribution_f1: attrF1,
    avg_latency_ms: avgLatency,
    p50_latency_ms: p50Latency,
    p95_latency_ms: p95Latency,
    total_tokens_used: results.reduce((sum, r) => sum + (r.tokens_used || 0), 0),
  };
}
