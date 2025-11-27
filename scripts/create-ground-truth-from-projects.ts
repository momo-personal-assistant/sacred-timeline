/**
 * Generate Ground Truth Relations from Project-based Data
 * Rule: Objects in the same project are related
 */

import fs from 'fs';
import path from 'path';

import * as dotenv from 'dotenv';
import { Pool } from 'pg';

import type { CanonicalObject } from '@unified-memory/db';

dotenv.config();

// =============================================================================
// Database Connection
// =============================================================================

const pool = new Pool({
  host: process.env.POSTGRES_HOST || 'localhost',
  port: parseInt(process.env.POSTGRES_PORT || '5434', 10),
  database: process.env.POSTGRES_DB || 'unified_memory',
  user: process.env.POSTGRES_USER || 'unified_memory',
  password: process.env.POSTGRES_PASSWORD || 'unified_memory_dev',
});

// =============================================================================
// Load Project-based Data
// =============================================================================

function loadProjectData(): CanonicalObject[] {
  const dataPath = path.join(__dirname, '../data/samples/project-based.json');
  const content = fs.readFileSync(dataPath, 'utf8');
  return JSON.parse(content) as CanonicalObject[];
}

// =============================================================================
// Generate GT Relations
// =============================================================================

interface GroundTruthRelation {
  from_id: string;
  to_id: string;
  relation_type: string;
  confidence: number;
}

function generateGroundTruthRelations(objects: CanonicalObject[]): GroundTruthRelation[] {
  const relations: GroundTruthRelation[] = [];

  // Group objects by project_id
  const projectGroups = new Map<string, CanonicalObject[]>();
  for (const obj of objects) {
    const projectId = obj.relations?.project_id;
    if (!projectId) {
      console.warn(`⚠️  Object ${obj.id} has no project_id, skipping`);
      continue;
    }

    if (!projectGroups.has(projectId)) {
      projectGroups.set(projectId, []);
    }
    projectGroups.get(projectId)!.push(obj);
  }

  console.log(`\n📊 Found ${projectGroups.size} projects\n`);

  // Generate pairwise relations within each project
  for (const [projectId, projectObjects] of projectGroups.entries()) {
    console.log(`🔗 Project: ${projectId} (${projectObjects.length} objects)`);

    let projectRelations = 0;
    for (let i = 0; i < projectObjects.length; i++) {
      for (let j = i + 1; j < projectObjects.length; j++) {
        const obj1 = projectObjects[i];
        const obj2 = projectObjects[j];

        relations.push({
          from_id: obj1.id,
          to_id: obj2.id,
          relation_type: 'project_related',
          confidence: 1.0,
        });

        projectRelations++;
      }
    }

    console.log(`  ✅ Generated ${projectRelations} relations`);
  }

  return relations;
}

// =============================================================================
// Save to Database
// =============================================================================

async function saveToDatabase(relations: GroundTruthRelation[]) {
  console.log(`\n💾 Saving ${relations.length} GT relations to database...`);

  // Clear existing GT relations
  await pool.query('DELETE FROM ground_truth_relations');
  console.log('  ✅ Cleared existing GT relations');

  // Insert new relations
  let inserted = 0;
  for (const rel of relations) {
    await pool.query(
      `INSERT INTO ground_truth_relations (from_id, to_id, relation_type, source, confidence, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW())`,
      [rel.from_id, rel.to_id, rel.relation_type, 'project_gen', rel.confidence]
    );
    inserted++;

    if (inserted % 50 === 0) {
      console.log(`  📝 Inserted ${inserted}/${relations.length} relations...`);
    }
  }

  console.log(`  ✅ Inserted ${inserted} GT relations`);
}

// =============================================================================
// Save to JSON
// =============================================================================

function saveToJSON(relations: GroundTruthRelation[]) {
  const outputPath = path.join(__dirname, '../data/ground-truth/project-based-gt.json');
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(relations, null, 2));
  console.log(`\n💾 Saved GT relations to: ${outputPath}`);
}

// =============================================================================
// Main
// =============================================================================

async function main() {
  console.log('🏗️  Generating Ground Truth Relations from Project Data\n');

  // Load data
  const objects = loadProjectData();
  console.log(`📦 Loaded ${objects.length} objects`);

  // Generate relations
  const relations = generateGroundTruthRelations(objects);
  console.log(`\n✅ Generated ${relations.length} GT relations total\n`);

  // Save to JSON
  saveToJSON(relations);

  // Save to database
  await saveToDatabase(relations);

  // Statistics
  console.log('\n📊 Statistics:');
  console.log(`  Objects: ${objects.length}`);
  console.log(`  GT Relations: ${relations.length}`);
  console.log(
    `  Density: ${((relations.length / ((objects.length * (objects.length - 1)) / 2)) * 100).toFixed(2)}%`
  );

  await pool.end();
}

if (require.main === module) {
  main().catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
}
