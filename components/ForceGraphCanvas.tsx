'use client';
import React, { useEffect, useRef, useState, useImperativeHandle, forwardRef } from 'react';
import * as d3Force from 'd3-force';
import { ZoomIn, ZoomOut, Maximize2, Scissors, Activity, AlertTriangle } from 'lucide-react';
import { LiveInternetAlert } from '@/engine/ingestion/internetContext';

export interface CanvasHandle {
  exportHighResPng: () => void;
}

const ForceGraphCanvas = forwardRef<CanvasHandle, any>(function ForceGraphCanvas({
  graph,
  selectedFileId,
  selectedFileIds = [],
  blastReport,
  highlightDead,
  highlightCircular,
  activeCycleGroup = null,
  searchQuery,
  onSelectFile,
  onOpenCodeModal,
  isWireCutterMode,
  severedEdges = [],
  onCutEdge,
  internetAlerts = {},
}, ref) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const transformRef = useRef({ x: 0, y: 0, k: 0.6 });
  const isDraggingCanvasRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const draggedNodeRef = useRef<any>(null);

  const simNodesRef = useRef<any[]>([]);
  const simLinksRef = useRef<any[]>([]);
  const simulationRef = useRef<any>(null);
  const pulseOffsetRef = useRef(0);
  const heartbeatPhaseRef = useRef(0);
  const [hoveredNode, setHoveredNode] = useState<any>(null);

  const PALETTE = ['#38bdf8', '#818cf8', '#c084fc', '#f472b6', '#fb923c', '#4ade80', '#2dd4bf', '#facc15'];

  // Expose High-Res PNG Export directly to TopCommandBar
  useImperativeHandle(ref, () => ({
    exportHighResPng: () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const link = document.createElement('a');
      link.download = `gitblast-${graph?.repoName?.split('/').pop() || 'architecture'}.png`;
      link.href = canvas.toDataURL('image/png', 1.0);
      link.click();
    },
  }));

  useEffect(() => {
    if (!graph || !containerRef.current) return;
    const width = containerRef.current.clientWidth || 900;
    const height = containerRef.current.clientHeight || 650;
    transformRef.current = { x: width / 2, y: height / 2, k: 0.6 };

    const rawNodes = Object.values(graph.nodes);
    const nodeMap = new Map();
    const severedSet = new Set(severedEdges);

    const filteredNodes = rawNodes.filter((n: any) => {
      if (!highlightDead && n.isDeadCode) return false;
      return true;
    });

    const nodes = filteredNodes.map((n: any, idx: number) => {
      const topDir = n.directory ? n.directory.split('/')[0] : 'root';
      const cIdx = Math.abs(topDir.split('').reduce((acc: number, c: string) => acc + c.charCodeAt(0), 0)) % PALETTE.length;
      const angle = (idx / filteredNodes.length) * 2 * Math.PI;
      const radius = 130 + (1 - (n.pageRank || 0)) * 440;
      const safeName = n.name || (typeof n.id === 'string' ? n.id.split('/').pop() : '') || 'file';

      const nodeObj = {
        ...n,
        displayName: safeName,
        topDir,
        color: PALETTE[cIdx],
        x: Math.cos(angle) * radius,
        y: Math.sin(angle) * radius,
      };
      nodeMap.set(n.id, nodeObj);
      return nodeObj;
    });

    const links = graph.edges
      .filter((e: any) => !severedSet.has(e.id) && nodeMap.has(e.source) && nodeMap.has(e.target))
      .map((e: any) => ({
        id: e.id,
        source: nodeMap.get(e.source),
        target: nodeMap.get(e.target),
        isCircular: e.isCircular,
      }));

    simNodesRef.current = nodes;
    simLinksRef.current = links;

    if (simulationRef.current) simulationRef.current.stop();

    simulationRef.current = d3Force.forceSimulation(nodes)
      .force('link', d3Force.forceLink(links).id((d: any) => d.id).distance((l: any) => 70 + (1 - (l.target.pageRank || 0)) * 50).strength(0.35))
      .force('charge', d3Force.forceManyBody().strength(-280).distanceMax(1300))
      .force('collide', d3Force.forceCollide().radius((d: any) => 14 + (d.pageRank || 0) * 16).iterations(2))
      .force('center', d3Force.forceCenter(0, 0).strength(0.06))
      .alphaDecay(0.025);

    return () => {
      if (simulationRef.current) simulationRef.current.stop();
    };
  }, [graph, highlightDead, severedEdges]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let animId: number;

    const render = () => {
      if (containerRef.current) {
        const dpr = window.devicePixelRatio || 1;
        const w = containerRef.current.clientWidth;
        const h = containerRef.current.clientHeight;

        if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
          canvas.width = w * dpr;
          canvas.height = h * dpr;
        }

        ctx.save();
        ctx.scale(dpr, dpr);
        ctx.fillStyle = '#070b14';
        ctx.fillRect(0, 0, w, h);

        const { x: tx, y: ty, k } = transformRef.current;
        ctx.translate(tx, ty);
        ctx.scale(k, k);

        // Soft Biological Ambient Glow
        const bgGrad = ctx.createRadialGradient(0, 0, 40, 0, 0, 950);
        bgGrad.addColorStop(0, 'rgba(30, 58, 138, 0.22)');
        bgGrad.addColorStop(0.5, 'rgba(15, 23, 42, 0.15)');
        bgGrad.addColorStop(1, 'rgba(7, 11, 20, 0)');
        ctx.fillStyle = bgGrad;
        ctx.fillRect(-1800, -1800, 3600, 3600);

        // Grid Matrix
        ctx.fillStyle = 'rgba(71, 85, 105, 0.22)';
        for (let gx = -1800; gx <= 1800; gx += 85) {
          for (let gy = -1800; gy <= 1800; gy += 85) {
            ctx.beginPath();
            ctx.arc(gx, gy, 1 / k, 0, Math.PI * 2);
            ctx.fill();
          }
        }

        const impacted = blastReport?.impactedFileMap || {};
        const lowerSearch = (searchQuery || '').trim().toLowerCase();
        const activeList = selectedFileIds.length > 0 ? selectedFileIds : (selectedFileId ? [selectedFileId] : []);
        const activeSet = new Set(activeList);
        const hasSelection = activeSet.size > 0;

        pulseOffsetRef.current = (pulseOffsetRef.current + 0.012) % 1;
        heartbeatPhaseRef.current = (heartbeatPhaseRef.current + 0.05) % (Math.PI * 2);

        // 1. Synaptic Edges
        for (const l of simLinksRef.current) {
          if (!l.source.x || !l.target.x) continue;
          const isImpacted = hasSelection && (impacted[l.source.id] !== undefined && (activeSet.has(l.target.id) || impacted[l.target.id] !== undefined));

          ctx.beginPath();
          ctx.moveTo(l.source.x, l.source.y);
          ctx.lineTo(l.target.x, l.target.y);

          if (isImpacted) {
            ctx.strokeStyle = 'rgba(239, 68, 68, 0.85)';
            ctx.lineWidth = 2.2 / k;
            ctx.stroke();

            const px = l.source.x + (l.target.x - l.source.x) * pulseOffsetRef.current;
            const py = l.source.y + (l.target.y - l.source.y) * pulseOffsetRef.current;
            ctx.beginPath();
            ctx.arc(px, py, 2.8 / k, 0, Math.PI * 2);
            ctx.fillStyle = '#ffffff';
            ctx.fill();
          } else if (hasSelection) {
            ctx.strokeStyle = 'rgba(51, 65, 85, 0.12)';
            ctx.lineWidth = 0.6 / k;
            ctx.stroke();
          } else {
            ctx.strokeStyle = 'rgba(71, 85, 105, 0.35)';
            ctx.lineWidth = 0.9 / k;
            ctx.stroke();
          }
        }

        // 2. Neurons
        for (const n of simNodesRef.current) {
          if (n.x === undefined) continue;
          const radius = 6 + (n.pageRank || 0) * 16;
          const isSelected = activeSet.has(n.id);
          const isHovered = hoveredNode?.id === n.id;
          const wave = impacted[n.id];
          const isMatch = lowerSearch && n.id.toLowerCase().includes(lowerSearch);
          const liveAlert: LiveInternetAlert | undefined = internetAlerts[n.id];

          let fill = n.color || '#38bdf8';
          let glow = 'rgba(56, 189, 248, 0.35)';

          if (isSelected) {
            fill = '#ef4444';
            glow = 'rgba(239, 68, 68, 0.75)';
          } else if (liveAlert) {
            const pulseScale = 1 + Math.sin(heartbeatPhaseRef.current) * 0.35;
            fill = '#ec4899';
            glow = `rgba(236, 72, 153, ${0.4 * pulseScale})`;
          } else if (wave === 1) {
            fill = '#f97316';
            glow = 'rgba(249, 115, 22, 0.5)';
          } else if (wave > 1) {
            fill = '#fbbf24';
            glow = 'rgba(251, 191, 36, 0.4)';
          } else if (hasSelection) {
            fill = 'rgba(71, 85, 105, 0.35)';
            glow = 'transparent';
          }

          if (glow !== 'transparent' || isHovered || isMatch) {
            ctx.beginPath();
            ctx.arc(n.x, n.y, radius + (isSelected || liveAlert ? 7 : 4) / k, 0, Math.PI * 2);
            ctx.fillStyle = glow;
            ctx.fill();
          }

          ctx.beginPath();
          ctx.arc(n.x, n.y, radius, 0, Math.PI * 2);
          ctx.fillStyle = fill;
          ctx.fill();

          ctx.lineWidth = (isSelected || isHovered || liveAlert ? 2.5 : 1) / k;
          ctx.strokeStyle = isSelected || isHovered ? '#ffffff' : liveAlert ? '#f472b6' : '#070b14';
          ctx.stroke();

          const showLabel = isSelected || isHovered || isMatch || liveAlert || (k > 0.85 && ((n.pageRank || 0) > 0.6 || wave === 1)) || (k > 1.25);
          if (showLabel) {
            const label = n.displayName || 'file';
            const fontSize = Math.max(9, Math.min(13, Math.round(11 / Math.sqrt(k))));
            ctx.font = `${isSelected || isHovered || liveAlert ? 'bold ' : ''}${fontSize}px monospace`;

            const metrics = ctx.measureText(label);
            const textWidth = metrics.width;
            const textHeight = fontSize;
            const textX = n.x;
            const textY = n.y + radius + 11 / k;

            ctx.fillStyle = isSelected
              ? 'rgba(239, 68, 68, 0.9)'
              : liveAlert
              ? 'rgba(236, 72, 153, 0.9)'
              : isHovered
              ? 'rgba(15, 23, 42, 0.95)'
              : 'rgba(15, 23, 42, 0.82)';
            ctx.fillRect(textX - textWidth / 2 - 3 / k, textY - textHeight + 2 / k, textWidth + 6 / k, textHeight + 3 / k);

            ctx.fillStyle = isSelected || liveAlert ? '#ffffff' : isHovered ? '#38bdf8' : '#e2e8f0';
            ctx.textAlign = 'center';
            ctx.fillText(label, textX, textY);
          }
        }

        ctx.restore();
      }
      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [graph, selectedFileId, selectedFileIds, blastReport, hoveredNode, severedEdges, highlightDead, highlightCircular, activeCycleGroup, searchQuery, internetAlerts]);

  const screenToWorld = (clientX: number, clientY: number) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return {
      wx: (clientX - rect.left - transformRef.current.x) / transformRef.current.k,
      wy: (clientY - rect.top - transformRef.current.y) / transformRef.current.k,
    };
  };

  const getNearestEdge = (wx: number, wy: number) => {
    for (const l of simLinksRef.current) {
      if (!l.source.x || !l.target.x) continue;
      const x1 = l.source.x; const y1 = l.source.y;
      const x2 = l.target.x; const y2 = l.target.y;
      const dx = x2 - x1; const dy = y2 - y1;
      const lenSq = dx * dx + dy * dy;
      if (lenSq === 0) continue;
      let t = Math.max(0, Math.min(1, ((wx - x1) * dx + (wy - y1) * dy) / lenSq));
      const dist = Math.hypot(wx - (x1 + t * dx), wy - (y1 + t * dy));
      if (dist < 8) return l;
    }
    return null;
  };

  const getNodeAt = (wx: number, wy: number) => {
    for (let i = simNodesRef.current.length - 1; i >= 0; i--) {
      const n = simNodesRef.current[i];
      if (n.x === undefined) continue;
      const r = 14 + (n.pageRank || 0) * 16;
      if (Math.hypot(wx - n.x, wy - n.y) <= r) return n;
    }
    return null;
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const { wx, wy } = screenToWorld(e.clientX, e.clientY);

    if (isWireCutterMode) {
      const hitEdge = getNearestEdge(wx, wy);
      if (hitEdge) {
        onCutEdge(hitEdge.id);
        return;
      }
    }

    const hit = getNodeAt(wx, wy);
    if (hit) {
      draggedNodeRef.current = hit;
      hit.fx = hit.x;
      hit.fy = hit.y;
      onSelectFile(hit.id);
      if (simulationRef.current) simulationRef.current.alphaTarget(0.3).restart();
    } else {
      isDraggingCanvasRef.current = true;
      dragStartRef.current = {
        x: e.clientX - transformRef.current.x,
        y: e.clientY - transformRef.current.y,
      };
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const { wx, wy } = screenToWorld(e.clientX, e.clientY);

    if (draggedNodeRef.current) {
      draggedNodeRef.current.fx = wx;
      draggedNodeRef.current.fy = wy;
      return;
    }

    if (isDraggingCanvasRef.current) {
      transformRef.current.x = e.clientX - dragStartRef.current.x;
      transformRef.current.y = e.clientY - dragStartRef.current.y;
      return;
    }

    setHoveredNode(getNodeAt(wx, wy));
  };

  const handleMouseUp = () => {
    if (draggedNodeRef.current) {
      draggedNodeRef.current.fx = null;
      draggedNodeRef.current.fy = null;
      draggedNodeRef.current = null;
      if (simulationRef.current) simulationRef.current.alphaTarget(0);
    }
    isDraggingCanvasRef.current = false;
  };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.12 : 0.88;
    transformRef.current.k = Math.min(3.5, Math.max(0.12, transformRef.current.k * factor));
  };

  const handleDoubleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const { wx, wy } = screenToWorld(e.clientX, e.clientY);
    const hit = getNodeAt(wx, wy);
    if (hit) onOpenCodeModal(hit.id);
  };

  return (
    <div ref={containerRef} className="relative flex-1 h-full bg-[#070b14] overflow-hidden select-none font-mono">
      <canvas
        ref={canvasRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onWheel={handleWheel}
        onDoubleClick={handleDoubleClick}
        className={`w-full h-full block ${isWireCutterMode ? 'cursor-crosshair' : 'cursor-grab active:cursor-grabbing'}`}
      />

      <div className="absolute top-3 left-3 flex items-center gap-2 bg-slate-900/90 border border-slate-800 rounded-xl px-3 py-1.5 text-[10px] text-slate-300 pointer-events-none">
        <Activity className="w-3.5 h-3.5 text-sky-400" />
        <span>Autonomous Neural Mesh • Live Telemetry Synced</span>
      </div>

      {hoveredNode && (
        <div className="absolute bottom-14 left-3 bg-slate-900/95 border border-slate-700/80 rounded-xl p-3 shadow-xl text-xs pointer-events-none max-w-sm">
          <div className="text-white font-bold truncate">{hoveredNode.id}</div>
          <div className="text-[10px] text-sky-400 mb-1">Folder: {hoveredNode.topDir}/</div>
          
          {internetAlerts[hoveredNode.id] && (
            <div className="my-1.5 p-2 rounded-lg bg-pink-950/40 border border-pink-500/50 text-pink-300 text-[10px]">
              <div className="font-bold flex items-center gap-1 text-pink-400">
                <AlertTriangle className="w-3 h-3" /> Live GitHub Issue #{internetAlerts[hoveredNode.id].issueNumber}
              </div>
              <div className="truncate mt-0.5">{internetAlerts[hoveredNode.id].issueTitle}</div>
            </div>
          )}

          <div className="flex gap-3 text-[11px] text-slate-400 mt-1">
            <span>LOC: <strong className="text-slate-200">{hoveredNode.loc}</strong></span>
            <span>Dependents: <strong className="text-red-400">{hoveredNode.inDegree}</strong></span>
            <span>PageRank: <strong className="text-sky-400">{(hoveredNode.pageRank * 100).toFixed(0)}%</strong></span>
          </div>
        </div>
      )}

      <div className="absolute bottom-3 right-3 flex items-center gap-1.5 bg-slate-900/90 border border-slate-800 p-1.5 rounded-xl">
        <button type="button" onClick={() => transformRef.current.k = Math.min(3.5, transformRef.current.k * 1.2)} className="p-1.5 hover:bg-slate-800 text-slate-300 rounded-lg transition" title="Zoom In">
          <ZoomIn className="w-4 h-4" />
        </button>
        <button type="button" onClick={() => transformRef.current.k = Math.max(0.12, transformRef.current.k * 0.8)} className="p-1.5 hover:bg-slate-800 text-slate-300 rounded-lg transition" title="Zoom Out">
          <ZoomOut className="w-4 h-4" />
        </button>
        <button type="button" onClick={() => {
          if (!containerRef.current) return;
          transformRef.current = { x: containerRef.current.clientWidth / 2, y: containerRef.current.clientHeight / 2, k: 0.6 };
        }} className="p-1.5 hover:bg-slate-800 text-slate-300 rounded-lg transition" title="Recenter">
          <Maximize2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
});

export default ForceGraphCanvas;
