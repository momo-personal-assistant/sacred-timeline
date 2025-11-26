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

import * as yaml from 'js-yaml';

import { PipelineOrchestrator, type PipelineConfig } from '@momo/pipeline';

import {
  createDb,
  printDivider,
  printDuration,
  printError,
  printHeader,
  printInfo,
  printKV,
  printMetrics,
  printSuccess,
} from './lib';
import type { ExperimentConfig } from './types/experiment-config';

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

  printHeader('Configuration-Driven Experiment System');

  // Load configuration
  console.log(`📋 Loading configuration: ${configPath}`);
  const config = loadConfig(configPath);
  printKV('Name', config.name);
  printKV('Description', config.description);
  if (config.metadata.git_commit) {
    printKV('Git commit', config.metadata.git_commit.substring(0, 8));
  }
  console.log();

  // Initialize database
  const db = await createDb();
  printSuccess('Database connected');

  try {
    // Create orchestrator with callbacks
    const orchestrator = new PipelineOrchestrator({
      openaiApiKey: process.env.OPENAI_API_KEY,
      onStageStart: (stageName) => {
        printDivider(`STAGE: ${stageName}`);
      },
      onStageComplete: (stageName, durationMs) => {
        printSuccess(`${stageName} completed (${durationMs}ms)`);
        console.log();
      },
      onStageError: (stageName, error) => {
        printError(`${stageName} failed: ${error.message}`);
      },
    });

    // Convert config and execute pipeline
    const pipelineConfig = toPipelineConfig(config);

    console.log('\n🔄 Executing pipeline...\n');
    const result = await orchestrator.execute(pipelineConfig, db);

    // Print results
    printHeader('Experiment Complete');

    if (result.success) {
      if (result.metrics) {
        printMetrics(result.metrics);
      }
      console.log();
      console.log('📈 Stats:');
      printKV('Objects', result.stats.objects);
      printKV('Chunks', result.stats.chunks);
      printKV('Embeddings', result.stats.embeddings);
      console.log();
      printDuration('Duration', result.duration_ms);
      console.log();

      if (result.experimentId) {
        printSuccess(`Experiment saved (#${result.experimentId})`);
        printKV('View results', 'Experiments tab');
      } else {
        printInfo('Experiment NOT saved (autoSaveExperiment: false)');
      }
    } else {
      printError(`Pipeline failed: ${result.error}`);
      process.exit(1);
    }

    console.log();
  } catch (error) {
    printError(`Error running experiment: ${error}`);
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
