'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

// Dynamic import to avoid SSR issues with canvas
const ForceGraph2D = dynamic(() => import('react-force-graph-2d'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-[400px]">
      <span className="text-muted-foreground text-sm">Loading graph...</span>
    </div>
  ),
});

interface RelationWithStatus {
  from_id: string;
  to_id: string;
  type: string;
  status: 'tp' | 'fp' | 'fn';
  confidence?: number;
}

interface Paper {
  id: string;
  title: string;
}

interface RelationsData {
  relations: RelationWithStatus[];
  papers: Paper[];
  metrics: {
    true_positives: number;
    false_positives: number;
    false_negatives: number;
    precision: number;
    recall: number;
    f1_score: number;
  };
}

// Extended node type with force-graph properties
interface GraphNode {
  id: string;
  name: string;
  val: number;
  color: string;
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
  fx?: number;
  fy?: number;
}

// Extended link type with force-graph properties
interface GraphLink {
  source: string | GraphNode;
  target: string | GraphNode;
  status: 'tp' | 'fp' | 'fn';
  type: string;
  color: string;
  width: number;
  curvature: number;
}

interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
}

interface RelationGraphViewProps {
  experimentConfig?: {
    useSemanticSimilarity?: boolean;
    similarityThreshold?: number;
    keywordOverlapThreshold?: number;
    semanticWeight?: number;
  };
}

const STATUS_COLORS = {
  tp: '#22c55e', // green-500 - True Positive (correct)
  fp: '#ef4444', // red-500 - False Positive (wrong prediction)
  fn: '#9ca3af', // gray-400 - False Negative (missed)
};

const STATUS_LABELS = {
  tp: 'True Positive',
  fp: 'False Positive',
  fn: 'False Negative',
};

