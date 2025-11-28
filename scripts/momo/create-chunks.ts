#!/usr/bin/env tsx
/**
 * Create chunks from canonical objects for Momo workspace
 * Simple chunking: one chunk per object (title + body)
 */

import { getDb } from '@unified-memory/db';

async function createChunks() {
  const db = await getDb();
  const pool = (db as any).pool;

  try {
    // Fetch all tenxai canonical objects
    const objectsResult = await pool.query(`
      SELECT id, title, body, platform, object_type
      FROM canonical_objects
      WHERE id LIKE '%|tenxai|%'
      ORDER BY id
    `);

    const objects = objectsResult.rows;
    console.log(`\n📦 Found ${objects.length} canonical objects`);

    let insertedCount = 0;
    let skippedCount = 0;

    for (const obj of objects) {
      const { id, title, body } = obj;

      // Create chunk ID
      const chunkId = `${id}|chunk-0`;

      // Check if chunk already exists
      const existingChunk = await pool.query('SELECT id FROM chunks WHERE id = $1', [chunkId]);

      if (existingChunk.rowCount > 0) {
        skippedCount++;
        continue;
      }

      // Combine title and body as chunk content
      const content = `${title || ''}\n\n${body || ''}`.trim();

      if (!content) {
        console.log(`⚠️  Skipping ${id}: empty content`);
        skippedCount++;
        continue;
      }

      // Insert chunk
      await pool.query(
        `
        INSERT INTO chunks (
          id,
          canonical_object_id,
          chunk_index,
          content,
          method
        ) VALUES ($1, $2, $3, $4, $5)
        `,
        [chunkId, id, 0, content, 'full_text']
      );

      insertedCount++;

      if (insertedCount % 10 === 0) {
        console.log(`  ✓ Created ${insertedCount} chunks...`);
      }
    }

    console.log(`\n✅ Chunking complete:`);
    console.log(`   - Inserted: ${insertedCount}`);
    console.log(`   - Skipped: ${skippedCount}`);
    console.log(`   - Total: ${objects.length}`);
  } catch (error) {
    console.error('❌ Error creating chunks:', error);
    throw error;
  } finally {
    await db.close();
  }
}

createChunks().catch(console.error);
