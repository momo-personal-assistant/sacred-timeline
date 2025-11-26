#!/usr/bin/env tsx
/**
 * Unified Experiment Creation Script
 *
 * Purpose: Create experiments from YAML config with automatic DB registration and document generation
 *
 * This script solves the "orphan document" problem by ensuring:
 * 1. Every experiment has a DB entry (for UI visibility)
 * 2. Every experiment has a markdown document (for documentation)
 * 3. YAML config is the single source of truth
 *
 * Usage:
 *   pnpm run experiment:create config/experiments/my-exp.yaml
 *   pnpm run experiment:create config/experiments/my-exp.yaml --run  # Create and run immediately
 *
 * Workflow:
 *   1. YAML config 작성 (수동)
 *   2. pnpm run experiment:create → DB 등록 + 문서 템플릿 생성
 *   3. pnpm run experiment:run → 실험 실행 + 결과 저장
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

import * as dotenv from 'dotenv';
import * as yaml from 'js-yaml';

import { UnifiedMemoryDB } from '@unified-memory/db';

import type { ExperimentConfig } from './types/experiment-config';

dotenv.config();

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

  if (!config.metadata.git_commit) {
    config.metadata.git_commit = getGitCommit();
  }

  return config;
}

/**
 * Extract experiment ID from config name (e.g., "EXP-003: Schema..." → "EXP-003")
 */
function extractExperimentId(name: string): string {
  const match = name.match(/^(EXP-\d+)/i);
  return match ? match[1].toUpperCase() : name.split(':')[0].trim();
}

/**
 * Generate markdown document template
 */
function generateDocumentTemplate(config: ExperimentConfig, configPath: string): string {
  const experimentId = extractExperimentId(config.name);
  const date = config.created_at || new Date().toISOString().split('T')[0];

  return `# ${config.name}

\`\`\`yaml
# Experiment Metadata
experiment_id: ${experimentId}
title: "${config.name.split(':').slice(1).join(':').trim() || config.name}"
date: ${date}
author: "Research Team"
status: draft

# Related Resources
related_papers: ${JSON.stringify(config.metadata.paper_ids || [])}
related_experiments: ${JSON.stringify(config.validation?.compareWith ? [config.validation.compareWith] : [])}
config_file: "${configPath}"

# Tags
tags: ${JSON.stringify(config.metadata.tags || [])}
\`\`\`

---

## 1. Background (배경)

### 1.1 Problem Statement

${config.description || '_TODO: 문제 정의 작성_'}

### 1.2 Related Work

${config.metadata.paper_ids?.length ? `- 관련 논문: ${config.metadata.paper_ids.join(', ')}` : '_TODO: 관련 연구 추가_'}

---

## 2. Hypothesis (가설)

### 2.1 Main Hypothesis

> _TODO: 가설 작성_

### 2.2 Expected Outcomes

| Metric | Baseline | Expected |
|--------|----------|----------|
| F1 Score | ${config.validation?.expectedMetrics?.f1_score_min ? `${(config.validation.expectedMetrics.f1_score_min * 100).toFixed(0)}%+` : 'TBD'} | _TODO_ |
| Precision | ${config.validation?.expectedMetrics?.precision_min ? `${(config.validation.expectedMetrics.precision_min * 100).toFixed(0)}%+` : 'TBD'} | _TODO_ |
| Recall | ${config.validation?.expectedMetrics?.recall_min ? `${(config.validation.expectedMetrics.recall_min * 100).toFixed(0)}%+` : 'TBD'} | _TODO_ |

---

## 3. Method (실험 방법)

### 3.1 Configuration

\`\`\`yaml
# Embedding
model: ${config.embedding?.model || 'text-embedding-3-small'}
dimensions: ${config.embedding?.dimensions || 1536}

# Chunking
strategy: ${config.chunking?.strategy || 'semantic'}
maxChunkSize: ${config.chunking?.maxChunkSize || 500}

# Relation Inference
similarityThreshold: ${config.relationInference?.similarityThreshold || 0.85}
keywordOverlapThreshold: ${config.relationInference?.keywordOverlapThreshold || 0.65}
useSemanticSimilarity: ${config.relationInference?.useSemanticSimilarity || false}
\`\`\`

### 3.2 Implementation

_TODO: 구현 설명 추가_

---

## 4. Results (결과)

> **Status**: Draft - 실험 미실행

_실험 실행 후 결과가 여기에 기록됩니다._

\`\`\`bash
# 실험 실행 명령어
pnpm run experiment ${configPath}
\`\`\`

---

## 5. Analysis (분석)

_TODO: 실험 실행 후 분석 추가_

---

## 6. Decision (결정)

### 6.1 Recommendation

_TODO: 결정 추가 (ADOPTED / REJECTED / PARTIALLY_ADOPTED)_

### 6.2 Next Steps

- [ ] _TODO: 다음 단계 추가_

---

## Changelog

| Date | Author | Change |
|------|--------|--------|
| ${date} | Research Team | Initial experiment design (auto-generated) |
`;
}

