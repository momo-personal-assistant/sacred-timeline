#!/usr/bin/env tsx
/**
 * Embedding Benchmark
 *
 * Benchmarks embedding generation with different models and configurations.
 * Note: This benchmark actually calls the OpenAI API and incurs costs.
 *
 * Usage:
 *   pnpm tsx scripts/benchmark/benchmark-embedding.ts                    # Dry run (estimate only)
 *   pnpm tsx scripts/benchmark/benchmark-embedding.ts --execute          # Actually run embeddings
 *   pnpm tsx scripts/benchmark/benchmark-embedding.ts --model text-embedding-3-large
 *   pnpm tsx scripts/benchmark/benchmark-embedding.ts --save             # Save results
 */

import * as dotenv from 'dotenv';

import { Chunker } from '@momo/chunking';
import { OpenAIEmbedder } from '@momo/embedding';
import { UnifiedMemoryDB } from '@unified-memory/db';

import type { EmbeddingBenchmarkConfig, EmbeddingBenchmarkResult } from './types';
import {
  Timer,
  printResult,
  printComparison,
  compareBenchmarks,
  saveResult,
  getLatestResult,
  getMemoryUsage,
} from './utils';

dotenv.config();

// ============================================================
// Configuration
// ============================================================

interface BenchmarkOptions {
  model: string;
  dimensions: number;
  batchSize: number;
  execute: boolean;
  save: boolean;
  compare: boolean;
  limit?: number;
}

function parseArgs(): BenchmarkOptions {
  const args = process.argv.slice(2);

  const model = args.includes('--model')
    ? args[args.indexOf('--model') + 1]
    : 'text-embedding-3-small';

  // Auto-set dimensions based on model
  let dimensions = 1536;
  if (model === 'text-embedding-3-large') dimensions = 3072;
  if (model.includes('voyage')) dimensions = 1024;

  if (args.includes('--dimensions')) {
    dimensions = parseInt(args[args.indexOf('--dimensions') + 1], 10);
  }

  return {
    model,
    dimensions,
    batchSize: args.includes('--batch') ? parseInt(args[args.indexOf('--batch') + 1], 10) : 100,
    execute: args.includes('--execute'),
    save: args.includes('--save'),
    compare: args.includes('--compare'),
    limit: args.includes('--limit') ? parseInt(args[args.indexOf('--limit') + 1], 10) : undefined,
  };
}

// ============================================================
// Benchmark Runner
// ============================================================

async function runEmbeddingBenchmark(
  db: UnifiedMemoryDB,
  config: EmbeddingBenchmarkConfig,
  options: BenchmarkOptions
): Promise<EmbeddingBenchmarkResult> {
  const timer = new Timer();

  // Initialize chunker with default settings
  const chunker = new Chunker({
    strategy: 'semantic',
    maxChunkSize: 500,
    overlap: 50,
  });

  // Fetch canonical objects
  const objects = await db.searchCanonicalObjects({}, options.limit || 1000);

  if (objects.length === 0) {
    throw new Error('No canonical objects found. Run ingest first.');
  }

  // Generate chunks
  const chunks = objects.flatMap((obj) => chunker.chunk(obj));
  const texts = chunks.map((c) => c.content);

  console.log(`   Objects: ${objects.length}`);
  console.log(`   Chunks: ${chunks.length}`);

  // Initialize embedder
  const embedder = new OpenAIEmbedder({
    apiKey: process.env.OPENAI_API_KEY || '',
    model: config.model,
    dimensions: config.dimensions,
    batchSize: config.batchSize,
  });

  // Estimate cost first
  const totalChars = texts.reduce((sum, t) => sum + t.length, 0);
  const estimatedTokens = Math.ceil(totalChars / 4); // Rough estimate
  const costPer1kTokens = config.model.includes('large') ? 0.00013 : 0.00002;
  const estimatedCost = (estimatedTokens / 1000) * costPer1kTokens;

  console.log(`   Estimated tokens: ${estimatedTokens.toLocaleString()}`);
  console.log(`   Estimated cost: $${estimatedCost.toFixed(4)}`);

  let duration = 0;
  let actualTokens = estimatedTokens;
  let actualCost = estimatedCost;

  if (options.execute) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY environment variable required for --execute');
    }

    console.log(`\n   🔄 Generating embeddings...`);
    timer.start();
    const result = await embedder.embedBatch(texts);
    duration = timer.stop();

    actualTokens = result.totalTokens;
    actualCost = embedder.estimateCost(actualTokens);

    console.log(`   ✅ Generated ${result.results.length} embeddings`);
    console.log(`   Actual tokens: ${actualTokens.toLocaleString()}`);
    console.log(`   Actual cost: $${actualCost.toFixed(4)}`);
  } else {
    console.log(`\n   ⏭️  Dry run (use --execute to actually generate embeddings)`);
    duration = 0;
  }

  const throughput = duration > 0 ? (chunks.length / duration) * 1000 : 0;
  const tokensPerChunk = chunks.length > 0 ? Math.round(actualTokens / chunks.length) : 0;

  return {
    config,
    stage: 'embedding',
    timestamp: new Date().toISOString(),
    metrics: {
      duration_ms: duration,
      throughput,
      memory_mb: getMemoryUsage(),
      cost_usd: actualCost,
    },
    details: {
      model: config.model,
      total_chunks: chunks.length,
      total_tokens: actualTokens,
      tokens_per_chunk: tokensPerChunk,
      cost_per_1k_tokens: costPer1kTokens,
    },
  };
}

// ============================================================
// Main
// ============================================================

async function main() {
  const options = parseArgs();

  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║              Embedding Model Benchmark                      ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log(`\nModel: ${options.model}`);
  console.log(`Dimensions: ${options.dimensions}`);
  console.log(`Batch size: ${options.batchSize}`);
  console.log(`Execute: ${options.execute ? 'Yes (will incur API costs)' : 'No (dry run)'}`);

  // Initialize database
  const db = new UnifiedMemoryDB({
    host: process.env.POSTGRES_HOST || 'localhost',
    port: parseInt(process.env.POSTGRES_PORT || '5434', 10),
    database: process.env.POSTGRES_DB || 'unified_memory',
    user: process.env.POSTGRES_USER || 'unified_memory',
    password: process.env.POSTGRES_PASSWORD || 'unified_memory_dev',
    maxConnections: 5,
    vectorDimensions: options.dimensions,
  });

  try {
    await db.initialize();
    console.log('\n✅ Database connected');

    const config: EmbeddingBenchmarkConfig = {
      name: `embedding-${options.model}`,
      description: `Embedding benchmark with ${options.model}`,
      model: options.model,
      dimensions: options.dimensions,
      batchSize: options.batchSize,
    };

    console.log('\n🔄 Running benchmark...');
    const result = await runEmbeddingBenchmark(db, config, options);

    printResult(result);

    if (options.save) {
      const filepath = saveResult(result);
      console.log(`\n💾 Saved to: ${filepath}`);
    }

    // Compare with baseline if requested
    if (options.compare) {
      const baseline = getLatestResult('embedding');
      if (baseline) {
        console.log('\n📊 Comparing with previous baseline...');
        const comparison = compareBenchmarks(baseline, result);
        printComparison(comparison);
      } else {
        console.log('\n⚠️  No previous baseline found for comparison');
      }
    }

    // Cost comparison hint
    if (!options.execute) {
      console.log(
        '\n💡 Tip: Run with --execute to actually generate embeddings and get real metrics.'
      );
      console.log('   Warning: This will incur OpenAI API costs.');
    }
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    await db.close();
  }
}

main().catch(console.error);
