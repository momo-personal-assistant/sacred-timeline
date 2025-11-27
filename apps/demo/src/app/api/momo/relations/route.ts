import { UnifiedMemoryDB } from '@unified-memory/db';
import { NextResponse } from 'next/server';

export interface RelationItem {
  id: string;
  from_id: string;
  from_title: string;
  from_platform: string;
  to_id: string;
  to_title: string;
  to_platform: string;
  relation_type: string;
  confidence: number;
}

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
    const pool = (
      db as unknown as { pool: { query: (sql: string) => Promise<{ rows: unknown[] }> } }
    ).pool;

    // Query VOC → Issue relations (triggered_by)
    const vocToIssueResult = await pool.query(`
      SELECT
        voc.id as from_id,
        voc.title as from_title,
        voc.platform as from_platform,
        voc.relations->>'resulted_in_issue' as to_canonical_id,
        issue.title as to_title,
        issue.platform as to_platform,
        'triggered_by' as relation_type
      FROM canonical_objects voc
      LEFT JOIN canonical_objects issue ON issue.id = voc.relations->>'resulted_in_issue'
      WHERE voc.platform = 'discord'
        AND voc.object_type = 'voc'
        AND voc.relations->>'resulted_in_issue' IS NOT NULL
      ORDER BY voc.timestamps->>'created_at' DESC
    `);

    // Query Issue → Feedback relations (validated_by)
    // Note: validated_by is stored as an array in JSONB
    const issueToFeedbackResult = await pool.query(`
      SELECT
        issue.id as from_id,
        issue.title as from_title,
        issue.platform as from_platform,
        jsonb_array_elements_text(feedback.relations->'validated_by') as to_canonical_id,
        feedback.id as feedback_canonical_id,
        feedback.title as to_title,
        feedback.platform as to_platform,
        'validated_by' as relation_type
      FROM canonical_objects feedback
      LEFT JOIN canonical_objects issue ON issue.id = ANY(
        SELECT jsonb_array_elements_text(feedback.relations->'validated_by')
      )
      WHERE feedback.platform = 'notion'
        AND feedback.object_type IN ('meeting_note', 'feedback', 'page')
        AND feedback.relations->'validated_by' IS NOT NULL
      ORDER BY feedback.timestamps->>'created_at' DESC
    `);

    // Combine results
    const allRows = [...vocToIssueResult.rows, ...issueToFeedbackResult.rows];

    await db.close();

    // Transform DB results to API format
    const items: RelationItem[] = allRows.map((row: unknown, index: number) => {
      const r = row as {
        from_id: string;
        from_title: string;
        from_platform: string;
        to_canonical_id: string;
        to_title: string;
        to_platform: string;
        relation_type: string;
      };

      // Extract short IDs from canonical IDs
      const fromShortId = r.from_id.split('|').pop() || r.from_id;
      const toShortId = r.to_canonical_id?.split('|').pop() || '';

      return {
        id: `rel-${String(index + 1).padStart(3, '0')}`,
        from_id: fromShortId,
        from_title: r.from_title || '',
        from_platform: r.from_platform,
        to_id: toShortId,
        to_title: r.to_title || '',
        to_platform: r.to_platform || '',
        relation_type: r.relation_type,
        confidence: 0.9, // Default confidence
      };
    });

    const avgConfidence =
      items.length > 0 ? items.reduce((acc, r) => acc + r.confidence, 0) / items.length : 0;

    const byType = items.reduce(
      (acc, rel) => {
        acc[rel.relation_type] = (acc[rel.relation_type] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    return NextResponse.json({
      items,
      summary: {
        total: items.length,
        avgConfidence,
        byType,
      },
    });
  } catch (error) {
    console.error('Error fetching relations:', error);
    try {
      await db.close();
    } catch {
      // Ignore close error
    }
    return NextResponse.json(
      {
        error: 'Failed to fetch relations',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
