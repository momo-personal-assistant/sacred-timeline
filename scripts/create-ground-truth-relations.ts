#!/usr/bin/env tsx
/**
 * Create Ground Truth Relations for Sample Data
 *
 * IMPORTANT: Ground Truth must be INDEPENDENT from the inference algorithm.
 * This means we ONLY use structural/explicit relations that are 100% verifiable,
 * NOT semantic similarity (which is what the inference tries to discover).
 *
 * Ground Truth sources (used for evaluation):
 * - Explicit parent/child relations (from data schema)
 * - Explicit mentions (Issue A mentions "LIN-123" in description)
 * - Explicit links (ticket references another ticket)
 *
 * NOT included in Ground Truth (inference should discover these):
 * - Semantic similarity (embedding-based) ← This is what we evaluate!
 * - Actor connections (same assignees)
 * - Temporal proximity
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
 * Calculate cosine similarity between two embedding vectors
 */
function cosineSimilarity(vec1: number[], vec2: number[]): number {
  if (vec1.length !== vec2.length) {
    throw new Error('Vectors must have same length');
  }

  let dotProduct = 0;
  let norm1 = 0;
  let norm2 = 0;

  for (let i = 0; i < vec1.length; i++) {
    dotProduct += vec1[i] * vec2[i];
    norm1 += vec1[i] * vec1[i];
    norm2 += vec2[i] * vec2[i];
  }

  const magnitude = Math.sqrt(norm1) * Math.sqrt(norm2);
  return magnitude === 0 ? 0 : dotProduct / magnitude;
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
          relation_type: 'belongs_to', // Changed from 'blocks' to match inferrer
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
 * DEPRECATED: Semantic relations should NOT be in Ground Truth
 *
 * This function is kept for reference/comparison but should NOT be used
 * in the final ground truth set. Semantic similarity is what the inference
 * algorithm tries to discover - using it as GT creates circular validation.
 *
 * @deprecated Use only for debugging/comparison, not for GT
 */
function createSemanticRelations(
  objects: CanonicalObject[],
  embeddingsMap: Map<string, number[]>
): GroundTruthRelation[] {
  console.warn('⚠️  WARNING: createSemanticRelations should NOT be used for Ground Truth!');
  console.warn(
    '    Semantic similarity is what inference discovers - using it as GT is circular validation.'
  );

  const relations: GroundTruthRelation[] = [];
  const SIMILARITY_THRESHOLD = 0.35;

  for (let i = 0; i < objects.length; i++) {
    for (let j = i + 1; j < objects.length; j++) {
      const obj1 = objects[i];
      const obj2 = objects[j];

      const emb1 = embeddingsMap.get(obj1.id);
      const emb2 = embeddingsMap.get(obj2.id);

      if (!emb1 || !emb2) continue;

      const similarity = cosineSimilarity(emb1, emb2);

      if (similarity >= SIMILARITY_THRESHOLD) {
        relations.push({
          from_id: obj1.id,
          to_id: obj2.id,
          relation_type: 'similar_to',
          confidence: similarity,
          source: 'semantic_embedding',
          metadata: {
            evidence: [`embedding_cosine_similarity:${similarity.toFixed(3)}`],
            similarity_score: similarity,
            similarity_method: 'cosine',
            _warning: 'THIS SHOULD NOT BE IN GROUND TRUTH - circular validation',
          },
        });
      }
    }
  }

  return relations;
}

/**
 * Create relations based on explicit mentions in text
 * e.g., Issue A's description contains "LIN-123" which is Issue B's identifier
 *
 * This is a valid Ground Truth source because:
 * - It's 100% verifiable from the data
 * - It's independent of the inference algorithm
 * - A human would also identify this as a relation
 */
function createExplicitMentionRelations(objects: CanonicalObject[]): GroundTruthRelation[] {
  const relations: GroundTruthRelation[] = [];

  // Build a map of identifiers to objects
  const identifierMap = new Map<string, CanonicalObject>();

  for (const obj of objects) {
    // Linear issues have identifiers like "LIN-123"
    if (obj.platform === 'linear' && obj.properties.identifier) {
      identifierMap.set(obj.properties.identifier, obj);
    }
    // Zendesk tickets have IDs
    if (obj.platform === 'zendesk' && obj.properties.ticket_id) {
      identifierMap.set(`#${obj.properties.ticket_id}`, obj);
      identifierMap.set(`ticket-${obj.properties.ticket_id}`, obj);
    }
  }

  // Check each object's text for mentions of other objects
  for (const obj of objects) {
    const textToSearch = `${obj.title || ''} ${obj.body || ''}`.toLowerCase();

    for (const [identifier, targetObj] of identifierMap.entries()) {
      // Don't link to self
      if (targetObj.id === obj.id) continue;

      // Check if this object mentions the identifier
      if (textToSearch.includes(identifier.toLowerCase())) {
        relations.push({
          from_id: obj.id,
          to_id: targetObj.id,
          relation_type: 'mentions',
          confidence: 1.0, // Explicit mention = 100% confidence
          source: 'explicit_mention',
          metadata: {
            evidence: [`text_contains_identifier:${identifier}`],
            mentioned_identifier: identifier,
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

    // Load embeddings for each canonical object (average of chunk embeddings)
    console.log('🔍 Loading embeddings from database...');
    const embeddingsMap = new Map<string, number[]>();
    let objectsWithEmbeddings = 0;

    for (const obj of objects) {
      const chunks = await pool.query(
        'SELECT embedding FROM chunks WHERE canonical_object_id = $1 AND embedding IS NOT NULL',
        [obj.id]
      );

      if (chunks.rows.length > 0) {
        const embeddings = chunks.rows.map((row: { embedding: string | number[] }) => {
          const emb = row.embedding;
          if (typeof emb === 'string') return JSON.parse(emb);
          return emb;
        });

        // Average embeddings
        const dimensions = embeddings[0].length;
        const avgEmbedding = new Array(dimensions);
        for (let i = 0; i < dimensions; i++) {
          avgEmbedding[i] =
            embeddings.reduce((sum: number, emb: number[]) => sum + emb[i], 0) / embeddings.length;
        }
        embeddingsMap.set(obj.id, avgEmbedding);
        objectsWithEmbeddings++;
      }
    }

    console.log(`   Objects with embeddings: ${objectsWithEmbeddings}/${objects.length}\n`);

    if (objectsWithEmbeddings === 0) {
      console.log('❌ No embeddings found. Run experiment to generate embeddings first.');
      await db.close();
      process.exit(1);
    }

    // Generate relations using ONLY structural/explicit sources
    // These are 100% verifiable and independent of the inference algorithm
    console.log('🔍 Analyzing structural relations (Ground Truth)...\n');

    const explicitRelations = createExplicitRelations(objects);
    console.log(`   ✅ Parent-child relations: ${explicitRelations.length}`);

    const mentionRelations = createExplicitMentionRelations(objects);
    console.log(`   ✅ Explicit mention relations: ${mentionRelations.length}`);

    // These are NOT included in Ground Truth
    // They are what the inference algorithm should discover
    console.log('\n📊 Reference: What inference should discover (NOT in GT)...');

    const semanticRelations = createSemanticRelations(objects, embeddingsMap);
    console.log(`   ⚠️  Semantic relations (for comparison only): ${semanticRelations.length}`);

    const actorRelations = createActorRelations(objects);
    console.log(`   ℹ️  Actor relations (not in GT): ${actorRelations.length}`);

    const temporalRelations = createTemporalRelations(objects);
    console.log(`   ℹ️  Temporal relations (not in GT): ${temporalRelations.length}`);

    const labelRelations = createLabelRelations(objects);
    console.log(`   ℹ️  Label relations (not in GT): ${labelRelations.length}`);

    // CRITICAL: Ground Truth = ONLY structural/explicit relations
    // Semantic similarity is what the inference discovers - NOT ground truth
    const allRelations = [...explicitRelations, ...mentionRelations];

    console.log('\n' + '═'.repeat(60));
    console.log('📝 GROUND TRUTH COMPOSITION (structural only):');
    console.log('═'.repeat(60));
    console.log(`   Parent-child:      ${explicitRelations.length}`);
    console.log(`   Explicit mentions: ${mentionRelations.length}`);
    console.log(`   ─────────────────────────────`);
    console.log(`   TOTAL GT:          ${allRelations.length}`);
    console.log('═'.repeat(60));
    console.log(`\n⚠️  Semantic relations (${semanticRelations.length}) are EXCLUDED from GT`);
    console.log('   → These are what inference should discover\n');

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
