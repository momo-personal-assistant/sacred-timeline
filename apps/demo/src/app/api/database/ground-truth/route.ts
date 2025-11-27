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

    // Get all ground truth relations with object info
    const result = await pool.query(`
      SELECT
        gt.id,
        gt.from_id,
        gt.to_id,
        gt.relation_type,
        gt.confidence,
        gt.source,
        gt.metadata,
        gt.scenario,
        gt.created_at,
        from_obj.title as from_title,
        from_obj.platform as from_platform,
        from_obj.object_type as from_type,
        to_obj.title as to_title,
        to_obj.platform as to_platform,
        to_obj.object_type as to_type
      FROM ground_truth_relations gt
      LEFT JOIN canonical_objects from_obj ON gt.from_id = from_obj.id
      LEFT JOIN canonical_objects to_obj ON gt.to_id = to_obj.id
      ORDER BY gt.confidence DESC, gt.created_at DESC
    `);

    // Get relation type summary
    const typeSummary = await pool.query(`
      SELECT
        relation_type,
        source,
        COUNT(*) as count,
        AVG(confidence) as avg_confidence
      FROM ground_truth_relations
      GROUP BY relation_type, source
      ORDER BY count DESC
    `);

    // Get unique objects involved in relations (for graph nodes)
    const objectsInRelations = await pool.query(`
      SELECT DISTINCT co.id, co.title, co.platform, co.object_type
      FROM canonical_objects co
      WHERE co.id IN (
        SELECT from_id FROM ground_truth_relations
        UNION
        SELECT to_id FROM ground_truth_relations
      )
    `);

    await db.close();

    return NextResponse.json({
      relations: result.rows,
      objects: objectsInRelations.rows,
      summary: {
        totalRelations: result.rows.length,
        totalObjects: objectsInRelations.rows.length,
        byType: typeSummary.rows,
      },
    });
  } catch (error) {
    console.error('Error fetching ground truth relations:', error);
    try {
      await db.close();
    } catch {
      // Ignore close error
    }
    return NextResponse.json(
      {
        error: 'Failed to fetch ground truth relations',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
