#!/usr/bin/env tsx
/**
 * Benchmark Runner
 *
 * Evaluates the memory system against a benchmark dataset
 *
 * Usage:
 *   pnpm tsx scripts/run-benchmark.ts                    # Run sample benchmark
 *   pnpm tsx scripts/run-benchmark.ts --skip-ingest      # Skip ingest (use existing data)
 *   pnpm tsx scripts/run-benchmark.ts --verbose          # Show detailed output
 */

import * as fs from 'fs';
import * as path from 'path';

import * as dotenv from 'dotenv';

dotenv.config();

import { Chunker, OpenAIEmbedder } from '@momo/embedding';
import { RelationInferrer } from '@momo/graph';
import { Retriever } from '@momo/query';
import { SimpleReasoner } from '@momo/reasoning';
import { UnifiedMemoryDB } from '@unified-memory/db';
import type { CanonicalObject } from '@unified-memory/db';
import {
  BenchmarkDataset,
  BenchmarkQuery,
  calculateMetrics,
  EvaluationReport,
  QueryResult,
  QueryType,
  SAMPLE_BENCHMARK,
} from '@unified-memory/shared';
import { createCanonicalId } from '@unified-memory/shared/types/canonical';
import { Platform } from '@unified-memory/shared/types/platform';

// ============================================================
// Configuration
// ============================================================

interface BenchmarkConfig {
  skipIngest: boolean;
  verbose: boolean;
  saveResults: boolean;
}

function parseArgs(): BenchmarkConfig {
  const args = process.argv.slice(2);
  return {
    skipIngest: args.includes('--skip-ingest'),
    verbose: args.includes('--verbose'),
    saveResults: !args.includes('--no-save'),
  };
}

function getDbConfig() {
  return {
    host: process.env.POSTGRES_HOST || 'localhost',
    port: parseInt(process.env.POSTGRES_PORT || '5434', 10),
    database: process.env.POSTGRES_DB || 'unified_memory',
    user: process.env.POSTGRES_USER || 'unified_memory',
    password: process.env.POSTGRES_PASSWORD || 'unified_memory_dev',
    maxConnections: parseInt(process.env.POSTGRES_MAX_CONNECTIONS || '20', 10),
    vectorDimensions: parseInt(process.env.VECTOR_DIMENSIONS || '1536', 10),
  };
}

// ============================================================
// Benchmark Runner
// ============================================================

class BenchmarkRunner {
  private db: UnifiedMemoryDB;
  private chunker: Chunker;
  private embedder: OpenAIEmbedder;
  private graphInferrer: RelationInferrer;
  private retriever!: Retriever;
  private reasoner: SimpleReasoner;
  private config: BenchmarkConfig;
  private initialized = false;

  constructor(config: BenchmarkConfig) {
    this.config = config;
    this.db = new UnifiedMemoryDB(getDbConfig());
    this.chunker = new Chunker({
      strategy: 'semantic',
      maxChunkSize: 500,
      overlap: 50,
    });
    this.embedder = new OpenAIEmbedder({
      apiKey: process.env.OPENAI_API_KEY!,
      model: 'text-embedding-3-small',
    });
    this.graphInferrer = new RelationInferrer();
    this.reasoner = new SimpleReasoner({ maxSources: 5 });
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;
    await this.db.initialize();
    this.retriever = new Retriever(this.db, this.embedder, this.graphInferrer);
    this.initialized = true;
  }

  async close(): Promise<void> {
    await this.db.close();
    this.initialized = false;
  }

