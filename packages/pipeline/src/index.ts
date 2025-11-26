/**
 * @momo/pipeline
 *
 * Pipeline orchestration for the Memory Research Tool.
 * Provides modular, testable stages for the RAG pipeline.
 */

// Types
export type {
  PipelineConfig,
  PipelineContext,
  PipelineStage,
  PipelineResult,
  ValidationMetrics,
  ChunkingStageResult,
  EmbeddingStageResult,
  StorageStageResult,
  ValidationStageResult,
} from './types';

// Stages
export { ChunkingStage } from './stages/chunking-stage';
export { EmbeddingStage } from './stages/embedding-stage';
export { StorageStage } from './stages/storage-stage';
export { ValidationStage } from './stages/validation-stage';

// Orchestrator
export { PipelineOrchestrator } from './orchestrator';
export type { OrchestratorOptions } from './orchestrator';
