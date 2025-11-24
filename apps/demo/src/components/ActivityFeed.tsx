'use client';

import { ChevronDown, ChevronRight, ExternalLink, RefreshCw } from 'lucide-react';
import { useState, useEffect } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';

interface ResearchActivity {
  id: number;
  operation_type: string;
  operation_name: string;
  description: string;
  status: 'started' | 'completed' | 'failed';
  triggered_by: string;
  details: Record<string, any>;
  git_commit: string | null;
  parent_log_id: number | null;
  experiment_id: number | null;
  duration_ms: number | null;
  started_at: string;
  completed_at: string | null;
}

interface ActivityFeedProps {
  onNavigateToExperiment: () => void;
}

function getStatusIcon(status: string): string {
  switch (status) {
    case 'completed':
      return '✅';
    case 'failed':
      return '❌';
    case 'started':
      return '⏳';
    default:
      return '📌';
  }
}

function getStatusBadgeVariant(
  status: string
): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (status) {
    case 'completed':
      return 'default';
    case 'failed':
      return 'destructive';
    case 'started':
      return 'secondary';
    default:
      return 'outline';
  }
}

function formatTimestamp(timestamp: string): string {
  const date = new Date(timestamp);
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function formatRelativeTime(timestamp: string): string {
  const now = new Date();
  const date = new Date(timestamp);
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return formatTimestamp(timestamp);
}

function getDateGroup(timestamp: string): string {
  const date = new Date(timestamp);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (date.toDateString() === today.toDateString()) {
    return 'Today';
  } else if (date.toDateString() === yesterday.toDateString()) {
    return 'Yesterday';
  } else if (date.getTime() > today.getTime() - 7 * 24 * 60 * 60 * 1000) {
    return 'This Week';
  } else {
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  }
}

function formatDuration(ms: number | null): string {
  if (ms === null) return 'N/A';
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

function groupActivitiesByDate(activities: ResearchActivity[]) {
  const groups: { [key: string]: ResearchActivity[] } = {};

  activities.forEach((activity) => {
    const groupKey = getDateGroup(activity.started_at);
    if (!groups[groupKey]) {
      groups[groupKey] = [];
    }
    groups[groupKey].push(activity);
  });

  return groups;
}

export default function ActivityFeed({ onNavigateToExperiment }: ActivityFeedProps) {
  const [activities, setActivities] = useState<ResearchActivity[]>([]);
  const [operationTypes, setOperationTypes] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<string>('all');
  const [expandedActivities, setExpandedActivities] = useState<Set<number>>(new Set());
  const [selectedActivity, setSelectedActivity] = useState<ResearchActivity | null>(null);
  const [parentActivity, setParentActivity] = useState<ResearchActivity | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    fetchActivities();

    // Real-time polling every 10 seconds
    const interval = setInterval(() => {
      fetchActivities(true);
    }, 10000);

    return () => clearInterval(interval);
  }, [selectedType]);

  const fetchActivities = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const url = `/api/activity?limit=50${selectedType !== 'all' ? `&operation_type=${selectedType}` : ''}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to fetch activities');
      const data = await response.json();
      setActivities(data.activities);
      setOperationTypes(data.operationTypes);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchActivities();
  };

  const toggleExpand = (id: number) => {
    const newExpanded = new Set(expandedActivities);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedActivities(newExpanded);
  };

  const openActivityDetail = async (activity: ResearchActivity) => {
    setSelectedActivity(activity);

    // Fetch parent activity if exists
    if (activity.parent_log_id) {
      try {
        const response = await fetch(`/api/activity?limit=50`);
        const data = await response.json();
        const parent = data.activities.find(
          (a: ResearchActivity) => a.id === activity.parent_log_id
        );
        setParentActivity(parent || null);
      } catch (err) {
        setParentActivity(null);
      }
    } else {
      setParentActivity(null);
    }
  };

  const handleExperimentClick = (_experimentId: number) => {
    onNavigateToExperiment();
    // Scroll to experiment or highlight it (future enhancement)
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8 text-muted-foreground">
        Loading activity log...
      </div>
    );
  }

  if (error) {
    return (
      <Card className="border-destructive">
        <CardContent className="p-6">
          <p className="text-destructive">Error: {error}</p>
        </CardContent>
      </Card>
    );
  }

  const groupedActivities = groupActivitiesByDate(activities);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Research Activity Log</h3>
          <p className="text-sm text-muted-foreground">
            Track all operations, experiments, and data changes
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="flex items-center gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>

          <Select value={selectedType} onValueChange={setSelectedType}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Filter by type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Operations</SelectItem>
              {operationTypes.map((type) => (
                <SelectItem key={type} value={type}>
                  {type}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Separator />

      {activities.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <p className="text-muted-foreground mb-2">No activity logged yet</p>
            <p className="text-sm text-muted-foreground">
              Run experiments or create sample data to see activity here
            </p>
          </CardContent>
        </Card>
      ) : (
        <ScrollArea className="h-[600px] pr-4">
          <div className="space-y-6">
            {Object.entries(groupedActivities).map(([dateGroup, groupActivities]) => (
              <div key={dateGroup} className="space-y-3">
                {/* Date Group Header */}
                <div className="sticky top-0 bg-background z-10 pb-2">
                  <div className="flex items-center gap-2">
                    <Separator className="flex-1" />
                    <span className="text-sm font-semibold text-muted-foreground px-2">
                      {dateGroup}
                    </span>
                    <Separator className="flex-1" />
                  </div>
                </div>

                {/* Activities in this group */}
                <div className="space-y-3">
                  {groupActivities.map((activity) => {
                    const isExpanded = expandedActivities.has(activity.id);
                    return (
                      <Card
                        key={activity.id}
                        className="transition-shadow hover:shadow-md cursor-pointer"
                        onClick={() => openActivityDetail(activity)}
                      >
                        <CardContent className="p-4">
                          <Collapsible
                            open={isExpanded}
                            onOpenChange={() => toggleExpand(activity.id)}
                          >
                            <div className="flex items-start gap-3">
                              <div className="text-2xl flex-shrink-0">
                                {getStatusIcon(activity.status)}
                              </div>

                              <div className="flex-1 min-w-0">
                                <div className="flex items-start justify-between gap-4">
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className="font-semibold">
                                        {activity.operation_name}
                                      </span>
                                      <Badge variant={getStatusBadgeVariant(activity.status)}>
                                        {activity.status}
                                      </Badge>
                                      <Badge variant="outline">{activity.operation_type}</Badge>
                                      {activity.duration_ms !== null && (
                                        <Badge variant="secondary">
                                          {formatDuration(activity.duration_ms)}
                                        </Badge>
                                      )}
                                      {activity.experiment_id && (
                                        <Button
                                          variant="link"
                                          size="sm"
                                          className="h-auto p-0 text-xs"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleExperimentClick(activity.experiment_id!);
                                          }}
                                        >
                                          <ExternalLink className="h-3 w-3 mr-1" />
                                          Experiment #{activity.experiment_id}
                                        </Button>
                                      )}
                                    </div>
                                    {activity.description && (
                                      <p className="text-sm text-muted-foreground mt-1">
                                        {activity.description}
                                      </p>
                                    )}
                                    <p className="text-xs text-muted-foreground mt-2">
                                      {formatRelativeTime(activity.started_at)} •{' '}
                                      {activity.triggered_by}
                                    </p>
                                  </div>

                                  <CollapsibleTrigger
                                    asChild
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      toggleExpand(activity.id);
                                    }}
                                  >
                                    <Button variant="ghost" size="sm" className="flex-shrink-0">
                                      {isExpanded ? (
                                        <ChevronDown className="h-4 w-4" />
                                      ) : (
                                        <ChevronRight className="h-4 w-4" />
                                      )}
                                    </Button>
                                  </CollapsibleTrigger>
                                </div>

                                <CollapsibleContent className="mt-4">
                                  <Separator className="mb-3" />
                                  <div className="space-y-2 text-sm">
                                    {activity.git_commit && (
                                      <div>
                                        <span className="font-medium">Git Commit: </span>
                                        <code className="text-xs bg-muted px-1 py-0.5 rounded">
                                          {activity.git_commit.substring(0, 8)}
                                        </code>
                                      </div>
                                    )}
                                    {activity.completed_at && (
                                      <div>
                                        <span className="font-medium">Completed: </span>
                                        <span className="text-muted-foreground">
                                          {formatTimestamp(activity.completed_at)}
                                        </span>
                                      </div>
                                    )}
                                    {Object.keys(activity.details).length > 0 && (
                                      <div>
                                        <span className="font-medium block mb-1">Details:</span>
                                        <pre className="text-xs bg-muted p-3 rounded overflow-x-auto">
                                          {JSON.stringify(activity.details, null, 2)}
                                        </pre>
                                      </div>
                                    )}
                                  </div>
                                </CollapsibleContent>
                              </div>
                            </div>
                          </Collapsible>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      )}

      <div className="text-sm text-muted-foreground">
        Showing {activities.length} activit{activities.length === 1 ? 'y' : 'ies'}
        {selectedType !== 'all' && ` for ${selectedType}`}
      </div>

      {/* Activity Detail Dialog */}
      <Dialog open={selectedActivity !== null} onOpenChange={() => setSelectedActivity(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span className="text-2xl">
                {selectedActivity && getStatusIcon(selectedActivity.status)}
              </span>
              {selectedActivity?.operation_name}
            </DialogTitle>
            <DialogDescription>
              Activity ID: {selectedActivity?.id} •{' '}
              {selectedActivity && formatTimestamp(selectedActivity.started_at)}
            </DialogDescription>
          </DialogHeader>

          {selectedActivity && (
            <div className="space-y-4 mt-4">
              {/* Parent Activity */}
              {parentActivity && (
                <div className="border-l-4 border-primary pl-4 py-2 bg-muted/50 rounded">
                  <p className="text-sm font-medium mb-1">Parent Activity</p>
                  <p className="text-sm text-muted-foreground">
                    {parentActivity.operation_name} (ID: {parentActivity.id})
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {formatTimestamp(parentActivity.started_at)}
                  </p>
                </div>
              )}

              {/* Basic Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium">Operation Type</p>
                  <Badge variant="outline" className="mt-1">
                    {selectedActivity.operation_type}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm font-medium">Status</p>
                  <Badge variant={getStatusBadgeVariant(selectedActivity.status)} className="mt-1">
                    {selectedActivity.status}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm font-medium">Triggered By</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {selectedActivity.triggered_by}
                  </p>
                </div>
                {selectedActivity.duration_ms !== null && (
                  <div>
                    <p className="text-sm font-medium">Duration</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      {formatDuration(selectedActivity.duration_ms)}
                    </p>
                  </div>
                )}
              </div>

              {/* Description */}
              {selectedActivity.description && (
                <div>
                  <p className="text-sm font-medium">Description</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {selectedActivity.description}
                  </p>
                </div>
              )}

              {/* Experiment Link */}
              {selectedActivity.experiment_id && (
                <div>
                  <p className="text-sm font-medium mb-2">Related Experiment</p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      handleExperimentClick(selectedActivity.experiment_id!);
                      setSelectedActivity(null);
                    }}
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    View Experiment #{selectedActivity.experiment_id}
                  </Button>
                </div>
              )}

              {/* Git Commit */}
              {selectedActivity.git_commit && (
                <div>
                  <p className="text-sm font-medium">Git Commit</p>
                  <code className="text-sm bg-muted px-2 py-1 rounded block mt-1">
                    {selectedActivity.git_commit}
                  </code>
                </div>
              )}

              {/* Timestamps */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium">Started At</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {formatTimestamp(selectedActivity.started_at)}
                  </p>
                </div>
                {selectedActivity.completed_at && (
                  <div>
                    <p className="text-sm font-medium">Completed At</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      {formatTimestamp(selectedActivity.completed_at)}
                    </p>
                  </div>
                )}
              </div>

              {/* Details JSON */}
              {Object.keys(selectedActivity.details).length > 0 && (
                <div>
                  <p className="text-sm font-medium mb-2">Details</p>
                  <pre className="text-xs bg-muted p-4 rounded overflow-x-auto">
                    {JSON.stringify(selectedActivity.details, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
