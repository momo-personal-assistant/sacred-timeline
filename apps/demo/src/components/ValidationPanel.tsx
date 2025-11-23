'use client';

import { useState, useEffect } from 'react';

interface ValidationMetrics {
  scenario: string;
  precision: number;
  recall: number;
  f1_score: number;
  true_positives: number;
  false_positives: number;
  false_negatives: number;
  ground_truth_total: number;
  inferred_total: number;
}

interface ComponentMetrics {
  scenario: string;
  explicit: StageMetrics;
  similarity: StageMetrics;
  overall: StageMetrics;
  by_type: Record<string, { precision: number; recall: number; f1_score: number }>;
}

interface StageMetrics {
  precision: number;
  recall: number;
  f1_score: number;
  true_positives: number;
  false_positives: number;
  false_negatives: number;
  total_inferred: number;
  total_ground_truth: number;
}

function getScoreColor(score: number): string {
  if (score >= 0.6) return '#22c55e'; // green
  if (score >= 0.4) return '#eab308'; // yellow
  if (score >= 0.2) return '#f97316'; // orange
  return '#ef4444'; // red
}

function getScoreLabel(score: number): string {
  if (score >= 0.6) return 'Good';
  if (score >= 0.4) return 'Fair';
  if (score >= 0.2) return 'Poor';
  return 'Very Poor';
}

