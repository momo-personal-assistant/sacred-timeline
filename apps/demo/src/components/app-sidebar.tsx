'use client';

import { Activity, BeakerIcon, CheckCircle, ChevronRight, Database, Search } from 'lucide-react';
import * as React from 'react';

import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
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
} from '@/components/ui/sidebar';

interface Experiment {
  id: number;
  name: string;
  is_baseline: boolean;
  results: {
    f1_score: number;
  } | null;
}

interface AppSidebarProps extends React.ComponentProps<typeof Sidebar> {
  activeTab: 'query' | 'validate' | 'experiments' | 'activity';
  onTabChange: (tab: 'query' | 'validate' | 'experiments' | 'activity') => void;
  selectedExperimentId?: number;
  onExperimentSelect?: (experimentId: number) => void;
}

const navigationItems = [
  {
    title: 'Query Interface',
    value: 'query' as const,
    icon: Search,
  },
  {
    title: 'Validation Metrics',
    value: 'validate' as const,
    icon: CheckCircle,
  },
  {
    title: 'Experiments',
    value: 'experiments' as const,
    icon: BeakerIcon,
  },
  {
    title: 'Activity',
    value: 'activity' as const,
    icon: Activity,
  },
];

export function AppSidebar({
  activeTab,
  onTabChange,
  selectedExperimentId,
  onExperimentSelect,
  ...props
}: AppSidebarProps) {
  const [experiments, setExperiments] = React.useState<Experiment[]>([]);
  const [experimentsOpen, setExperimentsOpen] = React.useState(true);

  React.useEffect(() => {
    if (activeTab === 'experiments') {
      fetch('/api/experiments')
        .then((res) => res.json())
        .then((data) => setExperiments(data.experiments || []))
        .catch(console.error);
    }
  }, [activeTab]);

  const getScoreVariant = (score: number): 'default' | 'secondary' | 'destructive' => {
    if (score >= 0.6) return 'default';
    if (score >= 0.4) return 'secondary';
    return 'destructive';
  };

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
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
          {navigationItems.map((item) => {
            if (item.value === 'experiments') {
              return (
                <Collapsible
                  key={item.value}
                  open={experimentsOpen}
                  onOpenChange={setExperimentsOpen}
                  className="group/collapsible"
                >
                  <SidebarMenuItem>
                    <CollapsibleTrigger asChild>
                      <SidebarMenuButton
                        isActive={activeTab === item.value}
                        onClick={() => onTabChange(item.value)}
                        tooltip={item.title}
                      >
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                        <ChevronRight className="ml-auto h-4 w-4 transition-transform group-data-[state=open]/collapsible:rotate-90" />
                      </SidebarMenuButton>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <SidebarMenuSub>
                        {experiments.map((exp) => (
                          <SidebarMenuSubItem key={exp.id}>
                            <SidebarMenuSubButton
                              isActive={selectedExperimentId === exp.id}
                              onClick={() => {
                                onTabChange('experiments');
                                onExperimentSelect?.(exp.id);
                              }}
                              className="flex items-center justify-between"
                            >
                              <span className="truncate text-xs">{exp.name}</span>
                              <div className="flex items-center gap-1 ml-2">
                                {exp.is_baseline && (
                                  <Badge
                                    variant="outline"
                                    className="text-xs h-[14px] px-1 font-medium"
                                  >
                                    BASE
                                  </Badge>
                                )}
                                {exp.results && (
                                  <Badge
                                    variant={getScoreVariant(exp.results.f1_score)}
                                    className="text-xs h-[14px] px-1 font-medium"
                                  >
                                    {(exp.results.f1_score * 100).toFixed(0)}%
                                  </Badge>
                                )}
                              </div>
                            </SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                        ))}
                      </SidebarMenuSub>
                    </CollapsibleContent>
                  </SidebarMenuItem>
                </Collapsible>
              );
            }

            return (
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
            );
          })}
        </SidebarMenu>
      </SidebarContent>
    </Sidebar>
  );
}
