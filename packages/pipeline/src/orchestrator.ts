/**
 * Pipeline Orchestrator
 *
 * Orchestrates the execution of pipeline stages in sequence.
 * Provides hooks for monitoring, logging, and error handling.
 */

import { execSync } from 'child_process';

import type { CanonicalObject } from '@unified-memory/shared/types/canonical';

import { ChunkingStage } from './stages/chunking-stage';
import { EmbeddingStage } from './stages/embedding-stage';
import { GraphComputationStage } from './stages/graph-computation-stage';
import { RetrievalStage } from './stages/retrieval-stage';
import { StorageStage } from './stages/storage-stage';
import { TemporalAnalysisStage } from './stages/temporal-analysis-stage';
import { ValidationStage } from './stages/validation-stage';
import type { PipelineConfig, PipelineContext, PipelineResult, PipelineStage } from './types';

export interface OrchestratorOptions {
  /** OpenAI API key for embedding stage */
  openaiApiKey?: string;
  /** Skip validation stage even if configured */
  skipValidation?: boolean;
  /** Skip storage stage (dry run) */
  skipStorage?: boolean;
  /** Custom stages to use instead of defaults */
  stages?: PipelineStage[];
  /** Callback for stage start */
  onStageStart?: (stageName: string) => void;
  /** Callback for stage completion */
  onStageComplete?: (stageName: string, durationMs: number) => void;
  /** Callback for stage error */
  onStageError?: (stageName: string, error: Error) => void;
}

export class PipelineOrchestrator {
  private stages: PipelineStage[];
  private options: OrchestratorOptions;

  constructor(options: OrchestratorOptions = {}) {
    this.options = options;

    // Use custom stages or build default pipeline
    if (options.stages) {
      this.stages = options.stages;
    } else {
      this.stages = this.buildDefaultPipeline();
    }
  }

  /**
   * Build the default pipeline stages
   */
  private buildDefaultPipeline(): PipelineStage[] {
    const stages: PipelineStage[] = [
      new ChunkingStage(),
      new EmbeddingStage(this.options.openaiApiKey),
    ];

    if (!this.options.skipStorage) {
      stages.push(new StorageStage());
    }

    // Add RetrievalStage before ValidationStage
    if (!this.options.skipValidation) {
      stages.push(new RetrievalStage());
    }

    if (!this.options.skipValidation) {
      stages.push(new ValidationStage());
    }

    // Add GraphComputationStage after ValidationStage (uses inferred relations)
    if (!this.options.skipValidation) {
      stages.push(new GraphComputationStage());
    }

    // Add TemporalAnalysisStage to analyze temporal patterns
    if (!this.options.skipValidation) {
      stages.push(new TemporalAnalysisStage());
    }

    return stages;
  }

