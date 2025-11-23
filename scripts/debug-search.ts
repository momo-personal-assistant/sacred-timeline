#!/usr/bin/env tsx
/**
 * Debug Search Script
 * Shows actual similarity scores to help tune threshold
 */

import * as dotenv from 'dotenv';

import { OpenAIEmbedder } from '@momo/embedding/openai-embedder';
import { UnifiedMemoryDB } from '@unified-memory/db';

dotenv.config();

async function main() {
  const query = process.argv[2] || 'authentication issues';

  const db = new UnifiedMemoryDB({
    host: process.env.POSTGRES_HOST || 'localhost',
    port: parseInt(process.env.POSTGRES_PORT || '5434', 10),
    database: process.env.POSTGRES_DB || 'unified_memory',
    user: process.env.POSTGRES_USER || 'unified_memory',
    password: process.env.POSTGRES_PASSWORD || 'unified_memory_dev',
    maxConnections: 20,
    vectorDimensions: 1536,
  });

  try {
    await db.initialize();
    console.log(`Query: "${query}"\n`);

    const embedder = new OpenAIEmbedder({
      apiKey: process.env.OPENAI_API_KEY!,
      model: 'text-embedding-3-small',
    });

    const queryEmbedding = await embedder.embed(query);
    const pool = (db as any).pool;

    // Get top 20 results with NO threshold
    const results = await pool.query(
      `
      SELECT
        id,
        canonical_object_id,
        content,
        method,
        metadata,
        1 - (embedding <=> $1::vector(1536)) AS similarity
      FROM chunks
      WHERE embedding IS NOT NULL
      ORDER BY embedding <=> $1::vector(1536)
      LIMIT 20
      `,
      [`[${queryEmbedding.embedding.join(',')}]`]
    );

    console.log('TOP 20 RESULTS (No threshold)');
    console.log('='.repeat(80));

    for (let i = 0; i < results.rows.length; i++) {
      const row = results.rows[i];
      console.log(`\n${i + 1}. Similarity: ${row.similarity.toFixed(4)}`);
      console.log(`   Object: ${row.canonical_object_id}`);
      console.log(`   Method: ${row.method}`);
      if (row.metadata?.title) {
        console.log(`   Title: ${row.metadata.title}`);
      }
      console.log(`   Content: ${row.content.substring(0, 150)}...`);
    }

    console.log('\n' + '='.repeat(80));
    console.log('THRESHOLD ANALYSIS');
    console.log('='.repeat(80));

    const thresholds = [0.5, 0.6, 0.7, 0.8];
    for (const threshold of thresholds) {
      const count = results.rows.filter((r) => r.similarity >= threshold).length;
      console.log(`Threshold ${threshold}: ${count} results`);
    }

    console.log('\nRECOMMENDATION:');
    const maxSim = results.rows[0]?.similarity || 0;
    if (maxSim < 0.5) {
      console.log('  Max similarity is very low. Your data might not match the query.');
      console.log('  Try different queries or check your data.');
    } else if (maxSim < 0.7) {
      console.log(`  Use threshold 0.5-0.6 (max similarity: ${maxSim.toFixed(4)})`);
    } else {
      console.log(`  Current threshold 0.7 is OK (max similarity: ${maxSim.toFixed(4)})`);
    }
  } finally {
    await db.close();
  }
}

main();
