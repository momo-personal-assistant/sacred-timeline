'use client';

import {
  Activity,
  BarChart3,
  BeakerIcon,
  CheckCircle2,
  ChevronRight,
  Database,
  FileEdit,
  FileText,
  Loader2,
  Search,
  Star,
  XCircle,
} from 'lucide-react';
import * as React from 'react';

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarSeparator,
} from '@/components/ui/sidebar';

type ExperimentStatus = 'draft' | 'running' | 'completed' | 'failed';

interface ExperimentForSidebar {
  id: number;
  name: string;
  status?: ExperimentStatus;
  is_baseline?: boolean;
  results?: { f1_score: number } | null;
}

interface AppSidebarProps extends React.ComponentProps<typeof Sidebar> {
  activeTab: 'query' | 'experiments' | 'activity' | 'reports' | 'benchmark' | 'database';
  onTabChange: (
    tab: 'query' | 'experiments' | 'activity' | 'reports' | 'benchmark' | 'database'
  ) => void;
  reportExperiments?: ExperimentForSidebar[];
  selectedReportId?: number;
  onReportSelect?: (id: number) => void;
}

const navigationItems = [
  {
    title: 'Experiments',
    value: 'experiments' as const,
    icon: BeakerIcon,
  },
  {
    title: 'Benchmark',
    value: 'benchmark' as const,
    icon: BarChart3,
  },
  {
    title: 'Database',
    value: 'database' as const,
    icon: Database,
  },
  {
    title: 'Query Interface',
    value: 'query' as const,
    icon: Search,
  },
  {
    title: 'Activity',
    value: 'activity' as const,
    icon: Activity,
  },
];

const statusIcons: Record<ExperimentStatus, typeof CheckCircle2> = {
  completed: CheckCircle2,
  running: Loader2,
  draft: FileEdit,
  failed: XCircle,
};

const statusColors: Record<ExperimentStatus, string> = {
  completed: 'text-green-600',
  running: 'text-blue-600',
  draft: 'text-yellow-600',
  failed: 'text-red-600',
};

