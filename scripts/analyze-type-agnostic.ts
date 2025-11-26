/**
 * Type-Agnostic Analysis for EXP-002
 *
 * EXP-002에서 LLM이 추론한 관계를 type 무시하고 재평가
 * Ground truth와 from_id|to_id만 비교
 */

import * as fs from 'fs';

import * as dotenv from 'dotenv';
import * as yaml from 'yaml';

import { RelationInferrer } from '@momo/graph';
import { UnifiedMemoryDB } from '@unified-memory/db';

dotenv.config();

interface ContrastiveExample {
  chunk1: string;
  chunk2: string;
  label: string;
  reason: string;
}

async function main() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║       Type-Agnostic Analysis for EXP-002                   ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log();

  // Load EXP-002 config
  const configPath = 'config/experiments/2024-11-25-contrastive-icl.yaml';
  const configContent = fs.readFileSync(configPath, 'utf-8');
  const config = yaml.parse(configContent);

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
    console.log('✅ Database connected\n');

    const pool = (db as any).pool;

    // Get canonical objects
    const objects = await db.searchCanonicalObjects({}, 1000);
    console.log(`📊 Canonical Objects: ${objects.length}`);

    // Get ground truth relations
    const gtResult = await pool.query(
      'SELECT from_id, to_id, relation_type FROM ground_truth_relations'
    );
    const groundTruth = gtResult.rows;
    console.log(`📊 Ground Truth Relations: ${groundTruth.length}`);

    // Create type-agnostic ground truth set (normalized pairs)
    const normalizePair = (from: string, to: string) => {
      return from < to ? `${from}|${to}` : `${to}|${from}`;
    };

    const gtPairsTypeAgnostic = new Set(
      groundTruth.map((r: any) => normalizePair(r.from_id, r.to_id))
    );
    console.log(`📊 Unique Ground Truth Pairs (type-agnostic): ${gtPairsTypeAgnostic.size}`);
    console.log();

    // Initialize RelationInferrer with Contrastive ICL
    const inferrer = new RelationInferrer({
      similarityThreshold: config.relationInference.similarityThreshold,
      keywordOverlapThreshold: config.relationInference.keywordOverlapThreshold,
      includeInferred: true,
      useSemanticSimilarity: false,
      useContrastiveICL: true,
      contrastiveExamples: {
        positive: config.relationInference.contrastiveExamples.positive as ContrastiveExample[],
        negative: config.relationInference.contrastiveExamples.negative as ContrastiveExample[],
      },
      promptTemplate: config.relationInference.promptTemplate,
      llmConfig: {
        model: config.relationInference.llmConfig.model,
        temperature: config.relationInference.llmConfig.temperature,
        maxTokens: config.relationInference.llmConfig.maxTokens,
      },
    });

    console.log('🤖 Running Contrastive ICL inference...');
    console.log('   (This will make LLM API calls)\n');

    // Run inference
    const startTime = Date.now();
    const inferredRelations = await inferrer.inferSimilarityWithContrastiveICL(objects);
    const duration = (Date.now() - startTime) / 1000;

    // Extract unique inferred pairs (type-agnostic)
    const inferredPairs = new Set<string>();
    for (const rel of inferredRelations) {
      inferredPairs.add(normalizePair(rel.from_id, rel.to_id));
    }

    console.log(`\n📊 Inferred Pairs (type-agnostic): ${inferredPairs.size}`);
    console.log(`⏱️  Duration: ${duration.toFixed(1)}s\n`);

    // Calculate type-agnostic metrics
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('TYPE-AGNOSTIC ANALYSIS');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    // True Positives: pairs that exist in both
    const truePositives: string[] = [];
    const falsePositives: string[] = [];

    for (const pair of inferredPairs) {
      if (gtPairsTypeAgnostic.has(pair)) {
        truePositives.push(pair);
      } else {
        falsePositives.push(pair);
      }
    }

    // False Negatives: ground truth pairs not found
    const falseNegatives: string[] = [];
    for (const pair of gtPairsTypeAgnostic) {
      if (!inferredPairs.has(pair)) {
        falseNegatives.push(pair);
      }
    }

    const tp = truePositives.length;
    const fp = falsePositives.length;
    const fn = falseNegatives.length;

    const precision = tp + fp > 0 ? tp / (tp + fp) : 0;
    const recall = tp + fn > 0 ? tp / (tp + fn) : 0;
    const f1 = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;

    console.log(`\n✅ True Positives: ${tp}`);
    truePositives.forEach((p) => console.log(`   - ${p}`));

    console.log(`\n❌ False Positives: ${fp}`);
    falsePositives.forEach((p) => console.log(`   - ${p}`));

    console.log(`\n⚠️  False Negatives: ${fn}`);
    falseNegatives.forEach((p) => console.log(`   - ${p}`));

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('METRICS COMPARISON');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`
| Metric    | EXP-002 (with type) | Type-Agnostic |
|-----------|---------------------|---------------|
| Precision | 2.9%                | ${(precision * 100).toFixed(1)}%          |
| Recall    | 12.5%               | ${(recall * 100).toFixed(1)}%          |
| F1 Score  | 4.8%                | ${(f1 * 100).toFixed(1)}%          |
`);

    // Compare with baseline
    const baselineF1 = 0.659; // 65.9%
    const improvement = f1 - baselineF1;

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('VS BASELINE (EXP-001: 65.9% F1)');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(
      `   F1 Difference: ${improvement > 0 ? '+' : ''}${(improvement * 100).toFixed(1)}%`
    );

    if (f1 > baselineF1) {
      console.log(`   ✅ Type-agnostic Contrastive ICL BEATS baseline!`);
    } else {
      console.log(`   ❌ Still below baseline even with type-agnostic evaluation`);
    }

    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║                    Analysis Complete                       ║');
    console.log('╚════════════════════════════════════════════════════════════╝');

    await db.close();
  } catch (error) {
    console.error('Error:', error);
    await db.close();
    process.exit(1);
  }
}

main();
