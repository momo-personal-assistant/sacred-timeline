import { RelationInferrer, type Relation } from '@momo/graph';
import { UnifiedMemoryDB } from '@unified-memory/db';
import * as dotenv from 'dotenv';
import { NextRequest, NextResponse } from 'next/server';

dotenv.config();

interface ValidationMetrics {
  scenario: string;
  precision: number;
  recall: number;
  f1_score: number;
  true_positives: number;
  false_positives: number;
  false_negatives: number;
  ground_truth_total: number;
  inferred_total: number;
}

function normalizeRelation(rel: Relation): string {
  return `${rel.from_id}|${rel.to_id}|${rel.type}`;
}

function calculateMetrics(
  groundTruth: Relation[],
  inferred: Relation[],
  scenario: string
): ValidationMetrics {
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
    scenario,
    precision,
    recall,
    f1_score: f1Score,
    true_positives: tp,
    false_positives: fp,
    false_negatives: fn,
    ground_truth_total: groundTruth.length,
    inferred_total: inferred.length,
  };
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const scenario = searchParams.get('scenario') || 'normal';

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
      similarityThreshold: 0.85,
      includeInferred: true,
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

    // Infer relations
    const inferred = inferrer.inferAll(objects);

    // Calculate metrics
    const metrics = calculateMetrics(groundTruth, inferred, scenario);

    await db.close();

    return NextResponse.json(metrics);
  } catch (error: any) {
    console.error('Validation failed:', error);
    return NextResponse.json({ error: error.message || 'Validation failed' }, { status: 500 });
  }
}
