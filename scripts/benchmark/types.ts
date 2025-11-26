/**
 * Benchmark Types
 *
 * Common types for pipeline stage benchmarking
 */

export interface BenchmarkConfig {
  name: string;
  description: string;
  iterations?: number; // Number of times to run (default: 1)
  warmup?: boolean; // Run warmup iteration (default: false)
}

export interface BenchmarkMetrics {
  duration_ms: number;
  throughput?: number; // items per second
  memory_mb?: number;
  cost_usd?: number;
}

export interface BenchmarkResult {
  config: BenchmarkConfig;
  stage: string;
  timestamp: string;
  metrics: BenchmarkMetrics;
  details: Record<string, unknown>;
}

export interface ComparisonResult {
  baseline: BenchmarkResult;
  experiment: BenchmarkResult;
  diff: {
    duration_ms: number;
    duration_pct: number;
    throughput_pct?: number;
    cost_pct?: number;
  };
  winner: 'baseline' | 'experiment' | 'tie';
}

// Chunking-specific types
export interface ChunkingBenchmarkConfig extends BenchmarkConfig {
  strategy: 'fixed-size' | 'semantic' | 'relational';
  maxChunkSize: number;
  overlap: number;
}

export interface ChunkingBenchmarkResult extends BenchmarkResult {
  stage: 'chunking';
  details: {
    strategy: string;
    total_objects: number;
    total_chunks: number;
    avg_chunk_size: number;
    min_chunk_size: number;
    max_chunk_size: number;
    chunks_per_object: number;
  };
}

// Embedding-specific types
export interface EmbeddingBenchmarkConfig extends BenchmarkConfig {
  model: string;
  dimensions: number;
  batchSize: number;
}

export interface EmbeddingBenchmarkResult extends BenchmarkResult {
  stage: 'embedding';
  details: {
    model: string;
    total_chunks: number;
    total_tokens: number;
    tokens_per_chunk: number;
    cost_per_1k_tokens: number;
  };
}

// Relation Inference-specific types
export interface RelationInferenceBenchmarkConfig extends BenchmarkConfig {
  method: 'explicit' | 'semantic' | 'keyword' | 'contrastive_icl' | 'hybrid';
  similarityThreshold?: number;
  keywordOverlapThreshold?: number;
}

export interface RelationInferenceBenchmarkResult extends BenchmarkResult {
  stage: 'relation_inference';
  details: {
    method: string;
    total_objects: number;
    total_relations: number;
    f1_score: number;
    precision: number;
    recall: number;
    true_positives: number;
    false_positives: number;
    false_negatives: number;
  };
}
