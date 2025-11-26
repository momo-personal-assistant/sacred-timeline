#!/usr/bin/env tsx
/**
 * Embed Chunks Script
 *
 * Purpose: Generate embeddings for canonical objects using chunking strategies
 *
 * Usage:
 *   pnpm tsx scripts/embed-chunks.ts <strategy> [scenario]
 *
 * Strategies:
 *   - fixed-size: Fixed-size chunks with overlap
 *   - semantic: Paragraph-based semantic chunks
 *   - relational: Structure-preserving chunks
 *
 * Examples:
 *   pnpm tsx scripts/embed-chunks.ts semantic
 *   pnpm tsx scripts/embed-chunks.ts fixed-size normal
 *   pnpm tsx scripts/embed-chunks.ts relational all
 */

import * as dotenv from 'dotenv';

import { Chunker, type ChunkingConfig, type Chunk } from '@momo/chunking';
import { OpenAIEmbedder, type EmbeddingConfig } from '@momo/embedding';
import { UnifiedMemoryDB } from '@unified-memory/db';

// Load environment variables
dotenv.config();

interface EmbedStats {
  strategy: string;
  total_objects: number;
  total_chunks: number;
  total_tokens: number;
  total_cost_usd: number;
  avg_chunks_per_object: number;
  avg_chunk_size: number;
  duration_ms: number;
}

/**
 * Embed chunks for a specific strategy
 */
async function embedChunks(
  db: UnifiedMemoryDB,
  chunker: Chunker,
  embedder: OpenAIEmbedder,
  strategy: string,
  scenario?: string
): Promise<EmbedStats> {
  const startTime = Date.now();

  console.log(`\nEmbedding chunks with strategy: ${strategy}`);
  console.log('='.repeat(60));

  // Fetch canonical objects
  console.log('\nFetching canonical objects...');
  const filters: any = {};
  if (scenario) {
    // In a real scenario, you'd filter by scenario
    // For now, we'll just process all objects
  }

  const objects = await db.searchCanonicalObjects(filters, 1000);
  console.log(`   Found ${objects.length} objects`);

  if (objects.length === 0) {
    console.log('   No objects to process');
    return {
      strategy,
      total_objects: 0,
      total_chunks: 0,
      total_tokens: 0,
      total_cost_usd: 0,
      avg_chunks_per_object: 0,
      avg_chunk_size: 0,
      duration_ms: Date.now() - startTime,
    };
  }

  // Chunk all objects
  console.log('\nChunking objects...');
  const allChunks: Chunk[] = [];
  for (const obj of objects) {
    const chunks = chunker.chunk(obj);
    allChunks.push(...chunks);
  }

  console.log(`   Generated ${allChunks.length} chunks`);

  const chunkStats = chunker.getStats(allChunks);
  console.log(`   Avg chunk size: ${chunkStats.avg_chunk_size} chars`);
  console.log(`   Min chunk size: ${chunkStats.min_chunk_size} chars`);
  console.log(`   Max chunk size: ${chunkStats.max_chunk_size} chars`);

  // Generate embeddings
  console.log('\nGenerating embeddings...');
  const texts = allChunks.map((c) => c.content);
  const result = await embedder.embedBatch(texts);

  console.log(`   Generated ${result.results.length} embeddings`);
  console.log(`   Total tokens: ${result.totalTokens}`);
  console.log(`   Model: ${result.model}`);

  const estimatedCost = embedder.estimateCost(result.totalTokens);
  console.log(`   Estimated cost: $${estimatedCost.toFixed(4)}`);

  // Save chunks to database
  console.log('\nSaving chunks to database...');
  const pool = (db as any).pool;
  let savedCount = 0;

  for (let i = 0; i < allChunks.length; i++) {
    const chunk = allChunks[i];
    const embedding = result.results[i].embedding;

    try {
      await pool.query(
        `
        INSERT INTO chunks (
          id,
          canonical_object_id,
          chunk_index,
          content,
          method,
          metadata,
          embedding,
          embedding_model,
          embedding_tokens,
          embedded_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
        ON CONFLICT (canonical_object_id, method, chunk_index)
        DO UPDATE SET
          embedding = EXCLUDED.embedding,
          embedding_model = EXCLUDED.embedding_model,
          embedding_tokens = EXCLUDED.embedding_tokens,
          embedded_at = EXCLUDED.embedded_at
        `,
        [
          chunk.id,
          chunk.canonical_object_id,
          chunk.chunk_index,
          chunk.content,
          chunk.method,
          chunk.metadata ? JSON.stringify(chunk.metadata) : null,
          `[${embedding.join(',')}]`, // pgvector format
          result.model,
          Math.ceil(result.totalTokens / allChunks.length), // Approximate tokens per chunk
        ]
      );
      savedCount++;
    } catch (error) {
      console.error(`   Failed to save chunk ${chunk.id}:`, error);
    }
  }

  console.log(`   Saved ${savedCount} chunks to database`);

  const duration = Date.now() - startTime;
  console.log('\n' + '='.repeat(60));
  console.log(`Completed in ${(duration / 1000).toFixed(2)}s`);

  return {
    strategy,
    total_objects: objects.length,
    total_chunks: allChunks.length,
    total_tokens: result.totalTokens,
    total_cost_usd: estimatedCost,
    avg_chunks_per_object: allChunks.length / objects.length,
    avg_chunk_size: chunkStats.avg_chunk_size,
    duration_ms: duration,
  };
}

