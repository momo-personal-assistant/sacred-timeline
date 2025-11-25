'use client';

import { Activity, FlaskConical } from 'lucide-react';
import * as React from 'react';

import ExperimentDetailPanel from '@/components/ExperimentDetailPanel';
import SystemStatusPanel from '@/components/SystemStatusPanel';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenuButton,
} from '@/components/ui/sidebar';

interface Experiment {
  id: number;
  name: string;
  description: string;
  config: {
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
  };
  is_baseline: boolean;
  paper_ids: string[];
  git_commit: string | null;
  created_at: string;
  results: {
    f1_score: number;
    precision: number;
    recall: number;
    true_positives: number;
    false_positives: number;
    false_negatives: number;
    retrieval_time_ms: number;
  } | null;
}

interface AppRightSidebarProps extends React.ComponentProps<typeof Sidebar> {
  activeTab: 'query' | 'validate' | 'experiments' | 'activity';
  selectedExperiment: Experiment | null;
  baselineExperiment: Experiment | null;
}

export function AppRightSidebar({
  activeTab,
  selectedExperiment,
  baselineExperiment,
  ...props
}: AppRightSidebarProps) {
  const [sidebarTab, setSidebarTab] = React.useState<'experiment' | 'system'>('experiment');

  // Only show on experiments tab
  if (activeTab !== 'experiments') {
    return null;
  }

  return (
    <Sidebar side="right" collapsible="none" {...props}>
      <SidebarHeader className="px-3 border-b">
        <div className="flex gap-1">
          <SidebarMenuButton
            isActive={sidebarTab === 'experiment'}
            onClick={() => setSidebarTab('experiment')}
            className="flex-1 justify-center"
            size="sm"
          >
            <FlaskConical className="h-4 w-4" />
            <span>Experiment</span>
          </SidebarMenuButton>
          <SidebarMenuButton
            isActive={sidebarTab === 'system'}
            onClick={() => setSidebarTab('system')}
            className="flex-1 justify-center"
            size="sm"
          >
            <Activity className="h-4 w-4" />
            <span>System</span>
          </SidebarMenuButton>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup className="p-0">
          <SidebarGroupContent className="px-4 py-3">
            {sidebarTab === 'experiment' ? (
              <ExperimentDetailPanel
                experiment={selectedExperiment}
                baselineExperiment={baselineExperiment}
              />
            ) : (
              <SystemStatusPanel compact />
            )}
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
