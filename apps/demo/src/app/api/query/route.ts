import { OpenAIEmbedder } from '@momo/embedding';
import { RelationInferrer } from '@momo/graph';
import { Retriever } from '@momo/query';
import { UnifiedMemoryDB } from '@unified-memory/db';
import * as dotenv from 'dotenv';
import { NextRequest, NextResponse } from 'next/server';

dotenv.config();

export async function POST(request: NextRequest) {
  try {
    const { query } = await request.json();

    if (!query || typeof query !== 'string') {
      return NextResponse.json({ error: 'Query parameter is required' }, { status: 400 });
    }

    // Validate OpenAI API key
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: 'OPENAI_API_KEY not configured' }, { status: 500 });
    }

    // Initialize database
    const db = new UnifiedMemoryDB({
      host: process.env.POSTGRES_HOST || 'localhost',
      port: parseInt(process.env.POSTGRES_PORT || '5434', 10),
      database: process.env.POSTGRES_DB || 'unified_memory',
      user: process.env.POSTGRES_USER || 'unified_memory',
      password: process.env.POSTGRES_PASSWORD || 'unified_memory_dev',
      maxConnections: parseInt(process.env.POSTGRES_MAX_CONNECTIONS || '20', 10),
      vectorDimensions: parseInt(process.env.VECTOR_DIMENSIONS || '1536', 10),
    });

    await db.initialize();

    // Initialize embedder
    const embedder = new OpenAIEmbedder({
      apiKey: process.env.OPENAI_API_KEY!,
      model: process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small',
    });

    // Initialize relation inferrer
    const relationInferrer = new RelationInferrer({
      similarityThreshold: 0.85,
      keywordOverlapThreshold: 0.65,
      includeInferred: true,
    });

    // Initialize retriever
    const retriever = new Retriever(db, embedder, relationInferrer, {
      chunkLimit: 10,
      includeRelations: true,
      relationDepth: 1,
    });

    // Execute query
    const result = await retriever.retrieve(query);

    await db.close();

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Query failed:', error);
    return NextResponse.json({ error: error.message || 'Query failed' }, { status: 500 });
  }
}
