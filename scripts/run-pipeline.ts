#!/usr/bin/env tsx
/**
 * End-to-End Memory Pipeline
 *
 * Unified pipeline script that runs the complete memory processing flow:
 *   Ingest → Transform → Chunk → Embed → Cluster → Knowledge Graph → Temporal → Consolidation → Store
 *
 * Usage:
 *   pnpm tsx scripts/run-pipeline.ts ingest <scenario>
 *   pnpm tsx scripts/run-pipeline.ts query "<query>"
 *   pnpm tsx scripts/run-pipeline.ts e2e
 *
 * Examples:
 *   pnpm tsx scripts/run-pipeline.ts ingest normal
 *   pnpm tsx scripts/run-pipeline.ts query "authentication issues"
 *   pnpm tsx scripts/run-pipeline.ts e2e
 */

import * as fs from 'fs';
import * as path from 'path';

import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Pipeline imports
import { SimpleClusterer } from '@momo/clustering';
import { Consolidator } from '@momo/consolidation';
import { Chunker, OpenAIEmbedder } from '@momo/embedding';
import { RelationInferrer } from '@momo/graph';
import { SyntheticDataLoader } from '@momo/ingestion/synthetic-loader';
import { Retriever } from '@momo/query';
import { SimpleReasoner } from '@momo/reasoning';
import { TemporalProcessor } from '@momo/temporal';
import { SlackTransformer } from '@momo/transformers/slack-transformer';
import { UnifiedMemoryDB } from '@unified-memory/db';
import type { CanonicalObject } from '@unified-memory/db';
import { createCanonicalId } from '@unified-memory/shared/types/canonical';

// ============================================================
// Pipeline Configuration
// ============================================================

interface PipelineConfig {
  scenario: string;
  chunking: {
    strategy: 'fixed-size' | 'semantic' | 'relational';
    maxChunkSize: number;
    overlap: number;
  };
  embedding: {
    model: string;
    batchSize: number;
  };
  temporal: {
    maxAgeDays: number;
    recencyBoost: number;
  };
}

const DEFAULT_CONFIG: PipelineConfig = {
  scenario: 'normal',
  chunking: {
    strategy: 'semantic',
    maxChunkSize: 500,
    overlap: 50,
  },
  embedding: {
    model: 'text-embedding-3-small',
    batchSize: 100,
  },
  temporal: {
    maxAgeDays: 30,
    recencyBoost: 0.1,
  },
};

// ============================================================
// Statistics Types
// ============================================================

interface StageStats {
  duration: number;
  count: number;
}

interface IngestResult {
  success: boolean;
  stats: {
    startTime: number;
    totalDuration: number;
    objects: number;
    chunks: number;
    relations: number;
    clusters: number;
    stages: Record<string, StageStats>;
  };
}

interface QueryResult {
  success: boolean;
  response: {
    query: string;
    answer: string;
    sources: Array<{ id: string; title?: string; platform: string; relevanceScore: number }>;
    confidence: number;
  };
  stats: {
    totalDuration: number;
    retrievalTime: number;
  };
}

// ============================================================
// Database Configuration
// ============================================================

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
// Memory Pipeline Class
// ============================================================

class MemoryPipeline {
  private config: PipelineConfig;
  private db: UnifiedMemoryDB;
  private loader: SyntheticDataLoader;
  private slackTransformer: SlackTransformer;
  private chunker: Chunker;
  private embedder: OpenAIEmbedder;
  private clusterer: SimpleClusterer;
  private graphInferrer: RelationInferrer;
  private temporal: TemporalProcessor;
  private consolidator: Consolidator;
  private retriever!: Retriever;
  private reasoner: SimpleReasoner;
  private initialized: boolean = false;

  constructor(config: Partial<PipelineConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };

