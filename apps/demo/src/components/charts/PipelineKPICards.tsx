'use client';

import { AlertTriangle, Clock, Layers, Network, Timer, Zap } from 'lucide-react';

import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { PipelineMetrics, PipelineStage } from '@/types/pipeline';

interface PipelineKPICardsProps {
  stages: PipelineStage[];
  metrics: PipelineMetrics;
  totalDuration: number;
  bottleneckStage?: string;
  className?: string;
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

interface KPICardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  variant?: 'default' | 'warning' | 'success';
}

function KPICard({ title, value, subtitle, icon, variant = 'default' }: KPICardProps) {
  return (
    <Card
      className={cn(
        'relative overflow-hidden',
        variant === 'warning' && 'border-orange-200 dark:border-orange-800',
        variant === 'success' && 'border-green-200 dark:border-green-800'
      )}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-muted-foreground truncate">{title}</p>
            <p
              className={cn(
                'mt-1 text-xl font-bold truncate',
                variant === 'warning' && 'text-orange-600 dark:text-orange-400',
                variant === 'success' && 'text-green-600 dark:text-green-400'
              )}
            >
              {value}
            </p>
            {subtitle && (
              <p className="mt-0.5 text-[10px] text-muted-foreground truncate">{subtitle}</p>
            )}
          </div>
          <div
            className={cn(
              'p-2 rounded-lg',
              variant === 'default' && 'bg-muted',
              variant === 'warning' && 'bg-orange-100 dark:bg-orange-900/30',
              variant === 'success' && 'bg-green-100 dark:bg-green-900/30'
            )}
          >
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function PipelineKPICards({
  stages,
  metrics,
  totalDuration,
  bottleneckStage,
  className,
}: PipelineKPICardsProps) {
  // Find bottleneck stage details
  const bottleneck = stages.find((s) => s.id === bottleneckStage);
  const bottleneckPercentage = bottleneck?.percentage || 0;

  // Calculate throughput (objects per second)
  const throughput =
    totalDuration > 0 ? (metrics.objects / (totalDuration / 1000)).toFixed(1) : '0';

  // Calculate efficiency (non-bottleneck time percentage)
  const efficiency = 100 - bottleneckPercentage;

  return (
    <div className={cn('grid grid-cols-2 lg:grid-cols-4 gap-3', className)}>
      {/* Total Duration */}
      <KPICard
        title="Total Duration"
        value={formatDuration(totalDuration)}
        subtitle={`${stages.filter((s) => s.status === 'completed').length}/${stages.length} stages`}
        icon={<Clock className="h-4 w-4 text-muted-foreground" />}
      />

      {/* Bottleneck */}
      <KPICard
        title="Bottleneck"
        value={bottleneck?.label || 'None'}
        subtitle={`${bottleneckPercentage.toFixed(1)}% of total time`}
        icon={<AlertTriangle className="h-4 w-4 text-orange-500" />}
        variant="warning"
      />

      {/* Throughput */}
      <KPICard
        title="Throughput"
        value={`${throughput}/s`}
        subtitle={`${metrics.objects} objects processed`}
        icon={<Zap className="h-4 w-4 text-muted-foreground" />}
      />

      {/* Efficiency */}
      <KPICard
        title="Efficiency"
        value={`${efficiency.toFixed(0)}%`}
        subtitle="Non-bottleneck time"
        icon={<Timer className="h-4 w-4 text-green-500" />}
        variant={efficiency >= 50 ? 'success' : 'default'}
      />

      {/* Objects & Chunks */}
      <KPICard
        title="Data Volume"
        value={metrics.chunks}
        subtitle={`${metrics.objects} objects, ${metrics.chunks} chunks`}
        icon={<Layers className="h-4 w-4 text-muted-foreground" />}
      />

      {/* Relations */}
      <KPICard
        title="Knowledge Graph"
        value={metrics.relations}
        subtitle={`${metrics.clusters} clusters`}
        icon={<Network className="h-4 w-4 text-muted-foreground" />}
      />

      {/* Duplicates Removed */}
      {metrics.duplicatesRemoved > 0 && (
        <KPICard
          title="Deduplication"
          value={metrics.duplicatesRemoved}
          subtitle="Duplicates removed"
          icon={<Layers className="h-4 w-4 text-green-500" />}
          variant="success"
        />
      )}

      {/* Embed Tokens (if available) */}
      {metrics.embedTokens && (
        <KPICard
          title="Embed Tokens"
          value={metrics.embedTokens.toLocaleString()}
          subtitle="OpenAI tokens used"
          icon={<Zap className="h-4 w-4 text-muted-foreground" />}
        />
      )}
    </div>
  );
}
