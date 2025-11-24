'use client';

import { useState, useEffect } from 'react';

interface ExperimentConfig {
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
  };
}

interface ExperimentResults {
  f1_score: number;
  precision: number;
  recall: number;
  true_positives: number;
  false_positives: number;
  false_negatives: number;
  retrieval_time_ms: number;
}

interface Experiment {
  id: number;
  name: string;
  description: string;
  config: ExperimentConfig;
  baseline: boolean;
  paper_ids: string[];
  git_commit: string | null;
  created_at: string;
  results: ExperimentResults | null;
}

function getScoreColor(score: number): string {
  if (score >= 0.6) return '#22c55e'; // green
  if (score >= 0.4) return '#eab308'; // yellow
  if (score >= 0.2) return '#f97316'; // orange
  return '#ef4444'; // red
}

export default function ExperimentsPanel() {
  const [experiments, setExperiments] = useState<Experiment[]>([]);
  const [selectedExperiment, setSelectedExperiment] = useState<Experiment | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchExperiments();
  }, []);

  const fetchExperiments = async () => {
    try {
      const response = await fetch('/api/experiments');
      if (!response.ok) throw new Error('Failed to fetch experiments');
      const data = await response.json();
      setExperiments(data.experiments);
      if (data.experiments.length > 0 && !selectedExperiment) {
        setSelectedExperiment(data.experiments[0]);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: '#6b7280' }}>
        Loading experiments...
      </div>
    );
  }

  if (error) {
    return (
      <div
        style={{
          padding: '1rem',
          backgroundColor: '#fee2e2',
          border: '1px solid #ef4444',
          borderRadius: '4px',
          color: '#991b1b',
        }}
      >
        Error: {error}
      </div>
    );
  }

  if (experiments.length === 0) {
    return (
      <div
        style={{
          padding: '2rem',
          textAlign: 'center',
          backgroundColor: '#f9fafb',
          borderRadius: '8px',
        }}
      >
        <p style={{ color: '#6b7280', marginBottom: '1rem' }}>No experiments yet</p>
        <p style={{ fontSize: '0.9rem', color: '#9ca3af' }}>
          Run `pnpm run experiment` to create your first experiment
        </p>
      </div>
    );
  }

  const experimentsWithResults = experiments.filter((exp) => exp.results !== null);
  const bestExperiment =
    experimentsWithResults.length > 0
      ? experimentsWithResults.reduce((best, exp) =>
          exp.results!.f1_score > best.results!.f1_score ? exp : best
        )
      : null;

  return (
    <div>
      <div style={{ marginBottom: '2rem' }}>
        <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '0.5rem' }}>
          All Experiments ({experiments.length})
        </h3>
        <p style={{ fontSize: '0.9rem', color: '#6b7280', marginBottom: '1rem' }}>
          Track and compare different configurations
        </p>

        {bestExperiment && bestExperiment.results && (
          <div
            style={{
              padding: '1rem',
              backgroundColor: '#ecfdf5',
              border: '2px solid #10b981',
              borderRadius: '8px',
              marginBottom: '1rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <div
                style={{
                  padding: '0.25rem 0.75rem',
                  backgroundColor: '#10b981',
                  color: 'white',
                  borderRadius: '12px',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                }}
              >
                BEST
              </div>
              {bestExperiment.baseline && (
                <div
                  style={{
                    padding: '0.25rem 0.75rem',
                    backgroundColor: '#6366f1',
                    color: 'white',
                    borderRadius: '12px',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                  }}
                >
                  BASELINE
                </div>
              )}
              <div style={{ fontWeight: 600 }}>{bestExperiment.name}</div>
              <div
                style={{
                  fontSize: '1.25rem',
                  fontWeight: 700,
                  color: '#10b981',
                  marginLeft: 'auto',
                }}
              >
                {(bestExperiment.results.f1_score * 100).toFixed(1)}%
              </div>
            </div>
            {bestExperiment.config &&
              bestExperiment.config.embedding &&
              bestExperiment.config.chunking && (
                <div style={{ fontSize: '0.85rem', color: '#065f46', marginTop: '0.5rem' }}>
                  {bestExperiment.config.embedding.model} •{' '}
                  {bestExperiment.config.chunking.strategy}
                </div>
              )}
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem' }}>
          {experiments.map((exp) => (
            <div
              key={exp.id}
              onClick={() => setSelectedExperiment(exp)}
              style={{
                padding: '1rem',
                backgroundColor: selectedExperiment?.id === exp.id ? '#eff6ff' : 'white',
                border: `2px solid ${selectedExperiment?.id === exp.id ? '#3b82f6' : '#e5e7eb'}`,
                borderRadius: '8px',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
            >
              <div
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}
              >
                <div>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      marginBottom: '0.25rem',
                    }}
                  >
                    <div style={{ fontWeight: 600 }}>{exp.name}</div>
                    {exp.baseline && (
                      <div
                        style={{
                          padding: '0.1rem 0.4rem',
                          backgroundColor: '#6366f1',
                          color: 'white',
                          borderRadius: '8px',
                          fontSize: '0.65rem',
                          fontWeight: 600,
                        }}
                      >
                        BASE
                      </div>
                    )}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                    {new Date(exp.created_at).toLocaleDateString()}
                  </div>
                </div>
                {exp.results && (
                  <div
                    style={{
                      fontSize: '1.5rem',
                      fontWeight: 700,
                      color: getScoreColor(exp.results.f1_score),
                    }}
                  >
                    {(exp.results.f1_score * 100).toFixed(1)}%
                  </div>
                )}
              </div>

              {exp.config && exp.config.embedding && exp.config.chunking && (
                <div
                  style={{
                    marginTop: '0.5rem',
                    fontSize: '0.8rem',
                    color: '#6b7280',
                  }}
                >
                  {exp.config.embedding.model} • {exp.config.chunking.strategy}
                </div>
              )}

              {exp.paper_ids && exp.paper_ids.length > 0 && (
                <div
                  style={{ marginTop: '0.5rem', display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}
                >
                  {exp.paper_ids.map((paperId) => (
                    <span
                      key={paperId}
                      style={{
                        padding: '0.15rem 0.5rem',
                        backgroundColor: '#fef3c7',
                        color: '#92400e',
                        borderRadius: '4px',
                        fontSize: '0.7rem',
                      }}
                    >
                      Paper {paperId}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {selectedExperiment && selectedExperiment.results && (
        <div>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '1rem' }}>
            Experiment Details: {selectedExperiment.name}
          </h3>

          {/* Configuration Summary */}
          {selectedExperiment.config && (
            <div
              style={{
                padding: '1rem',
                backgroundColor: '#f9fafb',
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
                marginBottom: '1rem',
              }}
            >
              <div style={{ fontWeight: 600, marginBottom: '0.75rem' }}>Configuration</div>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, 1fr)',
                  gap: '0.75rem',
                  fontSize: '0.85rem',
                }}
              >
                {selectedExperiment.config.embedding && (
                  <div>
                    <span style={{ color: '#6b7280' }}>Embedding:</span>{' '}
                    <span style={{ fontWeight: 500 }}>
                      {selectedExperiment.config.embedding.model} (
                      {selectedExperiment.config.embedding.dimensions}d)
                    </span>
                  </div>
                )}
                {selectedExperiment.config.chunking && (
                  <div>
                    <span style={{ color: '#6b7280' }}>Chunking:</span>{' '}
                    <span style={{ fontWeight: 500 }}>
                      {selectedExperiment.config.chunking.strategy} (
                      {selectedExperiment.config.chunking.maxChunkSize})
                    </span>
                  </div>
                )}
                {selectedExperiment.config.retrieval && (
                  <>
                    <div>
                      <span style={{ color: '#6b7280' }}>Similarity Threshold:</span>{' '}
                      <span style={{ fontWeight: 500 }}>
                        {selectedExperiment.config.retrieval.similarityThreshold}
                      </span>
                    </div>
                    <div>
                      <span style={{ color: '#6b7280' }}>Chunk Limit:</span>{' '}
                      <span style={{ fontWeight: 500 }}>
                        {selectedExperiment.config.retrieval.chunkLimit}
                      </span>
                    </div>
                  </>
                )}
                {selectedExperiment.git_commit && (
                  <div>
                    <span style={{ color: '#6b7280' }}>Git Commit:</span>{' '}
                    <span style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>
                      {selectedExperiment.git_commit.substring(0, 8)}
                    </span>
                  </div>
                )}
                <div>
                  <span style={{ color: '#6b7280' }}>Retrieval Time:</span>{' '}
                  <span style={{ fontWeight: 500 }}>
                    {selectedExperiment.results.retrieval_time_ms}ms
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Results */}
          <div
            style={{
              padding: '1rem',
              backgroundColor: 'white',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>Performance Metrics</div>
                <div style={{ fontSize: '0.85rem', color: '#6b7280' }}>
                  TP: {selectedExperiment.results.true_positives} | FP:{' '}
                  {selectedExperiment.results.false_positives} | FN:{' '}
                  {selectedExperiment.results.false_negatives}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '1rem' }}>
                <MetricBadge label="Precision" value={selectedExperiment.results.precision} />
                <MetricBadge label="Recall" value={selectedExperiment.results.recall} />
                <MetricBadge label="F1" value={selectedExperiment.results.f1_score} />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MetricBadge({ label, value }: { label: string; value: number }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: '0.7rem', color: '#6b7280', marginBottom: '0.1rem' }}>{label}</div>
      <div
        style={{
          fontSize: '1.1rem',
          fontWeight: 700,
          color: getScoreColor(value),
        }}
      >
        {(value * 100).toFixed(0)}%
      </div>
    </div>
  );
}
