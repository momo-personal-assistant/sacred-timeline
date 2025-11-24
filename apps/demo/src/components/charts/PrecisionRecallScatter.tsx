'use client';

import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  ZAxis,
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

interface PrecisionRecallScatterProps {
  experiments: Experiment[];
  onExperimentClick?: (experiment: Experiment) => void;
}

export default function PrecisionRecallScatter({
  experiments,
  onExperimentClick,
}: PrecisionRecallScatterProps) {
  // Transform data for scatter plot
  const experimentsWithResults = experiments.filter(
    (exp): exp is Experiment & { results: ExperimentResults } => exp.results !== null
  );

  const scatterData = experimentsWithResults.map((exp) => ({
    x: Number((exp.results.precision * 100).toFixed(1)),
    y: Number((exp.results.recall * 100).toFixed(1)),
    z: exp.results.retrieval_time_ms,
    f1: Number((exp.results.f1_score * 100).toFixed(1)),
    name: exp.name,
    isBaseline: exp.is_baseline,
    experiment: exp,
  }));

  if (scatterData.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold leading-tight">
            Precision vs Recall Trade-off
          </CardTitle>
          <CardDescription className="text-xs leading-[1.5] mt-1">
            No experiment data available
          </CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-[300px]">
          <p className="text-muted-foreground text-xs leading-[1.5]">
            Run experiments to see trade-offs
          </p>
        </CardContent>
      </Card>
    );
  }

  const chartConfig = {
    scatter: {
      label: 'Experiments',
      color: 'hsl(12, 76%, 61%)', // chart-1
    },
  };

  // Get color based on F1 score (gradient from red to green)
  const getPointColor = (f1: number, isBaseline: boolean) => {
    if (isBaseline) {
      return 'hsl(173, 58%, 39%)'; // chart-2 teal for baseline
    }

    // F1 score gradient
    if (f1 >= 70) return 'hsl(142, 76%, 36%)'; // green
    if (f1 >= 60) return 'hsl(43, 74%, 66%)'; // yellow
    if (f1 >= 50) return 'hsl(27, 87%, 67%)'; // orange
    return 'hsl(0, 84%, 60%)'; // red
  };

  // Calculate point size based on retrieval time (faster = smaller)
  const getPointSize = (time_ms: number) => {
    const maxTime = Math.max(...scatterData.map((d) => d.z));
    const minTime = Math.min(...scatterData.map((d) => d.z));
    const normalized = (time_ms - minTime) / (maxTime - minTime || 1);
    return 200 + normalized * 300; // Range from 200 to 500
  };

  const handlePointClick = (data: { experiment?: Experiment }) => {
    if (data?.experiment && onExperimentClick) {
      onExperimentClick(data.experiment);
    }
  };

  // Custom shape to show colored circles
  const CustomDot = (props: {
    cx?: number;
    cy?: number;
    payload?: { z: number; f1: number; isBaseline: boolean; experiment?: Experiment };
  }) => {
    const { cx, cy, payload } = props;
    if (!cx || !cy || !payload) return null;

    const size = getPointSize(payload.z) / 50; // Scale down for display
    const color = getPointColor(payload.f1, payload.isBaseline);

    return (
      <circle
        cx={cx}
        cy={cy}
        r={size}
        fill={color}
        fillOpacity={0.7}
        stroke={color}
        strokeWidth={2}
        cursor="pointer"
        onClick={() => handlePointClick(payload)}
      />
    );
  };

  return (
    <Card>
      <CardHeader>
        <div className="inline-flex items-center justify-between w-full">
          <div>
            <CardTitle className="text-sm font-semibold leading-tight">
              Precision vs Recall Trade-off
            </CardTitle>
            <CardDescription className="text-xs leading-[1.5] mt-1">
              Point size = speed (smaller = faster) • Color = F1 score
            </CardDescription>
          </div>
          <div className="inline-flex gap-2 text-xs">
            <div className="inline-flex items-center gap-1">
              <div className="w-3 h-3 rounded-full bg-[hsl(142,76%,36%)]" />
              <span className="text-muted-foreground leading-[1.5]">&gt;70%</span>
            </div>
            <div className="inline-flex items-center gap-1">
              <div className="w-3 h-3 rounded-full bg-[hsl(43,74%,66%)]" />
              <span className="text-muted-foreground leading-[1.5]">60-70%</span>
            </div>
            <div className="inline-flex items-center gap-1">
              <div className="w-3 h-3 rounded-full bg-[hsl(0,84%,60%)]" />
              <span className="text-muted-foreground leading-[1.5]">&lt;60%</span>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
              <XAxis
                type="number"
                dataKey="x"
                name="Precision"
                stroke="hsl(var(--muted-foreground))"
                fontSize={12}
                tickLine={false}
                axisLine={false}
                domain={[0, 100]}
                ticks={[0, 20, 40, 60, 80, 100]}
                tickFormatter={(value) => `${value}%`}
                label={{
                  value: 'Precision',
                  position: 'insideBottom',
                  offset: -10,
                  style: { fontSize: 12, fill: 'hsl(var(--muted-foreground))' },
                }}
              />
              <YAxis
                type="number"
                dataKey="y"
                name="Recall"
                stroke="hsl(var(--muted-foreground))"
                fontSize={12}
                tickLine={false}
                axisLine={false}
                domain={[0, 100]}
                ticks={[0, 20, 40, 60, 80, 100]}
                tickFormatter={(value) => `${value}%`}
                label={{
                  value: 'Recall',
                  angle: -90,
                  position: 'insideLeft',
                  style: { fontSize: 12, fill: 'hsl(var(--muted-foreground))' },
                }}
              />
              <ZAxis type="number" dataKey="z" range={[200, 500]} />

              {/* Reference lines for ideal region */}
              <ReferenceLine
                x={60}
                stroke="hsl(var(--muted-foreground))"
                strokeDasharray="3 3"
                opacity={0.3}
              />
              <ReferenceLine
                y={60}
                stroke="hsl(var(--muted-foreground))"
                strokeDasharray="3 3"
                opacity={0.3}
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
                            <span className="text-xs leading-[1.5]">Precision:</span>
                            <span className="text-xs font-mono leading-[1.5]">{data.x}%</span>
                          </div>
                          <div className="inline-flex items-center justify-between gap-4 w-full">
                            <span className="text-xs leading-[1.5]">Recall:</span>
                            <span className="text-xs font-mono leading-[1.5]">{data.y}%</span>
                          </div>
                          <div className="inline-flex items-center justify-between gap-4 w-full">
                            <span className="text-xs text-muted-foreground leading-[1.5]">
                              Speed:
                            </span>
                            <span className="text-xs font-mono leading-[1.5]">{data.z}ms</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                }}
              />

              <Scatter
                name="Experiments"
                data={scatterData}
                fill="hsl(12, 76%, 61%)"
                shape={<CustomDot />}
              />
            </ScatterChart>
          </ResponsiveContainer>
        </ChartContainer>

        <div className="mt-4 text-xs text-muted-foreground text-center">
          <p className="leading-[1.5]">Ideal region: High precision + High recall (top-right)</p>
        </div>
      </CardContent>
    </Card>
  );
}
