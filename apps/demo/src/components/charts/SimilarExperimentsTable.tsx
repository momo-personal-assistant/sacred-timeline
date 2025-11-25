'use client';

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

interface SimilarExperimentsTableProps {
  selectedExperiment: Experiment;
  experiments: Experiment[];
  onExperimentClick?: (experiment: Experiment) => void;
}

interface ParamDiff {
  name: string;
  selectedValue: string;
  otherValue: string;
}

function getParamDifferences(a: ExperimentConfig, b: ExperimentConfig): ParamDiff[] {
  const diffs: ParamDiff[] = [];

  // Relation Inference
  if (a.relationInference?.useSemanticSimilarity !== b.relationInference?.useSemanticSimilarity) {
    diffs.push({
      name: 'semantic',
      selectedValue: a.relationInference?.useSemanticSimilarity ? 'ON' : 'OFF',
      otherValue: b.relationInference?.useSemanticSimilarity ? 'ON' : 'OFF',
    });
  }

  if (a.relationInference?.similarityThreshold !== b.relationInference?.similarityThreshold) {
    diffs.push({
      name: 'simThreshold',
      selectedValue: String(a.relationInference?.similarityThreshold ?? '-'),
      otherValue: String(b.relationInference?.similarityThreshold ?? '-'),
    });
  }

  if (a.relationInference?.semanticWeight !== b.relationInference?.semanticWeight) {
    diffs.push({
      name: 'semWeight',
      selectedValue: String(a.relationInference?.semanticWeight ?? '-'),
      otherValue: String(b.relationInference?.semanticWeight ?? '-'),
    });
  }

  if (
    a.relationInference?.keywordOverlapThreshold !== b.relationInference?.keywordOverlapThreshold
  ) {
    diffs.push({
      name: 'keywordOverlap',
      selectedValue: String(a.relationInference?.keywordOverlapThreshold ?? '-'),
      otherValue: String(b.relationInference?.keywordOverlapThreshold ?? '-'),
    });
  }

  // Embedding
  if (a.embedding?.model !== b.embedding?.model) {
    diffs.push({
      name: 'embedding',
      selectedValue: a.embedding?.model ?? '-',
      otherValue: b.embedding?.model ?? '-',
    });
  }

  if (a.embedding?.dimensions !== b.embedding?.dimensions) {
    diffs.push({
      name: 'dimensions',
      selectedValue: String(a.embedding?.dimensions ?? '-'),
      otherValue: String(b.embedding?.dimensions ?? '-'),
    });
  }

  // Chunking
  if (a.chunking?.strategy !== b.chunking?.strategy) {
    diffs.push({
      name: 'chunkStrategy',
      selectedValue: a.chunking?.strategy ?? '-',
      otherValue: b.chunking?.strategy ?? '-',
    });
  }

  if (a.chunking?.maxChunkSize !== b.chunking?.maxChunkSize) {
    diffs.push({
      name: 'chunkSize',
      selectedValue: String(a.chunking?.maxChunkSize ?? '-'),
      otherValue: String(b.chunking?.maxChunkSize ?? '-'),
    });
  }

  if (a.chunking?.overlap !== b.chunking?.overlap) {
    diffs.push({
      name: 'overlap',
      selectedValue: String(a.chunking?.overlap ?? '-'),
      otherValue: String(b.chunking?.overlap ?? '-'),
    });
  }

  // Retrieval
  if (a.retrieval?.similarityThreshold !== b.retrieval?.similarityThreshold) {
    diffs.push({
      name: 'retThreshold',
      selectedValue: String(a.retrieval?.similarityThreshold ?? '-'),
      otherValue: String(b.retrieval?.similarityThreshold ?? '-'),
    });
  }

  if (a.retrieval?.chunkLimit !== b.retrieval?.chunkLimit) {
    diffs.push({
      name: 'chunkLimit',
      selectedValue: String(a.retrieval?.chunkLimit ?? '-'),
      otherValue: String(b.retrieval?.chunkLimit ?? '-'),
    });
  }

  return diffs;
}

interface SimilarExperiment {
  experiment: Experiment;
  diffCount: number;
  diffs: ParamDiff[];
  f1Diff: number | null;
}

function findSimilarExperiments(
  selected: Experiment,
  allExperiments: Experiment[],
  maxDiffs: number = 2
): SimilarExperiment[] {
  const similar: SimilarExperiment[] = [];

  for (const exp of allExperiments) {
    if (exp.id === selected.id) continue;
    if (!selected.config || !exp.config) continue;

    const diffs = getParamDifferences(selected.config, exp.config);

    if (diffs.length > 0 && diffs.length <= maxDiffs) {
      const f1Diff =
        selected.results && exp.results ? exp.results.f1_score - selected.results.f1_score : null;

      similar.push({
        experiment: exp,
        diffCount: diffs.length,
        diffs,
        f1Diff,
      });
    }
  }

  // Sort by diff count (less diffs = more similar), then by F1 score
  similar.sort((a, b) => {
    if (a.diffCount !== b.diffCount) return a.diffCount - b.diffCount;
    if (a.f1Diff !== null && b.f1Diff !== null) return b.f1Diff - a.f1Diff;
    return 0;
  });

  return similar.slice(0, 5); // Top 5
}

