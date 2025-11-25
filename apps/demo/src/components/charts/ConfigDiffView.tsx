'use client';

import { ArrowRight, Lightbulb } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

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

interface ConfigDiffViewProps {
  experiment: Experiment | null;
  baselineExperiment: Experiment | null;
  compact?: boolean;
}

interface DiffRow {
  category: string;
  parameter: string;
  baselineValue: string | number | boolean | undefined;
  selectedValue: string | number | boolean | undefined;
  isChanged: boolean;
}

function formatValue(value: string | number | boolean | undefined): string {
  if (value === undefined) return '-';
  if (typeof value === 'boolean') return value ? 'ON' : 'OFF';
  return String(value);
}

function getConfigDiffs(
  selected: ExperimentConfig,
  baseline: ExperimentConfig | undefined
): DiffRow[] {
  const diffs: DiffRow[] = [];

  // Relation Inference
  const selRI = selected.relationInference;
  const baseRI = baseline?.relationInference;

  diffs.push({
    category: 'Relation Inference',
    parameter: 'Semantic Similarity',
    baselineValue: baseRI?.useSemanticSimilarity,
    selectedValue: selRI?.useSemanticSimilarity,
    isChanged: baseRI?.useSemanticSimilarity !== selRI?.useSemanticSimilarity,
  });

  diffs.push({
    category: 'Relation Inference',
    parameter: 'Similarity Threshold',
    baselineValue: baseRI?.similarityThreshold,
    selectedValue: selRI?.similarityThreshold,
    isChanged: baseRI?.similarityThreshold !== selRI?.similarityThreshold,
  });

  diffs.push({
    category: 'Relation Inference',
    parameter: 'Semantic Weight',
    baselineValue: baseRI?.semanticWeight,
    selectedValue: selRI?.semanticWeight,
    isChanged: baseRI?.semanticWeight !== selRI?.semanticWeight,
  });

  diffs.push({
    category: 'Relation Inference',
    parameter: 'Keyword Overlap',
    baselineValue: baseRI?.keywordOverlapThreshold,
    selectedValue: selRI?.keywordOverlapThreshold,
    isChanged: baseRI?.keywordOverlapThreshold !== selRI?.keywordOverlapThreshold,
  });

  // Embedding
  const selEmb = selected.embedding;
  const baseEmb = baseline?.embedding;

  diffs.push({
    category: 'Embedding',
    parameter: 'Model',
    baselineValue: baseEmb?.model,
    selectedValue: selEmb?.model,
    isChanged: baseEmb?.model !== selEmb?.model,
  });

  diffs.push({
    category: 'Embedding',
    parameter: 'Dimensions',
    baselineValue: baseEmb?.dimensions,
    selectedValue: selEmb?.dimensions,
    isChanged: baseEmb?.dimensions !== selEmb?.dimensions,
  });

  // Chunking
  const selChunk = selected.chunking;
  const baseChunk = baseline?.chunking;

  diffs.push({
    category: 'Chunking',
    parameter: 'Strategy',
    baselineValue: baseChunk?.strategy,
    selectedValue: selChunk?.strategy,
    isChanged: baseChunk?.strategy !== selChunk?.strategy,
  });

  diffs.push({
    category: 'Chunking',
    parameter: 'Max Chunk Size',
    baselineValue: baseChunk?.maxChunkSize,
    selectedValue: selChunk?.maxChunkSize,
    isChanged: baseChunk?.maxChunkSize !== selChunk?.maxChunkSize,
  });

  diffs.push({
    category: 'Chunking',
    parameter: 'Overlap',
    baselineValue: baseChunk?.overlap,
    selectedValue: selChunk?.overlap,
    isChanged: baseChunk?.overlap !== selChunk?.overlap,
  });

  // Retrieval
  const selRet = selected.retrieval;
  const baseRet = baseline?.retrieval;

  diffs.push({
    category: 'Retrieval',
    parameter: 'Similarity Threshold',
    baselineValue: baseRet?.similarityThreshold,
    selectedValue: selRet?.similarityThreshold,
    isChanged: baseRet?.similarityThreshold !== selRet?.similarityThreshold,
  });

  diffs.push({
    category: 'Retrieval',
    parameter: 'Chunk Limit',
    baselineValue: baseRet?.chunkLimit,
    selectedValue: selRet?.chunkLimit,
    isChanged: baseRet?.chunkLimit !== selRet?.chunkLimit,
  });

  return diffs;
}

