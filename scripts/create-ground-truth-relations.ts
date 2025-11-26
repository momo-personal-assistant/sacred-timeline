#!/usr/bin/env tsx
/**
 * Create Ground Truth Relations for Sample Data
 *
 * Analyzes canonical objects and creates ground truth relations based on:
 * - Explicit relations (parent issues, linked tickets)
 * - Semantic similarity (similar topics/content)
 * - Actor connections (same assignees, creators)
 * - Temporal proximity (created within same time window)
 * - Tag/label overlap
 *
 * Usage:
 *   pnpm tsx scripts/create-ground-truth-relations.ts
 *   pnpm tsx scripts/create-ground-truth-relations.ts --dry-run
 */

import * as readline from 'readline';

import * as dotenv from 'dotenv';

import { UnifiedMemoryDB } from '@unified-memory/db';

dotenv.config();

// Parse command line arguments
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const skipConfirmation = args.includes('--yes') || args.includes('-y');

async function promptUser(message: string): Promise<boolean> {
  if (skipConfirmation) return true;

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(`${message} (y/n): `, (answer: string) => {
      rl.close();
      resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
    });
  });
}

interface CanonicalObject {
  id: string;
  platform: string;
  object_type: string;
  title: string;
  body: string;
  actors: any;
  timestamps: any;
  properties: any;
  visibility: string;
}

interface GroundTruthRelation {
  from_id: string;
  to_id: string;
  relation_type: string;
  confidence: number;
  source: string;
  metadata: Record<string, any>;
  scenario?: string;
}

/**
 * Calculate Jaccard similarity between two sets
 */
function jaccardSimilarity(set1: Set<string>, set2: Set<string>): number {
  const intersection = new Set([...set1].filter((x) => set2.has(x)));
  const union = new Set([...set1, ...set2]);
  return union.size > 0 ? intersection.size / union.size : 0;
}

/**
 * Tokenize text for similarity comparison
 */
function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter((token) => token.length > 2)
  );
}

/**
 * Create relations based on explicit parent/child relationships
 */
function createExplicitRelations(objects: CanonicalObject[]): GroundTruthRelation[] {
  const relations: GroundTruthRelation[] = [];

  for (const obj of objects) {
    // Linear parent relations
    if (obj.platform === 'linear' && obj.properties.parent) {
      const parentIdentifier = obj.properties.parent;
      // Find parent object by identifier
      const parentObj = objects.find(
        (o) => o.platform === 'linear' && o.id.includes(parentIdentifier)
      );

      if (parentObj) {
        relations.push({
          from_id: obj.id,
          to_id: parentObj.id,
          relation_type: 'blocks',
          confidence: 1.0,
          source: 'explicit',
          metadata: { evidence: ['explicit_parent_reference'] },
        });
      }
    }
  }

  return relations;
}

/**
 * Create relations based on semantic similarity
 */
function createSemanticRelations(objects: CanonicalObject[]): GroundTruthRelation[] {
  const relations: GroundTruthRelation[] = [];
  const SIMILARITY_THRESHOLD = 0.3;

  for (let i = 0; i < objects.length; i++) {
    for (let j = i + 1; j < objects.length; j++) {
      const obj1 = objects[i];
      const obj2 = objects[j];

      const text1 = `${obj1.title} ${obj1.body}`;
      const text2 = `${obj2.title} ${obj2.body}`;

      const tokens1 = tokenize(text1);
      const tokens2 = tokenize(text2);

      const similarity = jaccardSimilarity(tokens1, tokens2);

      if (similarity >= SIMILARITY_THRESHOLD) {
        const confidence = Math.min(similarity * 1.2, 1.0); // Scale up confidence

        relations.push({
          from_id: obj1.id,
          to_id: obj2.id,
          relation_type: 'relates_to',
          confidence,
          source: 'semantic',
          metadata: {
            evidence: [`semantic_similarity:${similarity.toFixed(3)}`],
            similarity_score: similarity,
          },
        });
      }
    }
  }

  return relations;
}

/**
 * Create relations based on shared actors (assignees, creators)
 */
