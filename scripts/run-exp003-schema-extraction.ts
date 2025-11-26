/**
 * EXP-003: Schema-Based Relation Extraction
 *
 * actors 필드에서 직접 관계를 추출하여 Ground Truth와 비교
 */

import * as dotenv from 'dotenv';

import { UnifiedMemoryDB } from '@unified-memory/db';

dotenv.config();

interface Relation {
  from_id: string;
  to_id: string;
  type: string;
  source: string;
  confidence: number;
}

interface CanonicalObject {
  id: string;
  platform: string;
  object_type: string;
  title: string;
  actors: Record<string, any>;
}

/**
 * Extract relations from schema (actors field)
 */
function extractRelationsFromSchema(obj: CanonicalObject): Relation[] {
  const relations: Relation[] = [];
  const actors = obj.actors || {};

  // created_by: object --created_by--> user
  if (actors.created_by && typeof actors.created_by === 'string') {
    relations.push({
      from_id: obj.id,
      to_id: actors.created_by,
      type: 'created_by',
      source: 'schema',
      confidence: 1.0,
    });
  }

  // assignee: object --assigned_to--> user
  if (actors.assignee && typeof actors.assignee === 'string') {
    relations.push({
      from_id: obj.id,
      to_id: actors.assignee,
      type: 'assigned_to',
      source: 'schema',
      confidence: 1.0,
    });
  }

  // participants: user --participated_in--> object (array)
  if (actors.participants && Array.isArray(actors.participants)) {
    for (const participant of actors.participants) {
      if (typeof participant === 'string') {
        relations.push({
          from_id: participant,
          to_id: obj.id,
          type: 'participated_in',
          source: 'schema',
          confidence: 1.0,
        });
      }
    }
  }

  // updated_by: object --updated_by--> user
  if (
    actors.updated_by &&
    typeof actors.updated_by === 'string' &&
    actors.updated_by !== 'system'
  ) {
    relations.push({
      from_id: obj.id,
      to_id: actors.updated_by,
      type: 'updated_by',
      source: 'schema',
      confidence: 1.0,
    });
  }

  return relations;
}

