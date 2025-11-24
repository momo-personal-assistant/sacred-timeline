'use client';

import { format } from 'date-fns';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';

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

interface ExperimentTimelineChartProps {
  experiments: Experiment[];
  onExperimentClick?: (experiment: Experiment) => void;
}

export default function ExperimentTimelineChart({
  experiments,
  onExperimentClick,
}: ExperimentTimelineChartProps) {
  // Transform data for timeline
  const experimentsWithResults = experiments.filter(
    (exp): exp is Experiment & { results: ExperimentResults } => exp.results !== null
  );

  const timelineData = experimentsWithResults
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
    .map((exp, index) => ({
      index,
      date: format(new Date(exp.created_at), 'MMM dd HH:mm'),
      dateShort: format(new Date(exp.created_at), 'MMM dd'),
      f1: Number((exp.results.f1_score * 100).toFixed(1)),
      precision: Number((exp.results.precision * 100).toFixed(1)),
      recall: Number((exp.results.recall * 100).toFixed(1)),
      name: exp.name,
      isBaseline: exp.is_baseline,
      experiment: exp,
    }));

  if (timelineData.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold leading-tight">
            Performance Timeline
          </CardTitle>
          <CardDescription className="text-xs leading-[1.5] mt-1">
            No experiment data available
          </CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-[300px]">
          <p className="text-muted-foreground text-xs leading-[1.5]">
            Run experiments to see performance trends
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
    precision: {
      label: 'Precision',
      color: 'hsl(173, 58%, 39%)', // chart-2
    },
    recall: {
      label: 'Recall',
      color: 'hsl(197, 37%, 24%)', // chart-3
    },
  };

  const handlePointClick = (data: { experiment?: Experiment }) => {
    if (data?.experiment && onExperimentClick) {
      onExperimentClick(data.experiment);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-semibold leading-tight">Performance Timeline</CardTitle>
        <CardDescription className="text-xs leading-[1.5] mt-1">
          F1 Score progression over time • {timelineData.length} experiments
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={timelineData} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
              <XAxis
                dataKey="dateShort"
                stroke="hsl(var(--muted-foreground))"
                fontSize={12}
                tickLine={false}
                axisLine={false}
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
                          <span className="text-xs font-medium leading-[1.5]">{data.name}</span>
                          {data.isBaseline && (
                            <span className="text-xs text-muted-foreground leading-[1.5]">
                              BASELINE
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground leading-[1.5]">
                          {data.date}
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
                      </div>
                    </div>
                  );
                }}
              />

              <Legend
                verticalAlign="top"
                height={36}
                iconType="line"
                wrapperStyle={{ paddingBottom: '10px' }}
              />

              <Line
                type="monotone"
                dataKey="f1"
                stroke={chartConfig.f1.color}
                strokeWidth={3}
                dot={{
                  r: 5,
                  strokeWidth: 2,
                  fill: 'white',
                  cursor: 'pointer',
                }}
                activeDot={{
                  r: 7,
                  onClick: handlePointClick,
                  cursor: 'pointer',
                }}
                name="F1 Score"
              />

              <Line
                type="monotone"
                dataKey="precision"
                stroke={chartConfig.precision.color}
                strokeWidth={2}
                strokeDasharray="5 5"
                dot={false}
                activeDot={{ r: 5 }}
                name="Precision"
                opacity={0.6}
              />

              <Line
                type="monotone"
                dataKey="recall"
                stroke={chartConfig.recall.color}
                strokeWidth={2}
                strokeDasharray="5 5"
                dot={false}
                activeDot={{ r: 5 }}
                name="Recall"
                opacity={0.6}
              />
            </LineChart>
          </ResponsiveContainer>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
