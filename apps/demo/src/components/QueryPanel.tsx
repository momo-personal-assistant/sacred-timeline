'use client';

import { Search, Clock, Database, Link as LinkIcon } from 'lucide-react';
import { useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

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

function getSimilarityVariant(similarity: number): 'default' | 'secondary' | 'destructive' {
  if (similarity >= 0.4) return 'default'; // green
  if (similarity >= 0.35) return 'secondary'; // yellow
  return 'destructive'; // red
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
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Search Memory</CardTitle>
          <CardDescription>
            Query the unified memory system for chunks, objects, and relations
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="query">Enter your query</Label>
              <Input
                id="query"
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="e.g., authentication issues"
                className="w-full"
              />
            </div>
            <Button type="submit" disabled={loading || !query.trim()} className="w-full sm:w-auto">
              <Search className="mr-2 h-4 w-4" />
              {loading ? 'Searching...' : 'Search'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {error && (
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="text-destructive">Error</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-destructive">{error}</p>
          </CardContent>
        </Card>
      )}

      {result && (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Chunks</CardTitle>
                <Database className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{result.stats.total_chunks}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Objects</CardTitle>
                <Database className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{result.stats.total_objects}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Relations</CardTitle>
                <LinkIcon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{result.stats.total_relations}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Time (ms)</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{result.stats.retrieval_time_ms}</div>
              </CardContent>
            </Card>
          </div>

          {result.chunks.length === 0 ? (
            <Card>
              <CardContent className="flex items-center justify-center py-12">
                <p className="text-muted-foreground">No results found. Try a different query.</p>
              </CardContent>
            </Card>
          ) : (
            <>
              <Card>
                <CardHeader>
                  <CardTitle>Top Results ({result.chunks.length})</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {result.chunks.map((chunk, idx) => (
                    <Card key={chunk.id}>
                      <CardHeader>
                        <div className="flex items-start justify-between">
                          <CardTitle className="text-base">Result #{idx + 1}</CardTitle>
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-muted-foreground">
                              {getSimilarityLabel(chunk.similarity)}
                            </span>
                            <Badge variant={getSimilarityVariant(chunk.similarity)}>
                              {(chunk.similarity * 100).toFixed(1)}%
                            </Badge>
                          </div>
                        </div>
                        <CardDescription>
                          Object: {chunk.canonical_object_id} | Method: {chunk.method}
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        {chunk.metadata?.title && (
                          <p className="font-medium mb-2">{chunk.metadata.title}</p>
                        )}
                        <p className="text-sm text-muted-foreground leading-relaxed">
                          {chunk.content.length > 300
                            ? chunk.content.substring(0, 300) + '...'
                            : chunk.content}
                        </p>
                      </CardContent>
                    </Card>
                  ))}
                </CardContent>
              </Card>

              {result.objects.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Related Objects ({result.objects.length})</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-4 md:grid-cols-2">
                      {result.objects.slice(0, 6).map((obj) => (
                        <Card key={obj.id}>
                          <CardHeader>
                            <Badge variant="outline" className="w-fit mb-2">
                              {obj.platform} / {obj.object_type}
                            </Badge>
                            <CardTitle className="text-sm">{obj.title || obj.id}</CardTitle>
                          </CardHeader>
                          {obj.properties?.status && (
                            <CardContent>
                              <Badge variant="secondary">{obj.properties.status}</Badge>
                            </CardContent>
                          )}
                        </Card>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {result.relations.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Relations ({result.relations.length})</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-4 md:grid-cols-3">
                      {Object.entries(
                        result.relations.reduce(
                          (acc, rel) => {
                            acc[rel.type] = (acc[rel.type] || 0) + 1;
                            return acc;
                          },
                          {} as Record<string, number>
                        )
                      ).map(([type, count]) => (
                        <Card key={type}>
                          <CardContent className="pt-6">
                            <div className="text-center">
                              <div className="text-3xl font-bold text-primary">{count}</div>
                              <p className="text-sm text-muted-foreground mt-2">
                                {type.replace(/_/g, ' ')}
                              </p>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
