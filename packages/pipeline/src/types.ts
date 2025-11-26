/**
 * Pipeline Types
 *
 * Core types for the pipeline orchestration system.
 */

import type { Chunk, ChunkingStats } from '@momo/chunking';
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

  // Stats collected along the way
  stats: {
    chunking?: ChunkingStats;
    embedding?: {
      totalTokens: number;
      costUsd: number;
    };
    validation?: ValidationMetrics;
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
