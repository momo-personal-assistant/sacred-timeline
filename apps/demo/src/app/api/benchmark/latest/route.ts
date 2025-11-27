import { UnifiedMemoryDB } from '@unified-memory/db';
import { NextResponse } from 'next/server';

// GET /api/benchmark/latest - Get latest benchmark run with query results
export async function GET() {
  const db = new UnifiedMemoryDB({
    host: process.env.POSTGRES_HOST || 'localhost',
    port: parseInt(process.env.POSTGRES_PORT || '5434', 10),
    database: process.env.POSTGRES_DB || 'unified_memory',
    user: process.env.POSTGRES_USER || 'unified_memory',
    password: process.env.POSTGRES_PASSWORD || 'unified_memory_dev',
    vectorDimensions: parseInt(process.env.VECTOR_DIMENSIONS || '1536', 10),
  });

  try {
    await db.initialize();
    const pool = (db as any).pool;

    // Get latest benchmark run
    const runResult = await pool.query(`
      SELECT * FROM benchmark_runs
      ORDER BY run_at DESC
      LIMIT 1
    `);

    if (runResult.rows.length === 0) {
      await db.close();
      return NextResponse.json({
        success: true,
        data: null,
        message: 'No benchmark runs found. Run: pnpm tsx scripts/run-benchmark.ts',
      });
    }

    const run = runResult.rows[0];

    // Get query results for this run
    const queryResults = await pool.query(
      `
      SELECT * FROM benchmark_query_results
      WHERE run_id = $1
      ORDER BY f1_score DESC
    `,
      [run.id]
    );

    await db.close();

    return NextResponse.json({
      success: true,
      data: {
        run: {
          id: run.id,
          run_at: run.run_at,
          overall_f1: run.overall_f1,
          overall_precision: run.overall_precision,
          overall_recall: run.overall_recall,
          total_queries: run.total_queries,
          passed_queries: run.passed_queries,
          pipeline_stats: run.pipeline_stats,
          duration_ms: run.duration_ms,
        },
        queries: queryResults.rows.map((q: any) => ({
          query_text: q.query_text,
          f1_score: q.f1_score,
          precision: q.precision_score,
          recall: q.recall_score,
          expected_count: q.expected_count,
          found_count: q.found_count,
          status: q.status,
          retrieval_time_ms: q.retrieval_time_ms,
        })),
      },
    });
  } catch (error: unknown) {
    console.error('Failed to fetch benchmark results:', error);
    await db.close();
    return NextResponse.json(
      { success: false, error: 'Failed to fetch benchmark results' },
      { status: 500 }
    );
  }
}
