'use client';

import { Check, Copy, FileText, GitCommit, Loader2, Play, Star, Terminal } from 'lucide-react';
import { useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

// Check if server-side experiment execution is disabled (e.g., on Vercel with 10s timeout)
const isServerRunDisabled = process.env.NEXT_PUBLIC_DISABLE_SERVER_RUN === 'true';

interface ExperimentConfig {
  name: string;
  description: string;
  embedding: {
    model: string;
    dimensions?: number;
    batchSize?: number;
  };
  chunking: {
    strategy: string;
    maxChunkSize?: number;
    overlap?: number;
  };
  retrieval: {
    similarityThreshold?: number;
    chunkLimit?: number;
  };
  relationInference: {
    keywordOverlapThreshold?: number;
    useSemanticSimilarity?: boolean;
    similarityThreshold?: number;
    semanticWeight?: number;
  };
}

interface ExperimentResults {
  f1_score: number;
  precision: number;
  recall: number;
  true_positives: number;
  false_positives: number;
  false_negatives: number;
  retrieval_time_ms: number;
}

type ExperimentStatus = 'draft' | 'running' | 'completed' | 'failed';

interface Experiment {
  id: number;
  name: string;
  description: string;
  config: ExperimentConfig;
  is_baseline: boolean;
  paper_ids: string[];
  git_commit: string | null;
  created_at: string;
  results: ExperimentResults | null;
  status?: ExperimentStatus;
  config_file_path?: string;
  run_started_at?: string;
  run_completed_at?: string;
  error_message?: string;
}

interface ExperimentDetailPanelProps {
  experiment: Experiment | null;
  baselineExperiment?: Experiment | null;
  onBaselineChange?: () => void;
  onExperimentRun?: () => void;
  onViewDocs?: (experimentId: number) => void;
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

export default function ExperimentDetailPanel({
  experiment,
  baselineExperiment,
  onBaselineChange,
  onExperimentRun,
  onViewDocs,
}: ExperimentDetailPanelProps) {
  const [isSettingBaseline, setIsSettingBaseline] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const getRunCommand = () => {
    return `pnpm experiment ${experiment?.config_file_path || 'config/experiments/...'}`;
  };

  const handleCopyCommand = async () => {
    try {
      await navigator.clipboard.writeText(getRunCommand());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  if (!experiment) {
    return (
      <div className="flex items-center justify-center h-32">
        <p className="text-xs text-muted-foreground">Select an experiment</p>
      </div>
    );
  }

  const status = experiment.status || 'completed';
  const isDraft = status === 'draft';
  const isExperimentRunning = status === 'running';
  const isFailed = status === 'failed';
  const hasResults = experiment.results !== null;
  const improvementVsBaseline =
    baselineExperiment?.results && experiment.results
      ? ((experiment.results.f1_score - baselineExperiment.results.f1_score) /
          baselineExperiment.results.f1_score) *
        100
      : null;

  const handleSetBaseline = async () => {
    setIsSettingBaseline(true);
    try {
      const res = await fetch(`/api/experiments/${experiment.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_baseline: true }),
      });
      if (res.ok) {
        onBaselineChange?.();
      }
    } catch (error) {
      console.error('Failed to set baseline:', error);
    } finally {
      setIsSettingBaseline(false);
    }
  };

  const handleRunExperiment = async () => {
    setIsRunning(true);
    setRunError(null);
    try {
      const res = await fetch(`/api/experiments/${experiment.id}/run`, {
        method: 'POST',
      });
      const data = await res.json();
      if (res.ok) {
        onExperimentRun?.();
      } else {
        setRunError(data.error || 'Failed to run experiment');
      }
    } catch (error) {
      console.error('Failed to run experiment:', error);
      setRunError('Failed to run experiment');
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="h-full overflow-y-auto">
      {/* Status Badge */}
      {(isDraft || isExperimentRunning || isFailed) && (
        <div className="mb-3">
          <Badge
            variant={isDraft ? 'secondary' : isExperimentRunning ? 'default' : 'destructive'}
            className="w-full justify-center py-1"
          >
            {isExperimentRunning && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
            {isDraft ? 'Draft' : isExperimentRunning ? 'Running...' : 'Failed'}
          </Badge>
        </div>
      )}

      {/* Run Command for Draft Experiments */}
      {isDraft && (
        <div className="space-y-2 mb-3">
          {/* CLI Command with Copy Button */}
          <div className="p-3 bg-muted rounded-md border">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Terminal className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs font-medium">Run Command</span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs"
                onClick={handleCopyCommand}
              >
                {copied ? (
                  <>
                    <Check className="h-3 w-3 mr-1 text-green-500" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="h-3 w-3 mr-1" />
                    Copy
                  </>
                )}
              </Button>
            </div>
            <code className="block text-[10px] bg-background p-2 rounded border font-mono break-all select-all">
              {getRunCommand()}
            </code>
          </div>

          {/* Server Run Button (only for local development) */}
          {!isServerRunDisabled && (
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={handleRunExperiment}
              disabled={isRunning}
            >
              {isRunning ? (
                <Loader2 className="h-3 w-3 mr-2 animate-spin" />
              ) : (
                <Play className="h-3 w-3 mr-2" />
              )}
              {isRunning ? 'Starting...' : 'Run on Server'}
            </Button>
          )}

          {onViewDocs && (
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => onViewDocs(experiment.id)}
            >
              <FileText className="h-3 w-3 mr-2" />
              View Full Config
            </Button>
          )}
        </div>
      )}

      {/* Run Error */}
      {runError && (
        <div className="p-2 mb-3 bg-destructive/10 rounded-md border border-destructive/20">
          <p className="text-xs text-destructive">{runError}</p>
        </div>
      )}

      {/* Failed Error Message */}
      {isFailed && experiment.error_message && (
        <div className="p-2 mb-3 bg-destructive/10 rounded-md border border-destructive/20">
          <p className="text-xs text-destructive font-medium mb-1">Error:</p>
          <p className="text-xs text-destructive/80">{experiment.error_message}</p>
        </div>
      )}

      {/* Baseline Status */}
      {experiment.is_baseline ? (
        <div className="flex items-center gap-2 p-2 mb-3 bg-primary/10 rounded-md border border-primary/20">
          <Star className="h-4 w-4 text-primary fill-primary" />
          <span className="text-xs font-medium text-primary">Current Baseline</span>
        </div>
      ) : (
        !isDraft &&
        !isExperimentRunning && (
          <Button
            variant="outline"
            size="sm"
            className="w-full mb-3"
            onClick={handleSetBaseline}
            disabled={isSettingBaseline}
          >
            <Star className="h-3 w-3 mr-2" />
            {isSettingBaseline ? 'Setting...' : 'Set as Baseline'}
          </Button>
        )
      )}

      <PropertyRow label="Created" value={new Date(experiment.created_at).toLocaleDateString()} />

      {experiment.git_commit && (
        <PropertyRow
          label="Commit"
          value={
            <span className="flex items-center gap-1">
              <GitCommit className="h-3 w-3" />
              {experiment.git_commit.slice(0, 7)}
            </span>
          }
          mono
        />
      )}

      {/* Metrics */}
      {hasResults && experiment.results && (
        <>
          <SectionHeader>Performance</SectionHeader>
          <PropertyRow
            label="F1 Score"
            value={`${(experiment.results.f1_score * 100).toFixed(1)}%`}
            mono
          />
          <PropertyRow
            label="Precision"
            value={`${(experiment.results.precision * 100).toFixed(1)}%`}
            mono
          />
          <PropertyRow
            label="Recall"
            value={`${(experiment.results.recall * 100).toFixed(1)}%`}
            mono
          />
          <PropertyRow label="Time" value={`${experiment.results.retrieval_time_ms}ms`} mono />

          <SectionHeader>Counts</SectionHeader>
          <PropertyRow label="True Positives" value={experiment.results.true_positives} mono />
          <PropertyRow label="False Positives" value={experiment.results.false_positives} mono />
          <PropertyRow label="False Negatives" value={experiment.results.false_negatives} mono />
        </>
      )}

      {/* Baseline Comparison */}
      {improvementVsBaseline !== null && !experiment.is_baseline && (
        <>
          <SectionHeader>vs Baseline</SectionHeader>
          <PropertyRow
            label="F1 Change"
            value={
              <Badge
                variant={improvementVsBaseline >= 0 ? 'default' : 'destructive'}
                className="text-[10px] h-4 px-1.5"
              >
                {improvementVsBaseline >= 0 ? '+' : ''}
                {improvementVsBaseline.toFixed(1)}%
              </Badge>
            }
          />
        </>
      )}

      {/* Relation Inference */}
      {experiment.config?.relationInference && (
        <>
          <SectionHeader>Relation Inference</SectionHeader>
          <PropertyRow
            label="Semantic"
            value={
              <Badge
                variant={
                  experiment.config.relationInference.useSemanticSimilarity
                    ? 'default'
                    : 'secondary'
                }
                className="text-[10px] h-4 px-1.5"
              >
                {experiment.config.relationInference.useSemanticSimilarity ? 'ON' : 'OFF'}
              </Badge>
            }
          />
          {experiment.config.relationInference.similarityThreshold !== undefined && (
            <PropertyRow
              label="Similarity"
              value={experiment.config.relationInference.similarityThreshold}
              mono
            />
          )}
          {experiment.config.relationInference.semanticWeight !== undefined && (
            <PropertyRow
              label="Semantic Weight"
              value={experiment.config.relationInference.semanticWeight}
              mono
            />
          )}
          {experiment.config.relationInference.keywordOverlapThreshold !== undefined && (
            <PropertyRow
              label="Keyword Overlap"
              value={experiment.config.relationInference.keywordOverlapThreshold}
              mono
            />
          )}
        </>
      )}

      {/* Embedding */}
      {experiment.config?.embedding && (
        <>
          <SectionHeader>Embedding</SectionHeader>
          <PropertyRow label="Model" value={experiment.config.embedding.model} mono />
          {experiment.config.embedding.dimensions && (
            <PropertyRow label="Dimensions" value={experiment.config.embedding.dimensions} mono />
          )}
        </>
      )}

      {/* Chunking */}
      {experiment.config?.chunking && (
        <>
          <SectionHeader>Chunking</SectionHeader>
          <PropertyRow label="Strategy" value={experiment.config.chunking.strategy} mono />
          {experiment.config.chunking.maxChunkSize && (
            <PropertyRow
              label="Max Size"
              value={`${experiment.config.chunking.maxChunkSize}`}
              mono
            />
          )}
          {experiment.config.chunking.overlap !== undefined && (
            <PropertyRow label="Overlap" value={experiment.config.chunking.overlap} mono />
          )}
        </>
      )}

      {/* Retrieval */}
      {experiment.config?.retrieval && (
        <>
          <SectionHeader>Retrieval</SectionHeader>
          {experiment.config.retrieval.similarityThreshold !== undefined && (
            <PropertyRow
              label="Threshold"
              value={experiment.config.retrieval.similarityThreshold}
              mono
            />
          )}
          {experiment.config.retrieval.chunkLimit && (
            <PropertyRow label="Chunk Limit" value={experiment.config.retrieval.chunkLimit} mono />
          )}
        </>
      )}
    </div>
  );
}
