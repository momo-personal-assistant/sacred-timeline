#!/usr/bin/env tsx
/**
 * Run Experiment Script
 *
 * Purpose: Execute RAG experiments using YAML configuration files
 *
 * Usage:
 *   pnpm run experiment                         # Uses config/default.yaml
 *   pnpm run experiment config/experiments/my-exp.yaml
 *
 * Examples:
 *   pnpm run experiment                                    # Baseline
 *   pnpm run experiment config/templates/chunking.yaml     # Template
 *   pnpm run experiment config/experiments/exp-001.yaml    # Saved experiment
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

import * as dotenv from 'dotenv';
import * as yaml from 'js-yaml';

import { Chunker, type Chunk } from '@momo/embedding/chunker';
import { OpenAIEmbedder } from '@momo/embedding/openai-embedder';
import { RelationInferrer, type Relation } from '@momo/graph';
import { UnifiedMemoryDB } from '@unified-memory/db';

import type { ExperimentConfig, ExperimentResult } from './types/experiment-config';

// Load environment variables
dotenv.config();

const DEFAULT_CONFIG_PATH = 'config/default.yaml';

/**
 * Get git commit hash
 */
function getGitCommit(): string | null {
  try {
    return execSync('git rev-parse HEAD').toString().trim();
  } catch {
    return null;
  }
}

/**
 * Load and parse YAML config
 */
function loadConfig(configPath: string): ExperimentConfig {
  const fullPath = path.resolve(process.cwd(), configPath);

  if (!fs.existsSync(fullPath)) {
    throw new Error(`Config file not found: ${fullPath}`);
  }

  const fileContents = fs.readFileSync(fullPath, 'utf8');
  const config = yaml.load(fileContents) as ExperimentConfig;

  // Auto-populate git commit
  if (!config.metadata.git_commit) {
    config.metadata.git_commit = getGitCommit();
  }

  return config;
}

/**
 * Validate Relations (mimics validate-relations.ts logic)
 */
async function validateRelations(
  db: UnifiedMemoryDB,
  inferrer: RelationInferrer,
  _scenarios: string[]
): Promise<{
  f1_score: number;
  precision: number;
  recall: number;
  true_positives: number;
  false_positives: number;
  false_negatives: number;
}> {
  // For now, run a simplified validation
  // In production, this would call the full validate-relations logic

  console.log('\nRunning validation...');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pool = (db as any).pool;

  // Fetch all canonical objects
  const objects = await db.searchCanonicalObjects({}, 1000);

  // Infer relations
  const inferred = inferrer.inferAll(objects);

  // Fetch ground truth
  const groundTruthResult = await pool.query(
    'SELECT from_id, to_id, type FROM ground_truth_relations'
  );
  const groundTruth = groundTruthResult.rows as Relation[];

  // Calculate metrics (simplified - using only exact matches)
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

  console.log(`   Precision: ${(precision * 100).toFixed(1)}%`);
  console.log(`   Recall: ${(recall * 100).toFixed(1)}%`);
  console.log(`   F1 Score: ${(f1Score * 100).toFixed(1)}%`);

  return {
    f1_score: f1Score,
    precision,
    recall,
    true_positives: tp,
    false_positives: fp,
    false_negatives: fn,
  };
}

/**
 * Save experiment to database
 */
