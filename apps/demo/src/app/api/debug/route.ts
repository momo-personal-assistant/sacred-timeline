import * as dotenv from 'dotenv';
import { NextResponse } from 'next/server';
import { Pool } from 'pg';

dotenv.config();

export async function GET() {
  const pool = new Pool({
    host: process.env.POSTGRES_HOST || 'localhost',
    port: parseInt(process.env.POSTGRES_PORT || '5434', 10),
    database: process.env.POSTGRES_DB || 'unified_memory',
    user: process.env.POSTGRES_USER || 'unified_memory',
    password: process.env.POSTGRES_PASSWORD || 'unified_memory_dev',
    max: parseInt(process.env.POSTGRES_MAX_CONNECTIONS || '20', 10),
  });

  try {
    // Query counts
    const paperCount = await pool.query('SELECT COUNT(*) as count FROM papers');
    const chunkCount = await pool.query('SELECT COUNT(*) as count FROM chunks');
    const canonicalCount = await pool.query('SELECT COUNT(*) as count FROM canonical_objects');
    const gtCount = await pool.query('SELECT COUNT(*) as count FROM ground_truth_relations');
    const experimentsCount = await pool.query('SELECT COUNT(*) as count FROM experiments');

    // Sample data
    const paperSample = await pool.query(
      'SELECT id, title, authors, status, filename FROM papers LIMIT 3'
    );
    const chunkSample = await pool.query('SELECT id, content, chunk_index FROM chunks LIMIT 5');
    const canonicalSample = await pool.query(
      'SELECT id, platform, object_type, title FROM canonical_objects LIMIT 5'
    );
    const gtSample = await pool.query('SELECT * FROM ground_truth_relations LIMIT 10');
    const experimentsSample = await pool.query(
      'SELECT id, name, description, is_baseline, created_at FROM experiments LIMIT 5'
    );

    await pool.end();

    return NextResponse.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      data: {
        papers: {
          count: parseInt(paperCount.rows[0].count, 10),
          sample: paperSample.rows,
        },
        chunks: {
          count: parseInt(chunkCount.rows[0].count, 10),
          sample: chunkSample.rows,
        },
        canonical_objects: {
          count: parseInt(canonicalCount.rows[0].count, 10),
          sample: canonicalSample.rows,
        },
        ground_truth_relations: {
          count: parseInt(gtCount.rows[0].count, 10),
          sample: gtSample.rows,
        },
        experiments: {
          count: parseInt(experimentsCount.rows[0].count, 10),
          sample: experimentsSample.rows,
        },
      },
    });
  } catch (error) {
    console.error('Debug API error:', error);
    await pool.end();
    return NextResponse.json(
      {
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
