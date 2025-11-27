/**
 * Validation Stage
 *
 * Validates inferred relations against ground truth.
 */

import { RelationInferrer, type Relation } from '@momo/graph';

import type {
  PipelineContext,
  PipelineStage,
  ValidationMetrics,
  ValidationStageResult,
} from '../types';

export class ValidationStage implements PipelineStage {
  readonly name = 'validation';
  readonly description = 'Validate relations against ground truth';

  async execute(context: PipelineContext): Promise<PipelineContext> {
    const { config, objects, db } = context;

    const pool = (db as any).pool;
    const startTime = Date.now();

    // Initialize relation inferrer
    const inferrer = new RelationInferrer({
      similarityThreshold: config.relationInference.similarityThreshold,
      keywordOverlapThreshold: config.relationInference.keywordOverlapThreshold,
      includeInferred: config.relationInference.includeInferred,
      useSemanticSimilarity: config.relationInference.useSemanticSimilarity,
      semanticWeight: config.relationInference.semanticWeight,
      // EXP-006 Stage 2: Project metadata options
      useProjectMetadata: config.relationInference.useProjectMetadata,
      projectWeight: config.relationInference.projectWeight,
      // EXP-007: Schema-based signal options
      useSchemaSignal: config.relationInference.useSchemaSignal,
      schemaWeight: config.relationInference.schemaWeight,
      // EXP-008: Two-stage threshold options
      useDocumentThreshold: config.relationInference.useDocumentThreshold,
      documentThreshold: config.relationInference.documentThreshold,
      minChunkMatches: config.relationInference.minChunkMatches,
      useContrastiveICL: config.relationInference.useContrastiveICL,
    });

    // Fetch embeddings for each canonical object (average of chunk embeddings)
    const embeddingsMap = new Map<string, number[]>();
    for (const obj of objects) {
      const chunks = await pool.query(
        'SELECT embedding FROM chunks WHERE canonical_object_id = $1 AND embedding IS NOT NULL',
        [obj.id]
      );

      if (chunks.rows.length > 0) {
        const embeddings = chunks.rows.map((row: { embedding: string | number[] }) => {
          const emb = row.embedding;
          if (typeof emb === 'string') return JSON.parse(emb);
          return emb;
        });

        // Average embeddings
        const dimensions = embeddings[0].length;
        const avgEmbedding = new Array(dimensions);
        for (let i = 0; i < dimensions; i++) {
          avgEmbedding[i] =
            embeddings.reduce((sum: number, emb: number[]) => sum + emb[i], 0) / embeddings.length;
        }
        embeddingsMap.set(obj.id, avgEmbedding);
      }
    }

    // Infer relations
    // Note: objects from DB may have string dates, but inferrer only needs id, content, explicit_relations
    let inferred: Relation[];
    if (config.relationInference.useContrastiveICL) {
      const explicit = inferrer.extractExplicit(objects as any);
      const contrastiveRelations = await inferrer.inferSimilarityWithContrastiveICL(objects as any);
      inferred = [...explicit, ...contrastiveRelations];
    } else {
      inferred = inferrer.inferAllWithEmbeddings(objects as any, embeddingsMap);
    }

    // Fetch ground truth - only positive relations (exclude unrelated/uncertain labels)
    const groundTruthResult = await pool.query(
      `SELECT from_id, to_id, relation_type as type FROM ground_truth_relations
       WHERE relation_type NOT IN ('human_verified_unrelated', 'human_uncertain')`
    );
    const groundTruth = groundTruthResult.rows as Relation[];

    // Calculate metrics
    const metrics = this.calculateMetrics(inferred, groundTruth);
    const durationMs = Date.now() - startTime;

    // Persist layer metrics if experiment ID is available
    if (context.experimentId) {
      await this.persistLayerMetrics(
        context,
        metrics,
        inferred.length,
        groundTruth.length,
        embeddingsMap.size,
        durationMs
      );
    }

    // Log activity
    await this.logActivity(context, {
      metrics,
      embeddings_loaded: embeddingsMap.size,
      inferred_relations: inferred.length,
      ground_truth_relations: groundTruth.length,
      relation_inference_config: config.relationInference,
    });

    return {
      ...context,
      inferredRelations: inferred, // Store inferred relations for GraphComputationStage
      stats: {
        ...context.stats,
        validation: metrics,
      },
    };
  }