  /**
   * Execute the full pipeline
   */
  async execute(
    config: PipelineConfig,
    db: any,
    objects?: CanonicalObject[]
  ): Promise<PipelineResult> {
    const startTime = Date.now();

    // Initialize context
    let context: PipelineContext = {
      config,
      startTime,
      objects: objects || [],
      chunks: [],
      embeddings: new Map(),
      stats: {},
      db,
    };

    // Load objects if not provided
    if (context.objects.length === 0) {
      context.objects = await db.searchCanonicalObjects({}, 1000);
    }

    if (context.objects.length === 0) {
      return {
        success: false,
        config,
        duration_ms: Date.now() - startTime,
        timestamp: new Date().toISOString(),
        stats: { objects: 0, chunks: 0, embeddings: 0 },
        error: 'No canonical objects found',
      };
    }

    // Create experiment record BEFORE pipeline execution (if configured)
    let experimentId: number | undefined;
    if (config.validation.autoSaveExperiment) {
      experimentId = await this.createExperimentRecord(context, db);
      context.experimentId = experimentId;
    }

    // Log pipeline start
    await this.logPipelineActivity(context, 'start', {
      config_name: config.name,
      objects_count: context.objects.length,
      experiment_id: experimentId,
    });

    try {
      // Execute each stage
      for (const stage of this.stages) {
        // Check if stage should run
        if (stage.shouldRun && !stage.shouldRun(context)) {
          continue;
        }

        const stageStart = Date.now();
        this.options.onStageStart?.(stage.name);

        try {
          context = await stage.execute(context);
          const stageDuration = Date.now() - stageStart;
          this.options.onStageComplete?.(stage.name, stageDuration);
        } catch (error) {
          this.options.onStageError?.(stage.name, error as Error);
          throw error;
        }
      }

      // Update experiment with results if configured
      if (experimentId && config.validation.autoSaveExperiment) {
        await this.updateExperimentResults(context, experimentId);
      }

      const duration = Date.now() - startTime;

      // Log pipeline completion
      await this.logPipelineActivity(context, 'complete', {
        config_name: config.name,
        duration_ms: duration,
        metrics: context.stats.validation,
        experiment_id: experimentId,
      });

      return {
        success: true,
        config,
        duration_ms: duration,
        timestamp: new Date().toISOString(),
        stats: {
          objects: context.objects.length,
          chunks: context.chunks.length,
          embeddings: context.embeddings.size,
        },
        metrics: context.stats.validation,
        experimentId,
      };
    } catch (error) {
      const duration = Date.now() - startTime;

      // Log pipeline failure
      await this.logPipelineActivity(context, 'failed', {
        config_name: config.name,
        error: error instanceof Error ? error.message : String(error),
      });

      return {
        success: false,
        config,
        duration_ms: duration,
        timestamp: new Date().toISOString(),
        stats: {
          objects: context.objects.length,
          chunks: context.chunks.length,
          embeddings: context.embeddings.size,
        },
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Create experiment record at the start of pipeline execution
   */
  private async createExperimentRecord(context: PipelineContext, db: any): Promise<number> {
    const { config } = context;
    const pool = (db as any).pool;

    const gitCommit = this.getGitCommit();

    const result = await pool.query(
      `INSERT INTO experiments (
        name, description, config, is_baseline, paper_ids, git_commit, status, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, 'running', NOW())
      ON CONFLICT (name) DO UPDATE SET
        description = EXCLUDED.description,
        config = EXCLUDED.config,
        is_baseline = EXCLUDED.is_baseline,
        paper_ids = EXCLUDED.paper_ids,
        git_commit = EXCLUDED.git_commit,
        status = 'running'
      RETURNING id`,
      [
        config.name,
        config.description,
        JSON.stringify(config),
        config.metadata.baseline,
        config.metadata.paper_ids || [],
        gitCommit,
      ]
    );

    return result.rows[0].id;
  }

  /**
   * Update experiment with final results after pipeline completion
   */
  private async updateExperimentResults(
    context: PipelineContext,
    experimentId: number
  ): Promise<void> {
    const { stats, db } = context;
    const pool = (db as any).pool;

    // Update experiment status to completed
    await pool.query(
      `UPDATE experiments
       SET status = 'completed', run_completed_at = NOW()
       WHERE id = $1`,
      [experimentId]
    );

    // Insert experiment results if we have validation metrics
    if (stats.validation) {
      const groundTruthTotal = stats.validation.true_positives + stats.validation.false_negatives;
      const inferredTotal = stats.validation.true_positives + stats.validation.false_positives;

      await pool.query(
        `INSERT INTO experiment_results (
          experiment_id, scenario, f1_score, precision, recall,
          true_positives, false_positives, false_negatives,
          ground_truth_total, inferred_total, retrieval_time_ms, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
        ON CONFLICT (experiment_id, scenario) DO UPDATE SET
          f1_score = EXCLUDED.f1_score,
          precision = EXCLUDED.precision,
          recall = EXCLUDED.recall,
          true_positives = EXCLUDED.true_positives,
          false_positives = EXCLUDED.false_positives,
          false_negatives = EXCLUDED.false_negatives,
          ground_truth_total = EXCLUDED.ground_truth_total,
          inferred_total = EXCLUDED.inferred_total,
          retrieval_time_ms = EXCLUDED.retrieval_time_ms`,
        [
          experimentId,
          'normal',
          stats.validation.f1_score,
          stats.validation.precision,
          stats.validation.recall,
          stats.validation.true_positives,
          stats.validation.false_positives,
          stats.validation.false_negatives,
          groundTruthTotal,
          inferredTotal,
          Date.now() - context.startTime,
        ]
      );
    }
  }

  /**
   * Log pipeline activity
   */
  private async logPipelineActivity(
    context: PipelineContext,
    action: 'start' | 'complete' | 'failed',
    details: Record<string, unknown>
  ): Promise<void> {
    const pool = (context.db as any).pool;
    if (!pool) return;

    const status = action === 'failed' ? 'failed' : action === 'start' ? 'started' : 'completed';
    const description =
      action === 'start'
        ? `Started pipeline: ${details.config_name}`
        : action === 'complete'
          ? `Completed pipeline: ${details.config_name} (${details.duration_ms}ms)`
          : `Failed pipeline: ${details.config_name}`;

    try {
      await pool.query(
        `INSERT INTO research_activity_log (
          operation_type, operation_name, description, status, triggered_by, details, git_commit, experiment_id
        ) VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8)`,
        [
          'pipeline_run',
          'pipeline-orchestrator',
          description,
          status,
          'pipeline',
          JSON.stringify(details),
          this.getGitCommit(),
          context.experimentId || null,
        ]
      );
    } catch {
      // Ignore logging errors
    }
  }

  /**
   * Get current git commit hash
   */
  private getGitCommit(): string | null {
    try {
      return execSync('git rev-parse HEAD').toString().trim();
    } catch {
      return null;
    }
  }

  /**
   * Get the list of stages in the pipeline
   */
  getStages(): readonly PipelineStage[] {
    return this.stages;
  }

  /**
   * Add a stage to the pipeline
   */
  addStage(stage: PipelineStage, index?: number): void {
    if (index !== undefined) {
      this.stages.splice(index, 0, stage);
    } else {
      this.stages.push(stage);
    }
  }

  /**
   * Remove a stage from the pipeline by name
   */
  removeStage(stageName: string): boolean {
    const index = this.stages.findIndex((s) => s.name === stageName);
    if (index >= 0) {
      this.stages.splice(index, 1);
      return true;
    }
    return false;
  }
}
