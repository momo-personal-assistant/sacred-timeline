#!/usr/bin/env tsx
/**
 * Create minimal sample data for testing
 * Creates 10 canonical objects and 8 ground truth relations
 *
 * Usage:
 *   pnpm run sample-data                # Default: clears existing data
 *   pnpm run sample-data --dry-run      # Preview what will happen
 *   pnpm run sample-data --append       # Add without deleting existing data
 *   pnpm run sample-data --yes          # Skip confirmation prompts
 */

import { execSync } from 'child_process';
import * as readline from 'readline';

import * as dotenv from 'dotenv';

import { UnifiedMemoryDB } from '@unified-memory/db';

dotenv.config();

// Helper function to log activity
async function logActivity(
  pool: any,
  operationType: string,
  operationName: string,
  description: string,
  details: Record<string, any>,
  status: 'started' | 'completed' | 'failed' = 'completed'
): Promise<number> {
  const gitCommit = (() => {
    try {
      return execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
    } catch {
      return null;
    }
  })();

  const result = await pool.query(
    `INSERT INTO research_activity_log (
      operation_type, operation_name, description, status, triggered_by, details, git_commit
    ) VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7)
    RETURNING id`,
    [
      operationType,
      operationName,
      description,
      status,
      'script',
      JSON.stringify(details),
      gitCommit,
    ]
  );

  return result.rows[0].id;
}