/**
 * Main function
 */
async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.error('Error: No strategy specified');
    console.log('\nUsage:');
    console.log('  pnpm tsx scripts/embed-chunks.ts <strategy> [scenario]');
    console.log('\nStrategies:');
    console.log('  - fixed-size: Fixed-size chunks with overlap');
    console.log('  - semantic: Paragraph-based semantic chunks');
    console.log('  - relational: Structure-preserving chunks');
    console.log('\nExamples:');
    console.log('  pnpm tsx scripts/embed-chunks.ts semantic');
    console.log('  pnpm tsx scripts/embed-chunks.ts fixed-size normal');
    process.exit(1);
  }

  const strategy = args[0] as 'fixed-size' | 'semantic' | 'relational';
  const scenario = args[1]; // Optional

  if (!['fixed-size', 'semantic', 'relational'].includes(strategy)) {
    console.error(`Error: Invalid strategy "${strategy}"`);
    console.error('Valid strategies: fixed-size, semantic, relational');
    process.exit(1);
  }

  // Validate OpenAI API key
  if (!process.env.OPENAI_API_KEY) {
    console.error('Error: OPENAI_API_KEY environment variable not set');
    console.error('Please set it in .env file');
    process.exit(1);
  }

  // Initialize database
  console.log('Connecting to database...');
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
    console.log('Database connected');

    // Initialize chunker
    const chunkingConfig: ChunkingConfig = {
      strategy,
      maxChunkSize: 500,
      overlap: 50,
      preserveMetadata: true,
    };
    const chunker = new Chunker(chunkingConfig);

    // Initialize embedder
    const embeddingConfig: EmbeddingConfig = {
      apiKey: process.env.OPENAI_API_KEY!,
      model: process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small',
      batchSize: 100,
    };
    const embedder = new OpenAIEmbedder(embeddingConfig);

    // Embed chunks
    const stats = await embedChunks(db, chunker, embedder, strategy, scenario);

    // Print summary
    console.log('\n\n' + '='.repeat(60));
    console.log('EMBEDDING SUMMARY');
    console.log('='.repeat(60));
    console.log(`Strategy: ${stats.strategy}`);
    console.log(`Total objects: ${stats.total_objects}`);
    console.log(`Total chunks: ${stats.total_chunks}`);
    console.log(`Avg chunks per object: ${stats.avg_chunks_per_object.toFixed(2)}`);
    console.log(`Avg chunk size: ${stats.avg_chunk_size} chars`);
    console.log(`Total tokens: ${stats.total_tokens.toLocaleString()}`);
    console.log(`Estimated cost: $${stats.total_cost_usd.toFixed(4)}`);
    console.log(`Duration: ${(stats.duration_ms / 1000).toFixed(2)}s`);
    console.log('='.repeat(60));
  } catch (error) {
    console.error('\nEmbedding failed:', error);
    process.exit(1);
  } finally {
    await db.close();
  }
}

// Run main function
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
