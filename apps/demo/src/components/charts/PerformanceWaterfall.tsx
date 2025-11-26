'use client';

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer } from '@/components/ui/chart';
import type { PipelineStage } from '@/types/pipeline';

interface PerformanceWaterfallProps {
  stages: PipelineStage[];
  totalDuration: number;
  bottleneckStage?: string;
  compact?: boolean;
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

// Color scale based on duration percentage
function getBarColor(percentage: number, isBottleneck: boolean): string {
  if (isBottleneck) return 'hsl(25, 95%, 53%)'; // Orange for bottleneck
  if (percentage >= 30) return 'hsl(0, 84%, 60%)'; // Red for high
  if (percentage >= 15) return 'hsl(38, 92%, 50%)'; // Amber for medium
  if (percentage >= 5) return 'hsl(48, 96%, 53%)'; // Yellow for low-medium
  return 'hsl(142, 71%, 45%)'; // Green for low
}

export default function PerformanceWaterfall({
  stages,
  totalDuration,
  bottleneckStage,
  compact = false,
}: PerformanceWaterfallProps) {
  // Transform data for waterfall chart
  const chartData = stages.map((stage) => ({
    name: stage.label,
    id: stage.id,
    duration: stage.duration || 0,
    startTime: stage.startTime || 0,
    count: stage.count || 0,
    percentage: stage.percentage || 0,
    isBottleneck: stage.id === bottleneckStage,
  }));

  const chartConfig = {
    duration: {
      label: 'Duration',
      color: 'hsl(var(--chart-1))',
    },
  };

  const chartHeight = compact ? 200 : 300;

  if (chartData.length === 0) {
    return (
      <Card>
        <CardHeader className={compact ? 'pb-2' : ''}>
          <CardTitle className="text-sm font-semibold leading-tight">
            Performance Waterfall
          </CardTitle>
          {!compact && (
            <CardDescription className="text-xs leading-[1.5] mt-1">
              No pipeline data available
            </CardDescription>
          )}
        </CardHeader>
        <CardContent className="flex items-center justify-center h-[200px]">
          <p className="text-muted-foreground text-xs">Run the pipeline to see performance data</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className={compact ? 'pb-2' : ''}>
        <CardTitle className="text-sm font-semibold leading-tight">Performance Waterfall</CardTitle>
        {!compact && (
          <CardDescription className="text-xs leading-[1.5] mt-1">
            Stage execution times | Total: {formatDuration(totalDuration)}
          </CardDescription>
        )}
      </CardHeader>
      <CardContent className={compact ? 'pt-0' : ''}>
        <ChartContainer config={chartConfig} className={`h-[${chartHeight}px] w-full`}>
          <ResponsiveContainer width="100%" height={chartHeight}>
            <BarChart
              data={chartData}
              layout="vertical"
              margin={{ top: 5, right: 30, left: 60, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
              <XAxis
                type="number"
                stroke="hsl(var(--muted-foreground))"
                fontSize={10}
                tickLine={false}
                axisLine={false}
                tickFormatter={(value) => formatDuration(value)}
                domain={[0, 'dataMax']}
              />
              <YAxis
                type="category"
                dataKey="name"
                stroke="hsl(var(--muted-foreground))"
                fontSize={10}
                tickLine={false}
                axisLine={false}
                width={55}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload || payload.length === 0) return null;

                  const data = payload[0].payload;
                  return (
                    <div className="rounded-lg border bg-background p-2 shadow-lg">
                      <div className="grid gap-1.5">
                        <div className="flex items-center justify-between gap-4">
                          <span className="text-xs font-medium">{data.name}</span>
                          {data.isBottleneck && (
                            <span className="text-[10px] px-1.5 py-0.5 bg-orange-500 text-white rounded">
                              BOTTLENECK
                            </span>
                          )}
                        </div>
                        <div className="grid gap-1 text-xs">
                          <div className="flex items-center justify-between gap-4">
                            <span className="text-muted-foreground">Duration:</span>
                            <span className="font-mono font-medium">
                              {formatDuration(data.duration)}
                            </span>
                          </div>
                          <div className="flex items-center justify-between gap-4">
                            <span className="text-muted-foreground">Share:</span>
                            <span className="font-mono">{data.percentage.toFixed(1)}%</span>
                          </div>
                          <div className="flex items-center justify-between gap-4">
                            <span className="text-muted-foreground">Items:</span>
                            <span className="font-mono">{data.count}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                }}
              />
              <Bar dataKey="duration" radius={[0, 4, 4, 0]}>
                {chartData.map((entry) => (
                  <Cell
                    key={entry.id}
                    fill={getBarColor(entry.percentage, entry.isBottleneck)}
                    stroke={entry.isBottleneck ? 'hsl(25, 95%, 40%)' : undefined}
                    strokeWidth={entry.isBottleneck ? 2 : 0}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartContainer>

        {/* Color legend */}
        {!compact && (
          <div className="mt-3 flex items-center justify-center gap-4 text-[10px] text-muted-foreground">
            <div className="flex items-center gap-1">
              <div
                className="h-2 w-4 rounded-sm"
                style={{ backgroundColor: 'hsl(142, 71%, 45%)' }}
              />
              <span>&lt;5%</span>
            </div>
            <div className="flex items-center gap-1">
              <div
                className="h-2 w-4 rounded-sm"
                style={{ backgroundColor: 'hsl(48, 96%, 53%)' }}
              />
              <span>5-15%</span>
            </div>
            <div className="flex items-center gap-1">
              <div
                className="h-2 w-4 rounded-sm"
                style={{ backgroundColor: 'hsl(38, 92%, 50%)' }}
              />
              <span>15-30%</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="h-2 w-4 rounded-sm" style={{ backgroundColor: 'hsl(0, 84%, 60%)' }} />
              <span>&gt;30%</span>
            </div>
            <div className="flex items-center gap-1">
              <div
                className="h-2 w-4 rounded-sm border-2"
                style={{ backgroundColor: 'hsl(25, 95%, 53%)', borderColor: 'hsl(25, 95%, 40%)' }}
              />
              <span>Bottleneck</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
