import type { CanonicalObject } from '@unified-memory/shared';

export interface ConsolidationConfig {
  /** Use semantic_hash for deduplication (default: true) */
  useSemanticHash?: boolean;
  /** Keep the more recent object when duplicates are found (default: true) */
  keepNewer?: boolean;
}

export interface ConsolidationStats {
  totalInput: number;
  totalOutput: number;
  duplicatesRemoved: number;
}

export interface ConsolidationResult {
  unique: CanonicalObject[];
  duplicates: string[];
  stats: ConsolidationStats;
}

/**
 * Consolidator handles deduplication and merging of memory objects.
 *
 * MVP Features:
 * - Deduplicate by semantic_hash or id
 * - Keep newer version when duplicates found
 */
export class Consolidator {
  private config: Required<ConsolidationConfig>;

  constructor(config: ConsolidationConfig = {}) {
    this.config = {
      useSemanticHash: config.useSemanticHash ?? true,
      keepNewer: config.keepNewer ?? true,
    };
  }

  /**
   * Deduplicate objects based on semantic_hash or id
   */
  deduplicate(objects: CanonicalObject[]): ConsolidationResult {
    const seen = new Map<string, CanonicalObject>();
    const duplicates: string[] = [];

    for (const obj of objects) {
      // Use semantic_hash if available and configured, otherwise use id
      const key = this.config.useSemanticHash && obj.semantic_hash ? obj.semantic_hash : obj.id;

      const existing = seen.get(key);

      if (!existing) {
        seen.set(key, obj);
      } else {
        duplicates.push(obj.id);

        // Replace with newer version if configured
        if (this.config.keepNewer) {
          const existingTime = new Date(existing.timestamps.updated_at).getTime();
          const currentTime = new Date(obj.timestamps.updated_at).getTime();

          if (currentTime > existingTime) {
            seen.set(key, obj);
          }
        }
      }
    }

    const unique = Array.from(seen.values());

    return {
      unique,
      duplicates,
      stats: {
        totalInput: objects.length,
        totalOutput: unique.length,
        duplicatesRemoved: duplicates.length,
      },
    };
  }

  /**
   * Find potential duplicates based on similarity
   * (Placeholder for future implementation with embedding similarity)
   */
  findSimilar(objects: CanonicalObject[], _threshold = 0.9): Map<string, string[]> {
    const groups = new Map<string, string[]>();

    // MVP: Group by exact semantic_hash match only
    for (const obj of objects) {
      if (obj.semantic_hash) {
        const existing = groups.get(obj.semantic_hash) || [];
        existing.push(obj.id);
        groups.set(obj.semantic_hash, existing);
      }
    }

    // Filter to only groups with duplicates
    const duplicateGroups = new Map<string, string[]>();
    for (const [key, ids] of groups) {
      if (ids.length > 1) {
        duplicateGroups.set(key, ids);
      }
    }

    return duplicateGroups;
  }

  /**
   * Merge multiple objects into one
   * (Placeholder for future entity resolution)
   */
  merge(objects: CanonicalObject[]): CanonicalObject | null {
    if (objects.length === 0) {
      return null;
    }

    // MVP: Return the most recently updated object
    return objects.reduce((newest, current) => {
      const newestTime = new Date(newest.timestamps.updated_at).getTime();
      const currentTime = new Date(current.timestamps.updated_at).getTime();
      return currentTime > newestTime ? current : newest;
    });
  }
}