  /**
   * Run the full benchmark
   */
  async run(dataset: BenchmarkDataset): Promise<EvaluationReport> {
    await this.initialize();

    console.log(`\n${'#'.repeat(60)}`);
    console.log(`  BENCHMARK: ${dataset.name}`);
    console.log(`${'#'.repeat(60)}`);
    console.log(`  Events: ${dataset.events.length}`);
    console.log(`  Queries: ${dataset.queries.length}`);
    console.log(`  Platforms: ${dataset.config.platforms.join(', ')}`);
    console.log(`${'#'.repeat(60)}\n`);

    // Step 1: Ingest benchmark events
    if (!this.config.skipIngest) {
      await this.ingestBenchmarkEvents(dataset);
    } else {
      console.log('[SKIP] Using existing data (--skip-ingest)\n');
    }

    // Step 2: Run all queries
    const results = await this.runAllQueries(dataset.queries);

    // Step 3: Calculate metrics
    const metrics = calculateMetrics(results);

    // Step 4: Generate report
    const report: EvaluationReport = {
      id: `eval-${Date.now()}`,
      benchmark_id: dataset.id,
      timestamp: new Date().toISOString(),
      results,
      metrics,
    };

    // Step 5: Print summary
    this.printSummary(report);

    // Step 6: Save results
    if (this.config.saveResults) {
      await this.saveReport(report);
    }

    return report;
  }

  /**
   * Ingest benchmark events into the memory system
   */
  private async ingestBenchmarkEvents(dataset: BenchmarkDataset): Promise<void> {
    console.log('[1/3] Ingesting benchmark events...');

    // Clear existing data
    const pool = (this.db as any).pool;
    await pool.query('TRUNCATE TABLE ground_truth_relations CASCADE');
    await pool.query('TRUNCATE TABLE chunks CASCADE');
    await pool.query('TRUNCATE TABLE canonical_objects CASCADE');

    // Transform events to canonical objects
    const canonicalObjects = this.transformEventsToCanonical(dataset);
    console.log(`      Transformed ${canonicalObjects.length} events to canonical objects`);

    // Chunk
    const chunks = canonicalObjects.flatMap((obj) => this.chunker.chunk(obj));
    console.log(`      Created ${chunks.length} chunks`);

    // Embed
    console.log('      Generating embeddings...');
    const embedResult = await this.embedder.embedBatch(chunks.map((c) => c.content));
    console.log(`      Generated ${embedResult.results.length} embeddings`);

    // Infer relations
    const relations = this.graphInferrer.inferAll(canonicalObjects);
    console.log(`      Inferred ${relations.length} relations`);

    // Store
    console.log('      Storing to database...');
    await this.storeToDatabase(canonicalObjects, chunks, embedResult.results, relations, pool);
    console.log('      Done!\n');
  }

  /**
   * Transform benchmark events to canonical objects
   */
  private transformEventsToCanonical(dataset: BenchmarkDataset): CanonicalObject[] {
    const canonicalObjects: CanonicalObject[] = [];

    for (const event of dataset.events) {
      let canonical: CanonicalObject;

      switch (event.platform) {
        case Platform.SLACK:
          canonical = {
            id: createCanonicalId('slack', event.workspace, 'message', event.id),
            platform: 'slack',
            object_type: 'message',
            title: `Message in #${event.context.channel_name || 'unknown'}`,
            body: event.context.text || '',
            actors: {
              created_by: event.actor,
              mentions: event.context.mentions || [],
            },
            timestamps: {
              created_at: event.timestamp,
              updated_at: event.timestamp,
            },
            relations: {},
            properties: {
              object_id: event.object_id, // Store original object_id for lookup
              channel_id: event.context.channel_id,
              channel_name: event.context.channel_name,
              action: event.action,
            },
            visibility: 'team',
          };
          break;

        case Platform.LINEAR: {
          // Include object_id in body for semantic search (e.g., "ENG-123" can be found)
          const linearBody = event.context.description
            ? `[${event.object_id}] ${event.context.description}`
            : `[${event.object_id}]`;
          canonical = {
            id: createCanonicalId('linear', event.workspace, 'issue', event.id), // Use event.id to avoid duplicates
            platform: 'linear',
            object_type: 'issue',
            title: `${event.object_id}: ${event.context.title || ''}`.trim(),
            body: linearBody,
            actors: {
              created_by: event.actor,
            },
            timestamps: {
              created_at: event.timestamp,
              updated_at: event.timestamp,
            },
            relations: {},
            properties: {
              object_id: event.object_id, // Store original object_id (ENG-123) for lookup
              status: event.context.status,
              priority: event.context.priority,
              labels: event.context.labels,
              action: event.action,
            },
            visibility: 'team',
          };
          break;
        }

        case Platform.GITHUB: {
          // Include object_id in body for semantic search (e.g., "PR-456" can be found)
          const githubBody = event.context.body
            ? `[${event.object_id}] ${event.context.body}`
            : `[${event.object_id}]`;
          canonical = {
            id: createCanonicalId('github', event.workspace, event.object_type, event.id), // Use event.id to avoid duplicates
            platform: 'github',
            object_type: event.object_type,
            title: `${event.object_id}: ${event.context.title || ''}`.trim(),
            body: githubBody,
            actors: {
              created_by: event.actor,
            },
            timestamps: {
              created_at: event.timestamp,
              updated_at: event.timestamp,
            },
            relations: event.context.target_id ? { linked_to: [event.context.target_id] } : {},
            properties: {
              object_id: event.object_id, // Store original object_id (PR-456) for lookup
              target_id: event.context.target_id, // For linking (e.g., review -> PR)
              labels: event.context.labels,
              repo: event.context.repo,
              branch: event.context.branch,
              action: event.action,
            },
            visibility: 'team',
          };
          break;
        }

        default:
          continue;
      }

      canonicalObjects.push(canonical);
    }

    return canonicalObjects;
  }

