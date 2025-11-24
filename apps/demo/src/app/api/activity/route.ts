import { UnifiedMemoryDB } from '@unified-memory/db';
import * as dotenv from 'dotenv';
import { NextResponse } from 'next/server';

dotenv.config();

interface ResearchActivity {
  id: number;
  operation_type: string;
  operation_name: string;
  description: string;
  status: 'started' | 'completed' | 'failed';
  triggered_by: string;
  details: Record<string, any>;
  git_commit: string | null;
  parent_log_id: number | null;
  experiment_id: number | null;
  duration_ms: number | null;
  started_at: string;
  completed_at: string | null;
}

export async function GET(request: Request) {
  const db = new UnifiedMemoryDB({
    host: process.env.POSTGRES_HOST || 'localhost',
    port: parseInt(process.env.POSTGRES_PORT || '5434', 10),
    database: process.env.POSTGRES_DB || 'unified_memory',
    user: process.env.POSTGRES_USER || 'unified_memory',
    password: process.env.POSTGRES_PASSWORD || 'unified_memory_dev',
    maxConnections: parseInt(process.env.POSTGRES_MAX_CONNECTIONS || '20', 10),
    vectorDimensions: parseInt(process.env.VECTOR_DIMENSIONS || '1536', 10),
  });

  try {
    await db.initialize();
    const pool = (db as any).pool;

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    const operation_type = searchParams.get('operation_type');

    let query = `
      SELECT
        id,
        operation_type,
        operation_name,
        description,
        status,
        triggered_by,
        details,
        git_commit,
        parent_log_id,
        experiment_id,
        duration_ms,
        started_at,
        completed_at
      FROM research_activity_log
    `;

    const params: any[] = [];

    if (operation_type && operation_type !== 'all') {
      query += ` WHERE operation_type = $1`;
      params.push(operation_type);
      query += ` ORDER BY started_at DESC LIMIT $2`;
      params.push(limit);
    } else {
      query += ` ORDER BY started_at DESC LIMIT $1`;
      params.push(limit);
    }

    const result = await pool.query(query, params);

    const activities: ResearchActivity[] = result.rows.map((row: any) => ({
      ...row,
      details: row.details || {},
    }));

    // Get unique operation types for filter
    const typesResult = await pool.query(`
      SELECT DISTINCT operation_type
      FROM research_activity_log
      ORDER BY operation_type
    `);
    const operationTypes: string[] = typesResult.rows.map((row: any) => row.operation_type);

    return NextResponse.json({
      activities,
      total: activities.length,
      operationTypes,
    });
  } catch (error: any) {
    console.error('Activity feed error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch activity feed', details: error.message },
      { status: 500 }
    );
  } finally {
    await db.close();
  }
}
