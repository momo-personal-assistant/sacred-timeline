#!/usr/bin/env tsx
/**
 * Relation Inference Benchmark
 *
 * Benchmarks different relation inference methods against ground truth.
 *
 * Usage:
 *   pnpm tsx scripts/benchmark/benchmark-relation-inference.ts                    # Run all methods
 *   pnpm tsx scripts/benchmark/benchmark-relation-inference.ts --method semantic
 *   pnpm tsx scripts/benchmark/benchmark-relation-inference.ts --compare          # Compare with baseline
 *   pnpm tsx scripts/benchmark/benchmark-relation-inference.ts --save             # Save results
 */

import * as dotenv from 'dotenv';

import { RelationInferrer, type Relation } from '@momo/graph';
import { UnifiedMemoryDB } from '@unified-memory/db';

import type { RelationInferenceBenchmarkConfig, RelationInferenceBenchmarkResult } from './types';
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

type InferenceMethod = 'explicit' | 'semantic' | 'keyword' | 'hybrid';

interface BenchmarkOptions {
  method?: InferenceMethod;
  similarityThreshold: number;
  keywordOverlapThreshold: number;
  save: boolean;
  compare: boolean;
}

function parseArgs(): BenchmarkOptions {
  const args = process.argv.slice(2);
  return {
    method: args.includes('--method')
      ? (args[args.indexOf('--method') + 1] as InferenceMethod)
      : undefined,
    similarityThreshold: args.includes('--sim-threshold')
      ? parseFloat(args[args.indexOf('--sim-threshold') + 1])
      : 0.85,
    keywordOverlapThreshold: args.includes('--keyword-threshold')
      ? parseFloat(args[args.indexOf('--keyword-threshold') + 1])
      : 0.65,
    save: args.includes('--save'),
    compare: args.includes('--compare'),
  };
}

// ============================================================
// Benchmark Runner
// ============================================================

async function runRelationInferenceBenchmark(
  db: UnifiedMemoryDB,
  config: RelationInferenceBenchmarkConfig,
  method: InferenceMethod
): Promise<RelationInferenceBenchmarkResult> {
  const timer = new Timer();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pool = (db as any).pool;

  // Fetch all canonical objects
  const objects = await db.searchCanonicalObjects({}, 1000);

  if (objects.length === 0) {
    throw new Error('No canonical objects found. Run ingest first.');
  }

  // Fetch embeddings for semantic methods
  const embeddingsMap = new Map<string, number[]>();
  if (method === 'semantic' || method === 'hybrid') {
    console.log('   Loading embeddings...');
    for (const obj of objects) {
      const chunks = await pool.query(
        'SELECT embedding FROM chunks WHERE canonical_object_id = $1 AND embedding IS NOT NULL',
        [obj.id]
      );

      if (chunks.rows.length > 0) {
        const embeddings = chunks.rows.map((row: { embedding: string | number[] }) => {
          const emb = row.embedding;
          if (typeof emb === 'string') return JSON.parse(emb);
          return emb;
        });

        // Average embeddings
        const dimensions = embeddings[0].length;
        const avgEmbedding = new Array(dimensions);
        for (let i = 0; i < dimensions; i++) {
          avgEmbedding[i] =
            embeddings.reduce((sum: number, emb: number[]) => sum + emb[i], 0) / embeddings.length;
        }
        embeddingsMap.set(obj.id, avgEmbedding);
      }
    }
    console.log(`   Loaded embeddings for ${embeddingsMap.size} objects`);
  }

  // Initialize inferrer
  const inferrer = new RelationInferrer({
    similarityThreshold: config.similarityThreshold || 0.85,
    keywordOverlapThreshold: config.keywordOverlapThreshold || 0.65,
    includeInferred: true,
    useSemanticSimilarity: method === 'semantic' || method === 'hybrid',
    semanticWeight: method === 'hybrid' ? 0.7 : 1.0,
  });

  // Run inference
  console.log(`   Running ${method} inference...`);
  timer.start();

  let inferred: Relation[];
  switch (method) {
    case 'explicit':
      inferred = inferrer.extractExplicit(objects);
      break;
    case 'semantic':
      inferred = inferrer.inferAllWithEmbeddings(objects, embeddingsMap);
      break;
    case 'keyword':
      inferred = inferrer.inferAllWithKeywords(objects);
      break;
    case 'hybrid':
      inferred = inferrer.inferAllWithEmbeddings(objects, embeddingsMap);
      break;
    default:
      throw new Error(`Unknown method: ${method}`);
  }

  const duration = timer.stop();

  // Fetch ground truth
  const groundTruthResult = await pool.query(
    'SELECT from_id, to_id, relation_type as type FROM ground_truth_relations'
  );
  const groundTruth = groundTruthResult.rows as Relation[];

  // Calculate metrics
  const normalizeRelation = (rel: Relation) => `${rel.from_id}|${rel.to_id}|${rel.type}`;
  const groundTruthSet = new Set(groundTruth.map(normalizeRelation));
  const inferredSet = new Set(inferred.map(normalizeRelation));

  const truePositives = inferred.filter((rel) => groundTruthSet.has(normalizeRelation(rel)));
  const falsePositives = inferred.filter((rel) => !groundTruthSet.has(normalizeRelation(rel)));
  const falseNegatives = groundTruth.filter((rel) => !inferredSet.has(normalizeRelation(rel)));

  const tp = truePositives.length;
  const fp = falsePositives.length;
  const fn = falseNegatives.length;

  const precision = tp + fp > 0 ? tp / (tp + fp) : 0;
  const recall = tp + fn > 0 ? tp / (tp + fn) : 0;
  const f1Score = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;

  const throughput = duration > 0 ? (objects.length / duration) * 1000 : 0;

  return {
    config,
    stage: 'relation_inference',
    timestamp: new Date().toISOString(),
    metrics: {
      duration_ms: duration,
      throughput,
      memory_mb: getMemoryUsage(),
    },
    details: {
      method,
      total_objects: objects.length,
      total_relations: inferred.length,
      f1_score: Math.round(f1Score * 1000) / 1000,
      precision: Math.round(precision * 1000) / 1000,
      recall: Math.round(recall * 1000) / 1000,
      true_positives: tp,
      false_positives: fp,
      false_negatives: fn,
    },
  };
}

