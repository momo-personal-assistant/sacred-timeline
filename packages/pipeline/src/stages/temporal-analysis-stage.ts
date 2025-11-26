/**
 * Temporal Analysis Stage
 *
 * Analyzes temporal patterns in the knowledge graph to understand data freshness,
 * temporal coverage, and time-based clustering of information.
 */

import type {
  PipelineContext,
  PipelineStage,
  TemporalMetrics,
  TemporalStageResult,
} from '../types';

export class TemporalAnalysisStage implements PipelineStage {
  readonly name = 'temporal_analysis';
  readonly description = 'Analyze temporal patterns and data freshness';

  async execute(context: PipelineContext): Promise<PipelineContext> {
    const { objects } = context;
    const startTime = Date.now();

    if (objects.length === 0) {
      console.warn('[TemporalAnalysisStage] No objects found to analyze');
      return context;
    }

    console.log(`[TemporalAnalysisStage] Analyzing ${objects.length} objects...`);

    // Extract timestamps and calculate ages
    const now = new Date();
    const timestamps: Date[] = [];
    const ages: number[] = [];

    for (const obj of objects) {
      // Handle timestamps field which can be a JSONB object or direct field
      const timestampValue = (obj as any).timestamps?.created_at || obj.created_at;
      const createdAt = this.parseTimestamp(timestampValue);
      if (createdAt) {
        timestamps.push(createdAt);
        const ageMs = now.getTime() - createdAt.getTime();
        const ageDays = ageMs / (1000 * 60 * 60 * 24);
        ages.push(ageDays);
      }
    }

    if (timestamps.length === 0) {
      console.warn('[TemporalAnalysisStage] No valid timestamps found');
      return context;
    }

    // Sort timestamps for analysis
    timestamps.sort((a, b) => a.getTime() - b.getTime());
    ages.sort((a, b) => a - b);

    // Calculate temporal metrics
    const metrics: TemporalMetrics = {
      temporal_coverage_days: this.calculateCoverage(timestamps),
      avg_object_age_days: this.calculateAverage(ages),
      median_object_age_days: this.calculateMedian(ages),
      oldest_object_age_days: ages[ages.length - 1],
      newest_object_age_days: ages[0],
      objects_per_time_bucket: this.calculateTimeBuckets(timestamps),
      recency_score: this.calculateRecencyScore(ages),
      temporal_clustering_coefficient: this.calculateTemporalClustering(timestamps),
    };

    const durationMs = Date.now() - startTime;

    console.log(
      `[TemporalAnalysisStage] Complete | Coverage: ${metrics.temporal_coverage_days.toFixed(1)} days | Recency: ${(metrics.recency_score * 100).toFixed(1)}% | Clustering: ${(metrics.temporal_clustering_coefficient * 100).toFixed(1)}%`
    );

    // Persist layer metrics if experiment ID is available
    if (context.experimentId) {
      await this.persistLayerMetrics(context, metrics, durationMs);
    }

    // Log activity
    await this.logActivity(context, {
      metrics,
      objects_analyzed: timestamps.length,
    });

    return {
      ...context,
      stats: {
        ...context.stats,
        temporal: metrics,
      },
    };
  }

  shouldRun(context: PipelineContext): boolean {
    return context.config.validation.runOnSave;
  }

  /**
   * Parse timestamp from various formats
   */
  private parseTimestamp(timestamp: any): Date | null {
    if (!timestamp) return null;

    if (timestamp instanceof Date) return timestamp;

    if (typeof timestamp === 'string' || typeof timestamp === 'number') {
      const date = new Date(timestamp);
      return isNaN(date.getTime()) ? null : date;
    }

    return null;
  }

  /**
   * Calculate temporal coverage in days
   */
  private calculateCoverage(timestamps: Date[]): number {
    if (timestamps.length === 0) return 0;

    const oldest = timestamps[0];
    const newest = timestamps[timestamps.length - 1];

    const coverageMs = newest.getTime() - oldest.getTime();
    return coverageMs / (1000 * 60 * 60 * 24);
  }

  /**
   * Calculate average of an array
   */
  private calculateAverage(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((sum, val) => sum + val, 0) / values.length;
  }

  /**
   * Calculate median of a sorted array
   */
  private calculateMedian(sortedValues: number[]): number {
    if (sortedValues.length === 0) return 0;

    const mid = Math.floor(sortedValues.length / 2);

    if (sortedValues.length % 2 === 0) {
      return (sortedValues[mid - 1] + sortedValues[mid]) / 2;
    }

    return sortedValues[mid];
  }