function getScoreVariant(score: number): 'default' | 'secondary' | 'destructive' {
  if (score >= 0.6) return 'default';
  if (score >= 0.4) return 'secondary';
  return 'destructive';
}

export default function SimilarExperimentsTable({
  selectedExperiment,
  experiments,
  onExperimentClick,
}: SimilarExperimentsTableProps) {
  const similarExperiments = findSimilarExperiments(selectedExperiment, experiments);

  if (similarExperiments.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold leading-tight">Similar Experiments</CardTitle>
          <CardDescription className="text-xs leading-[1.5]">
            No experiments with 1-2 parameter differences found
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground leading-[1.5]">
            Try running more experiments with small variations to compare results.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="inline-flex items-center justify-between w-full">
          <div>
            <CardTitle className="text-sm font-semibold leading-tight">
              Similar Experiments
            </CardTitle>
            <CardDescription className="text-xs leading-[1.5] mt-1">
              1-2 parameters different from {selectedExperiment.name}
            </CardDescription>
          </div>
          <Badge variant="outline" className="text-xs h-[18px] font-medium">
            {similarExperiments.length} found
          </Badge>
        </div>
      </CardHeader>

      <CardContent>
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-muted/50">
                <th className="text-left px-2 py-1.5 font-medium text-muted-foreground">
                  Experiment
                </th>
                <th className="text-left px-2 py-1.5 font-medium text-muted-foreground">
                  Difference
                </th>
                <th className="text-center px-2 py-1.5 font-medium text-muted-foreground w-16">
                  F1
                </th>
                <th className="text-center px-2 py-1.5 font-medium text-muted-foreground w-16">
                  vs Selected
                </th>
              </tr>
            </thead>
            <tbody>
              {/* Selected experiment row */}
              <tr className="bg-blue-50 dark:bg-blue-950/30">
                <td className="px-2 py-1.5 border-t">
                  <div className="flex items-center gap-1.5">
                    <span className="font-medium">{selectedExperiment.name}</span>
                    <Badge variant="secondary" className="text-xs h-[14px] px-1 font-medium">
                      SELECTED
                    </Badge>
                  </div>
                </td>
                <td className="px-2 py-1.5 border-t text-muted-foreground">-</td>
                <td className="text-center px-2 py-1.5 border-t">
                  {selectedExperiment.results && (
                    <Badge
                      variant={getScoreVariant(selectedExperiment.results.f1_score)}
                      className="text-xs h-[18px] font-medium"
                    >
                      {(selectedExperiment.results.f1_score * 100).toFixed(0)}%
                    </Badge>
                  )}
                </td>
                <td className="text-center px-2 py-1.5 border-t text-muted-foreground">-</td>
              </tr>

              {/* Similar experiments */}
              {similarExperiments.map(({ experiment, diffs, f1Diff }) => (
                <tr
                  key={experiment.id}
                  className="hover:bg-muted/30 cursor-pointer transition-colors"
                  onClick={() => onExperimentClick?.(experiment)}
                >
                  <td className="px-2 py-1.5 border-t">
                    <div className="flex items-center gap-1.5">
                      <span className="font-medium hover:underline">{experiment.name}</span>
                      {experiment.is_baseline && (
                        <Badge variant="outline" className="text-xs h-[14px] px-1 font-medium">
                          BASE
                        </Badge>
                      )}
                    </div>
                  </td>
                  <td className="px-2 py-1.5 border-t">
                    <div className="flex flex-wrap gap-1">
                      {diffs.map((diff) => (
                        <span
                          key={diff.name}
                          className="text-muted-foreground"
                          title={`${diff.selectedValue} → ${diff.otherValue}`}
                        >
                          <span className="font-medium text-foreground">{diff.name}</span>=
                          {diff.otherValue}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="text-center px-2 py-1.5 border-t">
                    {experiment.results && (
                      <Badge
                        variant={getScoreVariant(experiment.results.f1_score)}
                        className="text-xs h-[18px] font-medium"
                      >
                        {(experiment.results.f1_score * 100).toFixed(0)}%
                      </Badge>
                    )}
                  </td>
                  <td className="text-center px-2 py-1.5 border-t">
                    {f1Diff !== null && (
                      <Badge
                        variant={f1Diff >= 0 ? 'default' : 'destructive'}
                        className="text-xs h-[16px] font-medium"
                      >
                        {f1Diff >= 0 ? '+' : ''}
                        {(f1Diff * 100).toFixed(0)}%
                      </Badge>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="text-xs text-muted-foreground leading-[1.5] mt-2">
          Click on any experiment to view its details
        </p>
      </CardContent>
    </Card>
  );
}
