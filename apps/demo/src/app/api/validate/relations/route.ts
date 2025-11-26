import { RelationInferrer, type Relation } from '@momo/graph';
import { UnifiedMemoryDB } from '@unified-memory/db';
import * as dotenv from 'dotenv';
import { NextRequest, NextResponse } from 'next/server';

dotenv.config();

interface RelationWithStatus extends Relation {
  status: 'tp' | 'fp' | 'fn';
}

interface RelationsResponse {
  relations: RelationWithStatus[];
  papers: { id: string; title: string }[];
  metrics: {
    true_positives: number;
    false_positives: number;
    false_negatives: number;
    precision: number;
    recall: number;
    f1_score: number;
  };
}

function averageEmbeddings(embeddings: number[][]): number[] {
  if (embeddings.length === 0) {
    throw new Error('Cannot average zero embeddings');
  }

  const dimension = embeddings[0].length;
  const result = new Array(dimension).fill(0);

  for (const embedding of embeddings) {
    for (let i = 0; i < dimension; i++) {
      result[i] += embedding[i];
    }
  }

  for (let i = 0; i < dimension; i++) {
    result[i] /= embeddings.length;
  }

  return result;
}

function normalizeRelation(rel: Relation): string {
  return `${rel.from_id}|${rel.to_id}|${rel.type}`;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const scenario = searchParams.get('scenario') || 'normal';
    const useSemanticSimilarity = searchParams.get('semantic') === 'true';
    const similarityThreshold = parseFloat(searchParams.get('similarityThreshold') || '0.35');
    const keywordOverlapThreshold = parseFloat(
      searchParams.get('keywordOverlapThreshold') || '0.65'
    );
    const semanticWeight = parseFloat(searchParams.get('semanticWeight') || '0.7');

    const db = new UnifiedMemoryDB({
      host: process.env.POSTGRES_HOST || 'localhost',
      port: parseInt(process.env.POSTGRES_PORT || '5434', 10),
      database: process.env.POSTGRES_DB || 'unified_memory',
      user: process.env.POSTGRES_USER || 'unified_memory',
      password: process.env.POSTGRES_PASSWORD || 'unified_memory_dev',
      maxConnections: parseInt(process.env.POSTGRES_MAX_CONNECTIONS || '20', 10),
      vectorDimensions: parseInt(process.env.VECTOR_DIMENSIONS || '1536', 10),
    });

    await db.initialize();

    const inferrer = new RelationInferrer({
      similarityThreshold,
      keywordOverlapThreshold,
      includeInferred: true,
      useSemanticSimilarity,
      semanticWeight,
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pool = (db as any).pool;

    // Load ground truth relations
    const groundTruthResult = await pool.query(
      `
      SELECT from_id, to_id, relation_type as type, source, confidence
      FROM ground_truth_relations
      WHERE scenario = $1
      `,
      [scenario]
    );

    const groundTruth: Relation[] = groundTruthResult.rows.map(
      (row: {
        from_id: string;
        to_id: string;
        type: string;
        source: string;
        confidence: string;
      }) => ({
        from_id: row.from_id,
        to_id: row.to_id,
        type: row.type,
        source: row.source as 'explicit' | 'inferred' | 'computed',
        confidence: parseFloat(row.confidence),
      })
    );

    // Get all canonical objects
    const objects = await db.searchCanonicalObjects({}, 1000);

    // Get all canonical object titles for display (not just papers)
    const objectsResult = await pool.query(`
      SELECT id, title, object_type FROM canonical_objects
    `);
    const papers = objectsResult.rows.map(
      (row: { id: string; title: string; object_type: string }) => ({
        id: row.id,
        title: row.title || `${row.object_type}: ${row.id.split('|').pop() || row.id.slice(0, 20)}`,
      })
    );

    let inferred: Relation[];

    if (useSemanticSimilarity) {
      const embeddings = new Map<string, number[]>();

      for (const obj of objects) {
        const chunksResult = await pool.query(
          `
          SELECT embedding
          FROM chunks
          WHERE canonical_object_id = $1
          AND embedding IS NOT NULL
          LIMIT 5
          `,
          [obj.id]
        );

        if (chunksResult.rows.length > 0) {
          const chunkEmbeddings = chunksResult.rows.map(
            (row: { embedding: number[] }) => row.embedding
          );
          const avgEmbedding = averageEmbeddings(chunkEmbeddings);
          embeddings.set(obj.id, avgEmbedding);
        }
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      inferred = inferrer.inferAllWithEmbeddings(objects as any, embeddings);
    } else {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      inferred = inferrer.inferAll(objects as any);
    }

    // Calculate TP, FP, FN
    const groundTruthSet = new Set(groundTruth.map(normalizeRelation));
    const inferredSet = new Set(inferred.map(normalizeRelation));

    const relationsWithStatus: RelationWithStatus[] = [];

    // True Positives: inferred and in ground truth
    for (const rel of inferred) {
      if (groundTruthSet.has(normalizeRelation(rel))) {
        relationsWithStatus.push({ ...rel, status: 'tp' });
      } else {
        relationsWithStatus.push({ ...rel, status: 'fp' });
      }
    }

    // False Negatives: in ground truth but not inferred
    for (const rel of groundTruth) {
      if (!inferredSet.has(normalizeRelation(rel))) {
        relationsWithStatus.push({ ...rel, status: 'fn' });
      }
    }

    const tp = relationsWithStatus.filter((r) => r.status === 'tp').length;
    const fp = relationsWithStatus.filter((r) => r.status === 'fp').length;
    const fn = relationsWithStatus.filter((r) => r.status === 'fn').length;

    const precision = tp + fp > 0 ? tp / (tp + fp) : 0;
    const recall = tp + fn > 0 ? tp / (tp + fn) : 0;
    const f1Score = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;

    await db.close();

    const response: RelationsResponse = {
      relations: relationsWithStatus,
      papers,
      metrics: {
        true_positives: tp,
        false_positives: fp,
        false_negatives: fn,
        precision,
        recall,
        f1_score: f1Score,
      },
    };

    return NextResponse.json(response);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch relations';
    console.error('Failed to fetch relations:', error);
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
