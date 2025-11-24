import * as dotenv from 'dotenv';
import { NextResponse } from 'next/server';
import { Pool } from 'pg';

dotenv.config();

export async function GET() {
  const pool = new Pool({
    host: process.env.POSTGRES_HOST || 'localhost',
    port: parseInt(process.env.POSTGRES_PORT || '5434', 10),
    database: process.env.POSTGRES_DB || 'unified_memory',
    user: process.env.POSTGRES_USER || 'unified_memory',
    password: process.env.POSTGRES_PASSWORD || 'unified_memory_dev',
    max: parseInt(process.env.POSTGRES_MAX_CONNECTIONS || '20', 10),
  });

  try {
    // System Health Checks
    const dbHealth = await pool.query('SELECT version() as version');
    const postgresVersion = dbHealth.rows[0].version;

    // Data Counts
    const paperCount = await pool.query('SELECT COUNT(*) as count FROM papers');
    const chunkCount = await pool.query('SELECT COUNT(*) as count FROM chunks');
    const canonicalCount = await pool.query('SELECT COUNT(*) as count FROM canonical_objects');
    const gtCount = await pool.query('SELECT COUNT(*) as count FROM ground_truth_relations');
    const experimentsCount = await pool.query('SELECT COUNT(*) as count FROM experiments');

    // Latest experiment config (to show current settings)
    const latestExperiment = await pool.query(`
      SELECT config, created_at
      FROM experiments
      ORDER BY created_at DESC
      LIMIT 1
    `);

    // Check if embeddings are generated (sample check)
    const embeddingCheck = await pool.query(`
      SELECT COUNT(*) as count
      FROM chunks
      WHERE embedding IS NOT NULL
    `);

    const totalChunks = parseInt(chunkCount.rows[0].count, 10);
    const chunksWithEmbeddings = parseInt(embeddingCheck.rows[0].count, 10);

    await pool.end();

    // Parse current config from latest experiment
    const currentConfig = latestExperiment.rows.length > 0 ? latestExperiment.rows[0].config : null;

    // Build system status
    const systemStatus = {
      status: 'ok',
      timestamp: new Date().toISOString(),

      // Current Configuration
      configuration: {
        embedding: {
          model: process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small',
          dimensions: parseInt(process.env.VECTOR_DIMENSIONS || '1536', 10),
          provider: 'OpenAI',
        },
        chunking: currentConfig?.chunking || {
          strategy: 'fixed',
          maxChunkSize: 500,
          overlap: 50,
        },
        retrieval: currentConfig?.retrieval || {
          similarityThreshold: 0.7,
          chunkLimit: 10,
        },
        relationInference: currentConfig?.relationInference || {
          keywordOverlapThreshold: 0.65,
          useSemanticSimilarity: false,
        },
        lastUpdated: latestExperiment.rows.length > 0 ? latestExperiment.rows[0].created_at : null,
      },

      // Data Status
      data: {
        papers: parseInt(paperCount.rows[0].count, 10),
        chunks: totalChunks,
        canonicalObjects: parseInt(canonicalCount.rows[0].count, 10),
        groundTruthRelations: parseInt(gtCount.rows[0].count, 10),
        experiments: parseInt(experimentsCount.rows[0].count, 10),
      },

      // System Health
      health: {
        database: {
          status: 'connected',
          version: postgresVersion,
          host: process.env.POSTGRES_HOST || 'localhost',
          port: parseInt(process.env.POSTGRES_PORT || '5434', 10),
        },
        openai: {
          status: process.env.OPENAI_API_KEY ? 'configured' : 'missing',
          model: process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small',
        },
        embeddings: {
          status:
            chunksWithEmbeddings === totalChunks
              ? 'complete'
              : chunksWithEmbeddings > 0
                ? 'partial'
                : 'missing',
          coverage: totalChunks > 0 ? (chunksWithEmbeddings / totalChunks) * 100 : 0,
          chunksWithEmbeddings,
          totalChunks,
        },
      },
    };

    return NextResponse.json(systemStatus);
  } catch (error) {
    console.error('System status error:', error);
    await pool.end().catch(() => {
      /* ignore cleanup errors */
    });

    return NextResponse.json(
      {
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
