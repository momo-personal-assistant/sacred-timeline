#!/usr/bin/env tsx
/**
 * Validate Relations Script
 *
 * Purpose: Validate relation inference against ground truth
 * Calculates Precision, Recall, and F1 score
 *
 * Usage:
 *   pnpm tsx scripts/validate-relations.ts [scenario]
 *
 * Examples:
 *   pnpm tsx scripts/validate-relations.ts
 *   pnpm tsx scripts/validate-relations.ts normal
 *   pnpm tsx scripts/validate-relations.ts all
 */

import * as dotenv from 'dotenv';

import { RelationInferrer, type Relation } from '@momo/graph';
import { UnifiedMemoryDB } from '@unified-memory/db';

// Load environment variables
dotenv.config();

interface ValidationMetrics {
  scenario: string;
  precision: number;
  recall: number;
  f1_score: number;
  true_positives: number;
  false_positives: number;
  false_negatives: number;
  ground_truth_total: number;
  inferred_total: number;
  matched_relations: Array<{
    from_id: string;
    to_id: string;
    type: string;
    confidence: number;
  }>;
}

/**
 * Normalize relation for comparison
 * Relations are considered equal if they have the same from_id, to_id, and type
 */
function normalizeRelation(rel: Relation): string {
  return `${rel.from_id}|${rel.to_id}|${rel.type}`;
}

/**
 * Calculate validation metrics
 */
function calculateMetrics(
  groundTruth: Relation[],
  inferred: Relation[],
  scenario: string
): ValidationMetrics {
  // Create sets for comparison
  const groundTruthSet = new Set(groundTruth.map(normalizeRelation));
  const inferredSet = new Set(inferred.map(normalizeRelation));

  // Calculate true positives (inferred relations that exist in ground truth)
  const truePositives = inferred.filter((rel) => groundTruthSet.has(normalizeRelation(rel)));

  // Calculate false positives (inferred relations that don't exist in ground truth)
  const falsePositives = inferred.filter((rel) => !groundTruthSet.has(normalizeRelation(rel)));

  // Calculate false negatives (ground truth relations that weren't inferred)
  const falseNegatives = groundTruth.filter((rel) => !inferredSet.has(normalizeRelation(rel)));

  // Calculate metrics
  const tp = truePositives.length;
  const fp = falsePositives.length;
  const fn = falseNegatives.length;

  const precision = tp + fp > 0 ? tp / (tp + fp) : 0;
  const recall = tp + fn > 0 ? tp / (tp + fn) : 0;
  const f1Score = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;

  return {
    scenario,
    precision,
    recall,
    f1_score: f1Score,
    true_positives: tp,
    false_positives: fp,
    false_negatives: fn,
    ground_truth_total: groundTruth.length,
    inferred_total: inferred.length,
    matched_relations: truePositives.map((rel) => ({
      from_id: rel.from_id,
      to_id: rel.to_id,
      type: rel.type,
      confidence: rel.confidence,
    })),
  };
}

/**
 * Validate relations for a specific scenario
 */
async function validateScenario(
  db: UnifiedMemoryDB,
  inferrer: RelationInferrer,
  scenario: string
): Promise<ValidationMetrics> {
  console.log(`\nValidating scenario: ${scenario}`);
  console.log('='.repeat(60));

  // Load ground truth relations
  const pool = (db as any).pool;
  const groundTruthResult = await pool.query(
    `
    SELECT from_id, to_id, relation_type as type, source, confidence
    FROM ground_truth_relations
    WHERE scenario = $1
    `,
    [scenario]
  );

  const groundTruth: Relation[] = groundTruthResult.rows.map((row: any) => ({
    from_id: row.from_id,
    to_id: row.to_id,
    type: row.type,
    source: row.source as 'explicit' | 'inferred' | 'computed',
    confidence: parseFloat(row.confidence),
  }));

  console.log(`   Ground truth relations: ${groundTruth.length}`);

  // Get all canonical objects for this scenario
  // In practice, you'd filter by scenario, but for simplicity we'll use all objects
  const objects = await db.searchCanonicalObjects({}, 1000);
  console.log(`   Canonical objects: ${objects.length}`);

  // Infer relations
  const inferred = inferrer.inferAll(objects);
  console.log(`   Inferred relations: ${inferred.length}`);

  // Calculate metrics
  const metrics = calculateMetrics(groundTruth, inferred, scenario);

  // Print results
  console.log('\n   METRICS:');
  console.log(`   Precision: ${(metrics.precision * 100).toFixed(2)}%`);
  console.log(`   Recall: ${(metrics.recall * 100).toFixed(2)}%`);
  console.log(`   F1 Score: ${(metrics.f1_score * 100).toFixed(2)}%`);
  console.log(`\n   BREAKDOWN:`);
  console.log(`   True Positives: ${metrics.true_positives}`);
  console.log(`   False Positives: ${metrics.false_positives}`);
  console.log(`   False Negatives: ${metrics.false_negatives}`);

  return metrics;
}

/**
 * Main function
 */
async function main() {
  const args = process.argv.slice(2);
  const scenario = args[0] || 'normal';

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

    // Initialize relation inferrer
    const inferrer = new RelationInferrer({
      similarityThreshold: 0.85,
      // keywordOverlapThreshold: use default (0.65)
      includeInferred: true,
    });

    // Validate scenarios
    const scenarios =
      scenario === 'all' ? ['normal', 'sales_heavy', 'dev_heavy', 'pattern', 'stress'] : [scenario];

    const allMetrics: ValidationMetrics[] = [];

    for (const s of scenarios) {
      const metrics = await validateScenario(db, inferrer, s);
      allMetrics.push(metrics);
    }

    // Print summary
    console.log('\n\n' + '='.repeat(60));
    console.log('VALIDATION SUMMARY');
    console.log('='.repeat(60));

    for (const metrics of allMetrics) {
      console.log(`\n${metrics.scenario}:`);
      console.log(`  Precision: ${(metrics.precision * 100).toFixed(2)}%`);
      console.log(`  Recall: ${(metrics.recall * 100).toFixed(2)}%`);
      console.log(`  F1 Score: ${(metrics.f1_score * 100).toFixed(2)}%`);
      console.log(
        `  TP: ${metrics.true_positives} | FP: ${metrics.false_positives} | FN: ${metrics.false_negatives}`
      );
    }

    // Calculate average metrics
    if (allMetrics.length > 1) {
      const avgPrecision = allMetrics.reduce((sum, m) => sum + m.precision, 0) / allMetrics.length;
      const avgRecall = allMetrics.reduce((sum, m) => sum + m.recall, 0) / allMetrics.length;
      const avgF1 = allMetrics.reduce((sum, m) => sum + m.f1_score, 0) / allMetrics.length;

      console.log('\n' + '-'.repeat(60));
      console.log('AVERAGE:');
      console.log(`  Precision: ${(avgPrecision * 100).toFixed(2)}%`);
      console.log(`  Recall: ${(avgRecall * 100).toFixed(2)}%`);
      console.log(`  F1 Score: ${(avgF1 * 100).toFixed(2)}%`);
    }

    console.log('='.repeat(60));

    // Save detailed results to file
    const fs = await import('fs/promises');
    const resultsPath = `validation-results-${Date.now()}.json`;
    await fs.writeFile(resultsPath, JSON.stringify(allMetrics, null, 2));
    console.log(`\nDetailed results saved to: ${resultsPath}`);
  } catch (error) {
    console.error('\nValidation failed:', error);
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
