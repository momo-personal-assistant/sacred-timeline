'use client';

import { useEffect, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface ExperimentDoc {
  id: string;
  name: string;
  description: string;
  created_at: string;
  status: string;
  baseline?: string;
  results: {
    overall_accuracy: number;
    accuracy_by_type: Record<string, number>;
    passed_queries: string[];
    failed_queries: string[];
    latency: {
      avg_ms: number;
      p50_ms: number;
      p95_ms: number;
    };
  };
  comparison?: {
    baseline_accuracy: number;
    new_accuracy: number;
    improvement: string;
    improvement_factor: string;
    newly_passed: string[];
    newly_failed: string[];
    latency_change: string;
  };
  analysis: {
    key_findings: string[];
    remaining_issues?: string[];
    is_overfitting?: boolean;
    overfitting_rationale?: string;
  };
}

interface BenchmarkData {
  experiments: ExperimentDoc[];
  latestResults: {
    metrics: {
      overall_accuracy: number;
      accuracy_by_type: Record<string, number>;
      avg_latency_ms: number;
      p50_latency_ms: number;
      p95_latency_ms: number;
    };
  } | null;
  summary: {
    total_experiments: number;
    best_experiment: {
      id: string;
      name: string;
      accuracy: number;
    } | null;
    latest_accuracy: number | null;
  };
}

const QUERY_TYPE_LABELS: Record<string, string> = {
  single_hop: 'Single-Hop',
  multi_hop: 'Multi-Hop',
  temporal: 'Temporal',
  aggregation: 'Aggregation',
  filtered_aggregation: 'Filtered Agg',
  ranked: 'Ranked',
  attribution: 'Attribution',
  cross_source: 'Cross-Source',
};

export default function BenchmarkResultsView({ className }: { className?: string }) {
  const [data, setData] = useState<BenchmarkData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedExp, setSelectedExp] = useState<string | null>(null);

  useEffect(() => {
    async function fetchBenchmarkData() {
      try {
        const response = await fetch('/api/benchmark');
        const result = await response.json();

        if (result.success) {
          setData(result.data);
          // Select the latest experiment by default
          if (result.data.experiments.length > 0) {
            setSelectedExp(result.data.experiments[0].id);
          }
        } else {
          setError(result.error || 'Failed to load benchmark data');
        }
      } catch (err) {
        setError('Failed to fetch benchmark data');
        console.error(err);
      } finally {
        setLoading(false);
      }
    }

    fetchBenchmarkData();
  }, []);

  if (loading) {
    return (
      <div className={`flex items-center justify-center ${className}`}>
        <p className="text-muted-foreground">Loading benchmark results...</p>
      </div>
    );
  }

  if (error) {
    return (
      <Card className={`border-destructive ${className}`}>
        <CardContent className="pt-6">
          <p className="text-sm text-destructive">{error}</p>
        </CardContent>
      </Card>
    );
  }

  if (!data || data.experiments.length === 0) {
    return (
      <Card className={className}>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <p className="text-muted-foreground mb-2">No benchmark experiments yet</p>
          <p className="text-sm text-muted-foreground">
            Run `pnpm tsx scripts/run-benchmark.ts` to generate results
          </p>
        </CardContent>
      </Card>
    );
  }

  const selectedExperiment = data.experiments.find((e) => e.id === selectedExp);

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Summary Card */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">Benchmark Summary</CardTitle>
          <CardDescription className="text-xs">
            {data.summary.total_experiments} experiments
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-2xl font-bold text-primary">
                {data.summary.best_experiment
                  ? `${(data.summary.best_experiment.accuracy * 100).toFixed(1)}%`
                  : '-'}
              </p>
              <p className="text-xs text-muted-foreground">Best Accuracy</p>
            </div>
            <div>
              <p className="text-2xl font-bold">
                {data.latestResults
                  ? `${data.latestResults.metrics.avg_latency_ms.toFixed(0)}ms`
                  : '-'}
              </p>
              <p className="text-xs text-muted-foreground">Avg Latency</p>
            </div>
            <div>
              <p className="text-2xl font-bold">{data.summary.total_experiments}</p>
              <p className="text-xs text-muted-foreground">Experiments</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Experiment Selector */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">Experiments</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {data.experiments.map((exp) => (
            <button
              key={exp.id}
              onClick={() => setSelectedExp(exp.id)}
              className={`w-full text-left p-3 rounded-lg border transition-colors ${
                selectedExp === exp.id
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:bg-muted/50'
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-sm">
                    {exp.id}: {exp.name}
                  </p>
                  <p className="text-xs text-muted-foreground">{exp.description}</p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold">
                    {(exp.results.overall_accuracy * 100).toFixed(1)}%
                  </p>
                  {exp.comparison && (
                    <Badge
                      variant={exp.comparison.improvement.startsWith('+') ? 'default' : 'secondary'}
                      className="text-xs"
                    >
                      {exp.comparison.improvement}
                    </Badge>
                  )}
                </div>
              </div>
            </button>
          ))}
        </CardContent>
      </Card>

      {/* Selected Experiment Details */}
      {selectedExperiment && (
        <>
          {/* Accuracy by Type */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">Accuracy by Query Type</CardTitle>
              <CardDescription className="text-xs">
                {selectedExperiment.results.passed_queries.length}/
                {selectedExperiment.results.passed_queries.length +
                  selectedExperiment.results.failed_queries.length}{' '}
                queries passed
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {Object.entries(selectedExperiment.results.accuracy_by_type).map(([type, acc]) => (
                <div key={type} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span>{QUERY_TYPE_LABELS[type] || type}</span>
                    <span className="font-medium">{(acc * 100).toFixed(0)}%</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        acc === 1
                          ? 'bg-green-500'
                          : acc > 0
                            ? 'bg-yellow-500'
                            : 'bg-muted-foreground/30'
                      }`}
                      style={{ width: `${acc * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Analysis */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold">Analysis</CardTitle>
                {selectedExperiment.analysis.is_overfitting !== undefined && (
                  <Badge
                    variant={selectedExperiment.analysis.is_overfitting ? 'destructive' : 'outline'}
                  >
                    {selectedExperiment.analysis.is_overfitting
                      ? 'Overfitting Risk'
                      : 'Generalizable'}
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Key Findings */}
              <div>
                <p className="text-xs font-medium mb-2 text-muted-foreground">Key Findings</p>
                <ul className="space-y-1">
                  {selectedExperiment.analysis.key_findings.map((finding, i) => (
                    <li key={i} className="text-sm flex items-start gap-2">
                      <span className="text-green-500 mt-0.5">+</span>
                      <span>{finding}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Remaining Issues */}
              {selectedExperiment.analysis.remaining_issues &&
                selectedExperiment.analysis.remaining_issues.length > 0 && (
                  <div>
                    <p className="text-xs font-medium mb-2 text-muted-foreground">
                      Remaining Issues
                    </p>
                    <ul className="space-y-1">
                      {selectedExperiment.analysis.remaining_issues.map((issue, i) => (
                        <li key={i} className="text-sm flex items-start gap-2">
                          <span className="text-yellow-500 mt-0.5">!</span>
                          <span>{issue}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

              {/* Comparison */}
              {selectedExperiment.comparison && (
                <div className="pt-2 border-t">
                  <p className="text-xs font-medium mb-2 text-muted-foreground">
                    vs Baseline ({selectedExperiment.baseline})
                  </p>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Improvement: </span>
                      <span className="font-medium text-green-600">
                        {selectedExperiment.comparison.improvement} (
                        {selectedExperiment.comparison.improvement_factor})
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Latency: </span>
                      <span className="font-medium">
                        {selectedExperiment.comparison.latency_change}
                      </span>
                    </div>
                  </div>
                  {selectedExperiment.comparison.newly_passed.length > 0 && (
                    <div className="mt-2">
                      <span className="text-xs text-muted-foreground">Newly Passed: </span>
                      <span className="text-xs text-green-600">
                        {selectedExperiment.comparison.newly_passed.join(', ')}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Latency Stats */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">Latency</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-xl font-bold">{selectedExperiment.results.latency.avg_ms}ms</p>
                  <p className="text-xs text-muted-foreground">Average</p>
                </div>
                <div>
                  <p className="text-xl font-bold">{selectedExperiment.results.latency.p50_ms}ms</p>
                  <p className="text-xs text-muted-foreground">P50</p>
                </div>
                <div>
                  <p className="text-xl font-bold">{selectedExperiment.results.latency.p95_ms}ms</p>
                  <p className="text-xs text-muted-foreground">P95</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
