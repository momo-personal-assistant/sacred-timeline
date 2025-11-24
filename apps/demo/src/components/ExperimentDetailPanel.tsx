'use client';

import { GitCommit, TrendingUp, Copy, Download } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

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

interface ExperimentDetailPanelProps {
  experiment: Experiment | null;
  baselineExperiment?: Experiment | null;
}

export default function ExperimentDetailPanel({
  experiment,
  baselineExperiment,
}: ExperimentDetailPanelProps) {
  if (!experiment) {
    return (
      <Card className="h-full">
        <CardContent className="flex items-center justify-center h-full">
          <p className="text-xs text-muted-foreground leading-[1.5]">
            Select an experiment from the sidebar
          </p>
        </CardContent>
      </Card>
    );
  }

  const hasResults = experiment.results !== null;
  const improvementVsBaseline =
    baselineExperiment?.results && experiment.results
      ? ((experiment.results.f1_score - baselineExperiment.results.f1_score) /
          baselineExperiment.results.f1_score) *
        100
      : null;

  return (
    <div className="h-full overflow-y-auto">
      <Card>
        <CardHeader className="pb-3">
          {/* Title and Actions */}
          <div className="inline-flex items-center justify-between w-full">
            <div className="inline-flex items-center gap-1.5">
              {experiment.is_baseline && (
                <Badge
                  variant="secondary"
                  className="text-xs h-[18px] inline-flex items-center font-medium"
                >
                  BASE
                </Badge>
              )}
              <CardTitle className="text-sm font-semibold leading-tight">
                {experiment.name}
              </CardTitle>
            </div>
            <div className="inline-flex gap-1">
              <Button
                variant="ghost"
                size="sm"
                className="h-[28px] w-[28px] p-0"
                title="Clone experiment"
              >
                <Copy className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-[28px] w-[28px] p-0"
                title="Export config"
              >
                <Download className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          {/* Date and Description */}
          <CardDescription className="text-xs leading-[1.5] mt-1">
            {new Date(experiment.created_at).toLocaleString()}
          </CardDescription>
          {experiment.description && (
            <p className="text-xs text-muted-foreground leading-[1.5] mt-2">
              {experiment.description}
            </p>
          )}
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Performance Metrics */}
          {hasResults && experiment.results && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold leading-tight">Performance Metrics</h3>

              {/* Main Metrics - Grid Layout */}
              <div className="grid grid-cols-3 gap-2">
                <div className="text-center p-2 bg-muted rounded-lg">
                  <div className="text-lg font-semibold leading-tight">
                    {(experiment.results.precision * 100).toFixed(1)}%
                  </div>
                  <p className="text-xs text-muted-foreground leading-[1.5]">Precision</p>
                </div>
                <div className="text-center p-2 bg-muted rounded-lg">
                  <div className="text-lg font-semibold leading-tight">
                    {(experiment.results.recall * 100).toFixed(1)}%
                  </div>
                  <p className="text-xs text-muted-foreground leading-[1.5]">Recall</p>
                </div>
                <div className="text-center p-2 bg-primary/10 rounded-lg">
                  <div className="text-lg font-semibold text-primary leading-tight">
                    {(experiment.results.f1_score * 100).toFixed(1)}%
                  </div>
                  <p className="text-xs text-muted-foreground leading-[1.5]">F1 Score</p>
                </div>
              </div>

              {/* Counts & Time */}
              <div className="grid gap-1.5 text-xs">
                <div className="inline-flex items-center justify-between">
                  <span className="text-muted-foreground leading-[1.5]">True Positives:</span>
                  <span className="font-mono font-medium leading-[1.5]">
                    {experiment.results.true_positives}
                  </span>
                </div>
                <div className="inline-flex items-center justify-between">
                  <span className="text-muted-foreground leading-[1.5]">False Positives:</span>
                  <span className="font-mono font-medium leading-[1.5]">
                    {experiment.results.false_positives}
                  </span>
                </div>
                <div className="inline-flex items-center justify-between">
                  <span className="text-muted-foreground leading-[1.5]">False Negatives:</span>
                  <span className="font-mono font-medium leading-[1.5]">
                    {experiment.results.false_negatives}
                  </span>
                </div>
                <div className="inline-flex items-center justify-between pt-1 border-t">
                  <span className="text-muted-foreground leading-[1.5]">Retrieval Time:</span>
                  <span className="font-mono font-medium leading-[1.5]">
                    {experiment.results.retrieval_time_ms}ms
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Analysis vs Baseline */}
          {improvementVsBaseline !== null && !experiment.is_baseline && (
            <div className="space-y-2 pt-4 border-t">
              <h3 className="inline-flex items-center gap-2 text-sm font-semibold leading-tight">
                <TrendingUp className="h-4 w-4" />
                vs Baseline
              </h3>
              <div className="inline-flex items-center justify-between">
                <span className="text-xs text-muted-foreground leading-[1.5]">
                  F1 Score Change:
                </span>
                <Badge
                  variant={improvementVsBaseline >= 0 ? 'default' : 'destructive'}
                  className="text-xs h-[18px] inline-flex items-center font-medium"
                >
                  {improvementVsBaseline >= 0 ? '+' : ''}
                  {improvementVsBaseline.toFixed(1)}%
                </Badge>
              </div>
              {baselineExperiment?.results && experiment.results && (
                <div className="space-y-1 text-xs">
                  <div className="inline-flex justify-between w-full">
                    <span className="text-muted-foreground leading-[1.5]">Precision:</span>
                    <span className="font-mono leading-[1.5]">
                      {(baselineExperiment.results.precision * 100).toFixed(1)}% →{' '}
                      {(experiment.results.precision * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div className="inline-flex justify-between w-full">
                    <span className="text-muted-foreground leading-[1.5]">Recall:</span>
                    <span className="font-mono leading-[1.5]">
                      {(baselineExperiment.results.recall * 100).toFixed(1)}% →{' '}
                      {(experiment.results.recall * 100).toFixed(1)}%
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Configuration */}
          <div className="space-y-3 pt-4 border-t">
            <h3 className="text-sm font-semibold leading-tight">Configuration</h3>

            {/* Relation Inference */}
            {experiment.config?.relationInference && (
              <div className="space-y-1.5">
                <h4 className="text-xs font-semibold leading-tight">Relation Inference</h4>
                <div className="grid gap-1.5 text-xs">
                  <div className="inline-flex justify-between">
                    <span className="text-muted-foreground">Semantic Similarity:</span>
                    <Badge
                      variant={
                        experiment.config.relationInference.useSemanticSimilarity
                          ? 'default'
                          : 'secondary'
                      }
                      className="text-xs h-[18px] inline-flex items-center font-medium"
                    >
                      {experiment.config.relationInference.useSemanticSimilarity ? 'ON' : 'OFF'}
                    </Badge>
                  </div>
                  {experiment.config.relationInference.similarityThreshold !== undefined && (
                    <div className="inline-flex justify-between">
                      <span className="text-muted-foreground">Similarity Threshold:</span>
                      <span className="font-mono font-medium">
                        {experiment.config.relationInference.similarityThreshold}
                      </span>
                    </div>
                  )}
                  {experiment.config.relationInference.semanticWeight !== undefined && (
                    <div className="inline-flex justify-between">
                      <span className="text-muted-foreground">Semantic Weight:</span>
                      <span className="font-mono font-medium">
                        {experiment.config.relationInference.semanticWeight}
                      </span>
                    </div>
                  )}
                  {experiment.config.relationInference.keywordOverlapThreshold !== undefined && (
                    <div className="inline-flex justify-between">
                      <span className="text-muted-foreground">Keyword Overlap:</span>
                      <span className="font-mono font-medium">
                        {experiment.config.relationInference.keywordOverlapThreshold}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Embedding */}
            {experiment.config?.embedding && (
              <div className="space-y-1.5">
                <h4 className="text-xs font-semibold leading-tight">Embedding</h4>
                <div className="grid gap-1.5 text-xs">
                  <div className="inline-flex justify-between">
                    <span className="text-muted-foreground">Model:</span>
                    <span className="font-mono font-medium">
                      {experiment.config.embedding.model}
                    </span>
                  </div>
                  {experiment.config.embedding.dimensions && (
                    <div className="inline-flex justify-between">
                      <span className="text-muted-foreground">Dimensions:</span>
                      <span className="font-mono font-medium">
                        {experiment.config.embedding.dimensions}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Chunking */}
            {experiment.config?.chunking && (
              <div className="space-y-1.5">
                <h4 className="text-xs font-semibold leading-tight">Chunking</h4>
                <div className="grid gap-1.5 text-xs">
                  <div className="inline-flex justify-between">
                    <span className="text-muted-foreground">Strategy:</span>
                    <span className="font-mono font-medium">
                      {experiment.config.chunking.strategy}
                    </span>
                  </div>
                  {experiment.config.chunking.maxChunkSize && (
                    <div className="inline-flex justify-between">
                      <span className="text-muted-foreground">Max Chunk Size:</span>
                      <span className="font-mono font-medium">
                        {experiment.config.chunking.maxChunkSize} tokens
                      </span>
                    </div>
                  )}
                  {experiment.config.chunking.overlap !== undefined && (
                    <div className="inline-flex justify-between">
                      <span className="text-muted-foreground">Overlap:</span>
                      <span className="font-mono font-medium">
                        {experiment.config.chunking.overlap} tokens
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Retrieval */}
            {experiment.config?.retrieval && (
              <div className="space-y-1.5">
                <h4 className="text-xs font-semibold leading-tight">Retrieval</h4>
                <div className="grid gap-1.5 text-xs">
                  {experiment.config.retrieval.similarityThreshold !== undefined && (
                    <div className="inline-flex justify-between">
                      <span className="text-muted-foreground">Similarity Threshold:</span>
                      <span className="font-mono font-medium">
                        {experiment.config.retrieval.similarityThreshold}
                      </span>
                    </div>
                  )}
                  {experiment.config.retrieval.chunkLimit && (
                    <div className="inline-flex justify-between">
                      <span className="text-muted-foreground">Chunk Limit:</span>
                      <span className="font-mono font-medium">
                        {experiment.config.retrieval.chunkLimit}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Git Info */}
          {experiment.git_commit && (
            <div className="pt-4 border-t">
              <div className="inline-flex items-center gap-2">
                <GitCommit className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs font-mono text-muted-foreground leading-[1.5]">
                  {experiment.git_commit.slice(0, 7)}
                </span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
