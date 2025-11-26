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
