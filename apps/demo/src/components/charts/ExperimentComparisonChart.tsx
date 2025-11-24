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

interface Experiment {
  id: number;
  name: string;
  is_baseline: boolean;
  created_at: string;
  results: ExperimentResults | null;
  config: Record<string, unknown>;
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
          <CardTitle>Experiments Comparison</CardTitle>
          <CardDescription>No experiment data available</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-[300px]">
          <p className="text-muted-foreground">Run experiments to compare performance</p>
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
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Experiments Comparison</CardTitle>
            <CardDescription>Sorted by F1 Score • {barData.length} experiments</CardDescription>
          </div>
          <div className="flex gap-2 text-xs">
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded bg-[hsl(142,76%,36%)]" />
              <span className="text-muted-foreground">Best</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded bg-[hsl(173,58%,39%)]" />
              <span className="text-muted-foreground">Baseline</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded bg-[hsl(0,84%,60%)]" />
              <span className="text-muted-foreground">&lt;60%</span>
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
                        <div className="flex items-center justify-between gap-4">
                          <span className="text-xs font-medium">{data.fullName}</span>
                          {data.isBaseline && (
                            <Badge variant="outline" className="text-xs">
                              BASE
                            </Badge>
                          )}
                        </div>
                        <div className="grid gap-1">
                          <div className="flex items-center justify-between gap-4">
                            <span className="text-xs">F1 Score:</span>
                            <span className="text-xs font-mono font-medium">{data.f1}%</span>
                          </div>
                          <div className="flex items-center justify-between gap-4">
                            <span className="text-xs text-muted-foreground">Precision:</span>
                            <span className="text-xs font-mono">{data.precision}%</span>
                          </div>
                          <div className="flex items-center justify-between gap-4">
                            <span className="text-xs text-muted-foreground">Recall:</span>
                            <span className="text-xs font-mono">{data.recall}%</span>
                          </div>
                        </div>
                        {data.f1 === bestF1 && data.f1 >= 60 && (
                          <Badge className="bg-green-600 text-white text-xs">BEST PERFORMER</Badge>
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
