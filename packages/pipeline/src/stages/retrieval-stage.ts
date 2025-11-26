/**
 * Retrieval Stage
 *
 * Evaluates retrieval quality against ground truth queries.
 */

import { OpenAIEmbedder } from '@momo/embedding/openai-embedder';
import { Retriever } from '@momo/query/retriever';

import type {
  PipelineContext,
  PipelineStage,
  RetrievalMetrics,
  RetrievalStageResult,
} from '../types';

interface GroundTruthQuery {
  id: number;
  query_text: string;
  scenario: string;
  expected_results: Array<{
    canonical_object_id: string;
    relevance_score: number;
  }>;
}

export class RetrievalStage implements PipelineStage {
  readonly name = 'retrieval';
  readonly description = 'Evaluate retrieval quality against ground truth';

  async execute(context: PipelineContext): Promise<PipelineContext> {
    const { config, db } = context;
    const pool = (db as any).pool;
    const startTime = Date.now();

    // Initialize embedder
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      console.warn('[RetrievalStage] OPENAI_API_KEY not set, skipping retrieval evaluation');
      return context;
    }

    const embedder = new OpenAIEmbedder({
      apiKey,
      model: config.embedding.model,
    });

    // Initialize retriever
    const retriever = new Retriever(db, embedder, undefined, {
      similarityThreshold: 0.35,
      chunkLimit: 10,
      includeRelations: false,
    });

    // Fetch ground truth queries
    const queries = await this.fetchGroundTruthQueries(pool, 'normal');

    if (queries.length === 0) {
      console.warn('[RetrievalStage] No ground truth queries found');
      return context;
    }

    console.log(`[RetrievalStage] Evaluating ${queries.length} test queries...`);

    // Evaluate each query
    const queryResults: Array<{
      query: string;
      ndcg_at_10: number;
      reciprocal_rank: number;
      precision_at_5: number;
      recall_at_10: number;
      retrieval_time_ms: number;
    }> = [];

    for (const gtQuery of queries) {
      const result = await retriever.retrieve(gtQuery.query_text);

      // Extract retrieved object IDs
      const retrievedIds = result.chunks.map((c) => c.canonical_object_id);
      const uniqueRetrievedIds = [...new Set(retrievedIds)];

      // Calculate metrics
      const ndcg = this.calculateNDCG(
        uniqueRetrievedIds.slice(0, 10),
        gtQuery.expected_results,
        10
      );
      const rr = this.calculateReciprocalRank(uniqueRetrievedIds, gtQuery.expected_results);
      const p5 = this.calculatePrecisionAtK(
        uniqueRetrievedIds.slice(0, 5),
        gtQuery.expected_results
      );
      const r10 = this.calculateRecallAtK(
        uniqueRetrievedIds.slice(0, 10),
        gtQuery.expected_results
      );

      queryResults.push({
        query: gtQuery.query_text,
        ndcg_at_10: ndcg,
        reciprocal_rank: rr,
        precision_at_5: p5,
        recall_at_10: r10,
        retrieval_time_ms: result.stats.retrieval_time_ms,
      });

      console.log(
        `  Query: "${gtQuery.query_text.substring(0, 40)}..." | NDCG@10: ${ndcg.toFixed(3)} | MRR: ${rr.toFixed(3)}`
      );
    }

    // Aggregate metrics
    const metrics: RetrievalMetrics = {
      ndcg_at_10: this.average(queryResults.map((r) => r.ndcg_at_10)),
      mrr: this.average(queryResults.map((r) => r.reciprocal_rank)),
      precision_at_5: this.average(queryResults.map((r) => r.precision_at_5)),
      recall_at_10: this.average(queryResults.map((r) => r.recall_at_10)),
      total_queries: queries.length,
      avg_retrieval_time_ms: this.average(queryResults.map((r) => r.retrieval_time_ms)),
    };

    const durationMs = Date.now() - startTime;

    console.log(
      `[RetrievalStage] Complete | NDCG@10: ${metrics.ndcg_at_10.toFixed(3)} | MRR: ${metrics.mrr.toFixed(3)} | Precision@5: ${metrics.precision_at_5.toFixed(3)}`
    );

    // Persist layer metrics if experiment ID is available
    if (context.experimentId) {
      await this.persistLayerMetrics(context, metrics, durationMs);
    }

    // Log activity
    await this.logActivity(context, { metrics, queries_evaluated: queries.length });

