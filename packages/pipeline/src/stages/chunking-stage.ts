/**
 * Chunking Stage
 *
 * Transforms canonical objects into chunks using configured strategy.
 */

import { Chunker } from '@momo/chunking';

import type { PipelineContext, PipelineStage, ChunkingStageResult } from '../types';

export class ChunkingStage implements PipelineStage {
  readonly name = 'chunking';
  readonly description = 'Transform objects into chunks';

  async execute(context: PipelineContext): Promise<PipelineContext> {
    const { config, objects } = context;

    if (objects.length === 0) {
      throw new Error('No objects to chunk. Ensure objects are loaded first.');
    }

    const chunker = new Chunker({
      strategy: config.chunking.strategy,
      maxChunkSize: config.chunking.maxChunkSize,
      overlap: config.chunking.overlap,
      preserveMetadata: config.chunking.preserveMetadata,
    });

    // Chunk all objects
    const chunks = objects.flatMap((obj) => chunker.chunk(obj));
    const stats = chunker.getStats(chunks);

    // Log activity
    await this.logActivity(context, {
      objects_count: objects.length,
      chunks_count: chunks.length,
      chunking_stats: stats,
      chunking_config: config.chunking,
    });

    // Persist layer metrics if experiment ID is available
    if (context.experimentId) {
      await this.persistLayerMetrics(context, stats, chunks.length);
    }

    return {
      ...context,
      chunks,
      stats: {
        ...context.stats,
        chunking: stats,
      },
    };
  }

  shouldRun(context: PipelineContext): boolean {
    return context.objects.length > 0;
  }

  private async logActivity(
    context: PipelineContext,
    details: Record<string, unknown>
  ): Promise<void> {
    const pool = (context.db as any).pool;
    if (!pool) return;

    try {
      await pool.query(
        `INSERT INTO research_activity_log (
          operation_type, operation_name, description, status, triggered_by, details, experiment_id
        ) VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7)`,
        [
          'pipeline_stage',
          this.name,
          `Chunked ${details.objects_count} objects into ${details.chunks_count} chunks`,
          'completed',
          'pipeline',
          JSON.stringify(details),
          context.experimentId || null,
        ]
      );
    } catch {
      // Ignore logging errors
    }
  }

  /**
   * Persist chunking layer metrics to layer_metrics table
   */
  private async persistLayerMetrics(
    context: PipelineContext,
    stats: any,
    chunksCount: number
  ): Promise<void> {
    const pool = (context.db as any).pool;
    if (!pool || !context.experimentId) return;

    const startTime = Date.now();

    try {
      const metrics = {
        total_chunks: chunksCount,
        total_objects: context.objects.length,
        avg_chunk_size: stats.avgSize || 0,
        min_chunk_size: stats.minSize || 0,
        max_chunk_size: stats.maxSize || 0,
        chunks_per_object: chunksCount / context.objects.length,
        total_characters: stats.totalSize || 0,
      };

      await pool.query(
        `INSERT INTO layer_metrics (experiment_id, layer, evaluation_method, metrics, duration_ms)
         VALUES ($1, $2, $3, $4::jsonb, $5)
         ON CONFLICT (experiment_id, layer, evaluation_method)
         DO UPDATE SET
           metrics = $4::jsonb,
           duration_ms = $5,
           created_at = NOW()`,
        [
          context.experimentId,
          'chunking',
          'ground_truth',
          JSON.stringify(metrics),
          Date.now() - startTime,
        ]
      );
    } catch (error) {
      // Log but don't fail the pipeline
      console.error('Failed to persist chunking metrics:', error);
    }
  }

  /**
   * Run chunking stage standalone and return results
   */
  async runStandalone(context: PipelineContext): Promise<ChunkingStageResult> {
    const result = await this.execute(context);
    return {
      chunks: result.chunks,
      stats: result.stats.chunking!,
    };
  }
}