    // Initialize components
    this.db = new UnifiedMemoryDB(getDbConfig());
    this.loader = new SyntheticDataLoader();
    this.slackTransformer = new SlackTransformer({ workspace: 'momo' });
    this.chunker = new Chunker({
      strategy: this.config.chunking.strategy,
      maxChunkSize: this.config.chunking.maxChunkSize,
      overlap: this.config.chunking.overlap,
    });
    this.embedder = new OpenAIEmbedder({
      apiKey: process.env.OPENAI_API_KEY!,
      model: this.config.embedding.model,
    });
    this.clusterer = new SimpleClusterer({ strategy: 'platform' });
    this.graphInferrer = new RelationInferrer();
    this.temporal = new TemporalProcessor({
      maxAgeDays: this.config.temporal.maxAgeDays,
      recencyBoost: this.config.temporal.recencyBoost,
    });
    this.consolidator = new Consolidator({ useSemanticHash: true });
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
   * Reset the database by clearing all data
   */
  async reset(): Promise<void> {
    await this.initialize();
    console.log('[RESET] Clearing database...');
    const pool = (this.db as any).pool;
    await pool.query('TRUNCATE TABLE ground_truth_relations CASCADE');
    await pool.query('TRUNCATE TABLE chunks CASCADE');
    await pool.query('TRUNCATE TABLE canonical_objects CASCADE');
    console.log('[RESET] Database cleared');
  }

  // ============================================================
  // INGEST PIPELINE
  // ============================================================

  async ingest(scenario?: string): Promise<IngestResult> {
    await this.initialize();

    const targetScenario = scenario || this.config.scenario;
    console.log(`\n${'='.repeat(60)}`);
    console.log(`  INGEST PIPELINE: ${targetScenario}`);
    console.log(`${'='.repeat(60)}\n`);

    const stats: IngestResult['stats'] = {
      startTime: Date.now(),
      totalDuration: 0,
      objects: 0,
      chunks: 0,
      relations: 0,
      clusters: 0,
      stages: {},
    };

    try {
      // Step 1: Load raw data (Ingest)
      console.log('[1/9] Loading data...');
      const loadStart = Date.now();
      const dataset = this.loader.loadDataset(targetScenario);
      stats.stages.load = {
        duration: Date.now() - loadStart,
        count:
          dataset.slack_threads.length +
          dataset.zendesk_tickets.length +
          dataset.linear_issues.length,
      };
      console.log(
        `      Loaded ${stats.stages.load.count} raw objects (${stats.stages.load.duration}ms)`
      );

      // Step 2: Transform to canonical format
      console.log('[2/9] Transforming to canonical format...');
      const transformStart = Date.now();
      const canonicalObjects = this.transformToCanonical(dataset);
      stats.stages.transform = {
        duration: Date.now() - transformStart,
        count: canonicalObjects.length,
      };
      console.log(
        `      Transformed ${stats.stages.transform.count} objects (${stats.stages.transform.duration}ms)`
      );

      // Step 3: Chunk
      console.log('[3/9] Chunking...');
      const chunkStart = Date.now();
      const chunks = canonicalObjects.flatMap((obj) => this.chunker.chunk(obj));
      stats.stages.chunk = {
        duration: Date.now() - chunkStart,
        count: chunks.length,
      };
      console.log(`      Created ${chunks.length} chunks (${stats.stages.chunk.duration}ms)`);

      // Step 4: Embed
      console.log('[4/9] Generating embeddings...');
      const embedStart = Date.now();
      const embedResult = await this.embedder.embedBatch(chunks.map((c) => c.content));
      stats.stages.embed = {
        duration: Date.now() - embedStart,
        count: embedResult.results.length,
      };
      console.log(
        `      Generated ${embedResult.results.length} embeddings (${stats.stages.embed.duration}ms)`
      );

      // Step 5: Cluster (embedding 기반)
      console.log('[5/9] Clustering...');
      const clusterStart = Date.now();
      const { clusters, stats: clusterStats } = this.clusterer.cluster(canonicalObjects);
      stats.stages.cluster = {
        duration: Date.now() - clusterStart,
        count: clusters.length,
      };
      stats.clusters = clusterStats.totalClusters;
      console.log(`      Created ${clusters.length} clusters (${stats.stages.cluster.duration}ms)`);

      // Step 6: Build knowledge graph
      console.log('[6/9] Building knowledge graph...');
      const graphStart = Date.now();
      const relations = this.graphInferrer.inferAll(canonicalObjects);
      stats.stages.graph = {
        duration: Date.now() - graphStart,
        count: relations.length,
      };
      stats.relations = relations.length;
      console.log(
        `      Inferred ${relations.length} relations (${stats.stages.graph.duration}ms)`
      );

      // Step 7: Temporal processing
      console.log('[7/9] Temporal processing...');
      const temporalStart = Date.now();
      const sorted = this.temporal.sortByRecency(canonicalObjects);
      stats.stages.temporal = {
        duration: Date.now() - temporalStart,
        count: sorted.length,
      };
      console.log(`      Sorted by recency (${stats.stages.temporal.duration}ms)`);

      // Step 8: Consolidate (dedupe)
      console.log('[8/9] Consolidating (deduplication)...');
      const consolidateStart = Date.now();
      const { unique, stats: consolidateStats } = this.consolidator.deduplicate(sorted);
      stats.stages.consolidate = {
        duration: Date.now() - consolidateStart,
        count: unique.length,
      };
      console.log(
        `      Removed ${consolidateStats.duplicatesRemoved} duplicates (${stats.stages.consolidate.duration}ms)`
      );

      // Step 9: Store to DB
      console.log('[9/9] Storing to database...');
      const storeStart = Date.now();
      await this.storeToDatabase(unique, chunks, embedResult.results, relations);
      stats.stages.store = {
        duration: Date.now() - storeStart,
        count: unique.length + chunks.length,
      };
      console.log(`      Stored to DB (${stats.stages.store.duration}ms)`);

      // Summary
      stats.totalDuration = Date.now() - stats.startTime;
      stats.objects = unique.length;
      stats.chunks = chunks.length;

      console.log(`\n${'='.repeat(60)}`);
      console.log(`  INGEST COMPLETE`);
      console.log(`${'='.repeat(60)}`);
      console.log(`  Total time: ${stats.totalDuration}ms`);
      console.log(`  Objects: ${stats.objects}`);
      console.log(`  Chunks: ${stats.chunks}`);
      console.log(`  Relations: ${stats.relations}`);
      console.log(`  Clusters: ${stats.clusters}`);
      console.log(`${'='.repeat(60)}\n`);

      // Save stats to JSON file for UI consumption
      await this.saveStatsToFile(targetScenario, stats);

      return { success: true, stats };
    } catch (error) {
      console.error('\n[ERROR] Ingest failed:', error);
      throw error;
    }
  }

