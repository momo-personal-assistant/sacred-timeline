'use client';

import { Database, Star } from 'lucide-react';
import * as React from 'react';

import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar';

type ExperimentStatus = 'draft' | 'running' | 'completed' | 'failed';

interface ExperimentForSidebar {
  id: number;
  name: string;
  status?: ExperimentStatus;
  is_baseline?: boolean;
  results?: { f1_score: number } | null;
  created_at: string;
}

interface AppSidebarProps extends React.ComponentProps<typeof Sidebar> {
  activeTab: 'database' | 'experiment';
  onTabChange: (tab: 'database' | 'experiment') => void;
  experiments?: ExperimentForSidebar[];
  selectedExperimentId?: number;
  onExperimentSelect?: (id: number) => void;
}

const statusColors: Record<ExperimentStatus, string> = {
  completed: 'text-green-600 dark:text-green-400',
  running: 'text-blue-600 dark:text-blue-400',
  draft: 'text-yellow-600 dark:text-yellow-400',
  failed: 'text-red-600 dark:text-red-400',
};

// Helper: Calculate time ago
function timeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return '1d ago';
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  return `${Math.floor(diffDays / 30)}mo ago`;
}

// Helper: Calculate delta from previous experiment
function calculateDelta(experiments: ExperimentForSidebar[], currentIndex: number): number | null {
  const current = experiments[currentIndex];
  const previous = experiments[currentIndex + 1];

  if (!current?.results?.f1_score || !previous?.results?.f1_score) {
    return null;
  }

  return ((current.results.f1_score - previous.results.f1_score) / previous.results.f1_score) * 100;
}

function ExperimentCard({
  experiment,
  delta,
  isSelected,
  onClick,
  onTabChange,
}: {
  experiment: ExperimentForSidebar;
  delta: number | null;
  isSelected: boolean;
  onClick: () => void;
  onTabChange: () => void;
}) {
  const status = experiment.status || 'completed';
  const statusColor = statusColors[status];
  const f1Score = experiment.results?.f1_score
    ? (experiment.results.f1_score * 100).toFixed(1)
    : null;

  return (
    <button
      onClick={() => {
        onClick();
        onTabChange();
      }}
      className={`w-full max-w-full min-w-0 text-left px-3 py-2 rounded-md transition-colors ${
        isSelected ? 'bg-accent' : 'hover:bg-accent/50'
      }`}
    >
      <div className="space-y-1 min-w-0 w-full overflow-hidden">
        {/* Experiment Name */}
        <div className="flex items-center gap-2 min-w-0 w-full overflow-hidden">
          <div className="text-sm font-medium truncate flex-1 min-w-0">{experiment.name}</div>
          {experiment.is_baseline && (
            <Star className="h-3 w-3 fill-current text-primary shrink-0" />
          )}
        </div>

        {/* F1 Score, Delta & Time */}
        <div className="flex items-center justify-between gap-2 text-xs min-w-0 w-full overflow-hidden">
          <div className="flex items-center gap-2 min-w-0 overflow-hidden">
            {f1Score && (
              <>
                <span className="font-mono text-muted-foreground shrink-0">F1: {f1Score}%</span>
                {delta !== null && (
                  <span
                    className={`font-mono shrink-0 ${
                      delta >= 0
                        ? 'text-green-600 dark:text-green-400'
                        : 'text-red-600 dark:text-red-400'
                    }`}
                  >
                    {delta >= 0 ? '+' : ''}
                    {delta.toFixed(1)}%
                  </span>
                )}
              </>
            )}
            {status === 'draft' && <span className={`${statusColor} shrink-0`}>Draft</span>}
            {status === 'running' && <span className={`${statusColor} shrink-0`}>Running</span>}
            {status === 'failed' && <span className={`${statusColor} shrink-0`}>Failed</span>}
          </div>
          <span className="text-muted-foreground shrink-0">{timeAgo(experiment.created_at)}</span>
        </div>
      </div>
    </button>
  );
}

export function AppSidebar({
  activeTab,
  onTabChange,
  experiments = [],
  selectedExperimentId,
  onExperimentSelect,
  ...props
}: AppSidebarProps) {
  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader className="border-b">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild className="data-[slot=sidebar-menu-button]:!p-1.5">
              <div className="flex items-center gap-2">
                <Database className="h-5 w-5" />
                <div>
                  <div className="text-base font-semibold">Memory RAG</div>
                  <div className="text-xs text-muted-foreground">Week 2: Embedding & Retrieval</div>
                </div>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        {/* Database Button */}
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive={activeTab === 'database'}
                  onClick={() => onTabChange('database')}
                  tooltip="Database"
                >
                  <Database className="h-4 w-4" />
                  <span>Database</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Experiments List */}
        <SidebarGroup className="flex-1 min-h-0">
          <SidebarGroupLabel>Experiments</SidebarGroupLabel>
          <SidebarGroupContent className="flex-1 min-h-0">
            <ScrollArea className="flex-1 w-full">
              <div className="space-y-1 w-full pr-3">
                {experiments.length === 0 ? (
                  <div className="text-xs text-muted-foreground p-3 text-center">
                    No experiments yet
                  </div>
                ) : (
                  experiments.map((exp, index) => (
                    <ExperimentCard
                      key={exp.id}
                      experiment={exp}
                      delta={calculateDelta(experiments, index)}
                      isSelected={selectedExperimentId === exp.id}
                      onClick={() => onExperimentSelect?.(exp.id)}
                      onTabChange={() => onTabChange('experiment')}
                    />
                  ))
                )}
              </div>
            </ScrollArea>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
