'use client';

import { Info, RotateCcw, Settings2, ZoomIn, ZoomOut } from 'lucide-react';
import dynamic from 'next/dynamic';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Slider } from '@/components/ui/slider';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

// Dynamic import to avoid SSR issues with canvas
const ForceGraph2D = dynamic(() => import('react-force-graph-2d'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full">
      <span className="text-muted-foreground text-sm">Loading graph...</span>
    </div>
  ),
});

interface GroundTruthRelation {
  id: number;
  from_id: string;
  to_id: string;
  relation_type: string;
  confidence: number;
  source: string;
  metadata: Record<string, unknown>;
  from_title: string;
  from_platform: string;
  from_type: string;
  to_title: string;
  to_platform: string;
  to_type: string;
}

interface GTObject {
  id: string;
  title: string;
  platform: string;
  object_type: string;
}

interface TypeSummary {
  relation_type: string;
  source: string;
  count: number;
  avg_confidence: number;
}

interface GTGraphViewProps {
  relations: GroundTruthRelation[];
  objects: GTObject[];
  summary: {
    totalRelations: number;
    totalObjects: number;
    byType: TypeSummary[];
  };
}

interface GraphNode {
  id: string;
  name: string;
  platform: string;
  objectType: string;
  val: number;
  color: string;
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
  fx?: number;
  fy?: number;
}

interface GraphLink {
  source: string | GraphNode;
  target: string | GraphNode;
  relationType: string;
  confidence: number;
  sourceType: string;
  color: string;
  width: number;
  curvature: number;
}

// Platform colors
const platformColors: Record<string, string> = {
  linear: '#8B5CF6', // purple
  zendesk: '#10B981', // green
  github: '#6B7280', // gray
  slack: '#EC4899', // pink
};

// Relation type colors
const relationColors: Record<string, string> = {
  belongs_to: '#3B82F6', // blue
  mentions: '#F59E0B', // amber
  similar_to: '#10B981', // green (should not appear in GT)
  parent_of: '#8B5CF6', // purple
};

