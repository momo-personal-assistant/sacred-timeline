#!/usr/bin/env tsx
/**
 * Ground Truth Benchmark Runner
 *
 * Runs all Ground Truth queries and saves results to the database
 * for display in the UI Benchmark Dashboard.
 *
 * Usage:
 *   pnpm tsx scripts/run-gt-benchmark.ts
 *   pnpm tsx scripts/run-gt-benchmark.ts --verbose
 */

import * as childProcess from 'child_process';

import * as dotenv from 'dotenv';

import { OpenAIEmbedder } from '@momo/embedding/openai-embedder';
import { RelationInferrer } from '@momo/graph';
import { Retriever } from '@momo/query/retriever';

import { createDb } from './lib/db';

dotenv.config();

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
};

function c(color: keyof typeof colors, text: string): string {
  return `${colors[color]}${text}${colors.reset}`;
}

interface GroundTruthQuery {
  id: number;
  query_text: string;
  scenario: string;
  description: string;
}

interface GroundTruthResult {
  canonical_object_id: string;
  relevance_score: number;
}

interface QueryBenchmarkResult {
  queryId: number;
  queryText: string;
  f1: number;
  precision: number;
  recall: number;
  expectedCount: number;
  foundCount: number;
  retrievalTimeMs: number;
  status: 'pass' | 'warning' | 'fail';
  details: {
    expected: string[];
    found: string[];
    missing: string[];
    extra: string[];
  };
}

function getGitCommit(): string | null {
  try {
    return childProcess
      .execSync('git rev-parse HEAD', { encoding: 'utf8' })
      .trim()
      .substring(0, 40);
  } catch {
    return null;
  }
}

