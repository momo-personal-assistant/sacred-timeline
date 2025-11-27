'use client';

import { FileText, GitBranch, Loader2, MessageSquare, RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

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

interface VOCItem {
  id: string;
  platform: 'discord' | 'linear' | 'notion';
  object_type: string;
  title: string;
  body: string;
  actor: string;
  timestamp: string;
  status?: string;
  linkedIssue?: string;
}

interface RelationItem {
  id: string;
  from_id: string;
  from_title: string;
  from_platform: string;
  to_id: string;
  to_title: string;
  to_platform: string;
  relation_type: string;
  confidence: number;
}

interface VOCResponse {
  items: VOCItem[];
  summary: {
    total: number;
    resolved: number;
    pending: number;
    backlog: number;
    linkedCount: number;
  };
}

interface IssuesResponse {
  items: VOCItem[];
  summary: {
    total: number;
    done: number;
    canceled: number;
    project: string;
  };
}

interface RelationsResponse {
  items: RelationItem[];
  summary: {
    total: number;
    avgConfidence: number;
    byType: Record<string, number>;
  };
}

interface FeedbackItem {
  id: string;
  platform: 'notion';
  object_type: string;
  title: string;
  body: string;
  participants: string[];
  timestamp: string;
  keywords?: string[];
  linkedIssues?: string[];
  note_type?: string;
}

interface FeedbackResponse {
  items: FeedbackItem[];
  summary: {
    total: number;
    meeting_notes: number;
    feedback: number;
    pages: number;
    linkedCount: number;
  };
}

const platformColors: Record<string, string> = {
  discord: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200',
  linear: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  notion: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200',
};

const statusColors: Record<string, string> = {
  resolved: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  Done: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  backlog: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200',
  Canceled: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
};

export default function MomoDBPanel() {
  const [activeView, setActiveView] = useState<'voc' | 'linear' | 'feedback' | 'relations'>('voc');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPlatform, setSelectedPlatform] = useState<string | null>(null);

  const [vocData, setVocData] = useState<VOCResponse | null>(null);
  const [issuesData, setIssuesData] = useState<IssuesResponse | null>(null);
  const [feedbackData, setFeedbackData] = useState<FeedbackResponse | null>(null);
  const [relationsData, setRelationsData] = useState<RelationsResponse | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [vocRes, issuesRes, feedbackRes, relationsRes] = await Promise.all([
        fetch('/api/momo/voc'),
        fetch('/api/momo/issues'),
        fetch('/api/momo/feedback'),
        fetch('/api/momo/relations'),
      ]);

      if (!vocRes.ok || !issuesRes.ok || !feedbackRes.ok || !relationsRes.ok) {
        throw new Error('Failed to fetch Momo data');
      }

      const [voc, issues, feedback, relations] = await Promise.all([
        vocRes.json(),
        issuesRes.json(),
        feedbackRes.json(),
        relationsRes.json(),
      ]);

      setVocData(voc);
      setIssuesData(issues);
      setFeedbackData(feedback);
      setRelationsData(relations);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const vocItems = vocData?.items || [];
  const linearItems = issuesData?.items || [];
  const feedbackItems = feedbackData?.items || [];
  const relations = relationsData?.items || [];

  const allItems = [...vocItems, ...linearItems, ...feedbackItems];
  const filteredItems = selectedPlatform
    ? allItems.filter((item) => item.platform === selectedPlatform)
    : allItems;

  const summary = {
    total: allItems.length,
    byPlatform: [
      { platform: 'discord', count: vocItems.length },
      { platform: 'linear', count: linearItems.length },
      { platform: 'notion', count: feedbackItems.length },
    ],
    relations: relations.length,
    resolvedVOC: vocData?.summary.resolved || 0,
    pendingVOC: (vocData?.summary.pending || 0) + (vocData?.summary.backlog || 0),
  };

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
      onValueChange={(v) => setActiveView(v as 'voc' | 'linear' | 'feedback' | 'relations')}
      className="flex flex-1 flex-col gap-4 min-h-0 p-6"
    >
      {/* Header with Tabs and Stats */}
      <div className="flex items-center justify-between gap-4">
        <TabsList className="h-9">
          <TabsTrigger value="voc" className="text-xs">
            VOC View
          </TabsTrigger>
          <TabsTrigger value="linear" className="text-xs">
            Linear View
          </TabsTrigger>
          <TabsTrigger value="feedback" className="text-xs">
            Feedback
          </TabsTrigger>
          <TabsTrigger value="relations" className="text-xs">
            Relations
          </TabsTrigger>
        </TabsList>

        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="text-muted-foreground">Total:</span>
            <span className="font-mono font-medium">{summary.total}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-muted-foreground">VOC:</span>
            <span className="font-mono font-medium">{vocItems.length}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-muted-foreground">Resolved:</span>
            <span className="font-mono font-medium text-green-600">{summary.resolvedVOC}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-muted-foreground">Relations:</span>
            <span className="font-mono font-medium">{summary.relations}</span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={fetchData}
              variant="ghost"
              size="sm"
              className="h-7 px-2"
              title="Refresh data"
            >
              <RefreshCw className="h-3 w-3" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-7 px-3 text-xs"
              onClick={() => {
                alert(
                  'To sync latest Linear issues:\n\n1. Ask Claude: "Please sync Linear issues to Momo DB"\n2. Claude will fetch latest data from Linear using MCP\n3. New/updated issues will be saved to the database'
                );
              }}
              title="Sync Linear issues via Claude"
            >
              Sync Linear
            </Button>
          </div>
        </div>
      </div>

      {/* VOC View Tab */}
      <TabsContent value="voc" className="flex-1 flex flex-col min-h-0 mt-4">
        <div className="flex flex-col gap-4 flex-1 min-h-0">
          {/* Platform Filter */}
          <div className="flex gap-2 flex-wrap">
            <Badge
              variant={selectedPlatform === null ? 'default' : 'outline'}
              className="cursor-pointer"
              onClick={() => setSelectedPlatform(null)}
            >
              All ({summary.total})
            </Badge>
            {summary.byPlatform.map((p) => (
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

          {/* VOC Table */}
          <Card className="flex-1 flex flex-col min-h-0">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                Internal Usecase Data
              </CardTitle>
              <CardDescription>VOC from Discord, Issues from Linear</CardDescription>
            </CardHeader>
            <CardContent className="flex-1 min-h-0 p-0">
              <ScrollArea className="h-[calc(100vh-500px)]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[100px]">ID</TableHead>
                      <TableHead className="w-[100px]">Platform</TableHead>
                      <TableHead>Title</TableHead>
                      <TableHead className="w-[120px]">Actor</TableHead>
                      <TableHead className="w-[100px]">Status</TableHead>
                      <TableHead className="w-[100px]">Linked</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredItems.map((item) => {
                      const actor =
                        'actor' in item
                          ? item.actor
                          : 'participants' in item && item.participants.length > 0
                            ? item.participants[0]
                            : '-';
                      const linkedIssue =
                        'linkedIssue' in item
                          ? item.linkedIssue
                          : 'linkedIssues' in item &&
                              item.linkedIssues &&
                              item.linkedIssues.length > 0
                            ? item.linkedIssues[0]
                            : undefined;

                      return (
                        <TableRow key={item.id}>
                          <TableCell className="font-mono text-xs">{item.id}</TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={platformColors[item.platform] || ''}
                            >
                              {item.platform}
                            </Badge>
                          </TableCell>
                          <TableCell className="truncate max-w-[300px]">{item.title}</TableCell>
                          <TableCell className="text-xs text-muted-foreground truncate">
                            {actor}
                          </TableCell>
                          <TableCell>
                            {'status' in item && item.status && (
                              <Badge variant="outline" className={statusColors[item.status] || ''}>
                                {item.status}
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="font-mono text-xs text-blue-600">
                            {linkedIssue || '-'}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      </TabsContent>

      {/* Linear View Tab */}
      <TabsContent value="linear" className="flex-1 flex flex-col min-h-0 mt-4">
        <Card className="flex-1 flex flex-col min-h-0">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <GitBranch className="h-5 w-5" />
              Linear Issues (Momo v4.)
            </CardTitle>
            <CardDescription>Development issues linked to VOC</CardDescription>
          </CardHeader>
          <CardContent className="flex-1 min-h-0 p-0">
            <ScrollArea className="h-[calc(100vh-400px)]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[100px]">Issue ID</TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead className="w-[100px]">Status</TableHead>
                    <TableHead className="w-[100px]">Assignee</TableHead>
                    <TableHead className="w-[120px]">Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {linearItems.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-mono text-xs text-purple-600">{item.id}</TableCell>
                      <TableCell className="truncate max-w-[400px]">{item.title}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={statusColors[item.status || ''] || ''}>
                          {item.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{item.actor}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {item.timestamp}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          </CardContent>
        </Card>
      </TabsContent>

      {/* Feedback View Tab */}
      <TabsContent value="feedback" className="flex-1 flex flex-col min-h-0 mt-4">
        <Card className="flex-1 flex flex-col min-h-0">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Notion Feedback & Meetings
            </CardTitle>
            <CardDescription>User feedback and meeting notes from Notion</CardDescription>
          </CardHeader>
          <CardContent className="flex-1 min-h-0 p-0">
            <ScrollArea className="h-[calc(100vh-400px)]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[100px]">ID</TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead className="w-[100px]">Type</TableHead>
                    <TableHead className="w-[150px]">Keywords</TableHead>
                    <TableHead className="w-[100px]">Linked Issues</TableHead>
                    <TableHead className="w-[120px]">Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {feedbackItems.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-mono text-xs text-gray-600">{item.id}</TableCell>
                      <TableCell className="truncate max-w-[300px]">{item.title}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {item.object_type}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {item.keywords && item.keywords.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {item.keywords.slice(0, 3).map((kw, i) => (
                              <Badge key={i} variant="outline" className="text-xs">
                                {kw}
                              </Badge>
                            ))}
                            {item.keywords.length > 3 && (
                              <span className="text-xs">+{item.keywords.length - 3}</span>
                            )}
                          </div>
                        ) : (
                          '-'
                        )}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-purple-600">
                        {item.linkedIssues && item.linkedIssues.length > 0
                          ? item.linkedIssues.join(', ')
                          : '-'}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {item.timestamp}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Feedback Summary Card */}
        <Card className="mt-4">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Feedback Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-4">
              <div className="flex flex-col p-3 rounded-lg border bg-muted/50">
                <span className="text-xs text-muted-foreground">Total Feedback</span>
                <span className="text-2xl font-bold">{feedbackItems.length}</span>
              </div>
              <div className="flex flex-col p-3 rounded-lg border bg-muted/50">
                <span className="text-xs text-muted-foreground">Meeting Notes</span>
                <span className="text-2xl font-bold">
                  {feedbackData?.summary.meeting_notes || 0}
                </span>
              </div>
              <div className="flex flex-col p-3 rounded-lg border bg-muted/50">
                <span className="text-xs text-muted-foreground">User Feedback</span>
                <span className="text-2xl font-bold">{feedbackData?.summary.feedback || 0}</span>
              </div>
              <div className="flex flex-col p-3 rounded-lg border bg-muted/50">
                <span className="text-xs text-muted-foreground">Linked to Issues</span>
                <span className="text-2xl font-bold text-green-600">
                  {feedbackData?.summary.linkedCount || 0}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      {/* Relations Tab */}
      <TabsContent value="relations" className="flex-1 flex flex-col min-h-0 mt-4">
        <Card className="flex-1 flex flex-col min-h-0">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <GitBranch className="h-5 w-5" />
              VOC → Development Relations
            </CardTitle>
            <CardDescription>
              Mapping between customer feedback and development work
            </CardDescription>
          </CardHeader>
          <CardContent className="flex-1 min-h-0 p-0">
            <ScrollArea className="h-[calc(100vh-400px)]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[200px]">VOC (Discord)</TableHead>
                    <TableHead className="w-[80px] text-center">→</TableHead>
                    <TableHead className="w-[200px]">Issue (Linear)</TableHead>
                    <TableHead className="w-[120px]">Relation</TableHead>
                    <TableHead className="w-[100px] text-right">Confidence</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {relations.map((rel) => (
                    <TableRow key={rel.id}>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <span className="font-mono text-xs text-muted-foreground">
                            {rel.from_id}
                          </span>
                          <span className="text-sm truncate max-w-[180px]">{rel.from_title}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-center text-muted-foreground">→</TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <span className="font-mono text-xs text-purple-600">{rel.to_id}</span>
                          <span className="text-sm truncate max-w-[180px]">{rel.to_title}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{rel.relation_type}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <span
                          className={`font-mono ${rel.confidence >= 0.9 ? 'text-green-600' : rel.confidence >= 0.7 ? 'text-yellow-600' : 'text-red-600'}`}
                        >
                          {(rel.confidence * 100).toFixed(0)}%
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Summary Card */}
        <Card className="mt-4">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-4">
              <div className="flex flex-col p-3 rounded-lg border bg-muted/50">
                <span className="text-xs text-muted-foreground">Total VOC</span>
                <span className="text-2xl font-bold">{vocItems.length}</span>
              </div>
              <div className="flex flex-col p-3 rounded-lg border bg-muted/50">
                <span className="text-xs text-muted-foreground">Linked to Issues</span>
                <span className="text-2xl font-bold text-green-600">{relations.length}</span>
              </div>
              <div className="flex flex-col p-3 rounded-lg border bg-muted/50">
                <span className="text-xs text-muted-foreground">Coverage</span>
                <span className="text-2xl font-bold">
                  {vocItems.length > 0
                    ? ((relations.length / vocItems.length) * 100).toFixed(0)
                    : 0}
                  %
                </span>
              </div>
              <div className="flex flex-col p-3 rounded-lg border bg-muted/50">
                <span className="text-xs text-muted-foreground">Avg Confidence</span>
                <span className="text-2xl font-bold">
                  {relationsData?.summary.avgConfidence
                    ? (relationsData.summary.avgConfidence * 100).toFixed(0)
                    : 0}
                  %
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}
