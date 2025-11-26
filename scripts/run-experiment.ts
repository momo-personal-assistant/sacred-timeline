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

import { PipelineOrchestrator, type PipelineConfig } from '@momo/pipeline';
import { UnifiedMemoryDB } from '@unified-memory/db';

import type { ExperimentConfig } from './types/experiment-config';

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
 * Convert ExperimentConfig to PipelineConfig
 */
function toPipelineConfig(config: ExperimentConfig): PipelineConfig {
  return {
    name: config.name,
    description: config.description,
    chunking: config.chunking,
    embedding: config.embedding,
    relationInference: config.relationInference,
    validation: config.validation,
    metadata: config.metadata,
  };
}

/**
 * Main execution function
 */
async function main() {
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

    // Create orchestrator with callbacks
    const orchestrator = new PipelineOrchestrator({
      openaiApiKey: process.env.OPENAI_API_KEY,
      onStageStart: (stageName) => {
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log(`STAGE: ${stageName.toUpperCase()}`);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      },
      onStageComplete: (stageName, durationMs) => {
        console.log(`   ✅ ${stageName} completed (${durationMs}ms)`);
        console.log();
      },
      onStageError: (stageName, error) => {
        console.error(`   ❌ ${stageName} failed: ${error.message}`);
      },
    });

    // Convert config and execute pipeline
    const pipelineConfig = toPipelineConfig(config);

    console.log('\n🔄 Executing pipeline...\n');
    const result = await orchestrator.execute(pipelineConfig, db);

    // Print results
    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║                    Experiment Complete                     ║');
    console.log('╚════════════════════════════════════════════════════════════╝');
    console.log();

    if (result.success) {
      console.log('📊 Results:');
      if (result.metrics) {
        console.log(`   F1 Score: ${(result.metrics.f1_score * 100).toFixed(1)}%`);
        console.log(`   Precision: ${(result.metrics.precision * 100).toFixed(1)}%`);
        console.log(`   Recall: ${(result.metrics.recall * 100).toFixed(1)}%`);
      }
      console.log();
      console.log('📈 Stats:');
      console.log(`   Objects: ${result.stats.objects}`);
      console.log(`   Chunks: ${result.stats.chunks}`);
      console.log(`   Embeddings: ${result.stats.embeddings}`);
      console.log();
      console.log(`⏱️  Duration: ${(result.duration_ms / 1000).toFixed(1)}s`);
      console.log();

      if (result.experimentId) {
        console.log(`✅ Experiment saved (#${result.experimentId})`);
        console.log('   View results in the Experiments tab');
      } else {
        console.log('ℹ️  Experiment NOT saved (autoSaveExperiment: false)');
      }
    } else {
      console.error('❌ Pipeline failed:', result.error);
      process.exit(1);
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