  /**
   * Store data to database
   */
  private async storeToDatabase(
    objects: CanonicalObject[],
    chunks: Array<{
      id: string;
      canonical_object_id: string;
      content: string;
      method: string;
      metadata: Record<string, unknown>;
      chunk_index: number;
    }>,
    embeddings: Array<{ embedding: number[]; tokens: number }>,
    relations: Array<{
      from_id: string;
      to_id: string;
      type: string;
      confidence: number;
      metadata?: Record<string, unknown>;
    }>,
    pool: any
  ): Promise<void> {
    // Store canonical objects
    for (const obj of objects) {
      await this.db.createCanonicalObject(obj);
    }

    // Store chunks with embeddings
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const embedding = embeddings[i];
      const embeddingVector = `[${embedding.embedding.join(',')}]`;

      await pool.query(
        `
        INSERT INTO chunks (id, canonical_object_id, chunk_index, content, method, metadata, embedding, embedding_model)
        VALUES ($1, $2, $3, $4, $5, $6, $7::vector(1536), $8)
        ON CONFLICT (id) DO NOTHING
        `,
        [
          chunk.id,
          chunk.canonical_object_id,
          chunk.chunk_index,
          chunk.content,
          chunk.method,
          JSON.stringify(chunk.metadata),
          embeddingVector,
          'text-embedding-3-small',
        ]
      );
    }

