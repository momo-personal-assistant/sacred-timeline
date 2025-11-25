/**
 * Relation Inferrer
 * Extracts and infers relations between canonical objects
 */

import type { CanonicalObject } from '@unified-memory/shared/types/canonical';

export type RelationType =
  | 'triggered_by' // Slack thread triggered by Zendesk ticket
  | 'resulted_in' // Slack thread resulted in Linear issue
  | 'belongs_to' // Ticket/Issue belongs to Company
  | 'assigned_to' // Issue assigned to User
  | 'created_by' // Object created by User
  | 'decided_by' // Decision made by User
  | 'participated_in' // User participated in Slack thread
  | 'similar_to' // Objects are similar (keyword overlap)
  | 'duplicate_of' // Potential duplicate
  | 'related_to'; // Generic relation

export type RelationSource = 'explicit' | 'inferred' | 'computed';

export interface Relation {
  from_id: string;
  to_id: string;
  type: RelationType;
  source: RelationSource;
  confidence: number; // 0-1
  metadata?: Record<string, any>;
  created_at?: string;
}

export interface RelationInferrerOptions {
  // Similarity threshold for semantic similarity (0-1)
  similarityThreshold?: number;

  // Keyword overlap threshold for similar_to relations (0-1)
  keywordOverlapThreshold?: number;

  // Include inferred relations (vs only explicit)
  includeInferred?: boolean;

  // Use semantic similarity from embeddings (requires embeddings map)
  useSemanticSimilarity?: boolean;

  // Weight for combining keyword and semantic similarity (0-1)
  // 0 = only keywords, 1 = only semantic, 0.5 = equal weight
  semanticWeight?: number;

  // Enable duplicate detection using semantic_hash (CDM paper recommendation)
  enableDuplicateDetection?: boolean;
}

export class RelationInferrer {
  private options: Required<RelationInferrerOptions>;

  constructor(options: RelationInferrerOptions = {}) {
    this.options = {
      similarityThreshold: options.similarityThreshold ?? 0.85,
      keywordOverlapThreshold: options.keywordOverlapThreshold ?? 0.65, // Raised from 0.5 to 0.65 to reduce false positives
      includeInferred: options.includeInferred ?? true,
      useSemanticSimilarity: options.useSemanticSimilarity ?? false,
      semanticWeight: options.semanticWeight ?? 0.7, // Default: 70% semantic, 30% keyword
      enableDuplicateDetection: options.enableDuplicateDetection ?? true, // CDM paper: use semantic_hash for duplicates
    };
  }

  /**
   * Extract explicit relations from canonical objects
   * These relations are directly present in the data
   */
  extractExplicit(objects: CanonicalObject[]): Relation[] {
    const relations: Relation[] = [];

    for (const obj of objects) {
      // 1. triggered_by (Slack thread → Zendesk ticket)
      if (obj.relations?.triggered_by_ticket) {
        relations.push({
          from_id: obj.id,
          to_id: obj.relations.triggered_by_ticket,
          type: 'triggered_by',
          source: 'explicit',
          confidence: 1.0,
          created_at: obj.timestamps.created_at,
        });
      }

      // 2. resulted_in (Slack thread → Linear issue)
      if (obj.relations?.resulted_in_issue) {
        relations.push({
          from_id: obj.id,
          to_id: obj.relations.resulted_in_issue,
          type: 'resulted_in',
          source: 'explicit',
          confidence: 1.0,
          created_at: obj.timestamps.created_at,
        });
      }

      // 3. created_by (Object → User)
      if (obj.actors.created_by) {
        relations.push({
          from_id: obj.id,
          to_id: obj.actors.created_by,
          type: 'created_by',
          source: 'explicit',
          confidence: 1.0,
          created_at: obj.timestamps.created_at,
        });
      }

      // 4. assigned_to (Issue → User)
      if (obj.actors.assignees && obj.actors.assignees.length > 0) {
        for (const assignee of obj.actors.assignees) {
          relations.push({
            from_id: obj.id,
            to_id: assignee,
            type: 'assigned_to',
            source: 'explicit',
            confidence: 1.0,
            created_at: obj.timestamps.created_at,
          });
        }
      }

      // 5. decided_by (User who made decision → Slack thread)
      if (obj.actors.decided_by) {
        relations.push({
          from_id: obj.actors.decided_by,
          to_id: obj.id,
          type: 'decided_by',
          source: 'explicit',
          confidence: 1.0,
          created_at: obj.timestamps.decided_at || obj.timestamps.updated_at,
        });
      }

      // 6. participated_in (Slack thread ← Users)
      if (obj.actors.participants && obj.actors.participants.length > 0) {
        for (const participant of obj.actors.participants) {
          relations.push({
            from_id: participant,
            to_id: obj.id,
            type: 'participated_in',
            source: 'explicit',
            confidence: 1.0,
            created_at: obj.timestamps.created_at,
          });
        }
      }

      // 7. linked objects (pr, issues, etc.)
      if (obj.relations?.linked_prs) {
        for (const prId of obj.relations.linked_prs) {
          relations.push({
            from_id: obj.id,
            to_id: prId,
            type: 'related_to',
            source: 'explicit',
            confidence: 1.0,
            created_at: obj.timestamps.created_at,
          });
        }
      }

      if (obj.relations?.linked_issues) {
        for (const issueId of obj.relations.linked_issues) {
          relations.push({
            from_id: obj.id,
            to_id: issueId,
            type: 'related_to',
            source: 'explicit',
            confidence: 1.0,
            created_at: obj.timestamps.created_at,
          });
        }
      }

      // 8. parent-child relations
      if (obj.relations?.parent_id) {
        relations.push({
          from_id: obj.id,
          to_id: obj.relations.parent_id,
          type: 'belongs_to',
          source: 'explicit',
          confidence: 1.0,
          created_at: obj.timestamps.created_at,
        });
      }
    }

    return relations;
  }

