#!/usr/bin/env tsx
/**
 * Ingest Synthetic Data Script
 *
 * Purpose: Load synthetic graph datasets and ingest them into the database
 * This script completes the Week 1 end-to-end prototype for the RAG system.
 *
 * Usage:
 *   pnpm tsx scripts/ingest-synthetic.ts <scenario>
 *   pnpm tsx scripts/ingest-synthetic.ts all
 *
 * Examples:
 *   pnpm tsx scripts/ingest-synthetic.ts normal
 *   pnpm tsx scripts/ingest-synthetic.ts sales_heavy
 *   pnpm tsx scripts/ingest-synthetic.ts all
 */

import * as path from 'path';

import * as dotenv from 'dotenv';

import { RelationInferrer } from '@momo/graph';
import { SyntheticDataLoader } from '@momo/ingestion/synthetic-loader';
import { SlackTransformer } from '@momo/transformers/slack-transformer';
import { UnifiedMemoryDB } from '@unified-memory/db';
import type { CanonicalObject } from '@unified-memory/shared/types/canonical';
import { createCanonicalId } from '@unified-memory/shared/types/canonical';

// Load environment variables
dotenv.config();

interface IngestStats {
  scenario: string;
  canonical_objects: {
    slack_threads: number;
    zendesk_tickets: number;
    linear_issues: number;
    total: number;
  };
  ground_truth_relations: number;
  inferred_relations: number;
  duration_ms: number;
}

/**
 * Ingest a single scenario
 */
