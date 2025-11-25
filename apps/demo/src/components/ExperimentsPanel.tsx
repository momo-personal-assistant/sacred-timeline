'use client';

import { useState, useEffect } from 'react';

import ConfigDiffView from '@/components/charts/ConfigDiffView';
import ExperimentTimelineChart from '@/components/charts/ExperimentTimelineChart';
import RelationGraphView from '@/components/charts/RelationGraphView';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

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

  const selectedExperiment = selectedExperimentId
    ? experiments.find((exp) => exp.id === selectedExperimentId) || null
    : null;

  const handleExperimentClick = (experiment: Experiment) => {
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
    <div className="flex flex-col h-[calc(100vh-180px)]">
      {/* Central Graph Visualization - Always Visible */}
      <div className="flex-1 min-h-0">
        <RelationGraphView
          experimentConfig={selectedExperiment?.config?.relationInference}
          experiments={experiments.map((e) => ({ id: e.id, name: e.name }))}
          selectedExperimentId={selectedExperimentId}
          onExperimentChange={onExperimentSelect}
          className="h-full"
        />
      </div>

      {/* Bottom Section: Config Diff + Timeline */}
      <div className="grid grid-cols-2 gap-3 mt-3 h-[180px]">
        {/* Config Diff */}
        <div className="overflow-hidden">
          <ConfigDiffView
            experiment={selectedExperiment}
            baselineExperiment={baselineExperiment}
            compact
          />
        </div>

        {/* Timeline */}
        <div className="overflow-hidden">
          <ExperimentTimelineChart
            experiments={experiments}
            onExperimentClick={handleExperimentClick}
            selectedExperimentId={selectedExperimentId}
            compact
          />
        </div>
      </div>
    </div>
  );
}
