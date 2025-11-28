import type { NotionPage } from '@momo/transformers';
import { NotionTransformer } from '@momo/transformers';
import { getDb } from '@unified-memory/db';
import type { CreateCanonicalObjectInput } from '@unified-memory/db';
import { NextResponse } from 'next/server';

interface SyncRequestBody {
  pages: NotionPage[];
  workspace?: string;
}

export async function POST(request: Request) {
  try {
    const db = await getDb();

    // Parse Notion pages from request body
    const body = (await request.json()) as SyncRequestBody;
    const notionPages: NotionPage[] = body.pages || [];
    const workspace = body.workspace || 'tenxai';

    // Initialize transformer with workspace from request
    const transformer = new NotionTransformer({
      workspace,
      includeMetadata: true,
      preserveRawData: false,
    });

    // Transform to CanonicalObject format
    const canonicalObjects: CreateCanonicalObjectInput[] = notionPages.map((page) => {
      // Validate page
      const validation = transformer.validatePage(page);
      if (!validation.valid) {
        throw new Error(`Invalid page ${page.id}: ${validation.errors.join(', ')}`);
      }

      const transformed = transformer.transform(page);

      // Ensure required fields are present for CreateCanonicalObjectInput
      return {
        ...transformed,
        title: transformed.title || '',
        body: transformed.body || '',
      } as CreateCanonicalObjectInput;
    });

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
            relations = $7,
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
            JSON.stringify(obj.relations || {}),
          ]
        );
        updatedCount++;
      }
    }

    // Note: Don't close singleton DB connection

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
    console.error('Error syncing Notion pages:', error);
    return NextResponse.json(
      {
        error: 'Failed to sync Notion pages',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