async function ingestScenario(
  db: UnifiedMemoryDB,
  loader: SyntheticDataLoader,
  scenario: string
): Promise<IngestStats> {
  const startTime = Date.now();

  console.log(`\n📦 Ingesting scenario: ${scenario}`);
  console.log('━'.repeat(60));

  // Load dataset
  console.log('📖 Loading dataset...');
  const dataset = loader.loadDataset(scenario);

  console.log(`   Companies: ${dataset.companies.length}`);
  console.log(`   Users: ${dataset.users.length}`);
  console.log(`   Slack threads: ${dataset.slack_threads.length}`);
  console.log(`   Zendesk tickets: ${dataset.zendesk_tickets.length}`);
  console.log(`   Linear issues: ${dataset.linear_issues.length}`);
  console.log(`   Ground truth relations: ${dataset.relations.length}`);

  const workspace = 'momo'; // Must match workspace in ground truth relations
  const canonicalObjects: CanonicalObject[] = [];
  const stats: IngestStats = {
    scenario,
    canonical_objects: {
      slack_threads: 0,
      zendesk_tickets: 0,
      linear_issues: 0,
      total: 0,
    },
    ground_truth_relations: 0,
    inferred_relations: 0,
    duration_ms: 0,
  };

  // ==========================================================================
  // 1. Transform and insert Linear issues FIRST (to build ID mapping)
  // ==========================================================================
  console.log('\n🔄 Transforming Linear issues...');

  // Build mapping from internal ID to identifier
  const issueIdToIdentifier = new Map<string, string>();

  for (const issue of dataset.linear_issues) {
    try {
      const canonical: CanonicalObject = {
        id: createCanonicalId('linear', workspace, 'issue', issue.identifier), // Use identifier (e.g., "DES-100") not id
        platform: 'linear',
        object_type: 'issue',
        title: issue.title,
        body: issue.description,
        actors: {
          created_by: `user|${workspace}|user|${issue.creator.id}`, // Use creator.id
          assignees: issue.assignee
            ? [`user|${workspace}|user|${issue.assignee.id}`] // Use assignee.id
            : undefined,
        },
        timestamps: {
          created_at: issue.createdAt,
          updated_at: issue.updatedAt,
        },
        relations: {
          parent_id: issue.parent
            ? createCanonicalId('linear', workspace, 'issue', issue.parent)
            : undefined,
        },
        properties: {
          status: issue.state?.name,
          priority: issue.priority,
          labels: issue.labels?.nodes?.map((l: any) => l.name) || [],
        },
        visibility: 'team',
        raw: issue as any,
      };

      await db.createCanonicalObject(canonical);
      canonicalObjects.push(canonical);
      stats.canonical_objects.linear_issues++;

      // Save mapping for later
      issueIdToIdentifier.set(issue.id, issue.identifier);
    } catch (error) {
      console.error(`   ❌ Failed to insert Linear issue ${issue.identifier}:`, error);
    }
  }

  console.log(`   ✅ Inserted ${stats.canonical_objects.linear_issues} Linear issues`);

  // ==========================================================================
  // 2. Transform and insert Slack threads (using ID mapping)
  // ==========================================================================
  console.log('\n🔄 Transforming Slack threads...');
  const slackTransformer = new SlackTransformer({ workspace });

  for (const thread of dataset.slack_threads) {
    try {
      const canonical = slackTransformer.transform(thread);

      // Resolve Linear issue ID to identifier if present
      if (thread.resulted_in_issue) {
        const resolvedIdentifier = issueIdToIdentifier.get(thread.resulted_in_issue);
        if (resolvedIdentifier) {
          canonical.relations = canonical.relations || {};
          canonical.relations.resulted_in_issue = createCanonicalId(
            'linear',
            workspace,
            'issue',
            resolvedIdentifier
          );
        }
      }

      await db.createCanonicalObject(canonical);
      canonicalObjects.push(canonical);
      stats.canonical_objects.slack_threads++;
    } catch (error) {
      console.error(`   ❌ Failed to insert Slack thread ${thread.ts}:`, error);
    }
  }

  console.log(`   ✅ Inserted ${stats.canonical_objects.slack_threads} Slack threads`);

  // ==========================================================================
  // 2. Transform and insert Zendesk tickets
  // ==========================================================================
  console.log('\n🔄 Transforming Zendesk tickets...');

  for (const ticket of dataset.zendesk_tickets) {
    try {
      const canonical: CanonicalObject = {
        id: createCanonicalId('zendesk', workspace, 'ticket', ticket.id),
        platform: 'zendesk',
        object_type: 'ticket',
        title: ticket.subject,
        body: ticket.description,
        actors: {
          created_by: `user|${workspace}|user|${ticket.requester_id}`,
          assignees: ticket.assignee_id
            ? [`user|${workspace}|user|${ticket.assignee_id}`]
            : undefined,
        },
        timestamps: {
          created_at: ticket.created_at,
          updated_at: ticket.updated_at,
        },
        properties: {
          status: ticket.status,
          priority: ticket.priority,
          labels: ticket.tags || [],
        },
        visibility: 'team',
        raw: ticket as any,
      };

      await db.createCanonicalObject(canonical);
      canonicalObjects.push(canonical);
      stats.canonical_objects.zendesk_tickets++;
    } catch (error) {
      console.error(`   ❌ Failed to insert Zendesk ticket ${ticket.id}:`, error);
    }
  }

  console.log(`   ✅ Inserted ${stats.canonical_objects.zendesk_tickets} Zendesk tickets`);

  stats.canonical_objects.total =
    stats.canonical_objects.slack_threads +
    stats.canonical_objects.zendesk_tickets +
    stats.canonical_objects.linear_issues;

  // ==========================================================================
  // 4. Insert ground truth relations
  // ==========================================================================
  console.log('\n🔗 Inserting ground truth relations...');

  // Get database pool to insert relations directly
  const pool = (db as any).pool;

  for (const relation of dataset.relations) {
    try {
      await pool.query(
        `
        INSERT INTO ground_truth_relations (
          from_id,
          to_id,
          relation_type,
          source,
          confidence,
          metadata,
          scenario
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (from_id, to_id, relation_type, scenario) DO NOTHING
        `,
        [
          relation.from_id,
          relation.to_id,
          relation.type,
          relation.source || 'explicit',
          relation.confidence || 1.0,
          relation.metadata ? JSON.stringify(relation.metadata) : null,
          scenario,
        ]
      );
      stats.ground_truth_relations++;
    } catch (error) {
      console.error(
        `   ❌ Failed to insert relation ${relation.from_id} -> ${relation.to_id}:`,
        error
      );
    }
  }

  console.log(`   ✅ Inserted ${stats.ground_truth_relations} ground truth relations`);

  // ==========================================================================
  // 5. Infer relations from canonical objects
  // ==========================================================================
  console.log('\n🧠 Inferring relations from canonical objects...');

  const inferrer = new RelationInferrer({
    similarityThreshold: 0.85,
    keywordOverlapThreshold: 0.5,
    includeInferred: true,
  });

  const inferredRelations = inferrer.inferAll(canonicalObjects);

  console.log(`   Found ${inferredRelations.length} total relations`);
  console.log(`   - Explicit: ${inferredRelations.filter((r) => r.source === 'explicit').length}`);
  console.log(`   - Computed: ${inferredRelations.filter((r) => r.source === 'computed').length}`);

  // Get relation stats
  const relationStats = inferrer.getStats(inferredRelations);
  console.log('\n📊 Relation Statistics:');
  console.log(`   By type:`);
  for (const [type, count] of Object.entries(relationStats.by_type)) {
    console.log(`      - ${type}: ${count}`);
  }
  console.log(`   Average confidence: ${relationStats.avg_confidence.toFixed(3)}`);

  stats.inferred_relations = inferredRelations.length;
  stats.duration_ms = Date.now() - startTime;

  console.log('\n━'.repeat(60));
  console.log(`✅ Scenario "${scenario}" ingested in ${(stats.duration_ms / 1000).toFixed(2)}s`);

  return stats;
}