async function main(): Promise<void> {
  const verbose = process.argv.includes('--verbose') || process.argv.includes('-v');
  const startTime = Date.now();

  console.log('\n' + '═'.repeat(60));
  console.log(c('bold', ' 🧪 GROUND TRUTH BENCHMARK'));
  console.log('═'.repeat(60) + '\n');

  if (!process.env.OPENAI_API_KEY) {
    console.error(c('red', 'Error: OPENAI_API_KEY not set'));
    process.exit(1);
  }

  const db = await createDb();
  const pool = (db as any).pool;

  try {
    // Initialize components
    const embedder = new OpenAIEmbedder({
      apiKey: process.env.OPENAI_API_KEY!,
      model: process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small',
    });

    const relationInferrer = new RelationInferrer({
      similarityThreshold: 0.85,
      keywordOverlapThreshold: 0.5,
      includeInferred: true,
    });

    const retriever = new Retriever(db, embedder, relationInferrer, {
      similarityThreshold: 0.35,
      chunkLimit: 10,
      includeRelations: true,
      relationDepth: 1,
    });

    // Fetch all ground truth queries
    const queriesResult = await pool.query(`
      SELECT id, query_text, scenario, description
      FROM ground_truth_queries
      ORDER BY id
    `);

    const queries: GroundTruthQuery[] = queriesResult.rows;

    if (queries.length === 0) {
      console.log(c('yellow', 'No ground truth queries found.'));
      console.log(c('dim', 'Add queries to the ground_truth_queries table first.'));
      return;
    }

    console.log(c('dim', `Running ${queries.length} benchmark queries...\n`));

    const results: QueryBenchmarkResult[] = [];

    // Run each query
    for (const query of queries) {
      // Get expected results for this query
      const expectedResult = await pool.query(
        'SELECT canonical_object_id, relevance_score FROM ground_truth_query_results WHERE query_id = $1',
        [query.id]
      );
      const expected: GroundTruthResult[] = expectedResult.rows;
      const expectedIds = expected.map((e) => e.canonical_object_id);

      // Execute retrieval
      const queryStart = Date.now();
      const retrieveResult = await retriever.retrieve(query.query_text);
      const retrievalTimeMs = Date.now() - queryStart;

      const retrievedIds = retrieveResult.objects.map((o) => o.id);
      const foundIds = retrievedIds.filter((id) => expectedIds.includes(id));
      const missingIds = expectedIds.filter((id) => !retrievedIds.includes(id));
      const extraIds = retrievedIds.filter((id) => !expectedIds.includes(id));

      // Calculate metrics
      const recall = expectedIds.length > 0 ? foundIds.length / expectedIds.length : 0;
      const precision = retrievedIds.length > 0 ? foundIds.length / retrievedIds.length : 0;
      const f1 = precision + recall > 0 ? (2 * (precision * recall)) / (precision + recall) : 0;

      // Determine status
      let status: 'pass' | 'warning' | 'fail';
      if (f1 >= 0.8) {
        status = 'pass';
      } else if (f1 >= 0.5) {
        status = 'warning';
      } else {
        status = 'fail';
      }

      const result: QueryBenchmarkResult = {
        queryId: query.id,
        queryText: query.query_text,
        f1,
        precision,
        recall,
        expectedCount: expectedIds.length,
        foundCount: foundIds.length,
        retrievalTimeMs,
        status,
        details: {
          expected: expectedIds,
          found: foundIds,
          missing: missingIds,
          extra: extraIds,
        },
      };

      results.push(result);

      // Print progress
      const statusIcon =
        status === 'pass'
          ? c('green', '✓')
          : status === 'warning'
            ? c('yellow', '~')
            : c('red', '✗');
      const f1Pct = (f1 * 100).toFixed(0);
      console.log(
        `  ${statusIcon} ${c('cyan', `#${query.id}`)} ${query.query_text.substring(0, 40).padEnd(40)} ${c('bold', f1Pct + '%')} (${retrievalTimeMs}ms)`
      );

      if (verbose && status !== 'pass') {
        console.log(
          c(
            'dim',
            `      Missing: ${missingIds.slice(0, 3).join(', ')}${missingIds.length > 3 ? '...' : ''}`
          )
        );
      }
    }

    // Calculate overall metrics
    const overallF1 = results.reduce((sum, r) => sum + r.f1, 0) / results.length;
    const overallPrecision = results.reduce((sum, r) => sum + r.precision, 0) / results.length;
    const overallRecall = results.reduce((sum, r) => sum + r.recall, 0) / results.length;
    const passedQueries = results.filter((r) => r.status === 'pass').length;
    const totalDurationMs = Date.now() - startTime;

    // Print summary
    console.log('\n' + '─'.repeat(60));
    console.log(c('bold', ' SUMMARY'));
    console.log('─'.repeat(60));
    console.log(`  Overall F1:    ${makeBar(overallF1)} ${(overallF1 * 100).toFixed(1)}%`);
    console.log(
      `  Precision:     ${makeBar(overallPrecision)} ${(overallPrecision * 100).toFixed(1)}%`
    );
    console.log(`  Recall:        ${makeBar(overallRecall)} ${(overallRecall * 100).toFixed(1)}%`);
    console.log(`  Passed:        ${passedQueries}/${results.length} queries`);
    console.log(`  Duration:      ${totalDurationMs}ms`);

    // Save to database
    console.log('\n' + c('dim', 'Saving results to database...'));

    const gitCommit = getGitCommit();

    // Insert benchmark run
    const runInsert = await pool.query(
      `
      INSERT INTO benchmark_runs (
        overall_f1, overall_precision, overall_recall,
        total_queries, passed_queries, duration_ms, git_commit
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id
      `,
      [
        overallF1,
        overallPrecision,
        overallRecall,
        results.length,
        passedQueries,
        totalDurationMs,
        gitCommit,
      ]
    );

    const runId = runInsert.rows[0].id;

    // Insert query results
    for (const result of results) {
      await pool.query(
        `
        INSERT INTO benchmark_query_results (
          run_id, query_id, query_text,
          f1_score, precision_score, recall_score,
          expected_count, found_count, retrieval_time_ms,
          status, details
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        `,
        [
          runId,
          result.queryId,
          result.queryText,
          result.f1,
          result.precision,
          result.recall,
          result.expectedCount,
          result.foundCount,
          result.retrievalTimeMs,
          result.status,
          JSON.stringify(result.details),
        ]
      );
    }

    console.log(c('green', `✓ Results saved (run #${runId})`));
    console.log(c('dim', '\nView results in UI: Benchmark tab'));
    console.log('═'.repeat(60) + '\n');
  } finally {
    await db.close();
  }
}

function makeBar(value: number): string {
  const width = 20;
  const filled = Math.round(value * width);
  const empty = width - filled;
  const color = value >= 0.8 ? 'green' : value >= 0.5 ? 'yellow' : 'red';
  return c(color, '█'.repeat(filled)) + c('dim', '░'.repeat(empty));
}

main().catch((error) => {
  console.error(c('red', 'Benchmark failed:'), error.message);
  process.exit(1);
});