  private transformToCanonical(
    dataset: ReturnType<SyntheticDataLoader['loadDataset']>
  ): CanonicalObject[] {
    const workspace = 'momo';
    const canonicalObjects: CanonicalObject[] = [];

    // Transform Slack threads
    for (const thread of dataset.slack_threads) {
      const canonical = this.slackTransformer.transform(thread);
      canonicalObjects.push(canonical);
    }

    // Transform Zendesk tickets (simplified)
    for (const ticket of dataset.zendesk_tickets) {
      const canonical: CanonicalObject = {
        id: createCanonicalId('zendesk', workspace, 'ticket', ticket.id),
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
        },
        visibility: 'team',
      };
      canonicalObjects.push(canonical);
    }

    // Transform Linear issues (simplified)
    for (const issue of dataset.linear_issues) {
      const canonical: CanonicalObject = {
        id: createCanonicalId('linear', workspace, 'issue', issue.identifier),
        platform: 'linear',
        object_type: 'issue',
        title: issue.title,
        body: issue.description,
        actors: {
          created_by: issue.creator?.name,
          assignees: issue.assignee ? [issue.assignee.name] : [],
        },
        timestamps: {
          created_at: issue.createdAt,
          updated_at: issue.updatedAt,
        },
        relations: {},
        properties: {
          status: issue.state?.name,
          priority: issue.priority?.toString(),
          labels: issue.labels?.nodes?.map((l: { name: string }) => l.name),
        },
        visibility: 'team',
      };
      canonicalObjects.push(canonical);
    }

