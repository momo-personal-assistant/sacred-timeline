import { UnifiedMemoryDB } from '@unified-memory/db';
import type { CreateCanonicalObjectInput } from '@unified-memory/db';
import { NextResponse } from 'next/server';

// Linear MCP types (simplified)
interface LinearIssue {
  id: string;
  identifier: string;
  title: string;
  description: string;
  status: string;
  priority?: { value: number; name: string };
  url: string;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  createdById?: string;
  assignee?: string;
  assigneeId?: string;
  projectId?: string;
  teamId?: string;
}

function convertLinearToCanonical(issue: LinearIssue): CreateCanonicalObjectInput {
  const canonicalId = `linear|tenxai|issue|${issue.identifier}`;

  return {
    id: canonicalId,
    platform: 'linear',
    object_type: 'issue',
    title: issue.title,
    body: issue.description || '',
    actors: {
      created_by: issue.createdBy ? `user:${issue.createdBy}` : undefined,
      assigned_to: issue.assignee ? `user:${issue.assignee}` : undefined,
    },
    timestamps: {
      created_at: issue.createdAt,
      updated_at: issue.updatedAt,
    },
    properties: {
      status: issue.status,
      priority: issue.priority?.name,
      team_id: issue.teamId,
      project_id: issue.projectId,
      url: issue.url,
    },
    visibility: 'team',
  };
}

export async function POST(request: Request) {
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

    // Parse Linear issues from request body
    const body = await request.json();
    const linearIssues: LinearIssue[] = body.issues || [];

    // Convert to CanonicalObject format
    const canonicalObjects = linearIssues.map(convertLinearToCanonical);

    // Upsert to database
    let insertedCount = 0;
    let updatedCount = 0;

    for (const obj of canonicalObjects) {
      const pool = (
        db as unknown as {
          pool: { query: (sql: string, params: unknown[]) => Promise<{ rowCount: number }> };
        }
      ).pool;

      // Check if exists
      const checkResult = await pool.query('SELECT id FROM canonical_objects WHERE id = $1', [
        obj.id,
      ]);

      if (checkResult.rowCount === 0) {
        // Insert new
        await db.createCanonicalObject(obj);
        insertedCount++;
      } else {
        // Update existing
        await pool.query(
          `
          UPDATE canonical_objects
          SET
            title = $2,
            body = $3,
            actors = $4,
            timestamps = $5,
            properties = $6,
            indexed_at = NOW()
          WHERE id = $1
        `,
          [
            obj.id,
            obj.title,
            obj.body,
            JSON.stringify(obj.actors),
            JSON.stringify(obj.timestamps),
            JSON.stringify(obj.properties),
          ]
        );
        updatedCount++;
      }
    }

    await db.close();

    return NextResponse.json({
      success: true,
      synced: {
        total: canonicalObjects.length,
        inserted: insertedCount,
        updated: updatedCount,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error syncing Linear issues:', error);
    try {
      await db.close();
    } catch {
      // Ignore close error
    }
    return NextResponse.json(
      {
        error: 'Failed to sync Linear issues',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