  /**
   * Calculate cosine similarity between two embedding vectors
   */
  private cosineSimilarity(vec1: number[], vec2: number[]): number {
    if (vec1.length !== vec2.length) {
      // Silently skip mismatched dimensions
      return 0;
    }

    let dotProduct = 0;
    let mag1 = 0;
    let mag2 = 0;

    for (let i = 0; i < vec1.length; i++) {
      dotProduct += vec1[i] * vec2[i];
      mag1 += vec1[i] * vec1[i];
      mag2 += vec2[i] * vec2[i];
    }

    const magnitude = Math.sqrt(mag1) * Math.sqrt(mag2);
    return magnitude === 0 ? 0 : dotProduct / magnitude;
  }

  /**
   * Infer similarity relations based on keyword overlap
   * These relations are computed from object properties
   */
  inferSimilarity(objects: CanonicalObject[]): Relation[] {
    if (!this.options.includeInferred) {
      return [];
    }

    const relations: Relation[] = [];

    // Build keyword index
    const objectKeywords = new Map<string, Set<string>>();

    for (const obj of objects) {
      const keywords = new Set<string>();

      // Extract from properties
      if (obj.properties?.keywords && Array.isArray(obj.properties.keywords)) {
        for (const keyword of obj.properties.keywords) {
          keywords.add(keyword.toLowerCase());
        }
      }

      // Extract from labels
      if (obj.properties?.labels && Array.isArray(obj.properties.labels)) {
        for (const label of obj.properties.labels) {
          keywords.add(label.toLowerCase());
        }
      }

      // Extract from title (simple tokenization)
      if (obj.title) {
        const words = obj.title
          .toLowerCase()
          .split(/\s+/)
          .filter((w) => w.length > 3); // Ignore short words

        for (const word of words) {
          keywords.add(word);
        }
      }

      objectKeywords.set(obj.id, keywords);
    }

    // Compare all pairs
    for (let i = 0; i < objects.length; i++) {
      for (let j = i + 1; j < objects.length; j++) {
        const obj1 = objects[i];
        const obj2 = objects[j];

        const keywords1 = objectKeywords.get(obj1.id);
        const keywords2 = objectKeywords.get(obj2.id);

        if (!keywords1 || !keywords2 || keywords1.size === 0 || keywords2.size === 0) {
          continue;
        }

        // Calculate Jaccard similarity
        const intersection = new Set([...keywords1].filter((k) => keywords2.has(k)));

        const union = new Set([...keywords1, ...keywords2]);

        const similarity = intersection.size / union.size;

        if (similarity >= this.options.keywordOverlapThreshold) {
          // Create bidirectional similarity relations
          relations.push({
            from_id: obj1.id,
            to_id: obj2.id,
            type: 'similar_to',
            source: 'computed',
            confidence: similarity,
            metadata: {
              shared_keywords: Array.from(intersection),
              keyword_overlap_score: similarity,
            },
            created_at: new Date().toISOString(),
          });

          relations.push({
            from_id: obj2.id,
            to_id: obj1.id,
            type: 'similar_to',
            source: 'computed',
            confidence: similarity,
            metadata: {
              shared_keywords: Array.from(intersection),
              keyword_overlap_score: similarity,
            },
            created_at: new Date().toISOString(),
          });
        }
      }
    }

    return relations;
  }

