'use client';

import { BarChart3, LayoutGrid, GitCompare } from 'lucide-react';
import { useState, useEffect } from 'react';

import ConfigDiffView from '@/components/charts/ConfigDiffView';
import ExperimentComparisonChart from '@/components/charts/ExperimentComparisonChart';
import ExperimentTimelineChart from '@/components/charts/ExperimentTimelineChart';
import PrecisionRecallScatter from '@/components/charts/PrecisionRecallScatter';
import SimilarExperimentsTable from '@/components/charts/SimilarExperimentsTable';
import ExperimentDetailPanel from '@/components/ExperimentDetailPanel';
import SystemStatusPanel from '@/components/SystemStatusPanel';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

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
  selectedExperimentId?: number;
  onExperimentSelect?: (experimentId: number) => void;
}

export default function ExperimentsPanel({
  selectedExperimentId,
  onExperimentSelect,
}: ExperimentsPanelProps) {
  const [experiments, setExperiments] = useState<Experiment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchExperiments();
  }, []);

  const fetchExperiments = async () => {
    try {
      const response = await fetch('/api/experiments');
      if (!response.ok) throw new Error('Failed to fetch experiments');
      const data = await response.json();
      setExperiments(data.experiments);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  // Derive selected experiment from prop
  const selectedExperiment = selectedExperimentId
    ? experiments.find((exp) => exp.id === selectedExperimentId) || null
    : null;

  // Handler for chart clicks - convert experiment object to ID
  const handleExperimentClick = (experiment: Experiment) => {
    onExperimentSelect?.(experiment.id);
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <p className="text-muted-foreground">Loading experiments...</p>
        </CardContent>
      </Card>
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

  const baselineExperiment = experiments.find((exp) => exp.is_baseline) || null;

  return (
    <Tabs defaultValue="experiments" className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold leading-tight">Experiments</h2>
          <p className="text-xs text-muted-foreground leading-[1.5]">
            Track and compare different configurations • {experiments.length} total
          </p>
        </div>
      </div>

      {/* Tabs Navigation */}
      <TabsList>
        <TabsTrigger value="experiments" className="gap-2">
          <BarChart3 className="h-4 w-4" />
          Experiments
        </TabsTrigger>
        <TabsTrigger value="system" className="gap-2">
          System Status
        </TabsTrigger>
      </TabsList>

      {/* Experiments Tab - Dynamic Layout based on selection */}
      <TabsContent value="experiments" className="space-y-0">
        {/* Mode Indicator */}
        <div className="flex items-center justify-between mb-3">
          <div className="inline-flex items-center gap-2">
            {selectedExperiment ? (
              <>
                <GitCompare className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Analysis Mode:</span>
                <Badge variant="secondary" className="text-xs h-[18px] font-medium">
                  {selectedExperiment.name}
                </Badge>
              </>
            ) : (
              <>
                <LayoutGrid className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">
                  Overview Mode - Select an experiment from the sidebar to analyze
                </span>
              </>
            )}
          </div>
          {selectedExperiment && (
            <Button
              variant="ghost"
              size="sm"
              className="text-xs h-[28px]"
              onClick={() => onExperimentSelect?.(undefined as unknown as number)}
            >
              Back to Overview
            </Button>
          )}
        </div>

        <div className="grid grid-cols-[1fr_35%] gap-3 h-[calc(100vh-260px)]">
          {/* Left Column: Dynamic Content (65%) */}
          <section className="overflow-y-auto space-y-3 pr-1">
            {selectedExperiment ? (
              /* Analysis Mode: Config-aware comparison */
              <>
                <ConfigDiffView
                  experiment={selectedExperiment}
                  baselineExperiment={baselineExperiment}
                />
                <SimilarExperimentsTable
                  selectedExperiment={selectedExperiment}
                  experiments={experiments}
                  onExperimentClick={handleExperimentClick}
                />
                {/* Mini Timeline for context */}
                <ExperimentTimelineChart
                  experiments={experiments}
                  onExperimentClick={handleExperimentClick}
                  selectedExperimentId={selectedExperimentId}
                  compact
                />
              </>
            ) : (
              /* Overview Mode: Full charts */
              <>
                <ExperimentTimelineChart
                  experiments={experiments}
                  onExperimentClick={handleExperimentClick}
                />
                <ExperimentComparisonChart
                  experiments={experiments}
                  onExperimentClick={handleExperimentClick}
                />
                <PrecisionRecallScatter
                  experiments={experiments}
                  onExperimentClick={handleExperimentClick}
                />
              </>
            )}
          </section>

          {/* Right Column: Detail Panel (35%) */}
          <aside className="overflow-y-auto pr-1">
            <ExperimentDetailPanel
              experiment={selectedExperiment}
              baselineExperiment={baselineExperiment}
            />
          </aside>
        </div>
      </TabsContent>

      {/* System Status Tab */}
      <TabsContent value="system">
        <SystemStatusPanel />
      </TabsContent>
    </Tabs>
  );
}
