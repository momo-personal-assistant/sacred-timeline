#!/usr/bin/env tsx
/**
 * Ingest Project-based Data into Database
 * This data is already in CanonicalObject format
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as readline from 'readline';

import * as dotenv from 'dotenv';

import { UnifiedMemoryDB } from '@unified-memory/db';
import type { CanonicalObject } from '@unified-memory/db';

dotenv.config();

// Parse command line arguments
const args = process.argv.slice(2);
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

async function main() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║       Ingest Project-based Data into Database             ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  const dataPath = path.join(process.cwd(), 'data', 'samples', 'project-based.json');

  // Check if file exists
  try {
    await fs.access(dataPath);
  } catch {
    console.error('❌ Error: project-based.json not found!');
    console.error('   Please run: npx tsx scripts/generate-samples/project-based.ts');
    process.exit(1);
  }

  // Read JSON file
  console.log('📖 Reading project-based data...');
  const objects = JSON.parse(await fs.readFile(dataPath, 'utf-8')) as CanonicalObject[];

  // Group by platform for stats
  const stats = objects.reduce(
    (acc, obj) => {
      acc[obj.platform] = (acc[obj.platform] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  console.log(`   Linear: ${stats.linear || 0}`);
  console.log(`   Zendesk: ${stats.zendesk || 0}`);
  console.log(`   Slack: ${stats.slack || 0}`);
  console.log(`   Total objects: ${objects.length}\n`);

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

    // Get current counts
    const beforeCounts = await pool.query(`
      SELECT
        (SELECT COUNT(*) FROM canonical_objects) as objects_count,
        (SELECT COUNT(*) FROM ground_truth_relations) as relations_count
    `);
    const beforeObjects = parseInt(beforeCounts.rows[0].objects_count);
    const beforeRelations = parseInt(beforeCounts.rows[0].relations_count);

    console.log(`📊 Current database state:`);
    console.log(`   ${beforeObjects} canonical objects`);
    console.log(`   ${beforeRelations} ground truth relations\n`);

    // Confirm deletion
    if (beforeObjects > 0 || beforeRelations > 0) {
      console.log(`⚠️  WARNING: This will DELETE all existing data:`);
      console.log(`   - ${beforeRelations} ground truth relations`);
      console.log(`   - ${beforeObjects} canonical objects\n`);

      const confirmed = await promptUser('Are you sure you want to continue?');
      if (!confirmed) {
        console.log('\n❌ Operation cancelled by user');
        await db.close();
        process.exit(0);
      }

      // Clear existing data in correct order (respect foreign keys)
      console.log('\n🗑️  Clearing existing data...');
      await pool.query('DELETE FROM ground_truth_relations');
      console.log('   ✅ Cleared ground truth relations');
      await pool.query('DELETE FROM canonical_objects');
      console.log('   ✅ Cleared canonical objects\n');
    }

    // Insert objects
    console.log('📝 Inserting project-based objects...');
    let insertedCount = 0;

    for (const obj of objects) {
      // Convert to the format expected by createCanonicalObject
      const canonical = {
        id: obj.id,
        platform: obj.platform,
        object_type: obj.object_type,
        title: obj.title,
        body: obj.content?.description || '',
        actors: obj.actors,
        timestamps: obj.timestamps,
        relations: obj.relations,
        properties: obj.properties,
        visibility: 'team' as const,
      };

      await db.createCanonicalObject(canonical);
      insertedCount++;

      if (insertedCount % 10 === 0) {
        console.log(`   Inserted ${insertedCount}/${objects.length} objects...`);
      }
    }

    console.log(`✅ Inserted ${objects.length} objects\n`);

    // Final counts
    const afterCounts = await pool.query(`
      SELECT
        (SELECT COUNT(*) FROM canonical_objects) as objects_count
    `);
    const afterObjects = parseInt(afterCounts.rows[0].objects_count);

    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║                  Ingestion Complete                        ║');
    console.log('╚════════════════════════════════════════════════════════════╝');
    console.log(`\n📊 Database state:`);
    console.log(`   Before: ${beforeObjects} objects`);
    console.log(`   After: ${afterObjects} objects`);
    console.log(`   Inserted: ${afterObjects - beforeObjects} objects\n`);

    console.log('💡 Next step: Run GT generation script');
    console.log('   npx tsx scripts/create-ground-truth-from-projects.ts\n');

    await db.close();
  } catch (error) {
    console.error('❌ Error during ingestion:', error);
    await db.close();
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