    return canonicalObjects;
  }

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
    }>
  ): Promise<void> {
    const pool = (this.db as any).pool;

    // Store canonical objects
    for (const obj of objects) {
      await this.db.createCanonicalObject(obj);
    }

    // Store chunks with embeddings using raw SQL
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
          this.config.embedding.model,
        ]
      );
    }

    // Store relations using raw SQL (filter out null to_id)
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
          'inferred',
          relation.confidence,
          relation.metadata ? JSON.stringify(relation.metadata) : null,
        ]
      );
    }
  }

  /**
   * Save pipeline stats to a JSON file for UI consumption
   */
  private async saveStatsToFile(scenario: string, stats: IngestResult['stats']): Promise<void> {
    const PIPELINE_STAGES = [
      { id: 'load', name: 'Load', label: 'Load Data' },
      { id: 'transform', name: 'Transform', label: 'Transform' },
      { id: 'chunk', name: 'Chunk', label: 'Chunk' },
      { id: 'embed', name: 'Embed', label: 'Embed' },
      { id: 'cluster', name: 'Cluster', label: 'Cluster' },
      { id: 'graph', name: 'Graph', label: 'KG Build' },
      { id: 'temporal', name: 'Temporal', label: 'Temporal' },
      { id: 'consolidate', name: 'Consolidate', label: 'Consolidate' },
      { id: 'store', name: 'Store', label: 'Store' },
    ];

    // Calculate cumulative start times and percentages
    let cumulativeTime = 0;
    const stages = PIPELINE_STAGES.map((stage) => {
      const stageData = stats.stages[stage.id] || { duration: 0, count: 0 };
      const startTime = cumulativeTime;
      cumulativeTime += stageData.duration;
      const percentage =
        stats.totalDuration > 0 ? (stageData.duration / stats.totalDuration) * 100 : 0;

      return {
        id: stage.id,
        name: stage.name,
        label: stage.label,
        status: 'completed',
        duration: stageData.duration,
        count: stageData.count,
        startTime,
        percentage,
      };
    });

    // Find bottleneck
    const bottleneckStage = stages.reduce(
      (max, stage) => (stage.percentage > max.percentage ? stage : max),
      stages[0]
    );

    const pipelineStats = {
      runId: `run-${Date.now()}`,
      scenario,
      startedAt: new Date(stats.startTime).toISOString(),
      completedAt: new Date().toISOString(),
      stages,
      totalDuration: stats.totalDuration,
      bottleneckStage: bottleneckStage.id,
      metrics: {
        objects: stats.objects,
        chunks: stats.chunks,
        relations: stats.relations,
        clusters: stats.clusters,
        duplicatesRemoved: 0,
      },
    };

    // Save to data directory
    const dataDir = path.join(__dirname, '..', 'data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    const statsPath = path.join(dataDir, 'pipeline-stats.json');
    fs.writeFileSync(statsPath, JSON.stringify(pipelineStats, null, 2));
    console.log(`[STATS] Saved pipeline stats to ${statsPath}`);
  }

  // ============================================================
  // QUERY PIPELINE
  // ============================================================

  async query(queryStr: string): Promise<QueryResult> {
    await this.initialize();

    console.log(`\n${'='.repeat(60)}`);
    console.log(`  QUERY: "${queryStr}"`);
    console.log(`${'='.repeat(60)}\n`);

    const startTime = Date.now();

    // Step 1: Retrieve with reranking
    console.log('[1/2] Retrieving...');
    const retrieveStart = Date.now();
    const retrieved = await this.retriever.retrieveWithReranking(queryStr);
    const retrievalTime = Date.now() - retrieveStart;
    console.log(
      `      Found ${retrieved.objects.length} objects, ${retrieved.chunks.length} chunks (${retrievalTime}ms)`
    );

    // Step 2: Reason
    console.log('[2/2] Generating response...');
    const reasonStart = Date.now();
    const response = this.reasoner.reason({
      query: queryStr,
      objects: retrieved.objects,
      chunks: retrieved.chunks.map((c) => ({
        id: c.id,
        content: c.content,
        canonical_object_id: c.canonical_object_id,
        similarity: c.similarity,
      })),
    });
    console.log(`      Generated response (${Date.now() - reasonStart}ms)`);

    // Output
    const totalDuration = Date.now() - startTime;
    console.log(`\n${'='.repeat(60)}`);
    console.log(`  RESPONSE`);
    console.log(`${'='.repeat(60)}`);
    console.log(response.answer);
    console.log(`\n  Confidence: ${(response.confidence * 100).toFixed(1)}%`);
    console.log(`  Sources: ${response.sources.length}`);
    console.log(`  Total time: ${totalDuration}ms`);
    console.log(`${'='.repeat(60)}\n`);

    return {
      success: true,
      response,
      stats: {
        totalDuration,
        retrievalTime,
      },
    };
  }

  // ============================================================
  // E2E TEST
  // ============================================================

  async e2e(): Promise<{ success: boolean; ingest: IngestResult; queries: QueryResult[] }> {
    console.log(`\n${'#'.repeat(60)}`);
    console.log(`  END-TO-END TEST`);
    console.log(`${'#'.repeat(60)}\n`);

    // 0. Reset database for clean test
    await this.reset();

    // 1. Ingest
    const ingestResult = await this.ingest('normal');

    // 2. Test queries
    const testQueries = ['authentication issues', 'billing problems', 'how to reset password'];

    const queryResults: QueryResult[] = [];
    for (const q of testQueries) {
      try {
        const result = await this.query(q);
        queryResults.push(result);
      } catch (error) {
        console.error(`Query failed: ${q}`, error);
        queryResults.push({
          success: false,
          response: {
            query: q,
            answer: 'Error',
            sources: [],
            confidence: 0,
          },
          stats: { totalDuration: 0, retrievalTime: 0 },
        });
      }
    }

    // 3. Summary
    const passedQueries = queryResults.filter((r) => r.success).length;
    console.log(`\n${'#'.repeat(60)}`);
    console.log(`  E2E TEST COMPLETE`);
    console.log(`${'#'.repeat(60)}`);
    console.log(`  Ingest: ${ingestResult.success ? 'PASS' : 'FAIL'}`);
    console.log(`  Queries: ${passedQueries}/${queryResults.length} passed`);
    console.log(`${'#'.repeat(60)}\n`);

    return {
      success: ingestResult.success && passedQueries === queryResults.length,
      ingest: ingestResult,
      queries: queryResults,
    };
  }
}

// ============================================================
// CLI Entry Point
// ============================================================

async function main(): Promise<void> {
  const [command, arg] = process.argv.slice(2);
  const pipeline = new MemoryPipeline();

  try {
    switch (command) {
      case 'ingest':
        await pipeline.ingest(arg);
        break;
      case 'query':
        if (!arg) {
          console.error('Usage: pnpm tsx scripts/run-pipeline.ts query "<query>"');
          process.exit(1);
        }
        await pipeline.query(arg);
        break;
      case 'e2e':
        await pipeline.e2e();
        break;
      case 'reset':
        await pipeline.reset();
        break;
      default:
        console.log(`
Memory Pipeline CLI

Usage:
  pnpm tsx scripts/run-pipeline.ts ingest [scenario]  - Run ingest pipeline
  pnpm tsx scripts/run-pipeline.ts query "<query>"    - Run query pipeline
  pnpm tsx scripts/run-pipeline.ts e2e                - Run end-to-end test
  pnpm tsx scripts/run-pipeline.ts reset              - Reset database

Scenarios: normal, sales_heavy, dev_heavy, stress
        `);
    }
  } finally {
    await pipeline.close();
  }
}

main().catch((error) => {
  console.error('Pipeline failed:', error);
  process.exit(1);
});
