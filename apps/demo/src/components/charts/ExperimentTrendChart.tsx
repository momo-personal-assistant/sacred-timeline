'use client';

import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface ExperimentResults {
  f1_score: number;
  precision: number;
  recall: number;
}

interface Experiment {
  id: number;
  name: string;
  created_at: string;
  results: ExperimentResults | null;
}

interface ExperimentTrendChartProps {
  experiments: Experiment[];
  currentExperimentId: number;
  className?: string;
}

export default function ExperimentTrendChart({
  experiments,
  currentExperimentId,
  className,
}: ExperimentTrendChartProps) {
  // Sort experiments by created_at (oldest first) for chronological trend
  const sortedExperiments = [...experiments].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );

  // Prepare chart data - show all experiments chronologically
  const chartData = sortedExperiments
    .filter((exp) => exp.results !== null)
    .map((exp) => ({
      name: exp.name.length > 15 ? `${exp.name.substring(0, 12)}...` : exp.name,
      fullName: exp.name,
      f1: exp.results ? +(exp.results.f1_score * 100).toFixed(1) : 0,
      precision: exp.results ? +(exp.results.precision * 100).toFixed(1) : 0,
      recall: exp.results ? +(exp.results.recall * 100).toFixed(1) : 0,
      isCurrent: exp.id === currentExperimentId,
    }));

  if (chartData.length === 0) return null;

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-card border border-border rounded-lg p-3 shadow-lg">
          <p className="font-medium text-sm mb-2">{data.fullName}</p>
          <div className="space-y-1 text-xs">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-blue-500" />
              <span className="text-muted-foreground">F1:</span>
              <span className="font-mono font-medium">{data.f1}%</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-green-500" />
              <span className="text-muted-foreground">Precision:</span>
              <span className="font-mono font-medium">{data.precision}%</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-orange-500" />
              <span className="text-muted-foreground">Recall:</span>
              <span className="font-mono font-medium">{data.recall}%</span>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium">Performance Trend</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="colorF1" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="rgb(59, 130, 246)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="rgb(59, 130, 246)" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="colorPrecision" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="rgb(34, 197, 94)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="rgb(34, 197, 94)" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="colorRecall" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="rgb(249, 115, 22)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="rgb(249, 115, 22)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" opacity={0.3} />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 11 }}
              className="text-muted-foreground"
              axisLine={{ className: 'stroke-muted' }}
            />
            <YAxis
              domain={[0, 100]}
              tick={{ fontSize: 11 }}
              className="text-muted-foreground"
              axisLine={{ className: 'stroke-muted' }}
              tickFormatter={(value) => `${value}%`}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }}
              iconType="circle"
              iconSize={8}
            />
            <Area
              type="monotone"
              dataKey="f1"
              name="F1"
              stroke="rgb(59, 130, 246)"
              fill="url(#colorF1)"
              strokeWidth={2}
            />
            <Area
              type="monotone"
              dataKey="precision"
              name="Precision"
              stroke="rgb(34, 197, 94)"
              fill="url(#colorPrecision)"
              strokeWidth={2}
            />
            <Area
              type="monotone"
              dataKey="recall"
              name="Recall"
              stroke="rgb(249, 115, 22)"
              fill="url(#colorRecall)"
              strokeWidth={2}
            />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
