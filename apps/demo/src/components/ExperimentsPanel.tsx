'use client';

import { Trophy, GitCommit, Clock, BarChart3 } from 'lucide-react';
import { useState, useEffect } from 'react';

import ExperimentComparisonChart from '@/components/charts/ExperimentComparisonChart';
import ExperimentTimelineChart from '@/components/charts/ExperimentTimelineChart';
import PrecisionRecallScatter from '@/components/charts/PrecisionRecallScatter';
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

function getScoreVariant(score: number): 'default' | 'secondary' | 'destructive' {
  if (score >= 0.6) return 'default';
  if (score >= 0.4) return 'secondary';
  return 'destructive';
}

export default function ExperimentsPanel() {
  const [experiments, setExperiments] = useState<Experiment[]>([]);
  const [selectedExperiment, setSelectedExperiment] = useState<Experiment | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAnalytics, setShowAnalytics] = useState(false);

  useEffect(() => {
    fetchExperiments();
  }, []);

  const fetchExperiments = async () => {
    try {
      const response = await fetch('/api/experiments');
      if (!response.ok) throw new Error('Failed to fetch experiments');
      const data = await response.json();
      setExperiments(data.experiments);
      if (data.experiments.length > 0 && !selectedExperiment) {
        setSelectedExperiment(data.experiments[0]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
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

  const experimentsWithResults = experiments.filter(
    (exp): exp is Experiment & { results: ExperimentResults } => exp.results !== null
  );
  const bestExperiment =
    experimentsWithResults.length > 0
      ? experimentsWithResults.reduce((best, exp) =>
          exp.results.f1_score > best.results.f1_score ? exp : best
        )
      : null;

  return (
    <div className="space-y-6">
      {/* Analytics Toggle */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Experiments</h2>
          <p className="text-muted-foreground">
            Track and compare different configurations • {experiments.length} total
          </p>
        </div>
        <Button
          variant={showAnalytics ? 'default' : 'outline'}
          onClick={() => setShowAnalytics(!showAnalytics)}
          className="gap-2"
        >
          <BarChart3 className="h-4 w-4" />
          {showAnalytics ? 'Hide' : 'Show'} Analytics
        </Button>
      </div>

      {/* Analytics Section */}
      {showAnalytics && (
        <div className="space-y-4">
          {/* Timeline Chart - Full Width */}
          <ExperimentTimelineChart
            experiments={experiments}
            onExperimentClick={setSelectedExperiment}
          />

          {/* Comparison and Scatter - Side by Side */}
          <div className="grid gap-4 md:grid-cols-2">
            <ExperimentComparisonChart
              experiments={experiments}
              onExperimentClick={setSelectedExperiment}
            />
            <PrecisionRecallScatter
              experiments={experiments}
              onExperimentClick={setSelectedExperiment}
            />
          </div>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>All Experiments ({experiments.length})</CardTitle>
          <CardDescription>Click on any experiment to see details</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {bestExperiment && bestExperiment.results && (
            <Card className="border-green-500 bg-green-50">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Trophy className="h-5 w-5 text-green-600" />
                    <Badge className="bg-green-600">BEST</Badge>
                    {bestExperiment.is_baseline && <Badge variant="secondary">BASELINE</Badge>}
                    <span className="font-semibold">{bestExperiment.name}</span>
                  </div>
                  <div className="text-2xl font-bold text-green-600">
                    {(bestExperiment.results.f1_score * 100).toFixed(1)}%
                  </div>
                </div>
                {bestExperiment.config?.embedding && bestExperiment.config?.chunking && (
                  <p className="text-sm text-green-700 mt-2">
                    {bestExperiment.config.embedding.model} •{' '}
                    {bestExperiment.config.chunking.strategy}
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            {experiments.map((exp) => (
              <Card
                key={exp.id}
                className={`cursor-pointer transition-colors ${
                  selectedExperiment?.id === exp.id
                    ? 'border-blue-500 bg-blue-50'
                    : 'hover:border-gray-400'
                }`}
                onClick={() => setSelectedExperiment(exp)}
              >
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-base">{exp.name}</CardTitle>
                      {exp.is_baseline && (
                        <Badge variant="outline" className="text-xs">
                          BASE
                        </Badge>
                      )}
                    </div>
                    {exp.results && (
                      <Badge variant={getScoreVariant(exp.results.f1_score)} className="text-lg">
                        {(exp.results.f1_score * 100).toFixed(1)}%
                      </Badge>
                    )}
                  </div>
                  <CardDescription className="text-xs">
                    {new Date(exp.created_at).toLocaleDateString()}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {exp.config?.embedding && exp.config?.chunking && (
                    <p className="text-sm text-muted-foreground mb-2">
                      {exp.config.embedding.model} • {exp.config.chunking.strategy}
                    </p>
                  )}
                  {exp.paper_ids && exp.paper_ids.length > 0 && (
                    <div className="flex gap-1 flex-wrap">
                      {exp.paper_ids.map((paperId) => (
                        <Badge key={paperId} variant="secondary" className="text-xs">
                          Paper {paperId}
                        </Badge>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>

      {selectedExperiment && selectedExperiment.results && (
        <Card>
          <CardHeader>
            <CardTitle>Experiment Details: {selectedExperiment.name}</CardTitle>
            <CardDescription>{selectedExperiment.description}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {selectedExperiment.config && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Configuration</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-2">
                    {selectedExperiment.config.embedding && (
                      <div>
                        <p className="text-sm text-muted-foreground">Embedding</p>
                        <p className="font-medium">
                          {selectedExperiment.config.embedding.model}
                          {selectedExperiment.config.embedding.dimensions &&
                            ` (${selectedExperiment.config.embedding.dimensions}d)`}
                        </p>
                      </div>
                    )}
                    {selectedExperiment.config.chunking && (
                      <div>
                        <p className="text-sm text-muted-foreground">Chunking</p>
                        <p className="font-medium">
                          {selectedExperiment.config.chunking.strategy}
                          {selectedExperiment.config.chunking.maxChunkSize &&
                            ` (${selectedExperiment.config.chunking.maxChunkSize})`}
                        </p>
                      </div>
                    )}
                    {selectedExperiment.config.retrieval && (
                      <>
                        <div>
                          <p className="text-sm text-muted-foreground">Similarity Threshold</p>
                          <p className="font-medium">
                            {selectedExperiment.config.retrieval.similarityThreshold}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Chunk Limit</p>
                          <p className="font-medium">
                            {selectedExperiment.config.retrieval.chunkLimit}
                          </p>
                        </div>
                      </>
                    )}
                    {selectedExperiment.git_commit && (
                      <div>
                        <p className="text-sm text-muted-foreground flex items-center gap-1">
                          <GitCommit className="h-3 w-3" />
                          Git Commit
                        </p>
                        <p className="font-mono text-sm">
                          {selectedExperiment.git_commit.substring(0, 8)}
                        </p>
                      </div>
                    )}
                    <div>
                      <p className="text-sm text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        Retrieval Time
                      </p>
                      <p className="font-medium">
                        {selectedExperiment.results.retrieval_time_ms}ms
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Performance Metrics</CardTitle>
                <CardDescription className="text-xs">
                  TP: {selectedExperiment.results.true_positives} | FP:{' '}
                  {selectedExperiment.results.false_positives} | FN:{' '}
                  {selectedExperiment.results.false_negatives}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex gap-8 justify-center">
                  <MetricDisplay label="Precision" value={selectedExperiment.results.precision} />
                  <MetricDisplay label="Recall" value={selectedExperiment.results.recall} />
                  <MetricDisplay
                    label="F1 Score"
                    value={selectedExperiment.results.f1_score}
                    highlight
                  />
                </div>
              </CardContent>
            </Card>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function MetricDisplay({
  label,
  value,
  highlight,
}: {
  label: string;
  value: number;
  highlight?: boolean;
}) {
  const variant = getScoreVariant(value);

  return (
    <div className="text-center">
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <div className={`text-3xl font-bold ${highlight ? 'text-primary' : ''}`}>
        {(value * 100).toFixed(0)}%
      </div>
      <Badge variant={variant} className="mt-1 text-xs">
        {(value * 100).toFixed(1)}%
      </Badge>
    </div>
  );
}
