#!/usr/bin/env tsx
/**
 * Query Script
 *
 * Purpose: Test the retrieval system with sample queries
 *
 * Usage:
 *   pnpm tsx scripts/query.ts "your query here"
 *
 * Examples:
 *   pnpm tsx scripts/query.ts "authentication issues"
 *   pnpm tsx scripts/query.ts "SSO project status"
 */

import * as dotenv from 'dotenv';

import { OpenAIEmbedder } from '@momo/embedding/openai-embedder';
import { RelationInferrer } from '@momo/graph';
import { Retriever } from '@momo/query/retriever';
import { UnifiedMemoryDB } from '@unified-memory/db';

// Load environment variables
dotenv.config();

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.error('Error: No query specified');
    console.log('\nUsage:');
    console.log('  pnpm tsx scripts/query.ts "your query here"');
    console.log('\nExamples:');
    console.log('  pnpm tsx scripts/query.ts "authentication issues"');
    console.log('  pnpm tsx scripts/query.ts "SSO project status"');
    process.exit(1);
  }

  const query = args.join(' ');

  // Validate OpenAI API key
  if (!process.env.OPENAI_API_KEY) {
    console.error('Error: OPENAI_API_KEY environment variable not set');
    console.error('Please set it in .env file');
    process.exit(1);
  }

  // Initialize database
  console.log('Connecting to database...');
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
    console.log('Database connected\n');

    // Initialize embedder
    const embedder = new OpenAIEmbedder({
      apiKey: process.env.OPENAI_API_KEY!,
      model: process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small',
    });

    // Initialize relation inferrer
    const relationInferrer = new RelationInferrer({
      similarityThreshold: 0.85,
      keywordOverlapThreshold: 0.5,
      includeInferred: true,
    });

    // Initialize retriever
    const retriever = new Retriever(db, embedder, relationInferrer, {
      // similarityThreshold: use default (0.35)
      chunkLimit: 10,
      includeRelations: true,
      relationDepth: 1,
    });

    // Execute query
    console.log(`Query: "${query}"`);
    console.log('='.repeat(60));
    console.log('\nRetrieving...\n');

    const result = await retriever.retrieve(query);

    // Display results
    console.log('RESULTS');
    console.log('='.repeat(60));
    console.log(`Retrieval time: ${result.stats.retrieval_time_ms}ms`);
    console.log(`Found ${result.stats.total_chunks} chunks`);
    console.log(`From ${result.stats.total_objects} objects`);
    console.log(`With ${result.stats.total_relations} relations`);

    console.log('\n' + '-'.repeat(60));
    console.log('TOP CHUNKS');
    console.log('-'.repeat(60));

    for (let i = 0; i < Math.min(5, result.chunks.length); i++) {
      const chunk = result.chunks[i];
      console.log(`\n${i + 1}. Similarity: ${chunk.similarity.toFixed(3)}`);
      console.log(`   Object: ${chunk.canonical_object_id}`);
      console.log(`   Method: ${chunk.method}`);
      if (chunk.metadata?.title) {
        console.log(`   Title: ${chunk.metadata.title}`);
      }
      console.log(`   Content: ${chunk.content.substring(0, 200)}...`);
    }

    console.log('\n' + '-'.repeat(60));
    console.log('RELATED OBJECTS');
    console.log('-'.repeat(60));

    for (const obj of result.objects.slice(0, 5)) {
      console.log(`\n- ${obj.id}`);
      console.log(`  Platform: ${obj.platform} | Type: ${obj.object_type}`);
      if (obj.title) {
        console.log(`  Title: ${obj.title}`);
      }
      if (obj.properties?.status) {
        console.log(`  Status: ${obj.properties.status}`);
      }
    }

    if (result.relations.length > 0) {
      console.log('\n' + '-'.repeat(60));
      console.log('KEY RELATIONS');
      console.log('-'.repeat(60));

      const relationsByType = new Map<string, number>();
      for (const rel of result.relations) {
        relationsByType.set(rel.type, (relationsByType.get(rel.type) || 0) + 1);
      }

      for (const [type, count] of relationsByType) {
        console.log(`- ${type}: ${count}`);
      }
    }

    console.log('\n' + '='.repeat(60));
  } catch (error) {
    console.error('\nQuery failed:', error);
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
