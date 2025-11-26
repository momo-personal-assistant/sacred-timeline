'use client';

import { Save, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import { useState, useEffect } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface ValidationMetrics {
  scenario: string;
  precision: number;
  recall: number;
  f1_score: number;
  true_positives: number;
  false_positives: number;
  false_negatives: number;
  ground_truth_total: number;
  inferred_total: number;
}

interface ComponentMetrics {
  scenario: string;
  explicit: StageMetrics;
  similarity: StageMetrics;
  overall: StageMetrics;
  by_type: Record<string, { precision: number; recall: number; f1_score: number }>;
}

interface StageMetrics {
  precision: number;
  recall: number;
  f1_score: number;
  true_positives: number;
  false_positives: number;
  false_negatives: number;
  total_inferred: number;
  total_ground_truth: number;
}

function getScoreVariant(score: number): 'default' | 'secondary' | 'destructive' {
  if (score >= 0.6) return 'default'; // good
  if (score >= 0.4) return 'secondary'; // fair
  return 'destructive'; // poor
}

function getScoreLabel(score: number): string {
  if (score >= 0.6) return 'Good';
  if (score >= 0.4) return 'Fair';
  if (score >= 0.2) return 'Poor';
  return 'Very Poor';
}

export default function ValidationPanel() {
  const [scenario, setScenario] = useState('normal');
  const [loading, setLoading] = useState(false);
  const [metrics, setMetrics] = useState<ValidationMetrics | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [experimentName, setExperimentName] = useState('');
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [useSemanticSimilarity, setUseSemanticSimilarity] = useState(false);
  const [showComponentBreakdown, setShowComponentBreakdown] = useState(false);
  const [componentMetrics, setComponentMetrics] = useState<ComponentMetrics | null>(null);
  const [componentLoading, setComponentLoading] = useState(false);

  const fetchMetrics = async (selectedScenario: string, semantic: boolean) => {
    setLoading(true);
    setError(null);
    setMetrics(null);

    try {
      const response = await fetch(
        `/api/validate?scenario=${selectedScenario}&semantic=${semantic}`
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Validation failed');
      }

      const data = await response.json();
      setMetrics(data);
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const fetchComponentMetrics = async (selectedScenario: string, semantic: boolean) => {
    setComponentLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/validate/component-wise?scenario=${selectedScenario}&semantic=${semantic}`
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Component-wise validation failed');
      }

      const data = await response.json();
      setComponentMetrics(data);
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setComponentLoading(false);
    }
  };

  const saveExperiment = async () => {
    if (!metrics || !experimentName.trim()) {
      return;
    }

    setSaving(true);
    setSaveSuccess(false);

    try {
      const response = await fetch('/api/experiments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          experiment: {
            name: experimentName,
            description: `Validation run on ${scenario} scenario${useSemanticSimilarity ? ' (semantic similarity enabled)' : ' (keyword-only)'}`,
            embedding_model: 'text-embedding-3-small',
            chunking_strategy: 'semantic',
            similarity_threshold: useSemanticSimilarity ? 0.35 : 0.85,
            keyword_overlap_threshold: 0.65,
            chunk_limit: 10,
            tags: ['validation', scenario, useSemanticSimilarity ? 'semantic' : 'keyword-only'],
          },
          results: [metrics],
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to save experiment');
      }

      setSaveSuccess(true);
      setShowSaveDialog(false);
      setExperimentName('');

      // Show success for 3 seconds
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to save experiment');
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    fetchMetrics(scenario, useSemanticSimilarity);
    if (showComponentBreakdown) {
      fetchComponentMetrics(scenario, useSemanticSimilarity);
    }
  }, [scenario, useSemanticSimilarity, showComponentBreakdown]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Validation Settings</CardTitle>
          <CardDescription>Configure and run validation metrics</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-4 items-end justify-between">
            <div className="space-y-4 flex-1">
              <div className="space-y-2">
                <Label htmlFor="scenario">Select Scenario</Label>
                <Select value={scenario} onValueChange={setScenario}>
                  <SelectTrigger id="scenario" className="w-full sm:w-[200px]">
                    <SelectValue placeholder="Select scenario" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="sales_heavy">Sales Heavy</SelectItem>
                    <SelectItem value="dev_heavy">Dev Heavy</SelectItem>
                    <SelectItem value="pattern">Pattern</SelectItem>
                    <SelectItem value="stress">Stress</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="semantic"
                  checked={useSemanticSimilarity}
                  onCheckedChange={(checked) => setUseSemanticSimilarity(checked as boolean)}
                />
                <Label htmlFor="semantic" className="flex items-center gap-2 cursor-pointer">
                  Use Semantic Similarity
                  <Badge variant={useSemanticSimilarity ? 'default' : 'secondary'}>
                    {useSemanticSimilarity ? 'IMPROVED' : 'BASELINE'}
                  </Badge>
                </Label>
              </div>
            </div>

            {metrics && !loading && (
              <Button onClick={() => setShowSaveDialog(true)} variant="default">
                <Save className="mr-2 h-4 w-4" />
                Save as Experiment
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {saveSuccess && (
        <Card className="border-green-500 bg-green-50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-green-800">
              <CheckCircle className="h-5 w-5" />
              <span>Experiment saved successfully! Check the Experiments tab.</span>
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save Experiment</DialogTitle>
            <DialogDescription>Give this experiment a name to track it later</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="experiment-name">Experiment Name</Label>
              <Input
                id="experiment-name"
                value={experimentName}
                onChange={(e) => setExperimentName(e.target.value)}
                placeholder="e.g., Baseline Week 2"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowSaveDialog(false);
                setExperimentName('');
              }}
            >
              Cancel
            </Button>
            <Button onClick={saveExperiment} disabled={saving || !experimentName.trim()}>
              {saving ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {loading && (
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <p className="text-muted-foreground">Loading validation metrics...</p>
          </CardContent>
        </Card>
      )}

      {error && (
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="text-destructive">Error</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-destructive">{error}</p>
          </CardContent>
        </Card>
      )}

      {metrics && !loading && (
        <>
          <div className="flex gap-4 items-center mb-4">
            <Button
              variant={showComponentBreakdown ? 'default' : 'outline'}
              onClick={() => setShowComponentBreakdown(!showComponentBreakdown)}
            >
              {showComponentBreakdown && <CheckCircle className="mr-2 h-4 w-4" />}
              Component Breakdown
              {showComponentBreakdown && (
                <span className="ml-2 text-xs">(Production RAG Analysis)</span>
              )}
            </Button>
            {showComponentBreakdown && (
              <span className="text-sm text-muted-foreground">
                See exactly which stage needs improvement
              </span>
            )}
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Overall Performance</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-3">
                <MetricCard
                  label="Precision"
                  value={metrics.precision}
                  description="How many inferred relations are correct"
                  icon={<CheckCircle className="h-4 w-4" />}
                />
                <MetricCard
                  label="Recall"
                  value={metrics.recall}
                  description="How many correct relations were found"
                  icon={<CheckCircle className="h-4 w-4" />}
                />
                <MetricCard
                  label="F1 Score"
                  value={metrics.f1_score}
                  description="Harmonic mean of precision & recall"
                  icon={<CheckCircle className="h-4 w-4" />}
                />
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Breakdown</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <BreakdownRow
                  label="True Positives"
                  value={metrics.true_positives}
                  description="Correctly inferred relations"
                  icon={<CheckCircle className="h-5 w-5 text-green-500" />}
                />
                <BreakdownRow
                  label="False Positives"
                  value={metrics.false_positives}
                  description="Incorrectly inferred relations"
                  icon={<XCircle className="h-5 w-5 text-red-500" />}
                />
                <BreakdownRow
                  label="False Negatives"
                  value={metrics.false_negatives}
                  description="Missed ground truth relations"
                  icon={<AlertTriangle className="h-5 w-5 text-orange-500" />}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Totals</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <BreakdownRow
                  label="Ground Truth Relations"
                  value={metrics.ground_truth_total}
                  description="Total expected relations"
                  icon={<CheckCircle className="h-5 w-5 text-blue-500" />}
                />
                <BreakdownRow
                  label="Inferred Relations"
                  value={metrics.inferred_total}
                  description="Total relations found"
                  icon={<CheckCircle className="h-5 w-5 text-purple-500" />}
                />
              </CardContent>
            </Card>
          </div>

          {showComponentBreakdown && componentMetrics && !componentLoading && (
            <Card className="border-blue-200 bg-blue-50">
              <CardHeader>
                <CardTitle className="text-blue-900">
                  🔍 Component-Wise Analysis (RAGAS Style)
                </CardTitle>
                <CardDescription className="text-blue-700">
                  Production RAG systems break down performance by stage to identify bottlenecks
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-3">
                  <ComponentStageCard
                    title="Explicit Relations"
                    description="Direct data extraction"
                    metrics={componentMetrics.explicit}
                  />
                  <ComponentStageCard
                    title="Similarity Relations"
                    description="Computed inference"
                    metrics={componentMetrics.similarity}
                  />
                  <ComponentStageCard
                    title="Overall Pipeline"
                    description="End-to-end performance"
                    metrics={componentMetrics.overall}
                    highlight
                  />
                </div>

                {Object.keys(componentMetrics.by_type).length > 0 && (
                  <div className="mt-6">
                    <h4 className="text-sm font-semibold text-blue-900 mb-3">
                      Performance by Relation Type
                    </h4>
                    <div className="grid gap-3 md:grid-cols-4">
                      {Object.entries(componentMetrics.by_type).map(([type, metrics]) => (
                        <Card key={type} className="bg-white">
                          <CardContent className="pt-4">
                            <div className="text-xs font-semibold mb-2 capitalize">
                              {type.replace(/_/g, ' ')}
                            </div>
                            <div className="flex gap-2 text-xs text-muted-foreground">
                              <span>P: {(metrics.precision * 100).toFixed(0)}%</span>
                              <span>R: {(metrics.recall * 100).toFixed(0)}%</span>
                              <span className="font-semibold">
                                F1: {(metrics.f1_score * 100).toFixed(0)}%
                              </span>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}

                <Card className="bg-white">
                  <CardContent className="pt-4">
                    <p className="text-sm text-blue-900">
                      <strong>💡 How to use this:</strong> If "Explicit" is good but "Similarity" is
                      poor, focus on improving embedding quality or similarity thresholds. If both
                      are poor, check your chunking strategy first (biggest impact per research).
                    </p>
                  </CardContent>
                </Card>
              </CardContent>
            </Card>
          )}

          {showComponentBreakdown && componentLoading && (
            <Card>
              <CardContent className="flex items-center justify-center py-12">
                <p className="text-muted-foreground">Loading component breakdown...</p>
              </CardContent>
            </Card>
          )}

          <Card className="border-orange-200 bg-orange-50">
            <CardHeader>
              <CardTitle className="text-sm text-orange-900">Understanding the Metrics</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm text-orange-800">
                <li>
                  <strong>Precision:</strong> Of all the relations we inferred, what percentage were
                  actually correct? High precision means fewer false alarms.
                </li>
                <li>
                  <strong>Recall:</strong> Of all the correct relations that exist, what percentage
                  did we find? High recall means we're not missing important connections.
                </li>
                <li>
                  <strong>F1 Score:</strong> The balanced measure between precision and recall. This
                  is the main metric to optimize.
                </li>
              </ul>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function MetricCard({
  label,
  value,
  description,
  icon,
}: {
  label: string;
  value: number;
  description: string;
  icon: React.ReactNode;
}) {
  const variant = getScoreVariant(value);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{label}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-bold">{(value * 100).toFixed(1)}%</div>
        <Badge variant={variant} className="mt-2">
          {getScoreLabel(value)}
        </Badge>
        <p className="text-xs text-muted-foreground mt-2">{description}</p>
      </CardContent>
    </Card>
  );
}

function BreakdownRow({
  label,
  value,
  description,
  icon,
}: {
  label: string;
  value: number;
  description: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between py-2 border-b last:border-0">
      <div className="flex items-center gap-3">
        {icon}
        <div>
          <div className="font-medium text-sm">{label}</div>
          <div className="text-xs text-muted-foreground">{description}</div>
        </div>
      </div>
      <div className="text-2xl font-bold">{value}</div>
    </div>
  );
}

function ComponentStageCard({
  title,
  description,
  metrics,
  highlight,
}: {
  title: string;
  description: string;
  metrics: StageMetrics;
  highlight?: boolean;
}) {
  // const variant = getScoreVariant(metrics.f1_score);

  return (
    <Card className={highlight ? 'border-2' : ''}>
      <CardHeader>
        <CardTitle className="text-sm">{title}</CardTitle>
        <CardDescription className="text-xs">{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-bold mb-2">{(metrics.f1_score * 100).toFixed(1)}%</div>
        <div className="flex gap-2 text-xs text-muted-foreground mb-3">
          <span>P: {(metrics.precision * 100).toFixed(0)}%</span>
          <span>R: {(metrics.recall * 100).toFixed(0)}%</span>
        </div>
        <div className="flex justify-between text-xs text-muted-foreground border-t pt-2">
          <span>TP: {metrics.true_positives}</span>
          <span>FP: {metrics.false_positives}</span>
          <span>FN: {metrics.false_negatives}</span>
        </div>
      </CardContent>
    </Card>
  );
}
