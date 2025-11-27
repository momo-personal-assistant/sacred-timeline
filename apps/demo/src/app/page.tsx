'use client';

import { useEffect, useState } from 'react';

import ActivityFeed from '@/components/ActivityFeed';
import { AppRightSidebar } from '@/components/app-right-sidebar';
import { AppSidebar } from '@/components/app-sidebar';
import BenchmarkDashboard from '@/components/BenchmarkDashboard';
import DatabasePanel from '@/components/DatabasePanel';
import ExperimentDocsPanel from '@/components/ExperimentDocsPanel';
import ExperimentsPanel from '@/components/ExperimentsPanel';
import QueryPanel from '@/components/QueryPanel';
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
  const [activeTab, setActiveTab] = useState<
    'query' | 'experiments' | 'activity' | 'reports' | 'benchmark' | 'database'
  >('experiments');
  const [selectedExperimentId, setSelectedExperimentId] = useState<number | undefined>();
  const [selectedReportId, setSelectedReportId] = useState<number | undefined>();
  const [experiments, setExperiments] = useState<Experiment[]>([]);
  const [experimentsLoading, setExperimentsLoading] = useState(false);
  const [experimentsError, setExperimentsError] = useState<string | null>(null);

  // Fetch experiments - runs for both experiments and reports tabs
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
        // Auto-select first report if none selected
        setSelectedReportId((prev) => {
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
    if (activeTab === 'experiments' || activeTab === 'reports') {
      fetchExperiments();
    }
  }, [activeTab]);

  const selectedExperiment = selectedExperimentId
    ? experiments.find((exp) => exp.id === selectedExperimentId) || null
    : null;

  const baselineExperiment = experiments.find((exp) => exp.is_baseline) || null;

  // Navigate to reports tab to view draft experiment docs
  const handleViewDocs = (experimentId: number) => {
    setSelectedReportId(experimentId);
    setActiveTab('reports');
  };

  // Handle report selection from sidebar
  const handleReportSelect = (id: number) => {
    setSelectedReportId(id);
  };

  return (
    <SidebarProvider>
      <AppSidebar
        variant="inset"
        activeTab={activeTab}
        onTabChange={setActiveTab}
        reportExperiments={experiments}
        selectedReportId={selectedReportId}
        onReportSelect={handleReportSelect}
      />
      <SidebarInset className="bg-muted/50">
        <div className="flex flex-1 flex-col min-h-0">
          <div className="flex flex-1 flex-col min-h-0 p-4 md:p-6">
            {activeTab === 'query' ? (
              <QueryPanel />
            ) : activeTab === 'experiments' ? (
              <ExperimentsPanel
                experiments={experiments}
                loading={experimentsLoading}
                error={experimentsError}
                selectedExperimentId={selectedExperimentId}
                onExperimentSelect={setSelectedExperimentId}
              />
            ) : activeTab === 'benchmark' ? (
              <BenchmarkDashboard />
            ) : activeTab === 'database' ? (
              <DatabasePanel />
            ) : activeTab === 'reports' ? (
              <ExperimentDocsPanel
                selectedExperimentId={selectedReportId}
                experiments={experiments}
                onRefresh={fetchExperiments}
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
        onBaselineChange={fetchExperiments}
        onExperimentRun={fetchExperiments}
        onViewDocs={handleViewDocs}
      />
    </SidebarProvider>
  );
}
