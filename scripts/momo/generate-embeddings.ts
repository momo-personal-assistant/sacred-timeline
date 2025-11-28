#!/usr/bin/env tsx
/**
 * Generate embeddings for Momo chunks using OpenAI API
 */

import * as path from 'path';

import * as dotenv from 'dotenv';
import OpenAI from 'openai';

import { getDb } from '@unified-memory/db';

// Load .env from project root (override existing env vars)
dotenv.config({ path: path.join(__dirname, '../../.env'), override: true });

const EMBEDDING_MODEL = 'text-embedding-3-small';
const BATCH_SIZE = 50; // Process in batches to avoid rate limits

async function generateEmbeddings() {
  // Check API key
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    console.error('❌ OPENAI_API_KEY not found in environment');
    process.exit(1);
  }

  // Debug: show first/last 10 chars of API key
  console.log(
    `🔑 Using API key: ${apiKey.substring(0, 10)}...${apiKey.substring(apiKey.length - 4)}`
  );

  const openai = new OpenAI({ apiKey });
  const db = await getDb();
  const pool = (db as any).pool;

  try {
    // Fetch chunks without embeddings
    const chunksResult = await pool.query(`
      SELECT id, content
      FROM chunks
      WHERE canonical_object_id LIKE '%|tenxai|%'
        AND embedding IS NULL
      ORDER BY id
    `);

    const chunks = chunksResult.rows;
    console.log(`\n🔢 Found ${chunks.length} chunks without embeddings`);

    if (chunks.length === 0) {
      console.log('✅ All chunks already have embeddings');
      return;
    }

    let processedCount = 0;
    let totalTokens = 0;

    // Process in batches
    for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
      const batch = chunks.slice(i, i + BATCH_SIZE);
      const batchTexts = batch.map((chunk) => chunk.content);

      console.log(
        `\n📤 Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(chunks.length / BATCH_SIZE)}...`
      );

      try {
        // Call OpenAI API
        const response = await openai.embeddings.create({
          model: EMBEDDING_MODEL,
          input: batchTexts,
        });

        // Update each chunk with its embedding
        for (let j = 0; j < batch.length; j++) {
          const chunk = batch[j];
          const embedding = response.data[j].embedding;
          const tokens = response.usage.total_tokens / batch.length; // Approximate per chunk

          await pool.query(
            `
            UPDATE chunks
            SET
              embedding = $1::vector,
              embedding_model = $2,
              embedding_tokens = $3,
              embedded_at = NOW()
            WHERE id = $4
            `,
            [JSON.stringify(embedding), EMBEDDING_MODEL, Math.round(tokens), chunk.id]
          );

          processedCount++;
          totalTokens += tokens;
        }

        console.log(`  ✓ Embedded ${processedCount}/${chunks.length} chunks`);

        // Rate limiting: wait 1 second between batches
        if (i + BATCH_SIZE < chunks.length) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      } catch (error: any) {
        console.error(`❌ Error processing batch:`, error.message);
        throw error;
      }
    }

    const estimatedCost = (totalTokens / 1000) * 0.00002; // $0.00002 per 1K tokens

    console.log(`\n✅ Embedding generation complete:`);
    console.log(`   - Chunks embedded: ${processedCount}`);
    console.log(`   - Total tokens: ${Math.round(totalTokens)}`);
    console.log(`   - Estimated cost: $${estimatedCost.toFixed(4)}`);
    console.log(`   - Model: ${EMBEDDING_MODEL}`);
  } catch (error) {
    console.error('❌ Error generating embeddings:', error);
    throw error;
  } finally {
    await db.close();
  }
}

generateEmbeddings().catch(console.error);
