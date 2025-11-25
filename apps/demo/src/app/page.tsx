'use client';

import { useEffect, useState } from 'react';

import ActivityFeed from '@/components/ActivityFeed';
import { AppRightSidebar } from '@/components/app-right-sidebar';
import { AppSidebar } from '@/components/app-sidebar';
import ExperimentsPanel from '@/components/ExperimentsPanel';
import QueryPanel from '@/components/QueryPanel';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';

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
  const [activeTab, setActiveTab] = useState<'query' | 'experiments' | 'activity'>('query');
  const [selectedExperimentId, setSelectedExperimentId] = useState<number | undefined>();
  const [experiments, setExperiments] = useState<Experiment[]>([]);

  // Fetch experiments for the right sidebar and auto-select most recent
  useEffect(() => {
    if (activeTab === 'experiments') {
      fetch('/api/experiments')
        .then((res) => res.json())
        .then((data) => {
          const exps = data.experiments || [];
          setExperiments(exps);
          // Auto-select most recent experiment (first in list, sorted by created_at desc)
          if (exps.length > 0 && !selectedExperimentId) {
            setSelectedExperimentId(exps[0].id);
          }
        })
        .catch(console.error);
    }
  }, [activeTab, selectedExperimentId]);

  const selectedExperiment = selectedExperimentId
    ? experiments.find((exp) => exp.id === selectedExperimentId) || null
    : null;

  const baselineExperiment = experiments.find((exp) => exp.is_baseline) || null;

  return (
    <SidebarProvider>
      <AppSidebar variant="inset" activeTab={activeTab} onTabChange={setActiveTab} />
      <SidebarInset className="bg-muted/50">
        <div className="flex flex-1 flex-col min-h-0">
          <div className="flex flex-1 flex-col min-h-0 p-4 md:p-6">
            {activeTab === 'query' ? (
              <QueryPanel />
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