  /**
   * Detect duplicate objects using semantic_hash (CDM paper recommendation)
   * Objects with identical semantic_hash are considered exact duplicates
   */
  detectDuplicates(objects: CanonicalObject[]): Relation[] {
    if (!this.options.enableDuplicateDetection) {
      return [];
    }

    const relations: Relation[] = [];
    const hashMap = new Map<string, CanonicalObject[]>();

    // Group objects by semantic_hash
    for (const obj of objects) {
      if (obj.semantic_hash) {
        const existing = hashMap.get(obj.semantic_hash) || [];
        existing.push(obj);
        hashMap.set(obj.semantic_hash, existing);
      }
    }

    // Find duplicates (groups with more than one object)
    for (const [hash, group] of hashMap) {
      if (group.length > 1) {
        // Create duplicate_of relations between all pairs
        // First object is considered the "original", others are duplicates
        const original = group[0];
        for (let i = 1; i < group.length; i++) {
          const duplicate = group[i];
          relations.push({
            from_id: duplicate.id,
            to_id: original.id,
            type: 'duplicate_of',
            source: 'computed',
            confidence: 1.0, // Exact hash match = 100% confidence
            metadata: {
              semantic_hash: hash,
              detection_method: 'semantic_hash',
              group_size: group.length,
            },
            created_at: new Date().toISOString(),
          });
        }

        console.log(
          `[RelationInferrer] Found ${group.length} duplicates with hash ${hash.substring(0, 8)}...`
        );
      }
    }

    if (relations.length > 0) {
      console.log(`[RelationInferrer] Detected ${relations.length} duplicate relations`);
    }

    return relations;
  }

  /**
   * Infer similarity relations using both keywords and semantic embeddings
   * @param objects - Canonical objects to compare
   * @param embeddings - Map of object ID to embedding vector
   */
  inferSimilarityWithEmbeddings(
    objects: CanonicalObject[],
    embeddings: Map<string, number[]>
  ): Relation[] {
    if (!this.options.includeInferred) {
      return [];
    }

    // Debug logging
    console.log(`\n[RelationInferrer] inferSimilarityWithEmbeddings called:`);
    console.log(`  - Objects: ${objects.length}`);
    console.log(`  - Embeddings available: ${embeddings.size}`);
    console.log(`  - useSemanticSimilarity: ${this.options.useSemanticSimilarity}`);
    console.log(`  - semanticWeight: ${this.options.semanticWeight}`);
    console.log(`  - similarityThreshold: ${this.options.similarityThreshold}`);
    console.log(`  - keywordOverlapThreshold: ${this.options.keywordOverlapThreshold}`);

    const relations: Relation[] = [];

    // Build keyword index (same as before)
    const objectKeywords = new Map<string, Set<string>>();

    for (const obj of objects) {
      const keywords = new Set<string>();

      if (obj.properties?.keywords && Array.isArray(obj.properties.keywords)) {
        for (const keyword of obj.properties.keywords) {
          keywords.add(keyword.toLowerCase());
        }
      }

      if (obj.properties?.labels && Array.isArray(obj.properties.labels)) {
        for (const label of obj.properties.labels) {
          keywords.add(label.toLowerCase());
        }
      }

      if (obj.title) {
        const words = obj.title
          .toLowerCase()
          .split(/\s+/)
          .filter((w) => w.length > 3);

        for (const word of words) {
          keywords.add(word);
        }
      }

      objectKeywords.set(obj.id, keywords);
    }

    // Compare all pairs with combined similarity
    let pairCount = 0;
    let semanticPairCount = 0;
    let passedThresholdCount = 0;

    for (let i = 0; i < objects.length; i++) {
      for (let j = i + 1; j < objects.length; j++) {
        const obj1 = objects[i];
        const obj2 = objects[j];
        pairCount++;

        // Calculate keyword similarity
        const keywords1 = objectKeywords.get(obj1.id);
        const keywords2 = objectKeywords.get(obj2.id);

        let keywordSim = 0;
        if (keywords1 && keywords2 && keywords1.size > 0 && keywords2.size > 0) {
          const intersection = new Set([...keywords1].filter((k) => keywords2.has(k)));
          const union = new Set([...keywords1, ...keywords2]);
          keywordSim = intersection.size / union.size;
        }

        // Calculate semantic similarity if embeddings are available
        let semanticSim = 0;
        const emb1 = embeddings.get(obj1.id);
        const emb2 = embeddings.get(obj2.id);

        if (this.options.useSemanticSimilarity && emb1 && emb2) {
          semanticSim = this.cosineSimilarity(emb1, emb2);
          semanticPairCount++;

          // Log first few semantic comparisons for debugging
          if (semanticPairCount <= 3) {
            console.log(`    Pair ${semanticPairCount}: ${obj1.title} <-> ${obj2.title}`);
            console.log(`      Keyword sim: ${keywordSim.toFixed(3)}`);
            console.log(`      Semantic sim: ${semanticSim.toFixed(3)}`);
          }
        }

        // Combine similarities based on weight
        const combinedSim =
          this.options.useSemanticSimilarity && emb1 && emb2
            ? this.options.semanticWeight * semanticSim +
              (1 - this.options.semanticWeight) * keywordSim
            : keywordSim;

        // Use lower threshold when combining semantic + keyword
        const threshold =
          this.options.useSemanticSimilarity && emb1 && emb2
            ? this.options.similarityThreshold
            : this.options.keywordOverlapThreshold;

        // Log first few comparisons with combined similarity
        if (pairCount <= 3) {
          console.log(`      Combined sim: ${combinedSim.toFixed(3)}`);
          console.log(`      Threshold: ${threshold.toFixed(3)}`);
          console.log(`      Passed: ${combinedSim >= threshold ? 'YES' : 'NO'}`);
        }

        if (combinedSim >= threshold) {
          passedThresholdCount++;
          const metadata: Record<string, any> = {
            combined_similarity: combinedSim,
          };

          if (keywordSim > 0 && keywords1 && keywords2) {
            metadata.keyword_similarity = keywordSim;
            metadata.shared_keywords = Array.from(
              new Set([...keywords1].filter((k) => keywords2.has(k)))
            );
          }

          if (semanticSim > 0) {
            metadata.semantic_similarity = semanticSim;
          }

          // Create bidirectional relations
          relations.push({
            from_id: obj1.id,
            to_id: obj2.id,
            type: 'similar_to',
            source: 'computed',
            confidence: combinedSim,
            metadata,
            created_at: new Date().toISOString(),
          });

          relations.push({
            from_id: obj2.id,
            to_id: obj1.id,
            type: 'similar_to',
            source: 'computed',
            confidence: combinedSim,
            metadata,
            created_at: new Date().toISOString(),
          });
        }
      }
    }

    console.log(`\n[RelationInferrer] Summary:`);
    console.log(`  - Total pairs compared: ${pairCount}`);
    console.log(`  - Pairs with semantic similarity: ${semanticPairCount}`);
    console.log(`  - Pairs that passed threshold: ${passedThresholdCount}`);
    console.log(`  - Relations created: ${relations.length}`);

    return relations;
  }

