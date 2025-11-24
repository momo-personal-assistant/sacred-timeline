#!/usr/bin/env tsx
/**
 * Database State Inspector
 *
 * Shows current state of the research database including:
 * - Data counts (objects, relations, chunks, embeddings)
 * - Recent activities (last 10 operations)
 * - Data quality metrics
 * - Experiment summary
 *
 * Usage:
 *   pnpm run inspect         # Show current state
 *   pnpm run inspect --full  # Show detailed breakdown
 */

import * as dotenv from 'dotenv';

import { UnifiedMemoryDB } from '@unified-memory/db';

dotenv.config();

interface DBState {
  data_counts: {
    canonical_objects: number;
    ground_truth_relations: number;
    chunks: number;
    chunks_with_embeddings: number;
    experiments: number;
  };
  recent_activities: Array<{
    id: number;
    operation_type: string;
    operation_name: string;
    description: string;
    status: string;
    duration_ms: number | null;
    started_at: string;
  }>;
  experiments_summary: {
    total: number;
    with_results: number;
    best_f1_score: number | null;
    latest_experiment: string | null;
  };
  data_quality: {
    objects_with_embeddings: number;
    objects_without_embeddings: number;
    avg_chunks_per_object: number | null;
  };
}

async function inspectDatabaseState(showFull: boolean = false): Promise<void> {
  console.log('🔍 Database State Inspector\n');
  console.log('='.repeat(60));

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

    const state: DBState = {
      data_counts: {
        canonical_objects: 0,
        ground_truth_relations: 0,
        chunks: 0,
        chunks_with_embeddings: 0,
        experiments: 0,
      },
      recent_activities: [],
      experiments_summary: {
        total: 0,
        with_results: 0,
        best_f1_score: null,
        latest_experiment: null,
      },
      data_quality: {
        objects_with_embeddings: 0,
        objects_without_embeddings: 0,
        avg_chunks_per_object: null,
      },
    };

    // Get data counts
    const countsResult = await pool.query(`
      SELECT
        (SELECT COUNT(*) FROM canonical_objects WHERE deleted_at IS NULL) as canonical_objects,
        (SELECT COUNT(*) FROM ground_truth_relations) as ground_truth_relations,
        (SELECT COUNT(*) FROM chunks) as chunks,
        (SELECT COUNT(*) FROM chunks WHERE embedding IS NOT NULL) as chunks_with_embeddings,
        (SELECT COUNT(*) FROM experiments) as experiments
    `);
    state.data_counts = countsResult.rows[0];

    // Get recent activities (last 10)
    const activitiesResult = await pool.query(`
      SELECT id, operation_type, operation_name, description, status, duration_ms, started_at
      FROM research_activity_log
      ORDER BY started_at DESC
      LIMIT 10
    `);
    state.recent_activities = activitiesResult.rows;

    // Get experiments summary
    const experimentsResult = await pool.query(`
      SELECT
        COUNT(*) as total,
        COUNT(CASE WHEN r.f1_score IS NOT NULL THEN 1 END) as with_results,
        MAX(r.f1_score) as best_f1_score,
        (SELECT name FROM experiments ORDER BY created_at DESC LIMIT 1) as latest_experiment
      FROM experiments e
      LEFT JOIN experiment_results r ON e.id = r.experiment_id
    `);
    state.experiments_summary = {
      total: parseInt(experimentsResult.rows[0].total),
      with_results: parseInt(experimentsResult.rows[0].with_results),
      best_f1_score: experimentsResult.rows[0].best_f1_score
        ? parseFloat(experimentsResult.rows[0].best_f1_score)
        : null,
      latest_experiment: experimentsResult.rows[0].latest_experiment,
    };

    // Get data quality metrics
    const qualityResult = await pool.query(`
      SELECT
        COUNT(DISTINCT CASE WHEN c.canonical_object_id IS NOT NULL THEN co.id END) as objects_with_embeddings,
        COUNT(CASE WHEN c.canonical_object_id IS NULL THEN 1 END) as objects_without_embeddings,
        AVG(chunk_count) as avg_chunks_per_object
      FROM canonical_objects co
      LEFT JOIN (
        SELECT canonical_object_id, COUNT(*) as chunk_count
        FROM chunks
        GROUP BY canonical_object_id
      ) c ON co.id = c.canonical_object_id
      WHERE co.deleted_at IS NULL
    `);
    state.data_quality = {
      objects_with_embeddings: parseInt(qualityResult.rows[0].objects_with_embeddings || '0'),
      objects_without_embeddings: parseInt(qualityResult.rows[0].objects_without_embeddings || '0'),
      avg_chunks_per_object: qualityResult.rows[0].avg_chunks_per_object
        ? parseFloat(qualityResult.rows[0].avg_chunks_per_object)
        : null,
    };

    // Display results
    console.log('\n📊 DATA COUNTS');
    console.log('-'.repeat(60));
    console.log(`  Canonical Objects:       ${state.data_counts.canonical_objects}`);
    console.log(`  Ground Truth Relations:  ${state.data_counts.ground_truth_relations}`);
    console.log(`  Chunks:                  ${state.data_counts.chunks}`);
    console.log(`  Chunks with Embeddings:  ${state.data_counts.chunks_with_embeddings}`);
    console.log(`  Experiments:             ${state.data_counts.experiments}`);

    console.log('\n🧪 EXPERIMENTS SUMMARY');
    console.log('-'.repeat(60));
    console.log(`  Total Experiments:       ${state.experiments_summary.total}`);
    console.log(`  With Results:            ${state.experiments_summary.with_results}`);
    console.log(
      `  Best F1 Score:           ${state.experiments_summary.best_f1_score !== null ? (state.experiments_summary.best_f1_score * 100).toFixed(1) + '%' : 'N/A'}`
    );
    console.log(
      `  Latest Experiment:       ${state.experiments_summary.latest_experiment || 'N/A'}`
    );

    console.log('\n📈 DATA QUALITY');
    console.log('-'.repeat(60));
    console.log(`  Objects with Embeddings: ${state.data_quality.objects_with_embeddings}`);
    console.log(`  Objects without:         ${state.data_quality.objects_without_embeddings}`);
    console.log(
      `  Avg Chunks per Object:   ${state.data_quality.avg_chunks_per_object !== null ? state.data_quality.avg_chunks_per_object.toFixed(1) : 'N/A'}`
    );

    if (state.recent_activities.length > 0) {
      console.log('\n📜 RECENT ACTIVITIES (Last 10)');
      console.log('-'.repeat(60));
      for (const activity of state.recent_activities) {
        const statusIcon =
          activity.status === 'completed' ? '✅' : activity.status === 'failed' ? '❌' : '⏳';
        const duration = activity.duration_ms !== null ? ` (${activity.duration_ms}ms)` : '';
        const timestamp = new Date(activity.started_at).toLocaleString();
        console.log(`  ${statusIcon} ${activity.operation_type}: ${activity.operation_name}`);
        console.log(`     ${timestamp}${duration}`);
        if (activity.description && showFull) {
          console.log(`     ${activity.description}`);
        }
      }
    } else {
      console.log('\n📜 RECENT ACTIVITIES');
      console.log('-'.repeat(60));
      console.log('  No activities recorded yet');
    }

    // Show detailed breakdown if requested
    if (showFull) {
      console.log('\n🔎 DETAILED BREAKDOWN');
      console.log('-'.repeat(60));

      // Show objects by platform
      const platformsResult = await pool.query(`
        SELECT platform, object_type, COUNT(*) as count
        FROM canonical_objects
        WHERE deleted_at IS NULL
        GROUP BY platform, object_type
        ORDER BY platform, object_type
      `);

      if (platformsResult.rows.length > 0) {
        console.log('\n  Objects by Platform & Type:');
        for (const row of platformsResult.rows) {
          console.log(`    ${row.platform}/${row.object_type}: ${row.count}`);
        }
      }

      // Show relation types
      const relationsResult = await pool.query(`
        SELECT relation_type, source, COUNT(*) as count
        FROM ground_truth_relations
        GROUP BY relation_type, source
        ORDER BY relation_type, source
      `);

      if (relationsResult.rows.length > 0) {
        console.log('\n  Relations by Type & Source:');
        for (const row of relationsResult.rows) {
          console.log(`    ${row.relation_type} (${row.source}): ${row.count}`);
        }
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('✅ Inspection complete\n');

    // Warnings and recommendations
    const warnings: string[] = [];

    if (state.data_counts.canonical_objects === 0) {
      warnings.push(
        '⚠️  No canonical objects found. Run `pnpm run sample-data` to create test data.'
      );
    }

    if (state.data_counts.ground_truth_relations === 0) {
      warnings.push('⚠️  No ground truth relations found. Validation metrics will be 0%.');
    }

    if (
      state.data_quality.objects_without_embeddings > 0 &&
      state.data_counts.canonical_objects > 0
    ) {
      warnings.push(
        `⚠️  ${state.data_quality.objects_without_embeddings} objects have no embeddings. Run experiment to generate them.`
      );
    }

    if (warnings.length > 0) {
      console.log('⚠️  WARNINGS & RECOMMENDATIONS');
      console.log('-'.repeat(60));
      warnings.forEach((w) => console.log(w));
      console.log();
    }
  } catch (error) {
    console.error('❌ Error inspecting database:', error);
    process.exit(1);
  } finally {
    await db.close();
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const showFull = args.includes('--full');

inspectDatabaseState(showFull);
