#!/usr/bin/env tsx
/**
 * Update Paper Analysis Script
 * Update paper metadata after analysis
 */

import * as dotenv from 'dotenv';

import { UnifiedMemoryDB } from '@unified-memory/db';

dotenv.config();

interface PaperUpdate {
  id: string;
  title: string;
  authors: string;
  tags: string[];
  priority: string;
  momo_relevance: string;
  expected_f1_gain: number;
  implementation_effort: string;
  summary_path: string;
}

async function main() {
  const updateJson = process.argv[2];
  if (!updateJson) {
    console.error("Usage: pnpm tsx scripts/update-paper-analysis.ts '<json>'");
    process.exit(1);
  }

  const update: PaperUpdate = JSON.parse(updateJson);

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

    await (db as any).pool.query(
      `UPDATE papers
       SET
         title = $1,
         authors = $2,
         tags = $3,
         priority = $4,
         momo_relevance = $5,
         expected_f1_gain = $6,
         implementation_effort = $7,
         summary_path = $8,
         analyzed_at = NOW()
       WHERE id = $9`,
      [
        update.title,
        update.authors,
        update.tags,
        update.priority,
        update.momo_relevance,
        update.expected_f1_gain,
        update.implementation_effort,
        update.summary_path,
        update.id,
      ]
    );

    console.log(`✅ Updated paper ${update.id}`);
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