    return {
      ...context,
      stats: {
        ...context.stats,
        retrieval: metrics,
      },
    };
  }

  shouldRun(context: PipelineContext): boolean {
    return context.config.validation.runOnSave;
  }

  /**
   * Fetch ground truth queries from database
   */
  private async fetchGroundTruthQueries(pool: any, scenario: string): Promise<GroundTruthQuery[]> {
    const result = await pool.query(
      `
      SELECT
        q.id,
        q.query_text,
        q.scenario,
        COALESCE(
          json_agg(
            json_build_object(
              'canonical_object_id', r.canonical_object_id,
              'relevance_score', r.relevance_score
            )
            ORDER BY r.relevance_score DESC
          ) FILTER (WHERE r.canonical_object_id IS NOT NULL),
          '[]'
        ) as expected_results
      FROM ground_truth_queries q
      LEFT JOIN ground_truth_query_results r ON q.id = r.query_id
      WHERE q.scenario = $1
      GROUP BY q.id, q.query_text, q.scenario
      `,
      [scenario]
    );

    return result.rows;
  }

  /**
   * Calculate NDCG@K (Normalized Discounted Cumulative Gain)
   */
  private calculateNDCG(
    retrievedIds: string[],
    expectedResults: Array<{ canonical_object_id: string; relevance_score: number }>,
    k: number
  ): number {
    const relevanceMap = new Map(
      expectedResults.map((r) => [r.canonical_object_id, r.relevance_score])
    );

    // Calculate DCG (Discounted Cumulative Gain)
    let dcg = 0;
    for (let i = 0; i < Math.min(retrievedIds.length, k); i++) {
      const relevance = relevanceMap.get(retrievedIds[i]) || 0;
      dcg += relevance / Math.log2(i + 2); // i+2 because log2(1)=0
    }

    // Calculate IDCG (Ideal DCG) - best possible ranking
    const sortedRelevance = expectedResults.map((r) => r.relevance_score).sort((a, b) => b - a);
    let idcg = 0;
    for (let i = 0; i < Math.min(sortedRelevance.length, k); i++) {
      idcg += sortedRelevance[i] / Math.log2(i + 2);
    }

    return idcg > 0 ? dcg / idcg : 0;
  }

  /**
   * Calculate Reciprocal Rank (for MRR)
   */
  private calculateReciprocalRank(
    retrievedIds: string[],
    expectedResults: Array<{ canonical_object_id: string; relevance_score: number }>
  ): number {
    const relevantIds = new Set(expectedResults.map((r) => r.canonical_object_id));

    for (let i = 0; i < retrievedIds.length; i++) {
      if (relevantIds.has(retrievedIds[i])) {
        return 1 / (i + 1); // Rank starts at 1
      }
    }

    return 0; // No relevant result found
  }

  /**
   * Calculate Precision@K
   */
  private calculatePrecisionAtK(
    retrievedIds: string[],
    expectedResults: Array<{ canonical_object_id: string; relevance_score: number }>
  ): number {
    const relevantIds = new Set(expectedResults.map((r) => r.canonical_object_id));
    const relevantRetrieved = retrievedIds.filter((id) => relevantIds.has(id)).length;

    return retrievedIds.length > 0 ? relevantRetrieved / retrievedIds.length : 0;
  }

  /**
   * Calculate Recall@K
   */
  private calculateRecallAtK(
    retrievedIds: string[],
    expectedResults: Array<{ canonical_object_id: string; relevance_score: number }>
  ): number {
    const relevantIds = new Set(expectedResults.map((r) => r.canonical_object_id));
    const relevantRetrieved = retrievedIds.filter((id) => relevantIds.has(id)).length;

    return relevantIds.size > 0 ? relevantRetrieved / relevantIds.size : 0;
  }

  /**
   * Calculate average of an array
   */
  private average(values: number[]): number {
    return values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
  }

  /**
   * Persist layer metrics to database
   */
  private async persistLayerMetrics(
    context: PipelineContext,
    retrievalMetrics: RetrievalMetrics,
    durationMs: number
  ): Promise<void> {
    const pool = (context.db as any).pool;
    if (!pool || !context.experimentId) return;

    try {
      const metrics = {
        ndcg_at_10: retrievalMetrics.ndcg_at_10,
        mrr: retrievalMetrics.mrr,
        precision_at_5: retrievalMetrics.precision_at_5,
        recall_at_10: retrievalMetrics.recall_at_10,
        total_queries: retrievalMetrics.total_queries,
        avg_retrieval_time_ms: retrievalMetrics.avg_retrieval_time_ms,
      };

      await pool.query(
        `INSERT INTO layer_metrics (experiment_id, layer, evaluation_method, metrics, duration_ms)
         VALUES ($1, $2, $3, $4::jsonb, $5)
         ON CONFLICT (experiment_id, layer, evaluation_method)
         DO UPDATE SET metrics = $4::jsonb, duration_ms = $5, created_at = NOW()`,
        [context.experimentId, 'retrieval', 'ground_truth', JSON.stringify(metrics), durationMs]
      );

      console.log(
        `[RetrievalStage] Persisted layer metrics for experiment ${context.experimentId}: NDCG@10=${(retrievalMetrics.ndcg_at_10 * 100).toFixed(1)}%`
      );
    } catch (error) {
      console.error('Failed to persist retrieval layer metrics:', error);
    }
  }

  /**
   * Log activity
   */
  private async logActivity(
    context: PipelineContext,
    details: Record<string, unknown>
  ): Promise<void> {
    const pool = (context.db as any).pool;
    if (!pool) return;

    const metrics = details.metrics as RetrievalMetrics;
    const description = `Retrieval: NDCG@10=${(metrics.ndcg_at_10 * 100).toFixed(1)}%, MRR=${(metrics.mrr * 100).toFixed(1)}%, P@5=${(metrics.precision_at_5 * 100).toFixed(1)}%`;

    try {
      await pool.query(
        `INSERT INTO research_activity_log (
          operation_type, operation_name, description, status, triggered_by, details, experiment_id
        ) VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7)`,
        [
          'pipeline_stage',
          this.name,
          description,
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
   * Run retrieval stage standalone and return results
   */
  async runStandalone(context: PipelineContext): Promise<RetrievalStageResult> {
    const result = await this.execute(context);

    return {
      metrics: result.stats.retrieval!,
      queriesEvaluated: result.stats.retrieval!.total_queries,
    };
  }
}
