'use client';

import { RefreshCw, CheckCircle2, AlertCircle, XCircle } from 'lucide-react';
import { useEffect, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface SystemStatus {
  status: string;
  timestamp: string;
  configuration: {
    embedding: {
      model: string;
      dimensions: number;
      provider: string;
    };
    chunking: {
      strategy: string;
      maxChunkSize: number;
      overlap: number;
    };
    retrieval: {
      similarityThreshold: number;
      chunkLimit: number;
    };
    relationInference: {
      keywordOverlapThreshold: number;
      useSemanticSimilarity: boolean;
    };
    lastUpdated: string | null;
  };
  data: {
    papers: number;
    chunks: number;
    canonicalObjects: number;
    groundTruthRelations: number;
    experiments: number;
  };
  health: {
    database: {
      status: string;
      version: string;
      host: string;
      port: number;
    };
    openai: {
      status: string;
      model: string;
    };
    embeddings: {
      status: string;
      coverage: number;
      chunksWithEmbeddings: number;
      totalChunks: number;
    };
  };
}

interface SystemStatusPanelProps {
  compact?: boolean;
}

function PropertyRow({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={`text-xs ${mono ? 'font-mono' : ''}`}>{value}</span>
    </div>
  );
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide pt-4 pb-2 mt-3 border-t first:border-t-0 first:mt-0 first:pt-0">
      {children}
    </div>
  );
}

function StatusIndicator({ status }: { status: string }) {
  const isGood = ['connected', 'configured', 'complete'].includes(status);
  const isWarning = status === 'partial';
  const isBad = ['missing', 'error'].includes(status);

  if (isGood) return <CheckCircle2 className="h-3 w-3 text-green-600" />;
  if (isWarning) return <AlertCircle className="h-3 w-3 text-yellow-600" />;
  if (isBad) return <XCircle className="h-3 w-3 text-red-600" />;
  return <AlertCircle className="h-3 w-3 text-gray-400" />;
}

export default function SystemStatusPanel({ compact: _compact = false }: SystemStatusPanelProps) {
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch('/api/system-status');
      if (!response.ok) {
        throw new Error('Failed to fetch system status');
      }
      const data = await response.json();
      setStatus(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32">
        <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !status) {
    return (
      <div className="space-y-2">
        <p className="text-xs text-red-600">{error || 'Failed to load'}</p>
        <Button onClick={fetchStatus} variant="outline" size="sm" className="h-6 text-xs">
          <RefreshCw className="h-3 w-3 mr-1" />
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between pb-2">
        <span className="text-sm font-medium">System Status</span>
        <Button onClick={fetchStatus} variant="ghost" size="sm" className="h-6 w-6 p-0">
          <RefreshCw className="h-3 w-3" />
        </Button>
      </div>

      <PropertyRow label="Updated" value={new Date(status.timestamp).toLocaleTimeString()} />

      {/* Health */}
      <SectionHeader>Health</SectionHeader>
      <PropertyRow
        label="Database"
        value={
          <span className="flex items-center gap-1.5">
            <StatusIndicator status={status.health.database.status} />
            <span className="font-mono">{status.health.database.host}</span>
          </span>
        }
      />
      <PropertyRow
        label="OpenAI"
        value={
          <span className="flex items-center gap-1.5">
            <StatusIndicator status={status.health.openai.status} />
            <span className="font-mono">{status.health.openai.model}</span>
          </span>
        }
      />
      <PropertyRow
        label="Embeddings"
        value={
          <span className="flex items-center gap-1.5">
            <StatusIndicator status={status.health.embeddings.status} />
            <span className="font-mono">{status.health.embeddings.coverage.toFixed(0)}%</span>
          </span>
        }
      />

      {/* Data Counts */}
      <SectionHeader>Data</SectionHeader>
      <PropertyRow label="Papers" value={status.data.papers} mono />
      <PropertyRow label="Chunks" value={status.data.chunks} mono />
      <PropertyRow label="Objects" value={status.data.canonicalObjects} mono />
      <PropertyRow label="Relations" value={status.data.groundTruthRelations} mono />
      <PropertyRow label="Experiments" value={status.data.experiments} mono />

      {/* Embedding Config */}
      <SectionHeader>Embedding</SectionHeader>
      <PropertyRow label="Provider" value={status.configuration.embedding.provider} mono />
      <PropertyRow label="Model" value={status.configuration.embedding.model} mono />
      <PropertyRow label="Dimensions" value={status.configuration.embedding.dimensions} mono />

      {/* Chunking Config */}
      <SectionHeader>Chunking</SectionHeader>
      <PropertyRow label="Strategy" value={status.configuration.chunking.strategy} mono />
      <PropertyRow label="Max Size" value={status.configuration.chunking.maxChunkSize} mono />
      <PropertyRow label="Overlap" value={status.configuration.chunking.overlap} mono />

      {/* Retrieval Config */}
      <SectionHeader>Retrieval</SectionHeader>
      <PropertyRow
        label="Threshold"
        value={status.configuration.retrieval.similarityThreshold}
        mono
      />
      <PropertyRow label="Chunk Limit" value={status.configuration.retrieval.chunkLimit} mono />

      {/* Relation Inference */}
      <SectionHeader>Relation Inference</SectionHeader>
      <PropertyRow
        label="Keyword Overlap"
        value={status.configuration.relationInference.keywordOverlapThreshold}
        mono
      />
      <PropertyRow
        label="Semantic"
        value={
          <Badge
            variant={
              status.configuration.relationInference.useSemanticSimilarity ? 'default' : 'secondary'
            }
            className="text-[10px] h-4 px-1.5"
          >
            {status.configuration.relationInference.useSemanticSimilarity ? 'ON' : 'OFF'}
          </Badge>
        }
      />
    </div>
  );
}