    // Store relations
    const validRelations = relations.filter((r) => r.from_id && r.to_id);
    for (const relation of validRelations) {
      await pool.query(
        `
        INSERT INTO ground_truth_relations (from_id, to_id, relation_type, source, confidence, metadata)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (from_id, to_id, relation_type, scenario) DO NOTHING
        `,
        [
          relation.from_id,
          relation.to_id,
          relation.type,
          'benchmark',
          relation.confidence,
          relation.metadata ? JSON.stringify(relation.metadata) : null,
        ]
      );
    }
  }

  /**
   * Run all queries and collect results
   */
  private async runAllQueries(queries: BenchmarkQuery[]): Promise<QueryResult[]> {
    console.log('[2/3] Running queries...');
    const results: QueryResult[] = [];

    for (let i = 0; i < queries.length; i++) {
      const query = queries[i];
      const result = await this.runSingleQuery(query, i + 1, queries.length);
      results.push(result);
    }

    console.log('');
    return results;
  }

  /**
   * Run a single query and evaluate
   */
  private async runSingleQuery(
    query: BenchmarkQuery,
    index: number,
    total: number
  ): Promise<QueryResult> {
    const startTime = Date.now();

    try {
      // Retrieve relevant context
      const retrieved = await this.retriever.retrieveWithReranking(query.question);

      // Generate response
      const response = this.reasoner.reason({
        query: query.question,
        objects: retrieved.objects,
        chunks: retrieved.chunks.map((c) => ({
          id: c.id,
          content: c.content,
          canonical_object_id: c.canonical_object_id,
          similarity: c.similarity,
        })),
      });

      const latencyMs = Date.now() - startTime;

      // Evaluate the response
      const evaluation = this.evaluateResponse(query, response);

      const statusIcon = evaluation.isCorrect ? '✓' : '✗';
      const difficultyBadge = query.difficulty || 'medium';

      if (this.config.verbose) {
        console.log(`      [${index}/${total}] ${statusIcon} ${query.id} (${query.type})`);
        console.log(`            Q: ${query.question}`);
        console.log(`            Expected: ${JSON.stringify(evaluation.expectedAnswer)}`);
        console.log(`            Got: ${response.answer.substring(0, 100)}...`);
      } else {
        const typeAbbr = this.getQueryTypeAbbr(query.type);
        console.log(
          `      [${index}/${total}] ${statusIcon} ${typeAbbr} ${difficultyBadge} - ${query.id} (${latencyMs}ms)`
        );
      }

      return {
        query_id: query.id,
        query_type: query.type,
        predicted_answer: response.answer,
        expected_answer: evaluation.expectedAnswer,
        is_correct: evaluation.isCorrect,
        partial_score: evaluation.partialScore,
        attribution: evaluation.attribution,
        latency_ms: latencyMs,
        retrieved_chunks: retrieved.chunks.map((c) => c.id),
      };
    } catch (error) {
      console.log(`      [${index}/${total}] ✗ ${query.id} - ERROR: ${error}`);
      return {
        query_id: query.id,
        query_type: query.type,
        predicted_answer: `Error: ${error}`,
        expected_answer: this.getExpectedAnswer(query),
        is_correct: false,
        latency_ms: Date.now() - startTime,
      };
    }
  }

  /**
   * Evaluate a response against expected answer
   */
  private evaluateResponse(
    query: BenchmarkQuery,
    response: { answer: string; sources: any[]; confidence: number }
  ): {
    isCorrect: boolean;
    partialScore?: number;
    expectedAnswer: unknown;
    attribution?: {
      sources_found: string[];
      sources_expected: string[];
      precision: number;
      recall: number;
    };
  } {
    const expectedAnswer = this.getExpectedAnswer(query);
    const predictedAnswer = response.answer.toLowerCase();

    // Simple string matching for now
    let isCorrect = false;
    let partialScore = 0;

    if (typeof expectedAnswer === 'string') {
      const expected = expectedAnswer.toLowerCase();
      // Check if expected answer is contained in response
      isCorrect = predictedAnswer.includes(expected);
      partialScore = isCorrect ? 1 : 0;

      // Partial match: check if any significant words match
      if (!isCorrect) {
        const expectedWords = expected.split(/\s+/).filter((w) => w.length > 3);
        const matchedWords = expectedWords.filter((w) => predictedAnswer.includes(w));
        partialScore = expectedWords.length > 0 ? matchedWords.length / expectedWords.length : 0;
        isCorrect = partialScore >= 0.5; // 50% match threshold
      }
    } else if (Array.isArray(expectedAnswer)) {
      // Check if any expected answer is in response
      const matches = expectedAnswer.filter((ans) =>
        predictedAnswer.includes(String(ans).toLowerCase())
      );
      partialScore = matches.length / expectedAnswer.length;
      isCorrect = partialScore >= 0.5;
    } else if (typeof expectedAnswer === 'number') {
      // Check if number appears in response
      isCorrect = predictedAnswer.includes(String(expectedAnswer));
      partialScore = isCorrect ? 1 : 0;
    }

    return {
      isCorrect,
      partialScore,
      expectedAnswer,
    };
  }

  /**
   * Extract expected answer from query
   */
  private getExpectedAnswer(query: BenchmarkQuery): unknown {
    switch (query.type) {
      case QueryType.SINGLE_HOP:
      case QueryType.MULTI_HOP:
      case QueryType.TEMPORAL:
      case QueryType.AGGREGATION:
      case QueryType.FILTERED_AGGREGATION:
      case QueryType.ATTRIBUTION:
      case QueryType.CROSS_SOURCE:
        return (query as any).expected_answer;
      case QueryType.RANKED:
        return (query as any).expected_answer;
      default:
        return 'unknown';
    }
  }

  /**
   * Get abbreviated query type for display
   */
  private getQueryTypeAbbr(type: QueryType): string {
    const abbrs: Record<QueryType, string> = {
      [QueryType.SINGLE_HOP]: 'SH',
      [QueryType.MULTI_HOP]: 'MH',
      [QueryType.TEMPORAL]: 'TM',
      [QueryType.AGGREGATION]: 'AG',
      [QueryType.FILTERED_AGGREGATION]: 'FA',
      [QueryType.RANKED]: 'RK',
      [QueryType.ATTRIBUTION]: 'AT',
      [QueryType.CROSS_SOURCE]: 'XS',
    };
    return abbrs[type] || '??';
  }

  /**
   * Print summary report
   */
  private printSummary(report: EvaluationReport): void {
    const { metrics } = report;
    const passed = report.results.filter((r) => r.is_correct).length;
    const total = report.results.length;

    console.log(`\n${'='.repeat(60)}`);
    console.log(`  BENCHMARK RESULTS`);
    console.log(`${'='.repeat(60)}`);
    console.log(`  Overall: ${passed}/${total} (${(metrics.overall_accuracy * 100).toFixed(1)}%)`);
    console.log(`${'='.repeat(60)}`);

    // Per-type breakdown
    console.log(`\n  By Query Type:`);
    for (const [type, accuracy] of Object.entries(metrics.accuracy_by_type)) {
      const typeResults = report.results.filter((r) => r.query_type === type);
      const typeCorrect = typeResults.filter((r) => r.is_correct).length;
      const bar = this.makeProgressBar(accuracy, 20);
      console.log(`    ${type.padEnd(20)} ${bar} ${typeCorrect}/${typeResults.length}`);
    }

    // Latency stats
    console.log(`\n  Latency:`);
    console.log(`    Average: ${metrics.avg_latency_ms.toFixed(0)}ms`);
    console.log(`    P50:     ${metrics.p50_latency_ms.toFixed(0)}ms`);
    console.log(`    P95:     ${metrics.p95_latency_ms.toFixed(0)}ms`);

    // Failed queries
    const failed = report.results.filter((r) => !r.is_correct);
    if (failed.length > 0) {
      console.log(`\n  Failed Queries (${failed.length}):`);
      for (const f of failed.slice(0, 5)) {
        console.log(`    - ${f.query_id} (${f.query_type})`);
      }
      if (failed.length > 5) {
        console.log(`    ... and ${failed.length - 5} more`);
      }
    }

    console.log(`\n${'='.repeat(60)}\n`);
  }

  /**
   * Create ASCII progress bar
   */
  private makeProgressBar(value: number, width: number): string {
    const filled = Math.round(value * width);
    const empty = width - filled;
    return `[${'█'.repeat(filled)}${'░'.repeat(empty)}] ${(value * 100).toFixed(0)}%`;
  }

  /**
   * Save report to file
   */
  private async saveReport(report: EvaluationReport): Promise<void> {
    const dataDir = path.join(__dirname, '..', 'data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    const reportPath = path.join(dataDir, 'benchmark-results.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`[SAVED] Results saved to ${reportPath}`);
  }
}

// ============================================================
// Main Entry Point
// ============================================================

async function main(): Promise<void> {
  const config = parseArgs();
  const runner = new BenchmarkRunner(config);

  try {
    // Use sample benchmark
    const dataset = SAMPLE_BENCHMARK;
    await runner.run(dataset);
  } finally {
    await runner.close();
  }
}

main().catch((error) => {
  console.error('Benchmark failed:', error);
  process.exit(1);
});