export default function GTGraphView({ relations, objects, summary: _summary }: GTGraphViewProps) {
  const graphRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [linkDistance, setLinkDistance] = useState(100);
  const [chargeStrength, setChargeStrength] = useState(-200);

  // Update dimensions on resize
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setDimensions({
          width: rect.width,
          height: rect.height - 60, // Account for header
        });
      }
    };

    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  // Transform data for force graph
  const graphData = useMemo(() => {
    const nodes: GraphNode[] = objects.map((obj) => ({
      id: obj.id,
      name: obj.title || obj.id.slice(0, 20),
      platform: obj.platform,
      objectType: obj.object_type,
      val: 10,
      color: platformColors[obj.platform] || '#6B7280',
    }));

    const links: GraphLink[] = relations.map((rel, idx) => ({
      source: rel.from_id,
      target: rel.to_id,
      relationType: rel.relation_type,
      confidence: rel.confidence,
      sourceType: rel.source,
      color: relationColors[rel.relation_type] || '#9CA3AF',
      width: Math.max(1, rel.confidence * 3),
      curvature: idx % 2 === 0 ? 0.2 : -0.2, // Alternate curvature for parallel edges
    }));

    return { nodes, links };
  }, [objects, relations]);

  // Handle node click
  const handleNodeClick = useCallback((node: GraphNode) => {
    setSelectedNode(node);
    // Center on node
    if (graphRef.current) {
      graphRef.current.centerAt(node.x, node.y, 1000);
      graphRef.current.zoom(2, 1000);
    }
  }, []);

  // Custom node rendering
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const nodeCanvasObject = useCallback(
    (node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
      const label = node.name?.length > 15 ? node.name.slice(0, 15) + '...' : node.name || '';
      const fontSize = 12 / globalScale;
      const nodeR = 8;

      // Draw node circle
      ctx.beginPath();
      ctx.arc(node.x || 0, node.y || 0, nodeR, 0, 2 * Math.PI);
      ctx.fillStyle = node.color || '#6B7280';
      ctx.fill();

      // Draw border if selected
      if (selectedNode?.id === node.id) {
        ctx.strokeStyle = '#FBBF24';
        ctx.lineWidth = 3 / globalScale;
        ctx.stroke();
      }

      // Draw label
      ctx.font = `${fontSize}px Sans-Serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillStyle = '#374151';
      ctx.fillText(label, node.x || 0, (node.y || 0) + nodeR + 2);
    },
    [selectedNode]
  );

  // Zoom controls
  const handleZoomIn = () => {
    if (graphRef.current) {
      const currentZoom = graphRef.current.zoom();
      graphRef.current.zoom(currentZoom * 1.5, 400);
    }
  };

  const handleZoomOut = () => {
    if (graphRef.current) {
      const currentZoom = graphRef.current.zoom();
      graphRef.current.zoom(currentZoom / 1.5, 400);
    }
  };

  const handleReset = () => {
    if (graphRef.current) {
      graphRef.current.zoomToFit(400);
    }
    setSelectedNode(null);
  };

  // Get connections for selected node
  const nodeConnections = useMemo(() => {
    if (!selectedNode) return [];
    return relations.filter((r) => r.from_id === selectedNode.id || r.to_id === selectedNode.id);
  }, [selectedNode, relations]);

  return (
    <div className="flex flex-col gap-4 h-full">
      {/* Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                  <Info className="h-4 w-4" />
                  <span>Ground Truth Only</span>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>Shows only structural/explicit relations</p>
                <p className="text-xs text-muted-foreground">(parent-child, explicit mentions)</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        <div className="flex items-center gap-2">
          {/* Legend */}
          <div className="flex items-center gap-3 mr-4">
            {Object.entries(relationColors).map(([type, color]) => (
              <div key={type} className="flex items-center gap-1">
                <div className="w-3 h-0.5" style={{ backgroundColor: color }} />
                <span className="text-xs text-muted-foreground">{type}</span>
              </div>
            ))}
          </div>

          {/* Settings Popover */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm">
                <Settings2 className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80">
              <div className="grid gap-4">
                <div className="space-y-2">
                  <h4 className="font-medium leading-none">Graph Settings</h4>
                  <p className="text-sm text-muted-foreground">
                    Adjust the force simulation parameters
                  </p>
                </div>
                <div className="grid gap-4">
                  <div className="grid gap-2">
                    <Label>Link Distance: {linkDistance}</Label>
                    <Slider
                      value={[linkDistance]}
                      onValueChange={([v]) => setLinkDistance(v)}
                      min={30}
                      max={300}
                      step={10}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>Repulsion: {Math.abs(chargeStrength)}</Label>
                    <Slider
                      value={[Math.abs(chargeStrength)]}
                      onValueChange={([v]) => setChargeStrength(-v)}
                      min={50}
                      max={500}
                      step={10}
                    />
                  </div>
                </div>
              </div>
            </PopoverContent>
          </Popover>

          {/* Zoom Controls */}
          <div className="flex items-center border rounded-md">
            <Button variant="ghost" size="sm" onClick={handleZoomOut}>
              <ZoomOut className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={handleZoomIn}>
              <ZoomIn className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={handleReset}>
              <RotateCcw className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex gap-4 flex-1 min-h-0">
        {/* Graph */}
        <Card className="flex-1" ref={containerRef}>
          <CardContent className="p-0 h-full">
            <ForceGraph2D
              ref={graphRef}
              graphData={graphData}
              width={dimensions.width}
              height={dimensions.height}
              nodeCanvasObject={nodeCanvasObject}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              nodePointerAreaPaint={(node: any, color: string, ctx: CanvasRenderingContext2D) => {
                ctx.fillStyle = color;
                ctx.beginPath();
                ctx.arc(node.x || 0, node.y || 0, 10, 0, 2 * Math.PI);
                ctx.fill();
              }}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              linkColor={(link: any) => link.color || '#9CA3AF'}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              linkWidth={(link: any) => link.width || 1}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              linkCurvature={(link: any) => link.curvature || 0}
              linkDirectionalArrowLength={6}
              linkDirectionalArrowRelPos={1}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              onNodeClick={(node: any) => handleNodeClick(node as GraphNode)}
              d3VelocityDecay={0.3}
              d3AlphaDecay={0.02}
              cooldownTicks={100}
              onEngineStop={() => {
                if (graphRef.current) {
                  graphRef.current.zoomToFit(400, 50);
                }
              }}
            />
          </CardContent>
        </Card>

        {/* Node Detail Panel */}
        {selectedNode && (
          <Card className="w-80 shrink-0">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg truncate">{selectedNode.name}</CardTitle>
              <CardDescription className="flex items-center gap-2">
                <Badge
                  variant="outline"
                  style={{
                    backgroundColor: `${selectedNode.color}20`,
                    borderColor: selectedNode.color,
                    color: selectedNode.color,
                  }}
                >
                  {selectedNode.platform}
                </Badge>
                <span className="text-xs">{selectedNode.objectType}</span>
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <h4 className="text-sm font-medium mb-2">
                    Connections ({nodeConnections.length})
                  </h4>
                  <div className="space-y-2 max-h-[300px] overflow-auto">
                    {nodeConnections.map((rel) => {
                      const isSource = rel.from_id === selectedNode.id;
                      const otherTitle = isSource ? rel.to_title : rel.from_title;
                      const direction = isSource ? '->' : '<-';

                      return (
                        <div key={rel.id} className="p-2 rounded border bg-muted/50 text-xs">
                          <div className="flex items-center gap-1">
                            <span className="text-muted-foreground">{direction}</span>
                            <span className="truncate font-medium">{otherTitle || 'Unknown'}</span>
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge
                              variant="outline"
                              className="text-[10px]"
                              style={{
                                borderColor: relationColors[rel.relation_type] || '#9CA3AF',
                              }}
                            >
                              {rel.relation_type}
                            </Badge>
                            <span className="text-muted-foreground">
                              {(rel.confidence * 100).toFixed(0)}%
                            </span>
                          </div>
                        </div>
                      );
                    })}
                    {nodeConnections.length === 0 && (
                      <p className="text-muted-foreground text-xs">No connections</p>
                    )}
                  </div>
                </div>

                <div>
                  <h4 className="text-sm font-medium mb-1">Object ID</h4>
                  <code className="text-xs text-muted-foreground break-all">{selectedNode.id}</code>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Platform Legend */}
      <div className="flex items-center justify-center gap-4">
        {Object.entries(platformColors).map(([platform, color]) => (
          <div key={platform} className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
            <span className="text-xs text-muted-foreground">{platform}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
