import { UnifiedMemoryDB } from '@unified-memory/db';
import * as dotenv from 'dotenv';
import { NextRequest, NextResponse } from 'next/server';

dotenv.config();

// GET /api/experiments/[id] - Get experiment with results
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const experimentId = parseInt(params.id, 10);

    if (isNaN(experimentId)) {
      return NextResponse.json({ error: 'Invalid experiment ID' }, { status: 400 });
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

    // Get experiment
    const experimentResult = await pool.query('SELECT * FROM experiments WHERE id = $1', [experimentId]);

    if (experimentResult.rows.length === 0) {
      await db.close();
      return NextResponse.json({ error: 'Experiment not found' }, { status: 404 });
    }

    // Get results
    const resultsQuery = await pool.query(
      'SELECT * FROM experiment_results WHERE experiment_id = $1 ORDER BY scenario',
      [experimentId]
    );

    await db.close();

    return NextResponse.json({
      experiment: experimentResult.rows[0],
      results: resultsQuery.rows,
    });
  } catch (error: any) {
    console.error('Failed to fetch experiment:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch experiment' }, { status: 500 });
  }
}