export default function ValidationPanel() {
  const [scenario, setScenario] = useState('normal');
  const [loading, setLoading] = useState(false);
  const [metrics, setMetrics] = useState<ValidationMetrics | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [experimentName, setExperimentName] = useState('');
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [useSemanticSimilarity, setUseSemanticSimilarity] = useState(false);
  const [showComponentBreakdown, setShowComponentBreakdown] = useState(false);
  const [componentMetrics, setComponentMetrics] = useState<ComponentMetrics | null>(null);
  const [componentLoading, setComponentLoading] = useState(false);

  const fetchMetrics = async (selectedScenario: string, semantic: boolean) => {
    setLoading(true);
    setError(null);
    setMetrics(null);

    try {
      const response = await fetch(
        `/api/validate?scenario=${selectedScenario}&semantic=${semantic}`
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Validation failed');
      }

      const data = await response.json();
      setMetrics(data);
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const fetchComponentMetrics = async (selectedScenario: string, semantic: boolean) => {
    setComponentLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/validate/component-wise?scenario=${selectedScenario}&semantic=${semantic}`
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Component-wise validation failed');
      }

      const data = await response.json();
      setComponentMetrics(data);
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setComponentLoading(false);
    }
  };

  const saveExperiment = async () => {
    if (!metrics || !experimentName.trim()) {
      return;
    }

    setSaving(true);
    setSaveSuccess(false);

    try {
      const response = await fetch('/api/experiments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          experiment: {
            name: experimentName,
            description: `Validation run on ${scenario} scenario${useSemanticSimilarity ? ' (semantic similarity enabled)' : ' (keyword-only)'}`,
            embedding_model: 'text-embedding-3-small',
            chunking_strategy: 'semantic',
            similarity_threshold: useSemanticSimilarity ? 0.35 : 0.85,
            keyword_overlap_threshold: 0.65,
            chunk_limit: 10,
            tags: ['validation', scenario, useSemanticSimilarity ? 'semantic' : 'keyword-only'],
          },
          results: [metrics],
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to save experiment');
      }

      setSaveSuccess(true);
      setShowSaveDialog(false);
      setExperimentName('');

      // Show success for 3 seconds
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to save experiment');
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    fetchMetrics(scenario, useSemanticSimilarity);
    if (showComponentBreakdown) {
      fetchComponentMetrics(scenario, useSemanticSimilarity);
    }
  }, [scenario, useSemanticSimilarity, showComponentBreakdown]);

  return (
    <div>
      <div
        style={{
          marginBottom: '2rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
        }}
      >
        <div>
          <label
            style={{
              display: 'block',
              marginBottom: '0.5rem',
              fontWeight: 500,
              fontSize: '0.9rem',
            }}
          >
            Select Scenario
          </label>
          <select
            value={scenario}
            onChange={(e) => setScenario(e.target.value)}
            style={{
              padding: '0.75rem',
              border: '1px solid #d1d5db',
              borderRadius: '4px',
              fontSize: '1rem',
              minWidth: '200px',
              marginBottom: '1rem',
            }}
          >
            <option value="normal">Normal</option>
            <option value="sales_heavy">Sales Heavy</option>
            <option value="dev_heavy">Dev Heavy</option>
            <option value="pattern">Pattern</option>
            <option value="stress">Stress</option>
          </select>

          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              cursor: 'pointer',
              fontSize: '0.9rem',
            }}
          >
            <input
              type="checkbox"
              checked={useSemanticSimilarity}
              onChange={(e) => setUseSemanticSimilarity(e.target.checked)}
              style={{
                width: '18px',
                height: '18px',
                cursor: 'pointer',
              }}
            />
            <span>
              Use Semantic Similarity{' '}
              <span
                style={{
                  padding: '0.15rem 0.5rem',
                  backgroundColor: useSemanticSimilarity ? '#dbeafe' : '#f3f4f6',
                  color: useSemanticSimilarity ? '#1e40af' : '#6b7280',
                  borderRadius: '12px',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  marginLeft: '0.25rem',
                }}
              >
                {useSemanticSimilarity ? 'IMPROVED' : 'BASELINE'}
              </span>
            </span>
          </label>
        </div>

        {metrics && !loading && (
          <button
            onClick={() => setShowSaveDialog(true)}
            style={{
              padding: '0.75rem 1.5rem',
              backgroundColor: '#10b981',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              fontSize: '1rem',
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            Save as Experiment
          </button>
        )}
      </div>

      {saveSuccess && (
        <div
          style={{
            padding: '1rem',
            backgroundColor: '#d1fae5',
            border: '1px solid #10b981',
            borderRadius: '4px',
            color: '#065f46',
            marginBottom: '1rem',
          }}
        >
          Experiment saved successfully! Check the Experiments tab.
        </div>
      )}

      {showSaveDialog && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
        >
          <div
            style={{
              backgroundColor: 'white',
              borderRadius: '8px',
              padding: '2rem',
              maxWidth: '400px',
              width: '100%',
            }}
          >
            <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.25rem', fontWeight: 600 }}>
              Save Experiment
            </h3>
            <p style={{ margin: '0 0 1rem 0', fontSize: '0.9rem', color: '#6b7280' }}>
              Give this experiment a name to track it later
            </p>
            <input
              type="text"
              value={experimentName}
              onChange={(e) => setExperimentName(e.target.value)}
              placeholder="e.g., Baseline Week 2"
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '1px solid #d1d5db',
                borderRadius: '4px',
                fontSize: '1rem',
                marginBottom: '1rem',
                boxSizing: 'border-box',
              }}
            />
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                onClick={() => {
                  setShowSaveDialog(false);
                  setExperimentName('');
                }}
                style={{
                  flex: 1,
                  padding: '0.75rem',
                  backgroundColor: '#f3f4f6',
                  color: '#374151',
                  border: 'none',
                  borderRadius: '4px',
                  fontSize: '1rem',
                  fontWeight: 500,
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={saveExperiment}
                disabled={saving || !experimentName.trim()}
                style={{
                  flex: 1,
                  padding: '0.75rem',
                  backgroundColor: saving || !experimentName.trim() ? '#9ca3af' : '#10b981',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  fontSize: '1rem',
                  fontWeight: 500,
                  cursor: saving || !experimentName.trim() ? 'not-allowed' : 'pointer',
                }}
              >
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {loading && (
        <div
          style={{
            padding: '2rem',
            textAlign: 'center',
            color: '#6b7280',
          }}
        >
          Loading validation metrics...
        </div>
      )}

      {error && (
        <div
          style={{
            padding: '1rem',
            backgroundColor: '#fee2e2',
            border: '1px solid #ef4444',
            borderRadius: '4px',
            color: '#991b1b',
            marginBottom: '1rem',
          }}
        >
          Error: {error}
        </div>
      )}

      {metrics && !loading && (
        <div>
          <div style={{ marginBottom: '1rem', display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <button
              onClick={() => setShowComponentBreakdown(!showComponentBreakdown)}
              style={{
                padding: '0.5rem 1rem',
                backgroundColor: showComponentBreakdown ? '#3b82f6' : 'white',
                color: showComponentBreakdown ? 'white' : '#374151',
                border: `2px solid ${showComponentBreakdown ? '#3b82f6' : '#d1d5db'}`,
                borderRadius: '4px',
                fontSize: '0.9rem',
                fontWeight: 500,
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
            >
              {showComponentBreakdown ? '✓ ' : ''}Component Breakdown{' '}
              {showComponentBreakdown ? '(Production RAG Analysis)' : ''}
            </button>
            {showComponentBreakdown && (
              <span style={{ fontSize: '0.85rem', color: '#6b7280' }}>
                See exactly which stage needs improvement
              </span>
            )}
          </div>

          <div
            style={{
              padding: '1.5rem',
              backgroundColor: '#f9fafb',
              borderRadius: '8px',
              marginBottom: '2rem',
            }}
          >
            <h3
              style={{
                fontSize: '1.1rem',
                fontWeight: 600,
                marginBottom: '1rem',
                marginTop: 0,
              }}
            >
              Overall Performance
            </h3>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '1rem',
              }}
            >
              <MetricCard
                label="Precision"
                value={metrics.precision}
                color={getScoreColor(metrics.precision)}
                description="How many inferred relations are correct"
              />
              <MetricCard
                label="Recall"
                value={metrics.recall}
                color={getScoreColor(metrics.recall)}
                description="How many correct relations were found"
              />
              <MetricCard
                label="F1 Score"
                value={metrics.f1_score}
                color={getScoreColor(metrics.f1_score)}
                description="Harmonic mean of precision & recall"
              />
            </div>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: '1.5rem',
              marginBottom: '2rem',
            }}
          >
            <div>
              <h3
                style={{
                  fontSize: '1rem',
                  fontWeight: 600,
                  marginBottom: '1rem',
                }}
              >
                Breakdown
              </h3>

              <div
                style={{
                  backgroundColor: 'white',
                  border: '1px solid #e5e7eb',
                  borderRadius: '4px',
                  overflow: 'hidden',
                }}
              >
                <BreakdownRow
                  label="True Positives"
                  value={metrics.true_positives}
                  color="#22c55e"
                  description="Correctly inferred relations"
                />
                <BreakdownRow
                  label="False Positives"
                  value={metrics.false_positives}
                  color="#ef4444"
                  description="Incorrectly inferred relations"
                />
                <BreakdownRow
                  label="False Negatives"
                  value={metrics.false_negatives}
                  color="#f97316"
                  description="Missed ground truth relations"
                />
              </div>
            </div>

            <div>
              <h3
                style={{
                  fontSize: '1rem',
                  fontWeight: 600,
                  marginBottom: '1rem',
                }}
              >
                Totals
              </h3>

              <div
                style={{
                  backgroundColor: 'white',
                  border: '1px solid #e5e7eb',
                  borderRadius: '4px',
                  overflow: 'hidden',
                }}
              >
                <BreakdownRow
                  label="Ground Truth Relations"
                  value={metrics.ground_truth_total}
                  color="#3b82f6"
                  description="Total expected relations"
                />
                <BreakdownRow
                  label="Inferred Relations"
                  value={metrics.inferred_total}
                  color="#8b5cf6"
                  description="Total relations found"
                />
              </div>
            </div>
          </div>

          {showComponentBreakdown && componentMetrics && !componentLoading && (
            <div style={{ marginBottom: '2rem' }}>
              <div
                style={{
                  padding: '1.5rem',
                  backgroundColor: '#eff6ff',
                  border: '2px solid #3b82f6',
                  borderRadius: '8px',
                  marginBottom: '1.5rem',
                }}
              >
                <h3
                  style={{
                    fontSize: '1.1rem',
                    fontWeight: 600,
                    marginTop: 0,
                    marginBottom: '0.5rem',
                    color: '#1e40af',
                  }}
                >
                  🔍 Component-Wise Analysis (RAGAS Style)
                </h3>
                <p style={{ margin: '0 0 1rem 0', fontSize: '0.85rem', color: '#1e40af' }}>
                  Production RAG systems break down performance by stage to identify bottlenecks
                </p>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, 1fr)',
                    gap: '1rem',
                    marginBottom: '1rem',
                  }}
                >
                  <ComponentStageCard
                    title="Explicit Relations"
                    description="Direct data extraction"
                    metrics={componentMetrics.explicit}
                  />
                  <ComponentStageCard
                    title="Similarity Relations"
                    description="Computed inference"
                    metrics={componentMetrics.similarity}
                  />
                  <ComponentStageCard
                    title="Overall Pipeline"
                    description="End-to-end performance"
                    metrics={componentMetrics.overall}
                    highlight
                  />
                </div>

                {Object.keys(componentMetrics.by_type).length > 0 && (
                  <div>
                    <h4
                      style={{
                        fontSize: '0.95rem',
                        fontWeight: 600,
                        marginTop: '1.5rem',
                        marginBottom: '0.75rem',
                        color: '#1e40af',
                      }}
                    >
                      Performance by Relation Type
                    </h4>
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                        gap: '0.75rem',
                      }}
                    >
                      {Object.entries(componentMetrics.by_type).map(([type, metrics]) => (
                        <div
                          key={type}
                          style={{
                            padding: '0.75rem',
                            backgroundColor: 'white',
                            border: '1px solid #dbeafe',
                            borderRadius: '4px',
                          }}
                        >
                          <div
                            style={{
                              fontSize: '0.8rem',
                              fontWeight: 600,
                              marginBottom: '0.5rem',
                              textTransform: 'capitalize',
                            }}
                          >
                            {type.replace(/_/g, ' ')}
                          </div>
                          <div style={{ display: 'flex', gap: '0.5rem', fontSize: '0.75rem' }}>
                            <span>P: {(metrics.precision * 100).toFixed(0)}%</span>
                            <span>R: {(metrics.recall * 100).toFixed(0)}%</span>
                            <span
                              style={{
                                fontWeight: 600,
                                color: getScoreColor(metrics.f1_score),
                              }}
                            >
                              F1: {(metrics.f1_score * 100).toFixed(0)}%
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div
                  style={{
                    marginTop: '1rem',
                    padding: '0.75rem',
                    backgroundColor: 'white',
                    borderRadius: '4px',
                    fontSize: '0.8rem',
                    color: '#1e40af',
                  }}
                >
                  <strong>💡 How to use this:</strong> If "Explicit" is good but "Similarity" is
                  poor, focus on improving embedding quality or similarity thresholds. If both are
                  poor, check your chunking strategy first (biggest impact per research).
                </div>
              </div>
            </div>
          )}

          {showComponentBreakdown && componentLoading && (
            <div style={{ padding: '2rem', textAlign: 'center', color: '#6b7280' }}>
              Loading component breakdown...
            </div>
          )}

          <div
            style={{
              padding: '1.5rem',
              backgroundColor: '#fff7ed',
              border: '1px solid #fb923c',
              borderRadius: '4px',
            }}
          >
            <h4
              style={{
                margin: '0 0 0.5rem 0',
                fontSize: '0.95rem',
                fontWeight: 600,
                color: '#9a3412',
              }}
            >
              Understanding the Metrics
            </h4>
            <ul
              style={{
                margin: 0,
                paddingLeft: '1.5rem',
                fontSize: '0.85rem',
                color: '#7c2d12',
                lineHeight: '1.6',
              }}
            >
              <li>
                <strong>Precision:</strong> Of all the relations we inferred, what percentage were
                actually correct? High precision means fewer false alarms.
              </li>
              <li>
                <strong>Recall:</strong> Of all the correct relations that exist, what percentage
                did we find? High recall means we're not missing important connections.
              </li>
              <li>
                <strong>F1 Score:</strong> The balanced measure between precision and recall. This
                is the main metric to optimize.
              </li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

function MetricCard({
  label,
  value,
  color,
  description,
}: {
  label: string;
  value: number;
  color: string;
  description: string;
}) {
  return (
    <div
      style={{
        padding: '1.5rem',
        backgroundColor: 'white',
        border: '2px solid #e5e7eb',
        borderRadius: '8px',
        textAlign: 'center',
      }}
    >
      <div
        style={{
          fontSize: '0.85rem',
          color: '#6b7280',
          marginBottom: '0.5rem',
          fontWeight: 500,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: '3rem',
          fontWeight: 700,
          color,
          marginBottom: '0.5rem',
          lineHeight: 1,
        }}
      >
        {(value * 100).toFixed(1)}%
      </div>
      <div
        style={{
          display: 'inline-block',
          padding: '0.25rem 0.75rem',
          backgroundColor: color,
          color: 'white',
          borderRadius: '12px',
          fontSize: '0.75rem',
          fontWeight: 600,
          marginBottom: '0.5rem',
        }}
      >
        {getScoreLabel(value)}
      </div>
      <div
        style={{
          fontSize: '0.75rem',
          color: '#9ca3af',
          lineHeight: '1.4',
        }}
      >
        {description}
      </div>
    </div>
  );
}

function BreakdownRow({
  label,
  value,
  color,
  description,
}: {
  label: string;
  value: number;
  color: string;
  description: string;
}) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '1rem',
        borderBottom: '1px solid #f3f4f6',
      }}
    >
      <div>
        <div
          style={{
            fontWeight: 500,
            fontSize: '0.9rem',
            marginBottom: '0.25rem',
          }}
        >
          {label}
        </div>
        <div
          style={{
            fontSize: '0.75rem',
            color: '#6b7280',
          }}
        >
          {description}
        </div>
      </div>
      <div
        style={{
          fontSize: '1.5rem',
          fontWeight: 700,
          color,
        }}
      >
        {value}
      </div>
    </div>
  );
}

function ComponentStageCard({
  title,
  description,
  metrics,
  highlight,
}: {
  title: string;
  description: string;
  metrics: StageMetrics;
  highlight?: boolean;
}) {
  const mainScore = metrics.f1_score;
  const color = getScoreColor(mainScore);

  return (
    <div
      style={{
        padding: '1rem',
        backgroundColor: 'white',
        border: `2px solid ${highlight ? color : '#e5e7eb'}`,
        borderRadius: '8px',
      }}
    >
      <div
        style={{
          fontSize: '0.9rem',
          fontWeight: 600,
          marginBottom: '0.25rem',
        }}
      >
        {title}
      </div>
      <div
        style={{
          fontSize: '0.75rem',
          color: '#6b7280',
          marginBottom: '0.75rem',
        }}
      >
        {description}
      </div>

      <div
        style={{
          fontSize: '2rem',
          fontWeight: 700,
          color,
          marginBottom: '0.5rem',
        }}
      >
        {(mainScore * 100).toFixed(1)}%
      </div>

      <div
        style={{
          display: 'flex',
          gap: '0.5rem',
          fontSize: '0.75rem',
          color: '#6b7280',
          marginBottom: '0.75rem',
        }}
      >
        <span>P: {(metrics.precision * 100).toFixed(0)}%</span>
        <span>R: {(metrics.recall * 100).toFixed(0)}%</span>
      </div>

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: '0.7rem',
          color: '#9ca3af',
          borderTop: '1px solid #f3f4f6',
          paddingTop: '0.5rem',
        }}
      >
        <span>TP: {metrics.true_positives}</span>
        <span>FP: {metrics.false_positives}</span>
        <span>FN: {metrics.false_negatives}</span>
      </div>
    </div>
  );
}