// Parse command line arguments
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const appendMode = args.includes('--append');
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
  if (dryRun) {
    console.log('🔍 DRY RUN MODE - No changes will be made\n');
  }

  console.log('Creating sample data for testing...\n');

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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pool = (db as any).pool;

    console.log('✅ Database connected');

    // Get counts before deletion
    const beforeCounts = await pool.query(`
      SELECT
        (SELECT COUNT(*) FROM canonical_objects) as objects_count,
        (SELECT COUNT(*) FROM ground_truth_relations) as relations_count
    `);
    const beforeObjects = parseInt(beforeCounts.rows[0].objects_count);
    const beforeRelations = parseInt(beforeCounts.rows[0].relations_count);

    console.log(`\n📊 Current database state:`);
    console.log(`   ${beforeObjects} canonical objects`);
    console.log(`   ${beforeRelations} ground truth relations\n`);

    // Log script start
    if (!dryRun) {
      await logActivity(
        pool,
        'script_execution',
        'create-sample-data',
        `Started creating sample data (mode: ${appendMode ? 'append' : 'replace'})`,
        { action: 'start', mode: appendMode ? 'append' : 'replace' },
        'started'
      );
    }

    // Handle data deletion or append mode
    if (appendMode) {
      console.log('📌 APPEND MODE: Existing data will be preserved');
      console.log('   New objects will be added alongside existing data\n');
    } else if (beforeObjects > 0 || beforeRelations > 0) {
      if (dryRun) {
        console.log('🗑️  DRY RUN: Would delete:');
        console.log(`   - ${beforeRelations} ground truth relations`);
        console.log(`   - ${beforeObjects} canonical objects\n`);
      } else {
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

        // Log deletions
        await logActivity(
          pool,
          'data_delete',
          'DELETE ground_truth_relations',
          `Deleted ${beforeRelations} ground truth relations`,
          {
            action: 'DELETE',
            table: 'ground_truth_relations',
            rows_affected: beforeRelations,
            before_count: beforeRelations,
            after_count: 0,
          }
        );

        await logActivity(
          pool,
          'data_delete',
          'DELETE canonical_objects',
          `Deleted ${beforeObjects} canonical objects`,
          {
            action: 'DELETE',
            table: 'canonical_objects',
            rows_affected: beforeObjects,
            before_count: beforeObjects,
            after_count: 0,
          }
        );
      }
    } else {
      console.log('ℹ️  Database is empty - no data to delete\n');
    }

    // Create 10 canonical objects with proper schema
    const objects = [
      {
        id: 'test|workspace|user|alice',
        platform: 'test',
        object_type: 'user',
        title: 'Alice Johnson',
        body: 'Alice Johnson is a senior developer at TechCorp. She frequently reports bugs and feature requests.',
        actors: { created_by: 'system', updated_by: 'system' },
        timestamps: { created_at: '2025-11-24T10:00:00Z', updated_at: '2025-11-24T10:00:00Z' },
        properties: { role: 'developer', company: 'TechCorp' },
      },
      {
        id: 'test|workspace|user|bob',
        platform: 'test',
        object_type: 'user',
        title: 'Bob Smith',
        body: 'Bob Smith is a support agent. He handles customer tickets and escalates issues.',
        actors: { created_by: 'system', updated_by: 'system' },
        timestamps: { created_at: '2025-11-24T10:00:00Z', updated_at: '2025-11-24T10:00:00Z' },
        properties: { role: 'support', team: 'support' },
      },
      {
        id: 'test|workspace|company|techcorp',
        platform: 'test',
        object_type: 'company',
        title: 'TechCorp',
        body: 'TechCorp is an enterprise customer using our platform for team collaboration.',
        actors: { created_by: 'system', updated_by: 'system' },
        timestamps: { created_at: '2025-11-24T10:00:00Z', updated_at: '2025-11-24T10:00:00Z' },
        properties: { type: 'enterprise', size: 'large' },
      },
      {
        id: 'test|workspace|zendesk_ticket|1234',
        platform: 'zendesk',
        object_type: 'ticket',
        title: 'Login Error - TechCorp',
        body: 'Ticket #1234: Alice Johnson reported login errors. Assigned to Bob Smith.',
        actors: {
          created_by: 'test|workspace|user|alice',
          assignee: 'test|workspace|user|bob',
        },
        timestamps: { created_at: '2025-11-24T10:30:00Z', updated_at: '2025-11-24T10:30:00Z' },
        properties: {
          status: 'open',
          priority: 'high',
          company: 'test|workspace|company|techcorp',
        },
      },
      {
        id: 'test|workspace|slack_thread|thread1',
        platform: 'slack',
        object_type: 'thread',
        title: 'Login Bug Discussion',
        body: 'Slack thread discussing the login bug. Bob escalated to engineering team.',
        actors: {
          created_by: 'test|workspace|user|bob',
          participants: ['test|workspace|user|bob', 'test|workspace|user|charlie'],
        },
        timestamps: { created_at: '2025-11-24T11:00:00Z', updated_at: '2025-11-24T11:00:00Z' },
        properties: { channel: 'engineering' },
      },
      {
        id: 'test|workspace|linear_issue|eng123',
        platform: 'linear',
        object_type: 'issue',
        title: 'Fix authentication issue',
        body: 'ENG-123: Fix authentication issue reported by TechCorp. Assigned to engineering.',
        actors: {
          created_by: 'test|workspace|user|bob',
          assignee: 'test|workspace|user|charlie',
        },
        timestamps: { created_at: '2025-11-24T11:30:00Z', updated_at: '2025-11-24T11:30:00Z' },
        properties: { status: 'in_progress', priority: 'high', identifier: 'ENG-123' },
      },
      {
        id: 'test|workspace|user|charlie',
        platform: 'test',
        object_type: 'user',
        title: 'Charlie Chen',
        body: 'Charlie Chen is a developer working on authentication fixes.',
        actors: { created_by: 'system', updated_by: 'system' },
        timestamps: { created_at: '2025-11-24T10:00:00Z', updated_at: '2025-11-24T10:00:00Z' },
        properties: { role: 'developer', team: 'engineering' },
      },
      {
        id: 'test|workspace|slack_thread|thread2',
        platform: 'slack',
        object_type: 'thread',
        title: 'Auth Fix Update',
        body: 'Charlie posted an update: authentication fix has been deployed.',
        actors: {
          created_by: 'test|workspace|user|charlie',
          participants: ['test|workspace|user|charlie', 'test|workspace|user|bob'],
        },
        timestamps: { created_at: '2025-11-24T14:00:00Z', updated_at: '2025-11-24T14:00:00Z' },
        properties: { channel: 'engineering' },
      },
      {
        id: 'test|workspace|zendesk_ticket|1235',
        platform: 'zendesk',
        object_type: 'ticket',
        title: 'Follow-up on Login Issue',
        body: 'Ticket #1235: Bob followed up with Alice. Issue resolved.',
        actors: {
          created_by: 'test|workspace|user|bob',
          assignee: 'test|workspace|user|bob',
        },
        timestamps: { created_at: '2025-11-24T15:00:00Z', updated_at: '2025-11-24T15:00:00Z' },
        properties: { status: 'resolved', priority: 'normal' },
      },
      {
        id: 'test|workspace|company|dataflow',
        platform: 'test',
        object_type: 'company',
        title: 'DataFlow Inc',
        body: 'DataFlow Inc is a startup customer. Different from TechCorp.',
        actors: { created_by: 'system', updated_by: 'system' },
        timestamps: { created_at: '2025-11-24T10:00:00Z', updated_at: '2025-11-24T10:00:00Z' },
        properties: { type: 'startup', size: 'small' },
      },
    ];

    if (dryRun) {
      console.log(`🔍 DRY RUN: Would create ${objects.length} canonical objects:\n`);
      objects.forEach((obj, idx) => {
        console.log(`   ${idx + 1}. ${obj.platform}/${obj.object_type}: ${obj.title}`);
      });
      console.log();
    } else {
      const insertedIds: string[] = [];
      for (const obj of objects) {
        const result = await pool.query(
          `INSERT INTO canonical_objects (
            id, platform, object_type, title, body, actors, timestamps, properties
          ) VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8::jsonb)
          RETURNING id`,
          [
            obj.id,
            obj.platform,
            obj.object_type,
            obj.title,
            obj.body,
            JSON.stringify(obj.actors),
            JSON.stringify(obj.timestamps),
            JSON.stringify(obj.properties),
          ]
        );
        insertedIds.push(result.rows[0].id);
      }

      console.log(`✅ Created ${insertedIds.length} canonical objects`);

      // Log object insertions
      await logActivity(
        pool,
        'data_insert',
        'INSERT canonical_objects',
        `Created ${insertedIds.length} canonical objects`,
        {
          action: 'INSERT',
          table: 'canonical_objects',
          rows_affected: insertedIds.length,
          object_types: objects.reduce((acc: Record<string, number>, obj) => {
            acc[obj.object_type] = (acc[obj.object_type] || 0) + 1;
            return acc;
          }, {}),
        }
      );

      // Create ground truth relations
      const relations = [
        // Alice -> TechCorp (works_at)
        { from: 0, to: 2, type: 'works_at', source: 'explicit', confidence: 1.0 },
        // Ticket #1234 -> Alice (created_by)
        { from: 3, to: 0, type: 'created_by', source: 'explicit', confidence: 1.0 },
        // Ticket #1234 -> Bob (assigned_to)
        { from: 3, to: 1, type: 'assigned_to', source: 'explicit', confidence: 1.0 },
        // Slack thread -> Ticket (triggered_by)
        { from: 4, to: 3, type: 'triggered_by', source: 'inferred', confidence: 0.95 },
        // Linear issue -> Slack thread (resulted_in)
        { from: 4, to: 5, type: 'resulted_in', source: 'inferred', confidence: 1.0 },
        // Charlie -> Linear issue (assigned_to)
        { from: 5, to: 6, type: 'assigned_to', source: 'explicit', confidence: 1.0 },
        // Auth fix update -> Linear issue (related_to)
        { from: 7, to: 5, type: 'related_to', source: 'inferred', confidence: 0.9 },
        // Follow-up ticket -> Alice (related_to)
        { from: 8, to: 0, type: 'related_to', source: 'inferred', confidence: 0.85 },
      ];

      for (const rel of relations) {
        await pool.query(
          `INSERT INTO ground_truth_relations (from_id, to_id, relation_type, source, confidence, scenario)
         VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            insertedIds[rel.from],
            insertedIds[rel.to],
            rel.type,
            rel.source,
            rel.confidence,
            'normal',
          ]
        );
      }

      console.log(`✅ Created ${relations.length} ground truth relations`);

      // Log relation insertions
      await logActivity(
        pool,
        'data_insert',
        'INSERT ground_truth_relations',
        `Created ${relations.length} ground truth relations`,
        {
          action: 'INSERT',
          table: 'ground_truth_relations',
          rows_affected: relations.length,
          relation_types: relations.reduce((acc: Record<string, number>, rel) => {
            acc[rel.type] = (acc[rel.type] || 0) + 1;
            return acc;
          }, {}),
        }
      );

      console.log('\n✅ Sample data created successfully!\n');
      console.log('Summary:');
      console.log(`  - ${insertedIds.length} canonical objects`);
      console.log(`  - ${relations.length} ground truth relations`);
      console.log('\nNext steps:');
      console.log('  1. Go to Validation Metrics tab');
      console.log('  2. Click "Component Breakdown"');
      console.log('  3. You should see non-zero metrics now!');

      // Log script completion
      await logActivity(
        pool,
        'script_execution',
        'create-sample-data',
        'Completed creating sample data for testing',
        {
          action: 'complete',
          objects_created: insertedIds.length,
          relations_created: relations.length,
        }
      );
    }
  } catch (error) {
    console.error('Error:', error);

    // Try to log the error if we have a pool connection
    try {
      const pool = (db as any).pool;
      if (pool) {
        await logActivity(
          pool,
          'error',
          'create-sample-data',
          `Failed to create sample data: ${error instanceof Error ? error.message : String(error)}`,
          {
            error_message: error instanceof Error ? error.message : String(error),
            error_stack: error instanceof Error ? error.stack : undefined,
          },
          'failed'
        );
      }
    } catch {
      // Ignore logging errors
    }

    process.exit(1);
  } finally {
    await db.close();
  }
}

main();
