#!/usr/bin/env tsx
/**
 * Archive old/malformed experiments
 *
 * This script:
 * 1. Creates a summary document of old experiments
 * 2. Marks them as archived in the database
 * 3. Keeps the clean, well-documented experiments visible
 */

import * as fs from 'fs';
import * as path from 'path';

import * as dotenv from 'dotenv';

import { UnifiedMemoryDB } from '@unified-memory/db';

dotenv.config();

// Experiments to archive (low F1, redundant threshold tuning, failed experiments)
const EXPERIMENTS_TO_ARCHIVE = [
  20, // EXP-001: Semantic Hash (9.1%)
  21, // EXP-002: Contrastive ICL (4.8%)
  24, // EXP-003: Schema-Based (52.6%) - might keep this one?
  45, // slack-integration-baseline (0.9%)
  47, // threshold-0.5 (2.0%)
  48, // exp-004-hybrid (0%)
  49, // exp-004b-balanced (1.7%)
  53, // threshold-0.31 (41.1%) - redundant
  54, // threshold-0.32 (35.5%) - redundant
  55, // threshold-0.33 (32.9%) - redundant
];

// Experiments to keep visible
const KEEP_EXPERIMENTS = [
  29, // baseline (28.3%) - marked as baseline
  52, // threshold-0.30 (43.6%) - optimal threshold
  56, // stage-2-project-metadata (86.1%) - best result
  25, // 2025-11-24-hybrid-search (53.3%) - good result
];

async function main() {
  console.log('\n🗄️  Starting experiment archival process...\n');

  // Initialize DB
  const db = new UnifiedMemoryDB({
    host: process.env.POSTGRES_HOST || 'localhost',
    port: parseInt(process.env.POSTGRES_PORT || '5434', 10),
    database: process.env.POSTGRES_DB || 'unified_memory',
    user: process.env.POSTGRES_USER || 'unified_memory',
    password: process.env.POSTGRES_PASSWORD || 'unified_memory_dev',
    maxConnections: 5,
    vectorDimensions: 1536,
  });

  await db.initialize();
  const pool = (db as any).pool;

  // 1. Fetch all experiments to be archived
  console.log('📊 Fetching experiments to archive...\n');
  const result = await pool.query(
    `
    SELECT id, name, description, created_at,
           (SELECT f1_score FROM experiment_results WHERE experiment_id = experiments.id LIMIT 1) as f1_score,
           (SELECT precision FROM experiment_results WHERE experiment_id = experiments.id LIMIT 1) as precision,
           (SELECT recall FROM experiment_results WHERE experiment_id = experiments.id LIMIT 1) as recall
    FROM experiments
    WHERE id = ANY($1)
    ORDER BY created_at ASC
    `,
    [EXPERIMENTS_TO_ARCHIVE]
  );

  const experimentsToArchive = result.rows;

  // 2. Create summary document
  console.log('📝 Creating summary document...\n');
  const summaryContent = generateSummaryDocument(experimentsToArchive);

  const archivePath = path.join(process.cwd(), 'docs', 'experiments', 'archived');
  if (!fs.existsSync(archivePath)) {
    fs.mkdirSync(archivePath, { recursive: true });
  }

  const summaryFilePath = path.join(archivePath, 'OLD-EXPERIMENTS-SUMMARY.md');
  fs.writeFileSync(summaryFilePath, summaryContent);
  console.log(`✅ Created: ${summaryFilePath}\n`);

  // 3. Check if 'archived' column exists, if not add it
  console.log('🔧 Checking database schema...\n');
  const schemaCheck = await pool.query(`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_name = 'experiments' AND column_name = 'archived'
  `);

  if (schemaCheck.rows.length === 0) {
    console.log('➕ Adding "archived" column to experiments table...\n');
    await pool.query('ALTER TABLE experiments ADD COLUMN archived BOOLEAN DEFAULT FALSE');
  }

  // 4. Mark experiments as archived
  console.log('🗃️  Marking experiments as archived...\n');
  await pool.query('UPDATE experiments SET archived = TRUE WHERE id = ANY($1)', [
    EXPERIMENTS_TO_ARCHIVE,
  ]);

  // 5. Show summary
  console.log('📊 Summary:\n');
  console.log(`   Archived: ${experimentsToArchive.length} experiments`);
  console.log(`   Kept visible: ${KEEP_EXPERIMENTS.length} experiments`);
  console.log(`   Summary document: docs/experiments/archived/OLD-EXPERIMENTS-SUMMARY.md\n`);

  // 6. List archived experiments
  console.log('📋 Archived Experiments:\n');
  for (const exp of experimentsToArchive) {
    const f1 = exp.f1_score ? (exp.f1_score * 100).toFixed(1) : 'N/A';
    console.log(`   #${exp.id}: ${exp.name} (F1: ${f1}%)`);
  }
  console.log('');

  await db.close();
  console.log('✨ Done!\n');
}