  shouldRun(context: PipelineContext): boolean {
    return context.config.validation.runOnSave;
  }

  private calculateMetrics(inferred: Relation[], groundTruth: Relation[]): ValidationMetrics {
    // Normalize relation by sorting IDs to handle bidirectional relations
    // NOTE: We ignore relation type for matching - GT says "these are related",
    // inference finds the specific type (explicit, semantic, etc.)
    const normalizeRelation = (rel: Relation) => {
      const [id1, id2] = [rel.from_id, rel.to_id].sort();
      return `${id1}|${id2}`; // Only compare IDs, not type
    };

    const groundTruthSet = new Set(groundTruth.map(normalizeRelation));
    const inferredSet = new Set(inferred.map(normalizeRelation));

    const truePositives = inferred.filter((rel) => groundTruthSet.has(normalizeRelation(rel)));
    const falsePositives = inferred.filter((rel) => !groundTruthSet.has(normalizeRelation(rel)));
    const falseNegatives = groundTruth.filter((rel) => !inferredSet.has(normalizeRelation(rel)));

    const tp = truePositives.length;
    const fp = falsePositives.length;
    const fn = falseNegatives.length;

    const precision = tp + fp > 0 ? tp / (tp + fp) : 0;
    const recall = tp + fn > 0 ? tp / (tp + fn) : 0;
    const f1Score = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;

    return {
      f1_score: f1Score,
      precision,
      recall,
      true_positives: tp,
      false_positives: fp,
      false_negatives: fn,
    };
  }

  private async logActivity(
    context: PipelineContext,
    details: Record<string, unknown>
  ): Promise<void> {
    const pool = (context.db as any).pool;
    if (!pool) return;

    const metrics = details.metrics as ValidationMetrics;
    const description = `Validation: F1=${(metrics.f1_score * 100).toFixed(1)}%, Precision=${(metrics.precision * 100).toFixed(1)}%, Recall=${(metrics.recall * 100).toFixed(1)}%`;

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

  private async persistLayerMetrics(
    context: PipelineContext,
    validationMetrics: ValidationMetrics,
    inferredCount: number,
    groundTruthCount: number,
    embeddingsLoadedCount: number,
    durationMs: number
  ): Promise<void> {
    const pool = (context.db as any).pool;
    if (!pool || !context.experimentId) return;

    try {
      const metrics = {
        f1_score: validationMetrics.f1_score,
        precision: validationMetrics.precision,
        recall: validationMetrics.recall,
        true_positives: validationMetrics.true_positives,
        false_positives: validationMetrics.false_positives,
        false_negatives: validationMetrics.false_negatives,
        inferred_relations: inferredCount,
        ground_truth_relations: groundTruthCount,
        embeddings_loaded: embeddingsLoadedCount,
        retrieval_time_ms: durationMs,
      };

      await pool.query(
        `INSERT INTO layer_metrics (experiment_id, layer, evaluation_method, metrics, duration_ms)
         VALUES ($1, $2, $3, $4::jsonb, $5)
         ON CONFLICT (experiment_id, layer, evaluation_method)
         DO UPDATE SET metrics = $4::jsonb, duration_ms = $5, created_at = NOW()`,
        [context.experimentId, 'validation', 'ground_truth', JSON.stringify(metrics), durationMs]
      );

      console.log(
        `[ValidationStage] Persisted layer metrics for experiment ${context.experimentId}: F1=${(validationMetrics.f1_score * 100).toFixed(1)}%`
      );
    } catch (error) {
      console.error('Failed to persist validation layer metrics:', error);
    }
  }

  /**
   * Run validation stage standalone and return results
   */
  async runStandalone(context: PipelineContext): Promise<ValidationStageResult> {
    const result = await this.execute(context);
    const pool = (context.db as any).pool;

    const groundTruthResult = await pool.query(
      'SELECT COUNT(*) as count FROM ground_truth_relations'
    );
    const groundTruthCount = parseInt(groundTruthResult.rows[0].count);

    return {
      metrics: result.stats.validation!,
      groundTruthCount,
      inferredCount:
        result.stats.validation!.true_positives + result.stats.validation!.false_positives,
    };
  }
}
