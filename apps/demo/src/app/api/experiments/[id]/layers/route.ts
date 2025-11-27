import { UnifiedMemoryDB } from '@unified-memory/db';
import * as dotenv from 'dotenv';
import { NextRequest, NextResponse } from 'next/server';

dotenv.config();

type LayerName = 'chunking' | 'embedding' | 'graph' | 'retrieval' | 'validation';
type EvaluationMethod = 'ground_truth' | 'llm_judge';

interface LayerMetric {
  layer: LayerName;
  evaluation_method: EvaluationMethod;
  metrics: Record<string, unknown>;
  duration_ms: number | null;
  created_at: string;
}

interface LayerMetricsResponse {
  experiment_id: number;
  layers: {
    [K in LayerName]?: {
      ground_truth?: Record<string, unknown>;
      llm_judge?: Record<string, unknown>;
      duration_ms?: number;
    };
  };
  evaluation_methods: EvaluationMethod[];
}

function getDbConfig() {
  return {
    host: process.env.POSTGRES_HOST || 'localhost',
    port: parseInt(process.env.POSTGRES_PORT || '5434', 10),
    database: process.env.POSTGRES_DB || 'unified_memory',
    user: process.env.POSTGRES_USER || 'unified_memory',
    password: process.env.POSTGRES_PASSWORD || 'unified_memory_dev',
    maxConnections: parseInt(process.env.POSTGRES_MAX_CONNECTIONS || '20', 10),
    vectorDimensions: parseInt(process.env.VECTOR_DIMENSIONS || '1536', 10),
  };
}

// GET /api/experiments/[id]/layers - Get layer metrics for an experiment
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const experimentId = parseInt(params.id, 10);

    if (isNaN(experimentId)) {
      return NextResponse.json({ error: 'Invalid experiment ID' }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const evaluationMethod = searchParams.get('method') as EvaluationMethod | null;

    const db = new UnifiedMemoryDB(getDbConfig());
    await db.initialize();
    const pool = (db as any).pool;

    // Check if experiment exists
    const experimentResult = await pool.query('SELECT id FROM experiments WHERE id = $1', [
      experimentId,
    ]);

    if (experimentResult.rows.length === 0) {
      await db.close();
      return NextResponse.json({ error: 'Experiment not found' }, { status: 404 });
    }

    // Build query based on optional method filter
    let query =
      'SELECT layer, evaluation_method, metrics, duration_ms, created_at FROM layer_metrics WHERE experiment_id = $1';
    const queryParams: (number | string)[] = [experimentId];

    if (evaluationMethod) {
      query += ' AND evaluation_method = $2';
      queryParams.push(evaluationMethod);
    }

    query += ' ORDER BY layer, evaluation_method';

    const metricsResult = await pool.query(query, queryParams);
    await db.close();

    // Transform flat results into structured response
    const layers: LayerMetricsResponse['layers'] = {};
    const evaluationMethods = new Set<EvaluationMethod>();

    for (const row of metricsResult.rows as LayerMetric[]) {
      const { layer, evaluation_method, metrics, duration_ms } = row;

      if (!layers[layer]) {
        layers[layer] = {};
      }

      layers[layer]![evaluation_method] = metrics;
      if (duration_ms !== null) {
        layers[layer]!.duration_ms = duration_ms;
      }

      evaluationMethods.add(evaluation_method);
    }

    const response: LayerMetricsResponse = {
      experiment_id: experimentId,
      layers,
      evaluation_methods: Array.from(evaluationMethods),
    };

    return NextResponse.json(response);
  } catch (error: any) {
    console.error('Failed to fetch layer metrics:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch layer metrics' },
      { status: 500 }
    );
  }
}

// POST /api/experiments/[id]/layers - Store layer metrics
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const experimentId = parseInt(params.id, 10);

    if (isNaN(experimentId)) {
      return NextResponse.json({ error: 'Invalid experiment ID' }, { status: 400 });
    }

    const body = await request.json();
    const { layer, evaluation_method, metrics, duration_ms } = body;

    // Validate required fields
    if (!layer || !metrics) {
      return NextResponse.json(
        { error: 'Missing required fields: layer, metrics' },
        { status: 400 }
      );
    }

    const validLayers: LayerName[] = ['chunking', 'embedding', 'graph', 'retrieval', 'validation'];
    if (!validLayers.includes(layer)) {
      return NextResponse.json(
        { error: `Invalid layer. Must be one of: ${validLayers.join(', ')}` },
        { status: 400 }
      );
    }

    const db = new UnifiedMemoryDB(getDbConfig());
    await db.initialize();
    const pool = (db as any).pool;

    // Check if experiment exists
    const experimentResult = await pool.query('SELECT id FROM experiments WHERE id = $1', [
      experimentId,
    ]);

    if (experimentResult.rows.length === 0) {
      await db.close();
      return NextResponse.json({ error: 'Experiment not found' }, { status: 404 });
    }

    // Upsert layer metrics
    const result = await pool.query(
      `INSERT INTO layer_metrics (experiment_id, layer, evaluation_method, metrics, duration_ms)
       VALUES ($1, $2, $3, $4::jsonb, $5)
       ON CONFLICT (experiment_id, layer, evaluation_method)
       DO UPDATE SET
         metrics = $4::jsonb,
         duration_ms = $5,
         created_at = NOW()
       RETURNING *`,
      [
        experimentId,
        layer,
        evaluation_method || 'ground_truth',
        JSON.stringify(metrics),
        duration_ms || null,
      ]
    );

    await db.close();

    return NextResponse.json({
      success: true,
      metric: result.rows[0],
    });
  } catch (error: any) {
    console.error('Failed to store layer metrics:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to store layer metrics' },
      { status: 500 }
    );
  }
}
