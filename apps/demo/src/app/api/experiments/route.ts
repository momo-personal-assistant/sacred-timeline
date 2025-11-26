import { UnifiedMemoryDB } from '@unified-memory/db';
import * as dotenv from 'dotenv';
import { NextRequest, NextResponse } from 'next/server';

dotenv.config();

interface _Experiment {
  id: number;
  name: string;
  description?: string;
  created_at: string;
  embedding_model?: string;
  chunking_strategy?: string;
  similarity_threshold?: number;
  keyword_overlap_threshold?: number;
  chunk_limit?: number;
  config?: Record<string, unknown>;
  tags?: string[];
  is_baseline?: boolean;
}

interface _ExperimentResult {
  scenario: string;
  precision: number;
  recall: number;
  f1_score: number;
  true_positives: number;
  false_positives: number;
  false_negatives: number;
  ground_truth_total: number;
  inferred_total: number;
}

// GET /api/experiments - List all experiments
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const statusFilter = searchParams.get('status');

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
    const pool = (db as any).pool;

    // Build query with optional status filter
    const whereClause = statusFilter ? `WHERE e.status = $1` : '';
    const queryParams = statusFilter ? [statusFilter] : [];

    // Get all experiments with their results
    const result = await pool.query(
      `
      SELECT
        e.id,
        e.name,
        e.description,
        e.config,
        e.is_baseline,
        e.paper_ids,
        e.git_commit,
        e.created_at,
        e.status,
        e.config_file_path,
        e.run_started_at,
        e.run_completed_at,
        e.error_message,
        r.f1_score,
        r.precision,
        r.recall,
        r.true_positives,
        r.false_positives,
        r.false_negatives,
        r.retrieval_time_ms
      FROM experiments e
      LEFT JOIN experiment_results r ON e.id = r.experiment_id
      ${whereClause}
      ORDER BY
        CASE e.status
          WHEN 'draft' THEN 0
          WHEN 'running' THEN 1
          ELSE 2
        END,
        e.created_at DESC
    `,
      queryParams
    );

    const experiments = result.rows.map((row: any) => ({
      id: row.id,
      name: row.name,
      description: row.description,
      config: row.config,
      is_baseline: row.is_baseline,
      paper_ids: row.paper_ids || [],
      git_commit: row.git_commit,
      created_at: row.created_at,
      status: row.status || 'completed',
      config_file_path: row.config_file_path,
      run_started_at: row.run_started_at,
      run_completed_at: row.run_completed_at,
      error_message: row.error_message,
      results:
        row.f1_score !== null
          ? {
              f1_score: parseFloat(row.f1_score),
              precision: parseFloat(row.precision),
              recall: parseFloat(row.recall),
              true_positives: row.true_positives,
              false_positives: row.false_positives,
              false_negatives: row.false_negatives,
              retrieval_time_ms: row.retrieval_time_ms,
            }
          : null,
    }));

    await db.close();

    return NextResponse.json({
      experiments,
      total: experiments.length,
    });
  } catch (error: any) {
    console.error('Failed to fetch experiments:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch experiments' },
      { status: 500 }
    );
  }
}

// POST /api/experiments - Create new experiment and save results
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { experiment, results } = body;

    if (!experiment || !experiment.name) {
      return NextResponse.json({ error: 'Experiment name is required' }, { status: 400 });
    }

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
    const pool = (db as any).pool;

    // Insert experiment (supports draft mode)
    const status = experiment.status || 'completed';
    const experimentResult = await pool.query(
      `
      INSERT INTO experiments (
        name, description, embedding_model, chunking_strategy,
        similarity_threshold, keyword_overlap_threshold, chunk_limit,
        config, tags, is_baseline, status, config_file_path
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *
      `,
      [
        experiment.name,
        experiment.description || null,
        experiment.embedding_model || null,
        experiment.chunking_strategy || null,
        experiment.similarity_threshold || null,
        experiment.keyword_overlap_threshold || null,
        experiment.chunk_limit || null,
        experiment.config ? JSON.stringify(experiment.config) : null,
        experiment.tags || null,
        experiment.is_baseline || false,
        status,
        experiment.config_file_path || null,
      ]
    );

    const experimentId = experimentResult.rows[0].id;

    // Insert results if provided
    if (results && Array.isArray(results)) {
      for (const result of results) {
        await pool.query(
          `
          INSERT INTO experiment_results (
            experiment_id, scenario, precision, recall, f1_score,
            true_positives, false_positives, false_negatives,
            ground_truth_total, inferred_total, matched_relations
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
          ON CONFLICT (experiment_id, scenario)
          DO UPDATE SET
            precision = EXCLUDED.precision,
            recall = EXCLUDED.recall,
            f1_score = EXCLUDED.f1_score,
            true_positives = EXCLUDED.true_positives,
            false_positives = EXCLUDED.false_positives,
            false_negatives = EXCLUDED.false_negatives,
            ground_truth_total = EXCLUDED.ground_truth_total,
            inferred_total = EXCLUDED.inferred_total,
            matched_relations = EXCLUDED.matched_relations,
            created_at = NOW()
          `,
          [
            experimentId,
            result.scenario,
            result.precision,
            result.recall,
            result.f1_score,
            result.true_positives,
            result.false_positives,
            result.false_negatives,
            result.ground_truth_total,
            result.inferred_total,
            result.matched_relations ? JSON.stringify(result.matched_relations) : null,
          ]
        );
      }
    }

    await db.close();

    return NextResponse.json({
      success: true,
      experiment: experimentResult.rows[0],
    });
  } catch (error: any) {
    console.error('Failed to create experiment:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create experiment' },
      { status: 500 }
    );
  }
}
