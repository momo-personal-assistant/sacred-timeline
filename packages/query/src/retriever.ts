/**
 * Retriever
 *
 * Retrieves relevant chunks and canonical objects using vector search and graph traversal
 */

import type { OpenAIEmbedder } from '@momo/embedding';
import type { RelationInferrer, Relation } from '@momo/graph';
import { TemporalProcessor } from '@momo/temporal';
import type { UnifiedMemoryDB, CanonicalObject } from '@unified-memory/db';

export interface ChunkResult {
  id: string;
  canonical_object_id: string;
  content: string;
  method: string;
  metadata: Record<string, any>;
  similarity: number;
}

export interface RetrievalResult {
  query: string;
  chunks: ChunkResult[];
  objects: CanonicalObject[];
  relations: Relation[];
  stats: {
    total_chunks: number;
    total_objects: number;
    total_relations: number;
    retrieval_time_ms: number;
  };
}

export interface RetrieverConfig {
  similarityThreshold?: number;
  chunkLimit?: number;
  includeRelations?: boolean;
  relationDepth?: number;
}

export class Retriever {
  private db: UnifiedMemoryDB;
  private embedder: OpenAIEmbedder;
  private relationInferrer?: RelationInferrer;
  private config: Required<RetrieverConfig>;

  constructor(
    db: UnifiedMemoryDB,
    embedder: OpenAIEmbedder,
    relationInferrer?: RelationInferrer,
    config: RetrieverConfig = {}
  ) {
    this.db = db;
    this.embedder = embedder;
    this.relationInferrer = relationInferrer;
    this.config = {
      similarityThreshold: config.similarityThreshold ?? 0.35, // Lowered from 0.7 to 0.35
      chunkLimit: config.chunkLimit ?? 20,
      includeRelations: config.includeRelations ?? true,
      relationDepth: config.relationDepth ?? 1,
    };
  }

  /**
   * Retrieve relevant chunks and objects for a query
   */
  async retrieve(query: string): Promise<RetrievalResult> {
    const startTime = Date.now();

    // 1. Generate query embedding
    const queryEmbedding = await this.embedder.embed(query);

    // 2. Search for similar chunks using vector search
    const pool = (this.db as any).pool;
    const chunkResults = await pool.query(
      `
      SELECT * FROM search_chunks_by_embedding(
        $1::vector(1536),
        $2::float,
        $3::int,
        NULL  -- no method filter
      )
      `,
      [
        `[${queryEmbedding.embedding.join(',')}]`,
        this.config.similarityThreshold,
        this.config.chunkLimit,
      ]
    );

    const chunks: ChunkResult[] = chunkResults.rows;

    // 3. Get unique canonical objects
    const objectIds = [...new Set(chunks.map((c) => c.canonical_object_id))];
    const objects: CanonicalObject[] = [];

    for (const id of objectIds) {
      const obj = await this.db.getCanonicalObject(id);
      if (obj) {
        objects.push(obj);
      }
    }

    // 4. Get relations if enabled
    let relations: Relation[] = [];
    if (this.config.includeRelations && this.relationInferrer && objects.length > 0) {
      relations = this.relationInferrer.inferAll(objects);
    }

    const retrievalTime = Date.now() - startTime;

    return {
      query,
      chunks,
      objects,
      relations,
      stats: {
        total_chunks: chunks.length,
        total_objects: objects.length,
        total_relations: relations.length,
        retrieval_time_ms: retrievalTime,
      },
    };
  }

  /**
   * Retrieve and expand using graph traversal
   */
  async retrieveWithExpansion(query: string): Promise<RetrievalResult> {
    // First, do basic retrieval
    const baseResult = await this.retrieve(query);

    if (!this.config.includeRelations || !this.relationInferrer) {
      return baseResult;
    }

    // Expand to related objects
    const relatedObjectIds = new Set<string>();
    for (const relation of baseResult.relations) {
      relatedObjectIds.add(relation.from_id);
      relatedObjectIds.add(relation.to_id);
    }

    // Remove objects we already have
    for (const obj of baseResult.objects) {
      relatedObjectIds.delete(obj.id);
    }

    // Fetch related objects
    const relatedObjects: CanonicalObject[] = [];
    for (const id of relatedObjectIds) {
      const obj = await this.db.getCanonicalObject(id);
      if (obj) {
        relatedObjects.push(obj);
      }
    }

    // Combine all objects and re-infer relations
    const allObjects = [...baseResult.objects, ...relatedObjects];
    const allRelations = this.relationInferrer.inferAll(allObjects);

    return {
      ...baseResult,
      objects: allObjects,
      relations: allRelations,
      stats: {
        ...baseResult.stats,
        total_objects: allObjects.length,
        total_relations: allRelations.length,
      },
    };
  }

  /**
   * Get objects related to a specific object
   */
  async getRelatedObjects(
    objectId: string,
    depth: number = 1
  ): Promise<{
    objects: CanonicalObject[];
    relations: Relation[];
  }> {
    const visited = new Set<string>();
    const objects: CanonicalObject[] = [];
    const relations: Relation[] = [];

    // BFS traversal
    const queue: Array<{ id: string; currentDepth: number }> = [{ id: objectId, currentDepth: 0 }];

    while (queue.length > 0) {
      const { id, currentDepth } = queue.shift()!;

      if (visited.has(id) || currentDepth > depth) {
        continue;
      }

      visited.add(id);

      // Get object
      const obj = await this.db.getCanonicalObject(id);
      if (!obj) {
        continue;
      }

      objects.push(obj);

      // If we haven't reached max depth, explore neighbors
      if (currentDepth < depth && this.relationInferrer) {
        const objRelations = this.relationInferrer.extractExplicit([obj]);
        relations.push(...objRelations);

        // Add neighbors to queue
        for (const rel of objRelations) {
          if (!visited.has(rel.to_id)) {
            queue.push({ id: rel.to_id, currentDepth: currentDepth + 1 });
          }
        }
      }
    }

    return { objects, relations };
  }

  /**
   * Retrieve with temporal reranking
   * Boosts more recent documents in the ranking
   */
  async retrieveWithReranking(
    query: string,
    temporalConfig?: { maxAgeDays?: number; recencyBoost?: number }
  ): Promise<RetrievalResult> {
    // 1. Do basic retrieval
    const result = await this.retrieve(query);

    if (result.chunks.length === 0) {
      return result;
    }

    // 2. Apply temporal reranking
    const temporal = new TemporalProcessor({
      maxAgeDays: temporalConfig?.maxAgeDays ?? 30,
      recencyBoost: temporalConfig?.recencyBoost ?? 0.1,
    });

    const rerankedChunks = temporal.applyRecencyBoost(result.chunks, result.objects);

    // 3. Reorder objects based on chunk order
    const chunkOrderMap = new Map<string, number>(
      rerankedChunks.map((c, i) => [c.canonical_object_id, i] as [string, number])
    );
    const rerankedObjects = [...result.objects].sort((a, b) => {
      const aOrder = chunkOrderMap.get(a.id) ?? Infinity;
      const bOrder = chunkOrderMap.get(b.id) ?? Infinity;
      return aOrder - bOrder;
    });

    return {
      ...result,
      chunks: rerankedChunks,
      objects: rerankedObjects,
    };
  }
}