async function saveExperiment(
  db: UnifiedMemoryDB,
  config: ExperimentConfig,
  result: ExperimentResult
): Promise<number> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pool = (db as any).pool;

  // Insert experiment
  const expResult = await pool.query(
    `INSERT INTO experiments (
      name,
      description,
      config,
      baseline,
      paper_ids,
      git_commit,
      created_at
    ) VALUES ($1, $2, $3, $4, $5, $6, NOW())
    RETURNING id`,
    [
      config.name,
      config.description,
      JSON.stringify(config),
      config.metadata.baseline,
      config.metadata.paper_ids || [],
      config.metadata.git_commit,
    ]
  );

  const experimentId = expResult.rows[0].id;

  // Insert experiment results
  await pool.query(
    `INSERT INTO experiment_results (
      experiment_id,
      f1_score,
      precision,
      recall,
      true_positives,
      false_positives,
      false_negatives,
      retrieval_time_ms,
      created_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
    [
      experimentId,
      result.metrics.f1_score,
      result.metrics.precision,
      result.metrics.recall,
      result.metrics.true_positives,
      result.metrics.false_positives,
      result.metrics.false_negatives,
      result.duration_ms,
    ]
  );

  return experimentId;
}

/**
 * Main execution function
 */
async function main() {
  const startTime = Date.now();

  // Get config path from args
  const configPath = process.argv[2] || DEFAULT_CONFIG_PATH;

  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║          Configuration-Driven Experiment System            ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log();

  // Load configuration
  console.log(`📋 Loading configuration: ${configPath}`);
  const config = loadConfig(configPath);
  console.log(`   Name: ${config.name}`);
  console.log(`   Description: ${config.description}`);
  if (config.metadata.git_commit) {
    console.log(`   Git commit: ${config.metadata.git_commit.substring(0, 8)}`);
  }
  console.log();

  // Initialize database
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
    console.log('✅ Database connected');

    // Initialize embedder
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY environment variable is required');
    }
    const embedder = new OpenAIEmbedder({
      apiKey: process.env.OPENAI_API_KEY,
      model: config.embedding.model,
      dimensions: config.embedding.dimensions,
      batchSize: config.embedding.batchSize,
    });
    console.log(`✅ Embedder initialized (${config.embedding.model})`);

    // Initialize chunker
    const chunker = new Chunker({
      strategy: config.chunking.strategy,
      maxChunkSize: config.chunking.maxChunkSize,
      overlap: config.chunking.overlap,
      preserveMetadata: config.chunking.preserveMetadata,
    });
    console.log(`✅ Chunker initialized (${config.chunking.strategy})`);

    // Initialize relation inferrer
    const inferrer = new RelationInferrer({
      similarityThreshold: config.relationInference.similarityThreshold,
      keywordOverlapThreshold: config.relationInference.keywordOverlapThreshold,
      includeInferred: config.relationInference.includeInferred,
      useSemanticSimilarity: config.relationInference.useSemanticSimilarity,
      semanticWeight: config.relationInference.semanticWeight,
    });
    console.log('✅ Relation inferrer initialized');
    console.log();

    // ============================================
    // STEP 1: Chunk objects
    // ============================================
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('STEP 1: Chunking Objects');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    const objects = await db.searchCanonicalObjects({}, 1000);
    console.log(`   Fetched ${objects.length} canonical objects`);

    const allChunks: Chunk[] = [];
    for (const obj of objects) {
      const chunks = chunker.chunk(obj);
      allChunks.push(...chunks);
    }

    const chunkStats = chunker.getStats(allChunks);
    console.log(`   Generated ${allChunks.length} chunks`);
    console.log(`   Avg chunk size: ${chunkStats.avg_chunk_size} chars`);
    console.log(`   Min/Max: ${chunkStats.min_chunk_size} / ${chunkStats.max_chunk_size} chars`);
    console.log();

    // ============================================
    // STEP 2: Generate embeddings
    // ============================================
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('STEP 2: Generating Embeddings');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    const texts = allChunks.map((c) => c.content);
    const embedResult = await embedder.embedBatch(texts);

    const cost = embedder.estimateCost(embedResult.totalTokens);
    console.log(`   Generated ${embedResult.results.length} embeddings`);
    console.log(`   Total tokens: ${embedResult.totalTokens.toLocaleString()}`);
    console.log(`   Estimated cost: $${cost.toFixed(4)}`);
    console.log();

    // ============================================
    // STEP 3: Save to database
    // ============================================
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('STEP 3: Saving Embeddings');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pool = (db as any).pool;

    // Clear existing chunks for these objects
    await pool.query('DELETE FROM chunks WHERE canonical_object_id = ANY($1)', [
      objects.map((o) => o.id),
    ]);

    // Insert new chunks with embeddings
    for (let i = 0; i < allChunks.length; i++) {
      const chunk = allChunks[i];
      const embedding = embedResult.results[i].embedding;

      await pool.query(
        `INSERT INTO chunks (
          id, canonical_object_id, chunk_index, content, method, metadata, embedding
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          chunk.id,
          chunk.canonical_object_id,
          chunk.chunk_index,
          chunk.content,
          chunk.method,
          chunk.metadata ? JSON.stringify(chunk.metadata) : null,
          `[${embedding.join(',')}]`,
        ]
      );
    }

    console.log(`   ✅ Saved ${allChunks.length} chunks to database`);
    console.log();

    // ============================================
    // STEP 4: Run validation (if enabled)
    // ============================================
    let metrics = {
      f1_score: 0,
      precision: 0,
      recall: 0,
      true_positives: 0,
      false_positives: 0,
      false_negatives: 0,
    };

    if (config.validation.runOnSave) {
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('STEP 4: Running Validation');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

      metrics = await validateRelations(db, inferrer, config.validation.scenarios);
      console.log();
    }

    // ============================================
    // STEP 5: Save experiment (if enabled)
    // ============================================
    if (config.validation.autoSaveExperiment) {
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('STEP 5: Saving Experiment');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

      const result: ExperimentResult = {
        config,
        metrics,
        chunking_stats: chunkStats,
        embedding_stats: {
          total_tokens: embedResult.totalTokens,
          total_cost_usd: cost,
        },
        duration_ms: Date.now() - startTime,
        timestamp: new Date().toISOString(),
      };

      const experimentId = await saveExperiment(db, config, result);
      console.log(`   ✅ Saved experiment #${experimentId}`);
      console.log();
    }

    // ============================================
    // Summary
    // ============================================
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);

    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║                    Experiment Complete                     ║');
    console.log('╚════════════════════════════════════════════════════════════╝');
    console.log();
    console.log(`📊 Results:`);
    console.log(`   F1 Score: ${(metrics.f1_score * 100).toFixed(1)}%`);
    console.log(`   Precision: ${(metrics.precision * 100).toFixed(1)}%`);
    console.log(`   Recall: ${(metrics.recall * 100).toFixed(1)}%`);
    console.log();
    console.log(`⏱️  Duration: ${duration}s`);
    console.log();

    if (config.validation.autoSaveExperiment) {
      console.log('✅ Experiment saved to database');
      console.log('   View results in the Experiments tab');
    } else {
      console.log('ℹ️  Experiment NOT saved (autoSaveExperiment: false)');
      console.log('   To save manually, update config.validation.autoSaveExperiment = true');
    }
    console.log();
  } catch (error) {
    console.error('❌ Error running experiment:', error);
    process.exit(1);
  } finally {
    await db.close();
  }
}

// Run main
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