async function main() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║       EXP-003: Schema-Based Relation Extraction            ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log();

  const startTime = Date.now();

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

    // Step 1: Get all canonical objects with actors
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('STEP 1: Loading Canonical Objects');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    const objectsResult = await pool.query(
      'SELECT id, platform, object_type, title, actors FROM canonical_objects'
    );
    const objects: CanonicalObject[] = objectsResult.rows;
    console.log(`   Loaded ${objects.length} canonical objects`);

    // Show actors data
    console.log('\n   Objects with actors:');
    for (const obj of objects) {
      const actorKeys = Object.keys(obj.actors || {}).filter(
        (k) => k !== 'created_by' || obj.actors[k] !== 'system'
      );
      if (actorKeys.length > 0) {
        console.log(`   - ${obj.id}`);
        console.log(`     actors: ${JSON.stringify(obj.actors)}`);
      }
    }

    // Step 2: Extract relations from schema
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('STEP 2: Extracting Relations from Schema');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    const extractedRelations: Relation[] = [];
    for (const obj of objects) {
      const relations = extractRelationsFromSchema(obj);
      extractedRelations.push(...relations);
    }

    console.log(`   Extracted ${extractedRelations.length} relations from schema`);
    console.log('\n   Extracted relations:');
    for (const rel of extractedRelations) {
      console.log(`   - ${rel.from_id} --${rel.type}--> ${rel.to_id}`);
    }

    // Step 3: Load ground truth
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('STEP 3: Loading Ground Truth');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    const gtResult = await pool.query(
      'SELECT from_id, to_id, relation_type as type FROM ground_truth_relations'
    );
    const groundTruth = gtResult.rows;
    console.log(`   Loaded ${groundTruth.length} ground truth relations`);

    console.log('\n   Ground truth relations:');
    for (const rel of groundTruth) {
      console.log(`   - ${rel.from_id} --${rel.type}--> ${rel.to_id}`);
    }

    // Step 4: Calculate metrics (exact match)
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('STEP 4: Calculating Metrics (Exact Match)');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    const normalizeRelation = (rel: { from_id: string; to_id: string; type: string }) =>
      `${rel.from_id}|${rel.to_id}|${rel.type}`;

    const gtSet = new Set(groundTruth.map(normalizeRelation));
    const extractedSet = new Set(extractedRelations.map(normalizeRelation));

    const truePositives = extractedRelations.filter((rel) => gtSet.has(normalizeRelation(rel)));
    const falsePositives = extractedRelations.filter((rel) => !gtSet.has(normalizeRelation(rel)));
    const falseNegatives = groundTruth.filter(
      (rel: any) => !extractedSet.has(normalizeRelation(rel))
    );

    const tp = truePositives.length;
    const fp = falsePositives.length;
    const fn = falseNegatives.length;

    const precision = tp + fp > 0 ? tp / (tp + fp) : 0;
    const recall = tp + fn > 0 ? tp / (tp + fn) : 0;
    const f1 = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;

    console.log(`\n✅ True Positives: ${tp}`);
    for (const rel of truePositives) {
      console.log(`   - ${rel.from_id} --${rel.type}--> ${rel.to_id}`);
    }

    console.log(`\n❌ False Positives: ${fp}`);
    for (const rel of falsePositives) {
      console.log(`   - ${rel.from_id} --${rel.type}--> ${rel.to_id}`);
    }

    console.log(`\n⚠️  False Negatives: ${fn}`);
    for (const rel of falseNegatives) {
      console.log(`   - ${rel.from_id} --${rel.type}--> ${rel.to_id}`);
    }

    // Step 5: Calculate type-agnostic metrics
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('STEP 5: Type-Agnostic Metrics (for comparison)');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    const normalizePair = (from: string, to: string) =>
      from < to ? `${from}|${to}` : `${to}|${from}`;

    const gtPairs = new Set(groundTruth.map((r: any) => normalizePair(r.from_id, r.to_id)));
    const extractedPairs = new Set(
      extractedRelations.map((r) => normalizePair(r.from_id, r.to_id))
    );

    const tpAgnostic = [...extractedPairs].filter((p) => gtPairs.has(p)).length;
    const fpAgnostic = [...extractedPairs].filter((p) => !gtPairs.has(p)).length;
    const fnAgnostic = [...gtPairs].filter((p) => !extractedPairs.has(p)).length;

    const precisionAgnostic =
      tpAgnostic + fpAgnostic > 0 ? tpAgnostic / (tpAgnostic + fpAgnostic) : 0;
    const recallAgnostic = tpAgnostic + fnAgnostic > 0 ? tpAgnostic / (tpAgnostic + fnAgnostic) : 0;
    const f1Agnostic =
      precisionAgnostic + recallAgnostic > 0
        ? (2 * precisionAgnostic * recallAgnostic) / (precisionAgnostic + recallAgnostic)
        : 0;

    console.log(`   Type-Agnostic: TP=${tpAgnostic}, FP=${fpAgnostic}, FN=${fnAgnostic}`);

    // Final Results
    const duration = (Date.now() - startTime) / 1000;

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('RESULTS COMPARISON');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`
| Metric    | EXP-001  | EXP-002  | EXP-003 (Schema) |
|-----------|----------|----------|------------------|
| Precision | -        | 2.9%     | ${(precision * 100).toFixed(1)}%            |
| Recall    | -        | 12.5%    | ${(recall * 100).toFixed(1)}%            |
| F1 Score  | 65.9%    | 4.8%     | ${(f1 * 100).toFixed(1)}%            |
| Cost      | $0       | ~$0.01   | $0               |
| Time      | ~1s      | ~30s     | ${duration.toFixed(2)}s             |
`);

    console.log('Type-Agnostic Comparison:');
    console.log(`
| Metric    | EXP-002 (Agnostic) | EXP-003 (Agnostic) |
|-----------|--------------------|--------------------|
| Precision | 30.0%              | ${(precisionAgnostic * 100).toFixed(1)}%              |
| Recall    | 37.5%              | ${(recallAgnostic * 100).toFixed(1)}%              |
| F1 Score  | 33.3%              | ${(f1Agnostic * 100).toFixed(1)}%              |
`);

    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║                    EXP-003 Complete                        ║');
    console.log('╚════════════════════════════════════════════════════════════╝');
    console.log(`\n⏱️  Duration: ${duration.toFixed(2)}s`);

    await db.close();
  } catch (error) {
    console.error('Error:', error);
    await db.close();
    process.exit(1);
  }
}

main();
