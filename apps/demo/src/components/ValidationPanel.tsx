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

  const fetchMetrics = async (selectedScenario: string) => {
    setLoading(true);
    setError(null);
    setMetrics(null);

    try {
      const response = await fetch(`/api/validate?scenario=${selectedScenario}`);

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

  useEffect(() => {
    fetchMetrics(scenario);
  }, [scenario]);

  return (
    <div>
      <div style={{ marginBottom: '2rem' }}>
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
          }}
        >
          <option value="normal">Normal</option>
          <option value="sales_heavy">Sales Heavy</option>
          <option value="dev_heavy">Dev Heavy</option>
          <option value="pattern">Pattern</option>
          <option value="stress">Stress</option>
        </select>
      </div>

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
