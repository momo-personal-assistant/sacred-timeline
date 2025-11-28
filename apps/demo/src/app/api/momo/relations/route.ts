import { getDb } from '@unified-memory/db';
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

/**
 * Calculate confidence based on relation characteristics
 * - Explicit relations (stored in DB) get base confidence
 * - Relations with direct issue references get higher confidence
 * - Validated relations (with feedback) get moderate confidence
 */
function calculateConfidence(
  relationType: string,
  hasDirectReference: boolean,
  storedConfidence?: number
): number {
  // If confidence is already stored (from match-feedback), use it
  if (storedConfidence !== undefined && storedConfidence !== null) {
    return storedConfidence;
  }

  // Base confidence by relation type
  const baseConfidence: Record<string, number> = {
    triggered_by: 0.85, // VOC → Issue (explicit link in data)
    validated_by: 0.75, // Issue → Feedback (inferred from keywords)
    resulted_in_issue: 0.85,
    related_to: 0.6,
  };

  let confidence = baseConfidence[relationType] || 0.5;

  // Boost for direct issue reference
  if (hasDirectReference) {
    confidence = Math.min(1.0, confidence + 0.1);
  }

  return Math.round(confidence * 100) / 100;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const workspace = searchParams.get('workspace') || process.env.WORKSPACE || 'sample';

  let db;
  try {
    db = await getDb();
    const pool = (
      db as unknown as {
        pool: { query: (sql: string, params?: unknown[]) => Promise<{ rows: unknown[] }> };
      }
    ).pool;

    // Query VOC → Issue relations (triggered_by) - filtered by workspace
    // Now also fetches match_confidence if stored
    const vocToIssueResult = await pool.query(
      `
      SELECT
        voc.id as from_id,
        voc.title as from_title,
        voc.platform as from_platform,
        voc.relations->>'resulted_in_issue' as to_canonical_id,
        voc.relations->>'match_confidence' as stored_confidence,
        issue.title as to_title,
        issue.platform as to_platform,
        'triggered_by' as relation_type
      FROM canonical_objects voc
      LEFT JOIN canonical_objects issue ON issue.id = voc.relations->>'resulted_in_issue'
      WHERE voc.platform = 'discord'
        AND voc.object_type = 'voc'
        AND voc.relations->>'resulted_in_issue' IS NOT NULL
        AND voc.id LIKE $1
      ORDER BY voc.timestamps->>'created_at' DESC
    `,
      [`discord|${workspace}|%`]
    );

    // Query Issue → Feedback relations (validated_by) - filtered by workspace
    // Note: validated_by is stored as an array in JSONB
    const issueToFeedbackResult = await pool.query(
      `
      SELECT
        issue.id as from_id,
        issue.title as from_title,
        issue.platform as from_platform,
        jsonb_array_elements_text(feedback.relations->'validated_by') as to_canonical_id,
        feedback.relations->>'match_confidence' as stored_confidence,
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
        AND feedback.id LIKE $1
      ORDER BY feedback.timestamps->>'created_at' DESC
    `,
      [`notion|${workspace}|%`]
    );

    // Combine results
    const allRows = [...vocToIssueResult.rows, ...issueToFeedbackResult.rows];

    // Note: We don't close db here because it's a singleton
    // It will be closed when the application shuts down

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
        stored_confidence?: string;
      };

      // Extract short IDs from canonical IDs
      const fromShortId = r.from_id.split('|').pop() || r.from_id;
      const toShortId = r.to_canonical_id?.split('|').pop() || '';

      // Check if there's a direct issue reference in the title
      const hasDirectReference =
        r.from_title?.includes(toShortId) || r.to_title?.includes(fromShortId);

      // Parse stored confidence if available
      const storedConfidence = r.stored_confidence ? parseFloat(r.stored_confidence) : undefined;

      return {
        id: `rel-${String(index + 1).padStart(3, '0')}`,
        from_id: fromShortId,
        from_title: r.from_title || '',
        from_platform: r.from_platform,
        to_id: toShortId,
        to_title: r.to_title || '',
        to_platform: r.to_platform || '',
        relation_type: r.relation_type,
        confidence: calculateConfidence(r.relation_type, hasDirectReference, storedConfidence),
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
        avgConfidence: Math.round(avgConfidence * 100) / 100,
        byType,
      },
    });
  } catch (error) {
    console.error('Error fetching relations:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch relations',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