export function AppSidebar({
  activeTab,
  onTabChange,
  reportExperiments = [],
  selectedReportId,
  onReportSelect,
  ...props
}: AppSidebarProps) {
  const [reportsOpen, setReportsOpen] = React.useState(activeTab === 'reports');

  // Group experiments by status
  const groupedExperiments = React.useMemo(() => {
    const groups: Record<string, ExperimentForSidebar[]> = {
      running: [],
      draft: [],
      completed: [],
      failed: [],
    };

    reportExperiments.forEach((exp) => {
      const status = exp.status || 'completed';
      if (groups[status]) {
        groups[status].push(exp);
      }
    });

    return groups;
  }, [reportExperiments]);

  const handleReportsClick = () => {
    onTabChange('reports');
    setReportsOpen(true);
  };

  const handleExperimentClick = (id: number) => {
    onTabChange('reports');
    onReportSelect?.(id);
  };

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
        <SidebarMenu>
          {navigationItems.map((item) => (
            <SidebarMenuItem key={item.value}>
              <SidebarMenuButton
                isActive={activeTab === item.value}
                onClick={() => onTabChange(item.value)}
                tooltip={item.title}
              >
                <item.icon className="h-4 w-4" />
                <span>{item.title}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>

        <SidebarSeparator className="my-2" />

        <SidebarMenu>
          <SidebarMenuItem>
            <span className="px-2 text-xs font-medium text-muted-foreground">Guides</span>
          </SidebarMenuItem>

          {/* Experiment Reports with collapsible experiment list */}
          <Collapsible
            open={reportsOpen}
            onOpenChange={setReportsOpen}
            className="group/collapsible"
          >
            <SidebarMenuItem>
              <CollapsibleTrigger asChild>
                <SidebarMenuButton
                  isActive={activeTab === 'reports'}
                  onClick={handleReportsClick}
                  tooltip="Experiment Reports"
                >
                  <FileText className="h-4 w-4" />
                  <span>Experiment Reports</span>
                  <ChevronRight className="ml-auto h-4 w-4 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                </SidebarMenuButton>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <SidebarMenuSub>
                  <ScrollArea className="max-h-[50vh]">
                    {/* Running */}
                    {groupedExperiments.running.length > 0 && (
                      <>
                        <div className="px-2 py-1 text-[10px] font-medium text-muted-foreground uppercase">
                          Running
                        </div>
                        {groupedExperiments.running.map((exp) => (
                          <ExperimentSubItem
                            key={exp.id}
                            experiment={exp}
                            isSelected={selectedReportId === exp.id}
                            onClick={() => handleExperimentClick(exp.id)}
                          />
                        ))}
                      </>
                    )}

                    {/* Drafts */}
                    {groupedExperiments.draft.length > 0 && (
                      <>
                        <div className="px-2 py-1 text-[10px] font-medium text-muted-foreground uppercase">
                          Drafts
                        </div>
                        {groupedExperiments.draft.map((exp) => (
                          <ExperimentSubItem
                            key={exp.id}
                            experiment={exp}
                            isSelected={selectedReportId === exp.id}
                            onClick={() => handleExperimentClick(exp.id)}
                          />
                        ))}
                      </>
                    )}

                    {/* Completed */}
                    {groupedExperiments.completed.length > 0 && (
                      <>
                        <div className="px-2 py-1 text-[10px] font-medium text-muted-foreground uppercase">
                          Completed
                        </div>
                        {groupedExperiments.completed.map((exp) => (
                          <ExperimentSubItem
                            key={exp.id}
                            experiment={exp}
                            isSelected={selectedReportId === exp.id}
                            onClick={() => handleExperimentClick(exp.id)}
                          />
                        ))}
                      </>
                    )}

                    {/* Failed */}
                    {groupedExperiments.failed.length > 0 && (
                      <>
                        <div className="px-2 py-1 text-[10px] font-medium text-muted-foreground uppercase">
                          Failed
                        </div>
                        {groupedExperiments.failed.map((exp) => (
                          <ExperimentSubItem
                            key={exp.id}
                            experiment={exp}
                            isSelected={selectedReportId === exp.id}
                            onClick={() => handleExperimentClick(exp.id)}
                          />
                        ))}
                      </>
                    )}

                    {reportExperiments.length === 0 && (
                      <div className="px-2 py-2 text-xs text-muted-foreground">
                        No experiments yet
                      </div>
                    )}
                  </ScrollArea>
                </SidebarMenuSub>
              </CollapsibleContent>
            </SidebarMenuItem>
          </Collapsible>
        </SidebarMenu>
      </SidebarContent>
    </Sidebar>
  );
}

function ExperimentSubItem({
  experiment,
  isSelected,
  onClick,
}: {
  experiment: ExperimentForSidebar;
  isSelected: boolean;
  onClick: () => void;
}) {
  const status = experiment.status || 'completed';
  const StatusIcon = statusIcons[status];
  const statusColor = statusColors[status];
  const f1Score = experiment.results?.f1_score
    ? (experiment.results.f1_score * 100).toFixed(0)
    : null;

  return (
    <SidebarMenuSubItem>
      <SidebarMenuSubButton
        isActive={isSelected}
        onClick={onClick}
        className="flex items-center justify-between gap-1 pr-2"
      >
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          <StatusIcon
            className={`h-3 w-3 shrink-0 ${statusColor} ${status === 'running' ? 'animate-spin' : ''}`}
          />
          <span className="truncate text-xs">{experiment.name}</span>
          {experiment.is_baseline && (
            <Star className="h-2.5 w-2.5 shrink-0 fill-current text-primary" />
          )}
        </div>
        {f1Score && (
          <span
            className={`text-[10px] font-mono shrink-0 ${
              parseFloat(f1Score) >= 60 ? 'text-green-600' : 'text-orange-600'
            }`}
          >
            {f1Score}%
          </span>
        )}
      </SidebarMenuSubButton>
    </SidebarMenuSubItem>
  );
}
