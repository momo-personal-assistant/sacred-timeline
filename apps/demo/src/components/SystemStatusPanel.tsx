'use client';

import { RefreshCw, CheckCircle2, AlertCircle, XCircle, Database, Key, Box } from 'lucide-react';
import { useEffect, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

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

export default function SystemStatusPanel() {
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

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'connected':
      case 'configured':
      case 'complete':
        return <CheckCircle2 className="h-4 w-4 text-green-600" />;
      case 'partial':
        return <AlertCircle className="h-4 w-4 text-yellow-600" />;
      case 'missing':
      case 'error':
        return <XCircle className="h-4 w-4 text-red-600" />;
      default:
        return <AlertCircle className="h-4 w-4 text-gray-400" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'connected':
      case 'configured':
      case 'complete':
        return (
          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
            {status.toUpperCase()}
          </Badge>
        );
      case 'partial':
        return (
          <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">
            {status.toUpperCase()}
          </Badge>
        );
      case 'missing':
      case 'error':
        return (
          <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
            {status.toUpperCase()}
          </Badge>
        );
      default:
        return <Badge variant="outline">{status.toUpperCase()}</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !status) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-red-600 text-sm font-semibold leading-tight">
            Error Loading System Status
          </CardTitle>
          <CardDescription className="text-xs leading-[1.5] mt-1">
            {error || 'Failed to load system status'}
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          <Button
            onClick={fetchStatus}
            variant="outline"
            className="inline-flex items-center gap-1.5 h-[28px] text-xs font-medium"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {/* Header with Refresh Button */}
      <div className="inline-flex items-center justify-between w-full">
        <div>
          <h2 className="text-lg font-semibold leading-tight">System Status</h2>
          <p className="text-xs text-muted-foreground leading-[1.5] mt-1">
            Last updated: {new Date(status.timestamp).toLocaleString()}
          </p>
        </div>
        <Button
          onClick={fetchStatus}
          variant="outline"
          size="sm"
          className="inline-flex items-center gap-1.5 h-[28px] text-xs font-medium"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Refresh
        </Button>
      </div>

      {/* System Health */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="inline-flex items-center gap-2 text-sm font-semibold leading-tight">
            <Database className="h-4 w-4" />
            System Health
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 pt-0">
          {/* Database */}
          <div className="inline-flex items-center justify-between w-full">
            <div className="inline-flex items-center gap-2">
              {getStatusIcon(status.health.database.status)}
              <div>
                <p className="text-sm font-semibold leading-tight">PostgreSQL Database</p>
                <p className="text-xs text-muted-foreground leading-[1.5]">
                  {status.health.database.host}:{status.health.database.port}
                </p>
              </div>
            </div>
            {getStatusBadge(status.health.database.status)}
          </div>

          {/* OpenAI */}
          <div className="inline-flex items-center justify-between w-full">
            <div className="inline-flex items-center gap-2">
              {getStatusIcon(status.health.openai.status)}
              <div>
                <p className="text-sm font-semibold leading-tight">OpenAI API</p>
                <p className="text-xs text-muted-foreground leading-[1.5]">
                  {status.health.openai.model}
                </p>
              </div>
            </div>
            {getStatusBadge(status.health.openai.status)}
          </div>

          {/* Embeddings */}
          <div className="inline-flex items-center justify-between w-full">
            <div className="inline-flex items-center gap-2">
              {getStatusIcon(status.health.embeddings.status)}
              <div>
                <p className="text-sm font-semibold leading-tight">Embeddings</p>
                <p className="text-xs text-muted-foreground leading-[1.5]">
                  {status.health.embeddings.chunksWithEmbeddings} /{' '}
                  {status.health.embeddings.totalChunks} chunks (
                  {status.health.embeddings.coverage.toFixed(0)}%)
                </p>
              </div>
            </div>
            {getStatusBadge(status.health.embeddings.status)}
          </div>
        </CardContent>
      </Card>

      {/* Current Configuration */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="inline-flex items-center gap-2 text-sm font-semibold leading-tight">
            <Key className="h-4 w-4" />
            Current Configuration
          </CardTitle>
          <CardDescription className="text-xs leading-[1.5] mt-1">
            Settings from latest experiment
            {status.configuration.lastUpdated &&
              ` (${new Date(status.configuration.lastUpdated).toLocaleString()})`}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 pt-0">
          {/* Embedding Config */}
          <div>
            <h3 className="text-sm font-semibold leading-tight mb-2">Embedding</h3>
            <div className="grid grid-cols-2 gap-1.5 text-xs leading-[1.5]">
              <div className="text-muted-foreground">Provider:</div>
              <div className="font-mono">{status.configuration.embedding.provider}</div>
              <div className="text-muted-foreground">Model:</div>
              <div className="font-mono">{status.configuration.embedding.model}</div>
              <div className="text-muted-foreground">Dimensions:</div>
              <div className="font-mono">{status.configuration.embedding.dimensions}</div>
            </div>
          </div>

          {/* Chunking Config */}
          <div>
            <h3 className="text-sm font-semibold leading-tight mb-2">Chunking</h3>
            <div className="grid grid-cols-2 gap-1.5 text-xs leading-[1.5]">
              <div className="text-muted-foreground">Strategy:</div>
              <div className="font-mono">{status.configuration.chunking.strategy}</div>
              <div className="text-muted-foreground">Max Chunk Size:</div>
              <div className="font-mono">{status.configuration.chunking.maxChunkSize} tokens</div>
              <div className="text-muted-foreground">Overlap:</div>
              <div className="font-mono">{status.configuration.chunking.overlap} tokens</div>
            </div>
          </div>

          {/* Retrieval Config */}
          <div>
            <h3 className="text-sm font-semibold leading-tight mb-2">Retrieval</h3>
            <div className="grid grid-cols-2 gap-1.5 text-xs leading-[1.5]">
              <div className="text-muted-foreground">Similarity Threshold:</div>
              <div className="font-mono">{status.configuration.retrieval.similarityThreshold}</div>
              <div className="text-muted-foreground">Chunk Limit:</div>
              <div className="font-mono">{status.configuration.retrieval.chunkLimit}</div>
            </div>
          </div>

          {/* Relation Inference Config - CRITICAL */}
          <div className="border-l-4 border-yellow-500 pl-3">
            <h3 className="text-sm font-semibold leading-tight mb-2">Relation Inference</h3>
            <div className="grid grid-cols-2 gap-1.5 text-xs leading-[1.5]">
              <div className="text-muted-foreground">Keyword Overlap Threshold:</div>
              <div className="font-mono">
                {status.configuration.relationInference.keywordOverlapThreshold}
              </div>
              <div className="text-muted-foreground">Use Semantic Similarity:</div>
              <div className="inline-flex items-center gap-2">
                <span className="font-mono">
                  {status.configuration.relationInference.useSemanticSimilarity ? 'ON' : 'OFF'}
                </span>
                {!status.configuration.relationInference.useSemanticSimilarity && (
                  <Badge
                    variant="outline"
                    className="bg-red-50 text-red-700 border-red-200 text-xs h-[18px] inline-flex items-center font-medium"
                  >
                    DISABLED
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Data Status */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="inline-flex items-center gap-2 text-sm font-semibold leading-tight">
            <Box className="h-4 w-4" />
            Data Status
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <div className="text-center p-3 bg-muted rounded-lg">
              <div className="text-lg font-semibold leading-tight">{status.data.papers}</div>
              <div className="text-xs text-muted-foreground leading-[1.5]">Papers</div>
            </div>
            <div className="text-center p-3 bg-muted rounded-lg">
              <div className="text-lg font-semibold leading-tight">{status.data.chunks}</div>
              <div className="text-xs text-muted-foreground leading-[1.5]">Chunks</div>
            </div>
            <div className="text-center p-3 bg-muted rounded-lg">
              <div className="text-lg font-semibold leading-tight">
                {status.data.canonicalObjects}
              </div>
              <div className="text-xs text-muted-foreground leading-[1.5]">Canonical Objects</div>
            </div>
            <div className="text-center p-3 bg-muted rounded-lg">
              <div className="text-lg font-semibold leading-tight">
                {status.data.groundTruthRelations}
              </div>
              <div className="text-xs text-muted-foreground leading-[1.5]">
                Ground Truth Relations
              </div>
            </div>
            <div className="text-center p-3 bg-muted rounded-lg">
              <div className="text-lg font-semibold leading-tight">{status.data.experiments}</div>
              <div className="text-xs text-muted-foreground leading-[1.5]">Experiments</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
