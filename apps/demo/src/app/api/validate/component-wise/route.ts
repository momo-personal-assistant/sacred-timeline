import { RelationInferrer, type Relation } from '@momo/graph';
import { UnifiedMemoryDB } from '@unified-memory/db';
import * as dotenv from 'dotenv';
import { NextRequest, NextResponse } from 'next/server';

dotenv.config();

interface ComponentMetrics {
  scenario: string;

  // Explicit Relations Stage (데이터에서 직접 추출)
  explicit: {
    precision: number;
    recall: number;
    f1_score: number;
    true_positives: number;
    false_positives: number;
    false_negatives: number;
    total_inferred: number;
    total_ground_truth: number;
  };

  // Similarity Relations Stage (계산/추론)
  similarity: {
    precision: number;
    recall: number;
    f1_score: number;
    true_positives: number;
    false_positives: number;
    false_negatives: number;
    total_inferred: number;
    total_ground_truth: number;
  };

  // Overall (전체)
  overall: {
    precision: number;
    recall: number;
    f1_score: number;
    true_positives: number;
    false_positives: number;
    false_negatives: number;
    total_inferred: number;
    total_ground_truth: number;
  };

  // Breakdown by relation type
  by_type: Record<
    string,
    {
      precision: number;
      recall: number;
      f1_score: number;
    }
  >;
}

/**
 * Average multiple embedding vectors
 */
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

function calculateComponentMetrics(
  groundTruth: Relation[],
  inferredExplicit: Relation[],
  inferredSimilarity: Relation[],
  scenario: string
): ComponentMetrics {
  const allInferred = [...inferredExplicit, ...inferredSimilarity];

  // Ground truth by source
  const gtExplicit = groundTruth.filter((r) => r.source === 'explicit');
  const gtComputed = groundTruth.filter((r) => r.source === 'computed' || r.source === 'inferred');

  // Calculate metrics for explicit relations
  const explicitMetrics = calculateStageMetrics(gtExplicit, inferredExplicit);

  // Calculate metrics for similarity relations
  const similarityMetrics = calculateStageMetrics(gtComputed, inferredSimilarity);

  // Calculate overall metrics
  const overallMetrics = calculateStageMetrics(groundTruth, allInferred);

  // Calculate by type
  const byType: Record<string, { precision: number; recall: number; f1_score: number }> = {};
  const allTypes = new Set([...groundTruth.map((r) => r.type), ...allInferred.map((r) => r.type)]);

  for (const type of allTypes) {
    const gtForType = groundTruth.filter((r) => r.type === type);
    const infForType = allInferred.filter((r) => r.type === type);
    const metrics = calculateStageMetrics(gtForType, infForType);
    byType[type] = {
      precision: metrics.precision,
      recall: metrics.recall,
      f1_score: metrics.f1_score,
    };
  }

  return {
    scenario,
    explicit: explicitMetrics,
    similarity: similarityMetrics,
    overall: overallMetrics,
    by_type: byType,
  };
}

function calculateStageMetrics(
  groundTruth: Relation[],
  inferred: Relation[]
): {
  precision: number;
  recall: number;
  f1_score: number;
  true_positives: number;
  false_positives: number;
  false_negatives: number;
  total_inferred: number;
  total_ground_truth: number;
} {
  const groundTruthSet = new Set(groundTruth.map(normalizeRelation));
  const inferredSet = new Set(inferred.map(normalizeRelation));

  const truePositives = inferred.filter((rel) => groundTruthSet.has(normalizeRelation(rel)));
  const falsePositives = inferred.filter((rel) => !groundTruthSet.has(normalizeRelation(rel)));
  const falseNegatives = groundTruth.filter((rel) => !inferredSet.has(normalizeRelation(rel)));

  const tp = truePositives.length;
  const fp = falsePositives.length;
  const fn = falseNegatives.length;

  const precision = tp + fp > 0 ? tp / (tp + fp) : 0;
  const recall = tp + fn > 0 ? tp / (tp + fn) : 0;
  const f1Score = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;

  return {
    precision,
    recall,
    f1_score: f1Score,
    true_positives: tp,
    false_positives: fp,
    false_negatives: fn,
    total_inferred: inferred.length,
    total_ground_truth: groundTruth.length,
  };
}

/**
 * Persist layer metrics to the database
 * Stores graph layer metrics from component-wise validation
 */
