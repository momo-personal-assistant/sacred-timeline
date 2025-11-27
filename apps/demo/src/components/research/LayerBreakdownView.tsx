'use client';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

type LayerName = 'chunking' | 'embedding' | 'graph' | 'retrieval' | 'validation';

interface LayerMetrics {
  [key: string]: unknown;
}

interface LayerBreakdownViewProps {
  layer: LayerName;
  metrics: LayerMetrics | undefined;
  durationMs: number | undefined;
  experimentName: string;
}

const LAYER_TITLES: Record<LayerName, string> = {
  chunking: 'Chunking Layer',
  embedding: 'Embedding Layer',
  graph: 'Knowledge Graph Layer',
  retrieval: 'Retrieval Layer',
  validation: 'End-to-End Validation',
};

const LAYER_DESCRIPTIONS: Record<LayerName, string> = {
  chunking: 'Text segmentation into smaller units for embedding',
  embedding: 'Vector representation generation using embedding models',
  graph: 'Relation extraction and knowledge graph construction',
  retrieval: 'Vector search and ranking quality',
  validation: 'Overall pipeline performance against ground truth',
};

function formatValue(value: unknown): string {
  if (value === undefined || value === null) return 'N/A';

  if (typeof value === 'number') {
    // Check if it looks like a percentage (0-1 range)
    if (value >= 0 && value <= 1) {
      return `${(value * 100).toFixed(1)}%`;
    }
    // Large numbers
    if (value >= 1000) {
      return value.toLocaleString();
    }
    // Decimals
    if (!Number.isInteger(value)) {
      return value.toFixed(3);
    }
    return String(value);
  }

  if (typeof value === 'boolean') {
    return value ? 'Yes' : 'No';
  }

  return String(value);
}

function MetricRow({ label, value }: { label: string; value: unknown }) {
  const formattedValue = formatValue(value);
  const isPercentage = typeof value === 'number' && value >= 0 && value <= 1;
  const isHighScore = isPercentage && value >= 0.7;
  const isLowScore = isPercentage && value < 0.5;

  return (
    <div className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span
        className={cn(
          'text-sm font-medium',
          isHighScore && 'text-green-600 dark:text-green-400',
          isLowScore && 'text-red-600 dark:text-red-400'
        )}
      >
        {formattedValue}
      </span>
    </div>
  );
}

function MetricSection({ title, metrics }: { title: string; metrics: Record<string, unknown> }) {
  const entries = Object.entries(metrics).filter(
    ([, value]) => typeof value !== 'object' || value === null
  );

  if (entries.length === 0) return null;

  return (
    <div className="space-y-1">
      <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
        {title}
      </h4>
      <div className="bg-muted/50 rounded-lg px-3 py-1">
        {entries.map(([key, value]) => (
          <MetricRow
            key={key}
            label={key.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
            value={value}
          />
        ))}
      </div>
    </div>
  );
}

function renderGraphMetrics(metrics: LayerMetrics) {
  const sections: { title: string; data: Record<string, unknown> }[] = [];

  // Overall metrics
  if (metrics.overall && typeof metrics.overall === 'object') {
    sections.push({ title: 'Overall', data: metrics.overall as Record<string, unknown> });
  }

  // Explicit relations
  if (metrics.explicit && typeof metrics.explicit === 'object') {
    sections.push({
      title: 'Explicit Relations',
      data: metrics.explicit as Record<string, unknown>,
    });
  }

  // Similarity relations
  if (metrics.similarity && typeof metrics.similarity === 'object') {
    sections.push({
      title: 'Similarity Relations',
      data: metrics.similarity as Record<string, unknown>,
    });
  }

  // By type breakdown
  if (metrics.by_type && typeof metrics.by_type === 'object') {
    const byType = metrics.by_type as Record<string, Record<string, unknown>>;
    Object.entries(byType).forEach(([type, typeMetrics]) => {
      sections.push({ title: `Type: ${type}`, data: typeMetrics });
    });
  }

  return (
    <div className="space-y-4">
      {sections.map((section) => (
        <MetricSection key={section.title} title={section.title} metrics={section.data} />
      ))}
    </div>
  );
}

function renderValidationMetrics(metrics: LayerMetrics) {
  const primaryMetrics = {
    f1_score: metrics.f1_score,
    precision: metrics.precision,
    recall: metrics.recall,
  };

  const countMetrics = {
    true_positives: metrics.true_positives,
    false_positives: metrics.false_positives,
    false_negatives: metrics.false_negatives,
  };

  return (
    <div className="space-y-4">
      <MetricSection title="Quality Metrics" metrics={primaryMetrics} />
      <MetricSection title="Counts" metrics={countMetrics} />
    </div>
  );
}

function renderGenericMetrics(metrics: LayerMetrics) {
  // Separate nested objects from flat values
  const flatMetrics: Record<string, unknown> = {};
  const nestedSections: { title: string; data: Record<string, unknown> }[] = [];

  Object.entries(metrics).forEach(([key, value]) => {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      nestedSections.push({
        title: key.replace(/_/g, ' '),
        data: value as Record<string, unknown>,
      });
    } else {
      flatMetrics[key] = value;
    }
  });

  return (
    <div className="space-y-4">
      {Object.keys(flatMetrics).length > 0 && (
        <MetricSection title="Metrics" metrics={flatMetrics} />
      )}
      {nestedSections.map((section) => (
        <MetricSection
          key={section.title}
          title={section.title.replace(/\b\w/g, (l) => l.toUpperCase())}
          metrics={section.data}
        />
      ))}
    </div>
  );
}

export default function LayerBreakdownView({
  layer,
  metrics,
  durationMs,
  experimentName,
}: LayerBreakdownViewProps) {
  if (!metrics) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{LAYER_TITLES[layer]}</CardTitle>
          <CardDescription>{LAYER_DESCRIPTIONS[layer]}</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No metrics available for this layer. Run component-wise validation to collect metrics.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Choose render function based on layer
  const renderContent = () => {
    switch (layer) {
      case 'graph':
        return renderGraphMetrics(metrics);
      case 'validation':
        return renderValidationMetrics(metrics);
      default:
        return renderGenericMetrics(metrics);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              {LAYER_TITLES[layer]}
              {durationMs && (
                <Badge variant="outline" className="text-xs font-normal">
                  {durationMs}ms
                </Badge>
              )}
            </CardTitle>
            <CardDescription>{LAYER_DESCRIPTIONS[layer]}</CardDescription>
          </div>
          <Badge variant="secondary" className="text-xs">
            {experimentName}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>{renderContent()}</CardContent>
    </Card>
  );
}
