#!/usr/bin/env tsx
/**
 * Ask Script - Interactive Query Testing with Ground Truth Comparison
 *
 * Purpose: Test queries against the persistent memory system and see
 *          exactly what's being retrieved, with optional ground truth scoring.
 *
 * Usage:
 *   pnpm tsx scripts/ask.ts "your query here"
 *   pnpm tsx scripts/ask.ts --list              # List available ground truth queries
 *   pnpm tsx scripts/ask.ts --gt 1              # Run ground truth query #1
 *
 * Examples:
 *   pnpm tsx scripts/ask.ts "API rate limit issues"
 *   pnpm tsx scripts/ask.ts "지난주 버그 수정된 PR은?"
 */

import * as dotenv from 'dotenv';

import { OpenAIEmbedder } from '@momo/embedding/openai-embedder';
import { RelationInferrer } from '@momo/graph';
import { Retriever } from '@momo/query/retriever';

import { createDb, withDb } from './lib/db';

dotenv.config();

// ANSI color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  red: '\x1b[31m',
  bgGreen: '\x1b[42m',
  bgRed: '\x1b[41m',
  bgYellow: '\x1b[43m',
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

async function listGroundTruthQueries(): Promise<void> {
  await withDb(async (db) => {
    const pool = (db as any).pool;
    const result = await pool.query(`
      SELECT
        q.id,
        q.query_text,
        q.scenario,
        q.description,
        COUNT(r.id) as expected_count
      FROM ground_truth_queries q
      LEFT JOIN ground_truth_query_results r ON q.id = r.query_id
      GROUP BY q.id, q.query_text, q.scenario, q.description
      ORDER BY q.id
    `);

    console.log('\n' + c('bold', '📋 Available Ground Truth Queries'));
    console.log('='.repeat(60));

    if (result.rows.length === 0) {
      console.log(c('dim', 'No ground truth queries found.'));
      console.log(c('dim', 'Run migrations to add sample queries.'));
      return;
    }

    for (const row of result.rows) {
      console.log(`\n${c('cyan', `#${row.id}`)} ${c('bold', row.query_text)}`);
      console.log(`   ${c('dim', row.description || 'No description')}`);
      console.log(
        `   ${c('dim', `Expected: ${row.expected_count} documents | Scenario: ${row.scenario}`)}`
      );
    }

    console.log('\n' + c('dim', 'Usage: pnpm tsx scripts/ask.ts --gt <id>'));
    console.log('');
  });
}

async function getGroundTruth(
  queryId: number
): Promise<{ query: GroundTruthQuery; expected: GroundTruthResult[] } | null> {
  return await withDb(async (db) => {
    const pool = (db as any).pool;

    const queryResult = await pool.query('SELECT * FROM ground_truth_queries WHERE id = $1', [
      queryId,
    ]);

    if (queryResult.rows.length === 0) {
      return null;
    }

    const expectedResult = await pool.query(
      'SELECT canonical_object_id, relevance_score FROM ground_truth_query_results WHERE query_id = $1',
      [queryId]
    );

    return {
      query: queryResult.rows[0],
      expected: expectedResult.rows,
    };
  });
}

async function runQuery(
  query: string,
  groundTruth?: { query: GroundTruthQuery; expected: GroundTruthResult[] }
): Promise<void> {
  if (!process.env.OPENAI_API_KEY) {
    console.error(c('red', 'Error: OPENAI_API_KEY not set'));
    process.exit(1);
  }

  const db = await createDb();

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

    // Header
    console.log('\n' + '═'.repeat(70));
    console.log(c('bold', ' 🔍 QUERY'));
    console.log('═'.repeat(70));
    console.log(`\n   ${c('cyan', query)}\n`);

    // Execute query
    const startTime = Date.now();
    const result = await retriever.retrieve(query);
    const elapsed = Date.now() - startTime;

    // Retrieved Context Section
    console.log('─'.repeat(70));
    console.log(c('bold', ' 📄 RETRIEVED CONTEXT'));
    console.log('─'.repeat(70));
    console.log(
      c(
        'dim',
        ` Found ${result.chunks.length} chunks from ${result.objects.length} objects in ${elapsed}ms\n`
      )
    );

    if (result.chunks.length === 0) {
      console.log(
        c(
          'yellow',
          '   No results found. Try lowering similarity threshold or check if data exists.\n'
        )
      );
    } else {
      for (let i = 0; i < Math.min(5, result.chunks.length); i++) {
        const chunk = result.chunks[i];
        const similarityPct = (chunk.similarity * 100).toFixed(1);
        const similarityColor =
          chunk.similarity >= 0.7 ? 'green' : chunk.similarity >= 0.5 ? 'yellow' : 'dim';

        console.log(
          `   ${c('bold', `${i + 1}.`)} ${c(similarityColor, `[${similarityPct}%]`)} ${c('cyan', chunk.canonical_object_id)}`
        );

        // Show title if available
        if (chunk.metadata?.title) {
          console.log(`      ${c('bold', chunk.metadata.title)}`);
        }

        // Show content preview
        const contentPreview = chunk.content.replace(/\n/g, ' ').substring(0, 120).trim();
        console.log(
          `      ${c('dim', contentPreview + (chunk.content.length > 120 ? '...' : ''))}`
        );
        console.log('');
      }
    }

    // Related Objects Section
    if (result.objects.length > 0) {
      console.log('─'.repeat(70));
      console.log(c('bold', ' 📦 RELATED OBJECTS'));
      console.log('─'.repeat(70) + '\n');

      for (const obj of result.objects.slice(0, 5)) {
        const typeIcon = getTypeIcon(obj.object_type);
        console.log(`   ${typeIcon} ${c('cyan', obj.id)}`);
        console.log(`      ${c('dim', `${obj.platform} | ${obj.object_type}`)}`);
        if (obj.title) {
          console.log(`      ${obj.title}`);
        }
        console.log('');
      }
    }

    // Ground Truth Comparison Section
    if (groundTruth) {
      console.log('─'.repeat(70));
      console.log(c('bold', ' ✓ GROUND TRUTH COMPARISON'));
      console.log('─'.repeat(70) + '\n');

      const retrievedIds = new Set(result.objects.map((o) => o.id));
      const expectedIds = groundTruth.expected.map((e) => e.canonical_object_id);

      let found = 0;

      console.log(c('dim', '   Expected documents:\n'));

      for (const expected of groundTruth.expected) {
        const isFound = retrievedIds.has(expected.canonical_object_id);
        const relevanceStars =
          '★'.repeat(expected.relevance_score) + '☆'.repeat(3 - expected.relevance_score);

        if (isFound) {
          found++;
          console.log(
            `   ${c('green', '✓')} ${expected.canonical_object_id} ${c('dim', relevanceStars)}`
          );
        } else {
          console.log(
            `   ${c('red', '✗')} ${expected.canonical_object_id} ${c('dim', relevanceStars)} ${c('red', '← MISSING')}`
          );
        }
      }

      // Extra retrieved (not in ground truth)
      const extras = result.objects.filter((o) => !expectedIds.includes(o.id));
      if (extras.length > 0) {
        console.log(c('dim', '\n   Additional retrieved (not in ground truth):\n'));
        for (const extra of extras.slice(0, 3)) {
          console.log(`   ${c('yellow', '?')} ${extra.id}`);
        }
        if (extras.length > 3) {
          console.log(c('dim', `   ... and ${extras.length - 3} more`));
        }
      }

      // Score Summary
      const recall = expectedIds.length > 0 ? found / expectedIds.length : 0;
      const precision = result.objects.length > 0 ? found / result.objects.length : 0;
      const f1 = precision + recall > 0 ? (2 * (precision * recall)) / (precision + recall) : 0;

      console.log('\n' + '─'.repeat(70));
      console.log(c('bold', ' 📊 SCORE'));
      console.log('─'.repeat(70) + '\n');

      const recallBar = makeProgressBar(recall, 20);
      const precisionBar = makeProgressBar(precision, 20);
      const f1Bar = makeProgressBar(f1, 20);

      console.log(
        `   Recall    ${recallBar} ${(recall * 100).toFixed(1)}% (${found}/${expectedIds.length} found)`
      );
      console.log(
        `   Precision ${precisionBar} ${(precision * 100).toFixed(1)}% (${found}/${result.objects.length} relevant)`
      );
      console.log(
        `   ${c('bold', 'F1 Score')}  ${f1Bar} ${c('bold', (f1 * 100).toFixed(1) + '%')}`
      );

      // Verdict
      console.log('');
      if (f1 >= 0.8) {
        console.log(`   ${c('green', '● GOOD')} - System found most expected documents`);
      } else if (f1 >= 0.5) {
        console.log(`   ${c('yellow', '● FAIR')} - Some expected documents missing`);
      } else {
        console.log(`   ${c('red', '● POOR')} - System missed most expected documents`);
      }
    }

    console.log('\n' + '═'.repeat(70) + '\n');
  } finally {
    await db.close();
  }
}