// ============================================================
// Main
// ============================================================

async function main() {
  const options = parseArgs();

  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║           Relation Inference Benchmark                      ║');
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

    const methods: InferenceMethod[] = options.method
      ? [options.method]
      : ['explicit', 'keyword', 'semantic', 'hybrid'];

    const results: RelationInferenceBenchmarkResult[] = [];

    for (const method of methods) {
      console.log(`\n🔄 Running benchmark: ${method}...`);

      const config: RelationInferenceBenchmarkConfig = {
        name: `relation-inference-${method}`,
        description: `Relation inference benchmark with ${method} method`,
        method,
        similarityThreshold: options.similarityThreshold,
        keywordOverlapThreshold: options.keywordOverlapThreshold,
      };

      const result = await runRelationInferenceBenchmark(db, config, method);
      results.push(result);

      printResult(result);

      if (options.save) {
        const filepath = saveResult(result);
        console.log(`\n💾 Saved to: ${filepath}`);
      }
    }

    // Compare with baseline if requested
    if (options.compare && results.length > 0) {
      const baseline = getLatestResult('relation_inference');
      if (baseline) {
        console.log('\n📊 Comparing with previous baseline...');
        const comparison = compareBenchmarks(baseline, results[0]);
        printComparison(comparison);
      } else {
        console.log('\n⚠️  No previous baseline found for comparison');
      }
    }

    // Summary table for multiple methods
    if (results.length > 1) {
      console.log('\n' + '═'.repeat(70));
      console.log('📊 Method Comparison Summary');
      console.log('═'.repeat(70));
      console.log('| Method     | F1 Score | Precision | Recall | Relations | Duration |');
      console.log('|------------|----------|-----------|--------|-----------|----------|');
      for (const r of results) {
        const d = r.details;
        console.log(
          `| ${d.method.padEnd(10)} | ${(d.f1_score * 100).toFixed(1).padStart(6)}%  | ${(d.precision * 100).toFixed(1).padStart(7)}%  | ${(d.recall * 100).toFixed(1).padStart(4)}%  | ${String(d.total_relations).padStart(9)} | ${String(r.metrics.duration_ms + 'ms').padStart(8)} |`
        );
      }

      // Find best by F1 score
      const best = results.reduce((a, b) => (a.details.f1_score > b.details.f1_score ? a : b));
      console.log(
        `\n🏆 Best F1 Score: ${best.details.method} (${(best.details.f1_score * 100).toFixed(1)}%)`
      );
    }
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    await db.close();
  }
}

main().catch(console.error);