function generateSummaryDocument(experiments: any[]): string {
  const content: string[] = [];

  content.push('# Old Experiments Summary');
  content.push('');
  content.push('```yaml');
  content.push('# Document Metadata');
  content.push('experiment_id: OLD-EXPERIMENTS-ARCHIVE');
  content.push('title: "Summary of Archived Early Experiments"');
  content.push(`date: ${new Date().toISOString().split('T')[0]}`);
  content.push('status: archived');
  content.push('type: research');
  content.push('decision: archived');
  content.push('```');
  content.push('');
  content.push('---');
  content.push('');
  content.push('## 📋 Overview');
  content.push('');
  content.push(
    'This document consolidates early experiments that were exploratory, failed, or superseded by better approaches.'
  );
  content.push(
    'These experiments have been archived to reduce clutter in the main experiment list.'
  );
  content.push('');
  content.push('**Why archived**:');
  content.push('- Low performance (F1 < 10%)');
  content.push('- Redundant threshold tuning experiments (superseded by optimal threshold)');
  content.push('- Exploratory experiments with valuable learnings but poor results');
  content.push('');
  content.push('---');
  content.push('');
  content.push('## 🗂️ Archived Experiments');
  content.push('');
  content.push('| ID | Name | F1 Score | Precision | Recall | Date | Reason |');
  content.push('|----|------|----------|-----------|--------|------|--------|');

  for (const exp of experiments) {
    const f1 = exp.f1_score ? (exp.f1_score * 100).toFixed(1) + '%' : 'N/A';
    const precision = exp.precision ? (exp.precision * 100).toFixed(1) + '%' : 'N/A';
    const recall = exp.recall ? (exp.recall * 100).toFixed(1) + '%' : 'N/A';
    const date = new Date(exp.created_at).toISOString().split('T')[0];

    let reason = 'Low performance';
    if (exp.name.startsWith('threshold-')) {
      reason = 'Redundant tuning';
    } else if (exp.f1_score === 0 || exp.f1_score === null) {
      reason = 'Failed experiment';
    } else if (exp.name.includes('EXP-00')) {
      reason = 'Exploratory phase';
    }

    content.push(
      `| ${exp.id} | ${exp.name} | ${f1} | ${precision} | ${recall} | ${date} | ${reason} |`
    );
  }

  content.push('');
  content.push('---');
  content.push('');
  content.push('## 💡 Key Learnings');
  content.push('');
  content.push('### Failed Approaches');
  content.push('');
  content.push('1. **Pure Semantic Similarity** (EXP-001, EXP-002)');
  content.push('   - Semantic hash and contrastive learning approaches failed');
  content.push('   - F1 scores < 10%');
  content.push('   - **Lesson**: Semantic similarity alone is insufficient');
  content.push('');
  content.push('2. **Hybrid Without Project Context** (exp-004-hybrid, exp-004b-balanced)');
  content.push('   - Attempted balanced approach but still failed');
  content.push('   - F1 scores < 2%');
  content.push('   - **Lesson**: Need project-level metadata for context');
  content.push('');
  content.push('3. **Wrong Thresholds** (threshold-0.5, threshold-0.31+)');
  content.push('   - Too high thresholds missed too many relations');
  content.push('   - Optimal found at 0.30');
  content.push('   - **Lesson**: Threshold tuning is critical but 0.30 is sweet spot');
  content.push('');
  content.push('### What Worked');
  content.push('');
  content.push('- **Project-based data generation** (EXP-005) → 28.3% F1');
  content.push('- **Optimal threshold (0.30)** (EXP-006-Stage-1) → 43.6% F1');
  content.push('- **Project metadata signal** (EXP-006-Stage-2) → 86.1% F1 ✅');
  content.push('');
  content.push('---');
  content.push('');
  content.push('## 🔗 Related Documents');
  content.push('');
  content.push(
    '- [EXP-005: Project-Based Data](../completed/EXP-005-project-based-data.md) - First successful approach'
  );
  content.push(
    '- [EXP-006: Multi-Signal Fusion Plan](../plans/EXP-006-multi-signal-fusion-plan.md) - Current best approach'
  );
  content.push(
    '- [EXP-004: Relation Inference Optimization](../rejected/EXP-004-relation-inference-optimization.md) - Detailed failure analysis'
  );
  content.push('');
  content.push('---');
  content.push('');
  content.push(`**Archived**: ${new Date().toISOString().split('T')[0]}`);
  content.push(
    '**Status**: These experiments are hidden from the UI but data is preserved in the database'
  );
  content.push('');

  return content.join('\n');
}

main().catch(console.error);
