/**
 * Experiment Configuration Types
 * Maps YAML config structure to TypeScript interfaces
 */

export interface ExperimentConfig {
  name: string;
  description: string;
  created_at?: string;

  embedding: {
    model: string;
    dimensions?: number;
    batchSize?: number;
  };

  chunking: {
    strategy: 'fixed-size' | 'semantic' | 'relational';
    maxChunkSize?: number;
    overlap?: number;
    preserveMetadata?: boolean;
  };

  retrieval: {
    similarityThreshold?: number;
    chunkLimit?: number;
    includeRelations?: boolean;
    relationDepth?: number;
  };

  relationInference: {
    similarityThreshold?: number;
    keywordOverlapThreshold?: number;
    includeInferred?: boolean;
    useSemanticSimilarity?: boolean;
    semanticWeight?: number;
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

export interface ExperimentResult {
  config: ExperimentConfig;
  metrics: {
    f1_score: number;
    precision: number;
    recall: number;
    true_positives: number;
    false_positives: number;
    false_negatives: number;
  };
  chunking_stats: {
    total_chunks: number;
    avg_chunk_size: number;
    min_chunk_size: number;
    max_chunk_size: number;
  };
  embedding_stats: {
    total_tokens: number;
    total_cost_usd: number;
  };
  duration_ms: number;
  timestamp: string;
}
