import type { CanonicalObject } from '@unified-memory/shared';

export interface Cluster {
  id: string;
  label: string;
  objects: CanonicalObject[];
  size: number;
  metadata?: Record<string, unknown>;
}

export interface ClusteringStats {
  totalObjects: number;
  totalClusters: number;
  avgClusterSize: number;
  minClusterSize: number;
  maxClusterSize: number;
}

export interface ClusteringResult {
  clusters: Cluster[];
  stats: ClusteringStats;
}

export interface ClusteringConfig {
  /** Strategy for clustering (default: 'platform') */
  strategy?: 'platform' | 'type' | 'combined';
}

/**
 * SimpleClusterer groups objects by attributes (platform, type).
 *
 * MVP Features:
 * - Cluster by platform (slack, zendesk, linear, etc.)
 * - Cluster by object_type (thread, ticket, issue, etc.)
 * - Combined clustering (platform + type)
 */
export class SimpleClusterer {
  private config: Required<ClusteringConfig>;

  constructor(config: ClusteringConfig = {}) {
    this.config = {
      strategy: config.strategy ?? 'platform',
    };
  }

  /**
   * Cluster objects using the configured strategy
   */
  cluster(objects: CanonicalObject[]): ClusteringResult {
    switch (this.config.strategy) {
      case 'type':
        return this.clusterByType(objects);
      case 'combined':
        return this.clusterByCombined(objects);
      case 'platform':
      default:
        return this.clusterByPlatform(objects);
    }
  }

  /**
   * Cluster objects by platform
   */
  clusterByPlatform(objects: CanonicalObject[]): ClusteringResult {
    const byPlatform = new Map<string, CanonicalObject[]>();

    for (const obj of objects) {
      const platform = obj.platform;
      const list = byPlatform.get(platform) || [];
      list.push(obj);
      byPlatform.set(platform, list);
    }

    const clusters: Cluster[] = Array.from(byPlatform.entries()).map(([platform, objs]) => ({
      id: `cluster-platform-${platform}`,
      label: platform,
      objects: objs,
      size: objs.length,
      metadata: { groupBy: 'platform' },
    }));

    return this.buildResult(clusters, objects.length);
  }

  /**
   * Cluster objects by object_type
   */
  clusterByType(objects: CanonicalObject[]): ClusteringResult {
    const byType = new Map<string, CanonicalObject[]>();

    for (const obj of objects) {
      const type = obj.object_type;
      const list = byType.get(type) || [];
      list.push(obj);
      byType.set(type, list);
    }

    const clusters: Cluster[] = Array.from(byType.entries()).map(([type, objs]) => ({
      id: `cluster-type-${type}`,
      label: type,
      objects: objs,
      size: objs.length,
      metadata: { groupBy: 'type' },
    }));

    return this.buildResult(clusters, objects.length);
  }

  /**
   * Cluster objects by platform + type combination
   */
  clusterByCombined(objects: CanonicalObject[]): ClusteringResult {
    const byCombined = new Map<string, CanonicalObject[]>();

    for (const obj of objects) {
      const key = `${obj.platform}:${obj.object_type}`;
      const list = byCombined.get(key) || [];
      list.push(obj);
      byCombined.set(key, list);
    }

    const clusters: Cluster[] = Array.from(byCombined.entries()).map(([key, objs]) => {
      const [platform, type] = key.split(':');
      return {
        id: `cluster-combined-${key}`,
        label: `${platform} / ${type}`,
        objects: objs,
        size: objs.length,
        metadata: { groupBy: 'combined', platform, type },
      };
    });

    return this.buildResult(clusters, objects.length);
  }

  /**
   * Get cluster for a specific object
   */
  getClusterForObject(obj: CanonicalObject, result: ClusteringResult): Cluster | undefined {
    return result.clusters.find((cluster) => cluster.objects.some((o) => o.id === obj.id));
  }

  private buildResult(clusters: Cluster[], totalObjects: number): ClusteringResult {
    const sizes = clusters.map((c) => c.size);
    const totalClusters = clusters.length;

    const stats: ClusteringStats = {
      totalObjects,
      totalClusters,
      avgClusterSize: totalClusters > 0 ? Math.round((totalObjects / totalClusters) * 10) / 10 : 0,
      minClusterSize: sizes.length > 0 ? Math.min(...sizes) : 0,
      maxClusterSize: sizes.length > 0 ? Math.max(...sizes) : 0,
    };

    // Sort clusters by size (largest first)
    const sortedClusters = [...clusters].sort((a, b) => b.size - a.size);

    return {
      clusters: sortedClusters,
      stats,
    };
  }
}