function createActorRelations(objects: CanonicalObject[]): GroundTruthRelation[] {
  const relations: GroundTruthRelation[] = [];

  // Group by assignee
  const assigneeGroups = new Map<string, CanonicalObject[]>();
  for (const obj of objects) {
    const assignees = obj.actors?.assignees || [];
    for (const assignee of assignees) {
      if (!assigneeGroups.has(assignee)) {
        assigneeGroups.set(assignee, []);
      }
      assigneeGroups.get(assignee)!.push(obj);
    }
  }

  // Create relations for objects with same assignee
  for (const [assignee, objs] of assigneeGroups.entries()) {
    if (objs.length < 2) continue;

    for (let i = 0; i < objs.length; i++) {
      for (let j = i + 1; j < objs.length; j++) {
        relations.push({
          from_id: objs[i].id,
          to_id: objs[j].id,
          relation_type: 'assigned_to_same_person',
          confidence: 0.7,
          source: 'actor',
          metadata: {
            evidence: [`shared_assignee:${assignee}`],
            assignee,
          },
        });
      }
    }
  }

  return relations;
}

/**
 * Create relations based on temporal proximity
 */
function createTemporalRelations(objects: CanonicalObject[]): GroundTruthRelation[] {
  const relations: GroundTruthRelation[] = [];
  const TIME_WINDOW_DAYS = 7; // Objects created within 7 days

  for (let i = 0; i < objects.length; i++) {
    for (let j = i + 1; j < objects.length; j++) {
      const obj1 = objects[i];
      const obj2 = objects[j];

      const time1 = new Date(obj1.timestamps.created_at).getTime();
      const time2 = new Date(obj2.timestamps.created_at).getTime();

      const daysDiff = Math.abs(time1 - time2) / (1000 * 60 * 60 * 24);

      if (daysDiff <= TIME_WINDOW_DAYS) {
        const confidence = 1 - daysDiff / TIME_WINDOW_DAYS; // Closer = higher confidence

        relations.push({
          from_id: obj1.id,
          to_id: obj2.id,
          relation_type: 'created_near_same_time',
          confidence: confidence * 0.6, // Scale down confidence
          source: 'temporal',
          metadata: {
            evidence: [`temporal_proximity:${daysDiff.toFixed(1)}_days`],
            days_diff: daysDiff,
          },
        });
      }
    }
  }

  return relations;
}

/**
 * Create relations based on tag/label overlap
 */
function createLabelRelations(objects: CanonicalObject[]): GroundTruthRelation[] {
  const relations: GroundTruthRelation[] = [];
  const MIN_OVERLAP = 2; // At least 2 shared labels

  for (let i = 0; i < objects.length; i++) {
    for (let j = i + 1; j < objects.length; j++) {
      const obj1 = objects[i];
      const obj2 = objects[j];

      // Get labels/tags
      const labels1 = new Set<string>();
      const labels2 = new Set<string>();

      if (obj1.properties.labels) {
        obj1.properties.labels.forEach((l: string) => labels1.add(l.toLowerCase()));
      }
      if (obj1.properties.tags) {
        obj1.properties.tags.forEach((t: string) => labels1.add(t.toLowerCase()));
      }

      if (obj2.properties.labels) {
        obj2.properties.labels.forEach((l: string) => labels2.add(l.toLowerCase()));
      }
      if (obj2.properties.tags) {
        obj2.properties.tags.forEach((t: string) => labels2.add(t.toLowerCase()));
      }

      const sharedLabels = new Set([...labels1].filter((x) => labels2.has(x)));

      if (sharedLabels.size >= MIN_OVERLAP) {
        const confidence = Math.min(sharedLabels.size / Math.max(labels1.size, labels2.size), 1.0);

        relations.push({
          from_id: obj1.id,
          to_id: obj2.id,
          relation_type: 'shares_labels',
          confidence,
          source: 'labels',
          metadata: {
            evidence: [`shared_labels:${Array.from(sharedLabels).join(',')}`],
            shared_labels: Array.from(sharedLabels),
          },
        });
      }
    }
  }

  return relations;
}