export default function ConfigDiffView({
  experiment,
  baselineExperiment,
  compact = false,
}: ConfigDiffViewProps) {
  if (!experiment) {
    return (
      <Card className={compact ? 'h-full' : ''}>
        <CardHeader className={compact ? 'pb-2' : 'pb-2'}>
          <CardTitle className="text-sm font-semibold leading-tight">Configuration Diff</CardTitle>
          <CardDescription className="text-xs leading-[1.5]">
            Select an experiment to view configuration
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (!baselineExperiment) {
    return (
      <Card className={compact ? 'h-full' : ''}>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold leading-tight">Configuration Diff</CardTitle>
          <CardDescription className="text-xs leading-[1.5]">
            No baseline experiment to compare
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (experiment.is_baseline) {
    return (
      <Card className={compact ? 'h-full' : ''}>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold leading-tight">Configuration Diff</CardTitle>
          <CardDescription className="text-xs leading-[1.5]">
            This is the baseline experiment
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const diffs = getConfigDiffs(experiment.config, baselineExperiment.config);
  const changedParams = diffs.filter((d) => d.isChanged);
  const hasResults = experiment.results && baselineExperiment.results;

  const f1Change = hasResults
    ? experiment.results!.f1_score - baselineExperiment.results!.f1_score
    : null;
  const precisionChange = hasResults
    ? experiment.results!.precision - baselineExperiment.results!.precision
    : null;
  const recallChange = hasResults
    ? experiment.results!.recall - baselineExperiment.results!.recall
    : null;

  // Group by category
  const categories = [...new Set(diffs.map((d) => d.category))];

  // In compact mode, only show changed parameters
  const displayDiffs = compact ? changedParams : diffs;
  const displayCategories = compact
    ? [...new Set(changedParams.map((d) => d.category))]
    : categories;

  return (
    <Card className={compact ? 'h-full flex flex-col' : ''}>
      <CardHeader className="pb-2">
        <div className="inline-flex items-center justify-between w-full">
          <div>
            <CardTitle className="text-sm font-semibold leading-tight">
              {compact ? 'Config Changes' : 'Configuration Diff'}
            </CardTitle>
            {!compact && (
              <CardDescription className="text-xs leading-[1.5] mt-1">
                {experiment.name} vs {baselineExperiment.name}
              </CardDescription>
            )}
          </div>
          <Badge
            variant={changedParams.length > 0 ? 'secondary' : 'outline'}
            className="text-xs h-[18px] font-medium"
          >
            {changedParams.length} changed
          </Badge>
        </div>
      </CardHeader>

      <CardContent className={`space-y-3 ${compact ? 'flex-1 overflow-auto pt-0' : ''}`}>
        {/* Parameter Diff Table */}
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-muted/50">
                <th className="text-left px-2 py-1.5 font-medium text-muted-foreground">
                  Parameter
                </th>
                <th className="text-center px-2 py-1.5 font-medium text-muted-foreground w-24">
                  Baseline
                </th>
                <th className="text-center px-1 py-1.5 w-6"></th>
                <th className="text-center px-2 py-1.5 font-medium text-muted-foreground w-24">
                  Selected
                </th>
              </tr>
            </thead>
            <tbody>
              {displayCategories.map((category) => {
                const categoryDiffs = displayDiffs.filter((d) => d.category === category);

                return categoryDiffs.map((diff, idx) => (
                  <tr
                    key={`${category}-${diff.parameter}`}
                    className={diff.isChanged ? 'bg-yellow-50 dark:bg-yellow-950/20' : ''}
                  >
                    <td className="px-2 py-1.5 border-t">
                      <div className="flex items-center gap-1.5">
                        {idx === 0 && (
                          <span className="text-muted-foreground font-medium">{category}:</span>
                        )}
                        {idx !== 0 && <span className="ml-4" />}
                        <span className={diff.isChanged ? 'font-medium' : 'text-muted-foreground'}>
                          {diff.parameter}
                        </span>
                      </div>
                    </td>
                    <td className="text-center px-2 py-1.5 border-t font-mono">
                      {formatValue(diff.baselineValue)}
                    </td>
                    <td className="text-center px-1 py-1.5 border-t">
                      {diff.isChanged && (
                        <ArrowRight className="h-3 w-3 text-yellow-600 dark:text-yellow-500" />
                      )}
                    </td>
                    <td
                      className={`text-center px-2 py-1.5 border-t font-mono ${diff.isChanged ? 'font-semibold text-yellow-700 dark:text-yellow-400' : ''}`}
                    >
                      {formatValue(diff.selectedValue)}
                    </td>
                  </tr>
                ));
              })}
            </tbody>
          </table>
        </div>

        {/* Performance Comparison - hide in compact mode */}
        {!compact && hasResults && (
          <div className="space-y-2 pt-2 border-t">
            <h4 className="text-xs font-semibold leading-tight">Performance Impact</h4>
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div className="text-center p-2 bg-muted rounded-lg">
                <div className="font-mono font-medium">
                  {(baselineExperiment.results!.precision * 100).toFixed(1)}% →{' '}
                  {(experiment.results!.precision * 100).toFixed(1)}%
                </div>
                <div className="text-muted-foreground leading-[1.5]">Precision</div>
                {precisionChange !== null && (
                  <Badge
                    variant={precisionChange >= 0 ? 'default' : 'destructive'}
                    className="text-xs h-[16px] font-medium mt-1"
                  >
                    {precisionChange >= 0 ? '+' : ''}
                    {(precisionChange * 100).toFixed(1)}%
                  </Badge>
                )}
              </div>
              <div className="text-center p-2 bg-muted rounded-lg">
                <div className="font-mono font-medium">
                  {(baselineExperiment.results!.recall * 100).toFixed(1)}% →{' '}
                  {(experiment.results!.recall * 100).toFixed(1)}%
                </div>
                <div className="text-muted-foreground leading-[1.5]">Recall</div>
                {recallChange !== null && (
                  <Badge
                    variant={recallChange >= 0 ? 'default' : 'destructive'}
                    className="text-xs h-[16px] font-medium mt-1"
                  >
                    {recallChange >= 0 ? '+' : ''}
                    {(recallChange * 100).toFixed(1)}%
                  </Badge>
                )}
              </div>
              <div className="text-center p-2 bg-primary/10 rounded-lg">
                <div className="font-mono font-semibold text-primary">
                  {(baselineExperiment.results!.f1_score * 100).toFixed(1)}% →{' '}
                  {(experiment.results!.f1_score * 100).toFixed(1)}%
                </div>
                <div className="text-muted-foreground leading-[1.5]">F1 Score</div>
                {f1Change !== null && (
                  <Badge
                    variant={f1Change >= 0 ? 'default' : 'destructive'}
                    className="text-xs h-[16px] font-medium mt-1"
                  >
                    {f1Change >= 0 ? '+' : ''}
                    {(f1Change * 100).toFixed(1)}%
                  </Badge>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Suggestion - hide in compact mode */}
        {!compact && changedParams.length > 1 && (
          <div className="flex items-start gap-2 p-2 bg-blue-50 dark:bg-blue-950/20 rounded-lg text-xs">
            <Lightbulb className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
            <p className="text-blue-700 dark:text-blue-300 leading-[1.5]">
              <strong>{changedParams.length} parameters</strong> were changed. To isolate which
              change had the most impact, try running experiments with only one parameter changed at
              a time.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