  /**
   * Infer all relations (explicit + similarity)
   */
  inferAll(objects: CanonicalObject[]): Relation[] {
    const explicit = this.extractExplicit(objects);
    const similarity = this.inferSimilarity(objects);

    return [...explicit, ...similarity];
  }

  /**
   * Infer all relations with semantic embeddings (explicit + similarity with embeddings)
   */
  inferAllWithEmbeddings(
    objects: CanonicalObject[],
    embeddings: Map<string, number[]>
  ): Relation[] {
    const explicit = this.extractExplicit(objects);
    const similarity = this.inferSimilarityWithEmbeddings(objects, embeddings);

    return [...explicit, ...similarity];
  }

  /**
   * Get relations for a specific object
   */
  getRelationsFor(
    relations: Relation[],
    objectId: string,
    direction: 'from' | 'to' | 'both' = 'both'
  ): Relation[] {
    if (direction === 'from') {
      return relations.filter((r) => r.from_id === objectId);
    } else if (direction === 'to') {
      return relations.filter((r) => r.to_id === objectId);
    } else {
      return relations.filter((r) => r.from_id === objectId || r.to_id === objectId);
    }
  }

  /**
   * Get relations by type
   */
  getRelationsByType(relations: Relation[], type: RelationType): Relation[] {
    return relations.filter((r) => r.type === type);
  }

  /**
   * Get relation statistics
   */
  getStats(relations: Relation[]): {
    total: number;
    by_type: Record<RelationType, number>;
    by_source: Record<RelationSource, number>;
    avg_confidence: number;
  } {
    const by_type: Partial<Record<RelationType, number>> = {};
    const by_source: Partial<Record<RelationSource, number>> = {};
    let total_confidence = 0;

    for (const rel of relations) {
      // By type
      by_type[rel.type] = (by_type[rel.type] || 0) + 1;

      // By source
      by_source[rel.source] = (by_source[rel.source] || 0) + 1;

      // Confidence
      total_confidence += rel.confidence;
    }

    return {
      total: relations.length,
      by_type: by_type as Record<RelationType, number>,
      by_source: by_source as Record<RelationSource, number>,
      avg_confidence: relations.length > 0 ? total_confidence / relations.length : 0,
    };
  }
}
