'use client';

import { useEffect, useState } from 'react';

import ActivityFeed from '@/components/ActivityFeed';
import { AppRightSidebar } from '@/components/app-right-sidebar';
import { AppSidebar } from '@/components/app-sidebar';
import ExperimentsPanel from '@/components/ExperimentsPanel';
import QueryPanel from '@/components/QueryPanel';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import ValidationPanel from '@/components/ValidationPanel';

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

export default function Home() {
  const [activeTab, setActiveTab] = useState<'query' | 'validate' | 'experiments' | 'activity'>(
    'query'
  );
  const [selectedExperimentId, setSelectedExperimentId] = useState<number | undefined>();
  const [experiments, setExperiments] = useState<Experiment[]>([]);

  // Fetch experiments for the right sidebar
  useEffect(() => {
    if (activeTab === 'experiments') {
      fetch('/api/experiments')
        .then((res) => res.json())
        .then((data) => setExperiments(data.experiments || []))
        .catch(console.error);
    }
  }, [activeTab]);

  const selectedExperiment = selectedExperimentId
    ? experiments.find((exp) => exp.id === selectedExperimentId) || null
    : null;

  const baselineExperiment = experiments.find((exp) => exp.is_baseline) || null;

  return (
    <SidebarProvider>
      <AppSidebar
        variant="inset"
        activeTab={activeTab}
        onTabChange={setActiveTab}
        selectedExperimentId={selectedExperimentId}
        onExperimentSelect={setSelectedExperimentId}
      />
      <SidebarInset className="bg-muted/50">
        <div className="flex flex-1 flex-col">
          <div className="flex flex-1 flex-col gap-4 p-4 md:gap-6 md:p-6">
            {activeTab === 'query' ? (
              <QueryPanel />
            ) : activeTab === 'validate' ? (
              <ValidationPanel />
            ) : activeTab === 'experiments' ? (
              <ExperimentsPanel
                selectedExperimentId={selectedExperimentId}
                onExperimentSelect={setSelectedExperimentId}
              />
            ) : (
              <ActivityFeed onNavigateToExperiment={() => setActiveTab('experiments')} />
            )}
          </div>
        </div>
      </SidebarInset>
      <AppRightSidebar
        activeTab={activeTab}
        selectedExperiment={selectedExperiment}
        baselineExperiment={baselineExperiment}
      />
    </SidebarProvider>
  );
}