async function main() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║       Create Ground Truth Relations                       ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  if (dryRun) {
    console.log('🔍 DRY RUN MODE - No changes will be made\n');
  }

  // Connect to database
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
    const pool = (db as any).pool;

    console.log('✅ Database connected\n');

    // Get all canonical objects
    const objectsResult = await pool.query(`
      SELECT id, platform, object_type, title, body, actors, timestamps, properties, visibility
      FROM canonical_objects
      ORDER BY (timestamps->>'created_at')
    `);

    const objects: CanonicalObject[] = objectsResult.rows;

    console.log(`📊 Found ${objects.length} canonical objects\n`);

    if (objects.length === 0) {
      console.log('❌ No objects found. Run ingest script first.');
      await db.close();
      process.exit(1);
    }

    // Generate relations using different strategies
    console.log('🔍 Analyzing relations...\n');

    const explicitRelations = createExplicitRelations(objects);
    console.log(`   Explicit relations: ${explicitRelations.length}`);

    const semanticRelations = createSemanticRelations(objects);
    console.log(`   Semantic relations: ${semanticRelations.length}`);

    const actorRelations = createActorRelations(objects);
    console.log(`   Actor relations: ${actorRelations.length}`);

    const temporalRelations = createTemporalRelations(objects);
    console.log(`   Temporal relations: ${temporalRelations.length}`);

    const labelRelations = createLabelRelations(objects);
    console.log(`   Label relations: ${labelRelations.length}`);

    // Combine all relations
    const allRelations = [
      ...explicitRelations,
      ...semanticRelations,
      ...actorRelations,
      ...temporalRelations,
      ...labelRelations,
    ];

    console.log(`\n📝 Total ground truth relations: ${allRelations.length}\n`);

    if (dryRun) {
      console.log('✅ DRY RUN: Would create these relations');
      console.log('   (no database changes made)');
      await db.close();
      return;
    }

    // Check current ground truth count
    const beforeCount = await pool.query('SELECT COUNT(*) as count FROM ground_truth_relations');
    const beforeRelations = parseInt(beforeCount.rows[0].count);

    if (beforeRelations > 0) {
      console.log(
        `⚠️  WARNING: This will DELETE ${beforeRelations} existing ground truth relations\n`
      );
      const confirmed = await promptUser('Are you sure you want to continue?');
      if (!confirmed) {
        console.log('\n❌ Operation cancelled by user');
        await db.close();
        process.exit(0);
      }

      await pool.query('DELETE FROM ground_truth_relations');
      console.log('✅ Cleared existing ground truth relations\n');
    }

    // Insert relations
    console.log('💾 Inserting ground truth relations...');
    let insertedCount = 0;

    for (const relation of allRelations) {
      await pool.query(
        `INSERT INTO ground_truth_relations (from_id, to_id, relation_type, confidence, source, metadata, scenario)
         VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7)`,
        [
          relation.from_id,
          relation.to_id,
          relation.relation_type,
          relation.confidence,
          relation.source,
          JSON.stringify(relation.metadata),
          relation.scenario || null,
        ]
      );

      insertedCount++;

      if (insertedCount % 100 === 0) {
        console.log(`   Inserted ${insertedCount}/${allRelations.length} relations...`);
      }
    }

    console.log(`✅ Inserted ${allRelations.length} ground truth relations\n`);

    // Show relation type breakdown
    const typeBreakdown = await pool.query(`
      SELECT relation_type, COUNT(*) as count, AVG(confidence) as avg_confidence
      FROM ground_truth_relations
      GROUP BY relation_type
      ORDER BY count DESC
    `);

    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║              Relation Type Breakdown                       ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');

    for (const row of typeBreakdown.rows) {
      console.log(
        `   ${row.relation_type.padEnd(30)} ${String(row.count).padStart(6)} (avg conf: ${parseFloat(row.avg_confidence).toFixed(2)})`
      );
    }

    console.log('\n✅ Ground truth relations created successfully!\n');

    await db.close();
  } catch (error) {
    console.error('❌ Error creating ground truth relations:', error);
    await db.close();
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
