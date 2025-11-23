import { UnifiedMemoryDB } from '@unified-memory/db';
import * as dotenv from 'dotenv';
import { NextRequest, NextResponse } from 'next/server';

dotenv.config();

// GET /api/experiments/compare?ids=1,2,3
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const idsParam = searchParams.get('ids');

    if (!idsParam) {
      return NextResponse.json({ error: 'Experiment IDs are required' }, { status: 400 });
    }

    const ids = idsParam.split(',').map((id) => parseInt(id.trim(), 10));

    if (ids.some((id) => isNaN(id))) {
      return NextResponse.json({ error: 'Invalid experiment IDs' }, { status: 400 });
    }

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
    const pool = (db as any).pool;

    // Get experiments
    const experimentsResult = await pool.query(
      'SELECT * FROM experiments WHERE id = ANY($1) ORDER BY id',
      [ids]
    );

    // Get all results for these experiments
    const resultsQuery = await pool.query(
      `
      SELECT * FROM experiment_results
      WHERE experiment_id = ANY($1)
      ORDER BY scenario, experiment_id
      `,
      [ids]
    );

    await db.close();

    // Group results by scenario
    const resultsByScenario: Record<string, any[]> = {};
    for (const result of resultsQuery.rows) {
      if (!resultsByScenario[result.scenario]) {
        resultsByScenario[result.scenario] = [];
      }
      resultsByScenario[result.scenario].push(result);
    }

    return NextResponse.json({
      experiments: experimentsResult.rows,
      results_by_scenario: resultsByScenario,
    });
  } catch (error: any) {
    console.error('Failed to compare experiments:', error);
    return NextResponse.json({ error: error.message || 'Failed to compare experiments' }, { status: 500 });
  }
}
