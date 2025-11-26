'use client';

import { useEffect, useState } from 'react';

import BenchmarkResultsView from '@/components/charts/BenchmarkResultsView';
import PerformanceWaterfall from '@/components/charts/PerformanceWaterfall';
import PipelineFlowDiagram from '@/components/charts/PipelineFlowDiagram';
import PipelineKPICards from '@/components/charts/PipelineKPICards';
import RelationGraphView from '@/components/charts/RelationGraphView';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DEMO_PIPELINE_STATS, type PipelineRunStats } from '@/types/pipeline';

interface ExperimentConfig {
  name: string;
  description: string;
  embedding: {
    model: string;
    dimensions?: number;
    batchSize?: number;
  };
  chunking: {
    strategy: string;
    maxChunkSize?: number;
    overlap?: number;
  };
  retrieval: {
    similarityThreshold?: number;
    chunkLimit?: number;
  };
  relationInference: {
    keywordOverlapThreshold?: number;
    useSemanticSimilarity?: boolean;
    similarityThreshold?: number;
    semanticWeight?: number;
  };
}

interface ExperimentResults {
  f1_score: number;
  precision: number;
  recall: number;
  true_positives: number;
  false_positives: number;
  false_negatives: number;
  retrieval_time_ms: number;
}

interface Experiment {
  id: number;
  name: string;
  description: string;
  config: ExperimentConfig;
  is_baseline: boolean;
  paper_ids: string[];
  git_commit: string | null;
  created_at: string;
  results: ExperimentResults | null;
}

interface ExperimentsPanelProps {
  experiments: Experiment[];
  loading: boolean;
  error: string | null;
  selectedExperimentId?: number;
  onExperimentSelect?: (experimentId: number) => void;
}

export default function ExperimentsPanel({
  experiments,
  loading,
  error,
  selectedExperimentId,
  onExperimentSelect,
}: ExperimentsPanelProps) {
  const [pipelineStats, setPipelineStats] = useState<PipelineRunStats>(DEMO_PIPELINE_STATS);
  const [isRealData, setIsRealData] = useState(false);

  // Fetch real pipeline stats from API
  useEffect(() => {
    async function fetchPipelineStats() {
      try {
        const response = await fetch('/api/pipeline/stats');
        const result = await response.json();

        if (result.success && result.data) {
          setPipelineStats(result.data);
          setIsRealData(true);
        }
      } catch (err) {
        console.warn('Failed to fetch pipeline stats, using demo data:', err);
      }
    }

    fetchPipelineStats();
  }, []);

  const selectedExperiment = selectedExperimentId
    ? experiments.find((exp) => exp.id === selectedExperimentId) || null
    : null;

  const _handleExperimentClick = (experiment: Experiment) => {
    onExperimentSelect?.(experiment.id);
  };

  const baselineExperiment = experiments.find((exp) => exp.is_baseline) || null;

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <p className="text-muted-foreground">Loading experiments...</p>
      </div>
    );
  }

  if (error) {
    return (
      <Card className="border-destructive">
        <CardHeader>
          <CardTitle className="text-destructive">Error</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-destructive">{error}</p>
        </CardContent>
      </Card>
    );
  }

  if (experiments.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <p className="text-muted-foreground mb-2">No experiments yet</p>
          <p className="text-sm text-muted-foreground">
            Run `pnpm run experiment` to create your first experiment
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="relative h-full flex flex-col">
      <Tabs defaultValue="pipeline" className="h-full flex flex-col">
        <TabsList className="grid w-full grid-cols-3 mb-4">
          <TabsTrigger value="pipeline">Pipeline</TabsTrigger>
          <TabsTrigger value="benchmark">Benchmark</TabsTrigger>
          <TabsTrigger value="graph">Knowledge Graph</TabsTrigger>
        </TabsList>

        <TabsContent value="pipeline" className="flex-1 overflow-auto space-y-4 mt-0">
          {/* Pipeline Flow Diagram */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold">Pipeline Execution</CardTitle>
                <span
                  className={`text-xs px-2 py-0.5 rounded ${
                    isRealData
                      ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
                      : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300'
                  }`}
                >
                  {isRealData ? 'Real Data' : 'Demo Data'}
                </span>
              </div>
              <CardDescription className="text-xs">
                9-stage ingest pipeline visualization
                {isRealData && ` (${pipelineStats.totalDuration}ms total)`}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <PipelineFlowDiagram
                stages={pipelineStats.stages}
                bottleneckStage={pipelineStats.bottleneckStage}
                showDurations={true}
              />
            </CardContent>
          </Card>

          {/* KPI Cards */}
          <PipelineKPICards
            stages={pipelineStats.stages}
            metrics={pipelineStats.metrics}
            totalDuration={pipelineStats.totalDuration}
            bottleneckStage={pipelineStats.bottleneckStage}
          />

          {/* Performance Waterfall */}
          <PerformanceWaterfall
            stages={pipelineStats.stages}
            totalDuration={pipelineStats.totalDuration}
            bottleneckStage={pipelineStats.bottleneckStage}
          />
        </TabsContent>

        <TabsContent value="benchmark" className="flex-1 overflow-auto mt-0">
          <BenchmarkResultsView className="h-full" />
        </TabsContent>

        <TabsContent value="graph" className="flex-1 mt-0">
          {/* Graph Visualization */}
          <RelationGraphView
            experimentConfig={selectedExperiment?.config?.relationInference}
            experiments={experiments.map((e) => ({ id: e.id, name: e.name }))}
            selectedExperimentId={selectedExperimentId}
            onExperimentChange={onExperimentSelect}
            selectedExperiment={selectedExperiment}
            baselineExperiment={baselineExperiment}
            className="h-full"
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
