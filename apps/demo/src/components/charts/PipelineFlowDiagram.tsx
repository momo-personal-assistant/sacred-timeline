'use client';

import { ArrowRight, CheckCircle2, Circle, Loader2, XCircle } from 'lucide-react';

import { cn } from '@/lib/utils';
import type { PipelineStage, StageStatus } from '@/types/pipeline';

interface PipelineFlowDiagramProps {
  stages: PipelineStage[];
  bottleneckStage?: string;
  showDurations?: boolean;
  compact?: boolean;
  className?: string;
}

const statusConfig: Record<StageStatus, { icon: typeof Circle; color: string; bg: string }> = {
  pending: {
    icon: Circle,
    color: 'text-muted-foreground',
    bg: 'bg-muted',
  },
  running: {
    icon: Loader2,
    color: 'text-blue-500',
    bg: 'bg-blue-50 dark:bg-blue-950',
  },
  completed: {
    icon: CheckCircle2,
    color: 'text-green-600',
    bg: 'bg-green-50 dark:bg-green-950',
  },
  error: {
    icon: XCircle,
    color: 'text-red-500',
    bg: 'bg-red-50 dark:bg-red-950',
  },
};

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

function StageCard({
  stage,
  isBottleneck,
  showDuration,
  compact,
}: {
  stage: PipelineStage;
  isBottleneck: boolean;
  showDuration: boolean;
  compact: boolean;
}) {
  const config = statusConfig[stage.status];
  const Icon = config.icon;
  const isRunning = stage.status === 'running';

  return (
    <div
      className={cn(
        'relative flex flex-col rounded-lg border transition-all',
        compact ? 'p-2 min-w-[70px]' : 'p-3 min-w-[100px]',
        config.bg,
        isBottleneck && stage.status === 'completed' && 'ring-2 ring-orange-400 border-orange-400',
        stage.status === 'error' && 'border-red-400'
      )}
    >
      {/* Bottleneck indicator */}
      {isBottleneck && stage.status === 'completed' && (
        <div className="absolute -top-2 left-1/2 -translate-x-1/2 px-1.5 py-0.5 bg-orange-500 text-white text-[9px] font-medium rounded">
          BOTTLENECK
        </div>
      )}

      {/* Stage name and icon */}
      <div className="flex items-center gap-1.5">
        <Icon
          className={cn('h-3.5 w-3.5', config.color, isRunning && 'animate-spin')}
          strokeWidth={2.5}
        />
        <span className={cn('font-medium', compact ? 'text-[10px]' : 'text-xs')}>
          {stage.label}
        </span>
      </div>

      {/* Stats */}
      {showDuration && stage.status === 'completed' && (
        <div className={cn('mt-1 flex flex-col gap-0.5', compact ? 'text-[9px]' : 'text-[10px]')}>
          <div className="flex items-center justify-between text-muted-foreground">
            <span>Time:</span>
            <span className="font-mono">{formatDuration(stage.duration || 0)}</span>
          </div>
          {stage.count !== undefined && (
            <div className="flex items-center justify-between text-muted-foreground">
              <span>Count:</span>
              <span className="font-mono">{stage.count}</span>
            </div>
          )}
          {stage.percentage !== undefined && stage.percentage > 0 && (
            <div
              className={cn(
                'flex items-center justify-between',
                isBottleneck ? 'text-orange-600 font-medium' : 'text-muted-foreground'
              )}
            >
              <span>Share:</span>
              <span className="font-mono">{stage.percentage.toFixed(1)}%</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Connector({ compact }: { compact: boolean }) {
  return (
    <div className={cn('flex items-center', compact ? 'px-0.5' : 'px-1')}>
      <ArrowRight className={cn('text-muted-foreground', compact ? 'h-3 w-3' : 'h-4 w-4')} />
    </div>
  );
}

export default function PipelineFlowDiagram({
  stages,
  bottleneckStage,
  showDurations = true,
  compact = false,
  className,
}: PipelineFlowDiagramProps) {
  return (
    <div className={cn('w-full', className)}>
      {/* Scrollable container for horizontal flow */}
      <div className="overflow-x-auto pb-2">
        <div className="flex items-center min-w-max">
          {stages.map((stage, index) => (
            <div key={stage.id} className="flex items-center">
              <StageCard
                stage={stage}
                isBottleneck={stage.id === bottleneckStage}
                showDuration={showDurations}
                compact={compact}
              />
              {index < stages.length - 1 && <Connector compact={compact} />}
            </div>
          ))}
        </div>
      </div>

      {/* Legend */}
      {!compact && (
        <div className="mt-3 flex items-center gap-4 text-[10px] text-muted-foreground">
          <div className="flex items-center gap-1">
            <div className="h-2 w-2 rounded-full bg-muted border" />
            <span>Pending</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="h-2 w-2 rounded-full bg-blue-500" />
            <span>Running</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="h-2 w-2 rounded-full bg-green-500" />
            <span>Completed</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="h-2 w-2 rounded-full bg-orange-500" />
            <span>Bottleneck</span>
          </div>
        </div>
      )}
    </div>
  );
}
