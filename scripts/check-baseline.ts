/**
 * Quick baseline validation check
 * Verifies the current F1 score without running a full experiment
 */

import * as dotenv from 'dotenv';

import { RelationInferrer } from '@momo/graph';
import { UnifiedMemoryDB } from '@unified-memory/db';

dotenv.config();

async function main() {
  const db = new UnifiedMemoryDB({
    host: process.env.POSTGRES_HOST || 'localhost',
    port: parseInt(process.env.POSTGRES_PORT || '5434', 10),
    database: process.env.POSTGRES_DB || 'unified_memory',
    user: process.env.POSTGRES_USER || 'unified_memory',
    password: process.env.POSTGRES_PASSWORD || 'unified_memory_dev',
    maxConnections: 20,
    vectorDimensions: 1536,
  });

  await db.initialize();

  const inferrer = new RelationInferrer({
    similarityThreshold: 0.35,
    keywordOverlapThreshold: 0.65,
    includeInferred: true,
    useSemanticSimilarity: false,
    semanticWeight: 0.7,
  });

  const pool = (db as any).pool;

  // Get ground truth
  const gt = await pool.query(
    "SELECT from_id, to_id, relation_type as type FROM ground_truth_relations WHERE scenario = 'normal'"
  );

  // Get objects
  const objects = await db.searchCanonicalObjects({}, 1000);

  // Infer relations
  const inferred = inferrer.inferAll(objects as any);

  // Calculate metrics
  const normalize = (r: any) => `${r.from_id}|${r.to_id}|${r.type}`;
  const gtSet = new Set(gt.rows.map(normalize));
  const infSet = new Set(inferred.map(normalize));

  const tp = inferred.filter((r) => gtSet.has(normalize(r))).length;
  const fp = inferred.filter((r) => !gtSet.has(normalize(r))).length;
  const fn = gt.rows.filter((r: any) => !infSet.has(normalize(r))).length;

  const precision = tp + fp > 0 ? tp / (tp + fp) : 0;
  const recall = tp + fn > 0 ? tp / (tp + fn) : 0;
  const f1 = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;

  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║              Baseline Validation Check                     ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log();
  console.log('Ground Truth Relations:', gt.rows.length);
  console.log('Inferred Relations:', inferred.length);
  console.log();
  console.log('True Positives:', tp);
  console.log('False Positives:', fp);
  console.log('False Negatives:', fn);
  console.log();
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('METRICS');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`Precision: ${(precision * 100).toFixed(1)}%`);
  console.log(`Recall: ${(recall * 100).toFixed(1)}%`);
  console.log(`F1 Score: ${(f1 * 100).toFixed(1)}%`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  // Show matched and missed relations
  console.log('\nMatched Relations (TP):');
  const matchedRels = inferred.filter((r) => gtSet.has(normalize(r)));
  for (const rel of matchedRels.slice(0, 10)) {
    console.log(`  - ${rel.from_id} --${rel.type}--> ${rel.to_id}`);
  }
  if (matchedRels.length > 10) {
    console.log(`  ... and ${matchedRels.length - 10} more`);
  }

  console.log('\nMissed Relations (FN):');
  const missedRels = gt.rows.filter((r: any) => !infSet.has(normalize(r)));
  for (const rel of missedRels.slice(0, 10)) {
    console.log(`  - ${rel.from_id} --${rel.type}--> ${rel.to_id}`);
  }
  if (missedRels.length > 10) {
    console.log(`  ... and ${missedRels.length - 10} more`);
  }

  await db.close();
}

main().catch(console.error);
