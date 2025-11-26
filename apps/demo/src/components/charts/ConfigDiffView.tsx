'use client';

import { ArrowRight, ChevronDown, GitCompare, Lightbulb } from 'lucide-react';
import { useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  config: Record<string, any>;
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

type ConfigValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | Record<string, unknown>
  | unknown[];

interface DiffRow {
  category: string;
  parameter: string;
  baselineValue: ConfigValue;
  selectedValue: ConfigValue;
  isChanged: boolean;
  changeType: 'modified' | 'added' | 'removed';
}

function formatValue(value: ConfigValue): string {
  if (value === undefined || value === null) return '-';
  if (typeof value === 'boolean') return value ? 'ON' : 'OFF';
  if (typeof value === 'object') {
    if (Array.isArray(value)) return `[${value.length} items]`;
    return '{...}';
  }
  return String(value);
}

// Convert camelCase/snake_case to readable label
function toReadableLabel(key: string): string {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/_/g, ' ')
    .replace(/^\s/, '')
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

// Recursively compare two config objects and extract differences
function getConfigDiffs(
  selected: Record<string, unknown> | undefined,
  baseline: Record<string, unknown> | undefined
): DiffRow[] {
  const diffs: DiffRow[] = [];

  if (!selected && !baseline) return diffs;

  // Get all unique keys from both configs
  const allKeys = new Set([...Object.keys(selected || {}), ...Object.keys(baseline || {})]);

  // Skip these metadata fields
  const skipFields = new Set(['name', 'description', 'created_at', 'metadata', 'validation']);

  for (const key of allKeys) {
    if (skipFields.has(key)) continue;

    const baseVal = baseline?.[key];
    const selVal = selected?.[key];

    // If both are objects (not arrays), recurse into them
    if (
      baseVal &&
      selVal &&
      typeof baseVal === 'object' &&
      typeof selVal === 'object' &&
      !Array.isArray(baseVal) &&
      !Array.isArray(selVal)
    ) {
      const category = toReadableLabel(key);
      const nestedDiffs = compareNestedObjects(
        category,
        selVal as Record<string, unknown>,
        baseVal as Record<string, unknown>
      );
      diffs.push(...nestedDiffs);
    }
    // If only baseline has this key (object)
    else if (baseVal && typeof baseVal === 'object' && !Array.isArray(baseVal) && !selVal) {
      const category = toReadableLabel(key);
      const nestedDiffs = compareNestedObjects(
        category,
        undefined,
        baseVal as Record<string, unknown>
      );
      diffs.push(...nestedDiffs);
    }
    // If only selected has this key (object)
    else if (selVal && typeof selVal === 'object' && !Array.isArray(selVal) && !baseVal) {
      const category = toReadableLabel(key);
      const nestedDiffs = compareNestedObjects(
        category,
        selVal as Record<string, unknown>,
        undefined
      );
      diffs.push(...nestedDiffs);
    }
    // For primitive values at top level (unlikely but handle)
    else if (baseVal !== selVal) {
      const changeType =
        baseVal === undefined ? 'added' : selVal === undefined ? 'removed' : 'modified';
      diffs.push({
        category: 'General',
        parameter: toReadableLabel(key),
        baselineValue: baseVal as ConfigValue,
        selectedValue: selVal as ConfigValue,
        isChanged: true,
        changeType,
      });
    }
  }

  return diffs;
}

function compareNestedObjects(
  category: string,
  selected: Record<string, unknown> | undefined,
  baseline: Record<string, unknown> | undefined
): DiffRow[] {
  const diffs: DiffRow[] = [];

  const allKeys = new Set([...Object.keys(selected || {}), ...Object.keys(baseline || {})]);

  for (const key of allKeys) {
    const baseVal = baseline?.[key];
    const selVal = selected?.[key];

    // Skip nested objects/arrays for simplicity - just show they differ
    const baseDisplay = baseVal;
    const selDisplay = selVal;

    if (baseVal !== selVal) {
      // Determine change type
      let changeType: 'modified' | 'added' | 'removed' = 'modified';
      if (baseVal === undefined) changeType = 'added';
      else if (selVal === undefined) changeType = 'removed';

      diffs.push({
        category,
        parameter: toReadableLabel(key),
        baselineValue: baseDisplay as ConfigValue,
        selectedValue: selDisplay as ConfigValue,
        isChanged: true,
        changeType,
      });
    }
  }

  return diffs;
}

export default function ConfigDiffView({
  experiment,
  baselineExperiment,
  compact = false,
}: ConfigDiffViewProps) {
  const [isOpen, setIsOpen] = useState(false);

  // Helper to render empty state message for compact mode
  const renderCompactEmpty = (message: string) => (
    <div className="px-3 py-2">
      <span className="text-xs text-muted-foreground">{message}</span>
    </div>
  );

  if (!experiment) {
    if (compact) {
      return renderCompactEmpty('Select an experiment');
    }
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold leading-tight">Configuration Diff</CardTitle>
          <CardDescription className="text-xs leading-[1.5]">
            Select an experiment to view configuration
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (!baselineExperiment) {
    if (compact) {
      return renderCompactEmpty('No baseline to compare');
    }
    return (
      <Card>
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
    if (compact) {
      return renderCompactEmpty('Viewing baseline');
    }
    return (
      <Card>
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

  // Truncate long experiment name for display
  const truncateName = (name: string, maxLen: number = 20) => {
    if (name.length <= maxLen) return name;
    return name.slice(0, maxLen) + '...';
  };

  // Compact mode with Collapsible
  if (compact) {
    return (
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <Button
            variant="ghost"
            className="w-full justify-between px-3 py-2 h-auto hover:bg-muted/50"
          >
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <GitCompare className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
              <span className="text-xs font-medium flex-shrink-0">Config Diff</span>
              <span
                className="text-[10px] text-muted-foreground truncate"
                title={`vs ${baselineExperiment.name}`}
              >
                vs {truncateName(baselineExperiment.name)}
              </span>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0 ml-2">
              {changedParams.length > 0 && (
                <Badge variant="secondary" className="text-[10px] h-[16px] px-1.5 font-medium">
                  {changedParams.length}
                </Badge>
              )}
              <ChevronDown
                className={`h-3.5 w-3.5 text-muted-foreground transition-transform duration-200 ${
                  isOpen ? 'rotate-180' : ''
                }`}
              />
            </div>
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="px-3 pb-3">
          {changedParams.length === 0 ? (
            <div className="text-xs text-muted-foreground py-2 text-center">
              No configuration differences
            </div>
          ) : (
            <div className="space-y-2 mt-2">
              {displayCategories.map((category) => {
                const categoryDiffs = displayDiffs.filter((d) => d.category === category);
                return (
                  <div key={category} className="border rounded-md overflow-hidden">
                    {/* Category Header */}
                    <div className="bg-muted/70 px-2 py-1 border-b">
                      <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
                        {category}
                      </span>
                    </div>
                    {/* Parameters Table */}
                    <table className="w-full text-[11px]">
                      <thead>
                        <tr className="bg-muted/30">
                          <th className="text-left px-2 py-1 font-medium text-muted-foreground">
                            Parameter
                          </th>
                          <th className="text-center px-2 py-1 font-medium text-muted-foreground w-16">
                            Base
                          </th>
                          <th className="text-center px-0.5 py-1 w-4"></th>
                          <th className="text-center px-2 py-1 font-medium text-muted-foreground w-16">
                            New
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {categoryDiffs.map((diff) => {
                          const rowBg =
                            diff.changeType === 'added'
                              ? 'bg-green-50/50 dark:bg-green-950/10'
                              : diff.changeType === 'removed'
                                ? 'bg-red-50/50 dark:bg-red-950/10'
                                : 'bg-yellow-50/50 dark:bg-yellow-950/10';
                          const arrowColor =
                            diff.changeType === 'added'
                              ? 'text-green-600 dark:text-green-500'
                              : diff.changeType === 'removed'
                                ? 'text-red-600 dark:text-red-500'
                                : 'text-yellow-600 dark:text-yellow-500';
                          const valueColor =
                            diff.changeType === 'added'
                              ? 'text-green-700 dark:text-green-400'
                              : diff.changeType === 'removed'
                                ? 'text-red-700 dark:text-red-400'
                                : 'text-yellow-700 dark:text-yellow-400';
                          return (
                            <tr key={`${category}-${diff.parameter}`} className={rowBg}>
                              <td className="px-2 py-1 border-t">
                                <span className="font-medium">{diff.parameter}</span>
                              </td>
                              <td className="text-center px-2 py-1 border-t font-mono text-muted-foreground">
                                {formatValue(diff.baselineValue)}
                              </td>
                              <td className="text-center px-0.5 py-1 border-t">
                                <ArrowRight className={`h-2.5 w-2.5 ${arrowColor}`} />
                              </td>
                              <td
                                className={`text-center px-2 py-1 border-t font-mono font-semibold ${valueColor}`}
                              >
                                {formatValue(diff.selectedValue)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                );
              })}
            </div>
          )}
        </CollapsibleContent>
      </Collapsible>
    );
  }

  // Full mode (non-compact)
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="inline-flex items-center justify-between w-full">
          <div>
            <CardTitle className="text-sm font-semibold leading-tight">
              Configuration Diff
            </CardTitle>
            <CardDescription className="text-xs leading-[1.5] mt-1">
              {experiment.name} vs {baselineExperiment.name}
            </CardDescription>
          </div>
          <Badge
            variant={changedParams.length > 0 ? 'secondary' : 'outline'}
            className="text-xs h-[18px] font-medium"
          >
            {changedParams.length} changed
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
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

        {/* Performance Comparison */}
        {hasResults && (
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

        {/* Suggestion */}
        {changedParams.length > 1 && (
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
