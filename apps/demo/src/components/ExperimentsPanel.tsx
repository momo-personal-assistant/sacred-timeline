'use client';

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
    <div className="relative h-full">
      {/* Graph Visualization - Full height */}
      <RelationGraphView
        experimentConfig={selectedExperiment?.config?.relationInference}
        experiments={experiments.map((e) => ({ id: e.id, name: e.name }))}
        selectedExperimentId={selectedExperimentId}
        onExperimentChange={onExperimentSelect}
        selectedExperiment={selectedExperiment}
        baselineExperiment={baselineExperiment}
        className="h-full"
      />
    </div>
  );
}
