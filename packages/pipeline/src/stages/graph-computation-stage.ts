/**
 * Graph Computation Stage
 *
 * Analyzes the structure of the inferred knowledge graph and computes topological metrics.
 * Provides insights into graph quality: density, clustering, connectivity, and centrality.
 */

import type { Relation } from '@momo/graph';

import type { GraphMetrics, GraphStageResult, PipelineContext, PipelineStage } from '../types';

/**
 * Simple graph structure for analysis
 */
interface GraphStructure {
  nodes: Set<string>;
  edges: Map<string, Set<string>>; // adjacency list: node -> neighbors
  edgeCount: number;
}

export class GraphComputationStage implements PipelineStage {
  readonly name = 'graph_computation';
  readonly description = 'Compute graph topology metrics from inferred relations';

  async execute(context: PipelineContext): Promise<PipelineContext> {
    const startTime = Date.now();

    // Get inferred relations from context (set by ValidationStage)
    const relations: Relation[] = context.inferredRelations || [];

    if (relations.length === 0) {
      console.warn(
        '[GraphComputationStage] No inferred relations found in context. Run ValidationStage first.'
      );
      return context;
    }

    console.log(`[GraphComputationStage] Analyzing ${relations.length} relations...`);

    // Build graph structure
    const graph = this.buildGraph(relations);

    // Calculate metrics
    const metrics: GraphMetrics = {
      node_count: graph.nodes.size,
      edge_count: graph.edgeCount,
      graph_density: this.calculateDensity(graph),
      avg_clustering_coefficient: this.calculateAvgClustering(graph),
      connected_components: this.countConnectedComponents(graph),
      avg_degree: graph.edgeCount / graph.nodes.size,
      max_degree: this.findMaxDegree(graph),
      top_central_nodes: this.findTopCentralNodes(graph, 3),
    };

    const durationMs = Date.now() - startTime;

    console.log(
      `[GraphComputationStage] Complete | Nodes: ${metrics.node_count} | Density: ${(metrics.graph_density * 100).toFixed(1)}% | Components: ${metrics.connected_components}`
    );

    // Persist layer metrics if experiment ID is available
    if (context.experimentId) {
      await this.persistLayerMetrics(context, metrics, durationMs);
    }

    // Log activity
    await this.logActivity(context, {
      metrics,
      relations_analyzed: relations.length,
    });

    return {
      ...context,
      stats: {
        ...context.stats,
        graph: metrics,
      },
    };
  }

  shouldRun(context: PipelineContext): boolean {
    return context.config.validation.runOnSave;
  }

  /**
   * Build graph adjacency structure from relations
   */
  private buildGraph(relations: Relation[]): GraphStructure {
    const nodes = new Set<string>();
    const edges = new Map<string, Set<string>>();
    let edgeCount = 0;

    for (const rel of relations) {
      nodes.add(rel.from_id);
      nodes.add(rel.to_id);

      // Add undirected edge (for clustering coefficient calculation)
      if (!edges.has(rel.from_id)) {
        edges.set(rel.from_id, new Set());
      }
      if (!edges.has(rel.to_id)) {
        edges.set(rel.to_id, new Set());
      }

      edges.get(rel.from_id)!.add(rel.to_id);
      edges.get(rel.to_id)!.add(rel.from_id); // Undirected
      edgeCount++;
    }

    return { nodes, edges, edgeCount };
  }

  /**
   * Calculate graph density: actual edges / possible edges
   */
  private calculateDensity(graph: GraphStructure): number {
    const n = graph.nodes.size;
    if (n <= 1) return 0;

    const maxEdges = (n * (n - 1)) / 2; // Undirected graph
    return graph.edgeCount / maxEdges;
  }