export default function RelationGraphView({ experimentConfig }: RelationGraphViewProps) {
  const [data, setData] = useState<RelationsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<'all' | 'tp' | 'fp' | 'fn'>('all');
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 600, height: 400 });

  // Fetch relation data
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          scenario: 'normal',
          semantic: experimentConfig?.useSemanticSimilarity ? 'true' : 'false',
        });

        if (experimentConfig?.similarityThreshold !== undefined) {
          params.set('similarityThreshold', String(experimentConfig.similarityThreshold));
        }
        if (experimentConfig?.keywordOverlapThreshold !== undefined) {
          params.set('keywordOverlapThreshold', String(experimentConfig.keywordOverlapThreshold));
        }
        if (experimentConfig?.semanticWeight !== undefined) {
          params.set('semanticWeight', String(experimentConfig.semanticWeight));
        }

        const response = await fetch(`/api/validate/relations?${params}`);
        if (!response.ok) {
          throw new Error('Failed to fetch relations');
        }
        const result = await response.json();
        setData(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [experimentConfig]);

  // Handle container resize
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setDimensions({ width: rect.width, height: 400 });
      }
    };

    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  // Transform data for force graph
  const graphData = useMemo((): GraphData => {
    if (!data) return { nodes: [], links: [] };

    const paperMap = new Map(data.papers.map((p) => [p.id, p.title]));

    // Collect all unique node IDs from relations
    const nodeIds = new Set<string>();
    const filteredRelations =
      selectedStatus === 'all'
        ? data.relations
        : data.relations.filter((r) => r.status === selectedStatus);

    filteredRelations.forEach((rel) => {
      nodeIds.add(rel.from_id);
      nodeIds.add(rel.to_id);
    });

    // Count connections per node
    const connectionCount = new Map<string, number>();
    filteredRelations.forEach((rel) => {
      connectionCount.set(rel.from_id, (connectionCount.get(rel.from_id) || 0) + 1);
      connectionCount.set(rel.to_id, (connectionCount.get(rel.to_id) || 0) + 1);
    });

    // Create nodes - color is handled in nodeCanvasObject to avoid re-renders on hover
    const nodes: GraphNode[] = Array.from(nodeIds).map((id) => ({
      id,
      name: paperMap.get(id) || id.slice(0, 8),
      val: Math.max(1, connectionCount.get(id) || 1),
      color: '#64748b', // Default color, hover highlighting done in canvas render
    }));

    // Create links with curvature for multi-edges
    const linkPairs = new Map<string, number>();
    const links: GraphLink[] = filteredRelations.map((rel) => {
      const pairKey = [rel.from_id, rel.to_id].sort().join('|');
      const pairIndex = linkPairs.get(pairKey) || 0;
      linkPairs.set(pairKey, pairIndex + 1);

      return {
        source: rel.from_id,
        target: rel.to_id,
        status: rel.status,
        type: rel.type,
        color: STATUS_COLORS[rel.status],
        width: rel.status === 'fn' ? 1 : 2,
        curvature: pairIndex * 0.3,
      };
    });

    return { nodes, links };
  }, [data, selectedStatus]); // Removed hoveredNode to prevent re-renders on hover

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleNodeHover = useCallback((node: any) => {
    setHoveredNode(node?.id || null);
  }, []);

  if (loading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold leading-tight">Relation Graph</CardTitle>
          <CardDescription className="text-xs leading-[1.5]">
            Loading relation data...
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-[400px]">
            <span className="text-muted-foreground text-sm">Loading...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold leading-tight">Relation Graph</CardTitle>
          <CardDescription className="text-xs leading-[1.5] text-red-500">
            Error: {error}
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (!data || data.relations.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold leading-tight">Relation Graph</CardTitle>
          <CardDescription className="text-xs leading-[1.5]">No relations found</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-sm font-semibold leading-tight">Relation Graph</CardTitle>
            <CardDescription className="text-xs leading-[1.5] mt-1">
              Visual comparison: Inferred vs Ground Truth
            </CardDescription>
          </div>
          <Badge variant="outline" className="text-xs h-[18px] font-medium">
            F1: {(data.metrics.f1_score * 100).toFixed(1)}%
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Legend and Filter */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSelectedStatus('all')}
              className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded-md transition-colors ${
                selectedStatus === 'all' ? 'bg-muted font-medium' : 'hover:bg-muted/50'
              }`}
            >
              <span className="w-3 h-0.5 bg-gray-500 rounded" />
              All
            </button>
            <button
              onClick={() => setSelectedStatus('tp')}
              className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded-md transition-colors ${
                selectedStatus === 'tp'
                  ? 'bg-green-100 dark:bg-green-900/30 font-medium'
                  : 'hover:bg-muted/50'
              }`}
            >
              <span className="w-3 h-0.5 rounded" style={{ backgroundColor: STATUS_COLORS.tp }} />
              Correct ({data.metrics.true_positives})
            </button>
            <button
              onClick={() => setSelectedStatus('fp')}
              className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded-md transition-colors ${
                selectedStatus === 'fp'
                  ? 'bg-red-100 dark:bg-red-900/30 font-medium'
                  : 'hover:bg-muted/50'
              }`}
            >
              <span className="w-3 h-0.5 rounded" style={{ backgroundColor: STATUS_COLORS.fp }} />
              Wrong ({data.metrics.false_positives})
            </button>
            <button
              onClick={() => setSelectedStatus('fn')}
              className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded-md transition-colors ${
                selectedStatus === 'fn'
                  ? 'bg-gray-100 dark:bg-gray-800 font-medium'
                  : 'hover:bg-muted/50'
              }`}
            >
              <span
                className="w-3 h-0.5 rounded border border-dashed"
                style={{ borderColor: STATUS_COLORS.fn }}
              />
              Missed ({data.metrics.false_negatives})
            </button>
          </div>
        </div>

        {/* Graph Container */}
        <div
          ref={containerRef}
          className="border rounded-lg overflow-hidden bg-slate-50 dark:bg-slate-900"
        >
          <ForceGraph2D
            graphData={graphData}
            width={dimensions.width}
            height={dimensions.height}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            nodeLabel={(node: any) => `${node.name}`}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            nodeColor={(node: any) => node.color}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            nodeVal={(node: any) => node.val}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            nodeCanvasObject={(node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
              const label =
                node.name?.length > 15 ? node.name.slice(0, 12) + '...' : node.name || '';
              const fontSize = Math.max(10, 12 / globalScale);
              ctx.font = `${fontSize}px Sans-Serif`;

              // Determine if this node is hovered
              const isHovered = hoveredNode === node.id;
              const nodeColor = isHovered ? '#3b82f6' : '#64748b';

              // Draw node circle
              const nodeSize = Math.sqrt(node.val || 1) * 4;
              ctx.beginPath();
              ctx.arc(node.x || 0, node.y || 0, nodeSize, 0, 2 * Math.PI);
              ctx.fillStyle = nodeColor;
              ctx.fill();

              // Draw highlight ring on hover
              if (isHovered) {
                ctx.beginPath();
                ctx.arc(node.x || 0, node.y || 0, nodeSize + 3, 0, 2 * Math.PI);
                ctx.strokeStyle = '#3b82f6';
                ctx.lineWidth = 2;
                ctx.stroke();
              }

              // Draw label below node
              if (globalScale > 0.5) {
                ctx.textAlign = 'center';
                ctx.textBaseline = 'top';
                ctx.fillStyle = nodeColor;
                ctx.fillText(label, node.x || 0, (node.y || 0) + nodeSize + 2);
              }
            }}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            linkColor={(link: any) => link.color}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            linkWidth={(link: any) => link.width}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            linkCurvature={(link: any) => link.curvature}
            linkDirectionalArrowLength={4}
            linkDirectionalArrowRelPos={1}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            linkLineDash={(link: any) => (link.status === 'fn' ? [4, 2] : null)}
            onNodeHover={handleNodeHover}
            cooldownTicks={100}
            d3AlphaDecay={0.02}
            d3VelocityDecay={0.3}
          />
        </div>

        {/* Interpretation Guide */}
        <div className="grid grid-cols-3 gap-2 text-xs">
          <div className="p-2 rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-900">
            <div className="font-semibold text-green-700 dark:text-green-400">
              {STATUS_LABELS.tp}
            </div>
            <div className="text-green-600 dark:text-green-500 leading-[1.5]">
              Correctly predicted relation
            </div>
          </div>
          <div className="p-2 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900">
            <div className="font-semibold text-red-700 dark:text-red-400">{STATUS_LABELS.fp}</div>
            <div className="text-red-600 dark:text-red-500 leading-[1.5]">
              Wrongly predicted (not in truth)
            </div>
          </div>
          <div className="p-2 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
            <div className="font-semibold text-gray-700 dark:text-gray-300">{STATUS_LABELS.fn}</div>
            <div className="text-gray-600 dark:text-gray-400 leading-[1.5]">
              Missed (should have found)
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
