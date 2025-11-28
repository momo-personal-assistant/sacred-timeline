import { getDb } from '@unified-memory/db';
import { NextResponse } from 'next/server';

export interface VOCItem {
  id: string;
  platform: 'discord' | 'linear' | 'notion';
  object_type: string;
  title: string;
  body: string;
  actor: string;
  timestamp: string;
  status?: string;
  linkedIssue?: string;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const workspace = searchParams.get('workspace') || process.env.WORKSPACE || 'sample';

  try {
    const db = await getDb();
    const pool = (
      db as unknown as {
        pool: { query: (sql: string, params?: unknown[]) => Promise<{ rows: unknown[] }> };
      }
    ).pool;

    // Query VOC items from canonical_objects (filtered by workspace)
    const result = await pool.query(
      `
      SELECT
        id,
        platform,
        object_type,
        title,
        body,
        actors->>'created_by' as actor,
        timestamps->>'created_at' as timestamp,
        properties->>'status' as status,
        properties->>'linkedIssue' as linked_issue,
        relations->>'resulted_in_issue' as resulted_in_issue
      FROM canonical_objects
      WHERE platform = 'discord'
        AND object_type = 'voc'
        AND id LIKE $1
      ORDER BY timestamps->>'created_at' DESC
    `,
      [`discord|${workspace}|%`]
    );

    // Note: Don't close singleton DB connection

    // Transform DB results to API format
    const items: VOCItem[] = result.rows.map((row: unknown) => {
      const r = row as {
        id: string;
        platform: string;
        object_type: string;
        title: string;
        body: string;
        actor: string;
        timestamp: string;
        status: string;
        linked_issue: string;
        resulted_in_issue: string;
      };
      // Extract short ID from canonical ID (discord|tenxai|voc|voc-001 -> voc-001)
      const shortId = r.id.split('|').pop() || r.id;
      // Extract issue ID from relation (linear|tenxai|issue|TEN-159 -> TEN-159)
      const linkedIssue = r.resulted_in_issue
        ? r.resulted_in_issue.split('|').pop()
        : r.linked_issue;
      // Extract username from actor (user:email -> email)
      const actor = r.actor?.replace('user:', '') || '';

      return {
        id: shortId,
        platform: r.platform as 'discord',
        object_type: r.object_type,
        title: r.title || '',
        body: r.body || '',
        actor,
        timestamp: r.timestamp?.split('T')[0] || '',
        status: r.status,
        linkedIssue,
      };
    });

    const resolvedCount = items.filter((v) => v.status === 'resolved').length;
    const pendingCount = items.filter((v) => v.status === 'pending').length;
    const backlogCount = items.filter((v) => v.status === 'backlog').length;

    return NextResponse.json({
      items,
      summary: {
        total: items.length,
        resolved: resolvedCount,
        pending: pendingCount,
        backlog: backlogCount,
        linkedCount: items.filter((v) => v.linkedIssue).length,
      },
    });
  } catch (error) {
    console.error('Error fetching VOC data:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch VOC data',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
