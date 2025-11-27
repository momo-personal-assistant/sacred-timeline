'use client';

import { Database, GitBranch, Loader2, RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

import GTGraphView from '@/components/charts/GTGraphView';
import LabelingPanel from '@/components/LabelingPanel';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface CanonicalObject {
  id: string;
  platform: string;
  object_type: string;
  title: string;
  body: string;
  actors: Record<string, unknown>;
  timestamps: Record<string, string>;
  properties: Record<string, unknown>;
  visibility: string;
  indexed_at: string;
  chunk_count: number;
}

interface PlatformSummary {
  platform: string;
  count: number;
  object_types: number;
}

interface ObjectsData {
  objects: CanonicalObject[];
  summary: {
    total: number;
    byPlatform: PlatformSummary[];
  };
}

interface GroundTruthRelation {
  id: number;
  from_id: string;
  to_id: string;
  relation_type: string;
  confidence: number;
  source: string;
  metadata: Record<string, unknown>;
  scenario: string | null;
  created_at: string;
  from_title: string;
  from_platform: string;
  from_type: string;
  to_title: string;
  to_platform: string;
  to_type: string;
}

interface GTObject {
  id: string;
  title: string;
  platform: string;
  object_type: string;
}

interface TypeSummary {
  relation_type: string;
  source: string;
  count: number;
  avg_confidence: number;
}

interface GTData {
  relations: GroundTruthRelation[];
  objects: GTObject[];
  summary: {
    totalRelations: number;
    totalObjects: number;
    byType: TypeSummary[];
  };
}

const platformColors: Record<string, string> = {
  linear: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  zendesk: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  github: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200',
  slack: 'bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200',
};

export default function DatabasePanel() {
  const [activeView, setActiveView] = useState<'db' | 'graph' | 'labeling'>('db');
  const [objectsData, setObjectsData] = useState<ObjectsData | null>(null);
  const [gtData, setGTData] = useState<GTData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPlatform, setSelectedPlatform] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [objectsRes, gtRes] = await Promise.all([
        fetch('/api/database/objects'),
        fetch('/api/database/ground-truth'),
      ]);

      if (!objectsRes.ok || !gtRes.ok) {
        throw new Error('Failed to fetch database data');
      }

      const [objects, gt] = await Promise.all([objectsRes.json(), gtRes.json()]);

      setObjectsData(objects);
      setGTData(gt);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filteredObjects = selectedPlatform
    ? objectsData?.objects.filter((obj) => obj.platform === selectedPlatform)
    : objectsData?.objects;

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
        <p className="text-destructive">{error}</p>
        <Button onClick={fetchData} variant="outline">
          <RefreshCw className="mr-2 h-4 w-4" />
          Retry
        </Button>
      </div>
    );
  }

  return (
    <Tabs
      value={activeView}
      onValueChange={(v) => setActiveView(v as 'db' | 'graph' | 'labeling')}
      className="flex flex-1 flex-col gap-4 min-h-0 p-6"
    >
      {/* Header with Tabs and Stats */}
      <div className="flex items-center justify-between gap-4">
        <TabsList className="h-9">
          <TabsTrigger value="db" className="text-xs">
            DB View
          </TabsTrigger>
          <TabsTrigger value="graph" className="text-xs">
            GT Graph
          </TabsTrigger>
          <TabsTrigger value="labeling" className="text-xs">
            Labeling
          </TabsTrigger>
        </TabsList>

        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="text-muted-foreground">Objects:</span>
            <span className="font-mono font-medium">{objectsData?.summary.total || 0}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-muted-foreground">Platforms:</span>
            <span className="font-mono font-medium">
              {objectsData?.summary.byPlatform.length || 0}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-muted-foreground">Relations:</span>
            <span className="font-mono font-medium">{gtData?.summary.totalRelations || 0}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-muted-foreground">Types:</span>
            <span className="font-mono font-medium">{gtData?.summary.byType.length || 0}</span>
          </div>
          <Button onClick={fetchData} variant="ghost" size="sm" className="h-7 px-2">
            <RefreshCw className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {/* View Content */}

      {/* DB View Tab */}
      <TabsContent value="db" className="flex-1 flex flex-col min-h-0 mt-4">
        <div className="flex flex-col gap-4 flex-1 min-h-0">
          {/* Platform Filter */}
          <div className="flex gap-2 flex-wrap">
            <Badge
              variant={selectedPlatform === null ? 'default' : 'outline'}
              className="cursor-pointer"
              onClick={() => setSelectedPlatform(null)}
            >
              All ({objectsData?.summary.total})
            </Badge>
            {objectsData?.summary.byPlatform.map((p) => (
              <Badge
                key={p.platform}
                variant={selectedPlatform === p.platform ? 'default' : 'outline'}
                className={`cursor-pointer ${selectedPlatform !== p.platform ? platformColors[p.platform] || '' : ''}`}
                onClick={() => setSelectedPlatform(p.platform)}
              >
                {p.platform} ({p.count})
              </Badge>
            ))}
          </div>

          {/* Objects Table */}
          <Card className="flex-1 flex flex-col min-h-0">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <Database className="h-5 w-5" />
                Canonical Objects
              </CardTitle>
              <CardDescription>Objects stored in the canonical_objects table</CardDescription>
            </CardHeader>
            <CardContent className="flex-1 min-h-0 p-0">
              <ScrollArea className="h-[calc(100vh-500px)]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[200px]">ID</TableHead>
                      <TableHead className="w-[100px]">Platform</TableHead>
                      <TableHead className="w-[100px]">Type</TableHead>
                      <TableHead>Title</TableHead>
                      <TableHead className="w-[80px] text-right">Chunks</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredObjects?.map((obj) => (
                      <TableRow key={obj.id}>
                        <TableCell className="font-mono text-xs truncate max-w-[200px]">
                          {obj.id}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={platformColors[obj.platform] || ''}>
                            {obj.platform}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {obj.object_type}
                        </TableCell>
                        <TableCell className="truncate max-w-[300px]">
                          {obj.title || '(no title)'}
                        </TableCell>
                        <TableCell className="text-right font-mono">{obj.chunk_count}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Ground Truth Summary */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <GitBranch className="h-5 w-5" />
                Ground Truth Summary
              </CardTitle>
              <CardDescription>Relations by type and source</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-3">
                {gtData?.summary.byType.map((t) => (
                  <div
                    key={`${t.relation_type}-${t.source}`}
                    className="flex flex-col p-3 rounded-lg border bg-muted/50"
                  >
                    <span className="font-medium text-sm">{t.relation_type}</span>
                    <span className="text-xs text-muted-foreground">{t.source}</span>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-lg font-bold">{t.count}</span>
                      <span className="text-xs text-muted-foreground">
                        avg: {(parseFloat(String(t.avg_confidence)) * 100).toFixed(0)}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </TabsContent>

      {/* Graph View Tab */}
      <TabsContent value="graph" className="flex-1 min-h-0 mt-4">
        {gtData && (
          <GTGraphView
            relations={gtData.relations}
            objects={gtData.objects}
            summary={gtData.summary}
          />
        )}
      </TabsContent>

      {/* Labeling Tab */}
      <TabsContent value="labeling" className="flex-1 flex flex-col min-h-0 mt-4">
        <LabelingPanel />
      </TabsContent>
    </Tabs>
  );
}
