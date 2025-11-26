/**
 * Consolidation Stage
 *
 * Analyzes the knowledge graph to identify duplicate objects, redundant relations,
 * and opportunities for data consolidation to improve memory efficiency.
 */

import type {
  ConsolidationMetrics,
  ConsolidationStageResult,
  PipelineContext,
  PipelineStage,
} from '../types';

interface DuplicatePair {
  id1: string;
  id2: string;
  similarity: number;
}

export class ConsolidationStage implements PipelineStage {
  readonly name = 'consolidation';
  readonly description = 'Analyze duplicate objects and redundant relations';

  async execute(context: PipelineContext): Promise<PipelineContext> {
    const { objects, inferredRelations } = context;
    const startTime = Date.now();

    if (objects.length === 0) {
      console.warn('[ConsolidationStage] No objects found to analyze');
      return context;
    }

    console.log(
      `[ConsolidationStage] Analyzing ${objects.length} objects and ${inferredRelations?.length || 0} relations...`
    );

    // Detect duplicate objects
    const duplicatePairs = this.detectDuplicates(objects);
    const duplicateClusters = this.clusterDuplicates(duplicatePairs);

    // Detect redundant relations
    const redundantRelations = this.detectRedundantRelations(inferredRelations || []);

    // Calculate metrics
    const totalOpportunities = duplicatePairs.length + redundantRelations;
    const avgSimilarity =
      duplicatePairs.length > 0
        ? duplicatePairs.reduce((sum, pair) => sum + pair.similarity, 0) / duplicatePairs.length
        : 0;

    const metrics: ConsolidationMetrics = {
      total_objects: objects.length,
      duplicate_pairs: duplicatePairs.length,
      redundant_relations: redundantRelations,
      consolidation_opportunities: totalOpportunities,
      avg_similarity_score: avgSimilarity,
      duplicate_clusters: duplicateClusters.length,
      consolidation_ratio: objects.length > 0 ? totalOpportunities / objects.length : 0,
      top_duplicates: duplicatePairs.slice(0, 10),
    };

    const durationMs = Date.now() - startTime;

    console.log(
      `[ConsolidationStage] Complete | Duplicates: ${duplicatePairs.length} pairs (${duplicateClusters.length} clusters) | Redundant Relations: ${redundantRelations} | Consolidation Ratio: ${(metrics.consolidation_ratio * 100).toFixed(1)}%`
    );

    // Persist layer metrics if experiment ID is available
    if (context.experimentId) {
      await this.persistLayerMetrics(context, metrics, durationMs);
    }

    // Log activity
    await this.logActivity(context, {
      metrics,
      objects_analyzed: objects.length,
      duplicate_clusters: duplicateClusters.length,
    });

    return {
      ...context,
      stats: {
        ...context.stats,
        consolidation: metrics,
      },
    };
  }

  shouldRun(context: PipelineContext): boolean {
    return context.config.validation.runOnSave;
  }

  /**
   * Detect potential duplicate objects using content similarity
   */
  private detectDuplicates(objects: any[]): DuplicatePair[] {
    const duplicates: DuplicatePair[] = [];
    const SIMILARITY_THRESHOLD = 0.8; // 80% similarity threshold

    for (let i = 0; i < objects.length; i++) {
      for (let j = i + 1; j < objects.length; j++) {
        const obj1 = objects[i];
        const obj2 = objects[j];

        const similarity = this.calculateSimilarity(obj1, obj2);

        if (similarity >= SIMILARITY_THRESHOLD) {
          duplicates.push({
            id1: obj1.id,
            id2: obj2.id,
            similarity,
          });
        }
      }
    }

    // Sort by similarity descending
    duplicates.sort((a, b) => b.similarity - a.similarity);

    return duplicates;
  }

  /**
   * Calculate similarity between two objects
   * Uses Jaccard similarity on tokenized content
   */
  private calculateSimilarity(obj1: any, obj2: any): number {
    // Extract text content from objects
    const text1 = this.extractTextContent(obj1);
    const text2 = this.extractTextContent(obj2);

    if (!text1 || !text2) return 0;

    // Tokenize and create sets
    const tokens1 = new Set(this.tokenize(text1));
    const tokens2 = new Set(this.tokenize(text2));

    // Calculate Jaccard similarity: |A ∩ B| / |A ∪ B|
    const intersection = new Set([...tokens1].filter((x) => tokens2.has(x)));
    const union = new Set([...tokens1, ...tokens2]);

    return union.size > 0 ? intersection.size / union.size : 0;
  }

