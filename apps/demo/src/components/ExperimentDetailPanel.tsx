'use client';

import { GitCommit, Copy, Download } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

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
}

interface ExperimentDetailPanelProps {
  experiment: Experiment | null;
  baselineExperiment?: Experiment | null;
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
}: ExperimentDetailPanelProps) {
  if (!experiment) {
    return (
      <div className="flex items-center justify-center h-32">
        <p className="text-xs text-muted-foreground">Select an experiment</p>
      </div>
    );
  }

  const hasResults = experiment.results !== null;
  const improvementVsBaseline =
    baselineExperiment?.results && experiment.results
      ? ((experiment.results.f1_score - baselineExperiment.results.f1_score) /
          baselineExperiment.results.f1_score) *
        100
      : null;

  return (
    <div className="h-full overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between pb-2">
        <div className="flex items-center gap-1.5 min-w-0">
          {experiment.is_baseline && (
            <Badge variant="secondary" className="text-[10px] h-4 px-1.5 shrink-0">
              BASE
            </Badge>
          )}
          <span className="text-sm font-medium truncate">{experiment.name}</span>
        </div>
        <div className="flex gap-0.5 shrink-0">
          <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
            <Copy className="h-3 w-3" />
          </Button>
          <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
            <Download className="h-3 w-3" />
          </Button>
        </div>
      </div>

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
