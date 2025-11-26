#!/usr/bin/env tsx
/**
 * Ingest Generated Samples into Database
 *
 * Reads JSON files from data/samples/ and inserts them as canonical_objects
 *
 * Usage:
 *   pnpm tsx scripts/ingest-generated-samples.ts
 *   pnpm tsx scripts/ingest-generated-samples.ts --dry-run
 *   pnpm tsx scripts/ingest-generated-samples.ts --yes
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as readline from 'readline';

import * as dotenv from 'dotenv';

import { UnifiedMemoryDB } from '@unified-memory/db';
import { createCanonicalId } from '@unified-memory/shared/types/canonical';

dotenv.config();

// Types for generated samples
interface LinearIssue {
  identifier: string;
  title: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  state: { name: string };
  priority: number;
  creator: { name: string; email: string };
  assignee: { name: string; email: string } | null;
  labels: { nodes: Array<{ name: string }> };
  comments: { nodes: Array<{ body: string; createdAt: string; user: { name: string } }> };
  parent: { identifier: string } | null;
  archivedAt: string | null;
}

interface ZendeskTicket {
  id: number;
  subject: string;
  description: string;
  status: string;
  priority: string;
  created_at: string;
  updated_at: string;
  requester_id: string;
  assignee_id: string | null;
  tags: string[];
  comments: Array<{
    body: string;
    created_at: string;
    author_id: string;
    attachments?: Array<{ filename: string; content_type: string; size: number }>;
  }>;
  satisfaction_rating?: { score: string; comment: string } | null;
}

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

async function main() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║        Ingest Generated Samples into Database             ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  if (dryRun) {
    console.log('🔍 DRY RUN MODE - No changes will be made\n');
  }

  const dataDir = path.join(process.cwd(), 'data', 'samples');

  // Check if files exist
  const linearPath = path.join(dataDir, 'linear.json');
  const zendeskPath = path.join(dataDir, 'zendesk.json');

  try {
    await fs.access(linearPath);
    await fs.access(zendeskPath);
  } catch {
    console.error('❌ Error: Sample data files not found!');
    console.error('   Please run: pnpm run generate:samples');
    process.exit(1);
  }

  // Read JSON files
  console.log('📖 Reading sample data files...');
  const linearData = JSON.parse(await fs.readFile(linearPath, 'utf-8')) as LinearIssue[];
  const zendeskData = JSON.parse(await fs.readFile(zendeskPath, 'utf-8')) as ZendeskTicket[];

  console.log(`   Linear issues: ${linearData.length}`);
  console.log(`   Zendesk tickets: ${zendeskData.length}`);
  console.log(`   Total objects: ${linearData.length + zendeskData.length}\n`);

  if (dryRun) {
    console.log('✅ DRY RUN: Would process these files');
    console.log('   (no database changes made)');
    return;
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

      // Clear existing data
      await pool.query('DELETE FROM ground_truth_relations');
      await pool.query('DELETE FROM canonical_objects');
      console.log('✅ Cleared existing data\n');
    }

    // Transform and insert Linear issues
    console.log('📝 Inserting Linear issues...');
    const workspace = 'momo';
    let insertedCount = 0;

    for (const issue of linearData) {
      const canonicalId = createCanonicalId('linear', workspace, 'issue', issue.identifier);

      const canonical = {
        id: canonicalId,
        platform: 'linear',
        object_type: 'issue',
        title: issue.title,
        body: issue.description,
        actors: {
          created_by: issue.creator.email,
          assignees: issue.assignee ? [issue.assignee.email] : [],
        },
        timestamps: {
          created_at: issue.createdAt,
          updated_at: issue.updatedAt,
        },
        relations: {},
        properties: {
          state: issue.state.name,
          priority: issue.priority,
          labels: issue.labels.nodes.map((l) => l.name),
          comments_count: issue.comments.nodes.length,
          parent: issue.parent?.identifier || null,
          archived: issue.archivedAt !== null,
        },
        visibility: 'team' as const,
      };

      await db.createCanonicalObject(canonical);
      insertedCount++;

      if (insertedCount % 10 === 0) {
        console.log(`   Inserted ${insertedCount}/${linearData.length} issues...`);
      }
    }

    console.log(`✅ Inserted ${linearData.length} Linear issues\n`);

    // Transform and insert Zendesk tickets
    console.log('📝 Inserting Zendesk tickets...');
    insertedCount = 0;

    for (const ticket of zendeskData) {
      const canonicalId = createCanonicalId('zendesk', workspace, 'ticket', ticket.id.toString());

      const canonical = {
        id: canonicalId,
        platform: 'zendesk',
        object_type: 'ticket',
        title: ticket.subject,
        body: ticket.description,
        actors: {
          created_by: ticket.requester_id,
          assignees: ticket.assignee_id ? [ticket.assignee_id] : [],
        },
        timestamps: {
          created_at: ticket.created_at,
          updated_at: ticket.updated_at,
        },
        relations: {},
        properties: {
          status: ticket.status,
          priority: ticket.priority,
          tags: ticket.tags,
          comments_count: ticket.comments.length,
          has_attachments: ticket.comments.some((c) => c.attachments && c.attachments.length > 0),
          satisfaction_rating: ticket.satisfaction_rating?.score || null,
        },
        visibility: 'team' as const,
      };

      await db.createCanonicalObject(canonical);
      insertedCount++;

      if (insertedCount % 10 === 0) {
        console.log(`   Inserted ${insertedCount}/${zendeskData.length} tickets...`);
      }
    }

    console.log(`✅ Inserted ${zendeskData.length} Zendesk tickets\n`);

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
