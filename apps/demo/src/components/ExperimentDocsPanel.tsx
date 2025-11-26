'use client';

import {
  CheckCircle2,
  Clock,
  FileEdit,
  FlaskConical,
  Loader2,
  Play,
  Star,
  Target,
  TrendingUp,
  XCircle,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import {
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
} from 'recharts';
import remarkGfm from 'remark-gfm';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer } from '@/components/ui/chart';
import { ScrollArea } from '@/components/ui/scroll-area';

type ExperimentStatus = 'draft' | 'running' | 'completed' | 'failed';

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
  status?: ExperimentStatus;
  config_file_path?: string;
  run_started_at?: string;
  run_completed_at?: string;
  error_message?: string;
}

interface ExperimentDoc {
  id: string;
  filename: string;
  title: string;
  date: string;
  status: string;
  decision: string;
  tags: string[];
  content: string;
  metadata: Record<string, unknown>;
  config_file?: string;
}

const statusConfig: Record<
  string,
  { icon: typeof CheckCircle2; color: string; label: string; bgColor: string }
> = {
  completed: {
    icon: CheckCircle2,
    color: 'text-green-600',
    label: 'Completed',
    bgColor: 'bg-green-500/10',
  },
  running: { icon: Loader2, color: 'text-blue-600', label: 'Running', bgColor: 'bg-blue-500/10' },
  draft: { icon: FileEdit, color: 'text-yellow-600', label: 'Draft', bgColor: 'bg-yellow-500/10' },
  failed: { icon: XCircle, color: 'text-red-600', label: 'Failed', bgColor: 'bg-red-500/10' },
};

