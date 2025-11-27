'use client';

import {
  AlertCircle,
  ArrowRight,
  Check,
  ChevronLeft,
  ChevronRight,
  HelpCircle,
  Loader2,
  RefreshCw,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Textarea } from '@/components/ui/textarea';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface CandidateObject {
  id: string;
  platform: string;
  object_type: string;
  title: string;
  body_preview: string;
  properties: Record<string, any>;
}

interface Candidate {
  obj1: CandidateObject;
  obj2: CandidateObject;
  similarity: number;
  sharedLabels: string[];
  sameAssignee: boolean;
}

interface LabelingStats {
  related: number;
  unrelated: number;
  uncertain: number;
}

const platformColors: Record<string, string> = {
  linear: 'bg-purple-100 text-purple-800 border-purple-300',
  zendesk: 'bg-green-100 text-green-800 border-green-300',
  github: 'bg-gray-100 text-gray-800 border-gray-300',
  slack: 'bg-pink-100 text-pink-800 border-pink-300',
};

export default function LabelingPanel() {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<LabelingStats>({ related: 0, unrelated: 0, uncertain: 0 });
  const [notes, setNotes] = useState('');
  const [lastAction, setLastAction] = useState<string | null>(null);

  const fetchCandidates = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/labeling/candidates?limit=20');
      if (!res.ok) throw new Error('Failed to fetch candidates');
      const data = await res.json();
      setCandidates(data.candidates || []);
      setCurrentIndex(0);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch('/api/labeling/save');
      if (!res.ok) return;
      const data = await res.json();
      setStats(data.stats || { related: 0, unrelated: 0, uncertain: 0 });
    } catch (err) {
      console.error('Failed to fetch stats:', err);
    }
  }, []);

  useEffect(() => {
    fetchCandidates();
    fetchStats();
  }, [fetchCandidates, fetchStats]);

  const handleLabel = async (label: 'related' | 'unrelated' | 'uncertain') => {
    const current = candidates[currentIndex];
    if (!current) return;

    setSaving(true);
    setLastAction(null);

    try {
      const res = await fetch('/api/labeling/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from_id: current.obj1.id,
          to_id: current.obj2.id,
          label,
          notes: notes || undefined,
        }),
      });

      if (!res.ok) throw new Error('Failed to save label');

      // Update local stats
      setStats((prev) => ({
        ...prev,
        [label]: prev[label] + 1,
      }));

      setLastAction(label);
      setNotes('');

      // Move to next candidate
      if (currentIndex < candidates.length - 1) {
        setCurrentIndex((prev) => prev + 1);
      } else {
        // Fetch more candidates
        await fetchCandidates();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleKeyPress = useCallback(
    (e: KeyboardEvent) => {
      if (saving) return;

      switch (e.key) {
        case '1':
          handleLabel('related');
          break;
        case '2':
          handleLabel('unrelated');
          break;
        case '3':
          handleLabel('uncertain');
          break;
        case 'ArrowLeft':
          if (currentIndex > 0) setCurrentIndex((prev) => prev - 1);
          break;
        case 'ArrowRight':
          if (currentIndex < candidates.length - 1) setCurrentIndex((prev) => prev + 1);
          break;
      }
    },
    [currentIndex, candidates.length, saving]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [handleKeyPress]);

  const current = candidates[currentIndex];
  const totalLabeled = stats.related + stats.unrelated + stats.uncertain;
  const progressPercent = Math.min((totalLabeled / 100) * 100, 100);

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4">
        <AlertCircle className="h-8 w-8 text-destructive" />
        <p className="text-destructive">{error}</p>
        <Button onClick={fetchCandidates} variant="outline">
          <RefreshCw className="mr-2 h-4 w-4" />
          Retry
        </Button>
      </div>
    );
  }

  if (candidates.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4">
        <Check className="h-12 w-12 text-green-500" />
        <h3 className="text-lg font-medium">All Done!</h3>
        <p className="text-muted-foreground text-center">
          No more candidates to label.
          <br />
          Total labeled: {totalLabeled}
        </p>
        <Button onClick={fetchCandidates} variant="outline">
          <RefreshCw className="mr-2 h-4 w-4" />
          Check for More
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 h-full">
      {/* Header with Progress */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Relation Labeling</h2>
          <p className="text-sm text-muted-foreground">Label pairs to build ground truth</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-sm text-muted-foreground">
            {currentIndex + 1} / {candidates.length}
          </div>
          <Button onClick={fetchCandidates} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Progress Bar */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Progress to 100 labels</span>
            <span className="text-sm text-muted-foreground">{totalLabeled}/100</span>
          </div>
          <Progress value={progressPercent} className="h-2" />
          <div className="flex justify-between mt-2 text-xs text-muted-foreground">
            <span className="text-green-600">Related: {stats.related}</span>
            <span className="text-red-600">Unrelated: {stats.unrelated}</span>
            <span className="text-yellow-600">Uncertain: {stats.uncertain}</span>
          </div>
        </CardContent>
      </Card>

      {/* Main Labeling Area */}
      {current && (
        <div className="flex-1 flex flex-col gap-4 min-h-0">
          {/* Two Objects Side by Side */}
          <div className="grid grid-cols-2 gap-4 flex-1">
            {/* Object 1 */}
            <Card className="flex flex-col">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <Badge className={platformColors[current.obj1.platform]}>
                    {current.obj1.platform}
                  </Badge>
                  <span className="text-xs text-muted-foreground">{current.obj1.object_type}</span>
                </div>
                <CardTitle className="text-base line-clamp-2">
                  {current.obj1.title || '(no title)'}
                </CardTitle>
                {current.obj1.properties?.identifier && (
                  <CardDescription className="font-mono text-xs">
                    {current.obj1.properties.identifier}
                  </CardDescription>
                )}
              </CardHeader>
              <CardContent className="flex-1 overflow-auto">
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {current.obj1.body_preview || '(no content)'}
                </p>
                {current.obj1.properties?.labels?.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {current.obj1.properties.labels.map((label: string) => (
                      <Badge key={label} variant="outline" className="text-xs">
                        {label}
                      </Badge>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Arrow */}
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 hidden">
              <ArrowRight className="h-6 w-6 text-muted-foreground" />
            </div>

            {/* Object 2 */}
            <Card className="flex flex-col">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <Badge className={platformColors[current.obj2.platform]}>
                    {current.obj2.platform}
                  </Badge>
                  <span className="text-xs text-muted-foreground">{current.obj2.object_type}</span>
                </div>
                <CardTitle className="text-base line-clamp-2">
                  {current.obj2.title || '(no title)'}
                </CardTitle>
                {current.obj2.properties?.identifier && (
                  <CardDescription className="font-mono text-xs">
                    {current.obj2.properties.identifier}
                  </CardDescription>
                )}
              </CardHeader>
              <CardContent className="flex-1 overflow-auto">
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {current.obj2.body_preview || '(no content)'}
                </p>
                {current.obj2.properties?.labels?.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {current.obj2.properties.labels.map((label: string) => (
                      <Badge key={label} variant="outline" className="text-xs">
                        {label}
                      </Badge>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Hints */}
          <Card>
            <CardContent className="py-3">
              <div className="flex items-center gap-4 text-sm">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger className="flex items-center gap-1">
                      <span className="text-muted-foreground">Similarity:</span>
                      <span
                        className={
                          current.similarity > 0.6
                            ? 'text-green-600 font-medium'
                            : current.similarity > 0.35
                              ? 'text-yellow-600 font-medium'
                              : 'text-muted-foreground'
                        }
                      >
                        {(current.similarity * 100).toFixed(0)}%
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Embedding cosine similarity</p>
                      <p className="text-xs text-muted-foreground">
                        High similarity doesn't always mean related!
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>

                {current.sharedLabels.length > 0 && (
                  <div className="flex items-center gap-1">
                    <span className="text-muted-foreground">Shared:</span>
                    {current.sharedLabels.slice(0, 3).map((label) => (
                      <Badge key={label} variant="secondary" className="text-xs">
                        {label}
                      </Badge>
                    ))}
                  </div>
                )}

                {current.sameAssignee && (
                  <Badge variant="outline" className="text-xs">
                    Same Assignee
                  </Badge>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Notes (Optional) */}
          <Textarea
            placeholder="Optional notes about this pair..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="h-16 resize-none"
          />

          {/* Action Buttons */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={currentIndex === 0}
                onClick={() => setCurrentIndex((prev) => prev - 1)}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={currentIndex >= candidates.length - 1}
                onClick={() => setCurrentIndex((prev) => prev + 1)}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            <div className="flex items-center gap-2">
              {lastAction && (
                <span className="text-sm text-muted-foreground">Saved as {lastAction}</span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      className="border-yellow-300 hover:bg-yellow-50"
                      disabled={saving}
                      onClick={() => handleLabel('uncertain')}
                    >
                      <HelpCircle className="h-4 w-4 mr-2 text-yellow-600" />
                      Uncertain [3]
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Can't decide / need more info</TooltipContent>
                </Tooltip>
              </TooltipProvider>

              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      className="border-red-300 hover:bg-red-50"
                      disabled={saving}
                      onClick={() => handleLabel('unrelated')}
                    >
                      <X className="h-4 w-4 mr-2 text-red-600" />
                      Unrelated [2]
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Not related - just looks similar</TooltipContent>
                </Tooltip>
              </TooltipProvider>

              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      className="bg-green-600 hover:bg-green-700"
                      disabled={saving}
                      onClick={() => handleLabel('related')}
                    >
                      <Check className="h-4 w-4 mr-2" />
                      Related [1]
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>These are actually related</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>

          {/* Keyboard Shortcuts */}
          <div className="text-xs text-center text-muted-foreground">
            Keyboard: [1] Related [2] Unrelated [3] Uncertain [←][→] Navigate
          </div>
        </div>
      )}
    </div>
  );
}
