import { getDb } from '@unified-memory/db';
import { NextResponse } from 'next/server';

export interface LinearIssue {
  id: string;
  platform: 'linear';
  object_type: string;
  title: string;
  body: string;
  actor: string;
  timestamp: string;
  status: string;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const workspace = searchParams.get('workspace') || process.env.WORKSPACE || 'tenxai';

  try {
    const db = await getDb();
    const pool = (
      db as unknown as {
        pool: { query: (sql: string, params?: unknown[]) => Promise<{ rows: unknown[] }> };
      }
    ).pool;

    // Query Linear issues from canonical_objects (filtered by workspace)
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
        properties->>'status' as status
      FROM canonical_objects
      WHERE platform = 'linear'
        AND object_type = 'issue'
        AND id LIKE $1
      ORDER BY timestamps->>'created_at' DESC
    `,
      [`linear|${workspace}|%`]
    );

    // Note: Don't close singleton DB connection

    // Transform DB results to API format
    const items: LinearIssue[] = result.rows.map((row: unknown) => {
      const r = row as {
        id: string;
        platform: string;
        object_type: string;
        title: string;
        body: string;
        actor: string;
        timestamp: string;
        status: string;
      };
      // Extract short ID from canonical ID (linear|tenxai|issue|TEN-159 -> TEN-159)
      const shortId = r.id.split('|').pop() || r.id;
      // Extract username from actor (user:email -> email)
      const actor = r.actor?.replace('user:', '') || '';

      return {
        id: shortId,
        platform: r.platform as 'linear',
        object_type: r.object_type,
        title: r.title || '',
        body: r.body || '',
        actor,
        timestamp: r.timestamp?.split('T')[0] || '',
        status: r.status || '',
      };
    });

    const doneCount = items.filter((i) => i.status === 'Done').length;
    const canceledCount = items.filter((i) => i.status === 'Canceled').length;

    return NextResponse.json({
      items,
      summary: {
        total: items.length,
        done: doneCount,
        canceled: canceledCount,
        project: 'Momo v4.',
      },
    });
  } catch (error) {
    console.error('Error fetching Linear issues:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch Linear issues',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
