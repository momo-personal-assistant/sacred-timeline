'use client';

import { useState, useEffect } from 'react';

interface Experiment {
  id: number;
  name: string;
  description?: string;
  created_at: string;
  embedding_model?: string;
  chunking_strategy?: string;
  similarity_threshold?: number;
  keyword_overlap_threshold?: number;
  chunk_limit?: number;
  tags?: string[];
  is_baseline?: boolean;
  avg_f1_score: number;
  result_count: number;
}

interface ExperimentResult {
  scenario: string;
  precision: number;
  recall: number;
  f1_score: number;
  true_positives: number;
  false_positives: number;
  false_negatives: number;
}

function getScoreColor(score: number): string {
  if (score >= 0.6) return '#22c55e'; // green
  if (score >= 0.4) return '#eab308'; // yellow
  if (score >= 0.2) return '#f97316'; // orange
  return '#ef4444'; // red
}

export default function ExperimentsPanel() {
  const [experiments, setExperiments] = useState<Experiment[]>([]);
  const [selectedExperiment, setSelectedExperiment] = useState<number | null>(null);
  const [experimentDetails, setExperimentDetails] = useState<{
    experiment: Experiment;
    results: ExperimentResult[];
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchExperiments();
  }, []);

  useEffect(() => {
    if (selectedExperiment) {
      fetchExperimentDetails(selectedExperiment);
    }
  }, [selectedExperiment]);

  const fetchExperiments = async () => {
    try {
      const response = await fetch('/api/experiments');
      if (!response.ok) throw new Error('Failed to fetch experiments');
      const data = await response.json();
      setExperiments(data);
      if (data.length > 0 && !selectedExperiment) {
        setSelectedExperiment(data[0].id);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchExperimentDetails = async (id: number) => {
    try {
      const response = await fetch(`/api/experiments/${id}`);
      if (!response.ok) throw new Error('Failed to fetch experiment details');
      const data = await response.json();
      setExperimentDetails(data);
    } catch (err: any) {
      setError(err.message);
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
          Run a validation test to create your first experiment
        </p>
      </div>
    );
  }

  const bestExperiment = experiments.reduce((best, exp) =>
    exp.avg_f1_score > best.avg_f1_score ? exp : best
  );

  return (
    <div>
      <div style={{ marginBottom: '2rem' }}>
        <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '0.5rem' }}>
          All Experiments ({experiments.length})
        </h3>
        <p style={{ fontSize: '0.9rem', color: '#6b7280', marginBottom: '1rem' }}>
          Track and compare different configurations
        </p>

        {bestExperiment && (
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
              <div style={{ fontWeight: 600 }}>{bestExperiment.name}</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#10b981', marginLeft: 'auto' }}>
                {(bestExperiment.avg_f1_score * 100).toFixed(1)}%
              </div>
            </div>
            <div style={{ fontSize: '0.85rem', color: '#065f46', marginTop: '0.5rem' }}>
              {bestExperiment.embedding_model} + {bestExperiment.chunking_strategy}
            </div>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem' }}>
          {experiments.map((exp) => (
            <div
              key={exp.id}
              onClick={() => setSelectedExperiment(exp.id)}
              style={{
                padding: '1rem',
                backgroundColor: selectedExperiment === exp.id ? '#eff6ff' : 'white',
                border: `2px solid ${selectedExperiment === exp.id ? '#3b82f6' : '#e5e7eb'}`,
                borderRadius: '8px',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                <div>
                  <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>{exp.name}</div>
                  <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                    {new Date(exp.created_at).toLocaleDateString()}
                  </div>
                </div>
                <div
                  style={{
                    fontSize: '1.5rem',
                    fontWeight: 700,
                    color: getScoreColor(exp.avg_f1_score),
                  }}
                >
                  {(exp.avg_f1_score * 100).toFixed(1)}%
                </div>
              </div>

              {exp.embedding_model && (
                <div
                  style={{
                    marginTop: '0.5rem',
                    fontSize: '0.8rem',
                    color: '#6b7280',
                  }}
                >
                  {exp.embedding_model} • {exp.chunking_strategy}
                </div>
              )}

              {exp.tags && exp.tags.length > 0 && (
                <div style={{ marginTop: '0.5rem', display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
                  {exp.tags.map((tag) => (
                    <span
                      key={tag}
                      style={{
                        padding: '0.15rem 0.5rem',
                        backgroundColor: '#f3f4f6',
                        color: '#6b7280',
                        borderRadius: '4px',
                        fontSize: '0.7rem',
                      }}
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {experimentDetails && (
        <div>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '1rem' }}>
            Results by Scenario
          </h3>

          <div style={{ display: 'grid', gap: '1rem' }}>
            {experimentDetails.results.map((result) => (
              <div
                key={result.scenario}
                style={{
                  padding: '1rem',
                  backgroundColor: 'white',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 600, marginBottom: '0.25rem', textTransform: 'capitalize' }}>
                      {result.scenario.replace(/_/g, ' ')}
                    </div>
                    <div style={{ fontSize: '0.85rem', color: '#6b7280' }}>
                      TP: {result.true_positives} | FP: {result.false_positives} | FN: {result.false_negatives}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '1rem' }}>
                    <MetricBadge label="P" value={result.precision} />
                    <MetricBadge label="R" value={result.recall} />
                    <MetricBadge label="F1" value={result.f1_score} />
                  </div>
                </div>
              </div>
            ))}
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