/**
 * Create experiment in database
 */
async function createExperimentInDB(
  db: UnifiedMemoryDB,
  config: ExperimentConfig,
  configPath: string
): Promise<number> {
  const pool = (db as any).pool;

  // Check if experiment already exists
  const existing = await pool.query('SELECT id, status FROM experiments WHERE name = $1', [
    config.name,
  ]);

  if (existing.rows.length > 0) {
    const exp = existing.rows[0];
    console.log(`   ℹ️  Experiment already exists (id: ${exp.id}, status: ${exp.status})`);
    return exp.id;
  }

  // Insert new experiment as draft
  const result = await pool.query(
    `INSERT INTO experiments (
      name,
      description,
      config,
      is_baseline,
      paper_ids,
      git_commit,
      status,
      config_file_path,
      created_at
    ) VALUES ($1, $2, $3, $4, $5, $6, 'draft', $7, NOW())
    RETURNING id`,
    [
      config.name,
      config.description,
      JSON.stringify(config),
      config.metadata.baseline || false,
      config.metadata.paper_ids || [],
      config.metadata.git_commit,
      configPath,
    ]
  );

  return result.rows[0].id;
}

/**
 * Create or update markdown document
 */
function createDocument(config: ExperimentConfig, configPath: string): string {
  const docsDir = path.join(process.cwd(), 'docs', 'research', 'experiments');

  // Ensure directory exists
  if (!fs.existsSync(docsDir)) {
    fs.mkdirSync(docsDir, { recursive: true });
  }

  // Generate filename from config date and name
  const date = config.created_at || new Date().toISOString().split('T')[0];
  const namePart = config.name
    .toLowerCase()
    .replace(/exp-\d+:\s*/i, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .substring(0, 50);

  const filename = `${date}-${namePart}.md`;
  const filepath = path.join(docsDir, filename);

  // Check if document already exists
  if (fs.existsSync(filepath)) {
    console.log(`   ℹ️  Document already exists: ${filename}`);
    return filepath;
  }

  // Generate and write document
  const content = generateDocumentTemplate(config, configPath);
  fs.writeFileSync(filepath, content, 'utf8');

  return filepath;
}

/**
 * Main function
 */
async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args[0] === '--help') {
    console.log(`
Usage: pnpm run experiment:create <config.yaml> [options]

Options:
  --run     Create and run the experiment immediately
  --help    Show this help message

Examples:
  pnpm run experiment:create config/experiments/exp-003.yaml
  pnpm run experiment:create config/experiments/exp-003.yaml --run
`);
    process.exit(0);
  }

  const configPath = args[0];
  const shouldRun = args.includes('--run');

  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║            Unified Experiment Creation                      ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log();

  // Load config
  console.log(`📋 Loading configuration: ${configPath}`);
  const config = loadConfig(configPath);
  console.log(`   Name: ${config.name}`);
  console.log(`   Description: ${config.description?.substring(0, 60)}...`);
  console.log();

  // Initialize database
  const db = new UnifiedMemoryDB({
    host: process.env.POSTGRES_HOST || 'localhost',
    port: parseInt(process.env.POSTGRES_PORT || '5434', 10),
    database: process.env.POSTGRES_DB || 'unified_memory',
    user: process.env.POSTGRES_USER || 'unified_memory',
    password: process.env.POSTGRES_PASSWORD || 'unified_memory_dev',
    maxConnections: 20,
    vectorDimensions: 1536,
  });

  try {
    await db.initialize();

    // Step 1: Create in database
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('STEP 1: Registering in Database');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    const experimentId = await createExperimentInDB(db, config, configPath);
    console.log(`   ✅ Experiment registered (id: ${experimentId})`);
    console.log();

    // Step 2: Create document
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('STEP 2: Creating Documentation');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    const docPath = createDocument(config, configPath);
    console.log(`   ✅ Document created: ${path.basename(docPath)}`);
    console.log();

    // Summary
    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║                  Experiment Created                        ║');
    console.log('╚════════════════════════════════════════════════════════════╝');
    console.log();
    console.log(`📋 Config: ${configPath}`);
    console.log(`🗄️  DB ID: ${experimentId} (status: draft)`);
    console.log(`📄 Document: ${path.basename(docPath)}`);
    console.log();

    if (shouldRun) {
      console.log('🚀 Running experiment...');
      console.log();
      await db.close();

      // Run the experiment
      execSync(`pnpm tsx scripts/run-experiment.ts ${configPath}`, {
        stdio: 'inherit',
      });
    } else {
      console.log('Next steps:');
      console.log(`  1. Edit the document: docs/research/experiments/${path.basename(docPath)}`);
      console.log(`  2. Run the experiment: pnpm run experiment ${configPath}`);
      console.log('  3. View results in UI: Experiments tab');
    }
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    await db.close();
  }
}

main().catch(console.error);
