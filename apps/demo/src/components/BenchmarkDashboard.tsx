'use client';

import { AlertCircle, CheckCircle, Clock, RefreshCw, Terminal } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface QueryResult {
  query_text: string;
  f1_score: number;
  precision: number;
  recall: number;
  expected_count: number;
  found_count: number;
  status: string;
  retrieval_time_ms: number;
}

interface BenchmarkRun {
  id: number;
  run_at: string;
  overall_f1: number;
  overall_precision: number;
  overall_recall: number;
  total_queries: number;
  passed_queries: number;
  pipeline_stats: {
    chunking?: { total_chunks: number; avg_size: number; duration_ms: number };
    embedding?: { total_tokens: number; cost_usd: number; duration_ms: number };
    retrieval?: { avg_time_ms: number };
  } | null;
  duration_ms: number;
}

interface BenchmarkData {
  run: BenchmarkRun;
  queries: QueryResult[];
}

function getStatusIcon(status: string) {
  if (status === 'pass') return <CheckCircle className="h-4 w-4 text-green-500" />;
  if (status === 'warning') return <AlertCircle className="h-4 w-4 text-yellow-500" />;
  return <AlertCircle className="h-4 w-4 text-red-500" />;
}

function getScoreColor(score: number): string {
  if (score >= 0.8) return 'text-green-600';
  if (score >= 0.5) return 'text-yellow-600';
  return 'text-red-600';
}

function formatTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  return date.toLocaleDateString();
}

export default function BenchmarkDashboard() {
  const [data, setData] = useState<BenchmarkData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/benchmark/latest');
      const json = await res.json();
      if (json.success && json.data) {
        setData(json.data);
      } else {
        setData(null);
      }
    } catch (err) {
      setError('Failed to fetch benchmark data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <Card className="border-destructive">
        <CardContent className="pt-6">
          <p className="text-destructive">{error}</p>
        </CardContent>
      </Card>
    );
  }

  if (!data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>No Benchmark Results</CardTitle>
          <CardDescription>Run the benchmark script to see results here.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="bg-muted rounded-lg p-4 font-mono text-sm">
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <Terminal className="h-4 w-4" />
              <span>Terminal</span>
            </div>
            <code>pnpm tsx scripts/run-gt-benchmark.ts</code>
          </div>
        </CardContent>
      </Card>
    );
  }

  const { run, queries } = data;

  return (
    <div className="space-y-6">
      {/* Header with refresh */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Benchmark Status</h2>
          <p className="text-muted-foreground">
            Last run: {formatTime(run.run_at)} ({run.duration_ms}ms)
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchData}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Overall Score */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Overall F1 Score</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <span className={`text-4xl font-bold ${getScoreColor(run.overall_f1)}`}>
              {(run.overall_f1 * 100).toFixed(0)}%
            </span>
            <div className="flex-1 h-3 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all"
                style={{ width: `${run.overall_f1 * 100}%` }}
              />
            </div>
          </div>
          <div className="flex gap-6 mt-4 text-sm text-muted-foreground">
            <span>
              Precision:{' '}
              <strong className={getScoreColor(run.overall_precision)}>
                {(run.overall_precision * 100).toFixed(0)}%
              </strong>
            </span>
            <span>
              Recall:{' '}
              <strong className={getScoreColor(run.overall_recall)}>
                {(run.overall_recall * 100).toFixed(0)}%
              </strong>
            </span>
            <span>
              Passed:{' '}
              <strong>
                {run.passed_queries}/{run.total_queries}
              </strong>
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Query Results */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Benchmark Queries</CardTitle>
          <CardDescription>Individual query performance</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {queries.map((q, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
              >
                <div className="flex items-center gap-3">
                  {getStatusIcon(q.status)}
                  <div>
                    <p className="font-medium">{q.query_text}</p>
                    <p className="text-sm text-muted-foreground">
                      Found {q.found_count}/{q.expected_count} documents
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className={`font-bold ${getScoreColor(q.f1_score)}`}>
                      {(q.f1_score * 100).toFixed(0)}%
                    </p>
                    <p className="text-xs text-muted-foreground">F1</p>
                  </div>
                  <Badge
                    variant={
                      q.status === 'pass'
                        ? 'default'
                        : q.status === 'warning'
                          ? 'secondary'
                          : 'destructive'
                    }
                  >
                    {q.status}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Pipeline Stats */}
      {run.pipeline_stats && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Pipeline Stats</CardTitle>
            <CardDescription>Resource usage from last run</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              {run.pipeline_stats.chunking && (
                <div className="p-4 rounded-lg bg-muted/50">
                  <p className="font-medium mb-1">Chunking</p>
                  <p className="text-2xl font-bold">{run.pipeline_stats.chunking.total_chunks}</p>
                  <p className="text-sm text-muted-foreground">
                    chunks (avg {run.pipeline_stats.chunking.avg_size} chars)
                  </p>
                  <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    {run.pipeline_stats.chunking.duration_ms}ms
                  </div>
                </div>
              )}
              {run.pipeline_stats.embedding && (
                <div className="p-4 rounded-lg bg-muted/50">
                  <p className="font-medium mb-1">Embedding</p>
                  <p className="text-2xl font-bold">
                    {run.pipeline_stats.embedding.total_tokens.toLocaleString()}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    tokens (${run.pipeline_stats.embedding.cost_usd.toFixed(4)})
                  </p>
                  <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    {run.pipeline_stats.embedding.duration_ms}ms
                  </div>
                </div>
              )}
              {run.pipeline_stats.retrieval && (
                <div className="p-4 rounded-lg bg-muted/50">
                  <p className="font-medium mb-1">Retrieval</p>
                  <p className="text-2xl font-bold">{run.pipeline_stats.retrieval.avg_time_ms}ms</p>
                  <p className="text-sm text-muted-foreground">avg query time</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* CLI Instructions */}
      <Card className="bg-muted/30">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <Terminal className="h-5 w-5 text-muted-foreground mt-0.5" />
            <div>
              <p className="font-medium mb-1">Run benchmark from CLI</p>
              <code className="text-sm bg-background px-2 py-1 rounded">
                pnpm tsx scripts/run-gt-benchmark.ts
              </code>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