function getTypeIcon(type: string): string {
  const icons: Record<string, string> = {
    issue: '🐛',
    pr: '🔀',
    message: '💬',
    page: '📄',
    doc: '📝',
    ticket: '🎫',
  };
  return icons[type] || '📦';
}

function makeProgressBar(value: number, width: number): string {
  const filled = Math.round(value * width);
  const empty = width - filled;
  const color = value >= 0.8 ? 'green' : value >= 0.5 ? 'yellow' : 'red';
  return c(color, '█'.repeat(filled)) + c('dim', '░'.repeat(empty));
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log(`
${c('bold', 'Ask - Interactive Query Testing')}

${c('dim', 'Usage:')}
  pnpm tsx scripts/ask.ts "your query here"
  pnpm tsx scripts/ask.ts --list              # List ground truth queries
  pnpm tsx scripts/ask.ts --gt <id>           # Run ground truth query

${c('dim', 'Examples:')}
  pnpm tsx scripts/ask.ts "API rate limit issues"
  pnpm tsx scripts/ask.ts "버그 수정 PR 뭐 있어?"
  pnpm tsx scripts/ask.ts --gt 1
`);
    process.exit(0);
  }

  // Handle --list
  if (args[0] === '--list' || args[0] === '-l') {
    await listGroundTruthQueries();
    return;
  }

  // Handle --gt <id>
  if (args[0] === '--gt' || args[0] === '-g') {
    const queryId = parseInt(args[1], 10);
    if (isNaN(queryId)) {
      console.error(c('red', 'Error: Invalid query ID'));
      console.log(c('dim', 'Usage: pnpm tsx scripts/ask.ts --gt <id>'));
      process.exit(1);
    }

    const groundTruth = await getGroundTruth(queryId);
    if (!groundTruth) {
      console.error(c('red', `Error: Ground truth query #${queryId} not found`));
      console.log(c('dim', 'Use --list to see available queries'));
      process.exit(1);
    }

    console.log(c('dim', `\nRunning ground truth query #${queryId}...`));
    await runQuery(groundTruth.query.query_text, groundTruth);
    return;
  }

  // Regular query
  const query = args.join(' ');
  await runQuery(query);
}

main().catch((error) => {
  console.error(c('red', 'Fatal error:'), error.message);
  process.exit(1);
});
