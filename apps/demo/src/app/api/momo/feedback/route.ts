import { UnifiedMemoryDB } from '@unified-memory/db';
import { NextResponse } from 'next/server';

export interface FeedbackItem {
  id: string;
  platform: 'notion';
  object_type: string;
  title: string;
  body: string;
  participants: string[];
  timestamp: string;
  keywords?: string[];
  linkedIssues?: string[];
  note_type?: string;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const workspace = searchParams.get('workspace') || process.env.WORKSPACE || 'sample';

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
      db as unknown as {
        pool: { query: (sql: string, params?: unknown[]) => Promise<{ rows: unknown[] }> };
      }
    ).pool;

    // Query Notion feedback/meeting notes from canonical_objects (filtered by workspace)
    const result = await pool.query(
      `
      SELECT
        id,
        platform,
        object_type,
        title,
        body,
        actors->'participants' as participants,
        timestamps->>'created_at' as timestamp,
        properties->'keywords' as keywords,
        properties->>'note_type' as note_type,
        relations->'validated_by' as validated_by
      FROM canonical_objects
      WHERE platform = 'notion'
        AND object_type IN ('meeting_note', 'feedback', 'page')
        AND id LIKE $1
      ORDER BY timestamps->>'created_at' DESC
    `,
      [`notion|${workspace}|%`]
    );

    await db.close();

    // Transform DB results to API format
    const items: FeedbackItem[] = result.rows.map((row: unknown) => {
      const r = row as {
        id: string;
        platform: string;
        object_type: string;
        title: string;
        body: string;
        participants: string[] | string;
        timestamp: string;
        keywords: string[] | string;
        note_type: string;
        validated_by: string[] | string;
      };

      // Extract short ID from canonical ID
      const shortId = r.id.split('|').pop() || r.id;

      // Parse JSONB arrays if they're strings
      const participants = Array.isArray(r.participants)
        ? r.participants
        : typeof r.participants === 'string'
          ? JSON.parse(r.participants)
          : [];

      const keywords = Array.isArray(r.keywords)
        ? r.keywords
        : typeof r.keywords === 'string'
          ? JSON.parse(r.keywords)
          : [];

      const validatedBy = Array.isArray(r.validated_by)
        ? r.validated_by
        : typeof r.validated_by === 'string'
          ? JSON.parse(r.validated_by)
          : [];

      // Extract issue IDs from validated_by relations
      const linkedIssues = validatedBy
        .map((canonicalId: string) => canonicalId.split('|').pop())
        .filter(Boolean);

      // Clean up participant emails
      const cleanParticipants = participants.map((p: string) =>
        p.replace('user:', '').replace('notion_', '')
      );

      return {
        id: shortId,
        platform: r.platform as 'notion',
        object_type: r.object_type,
        title: r.title || '',
        body: r.body || '',
        participants: cleanParticipants,
        timestamp: r.timestamp?.split('T')[0] || '',
        keywords,
        linkedIssues,
        note_type: r.note_type,
      };
    });

    const meetingCount = items.filter((f) => f.object_type === 'meeting_note').length;
    const feedbackCount = items.filter((f) => f.object_type === 'feedback').length;
    const pageCount = items.filter((f) => f.object_type === 'page').length;

    return NextResponse.json({
      items,
      summary: {
        total: items.length,
        meeting_notes: meetingCount,
        feedback: feedbackCount,
        pages: pageCount,
        linkedCount: items.filter((f) => f.linkedIssues && f.linkedIssues.length > 0).length,
      },
    });
  } catch (error) {
    console.error('Error fetching feedback data:', error);
    try {
      await db.close();
    } catch {
      // Ignore close error
    }
    return NextResponse.json(
      {
        error: 'Failed to fetch feedback data',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