function MetricCard({
  label,
  value,
  icon: Icon,
  trend,
  subtitle,
}: {
  label: string;
  value: string;
  icon: typeof Target;
  trend?: number;
  subtitle?: string;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary/10">
              <Icon className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="text-xl font-bold font-mono">{value}</p>
              {subtitle && <p className="text-[10px] text-muted-foreground">{subtitle}</p>}
            </div>
          </div>
          {trend !== undefined && (
            <Badge variant={trend >= 0 ? 'default' : 'destructive'} className="text-xs">
              {trend >= 0 ? '+' : ''}
              {trend.toFixed(1)}%
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function ExperimentDetailView({
  experiment,
  experimentDoc,
  baselineExperiment,
  onRun,
  onSetBaseline,
}: {
  experiment: Experiment;
  experimentDoc: ExperimentDoc | null;
  baselineExperiment: Experiment | null;
  onRun: () => void;
  onSetBaseline: () => void;
}) {
  const [isRunning, setIsRunning] = useState(false);
  const [isSettingBaseline, setIsSettingBaseline] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);

  const status = statusConfig[experiment.status || 'completed'];
  const StatusIcon = status.icon;
  const hasResults = experiment.results !== null;
  const isDraft = experiment.status === 'draft';
  const isExperimentRunning = experiment.status === 'running';

  // Calculate improvement vs baseline
  const improvementVsBaseline =
    baselineExperiment?.results && experiment.results && !experiment.is_baseline
      ? ((experiment.results.f1_score - baselineExperiment.results.f1_score) /
          baselineExperiment.results.f1_score) *
        100
      : null;

  const handleRun = async () => {
    setIsRunning(true);
    setRunError(null);
    try {
      const res = await fetch(`/api/experiments/${experiment.id}/run`, {
        method: 'POST',
      });
      const data = await res.json();
      if (res.ok) {
        onRun();
      } else {
        setRunError(data.error || 'Failed to run experiment');
      }
    } catch (error) {
      setRunError('Failed to run experiment');
    } finally {
      setIsRunning(false);
    }
  };

  const handleSetBaseline = async () => {
    setIsSettingBaseline(true);
    try {
      const res = await fetch(`/api/experiments/${experiment.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_baseline: true }),
      });
      if (res.ok) {
        onSetBaseline();
      }
    } catch (error) {
      console.error('Failed to set baseline:', error);
    } finally {
      setIsSettingBaseline(false);
    }
  };

  // Prepare radar chart data
  const results = experiment.results;
  const radarData =
    hasResults && results
      ? [
          { metric: 'F1', value: results.f1_score * 100, fullMark: 100 },
          { metric: 'Precision', value: results.precision * 100, fullMark: 100 },
          { metric: 'Recall', value: results.recall * 100, fullMark: 100 },
          {
            metric: 'Speed',
            value: Math.max(0, 100 - results.retrieval_time_ms / 10),
            fullMark: 100,
          },
        ]
      : [];

  const chartConfig = {
    value: { label: 'Score', color: 'hsl(var(--chart-1))' },
  };

  // Extract TOC from markdown content
  const displayContent = experimentDoc?.content?.replace(/```yaml\n[\s\S]*?\n```\n*/, '') || '';
  const headings = displayContent.match(/^#{1,3}\s+.+$/gm) || [];
  const toc = headings.map((h) => {
    const level = h.match(/^#+/)?.[0].length || 1;
    const text = h.replace(/^#+\s+/, '');
    const id = text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
    return { level, text, id };
  });

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="flex h-full">
      {/* TOC Sidebar */}
      {toc.length > 0 && (
        <nav className="w-52 shrink-0 border-r p-4 hidden lg:block">
          <div className="sticky top-4 space-y-2">
            <div className="text-xs font-medium text-muted-foreground mb-3">On this page</div>
            {toc.map((item, i) => (
              <button
                key={i}
                onClick={() => scrollToSection(item.id)}
                className={`block text-left text-xs text-muted-foreground hover:text-foreground transition-colors truncate w-full ${
                  item.level === 1 ? 'font-medium' : item.level === 2 ? 'pl-2' : 'pl-4'
                }`}
              >
                {item.text}
              </button>
            ))}
          </div>
        </nav>
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Compact Header */}
        <div className="px-6 py-4 border-b shrink-0">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <Badge variant="outline" className={`${status.bgColor} ${status.color} shrink-0`}>
                <StatusIcon
                  className={`h-3 w-3 mr-1 ${experiment.status === 'running' ? 'animate-spin' : ''}`}
                />
                {status.label}
              </Badge>
              {experiment.is_baseline && (
                <Badge variant="default" className="bg-primary shrink-0">
                  <Star className="h-3 w-3 mr-1 fill-current" />
                  Baseline
                </Badge>
              )}
              <h1 className="text-lg font-semibold truncate">{experiment.name}</h1>
              <span className="text-xs text-muted-foreground shrink-0">
                {new Date(experiment.created_at).toLocaleDateString()}
              </span>
            </div>
            <div className="flex gap-2 shrink-0">
              {isDraft && (
                <Button onClick={handleRun} disabled={isRunning} size="sm">
                  {isRunning ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Play className="h-4 w-4" />
                  )}
                </Button>
              )}
              {!experiment.is_baseline && !isDraft && !isExperimentRunning && (
                <Button
                  variant="outline"
                  onClick={handleSetBaseline}
                  disabled={isSettingBaseline}
                  size="sm"
                >
                  <Star className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
          {runError && (
            <div className="mt-2 p-2 bg-destructive/10 rounded-md border border-destructive/20">
              <p className="text-xs text-destructive">{runError}</p>
            </div>
          )}
        </div>

        {/* Content */}
        <ScrollArea className="flex-1">
          <div className="p-6 space-y-6">
            {/* Metrics + Radar Chart in one row */}
            {hasResults && experiment.results && (
              <div className="flex gap-6">
                {/* Metrics Grid */}
                <div className="flex-1 grid grid-cols-2 gap-3">
                  <MetricCard
                    label="F1 Score"
                    value={`${(experiment.results.f1_score * 100).toFixed(1)}%`}
                    icon={Target}
                    trend={improvementVsBaseline ?? undefined}
                  />
                  <MetricCard
                    label="Precision"
                    value={`${(experiment.results.precision * 100).toFixed(1)}%`}
                    icon={CheckCircle2}
                    subtitle={`${experiment.results.true_positives} TP / ${experiment.results.false_positives} FP`}
                  />
                  <MetricCard
                    label="Recall"
                    value={`${(experiment.results.recall * 100).toFixed(1)}%`}
                    icon={TrendingUp}
                    subtitle={`${experiment.results.true_positives} TP / ${experiment.results.false_negatives} FN`}
                  />
                  <MetricCard
                    label="Response Time"
                    value={`${experiment.results.retrieval_time_ms}ms`}
                    icon={Clock}
                  />
                </div>

                {/* Radar Chart */}
                <Card className="w-[280px] shrink-0">
                  <CardContent className="p-4">
                    <ChartContainer config={chartConfig} className="h-[180px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <RadarChart
                          data={radarData}
                          margin={{ top: 10, right: 20, bottom: 10, left: 20 }}
                        >
                          <PolarGrid />
                          <PolarAngleAxis dataKey="metric" fontSize={10} />
                          <PolarRadiusAxis angle={30} domain={[0, 100]} fontSize={9} tick={false} />
                          <Radar
                            name="Score"
                            dataKey="value"
                            stroke="hsl(var(--chart-1))"
                            fill="hsl(var(--chart-1))"
                            fillOpacity={0.3}
                          />
                        </RadarChart>
                      </ResponsiveContainer>
                    </ChartContainer>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* No Results State */}
            {!hasResults && !experimentDoc && (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <FlaskConical className="h-12 w-12 text-muted-foreground/50 mb-4" />
                  <p className="text-sm text-muted-foreground mb-2">
                    {isDraft ? 'This experiment has not been run yet' : 'No results available'}
                  </p>
                  {isDraft && (
                    <Button onClick={handleRun} disabled={isRunning} size="sm">
                      {isRunning ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Play className="h-4 w-4 mr-2" />
                      )}
                      Run Experiment
                    </Button>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Failed Experiment Error */}
            {experiment.status === 'failed' && experiment.error_message && (
              <Card className="border-destructive">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-destructive">
                    Error Details
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <pre className="text-xs bg-destructive/5 p-3 rounded-lg overflow-x-auto whitespace-pre-wrap">
                    {experiment.error_message}
                  </pre>
                </CardContent>
              </Card>
            )}

            {/* Configuration */}
            {experiment.config && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Configuration</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
                    {experiment.config?.embedding && (
                      <div className="space-y-1">
                        <p className="font-medium text-muted-foreground">Embedding</p>
                        <p className="font-mono">{experiment.config.embedding.model}</p>
                        {experiment.config.embedding.dimensions && (
                          <p className="text-muted-foreground">
                            {experiment.config.embedding.dimensions}d
                          </p>
                        )}
                      </div>
                    )}
                    {experiment.config?.chunking && (
                      <div className="space-y-1">
                        <p className="font-medium text-muted-foreground">Chunking</p>
                        <p className="font-mono">{experiment.config.chunking.strategy}</p>
                        {experiment.config.chunking.maxChunkSize && (
                          <p className="text-muted-foreground">
                            max: {experiment.config.chunking.maxChunkSize}
                          </p>
                        )}
                      </div>
                    )}
                    {experiment.config?.relationInference && (
                      <div className="space-y-1">
                        <p className="font-medium text-muted-foreground">Relation Inference</p>
                        <p className="font-mono">
                          Semantic:{' '}
                          {experiment.config.relationInference.useSemanticSimilarity ? 'ON' : 'OFF'}
                        </p>
                        {experiment.config.relationInference.similarityThreshold !== undefined && (
                          <p className="text-muted-foreground">
                            threshold: {experiment.config.relationInference.similarityThreshold}
                          </p>
                        )}
                      </div>
                    )}
                    {experiment.config?.retrieval && (
                      <div className="space-y-1">
                        <p className="font-medium text-muted-foreground">Retrieval</p>
                        {experiment.config.retrieval.similarityThreshold !== undefined && (
                          <p className="font-mono">
                            threshold: {experiment.config.retrieval.similarityThreshold}
                          </p>
                        )}
                        {experiment.config.retrieval.chunkLimit && (
                          <p className="text-muted-foreground">
                            limit: {experiment.config.retrieval.chunkLimit}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Markdown Document Content */}
            {experimentDoc && displayContent && (
              <article className="prose prose-sm dark:prose-invert max-w-none">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    h1: ({ children }) => {
                      const text = String(children);
                      const id = text
                        .toLowerCase()
                        .replace(/[^a-z0-9]+/g, '-')
                        .replace(/(^-|-$)/g, '');
                      return (
                        <h1 id={id} className="text-2xl font-bold mt-8 mb-4">
                          {children}
                        </h1>
                      );
                    },
                    h2: ({ children }) => {
                      const text = String(children);
                      const id = text
                        .toLowerCase()
                        .replace(/[^a-z0-9]+/g, '-')
                        .replace(/(^-|-$)/g, '');
                      return (
                        <h2 id={id} className="text-xl font-semibold mt-6 mb-3 pb-2 border-b">
                          {children}
                        </h2>
                      );
                    },
                    h3: ({ children }) => {
                      const text = String(children);
                      const id = text
                        .toLowerCase()
                        .replace(/[^a-z0-9]+/g, '-')
                        .replace(/(^-|-$)/g, '');
                      return (
                        <h3 id={id} className="text-lg font-semibold mt-4 mb-2">
                          {children}
                        </h3>
                      );
                    },
                    h4: ({ children }) => (
                      <h4 className="text-base font-medium mt-3 mb-1">{children}</h4>
                    ),
                    code: ({ className, children, ...props }) => {
                      const isInline = !className;
                      if (isInline) {
                        return (
                          <code
                            className="bg-muted px-1.5 py-0.5 rounded text-sm font-mono"
                            {...props}
                          >
                            {children}
                          </code>
                        );
                      }
                      return (
                        <code className={className} {...props}>
                          {children}
                        </code>
                      );
                    },
                    pre: ({ children }) => (
                      <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-sm">
                        {children}
                      </pre>
                    ),
                    table: ({ children }) => (
                      <div className="overflow-x-auto my-4">
                        <table className="w-full border-collapse border border-border text-sm">
                          {children}
                        </table>
                      </div>
                    ),
                    th: ({ children }) => (
                      <th className="border border-border bg-muted px-3 py-2 text-left font-medium">
                        {children}
                      </th>
                    ),
                    td: ({ children }) => (
                      <td className="border border-border px-3 py-2">{children}</td>
                    ),
                    ul: ({ children }) => <ul className="list-disc pl-6 my-2">{children}</ul>,
                    ol: ({ children }) => <ol className="list-decimal pl-6 my-2">{children}</ol>,
                    li: ({ children }) => <li className="my-1">{children}</li>,
                    blockquote: ({ children }) => (
                      <blockquote className="border-l-4 border-primary/50 pl-4 italic text-muted-foreground my-4">
                        {children}
                      </blockquote>
                    ),
                  }}
                >
                  {displayContent}
                </ReactMarkdown>
              </article>
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}

interface ExperimentDocsPanelProps {
  selectedExperimentId?: number;
  experiments: Experiment[];
  onRefresh: () => void;
}

export default function ExperimentDocsPanel({
  selectedExperimentId,
  experiments,
  onRefresh,
}: ExperimentDocsPanelProps) {
  const [experimentDocs, setExperimentDocs] = useState<ExperimentDoc[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch experiment docs
  useEffect(() => {
    fetch('/api/experiment-docs')
      .then((res) => res.json())
      .then((data) => {
        setExperimentDocs(data.experiments || []);
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });
  }, []);

  const selectedExperiment = selectedExperimentId
    ? experiments.find((e) => e.id === selectedExperimentId) || null
    : experiments[0] || null;

  const baselineExperiment = experiments.find((exp) => exp.is_baseline) || null;

  // Find matching document for selected experiment
  const findMatchingDoc = (exp: Experiment | null): ExperimentDoc | null => {
    if (!exp) return null;
    const match = experimentDocs.find((doc) => {
      const docId = doc.id?.toUpperCase() || '';
      const expName = exp.name?.toUpperCase() || '';
      return expName.includes(docId) || docId.includes(expName.split(':')[0]?.trim() || '');
    });
    return match || null;
  };

  const selectedDoc = findMatchingDoc(selectedExperiment);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (experiments.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <FlaskConical className="h-12 w-12 text-muted-foreground/50" />
        <div className="text-center">
          <p className="font-medium text-muted-foreground">No experiments yet</p>
          <p className="text-sm text-muted-foreground mt-1">
            Run <code className="bg-muted px-1 rounded">pnpm run experiment</code> to create your
            first experiment
          </p>
        </div>
      </div>
    );
  }

  if (!selectedExperiment) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
        <FlaskConical className="h-12 w-12 mb-4 opacity-50" />
        <p className="text-sm">Select an experiment from the sidebar</p>
      </div>
    );
  }

  return (
    <ExperimentDetailView
      experiment={selectedExperiment}
      experimentDoc={selectedDoc}
      baselineExperiment={baselineExperiment}
      onRun={onRefresh}
      onSetBaseline={onRefresh}
    />
  );
}
