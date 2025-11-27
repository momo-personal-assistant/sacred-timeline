'use client';

import { CheckCircle2, Database, GitBranch, Layers, Network, Search, XCircle } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

type LayerName = 'chunking' | 'embedding' | 'graph' | 'retrieval' | 'validation';
type EvaluationMethod = 'ground_truth' | 'llm_judge';

interface LayerMetrics {
  [key: string]: unknown;
}

interface LayerData {
  ground_truth?: LayerMetrics;
  llm_judge?: LayerMetrics;
  duration_ms?: number;
}

interface LayerMetricsResponse {
  experiment_id: number;
  layers: {
    [K in LayerName]?: LayerData;
  };
  evaluation_methods: EvaluationMethod[];
}

interface LayerKPICardsProps {
  layerMetrics: LayerMetricsResponse | null;
  evaluationMethod: EvaluationMethod;
  loading: boolean;
  selectedLayer: LayerName | null;
  onLayerClick: (layer: LayerName) => void;
  baselineMetrics?: LayerMetricsResponse | null;
}

const LAYER_CONFIG: Record<
  LayerName,
  {
    title: string;
    description: string;
    icon: typeof Layers;
    primaryMetric: string;
    primaryMetricLabel: string;
  }
> = {
  chunking: {
    title: 'Chunking',
    description: 'Text segmentation',
    icon: Layers,
    primaryMetric: 'total_chunks',
    primaryMetricLabel: 'Total Chunks',
  },
  embedding: {
    title: 'Embedding',
    description: 'Vector generation',
    icon: Database,
    primaryMetric: 'total_tokens',
    primaryMetricLabel: 'Tokens Used',
  },
  graph: {
    title: 'Graph',
    description: 'Relation extraction',
    icon: GitBranch,
    primaryMetric: 'overall.f1_score',
    primaryMetricLabel: 'F1 Score',
  },
  retrieval: {
    title: 'Retrieval',
    description: 'Search quality',
    icon: Search,
    primaryMetric: 'ndcg_at_k.k10',
    primaryMetricLabel: 'NDCG@10',
  },
  validation: {
    title: 'Validation',
    description: 'End-to-end quality',
    icon: Network,
    primaryMetric: 'f1_score',
    primaryMetricLabel: 'F1 Score',
  },
};

function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce((acc: unknown, part: string) => {
    if (acc && typeof acc === 'object' && part in acc) {
      return (acc as Record<string, unknown>)[part];
    }
    return undefined;
  }, obj);
}

function formatMetricValue(value: unknown, metricPath: string): string {
  if (value === undefined || value === null) return 'N/A';

  if (typeof value === 'number') {
    // F1, precision, recall are typically 0-1, show as percentage
    if (
      metricPath.includes('f1') ||
      metricPath.includes('precision') ||
      metricPath.includes('recall') ||
      metricPath.includes('ndcg')
    ) {
      return `${(value * 100).toFixed(1)}%`;
    }
    // Large numbers get formatted with commas
    if (value >= 1000) {
      return value.toLocaleString();
    }
    return value.toFixed(2);
  }

  return String(value);
}

function getHealthStatus(
  layer: LayerName,
  metrics: LayerMetrics | undefined
): 'good' | 'warning' | 'critical' | 'unknown' {
  if (!metrics) return 'unknown';

  const config = LAYER_CONFIG[layer];
  const value = getNestedValue(metrics, config.primaryMetric);

  if (typeof value !== 'number') return 'unknown';

  // Different thresholds for different layers
  const thresholds: Record<LayerName, { good: number; warning: number }> = {
    chunking: { good: 50, warning: 20 }, // total chunks
    embedding: { good: 10000, warning: 50000 }, // tokens (lower is better for cost)
    graph: { good: 0.7, warning: 0.5 }, // F1 score
    retrieval: { good: 0.7, warning: 0.5 }, // NDCG
    validation: { good: 0.7, warning: 0.5 }, // F1 score
  };

  const t = thresholds[layer];

  // For chunking - more chunks might be fine
  if (layer === 'chunking') {
    return value >= t.warning ? 'good' : 'warning';
  }

  // For embedding - lower token count is better (cost)
  if (layer === 'embedding') {
    return value <= t.good ? 'good' : value <= t.warning ? 'warning' : 'critical';
  }

  // For F1/NDCG metrics - higher is better
  if (value >= t.good) return 'good';
  if (value >= t.warning) return 'warning';
  return 'critical';
}

