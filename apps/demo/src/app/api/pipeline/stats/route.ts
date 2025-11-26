import * as fs from 'fs/promises';
import * as path from 'path';

import { NextResponse } from 'next/server';

// Path to the pipeline stats file (written by run-pipeline.ts)
const STATS_FILE_PATH = path.resolve(process.cwd(), '../..', 'data/pipeline-stats.json');

export interface PipelineStatsResponse {
  runId: string;
  scenario: string;
  startedAt: string;
  completedAt: string;
  stages: {
    id: string;
    name: string;
    label: string;
    status: string;
    duration: number;
    count: number;
    startTime: number;
    percentage: number;
  }[];
  totalDuration: number;
  bottleneckStage: string;
  metrics: {
    objects: number;
    chunks: number;
    relations: number;
    clusters: number;
    duplicatesRemoved: number;
    embedTokens?: number;
  };
}

// GET /api/pipeline/stats - Get the latest pipeline stats
export async function GET() {
  try {
    const statsRaw = await fs.readFile(STATS_FILE_PATH, 'utf-8');
    const stats = JSON.parse(statsRaw) as PipelineStatsResponse;

    return NextResponse.json({
      success: true,
      data: stats,
      source: 'file',
    });
  } catch (error: any) {
    // If file doesn't exist, return demo data indicator
    if (error.code === 'ENOENT') {
      return NextResponse.json({
        success: false,
        error: 'No pipeline stats found. Run the pipeline first.',
        hint: 'Run: pnpm tsx scripts/run-pipeline.ts ingest normal',
      });
    }

    console.error('Failed to read pipeline stats:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to read pipeline stats' },
      { status: 500 }
    );
  }
}
