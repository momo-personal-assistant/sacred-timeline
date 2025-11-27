import { UnifiedMemoryDB } from '@unified-memory/db';
import { NextResponse } from 'next/server';

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

    // Get all canonical objects with their chunk counts
    const result = await pool.query(`
      SELECT
        co.id,
        co.platform,
        co.object_type,
        co.title,
        co.body,
        co.actors,
        co.timestamps,
        co.properties,
        co.visibility,
        co.indexed_at,
        COUNT(c.id) as chunk_count
      FROM canonical_objects co
      LEFT JOIN chunks c ON c.canonical_object_id = co.id
      GROUP BY co.id
      ORDER BY co.indexed_at DESC
    `);

    // Get platform summary
    const platformSummary = await pool.query(`
      SELECT
        platform,
        COUNT(*) as count,
        COUNT(DISTINCT object_type) as object_types
      FROM canonical_objects
      GROUP BY platform
      ORDER BY count DESC
    `);

    await db.close();

    return NextResponse.json({
      objects: result.rows,
      summary: {
        total: result.rows.length,
        byPlatform: platformSummary.rows,
      },
    });
  } catch (error) {
    console.error('Error fetching canonical objects:', error);
    try {
      await db.close();
    } catch {
      // Ignore close error
    }
    return NextResponse.json(
      {
        error: 'Failed to fetch canonical objects',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