  /**
   * Extract text content from an object for comparison
   */
  private extractTextContent(obj: any): string {
    const parts: string[] = [];

    // Get title/name
    if (obj.title) parts.push(obj.title);
    if (obj.name) parts.push(obj.name);

    // Get description/content
    if (obj.description) parts.push(obj.description);
    if (obj.content) parts.push(obj.content);

    // Get additional metadata fields that might indicate similarity
    if (obj.metadata) {
      const metadata = typeof obj.metadata === 'string' ? JSON.parse(obj.metadata) : obj.metadata;
      if (metadata.summary) parts.push(metadata.summary);
      if (metadata.abstract) parts.push(metadata.abstract);
    }

    return parts.join(' ').toLowerCase();
  }

  /**
   * Tokenize text into words
   */
  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ') // Replace punctuation with spaces
      .split(/\s+/)
      .filter((token) => token.length > 2); // Filter out very short tokens
  }

  /**
   * Cluster duplicate pairs using union-find algorithm
   */
  private clusterDuplicates(duplicatePairs: DuplicatePair[]): string[][] {
    if (duplicatePairs.length === 0) return [];

    // Build adjacency map
    const adjacency = new Map<string, Set<string>>();

    for (const pair of duplicatePairs) {
      if (!adjacency.has(pair.id1)) adjacency.set(pair.id1, new Set());
      if (!adjacency.has(pair.id2)) adjacency.set(pair.id2, new Set());

      adjacency.get(pair.id1)!.add(pair.id2);
      adjacency.get(pair.id2)!.add(pair.id1);
    }

    // Find connected components using DFS
    const visited = new Set<string>();
    const clusters: string[][] = [];

    const dfs = (nodeId: string, cluster: string[]) => {
      visited.add(nodeId);
      cluster.push(nodeId);

      const neighbors = adjacency.get(nodeId) || new Set();
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          dfs(neighbor, cluster);
        }
      }
    };

    for (const nodeId of adjacency.keys()) {
      if (!visited.has(nodeId)) {
        const cluster: string[] = [];
        dfs(nodeId, cluster);
        clusters.push(cluster);
      }
    }

    return clusters;
  }

  /**
   * Detect redundant relations (same subject, object, and type)
   */
  private detectRedundantRelations(relations: any[]): number {
    if (relations.length === 0) return 0;

    const relationSignatures = new Map<string, number>();

    for (const relation of relations) {
      // Create signature: subject_id|object_id|relation_type
      const signature = `${relation.subject_id}|${relation.object_id}|${relation.relation_type}`;

      relationSignatures.set(signature, (relationSignatures.get(signature) || 0) + 1);
    }

    // Count how many relations appear more than once
    let redundantCount = 0;
    for (const count of relationSignatures.values()) {
      if (count > 1) {
        redundantCount += count - 1; // All but one are redundant
      }
    }

    return redundantCount;
  }

  /**
   * Persist layer metrics to database
   */
  private async persistLayerMetrics(
    context: PipelineContext,
    consolidationMetrics: ConsolidationMetrics,
    durationMs: number
  ): Promise<void> {
    const pool = (context.db as any).pool;
    if (!pool || !context.experimentId) return;

    try {
      const metrics = {
        total_objects: consolidationMetrics.total_objects,
        duplicate_pairs: consolidationMetrics.duplicate_pairs,
        redundant_relations: consolidationMetrics.redundant_relations,
        consolidation_opportunities: consolidationMetrics.consolidation_opportunities,
        avg_similarity_score: consolidationMetrics.avg_similarity_score,
        duplicate_clusters: consolidationMetrics.duplicate_clusters,
        consolidation_ratio: consolidationMetrics.consolidation_ratio,
        top_duplicates: consolidationMetrics.top_duplicates,
      };

      await pool.query(
        `INSERT INTO layer_metrics (experiment_id, layer, evaluation_method, metrics, duration_ms)
         VALUES ($1, $2, $3, $4::jsonb, $5)
         ON CONFLICT (experiment_id, layer, evaluation_method)
         DO UPDATE SET metrics = $4::jsonb, duration_ms = $5, created_at = NOW()`,
        [context.experimentId, 'consolidation', 'ground_truth', JSON.stringify(metrics), durationMs]
      );

      console.log(
        `[ConsolidationStage] Persisted layer metrics for experiment ${context.experimentId}: ${consolidationMetrics.duplicate_pairs} duplicate pairs, ${consolidationMetrics.duplicate_clusters} clusters`
      );
    } catch (error) {
      console.error('Failed to persist consolidation metrics:', error);
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

    const metrics = details.metrics as ConsolidationMetrics;
    const description = `Consolidation: ${metrics.duplicate_pairs} duplicates (${metrics.duplicate_clusters} clusters), ${metrics.redundant_relations} redundant relations`;

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
   * Run consolidation stage standalone and return results
   */
  async runStandalone(context: PipelineContext): Promise<ConsolidationStageResult> {
    const result = await this.execute(context);

    return {
      metrics: result.stats.consolidation!,
      objectsAnalyzed: context.objects.length,
      duplicateClustersFound: result.stats.consolidation!.duplicate_clusters,
    };
  }
}
