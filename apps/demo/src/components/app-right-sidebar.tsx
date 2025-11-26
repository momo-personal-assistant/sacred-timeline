'use client';

import * as React from 'react';

import ExperimentDetailPanel from '@/components/ExperimentDetailPanel';
import SystemStatusPanel from '@/components/SystemStatusPanel';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
} from '@/components/ui/sidebar';

type ExperimentStatus = 'draft' | 'running' | 'completed' | 'failed';

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
  status?: ExperimentStatus;
  config_file_path?: string;
  error_message?: string;
}

interface AppRightSidebarProps extends React.ComponentProps<typeof Sidebar> {
  activeTab: 'query' | 'experiments' | 'activity' | 'reports';
  selectedExperiment: Experiment | null;
  baselineExperiment: Experiment | null;
  onBaselineChange?: () => void;
  onExperimentRun?: () => void;
  onViewDocs?: (experimentId: number) => void;
}

export function AppRightSidebar({
  activeTab,
  selectedExperiment,
  baselineExperiment,
  onBaselineChange,
  onExperimentRun,
  onViewDocs,
  ...props
}: AppRightSidebarProps) {
  const [sidebarTab, setSidebarTab] = React.useState<'experiment' | 'system'>('experiment');

  // Only show on experiments tab
  if (activeTab !== 'experiments') {
    return null;
  }

  return (
    <Sidebar side="right" collapsible="none" {...props}>
      <SidebarHeader className="px-4 py-3 border-b">
        <div className="flex p-0.5 bg-muted rounded-lg">
          <button
            onClick={() => setSidebarTab('experiment')}
            className={`flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              sidebarTab === 'experiment'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Experiment
          </button>
          <button
            onClick={() => setSidebarTab('system')}
            className={`flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              sidebarTab === 'system'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            System
          </button>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup className="p-0">
          <SidebarGroupContent className="px-4 py-3">
            {sidebarTab === 'experiment' ? (
              <ExperimentDetailPanel
                experiment={selectedExperiment}
                baselineExperiment={baselineExperiment}
                onBaselineChange={onBaselineChange}
                onExperimentRun={onExperimentRun}
                onViewDocs={onViewDocs}
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
