#!/usr/bin/env tsx
/**
 * Create minimal sample data for testing
 * Creates 10 canonical objects and 5 ground truth relations
 */

import * as dotenv from 'dotenv';

import { UnifiedMemoryDB } from '@unified-memory/db';

dotenv.config();

async function main() {
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

    // Clear existing data
    await pool.query('DELETE FROM ground_truth_relations');
    await pool.query('DELETE FROM canonical_objects');
    console.log('✅ Cleared existing data');

    // Create 10 canonical objects
    const objects = [
      {
        type: 'user',
        name: 'Alice Johnson',
        keywords: ['alice', 'johnson', 'customer', 'techcorp'],
        content:
          'Alice Johnson is a senior developer at TechCorp. She frequently reports bugs and feature requests.',
      },
      {
        type: 'user',
        name: 'Bob Smith',
        keywords: ['bob', 'smith', 'support', 'agent'],
        content: 'Bob Smith is a support agent. He handles customer tickets and escalates issues.',
      },
      {
        type: 'company',
        name: 'TechCorp',
        keywords: ['techcorp', 'enterprise', 'customer'],
        content: 'TechCorp is an enterprise customer using our platform for team collaboration.',
      },
      {
        type: 'zendesk_ticket',
        name: 'Login Error - TechCorp',
        keywords: ['login', 'error', 'techcorp', 'authentication'],
        content: 'Ticket #1234: Alice Johnson reported login errors. Assigned to Bob Smith.',
      },
      {
        type: 'slack_thread',
        name: 'Login Bug Discussion',
        keywords: ['login', 'bug', 'fix', 'engineering'],
        content: 'Slack thread discussing the login bug. Bob escalated to engineering team.',
      },
      {
        type: 'linear_issue',
        name: 'Fix authentication issue',
        keywords: ['auth', 'fix', 'bug', 'priority'],
        content: 'ENG-123: Fix authentication issue reported by TechCorp. Assigned to engineering.',
      },
      {
        type: 'user',
        name: 'Charlie Chen',
        keywords: ['charlie', 'chen', 'developer'],
        content: 'Charlie Chen is a developer working on authentication fixes.',
      },
      {
        type: 'slack_thread',
        name: 'Auth Fix Update',
        keywords: ['auth', 'fix', 'update', 'deployed'],
        content: 'Charlie posted an update: authentication fix has been deployed.',
      },
      {
        type: 'zendesk_ticket',
        name: 'Follow-up on Login Issue',
        keywords: ['login', 'resolved', 'followup'],
        content: 'Ticket #1235: Bob followed up with Alice. Issue resolved.',
      },
      {
        type: 'company',
        name: 'DataFlow Inc',
        keywords: ['dataflow', 'startup', 'customer'],
        content: 'DataFlow Inc is a startup customer. Different from TechCorp.',
      },
    ];

    const insertedIds: string[] = [];
    for (const obj of objects) {
      const result = await pool.query(
        `INSERT INTO canonical_objects (type, name, keywords, content, created_at)
         VALUES ($1, $2, $3, $4, NOW())
         RETURNING id`,
        [obj.type, obj.name, obj.keywords, obj.content]
      );
      insertedIds.push(result.rows[0].id);
    }

    console.log(`✅ Created ${insertedIds.length} canonical objects`);

    // Create ground truth relations
    const relations = [
      // Alice -> TechCorp (WORKS_AT)
      { from: 0, to: 2, type: 'WORKS_AT', confidence: 1.0 },
      // Ticket #1234 -> Alice (SUBMITTED_BY)
      { from: 3, to: 0, type: 'SUBMITTED_BY', confidence: 1.0 },
      // Ticket #1234 -> Bob (ASSIGNED_TO)
      { from: 3, to: 1, type: 'ASSIGNED_TO', confidence: 1.0 },
      // Slack thread -> Ticket (RELATED_TO)
      { from: 4, to: 3, type: 'RELATED_TO', confidence: 0.95 },
      // Linear issue -> Slack thread (CREATED_FROM)
      { from: 5, to: 4, type: 'CREATED_FROM', confidence: 1.0 },
      // Charlie -> Linear issue (ASSIGNED_TO)
      { from: 6, to: 5, type: 'ASSIGNED_TO', confidence: 1.0 },
      // Auth fix update -> Linear issue (RELATED_TO)
      { from: 7, to: 5, type: 'RELATED_TO', confidence: 0.9 },
      // Follow-up ticket -> Alice (RELATED_TO)
      { from: 8, to: 0, type: 'RELATED_TO', confidence: 0.85 },
    ];

    for (const rel of relations) {
      await pool.query(
        `INSERT INTO ground_truth_relations (from_id, to_id, type, confidence, created_at)
         VALUES ($1, $2, $3, $4, NOW())`,
        [insertedIds[rel.from], insertedIds[rel.to], rel.type, rel.confidence]
      );
    }

    console.log(`✅ Created ${relations.length} ground truth relations`);

    console.log('\n✅ Sample data created successfully!\n');
    console.log('Summary:');
    console.log(`  - ${insertedIds.length} canonical objects`);
    console.log(`  - ${relations.length} ground truth relations`);
    console.log('\nNext steps:');
    console.log('  1. Go to Validation Metrics tab');
    console.log('  2. Click "Component Breakdown"');
    console.log('  3. You should see non-zero metrics now!');
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  } finally {
    await db.close();
  }
}

main();
