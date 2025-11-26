#!/usr/bin/env tsx
/**
 * Chunking Benchmark
 *
 * Benchmarks different chunking strategies to compare performance.
 *
 * Usage:
 *   pnpm tsx scripts/benchmark/benchmark-chunking.ts                    # Run all strategies
 *   pnpm tsx scripts/benchmark/benchmark-chunking.ts --strategy semantic
 *   pnpm tsx scripts/benchmark/benchmark-chunking.ts --compare          # Compare with baseline
 *   pnpm tsx scripts/benchmark/benchmark-chunking.ts --save             # Save results
 */

import * as dotenv from 'dotenv';

import { Chunker, type ChunkingStrategy } from '@momo/chunking';
import { UnifiedMemoryDB } from '@unified-memory/db';

import type { ChunkingBenchmarkConfig, ChunkingBenchmarkResult } from './types';
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
  strategy?: ChunkingStrategy;
  maxChunkSize: number;
  overlap: number;
  save: boolean;
  compare: boolean;
}

function parseArgs(): BenchmarkOptions {
  const args = process.argv.slice(2);
  return {
    strategy: args.includes('--strategy')
      ? (args[args.indexOf('--strategy') + 1] as ChunkingStrategy)
      : undefined,
    maxChunkSize: args.includes('--size') ? parseInt(args[args.indexOf('--size') + 1], 10) : 500,
    overlap: args.includes('--overlap') ? parseInt(args[args.indexOf('--overlap') + 1], 10) : 50,
    save: args.includes('--save'),
    compare: args.includes('--compare'),
  };
}

// ============================================================
// Benchmark Runner
// ============================================================

async function runChunkingBenchmark(
  db: UnifiedMemoryDB,
  config: ChunkingBenchmarkConfig
): Promise<ChunkingBenchmarkResult> {
  const timer = new Timer();

  // Initialize chunker
  const chunker = new Chunker({
    strategy: config.strategy,
    maxChunkSize: config.maxChunkSize,
    overlap: config.overlap,
    preserveMetadata: true,
  });

  // Fetch all canonical objects
  const objects = await db.searchCanonicalObjects({}, 1000);

  if (objects.length === 0) {
    throw new Error('No canonical objects found. Run ingest first.');
  }

  // Run chunking
  timer.start();
  const allChunks = objects.flatMap((obj) => chunker.chunk(obj));
  const duration = timer.stop();

  // Calculate stats
  const stats = chunker.getStats(allChunks);
  const throughput = (objects.length / duration) * 1000;

  return {
    config,
    stage: 'chunking',
    timestamp: new Date().toISOString(),
    metrics: {
      duration_ms: duration,
      throughput,
      memory_mb: getMemoryUsage(),
    },
    details: {
      strategy: config.strategy,
      total_objects: objects.length,
      total_chunks: allChunks.length,
      avg_chunk_size: stats.avg_chunk_size,
      min_chunk_size: stats.min_chunk_size,
      max_chunk_size: stats.max_chunk_size,
      chunks_per_object: Math.round((allChunks.length / objects.length) * 100) / 100,
    },
  };
}

// ============================================================
// Main
// ============================================================

async function main() {
  const options = parseArgs();

  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║              Chunking Strategy Benchmark                    ║');
  console.log('╚════════════════════════════════════════════════════════════╝');

  // Initialize database
  const db = new UnifiedMemoryDB({
    host: process.env.POSTGRES_HOST || 'localhost',
    port: parseInt(process.env.POSTGRES_PORT || '5434', 10),
    database: process.env.POSTGRES_DB || 'unified_memory',
    user: process.env.POSTGRES_USER || 'unified_memory',
    password: process.env.POSTGRES_PASSWORD || 'unified_memory_dev',
    maxConnections: 5,
    vectorDimensions: 1536,
  });

  try {
    await db.initialize();
    console.log('✅ Database connected\n');

    const strategies: ChunkingStrategy[] = options.strategy
      ? [options.strategy]
      : ['fixed-size', 'semantic', 'relational'];

    const results: ChunkingBenchmarkResult[] = [];

    for (const strategy of strategies) {
      console.log(`\n🔄 Running benchmark: ${strategy}...`);

      const config: ChunkingBenchmarkConfig = {
        name: `chunking-${strategy}`,
        description: `Chunking benchmark with ${strategy} strategy`,
        strategy,
        maxChunkSize: options.maxChunkSize,
        overlap: options.overlap,
      };

      const result = await runChunkingBenchmark(db, config);
      results.push(result);

      printResult(result);

      if (options.save) {
        const filepath = saveResult(result);
        console.log(`\n💾 Saved to: ${filepath}`);
      }
    }

    // Compare with baseline if requested
    if (options.compare && results.length > 0) {
      const baseline = getLatestResult('chunking');
      if (baseline) {
        console.log('\n📊 Comparing with previous baseline...');
        const comparison = compareBenchmarks(baseline, results[0]);
        printComparison(comparison);
      } else {
        console.log('\n⚠️  No previous baseline found for comparison');
      }
    }

    // Summary table for multiple strategies
    if (results.length > 1) {
      console.log('\n' + '═'.repeat(60));
      console.log('📊 Strategy Comparison Summary');
      console.log('═'.repeat(60));
      console.log('| Strategy     | Duration | Chunks | Avg Size | Chunks/Obj |');
      console.log('|--------------|----------|--------|----------|------------|');
      for (const r of results) {
        const d = r.details;
        console.log(
          `| ${d.strategy.padEnd(12)} | ${String(r.metrics.duration_ms + 'ms').padEnd(8)} | ${String(d.total_chunks).padEnd(6)} | ${String(d.avg_chunk_size).padEnd(8)} | ${String(d.chunks_per_object).padEnd(10)} |`
        );
      }

      // Find best by throughput
      const best = results.reduce((a, b) =>
        (a.metrics.throughput || 0) > (b.metrics.throughput || 0) ? a : b
      );
      console.log(`\n🏆 Best throughput: ${best.details.strategy}`);
    }
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    await db.close();
  }
}

main().catch(console.error);
