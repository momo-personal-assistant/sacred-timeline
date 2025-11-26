'use client';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  ReferenceLine,
} from 'recharts';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer } from '@/components/ui/chart';

interface ExperimentResults {
  f1_score: number;
  precision: number;
  recall: number;
  true_positives: number;
  false_positives: number;
  false_negatives: number;
  retrieval_time_ms: number;
}

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

interface ExperimentComparisonChartProps {
  experiments: Experiment[];
  onExperimentClick?: (experiment: Experiment) => void;
}

export default function ExperimentComparisonChart({
  experiments,
  onExperimentClick,
}: ExperimentComparisonChartProps) {
  // Transform and sort data by F1 score
  const experimentsWithResults = experiments.filter(
    (exp): exp is Experiment & { results: ExperimentResults } => exp.results !== null
  );

  const barData = experimentsWithResults
    .sort((a, b) => b.results.f1_score - a.results.f1_score)
    .map((exp) => ({
      name: exp.name.length > 15 ? exp.name.slice(0, 12) + '...' : exp.name,
      fullName: exp.name,
      f1: Number((exp.results.f1_score * 100).toFixed(1)),
      precision: Number((exp.results.precision * 100).toFixed(1)),
      recall: Number((exp.results.recall * 100).toFixed(1)),
      isBaseline: exp.is_baseline,
      experiment: exp,
    }));

  if (barData.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold leading-tight">
            Experiments Comparison
          </CardTitle>
          <CardDescription className="text-xs leading-[1.5] mt-1">
            No experiment data available
          </CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-[300px]">
          <p className="text-muted-foreground text-xs leading-[1.5]">
            Run experiments to compare performance
          </p>
        </CardContent>
      </Card>
    );
  }

  const chartConfig = {
    f1: {
      label: 'F1 Score',
      color: 'hsl(12, 76%, 61%)', // chart-1
    },
  };

  // Find best performer for highlighting
  const bestF1 = Math.max(...barData.map((d) => d.f1));

  const getBarColor = (value: number, isBaseline: boolean) => {
    if (value === bestF1 && value >= 60) {
      return 'hsl(142, 76%, 36%)'; // success green
    }
    if (value < 60) {
      return 'hsl(0, 84%, 60%)'; // destructive red
    }
    if (isBaseline) {
      return 'hsl(173, 58%, 39%)'; // chart-2 teal
    }
    return 'hsl(12, 76%, 61%)'; // chart-1 blue
  };

  const handleBarClick = (data: { experiment?: Experiment }) => {
    if (data?.experiment && onExperimentClick) {
      onExperimentClick(data.experiment);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="inline-flex items-center justify-between w-full">
          <div>
            <CardTitle className="text-sm font-semibold leading-tight">
              Experiments Comparison
            </CardTitle>
            <CardDescription className="text-xs leading-[1.5] mt-1">
              Sorted by F1 Score • {barData.length} experiments
            </CardDescription>
          </div>
          <div className="inline-flex gap-2 text-xs">
            <div className="inline-flex items-center gap-1">
              <div className="w-3 h-3 rounded bg-[hsl(142,76%,36%)]" />
              <span className="text-muted-foreground leading-[1.5]">Best</span>
            </div>
            <div className="inline-flex items-center gap-1">
              <div className="w-3 h-3 rounded bg-[hsl(173,58%,39%)]" />
              <span className="text-muted-foreground leading-[1.5]">Baseline</span>
            </div>
            <div className="inline-flex items-center gap-1">
              <div className="w-3 h-3 rounded bg-[hsl(0,84%,60%)]" />
              <span className="text-muted-foreground leading-[1.5]">&lt;60%</span>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={barData} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
              <XAxis
                dataKey="name"
                stroke="hsl(var(--muted-foreground))"
                fontSize={12}
                tickLine={false}
                axisLine={false}
                angle={-45}
                textAnchor="end"
                height={80}
              />
              <YAxis
                stroke="hsl(var(--muted-foreground))"
                fontSize={12}
                tickLine={false}
                axisLine={false}
                domain={[0, 100]}
                ticks={[0, 20, 40, 60, 80, 100]}
                tickFormatter={(value) => `${value}%`}
              />

              {/* 60% threshold reference line */}
              <ReferenceLine
                y={60}
                stroke="hsl(var(--muted-foreground))"
                strokeDasharray="3 3"
                opacity={0.5}
                label={{
                  value: 'Target: 60%',
                  position: 'right',
                  fill: 'hsl(var(--muted-foreground))',
                  fontSize: 10,
                }}
              />

              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload || payload.length === 0) return null;

                  const data = payload[0].payload;
                  return (
                    <div className="rounded-lg border bg-background p-2 shadow-lg">
                      <div className="grid gap-2">
                        <div className="inline-flex items-center justify-between gap-4 w-full">
                          <span className="text-xs font-medium leading-[1.5]">{data.fullName}</span>
                          {data.isBaseline && (
                            <Badge
                              variant="outline"
                              className="text-xs h-[18px] inline-flex items-center font-medium"
                            >
                              BASE
                            </Badge>
                          )}
                        </div>
                        <div className="grid gap-1">
                          <div className="inline-flex items-center justify-between gap-4 w-full">
                            <span className="text-xs leading-[1.5]">F1 Score:</span>
                            <span className="text-xs font-mono font-medium leading-[1.5]">
                              {data.f1}%
                            </span>
                          </div>
                          <div className="inline-flex items-center justify-between gap-4 w-full">
                            <span className="text-xs text-muted-foreground leading-[1.5]">
                              Precision:
                            </span>
                            <span className="text-xs font-mono leading-[1.5]">
                              {data.precision}%
                            </span>
                          </div>
                          <div className="inline-flex items-center justify-between gap-4 w-full">
                            <span className="text-xs text-muted-foreground leading-[1.5]">
                              Recall:
                            </span>
                            <span className="text-xs font-mono leading-[1.5]">{data.recall}%</span>
                          </div>
                        </div>
                        {data.f1 === bestF1 && data.f1 >= 60 && (
                          <Badge className="bg-green-600 text-white text-xs h-[18px] inline-flex items-center font-medium">
                            BEST PERFORMER
                          </Badge>
                        )}
                      </div>
                    </div>
                  );
                }}
              />

              <Bar dataKey="f1" radius={[4, 4, 0, 0]} onClick={handleBarClick} cursor="pointer">
                {barData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={getBarColor(entry.f1, entry.isBaseline)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
