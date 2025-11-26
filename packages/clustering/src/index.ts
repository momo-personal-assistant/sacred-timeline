/**
 * @momo/clustering
 *
 * Clustering for memory objects.
 * MVP: Simple grouping by platform/type.
 * Future: K-means and HDBSCAN for embedding-based clustering.
 */

export { SimpleClusterer } from './simple-clusterer';
export type {
  Cluster,
  ClusteringConfig,
  ClusteringResult,
  ClusteringStats,
} from './simple-clusterer';
