/**
 * Pipeline visualization types
 * Used for displaying E2E pipeline execution stats and bottleneck analysis
 */

export type StageStatus = 'pending' | 'running' | 'completed' | 'error';

export interface PipelineStage {
  id: string;
  name: string;
  label: string;
  status: StageStatus;
  duration?: number; // milliseconds
  count?: number;
  startTime?: number; // cumulative start time for waterfall
  percentage?: number; // percentage of total duration
}

export interface PipelineRunStats {
  runId: string;
  scenario: string;
  startedAt: string;
  completedAt?: string;
  stages: PipelineStage[];
  totalDuration: number;
  bottleneckStage?: string;
  metrics: PipelineMetrics;
}

export interface PipelineMetrics {
  objects: number;
  chunks: number;
  relations: number;
  clusters: number;
  duplicatesRemoved: number;
  embedTokens?: number;
}

// Stage definitions for the 9-stage ingest pipeline
export const PIPELINE_STAGES: Array<{ id: string; name: string; label: string }> = [
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

// Helper to convert raw stats from run-pipeline.ts to PipelineRunStats
export function toPipelineRunStats(
  runId: string,
  scenario: string,
  rawStats: {
    stages: Record<string, { duration: number; count: number }>;
    totalDuration: number;
    objects: number;
    chunks: number;
    relations: number;
    clusters: number;
  }
): PipelineRunStats {
  // Calculate cumulative start times and percentages
  let cumulativeTime = 0;
  const stages: PipelineStage[] = PIPELINE_STAGES.map((stage) => {
    const stageData = rawStats.stages[stage.id] || { duration: 0, count: 0 };
    const startTime = cumulativeTime;
    cumulativeTime += stageData.duration;
    const percentage =
      rawStats.totalDuration > 0 ? (stageData.duration / rawStats.totalDuration) * 100 : 0;

    return {
      id: stage.id,
      name: stage.name,
      label: stage.label,
      status: 'completed' as StageStatus,
      duration: stageData.duration,
      count: stageData.count,
      startTime,
      percentage,
    };
  });

  // Find bottleneck (stage with highest duration percentage)
  const bottleneckStage = stages.reduce(
    (max, stage) => ((stage.percentage || 0) > (max.percentage || 0) ? stage : max),
    stages[0]
  );

  return {
    runId,
    scenario,
    startedAt: new Date().toISOString(),
    completedAt: new Date().toISOString(),
    stages,
    totalDuration: rawStats.totalDuration,
    bottleneckStage: bottleneckStage.id,
    metrics: {
      objects: rawStats.objects,
      chunks: rawStats.chunks,
      relations: rawStats.relations,
      clusters: rawStats.clusters,
      duplicatesRemoved: 0,
    },
  };
}

// Demo data for development/preview
export const DEMO_PIPELINE_STATS: PipelineRunStats = {
  runId: 'demo-run-1',
  scenario: 'normal',
  startedAt: '2024-01-15T10:00:00Z',
  completedAt: '2024-01-15T10:00:05Z',
  stages: [
    {
      id: 'load',
      name: 'Load',
      label: 'Load Data',
      status: 'completed',
      duration: 45,
      count: 150,
      startTime: 0,
      percentage: 0.9,
    },
    {
      id: 'transform',
      name: 'Transform',
      label: 'Transform',
      status: 'completed',
      duration: 120,
      count: 150,
      startTime: 45,
      percentage: 2.4,
    },
    {
      id: 'chunk',
      name: 'Chunk',
      label: 'Chunk',
      status: 'completed',
      duration: 85,
      count: 450,
      startTime: 165,
      percentage: 1.7,
    },
    {
      id: 'embed',
      name: 'Embed',
      label: 'Embed',
      status: 'completed',
      duration: 3200,
      count: 450,
      startTime: 250,
      percentage: 64,
    },
    {
      id: 'cluster',
      name: 'Cluster',
      label: 'Cluster',
      status: 'completed',
      duration: 180,
      count: 3,
      startTime: 3450,
      percentage: 3.6,
    },
    {
      id: 'graph',
      name: 'Graph',
      label: 'KG Build',
      status: 'completed',
      duration: 650,
      count: 89,
      startTime: 3630,
      percentage: 13,
    },
    {
      id: 'temporal',
      name: 'Temporal',
      label: 'Temporal',
      status: 'completed',
      duration: 25,
      count: 150,
      startTime: 4280,
      percentage: 0.5,
    },
    {
      id: 'consolidate',
      name: 'Consolidate',
      label: 'Consolidate',
      status: 'completed',
      duration: 35,
      count: 145,
      startTime: 4305,
      percentage: 0.7,
    },
    {
      id: 'store',
      name: 'Store',
      label: 'Store',
      status: 'completed',
      duration: 660,
      count: 595,
      startTime: 4340,
      percentage: 13.2,
    },
  ],
  totalDuration: 5000,
  bottleneckStage: 'embed',
  metrics: {
    objects: 145,
    chunks: 450,
    relations: 89,
    clusters: 3,
    duplicatesRemoved: 5,
    embedTokens: 125000,
  },
};