  /**
   * Group objects into time buckets (weekly buckets)
   */
  private calculateTimeBuckets(timestamps: Date[]): Record<string, number> {
    const buckets: Record<string, number> = {};

    for (const timestamp of timestamps) {
      // Group by week (ISO week format: YYYY-Wxx)
      const year = timestamp.getFullYear();
      const startOfYear = new Date(year, 0, 1);
      const dayOfYear = Math.floor(
        (timestamp.getTime() - startOfYear.getTime()) / (1000 * 60 * 60 * 24)
      );
      const weekNum = Math.ceil((dayOfYear + 1) / 7);
      const bucketKey = `${year}-W${String(weekNum).padStart(2, '0')}`;

      buckets[bucketKey] = (buckets[bucketKey] || 0) + 1;
    }

    return buckets;
  }

  /**
   * Calculate recency score (0-1, higher = more recent data)
   * Uses exponential decay: objects older than 90 days contribute less
   */
  private calculateRecencyScore(ages: number[]): number {
    if (ages.length === 0) return 0;

    const decayHalfLife = 90; // Days until weight is halved
    const decayConstant = Math.log(2) / decayHalfLife;

    let totalWeight = 0;

    for (const age of ages) {
      const weight = Math.exp(-decayConstant * age);
      totalWeight += weight;
    }

    return totalWeight / ages.length;
  }

  /**
   * Calculate temporal clustering coefficient
   * Measures how objects are distributed across time buckets
   * Returns value between 0 (evenly distributed) and 1 (highly clustered)
   */
  private calculateTemporalClustering(timestamps: Date[]): number {
    const buckets = this.calculateTimeBuckets(timestamps);
    const counts = Object.values(buckets);

    if (counts.length <= 1) return 1; // All in one bucket = perfect clustering

    const totalObjects = timestamps.length;
    const avgObjectsPerBucket = totalObjects / counts.length;

    // Calculate variance from uniform distribution
    let variance = 0;
    for (const count of counts) {
      variance += Math.pow(count - avgObjectsPerBucket, 2);
    }
    variance /= counts.length;

    // Normalize to 0-1 range using coefficient of variation
    const stdDev = Math.sqrt(variance);
    const cv = stdDev / avgObjectsPerBucket;

    // Map CV to 0-1 scale (CV of 1 or higher = highly clustered)
    return Math.min(cv, 1);
  }

  /**
   * Persist layer metrics to database
   */
  private async persistLayerMetrics(
    context: PipelineContext,
    temporalMetrics: TemporalMetrics,
    durationMs: number
  ): Promise<void> {
    const pool = (context.db as any).pool;
    if (!pool || !context.experimentId) return;

    try {
      const metrics = {
        temporal_coverage_days: temporalMetrics.temporal_coverage_days,
        avg_object_age_days: temporalMetrics.avg_object_age_days,
        median_object_age_days: temporalMetrics.median_object_age_days,
        oldest_object_age_days: temporalMetrics.oldest_object_age_days,
        newest_object_age_days: temporalMetrics.newest_object_age_days,
        objects_per_time_bucket: temporalMetrics.objects_per_time_bucket,
        recency_score: temporalMetrics.recency_score,
        temporal_clustering_coefficient: temporalMetrics.temporal_clustering_coefficient,
      };

      await pool.query(
        `INSERT INTO layer_metrics (experiment_id, layer, evaluation_method, metrics, duration_ms)
         VALUES ($1, $2, $3, $4::jsonb, $5)
         ON CONFLICT (experiment_id, layer, evaluation_method)
         DO UPDATE SET metrics = $4::jsonb, duration_ms = $5, created_at = NOW()`,
        [context.experimentId, 'temporal', 'ground_truth', JSON.stringify(metrics), durationMs]
      );

      console.log(
        `[TemporalAnalysisStage] Persisted layer metrics for experiment ${context.experimentId}: Coverage=${temporalMetrics.temporal_coverage_days.toFixed(1)} days`
      );
    } catch (error) {
      console.error('Failed to persist temporal analysis metrics:', error);
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

    const metrics = details.metrics as TemporalMetrics;
    const description = `Temporal: Coverage=${metrics.temporal_coverage_days.toFixed(1)} days, Recency=${(metrics.recency_score * 100).toFixed(1)}%`;

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
   * Run temporal analysis stage standalone and return results
   */
  async runStandalone(context: PipelineContext): Promise<TemporalStageResult> {
    const result = await this.execute(context);

    return {
      metrics: result.stats.temporal!,
      objectsAnalyzed: context.objects.length,
    };
  }
}