function HealthBadge({ status }: { status: 'good' | 'warning' | 'critical' | 'unknown' }) {
  const variants: Record<typeof status, { label: string; className: string }> = {
    good: {
      label: 'Good',
      className: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    },
    warning: {
      label: 'Warning',
      className: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
    },
    critical: {
      label: 'Critical',
      className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    },
    unknown: {
      label: 'No Data',
      className: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400',
    },
  };

  const variant = variants[status];

  return (
    <Badge variant="outline" className={cn('text-[10px] px-1.5 py-0', variant.className)}>
      {variant.label}
    </Badge>
  );
}

function LayerCard({
  layer,
  metrics,
  evaluationMethod,
  isSelected,
  onClick,
}: {
  layer: LayerName;
  metrics: LayerData | undefined;
  evaluationMethod: EvaluationMethod;
  isSelected: boolean;
  onClick: () => void;
}) {
  const config = LAYER_CONFIG[layer];
  const layerMetrics = metrics?.[evaluationMethod];
  const primaryValue = layerMetrics
    ? getNestedValue(layerMetrics as Record<string, unknown>, config.primaryMetric)
    : undefined;
  const healthStatus = getHealthStatus(layer, layerMetrics);
  const Icon = config.icon;
  const hasMetrics = !!layerMetrics;

  return (
    <Card
      className={cn(
        'cursor-pointer transition-all hover:shadow-md',
        isSelected && 'ring-2 ring-primary',
        !hasMetrics && 'opacity-60'
      )}
      onClick={onClick}
    >
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <HealthBadge status={healthStatus} />
          <Icon className="h-4 w-4 text-muted-foreground" />
        </div>
        <CardTitle className="text-sm font-medium">{config.title}</CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="text-2xl font-bold">
          {formatMetricValue(primaryValue, config.primaryMetric)}
        </div>
        <p className="text-xs text-muted-foreground">{config.primaryMetricLabel}</p>
        {metrics?.duration_ms && (
          <p className="mt-1 text-[10px] text-muted-foreground">{metrics.duration_ms}ms</p>
        )}
      </CardContent>
    </Card>
  );
}

export default function LayerKPICards({
  layerMetrics,
  evaluationMethod,
  loading,
  selectedLayer,
  onLayerClick,
}: LayerKPICardsProps) {
  const layers: LayerName[] = ['chunking', 'embedding', 'graph', 'retrieval', 'validation'];

  if (loading) {
    return (
      <div className="grid grid-cols-5 gap-4">
        {layers.map((layer) => (
          <Skeleton key={layer} className="h-[140px]" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <h3 className="text-sm font-medium">Pipeline Layers</h3>
        <span className="text-xs text-muted-foreground">
          Click a card to view detailed breakdown
        </span>
      </div>
      <div className="grid grid-cols-5 gap-4">
        {layers.map((layer) => (
          <LayerCard
            key={layer}
            layer={layer}
            metrics={layerMetrics?.layers[layer]}
            evaluationMethod={evaluationMethod}
            isSelected={selectedLayer === layer}
            onClick={() => onLayerClick(layer)}
          />
        ))}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <div className="flex items-center gap-1">
          <CheckCircle2 className="h-3 w-3 text-green-500" />
          <span>Good: Meeting targets</span>
        </div>
        <div className="flex items-center gap-1">
          <CheckCircle2 className="h-3 w-3 text-yellow-500" />
          <span>Warning: Below threshold</span>
        </div>
        <div className="flex items-center gap-1">
          <XCircle className="h-3 w-3 text-red-500" />
          <span>Critical: Needs attention</span>
        </div>
      </div>
    </div>
  );
}
