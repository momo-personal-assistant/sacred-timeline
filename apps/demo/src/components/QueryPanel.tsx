'use client';

import { useState } from 'react';

interface ChunkResult {
  id: string;
  canonical_object_id: string;
  content: string;
  method: string;
  metadata: Record<string, any>;
  similarity: number;
}

interface CanonicalObject {
  id: string;
  platform: string;
  object_type: string;
  title?: string;
  properties?: Record<string, any>;
}

interface Relation {
  from_id: string;
  to_id: string;
  type: string;
  source: string;
  confidence: number;
}

interface RetrievalResult {
  query: string;
  chunks: ChunkResult[];
  objects: CanonicalObject[];
  relations: Relation[];
  stats: {
    total_chunks: number;
    total_objects: number;
    total_relations: number;
    retrieval_time_ms: number;
  };
}

function getSimilarityColor(similarity: number): string {
  if (similarity >= 0.4) return '#22c55e'; // green
  if (similarity >= 0.35) return '#eab308'; // yellow
  return '#ef4444'; // red
}

function getSimilarityLabel(similarity: number): string {
  if (similarity >= 0.4) return 'High';
  if (similarity >= 0.35) return 'Medium';
  return 'Low';
}

export default function QueryPanel() {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<RetrievalResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!query.trim()) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch('/api/query', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Query failed');
      }

      const data = await response.json();
      setResult(data);
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <form onSubmit={handleSubmit} style={{ marginBottom: '2rem' }}>
        <div style={{ marginBottom: '1rem' }}>
          <label
            style={{
              display: 'block',
              marginBottom: '0.5rem',
              fontWeight: 500,
              fontSize: '0.9rem',
            }}
          >
            Enter your query
          </label>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="e.g., authentication issues"
            style={{
              width: '100%',
              padding: '0.75rem',
              border: '1px solid #d1d5db',
              borderRadius: '4px',
              fontSize: '1rem',
              boxSizing: 'border-box',
            }}
          />
        </div>
        <button
          type="submit"
          disabled={loading || !query.trim()}
          style={{
            padding: '0.75rem 1.5rem',
            backgroundColor: loading || !query.trim() ? '#9ca3af' : '#2563eb',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            fontSize: '1rem',
            fontWeight: 500,
            cursor: loading || !query.trim() ? 'not-allowed' : 'pointer',
          }}
        >
          {loading ? 'Searching...' : 'Search'}
        </button>
      </form>

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

      {result && (
        <div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: '1rem',
              marginBottom: '2rem',
            }}
          >
            <StatCard label="Chunks" value={result.stats.total_chunks} color="#3b82f6" />
            <StatCard label="Objects" value={result.stats.total_objects} color="#8b5cf6" />
            <StatCard label="Relations" value={result.stats.total_relations} color="#ec4899" />
            <StatCard label="Time (ms)" value={result.stats.retrieval_time_ms} color="#10b981" />
          </div>

          {result.chunks.length === 0 ? (
            <div
              style={{
                padding: '2rem',
                textAlign: 'center',
                color: '#6b7280',
              }}
            >
              No results found. Try a different query.
            </div>
          ) : (
            <>
              <h3
                style={{
                  fontSize: '1.1rem',
                  fontWeight: 600,
                  marginBottom: '1rem',
                }}
              >
                Top Results ({result.chunks.length})
              </h3>

              <div style={{ marginBottom: '2rem' }}>
                {result.chunks.map((chunk, idx) => (
                  <div
                    key={chunk.id}
                    style={{
                      padding: '1rem',
                      backgroundColor: '#f9fafb',
                      border: '1px solid #e5e7eb',
                      borderRadius: '4px',
                      marginBottom: '1rem',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'start',
                        marginBottom: '0.5rem',
                      }}
                    >
                      <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>Result #{idx + 1}</div>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.5rem',
                        }}
                      >
                        <span
                          style={{
                            fontSize: '0.8rem',
                            color: '#6b7280',
                          }}
                        >
                          {getSimilarityLabel(chunk.similarity)}
                        </span>
                        <div
                          style={{
                            padding: '0.25rem 0.75rem',
                            backgroundColor: getSimilarityColor(chunk.similarity),
                            color: 'white',
                            borderRadius: '12px',
                            fontSize: '0.85rem',
                            fontWeight: 600,
                          }}
                        >
                          {(chunk.similarity * 100).toFixed(1)}%
                        </div>
                      </div>
                    </div>

                    <div
                      style={{
                        fontSize: '0.85rem',
                        color: '#6b7280',
                        marginBottom: '0.5rem',
                      }}
                    >
                      Object: {chunk.canonical_object_id} | Method: {chunk.method}
                    </div>

                    {chunk.metadata?.title && (
                      <div
                        style={{
                          fontWeight: 500,
                          marginBottom: '0.5rem',
                          fontSize: '0.95rem',
                        }}
                      >
                        {chunk.metadata.title}
                      </div>
                    )}

                    <div
                      style={{
                        fontSize: '0.9rem',
                        lineHeight: '1.6',
                        color: '#374151',
                      }}
                    >
                      {chunk.content.length > 300
                        ? chunk.content.substring(0, 300) + '...'
                        : chunk.content}
                    </div>
                  </div>
                ))}
              </div>

              {result.objects.length > 0 && (
                <>
                  <h3
                    style={{
                      fontSize: '1.1rem',
                      fontWeight: 600,
                      marginBottom: '1rem',
                    }}
                  >
                    Related Objects ({result.objects.length})
                  </h3>

                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(2, 1fr)',
                      gap: '1rem',
                      marginBottom: '2rem',
                    }}
                  >
                    {result.objects.slice(0, 6).map((obj) => (
                      <div
                        key={obj.id}
                        style={{
                          padding: '1rem',
                          backgroundColor: 'white',
                          border: '1px solid #e5e7eb',
                          borderRadius: '4px',
                        }}
                      >
                        <div
                          style={{
                            fontSize: '0.75rem',
                            color: '#6b7280',
                            marginBottom: '0.25rem',
                            textTransform: 'uppercase',
                          }}
                        >
                          {obj.platform} / {obj.object_type}
                        </div>
                        <div
                          style={{
                            fontWeight: 500,
                            marginBottom: '0.5rem',
                            fontSize: '0.9rem',
                          }}
                        >
                          {obj.title || obj.id}
                        </div>
                        {obj.properties?.status && (
                          <div
                            style={{
                              display: 'inline-block',
                              padding: '0.2rem 0.5rem',
                              backgroundColor: '#dbeafe',
                              color: '#1e40af',
                              borderRadius: '3px',
                              fontSize: '0.75rem',
                            }}
                          >
                            {obj.properties.status}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </>
              )}

              {result.relations.length > 0 && (
                <>
                  <h3
                    style={{
                      fontSize: '1.1rem',
                      fontWeight: 600,
                      marginBottom: '1rem',
                    }}
                  >
                    Relations ({result.relations.length})
                  </h3>

                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(3, 1fr)',
                      gap: '0.5rem',
                    }}
                  >
                    {Object.entries(
                      result.relations.reduce(
                        (acc, rel) => {
                          acc[rel.type] = (acc[rel.type] || 0) + 1;
                          return acc;
                        },
                        {} as Record<string, number>
                      )
                    ).map(([type, count]) => (
                      <div
                        key={type}
                        style={{
                          padding: '0.75rem',
                          backgroundColor: '#f3f4f6',
                          borderRadius: '4px',
                          textAlign: 'center',
                        }}
                      >
                        <div
                          style={{
                            fontSize: '1.5rem',
                            fontWeight: 600,
                            color: '#2563eb',
                          }}
                        >
                          {count}
                        </div>
                        <div
                          style={{
                            fontSize: '0.8rem',
                            color: '#6b7280',
                          }}
                        >
                          {type.replace(/_/g, ' ')}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div
      style={{
        padding: '1rem',
        backgroundColor: 'white',
        border: '1px solid #e5e7eb',
        borderRadius: '4px',
      }}
    >
      <div
        style={{
          fontSize: '1.75rem',
          fontWeight: 600,
          color,
          marginBottom: '0.25rem',
        }}
      >
        {value}
      </div>
      <div
        style={{
          fontSize: '0.85rem',
          color: '#6b7280',
        }}
      >
        {label}
      </div>
    </div>
  );
}
