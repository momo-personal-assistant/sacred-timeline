import { UnifiedMemoryDB } from '@unified-memory/db';
import * as dotenv from 'dotenv';
import { NextResponse } from 'next/server';

dotenv.config();

interface ActivityEvent {
  id: string;
  type:
    | 'paper_added'
    | 'paper_analyzed'
    | 'experiment_created'
    | 'paper_validated'
    | 'paper_rejected';
  timestamp: Date;
  title: string;
  description: string;
  metadata?: {
    paper_id?: string;
    paper_title?: string;
    experiment_id?: number;
    experiment_name?: string;
    f1_before?: number;
    f1_after?: number;
    f1_delta?: number;
    priority?: string;
    tags?: string[];
    expected_f1_gain?: number;
  };
}

export async function GET(request: Request) {
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
    const pool = (db as any).pool;

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    const days = parseInt(searchParams.get('days') || '7');

    const activities: ActivityEvent[] = [];

    // 1. Paper Added Events
    const papersAdded = await pool.query(
      `SELECT
        id,
        filename,
        title,
        priority,
        created_at
      FROM papers
      WHERE created_at >= NOW() - INTERVAL '${days} days'
      ORDER BY created_at DESC
      LIMIT $1`,
      [limit]
    );

    for (const paper of papersAdded.rows) {
      activities.push({
        id: `paper_added_${paper.id}`,
        type: 'paper_added',
        timestamp: paper.created_at,
        title: 'Paper Added',
        description: `${paper.title || paper.filename} (${paper.id})`,
        metadata: {
          paper_id: paper.id,
          paper_title: paper.title,
          priority: paper.priority,
        },
      });
    }

    // 2. Paper Analyzed Events
    const papersAnalyzed = await pool.query(
      `SELECT
        id,
        title,
        filename,
        tags,
        expected_f1_gain,
        priority,
        analyzed_at
      FROM papers
      WHERE analyzed_at IS NOT NULL
        AND analyzed_at >= NOW() - INTERVAL '${days} days'
      ORDER BY analyzed_at DESC
      LIMIT $1`,
      [limit]
    );

    for (const paper of papersAnalyzed.rows) {
      activities.push({
        id: `paper_analyzed_${paper.id}`,
        type: 'paper_analyzed',
        timestamp: paper.analyzed_at,
        title: 'Paper Analyzed',
        description: `${paper.title} (${paper.id})`,
        metadata: {
          paper_id: paper.id,
          paper_title: paper.title,
          tags: paper.tags,
          expected_f1_gain: paper.expected_f1_gain,
          priority: paper.priority,
        },
      });
    }

    // 3. Experiment Created Events
    const experiments = await pool.query(
      `SELECT
        e.id,
        e.name,
        e.created_at,
        e.paper_ids,
        AVG(er.f1_score) as avg_f1_score,
        STRING_AGG(DISTINCT p.title, ', ') as paper_titles
      FROM experiments e
      LEFT JOIN experiment_results er ON e.id = er.experiment_id
      LEFT JOIN LATERAL unnest(e.paper_ids) AS paper_id ON true
      LEFT JOIN papers p ON p.id = paper_id
      WHERE e.created_at >= NOW() - INTERVAL '${days} days'
      GROUP BY e.id, e.name, e.created_at, e.paper_ids
      ORDER BY e.created_at DESC
      LIMIT $1`,
      [limit]
    );

    for (const exp of experiments.rows) {
      activities.push({
        id: `experiment_${exp.id}`,
        type: 'experiment_created',
        timestamp: exp.created_at,
        title: 'Experiment Created',
        description: exp.name,
        metadata: {
          experiment_id: exp.id,
          experiment_name: exp.name,
          f1_after: exp.avg_f1_score,
          paper_title: exp.paper_titles,
          paper_id: exp.paper_ids?.[0],
        },
      });
    }

    // 4. Paper Status Changes (Validated/Rejected)
    const statusChanges = await pool.query(
      `SELECT
        id,
        title,
        filename,
        status,
        updated_at
      FROM papers
      WHERE status IN ('✅ Validated', '❌ Rejected')
        AND updated_at >= NOW() - INTERVAL '${days} days'
      ORDER BY updated_at DESC
      LIMIT $1`,
      [limit]
    );

    for (const paper of statusChanges.rows) {
      activities.push({
        id: `paper_status_${paper.id}`,
        type: paper.status === '✅ Validated' ? 'paper_validated' : 'paper_rejected',
        timestamp: paper.updated_at,
        title: paper.status === '✅ Validated' ? 'Paper Validated' : 'Paper Rejected',
        description: `${paper.title || paper.filename} (${paper.id})`,
        metadata: {
          paper_id: paper.id,
          paper_title: paper.title,
        },
      });
    }

    // Sort all activities by timestamp
    activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    // Limit to requested number
    const limitedActivities = activities.slice(0, limit);

    return NextResponse.json({
      activities: limitedActivities,
      total: limitedActivities.length,
      days,
    });
  } catch (error: any) {
    console.error('Activity feed error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch activity feed', details: error.message },
      { status: 500 }
    );
  } finally {
    await db.close();
  }
}
