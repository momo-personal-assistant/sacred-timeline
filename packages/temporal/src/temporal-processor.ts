/**
 * Minimal interface for objects that can be processed by TemporalProcessor.
 * This is compatible with both @unified-memory/shared and @unified-memory/db types.
 */
export interface TemporalObject {
  id: string;
  timestamps: {
    created_at: string;
    updated_at?: string;
  };
}

export interface TemporalConfig {
  /** Maximum age in days for recency calculation (default: 30) */
  maxAgeDays?: number;
  /** Weight for recency boost in reranking (default: 0.1 = 10%) */
  recencyBoost?: number;
}

export interface RecencyScore {
  objectId: string;
  score: number;
  ageInDays: number;
}

/**
 * TemporalProcessor handles time-based processing for memory objects.
 *
 * MVP Features:
 * - Sort objects by recency
 * - Calculate recency scores
 * - Apply recency boost to search results
 */
export class TemporalProcessor {
  private config: Required<TemporalConfig>;

  constructor(config: TemporalConfig = {}) {
    this.config = {
      maxAgeDays: config.maxAgeDays ?? 30,
      recencyBoost: config.recencyBoost ?? 0.1,
    };
  }

  /**
   * Sort objects by recency (newest first)
   */
  sortByRecency<T extends TemporalObject>(objects: T[]): T[] {
    return [...objects].sort((a, b) => {
      const aTime = new Date(a.timestamps.created_at).getTime();
      const bTime = new Date(b.timestamps.created_at).getTime();
      return bTime - aTime;
    });
  }

  /**
   * Calculate recency score for an object (0~1)
   * - Score of 1.0 = created today
   * - Score of 0.0 = created maxAgeDays ago or earlier
   */
  getRecencyScore(obj: TemporalObject): number {
    const now = Date.now();
    const created = new Date(obj.timestamps.created_at).getTime();
    const ageMs = now - created;
    const maxAgeMs = this.config.maxAgeDays * 24 * 60 * 60 * 1000;

    return Math.max(0, 1 - ageMs / maxAgeMs);
  }

  /**
   * Get detailed recency scores for multiple objects
   */
  getRecencyScores(objects: TemporalObject[]): RecencyScore[] {
    const now = Date.now();
    const msPerDay = 24 * 60 * 60 * 1000;

    return objects.map((obj) => {
      const created = new Date(obj.timestamps.created_at).getTime();
      const ageMs = now - created;
      const ageInDays = ageMs / msPerDay;

      return {
        objectId: obj.id,
        score: this.getRecencyScore(obj),
        ageInDays: Math.round(ageInDays * 10) / 10,
      };
    });
  }

  /**
   * Apply recency boost to search results.
   * Increases similarity scores based on recency.
   */
  applyRecencyBoost<T extends { similarity: number; canonical_object_id: string }>(
    results: T[],
    objects: TemporalObject[]
  ): T[] {
    const objectMap = new Map(objects.map((o) => [o.id, o]));

    return results
      .map((result) => {
        const obj = objectMap.get(result.canonical_object_id);
        if (!obj) return result;

        const recencyScore = this.getRecencyScore(obj);
        const boostedSimilarity = result.similarity + recencyScore * this.config.recencyBoost;

        return { ...result, similarity: boostedSimilarity };
      })
      .sort((a, b) => b.similarity - a.similarity);
  }

  /**
   * Filter objects by time window
   */
  filterByTimeWindow<T extends TemporalObject>(
    objects: T[],
    options: {
      after?: Date;
      before?: Date;
    }
  ): T[] {
    return objects.filter((obj) => {
      const created = new Date(obj.timestamps.created_at);

      if (options.after && created < options.after) {
        return false;
      }
      if (options.before && created > options.before) {
        return false;
      }
      return true;
    });
  }

  /**
   * Group objects by time period
   */
  groupByTimePeriod<T extends TemporalObject>(
    objects: T[],
    period: 'day' | 'week' | 'month'
  ): Map<string, T[]> {
    const groups = new Map<string, T[]>();

    for (const obj of objects) {
      const date = new Date(obj.timestamps.created_at);
      let key: string;

      switch (period) {
        case 'day':
          key = date.toISOString().split('T')[0];
          break;
        case 'week': {
          const weekStart = new Date(date);
          weekStart.setDate(date.getDate() - date.getDay());
          key = `week-${weekStart.toISOString().split('T')[0]}`;
          break;
        }
        case 'month':
          key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
          break;
      }

      const existing = groups.get(key) || [];
      existing.push(obj);
      groups.set(key, existing);
    }

    return groups;
  }
}