/**
 * Main function
 */
async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.error('❌ Error: No scenario specified');
    console.log('\nUsage:');
    console.log('  pnpm tsx scripts/ingest-synthetic.ts <scenario>');
    console.log('  pnpm tsx scripts/ingest-synthetic.ts all');
    console.log('\nAvailable scenarios:');
    console.log('  - normal: Balanced mix of interactions');
    console.log('  - sales_heavy: High volume of customer support');
    console.log('  - dev_heavy: Engineering-focused interactions');
    console.log('  - pattern: Tests specific relation patterns');
    console.log('  - stress: Large-scale stress test');
    console.log('  - all: Ingest all scenarios');
    process.exit(1);
  }

  const requestedScenario = args[0];

  // Initialize database
  console.log('🔌 Connecting to database...');
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
    console.log('✅ Database connected');

    // Initialize loader
    const dataDir = path.join(process.cwd(), 'data', 'graph-datasets');
    const loader = new SyntheticDataLoader(dataDir);

    // Determine which scenarios to ingest
    let scenarios: string[];
    if (requestedScenario === 'all') {
      scenarios = loader.getAllScenarios();
      console.log(`\n📚 Ingesting all ${scenarios.length} scenarios`);
    } else {
      scenarios = [requestedScenario];
    }

    // Ingest each scenario
    const allStats: IngestStats[] = [];
    for (const scenario of scenarios) {
      const stats = await ingestScenario(db, loader, scenario);
      allStats.push(stats);
    }

    // Print summary
    console.log('\n\n' + '═'.repeat(60));
    console.log('📊 INGESTION SUMMARY');
    console.log('═'.repeat(60));

    for (const stats of allStats) {
      console.log(`\n${stats.scenario}:`);
      console.log(`  Canonical objects: ${stats.canonical_objects.total}`);
      console.log(`    - Slack threads: ${stats.canonical_objects.slack_threads}`);
      console.log(`    - Zendesk tickets: ${stats.canonical_objects.zendesk_tickets}`);
      console.log(`    - Linear issues: ${stats.canonical_objects.linear_issues}`);
      console.log(`  Ground truth relations: ${stats.ground_truth_relations}`);
      console.log(`  Inferred relations: ${stats.inferred_relations}`);
      console.log(`  Duration: ${(stats.duration_ms / 1000).toFixed(2)}s`);
    }

    const totalObjects = allStats.reduce((sum, s) => sum + s.canonical_objects.total, 0);
    const totalRelations = allStats.reduce((sum, s) => sum + s.ground_truth_relations, 0);
    const totalDuration = allStats.reduce((sum, s) => sum + s.duration_ms, 0);

    console.log('\n' + '─'.repeat(60));
    console.log('TOTAL:');
    console.log(`  Scenarios: ${allStats.length}`);
    console.log(`  Canonical objects: ${totalObjects}`);
    console.log(`  Ground truth relations: ${totalRelations}`);
    console.log(`  Total duration: ${(totalDuration / 1000).toFixed(2)}s`);
    console.log('═'.repeat(60));
  } catch (error) {
    console.error('\n❌ Ingestion failed:', error);
    process.exit(1);
  } finally {
    await db.close();
  }
}

// Run main function
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
