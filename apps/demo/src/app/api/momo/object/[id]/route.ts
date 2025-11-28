import { getDb } from '@unified-memory/db';
import { NextResponse } from 'next/server';

/**
 * Get a single canonical object by short ID (e.g., "TEN-164" or "notion-002")
 */
export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const { searchParams } = new URL(request.url);
    const workspace = searchParams.get('workspace') || 'tenxai';
    const shortId = params.id;

    const db = await getDb();
    const pool = (db as any).pool;

    // Try to find the object by matching the short ID in the canonical ID
    // Format: platform|workspace|type|shortId
    const result = await pool.query(
      `
      SELECT *
      FROM canonical_objects
      WHERE id LIKE $1
      LIMIT 1
    `,
      [`%|${workspace}|%|${shortId}`]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Object not found' }, { status: 404 });
    }

    return NextResponse.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching object:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch object',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
