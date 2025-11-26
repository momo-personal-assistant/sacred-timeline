#!/usr/bin/env tsx
/**
 * Save Experiment Draft Script
 *
 * Purpose: Save a YAML experiment config as a draft in the database
 *          for review before execution
 *
 * Usage:
 *   pnpm tsx scripts/save-experiment-draft.ts config/experiments/my-exp.yaml
 *   pnpm run draft config/experiments/my-exp.yaml
 *
 * The experiment will be saved with status='draft' and can be:
 *   - Viewed in the UI
 *   - Executed via the "Run" button or API
 */

import * as fs from 'fs';
import * as path from 'path';

import * as dotenv from 'dotenv';
import * as yaml from 'js-yaml';

import { UnifiedMemoryDB } from '@unified-memory/db';

import type { ExperimentConfig } from './types/experiment-config';

// Load environment variables
dotenv.config();

async function main() {
  // Get config path from args
  const configPath = process.argv[2];

  if (!configPath) {
    console.error('Usage: pnpm tsx scripts/save-experiment-draft.ts <config-path>');
    console.error(
      'Example: pnpm tsx scripts/save-experiment-draft.ts config/experiments/2024-11-25-contrastive-icl.yaml'
    );
    process.exit(1);
  }

  const fullPath = path.resolve(process.cwd(), configPath);

  if (!fs.existsSync(fullPath)) {
    console.error(`Config file not found: ${fullPath}`);
    process.exit(1);
  }

  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║             Save Experiment Draft                          ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log();

  // Load configuration
  console.log(`📋 Loading configuration: ${configPath}`);
  const fileContents = fs.readFileSync(fullPath, 'utf8');
  const config = yaml.load(fileContents) as ExperimentConfig;

  console.log(`   Name: ${config.name}`);
  console.log(`   Description: ${config.description?.split('\n')[0]}...`);
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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pool = (db as any).pool;

    // Check if experiment already exists
    const existing = await pool.query('SELECT id, status FROM experiments WHERE name = $1', [
      config.name,
    ]);

    if (existing.rows.length > 0) {
      const exp = existing.rows[0];
      if (exp.status === 'draft') {
        console.log(`\n⚠️  Draft experiment "${config.name}" already exists (id: ${exp.id})`);
        console.log('   Updating existing draft...');

        // Update existing draft
        await pool.query(
          `UPDATE experiments SET
            description = $1,
            config = $2,
            is_baseline = $3,
            paper_ids = $4,
            config_file_path = $5
          WHERE id = $6`,
          [
            config.description,
            JSON.stringify(config),
            config.metadata.baseline,
            config.metadata.paper_ids || [],
            configPath,
            exp.id,
          ]
        );

        console.log(`✅ Draft updated: ${config.name} (id: ${exp.id})`);
      } else {
        console.log(`\n❌ Experiment "${config.name}" already exists with status: ${exp.status}`);
        console.log(
          '   Cannot save as draft. Use a different name or delete the existing experiment.'
        );
        process.exit(1);
      }
    } else {
      // Insert new draft experiment
      const result = await pool.query(
        `INSERT INTO experiments (
          name,
          description,
          config,
          is_baseline,
          paper_ids,
          status,
          config_file_path,
          created_at
        ) VALUES ($1, $2, $3, $4, $5, 'draft', $6, NOW())
        RETURNING id`,
        [
          config.name,
          config.description,
          JSON.stringify(config),
          config.metadata.baseline,
          config.metadata.paper_ids || [],
          configPath,
        ]
      );

      const experimentId = result.rows[0].id;
      console.log(`\n✅ Draft saved: ${config.name} (id: ${experimentId})`);
    }

    console.log();
    console.log('📝 Next steps:');
    console.log('   1. Open the demo app and go to the Experiments tab');
    console.log('   2. Find your draft experiment (marked with "Draft" badge)');
    console.log('   3. Review the configuration');
    console.log('   4. Click "Run" to execute the experiment');
    console.log();
  } catch (error) {
    console.error('❌ Error saving draft:', error);
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
