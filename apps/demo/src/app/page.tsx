'use client';

import { useEffect, useState } from 'react';

import { AppSidebar } from '@/components/app-sidebar';
import DatabasePanel from '@/components/DatabasePanel';
import ExperimentDocsPanel from '@/components/ExperimentDocsPanel';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';

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

export default function Home() {
  const [activeTab, setActiveTab] = useState<'database' | 'experiment'>('experiment');
  const [selectedExperimentId, setSelectedExperimentId] = useState<number | undefined>();
  const [experiments, setExperiments] = useState<Experiment[]>([]);
  const [_experimentsLoading, setExperimentsLoading] = useState(false);
  const [_experimentsError, setExperimentsError] = useState<string | null>(null);

  // Fetch experiments
  const fetchExperiments = () => {
    setExperimentsLoading(true);
    setExperimentsError(null);
    fetch('/api/experiments')
      .then((res) => {
        if (!res.ok) throw new Error('Failed to fetch experiments');
        return res.json();
      })
      .then((data) => {
        const exps = data.experiments || [];
        setExperiments(exps);
        // Auto-select most recent experiment only on first load
        setSelectedExperimentId((prev) => {
          if (prev === undefined && exps.length > 0) {
            return exps[0].id;
          }
          return prev;
        });
      })
      .catch((err) => {
        setExperimentsError(err instanceof Error ? err.message : 'An error occurred');
      })
      .finally(() => {
        setExperimentsLoading(false);
      });
  };

  useEffect(() => {
    if (activeTab === 'experiment') {
      fetchExperiments();
    }
  }, [activeTab]);

  return (
    <SidebarProvider>
      <AppSidebar
        variant="inset"
        activeTab={activeTab}
        onTabChange={setActiveTab}
        experiments={experiments}
        selectedExperimentId={selectedExperimentId}
        onExperimentSelect={setSelectedExperimentId}
      />
      <SidebarInset className="bg-muted/50">
        <div className="flex flex-1 flex-col min-h-0">
          {activeTab === 'database' ? (
            <DatabasePanel />
          ) : (
            <ExperimentDocsPanel
              selectedExperimentId={selectedExperimentId}
              experiments={experiments}
              onRefresh={fetchExperiments}
            />
          )}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
