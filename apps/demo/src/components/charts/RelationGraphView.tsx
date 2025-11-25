'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

// Dynamic import to avoid SSR issues with canvas
const ForceGraph2D = dynamic(() => import('react-force-graph-2d'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full">
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

interface ExperimentOption {
  id: number;
  name: string;
}

interface RelationGraphViewProps {
  experimentConfig?: {
    useSemanticSimilarity?: boolean;
    similarityThreshold?: number;
    keywordOverlapThreshold?: number;
    semanticWeight?: number;
  };
  experiments?: ExperimentOption[];
  selectedExperimentId?: number;
  onExperimentChange?: (experimentId: number | undefined) => void;
  className?: string;
}

const STATUS_COLORS = {
  tp: '#22c55e', // green-500 - True Positive (correct)
  fp: '#ef4444', // red-500 - False Positive (wrong prediction)
  fn: '#9ca3af', // gray-400 - False Negative (missed)
};

export default function RelationGraphView({
  experimentConfig,
  experiments,
  selectedExperimentId,
  onExperimentChange,
  className,
}: RelationGraphViewProps) {
  const [data, setData] = useState<RelationsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<'all' | 'tp' | 'fp' | 'fn'>('all');
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const graphRef = useRef<any>(null);
  const [dimensions, setDimensions] = useState({ width: 600, height: 500 });

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

  // Handle container resize - now uses full container height
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        // Only update if we have valid dimensions
        if (rect.width > 0 && rect.height > 0) {
          setDimensions({
            width: Math.max(0, rect.width - 4),
            height: Math.max(300, rect.height - 4),
          });
        }
      }
    };

    // Delay initial calculation to ensure layout is complete
    // Using double RAF to ensure paint has occurred
    requestAnimationFrame(() => {
      requestAnimationFrame(updateDimensions);
    });

    window.addEventListener('resize', updateDimensions);

    // Use ResizeObserver for more accurate container size tracking
    const resizeObserver = new ResizeObserver(updateDimensions);
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    return () => {
      window.removeEventListener('resize', updateDimensions);
      resizeObserver.disconnect();
    };
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

    // Create nodes
    const nodes: GraphNode[] = Array.from(nodeIds).map((id) => ({
      id,
      name: paperMap.get(id) || id.slice(0, 8),
      val: Math.max(1, connectionCount.get(id) || 1),
      color: '#64748b',
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
  }, [data, selectedStatus]);

  // Configure d3 forces after graph mounts for better centering
  useEffect(() => {
    if (!graphRef.current) return;
    const fg = graphRef.current;

    fg.d3Force('center')
      ?.x(dimensions.width / 2)
      .y(dimensions.height / 2);
    fg.d3Force('charge')?.strength(-120);
  }, [dimensions, graphData]);

  // Clamp node positions within bounds on each tick
  const handleEngineTick = useCallback(() => {
    if (!graphRef.current) return;
    const padding = 60;
    const w = dimensions.width;
    const h = dimensions.height;
    const graphDataFn = graphRef.current.graphData;
    if (!graphDataFn) return;
    const currentData = graphDataFn();
    if (!currentData?.nodes) return;

    currentData.nodes.forEach((node: GraphNode) => {
      if (node.x !== undefined) {
        node.x = Math.max(padding, Math.min(w - padding, node.x));
      }
      if (node.y !== undefined) {
        node.y = Math.max(padding, Math.min(h - padding, node.y));
      }
    });
  }, [dimensions]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleNodeHover = useCallback((node: any) => {
    setHoveredNode(node?.id || null);
  }, []);

  if (loading) {
    return (
      <div className={`relative rounded-lg border bg-slate-50 dark:bg-slate-900 ${className}`}>
        <div className="flex items-center justify-center h-full min-h-[400px]">
          <span className="text-muted-foreground text-sm">Loading graph...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`relative rounded-lg border bg-slate-50 dark:bg-slate-900 ${className}`}>
        <div className="flex items-center justify-center h-full min-h-[400px]">
          <span className="text-red-500 text-sm">Error: {error}</span>
        </div>
      </div>
    );
  }

  if (!data || data.relations.length === 0) {
    return (
      <div className={`relative rounded-lg border bg-slate-50 dark:bg-slate-900 ${className}`}>
        <div className="flex items-center justify-center h-full min-h-[400px]">
          <span className="text-muted-foreground text-sm">No relations found</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`relative rounded-lg border bg-slate-50 dark:bg-slate-900 ${className}`}>
      {/* Graph Canvas */}
      <div ref={containerRef} className="w-full h-full">
        <ForceGraph2D
          ref={graphRef}
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
            const label = node.name?.length > 15 ? node.name.slice(0, 12) + '...' : node.name || '';
            const fontSize = Math.max(10, 12 / globalScale);
            ctx.font = `${fontSize}px Sans-Serif`;

            const isHovered = hoveredNode === node.id;
            const nodeColor = isHovered ? '#3b82f6' : '#64748b';

            const nodeSize = Math.sqrt(node.val || 1) * 4;
            ctx.beginPath();
            ctx.arc(node.x || 0, node.y || 0, nodeSize, 0, 2 * Math.PI);
            ctx.fillStyle = nodeColor;
            ctx.fill();

            if (isHovered) {
              ctx.beginPath();
              ctx.arc(node.x || 0, node.y || 0, nodeSize + 3, 0, 2 * Math.PI);
              ctx.strokeStyle = '#3b82f6';
              ctx.lineWidth = 2;
              ctx.stroke();
            }

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
          onEngineTick={handleEngineTick}
          cooldownTicks={100}
          d3AlphaDecay={0.02}
          d3VelocityDecay={0.3}
        />
      </div>

      {/* Floating Dock - Top Left: Experiment Selector */}
      <div className="absolute top-3 left-3">
        {experiments && experiments.length > 0 ? (
          <Select
            value={selectedExperimentId?.toString() || 'none'}
            onValueChange={(value) =>
              onExperimentChange?.(value === 'none' ? undefined : parseInt(value))
            }
          >
            <SelectTrigger className="w-[200px] bg-background/90 backdrop-blur-sm shadow-sm border h-[32px] text-xs">
              <SelectValue placeholder="Select experiment" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none" className="text-xs">
                All Experiments
              </SelectItem>
              {experiments.map((exp) => (
                <SelectItem key={exp.id} value={exp.id.toString()} className="text-xs">
                  {exp.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <div className="bg-background/90 backdrop-blur-sm rounded-lg px-3 py-1.5 shadow-sm border">
            <span className="text-sm font-medium text-muted-foreground">No experiments</span>
          </div>
        )}
      </div>

      {/* Floating Dock - Bottom Center: Filter Controls */}
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2">
        <div className="bg-background/95 backdrop-blur-sm rounded-lg px-2 py-1.5 shadow-md border flex items-center gap-1">
          <button
            onClick={() => setSelectedStatus('all')}
            className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-md transition-colors ${
              selectedStatus === 'all' ? 'bg-muted font-medium' : 'hover:bg-muted/50'
            }`}
          >
            <span className="w-3 h-0.5 bg-gray-500 rounded" />
            All
          </button>
          <button
            onClick={() => setSelectedStatus('tp')}
            className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-md transition-colors ${
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
            className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-md transition-colors ${
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
            className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-md transition-colors ${
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

      {/* Floating Dock - Top Right: Metrics Summary (F1, Precision, Recall) */}
      <div className="absolute top-3 right-3">
        <div className="bg-background/90 backdrop-blur-sm rounded-lg px-3 py-2 shadow-sm border">
          <div className="flex items-center gap-4 text-xs">
            <div className="text-center">
              <div className="text-muted-foreground">F1</div>
              <div className="font-semibold text-blue-600">
                {(data.metrics.f1_score * 100).toFixed(1)}%
              </div>
            </div>
            <div className="w-px h-6 bg-border" />
            <div className="text-center">
              <div className="text-muted-foreground">Precision</div>
              <div className="font-semibold">{(data.metrics.precision * 100).toFixed(1)}%</div>
            </div>
            <div className="w-px h-6 bg-border" />
            <div className="text-center">
              <div className="text-muted-foreground">Recall</div>
              <div className="font-semibold">{(data.metrics.recall * 100).toFixed(1)}%</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
