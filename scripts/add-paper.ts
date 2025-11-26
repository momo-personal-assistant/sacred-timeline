#!/usr/bin/env tsx
/**
 * Add Paper Script
 * Add a new paper to the database
 */

import * as dotenv from 'dotenv';

import { UnifiedMemoryDB } from '@unified-memory/db';

dotenv.config();

async function main() {
  const filename = process.argv[2];
  if (!filename) {
    console.error('Usage: pnpm tsx scripts/add-paper.ts <filename>');
    process.exit(1);
  }

  const db = new UnifiedMemoryDB({
    host: process.env.POSTGRES_HOST || 'localhost',
    port: parseInt(process.env.POSTGRES_PORT || '5434', 10),
    database: process.env.POSTGRES_DB || 'unified_memory',
    user: process.env.POSTGRES_USER || 'unified_memory',
    password: process.env.POSTGRES_PASSWORD || 'unified_memory_dev',
    maxConnections: parseInt(process.env.POSTGRES_MAX_CONNECTIONS || '20', 10),
    vectorDimensions: parseInt(process.env.VECTOR_DIMENSIONS || '1536', 10),
  });

  try {
    await db.initialize();

    // Get next ID
    const idResult = await (db as any).pool.query('SELECT get_next_paper_id() as id');
    const id = idResult.rows[0].id;

    // Insert paper
    await (db as any).pool.query(
      `INSERT INTO papers (id, filename, pdf_path, status, created_at)
       VALUES ($1, $2, $3, $4, NOW())`,
      [id, filename, `docs/research/papers/sources/${filename}`, '📋 To Experiment']
    );

    console.log(JSON.stringify({ id, filename }, null, 2));
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  } finally {
    await db.close();
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