async function persistLayerMetrics(
  pool: any,
  experimentId: number,
  metrics: ComponentMetrics,
  durationMs: number
): Promise<void> {
  // Store graph layer metrics (this API evaluates the graph/relation extraction layer)
  const graphMetrics = {
    explicit: metrics.explicit,
    similarity: metrics.similarity,
    overall: metrics.overall,
    by_type: metrics.by_type,
    scenario: metrics.scenario,
  };

  await pool.query(
    `INSERT INTO layer_metrics (experiment_id, layer, evaluation_method, metrics, duration_ms)
     VALUES ($1, $2, $3, $4::jsonb, $5)
     ON CONFLICT (experiment_id, layer, evaluation_method)
     DO UPDATE SET
       metrics = $4::jsonb,
       duration_ms = $5,
       created_at = NOW()`,
    [experimentId, 'graph', 'ground_truth', JSON.stringify(graphMetrics), durationMs]
  );

  // Also store validation layer metrics (overall end-to-end F1)
  const validationMetrics = {
    f1_score: metrics.overall.f1_score,
    precision: metrics.overall.precision,
    recall: metrics.overall.recall,
    true_positives: metrics.overall.true_positives,
    false_positives: metrics.overall.false_positives,
    false_negatives: metrics.overall.false_negatives,
  };

  await pool.query(
    `INSERT INTO layer_metrics (experiment_id, layer, evaluation_method, metrics, duration_ms)
     VALUES ($1, $2, $3, $4::jsonb, $5)
     ON CONFLICT (experiment_id, layer, evaluation_method)
     DO UPDATE SET
       metrics = $4::jsonb,
       duration_ms = $5,
       created_at = NOW()`,
    [experimentId, 'validation', 'ground_truth', JSON.stringify(validationMetrics), durationMs]
  );
}

export async function GET(request: NextRequest) {
  const startTime = Date.now();

  try {
    const { searchParams } = new URL(request.url);
    const scenario = searchParams.get('scenario') || 'normal';
    const useSemanticSimilarity = searchParams.get('semantic') === 'true';
    const experimentId = searchParams.get('experimentId');
    const persistMetrics = searchParams.get('persist') === 'true';

    // Initialize database
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

    // Initialize relation inferrer
    const inferrer = new RelationInferrer({
      similarityThreshold: 0.35,
      keywordOverlapThreshold: 0.65,
      includeInferred: true,
      useSemanticSimilarity,
      semanticWeight: 0.7,
    });

    // Load ground truth relations
    const pool = (db as any).pool;
    const groundTruthResult = await pool.query(
      `
      SELECT from_id, to_id, relation_type as type, source, confidence
      FROM ground_truth_relations
      WHERE scenario = $1
      `,
      [scenario]
    );

    const groundTruth: Relation[] = groundTruthResult.rows.map((row: any) => ({
      from_id: row.from_id,
      to_id: row.to_id,
      type: row.type,
      source: row.source as 'explicit' | 'inferred' | 'computed',
      confidence: parseFloat(row.confidence),
    }));

    // Get all canonical objects
    const objects = await db.searchCanonicalObjects({}, 1000);

    // Infer relations separately by stage
    // Type assertion needed due to incompatible type definitions between DB and shared packages
    const inferredExplicit = inferrer.extractExplicit(objects as any);

    let inferredSimilarity: Relation[];

    if (useSemanticSimilarity) {
      // Get embeddings for each object
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
          const chunkEmbeddings = chunksResult.rows.map((row: any) => row.embedding);
          const avgEmbedding = averageEmbeddings(chunkEmbeddings);
          embeddings.set(obj.id, avgEmbedding);
        }
      }

      inferredSimilarity = inferrer.inferSimilarityWithEmbeddings(objects as any, embeddings);
    } else {
      inferredSimilarity = inferrer.inferSimilarity(objects as any);
    }

    // Calculate component-wise metrics
    const metrics = calculateComponentMetrics(
      groundTruth,
      inferredExplicit,
      inferredSimilarity,
      scenario
    );

    const durationMs = Date.now() - startTime;

    // Persist metrics to layer_metrics table if requested
    if (experimentId && persistMetrics) {
      const expId = parseInt(experimentId, 10);
      if (!isNaN(expId)) {
        await persistLayerMetrics(pool, expId, metrics, durationMs);
      }
    }

    await db.close();

    return NextResponse.json({
      ...metrics,
      duration_ms: durationMs,
      persisted: persistMetrics && !!experimentId,
    });
  } catch (error: any) {
    console.error('Component-wise validation failed:', error);
    return NextResponse.json(
      { error: error.message || 'Component-wise validation failed' },
      { status: 500 }
    );
  }
}