  /**
   * Calculate average clustering coefficient
   * Measures how connected a node's neighbors are to each other
   */
  private calculateAvgClustering(graph: GraphStructure): number {
    let totalClustering = 0;
    let nodeCount = 0;

    for (const node of graph.nodes) {
      const neighbors = graph.edges.get(node);
      if (!neighbors || neighbors.size < 2) {
        continue; // Need at least 2 neighbors
      }

      // Count edges between neighbors
      let neighborEdges = 0;
      const neighborList = Array.from(neighbors);

      for (let i = 0; i < neighborList.length; i++) {
        for (let j = i + 1; j < neighborList.length; j++) {
          if (graph.edges.get(neighborList[i])?.has(neighborList[j])) {
            neighborEdges++;
          }
        }
      }

      const k = neighbors.size;
      const maxNeighborEdges = (k * (k - 1)) / 2;
      const clustering = maxNeighborEdges > 0 ? neighborEdges / maxNeighborEdges : 0;

      totalClustering += clustering;
      nodeCount++;
    }

    return nodeCount > 0 ? totalClustering / nodeCount : 0;
  }

  /**
   * Count connected components using Union-Find
   */
  private countConnectedComponents(graph: GraphStructure): number {
    const visited = new Set<string>();
    let components = 0;

    const dfs = (node: string) => {
      visited.add(node);
      const neighbors = graph.edges.get(node) || new Set();
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          dfs(neighbor);
        }
      }
    };

    for (const node of graph.nodes) {
      if (!visited.has(node)) {
        dfs(node);
        components++;
      }
    }

    return components;
  }

  /**
   * Find maximum degree (most connected node)
   */
  private findMaxDegree(graph: GraphStructure): number {
    let maxDegree = 0;
    for (const neighbors of graph.edges.values()) {
      maxDegree = Math.max(maxDegree, neighbors.size);
    }
    return maxDegree;
  }

  /**
   * Find top K nodes by degree centrality
   */
  private findTopCentralNodes(
    graph: GraphStructure,
    k: number
  ): Array<{ node_id: string; degree: number }> {
    const nodeDegrees: Array<{ node_id: string; degree: number }> = [];

    for (const node of graph.nodes) {
      const degree = graph.edges.get(node)?.size || 0;
      nodeDegrees.push({ node_id: node, degree });
    }

    // Sort by degree descending, take top K
    return nodeDegrees.sort((a, b) => b.degree - a.degree).slice(0, k);
  }

  /**
   * Persist layer metrics to database
   */
  private async persistLayerMetrics(
    context: PipelineContext,
    graphMetrics: GraphMetrics,
    durationMs: number
  ): Promise<void> {
    const pool = (context.db as any).pool;
    if (!pool || !context.experimentId) return;

    try {
      const metrics = {
        node_count: graphMetrics.node_count,
        edge_count: graphMetrics.edge_count,
        graph_density: graphMetrics.graph_density,
        avg_clustering_coefficient: graphMetrics.avg_clustering_coefficient,
        connected_components: graphMetrics.connected_components,
        avg_degree: graphMetrics.avg_degree,
        max_degree: graphMetrics.max_degree,
        top_central_nodes: graphMetrics.top_central_nodes,
      };

      await pool.query(
        `INSERT INTO layer_metrics (experiment_id, layer, evaluation_method, metrics, duration_ms)
         VALUES ($1, $2, $3, $4::jsonb, $5)
         ON CONFLICT (experiment_id, layer, evaluation_method)
         DO UPDATE SET metrics = $4::jsonb, duration_ms = $5, created_at = NOW()`,
        [context.experimentId, 'graph', 'ground_truth', JSON.stringify(metrics), durationMs]
      );

      console.log(
        `[GraphComputationStage] Persisted layer metrics for experiment ${context.experimentId}: Density=${(graphMetrics.graph_density * 100).toFixed(1)}%`
      );
    } catch (error) {
      console.error('Failed to persist graph computation metrics:', error);
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

    const metrics = details.metrics as GraphMetrics;
    const description = `Graph: ${metrics.node_count} nodes, ${metrics.edge_count} edges, Density=${(metrics.graph_density * 100).toFixed(1)}%`;

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
   * Run graph computation stage standalone and return results
   */
  async runStandalone(context: PipelineContext): Promise<GraphStageResult> {
    const result = await this.execute(context);

    return {
      metrics: result.stats.graph!,
      nodesAnalyzed: result.stats.graph!.node_count,
    };
  }
}
