#!/usr/bin/env tsx
/**
 * Check Papers Script
 * Query the papers table to see which papers are already registered
 */

import * as dotenv from 'dotenv';

import { UnifiedMemoryDB } from '@unified-memory/db';

dotenv.config();

async function main() {
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

    // Access the pool directly to run custom queries
    const result = await (db as any).pool.query(
      'SELECT id, filename, status FROM papers ORDER BY id'
    );
    console.log(JSON.stringify(result.rows, null, 2));
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
