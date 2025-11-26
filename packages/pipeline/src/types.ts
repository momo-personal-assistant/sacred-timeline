/**
 * Pipeline Types
 *
 * Core types for the pipeline orchestration system.
 */

import type { Chunk, ChunkingStats } from '@momo/chunking';
import type { Relation } from '@momo/graph';
import type { CanonicalObject } from '@unified-memory/shared/types/canonical';

// ============================================================
// Pipeline Configuration
// ============================================================

export interface PipelineConfig {
  name: string;
  description: string;

  chunking: {
    strategy: 'fixed-size' | 'semantic' | 'relational';
    maxChunkSize: number;
    overlap: number;
    preserveMetadata: boolean;
  };

  embedding: {
    model: string;
    dimensions: number;
    batchSize: number;
  };

  relationInference: {
    similarityThreshold: number;
    keywordOverlapThreshold: number;
    includeInferred: boolean;
    useSemanticSimilarity: boolean;
    semanticWeight: number;
    useContrastiveICL?: boolean;
  };

  validation: {
    runOnSave: boolean;
    autoSaveExperiment: boolean;
    scenarios: string[];
  };

  metadata: {
    baseline: boolean;
    git_commit?: string | null;
    paper_ids?: string[];
  };
}

// ============================================================
// Pipeline Context (State passed between stages)
// ============================================================

export interface PipelineContext {
  config: PipelineConfig;
  startTime: number;

  // Data flowing through stages
  objects: CanonicalObject[];
  chunks: Chunk[];
  embeddings: Map<string, number[]>; // chunk_id -> embedding
  inferredRelations?: Relation[]; // Inferred relations from validation stage

  // Stats collected along the way
  stats: {
    chunking?: ChunkingStats;
    embedding?: {
      totalTokens: number;
      costUsd: number;
    };
    graph?: GraphMetrics;
    retrieval?: RetrievalMetrics;
    validation?: ValidationMetrics;
    temporal?: TemporalMetrics;
  };

  // Database pool reference
  db: any; // UnifiedMemoryDB instance

  // Activity log
  activityLogId?: number;
  experimentId?: number;
}

export interface ValidationMetrics {
  f1_score: number;
  precision: number;
  recall: number;
  true_positives: number;
  false_positives: number;
  false_negatives: number;
}

export interface RetrievalMetrics {
  ndcg_at_10: number;
  mrr: number; // Mean Reciprocal Rank
  precision_at_5: number;
  recall_at_10: number;
  total_queries: number;
  avg_retrieval_time_ms: number;
}

export interface GraphMetrics {
  node_count: number;
  edge_count: number;
  graph_density: number;
  avg_clustering_coefficient: number;
  connected_components: number;
  avg_degree: number;
  max_degree: number;
  top_central_nodes: Array<{ node_id: string; degree: number }>;
}

export interface TemporalMetrics {
  temporal_coverage_days: number; // Time span from oldest to newest
  avg_object_age_days: number; // Average age of objects
  median_object_age_days: number; // Median age of objects
  oldest_object_age_days: number; // Age of oldest object
  newest_object_age_days: number; // Age of newest object
  objects_per_time_bucket: Record<string, number>; // Distribution across time buckets
  recency_score: number; // 0-1 score, higher = more recent data
  temporal_clustering_coefficient: number; // How clustered objects are in time
}

// ============================================================
// Pipeline Stage Interface
// ============================================================

export interface PipelineStage<TInput = PipelineContext, TOutput = PipelineContext> {
  readonly name: string;
  readonly description: string;

  /**
   * Execute this stage
   */
  execute(context: TInput): Promise<TOutput>;

  /**
   * Optional: Check if this stage should run
   */
  shouldRun?(context: TInput): boolean;
}

// ============================================================
// Pipeline Result
// ============================================================

export interface PipelineResult {
  success: boolean;
  config: PipelineConfig;
  duration_ms: number;
  timestamp: string;

  stats: {
    objects: number;
    chunks: number;
    embeddings: number;
  };

  metrics?: ValidationMetrics;

  experimentId?: number;
  error?: string;
}

// ============================================================
// Stage-specific Types
// ============================================================

export interface ChunkingStageResult {
  chunks: Chunk[];
  stats: ChunkingStats;
}

export interface EmbeddingStageResult {
  embeddings: Map<string, number[]>;
  totalTokens: number;
  costUsd: number;
}

export interface StorageStageResult {
  chunksStored: number;
  relationsStored: number;
}

export interface ValidationStageResult {
  metrics: ValidationMetrics;
  groundTruthCount: number;
  inferredCount: number;
}

export interface RetrievalStageResult {
  metrics: RetrievalMetrics;
  queriesEvaluated: number;
}

export interface GraphStageResult {
  metrics: GraphMetrics;
  nodesAnalyzed: number;
}

export interface TemporalStageResult {
  metrics: TemporalMetrics;
  objectsAnalyzed: number;
}
