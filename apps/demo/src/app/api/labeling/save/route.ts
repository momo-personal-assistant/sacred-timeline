import { UnifiedMemoryDB } from '@unified-memory/db';
import { NextResponse } from 'next/server';

/**
 * POST /api/labeling/save
 *
 * Saves a human label for a relation pair.
 *
 * Body:
 * {
 *   from_id: string,
 *   to_id: string,
 *   label: 'related' | 'unrelated' | 'uncertain',
 *   notes?: string
 * }
 */
export async function POST(request: Request) {
  const body = await request.json();
  const { from_id, to_id, label, notes } = body;

  if (!from_id || !to_id || !label) {
    return NextResponse.json(
      { error: 'Missing required fields: from_id, to_id, label' },
      { status: 400 }
    );
  }

  if (!['related', 'unrelated', 'uncertain'].includes(label)) {
    return NextResponse.json(
      { error: 'Invalid label. Must be: related, unrelated, or uncertain' },
      { status: 400 }
    );
  }

  const db = new UnifiedMemoryDB({
    host: process.env.POSTGRES_HOST || 'localhost',
    port: parseInt(process.env.POSTGRES_PORT || '5434', 10),
    database: process.env.POSTGRES_DB || 'unified_memory',
    user: process.env.POSTGRES_USER || 'unified_memory',
    password: process.env.POSTGRES_PASSWORD || 'unified_memory_dev',
    maxConnections: 5,
    vectorDimensions: 1536,
  });

  try {
    await db.initialize();
    const pool = (db as any).pool;

    // Check if this pair already has a human label
    const existingResult = await pool.query(
      `SELECT id FROM ground_truth_relations
       WHERE source = 'human_label'
       AND ((from_id = $1 AND to_id = $2) OR (from_id = $2 AND to_id = $1))`,
      [from_id, to_id]
    );

    if (existingResult.rows.length > 0) {
      // Update existing label
      await pool.query(
        `UPDATE ground_truth_relations
         SET relation_type = $1,
             confidence = $2,
             metadata = $3::jsonb,
             created_at = NOW()
         WHERE id = $4`,
        [
          label === 'related'
            ? 'human_verified_related'
            : label === 'unrelated'
              ? 'human_verified_unrelated'
              : 'human_uncertain',
          label === 'related' ? 1.0 : label === 'unrelated' ? 0.0 : 0.5,
          JSON.stringify({
            label,
            notes: notes || null,
            labeled_at: new Date().toISOString(),
          }),
          existingResult.rows[0].id,
        ]
      );

      await db.close();
      return NextResponse.json({
        success: true,
        action: 'updated',
        id: existingResult.rows[0].id,
      });
    }

    // Only insert into GT if labeled as 'related'
    // 'unrelated' labels are stored separately for evaluation but don't go into GT
    if (label === 'related') {
      const insertResult = await pool.query(
        `INSERT INTO ground_truth_relations
         (from_id, to_id, relation_type, confidence, source, metadata)
         VALUES ($1, $2, $3, $4, $5, $6::jsonb)
         RETURNING id`,
        [
          from_id,
          to_id,
          'human_verified_related',
          1.0,
          'human_label',
          JSON.stringify({
            label,
            notes: notes || null,
            labeled_at: new Date().toISOString(),
          }),
        ]
      );

      await db.close();
      return NextResponse.json({
        success: true,
        action: 'inserted',
        id: insertResult.rows[0].id,
        addedToGT: true,
      });
    } else {
      // For 'unrelated' and 'uncertain', store in a separate tracking table
      // or in GT with a special relation_type (won't count as positive GT)
      const insertResult = await pool.query(
        `INSERT INTO ground_truth_relations
         (from_id, to_id, relation_type, confidence, source, metadata)
         VALUES ($1, $2, $3, $4, $5, $6::jsonb)
         RETURNING id`,
        [
          from_id,
          to_id,
          label === 'unrelated' ? 'human_verified_unrelated' : 'human_uncertain',
          label === 'unrelated' ? 0.0 : 0.5,
          'human_label',
          JSON.stringify({
            label,
            notes: notes || null,
            labeled_at: new Date().toISOString(),
          }),
        ]
      );

      await db.close();
      return NextResponse.json({
        success: true,
        action: 'inserted',
        id: insertResult.rows[0].id,
        addedToGT: false,
        note: 'Stored for evaluation but not as positive GT',
      });
    }
  } catch (error) {
    console.error('Error saving label:', error);
    await db.close();
    return NextResponse.json({ error: 'Failed to save label' }, { status: 500 });
  }
}

/**
 * GET /api/labeling/save
 *
 * Returns labeling statistics and progress.
 */
export async function GET() {
  const db = new UnifiedMemoryDB({
    host: process.env.POSTGRES_HOST || 'localhost',
    port: parseInt(process.env.POSTGRES_PORT || '5434', 10),
    database: process.env.POSTGRES_DB || 'unified_memory',
    user: process.env.POSTGRES_USER || 'unified_memory',
    password: process.env.POSTGRES_PASSWORD || 'unified_memory_dev',
    maxConnections: 5,
    vectorDimensions: 1536,
  });

  try {
    await db.initialize();
    const pool = (db as any).pool;

    const statsResult = await pool.query(`
      SELECT
        relation_type,
        COUNT(*) as count
      FROM ground_truth_relations
      WHERE source = 'human_label'
      GROUP BY relation_type
    `);

    const totalResult = await pool.query(`
      SELECT COUNT(*) as total FROM canonical_objects
    `);

    const objectCount = parseInt(totalResult.rows[0]?.total || '0');
    const totalPossiblePairs = (objectCount * (objectCount - 1)) / 2;

    const stats = {
      related: 0,
      unrelated: 0,
      uncertain: 0,
    };

    for (const row of statsResult.rows) {
      if (row.relation_type === 'human_verified_related') {
        stats.related = parseInt(row.count);
      } else if (row.relation_type === 'human_verified_unrelated') {
        stats.unrelated = parseInt(row.count);
      } else if (row.relation_type === 'human_uncertain') {
        stats.uncertain = parseInt(row.count);
      }
    }

    await db.close();

    return NextResponse.json({
      stats,
      totalLabeled: stats.related + stats.unrelated + stats.uncertain,
      totalPossiblePairs,
      progress:
        ((stats.related + stats.unrelated + stats.uncertain) / Math.min(100, totalPossiblePairs)) *
        100,
    });
  } catch (error) {
    console.error('Error fetching labeling stats:', error);
    await db.close();
    return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 });
  }
}
