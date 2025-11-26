/**
 * Embedding Stage
 *
 * Generates embeddings for chunks using configured model.
 */

import { OpenAIEmbedder } from '@momo/embedding';

import type { PipelineContext, PipelineStage, EmbeddingStageResult } from '../types';

export class EmbeddingStage implements PipelineStage {
  readonly name = 'embedding';
  readonly description = 'Generate embeddings for chunks';

  private apiKey: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.OPENAI_API_KEY || '';
    if (!this.apiKey) {
      throw new Error('OPENAI_API_KEY is required for EmbeddingStage');
    }
  }

  async execute(context: PipelineContext): Promise<PipelineContext> {
    const { config, chunks } = context;

    if (chunks.length === 0) {
      throw new Error('No chunks to embed. Run chunking stage first.');
    }

    const embedder = new OpenAIEmbedder({
      apiKey: this.apiKey,
      model: config.embedding.model,
      dimensions: config.embedding.dimensions,
      batchSize: config.embedding.batchSize,
    });

    // Generate embeddings
    const texts = chunks.map((c) => c.content);
    const result = await embedder.embedBatch(texts);
    const costUsd = embedder.estimateCost(result.totalTokens);

    // Create embeddings map
    const embeddings = new Map<string, number[]>();
    for (let i = 0; i < chunks.length; i++) {
      embeddings.set(chunks[i].id, result.results[i].embedding);
    }

    // Log activity
    await this.logActivity(context, {
      embeddings_count: result.results.length,
      total_tokens: result.totalTokens,
      estimated_cost_usd: costUsd,
      embedding_config: config.embedding,
    });

    // Persist layer metrics if experiment ID is available
    if (context.experimentId) {
      await this.persistLayerMetrics(context, result.totalTokens, costUsd, result.results.length);
    }

    return {
      ...context,
      embeddings,
      stats: {
        ...context.stats,
        embedding: {
          totalTokens: result.totalTokens,
          costUsd,
        },
      },
    };
  }

  shouldRun(context: PipelineContext): boolean {
    return context.chunks.length > 0;
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
          `Generated ${details.embeddings_count} embeddings (${details.total_tokens} tokens, $${(details.estimated_cost_usd as number).toFixed(4)})`,
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
   * Persist embedding layer metrics to layer_metrics table
   */
  private async persistLayerMetrics(
    context: PipelineContext,
    totalTokens: number,
    costUsd: number,
    embeddingsCount: number
  ): Promise<void> {
    const pool = (context.db as any).pool;
    if (!pool || !context.experimentId) return;

    const startTime = Date.now();

    try {
      const metrics = {
        total_embeddings: embeddingsCount,
        total_tokens: totalTokens,
        estimated_cost_usd: costUsd,
        avg_tokens_per_chunk: totalTokens / embeddingsCount,
        embedding_model: context.config.embedding.model,
        dimensions: context.config.embedding.dimensions,
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
          'embedding',
          'ground_truth',
          JSON.stringify(metrics),
          Date.now() - startTime,
        ]
      );
    } catch (error) {
      // Log but don't fail the pipeline
      console.error('Failed to persist embedding metrics:', error);
    }
  }

  /**
   * Run embedding stage standalone and return results
   */
  async runStandalone(context: PipelineContext): Promise<EmbeddingStageResult> {
    const result = await this.execute(context);
    return {
      embeddings: result.embeddings,
      totalTokens: result.stats.embedding!.totalTokens,
      costUsd: result.stats.embedding!.costUsd,
    };
  }
}
