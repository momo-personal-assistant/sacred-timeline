'use client';

import { useCallback, useEffect, useState } from 'react';

import LayerBreakdownView from './LayerBreakdownView';
import LayerKPICards from './LayerKPICards';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';

type LayerName = 'chunking' | 'embedding' | 'graph' | 'retrieval' | 'validation';
type EvaluationMethod = 'ground_truth' | 'llm_judge';

interface LayerMetrics {
  [key: string]: unknown;
}

interface LayerData {
  ground_truth?: LayerMetrics;
  llm_judge?: LayerMetrics;
  duration_ms?: number;
}

interface LayerMetricsResponse {
  experiment_id: number;
  layers: {
    [K in LayerName]?: LayerData;
  };
  evaluation_methods: EvaluationMethod[];
}

interface Experiment {
  id: number;
  name: string;
  is_baseline?: boolean;
  results?: {
    f1_score: number;
    precision: number;
    recall: number;
  } | null;
}

interface ResearchPanelProps {
  experiments: Experiment[];
  loading: boolean;
}

export default function ResearchPanel({ experiments, loading }: ResearchPanelProps) {
  const [selectedExperimentId, setSelectedExperimentId] = useState<number | undefined>();
  const [evaluationMethod, setEvaluationMethod] = useState<EvaluationMethod>('ground_truth');
  const [layerMetrics, setLayerMetrics] = useState<LayerMetricsResponse | null>(null);
  const [metricsLoading, setMetricsLoading] = useState(false);
  const [selectedLayer, setSelectedLayer] = useState<LayerName | null>(null);

  // Auto-select first experiment or baseline
  useEffect(() => {
    if (!selectedExperimentId && experiments.length > 0) {
      const baseline = experiments.find((exp) => exp.is_baseline);
      setSelectedExperimentId(baseline?.id || experiments[0].id);
    }
  }, [experiments, selectedExperimentId]);

  // Fetch layer metrics when experiment changes
  const fetchLayerMetrics = useCallback(async (experimentId: number) => {
    setMetricsLoading(true);
    try {
      const response = await fetch(`/api/experiments/${experimentId}/layers`);
      if (!response.ok) {
        throw new Error('Failed to fetch layer metrics');
      }
      const data: LayerMetricsResponse = await response.json();
      setLayerMetrics(data);
    } catch (error) {
      console.error('Error fetching layer metrics:', error);
      setLayerMetrics(null);
    } finally {
      setMetricsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedExperimentId) {
      fetchLayerMetrics(selectedExperimentId);
    }
  }, [selectedExperimentId, fetchLayerMetrics]);

  const selectedExperiment = experiments.find((exp) => exp.id === selectedExperimentId);
  const baselineExperiment = experiments.find((exp) => exp.is_baseline);

  const handleLayerClick = (layer: LayerName) => {
    setSelectedLayer(selectedLayer === layer ? null : layer);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-5 gap-4">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    );
  }

  if (experiments.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Research</CardTitle>
          <CardDescription>Layer-by-layer metrics analysis</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            No experiments found. Run an experiment first to see layer metrics.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with experiment selector and evaluation mode */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Layer Metrics</h2>
          <p className="text-sm text-muted-foreground">
            Component-wise performance analysis for pipeline debugging
          </p>
        </div>

        <div className="flex items-center gap-4">
          {/* Experiment Selector */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Experiment:</span>
            <Select
              value={selectedExperimentId?.toString()}
              onValueChange={(value) => setSelectedExperimentId(parseInt(value, 10))}
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Select experiment" />
              </SelectTrigger>
              <SelectContent>
                {experiments.map((exp) => (
                  <SelectItem key={exp.id} value={exp.id.toString()}>
                    <div className="flex items-center gap-2">
                      <span>{exp.name}</span>
                      {exp.is_baseline && (
                        <span className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded">
                          baseline
                        </span>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Evaluation Mode Selector */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Evaluation:</span>
            <Select
              value={evaluationMethod}
              onValueChange={(value) => setEvaluationMethod(value as EvaluationMethod)}
            >
              <SelectTrigger className="w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ground_truth">Ground Truth</SelectItem>
                <SelectItem value="llm_judge" disabled>
                  LLM-as-Judge (Coming Soon)
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Layer KPI Cards */}
      <LayerKPICards
        layerMetrics={layerMetrics}
        evaluationMethod={evaluationMethod}
        loading={metricsLoading}
        selectedLayer={selectedLayer}
        onLayerClick={handleLayerClick}
        baselineMetrics={
          baselineExperiment && baselineExperiment.id !== selectedExperimentId
            ? undefined // TODO: Fetch baseline metrics for comparison
            : undefined
        }
      />

      {/* Layer Breakdown View */}
      {selectedLayer && layerMetrics && (
        <LayerBreakdownView
          layer={selectedLayer}
          metrics={layerMetrics.layers[selectedLayer]?.[evaluationMethod]}
          durationMs={layerMetrics.layers[selectedLayer]?.duration_ms}
          experimentName={selectedExperiment?.name || ''}
        />
      )}

      {/* No metrics available message */}
      {!metricsLoading && layerMetrics && Object.keys(layerMetrics.layers).length === 0 && (
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">
              No layer metrics available for this experiment.
              <br />
              <span className="text-sm">
                Run validation with <code>?persist=true&experimentId={selectedExperimentId}</code>{' '}
                to collect metrics.
              </span>
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
