'use client';

import React, { useEffect, useRef, useState, useImperativeHandle, forwardRef } from 'react';
import * as d3Force from 'd3-force';
import { ZoomIn, ZoomOut, Maximize2, ArrowLeft } from 'lucide-react';
import { LiveInternetAlert } from '@/engine/ingestion/internetContext';

export interface CanvasHandle {
  exportHighResPng: () => void;
}

interface ForceGraphCanvasProps {
  graph: any;
  selectedFileId: string | null;
  selectedFileIds?: string[];
  blastReport: any;
  highlightDead: boolean;
  highlightCircular: boolean;
  activeCycleGroup?: string[] | null;
  searchQuery?: string;
  onSelectFile: (fileId: string) => void;
  onOpenCodeModal: (fileId: string) => void;
  isWireCutterMode: boolean;
  severedEdges?: string[];
  onCutEdge: (edgeId: string) => void;
  internetAlerts?: Record<string, LiveInternetAlert>;
}

const ForceGraphCanvas = forwardRef<CanvasHandle, ForceGraphCanvasProps>(function ForceGraphCanvas(
  {
    graph,
    selectedFileId,
    selectedFileIds = [],
    blastReport,
    highlightDead,
    searchQuery = '',
    onSelectFile,
    onOpenCodeModal,
    internetAlerts = {},
  },
  ref
) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const transformRef = useRef({ x: 0, y: 0, k: 0.85 });
  const isDraggingCanvasRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const draggedNodeRef = useRef<any>(null);

  const [activeFolder, setActiveFolder] = useState<string | null>(null);
  const [hoveredNode, setHoveredNode] = useState<any>(null);

  const simNodesRef = useRef<any[]>([]);
  const simLinksRef = useRef<any[]>([]);
  const simulationRef = useRef<any>(null);

  const thinkingRotationRef = useRef(0);
  const reactorPulseRef = useRef(0);
  const energyBulletRef = useRef(0);

  useImperativeHandle(ref, () => ({
    exportHighResPng: () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const link = document.createElement('a');
      link.download = `gitblast-jarvis-core-${graph?.repoName?.split('/').pop() || 'reactor'}.png`;
      link.href = canvas.toDataURL('image/png', 1.0);
      link.click();
    },
  }));

  useEffect(() => {
    const handleRelease = () => {
      if (draggedNodeRef.current) {
        draggedNodeRef.current.fx = null;
        draggedNodeRef.current.fy = null;
        draggedNodeRef.current = null;
        if (simulationRef.current) simulationRef.current.alphaTarget(0);
      }
      isDraggingCanvasRef.current = false;
    };
    window.addEventListener('pointerup', handleRelease);
    window.addEventListener('pointercancel', handleRelease);
    return () => {
      window.removeEventListener('pointerup', handleRelease);
      window.removeEventListener('pointercancel', handleRelease);
    };
  }, []);

  // Compute Jarvis Holographic Arc Geometry
  useEffect(() => {
    if (!graph || !containerRef.current) return;
    const width = containerRef.current.clientWidth || 900;
    const height = containerRef.current.clientHeight || 650;
    transformRef.current = { x: width / 2, y: height / 2, k: 0.9 };

    const rawNodes = Object.values(graph.nodes);
    // Filter noise files completely
    const filteredNodes = rawNodes.filter((n: any) => {
      const p = n.id.toLowerCase();
      const blockedExts = ['.lock', '.json', '.md', '.txt', '.yml', '.yaml', '.svg', '.png', '.jpg', '.ico'];
      if (blockedExts.some(ext => p.endsWith(ext))) return false;
      if (p.includes('.github/') || p.includes('.vscode/') || p.includes('dist/') || p.includes('build/')) return false;
      if (!highlightDead && n.isDeadCode) return false;
      return true;
    });

    // Group files by module packages
    const folderGroups: Record<string, any[]> = {};
    filteredNodes.forEach((node: any) => {
      const dir = node.directory && node.directory !== 'root' ? node.directory.split('/')[0] : 'core';
      if (!folderGroups[dir]) folderGroups[dir] = [];
      folderGroups[dir].push(node);
    });

    const folderKeys = Object.keys(folderGroups);
    const displayNodes: any[] = [];
    const displayLinks: any[] = [];

    // VIEW 1: JARVIS GLOBAL ARC REACTOR (Golden Folder Rings)
    if (!activeFolder) {
      folderKeys.forEach((fKey, idx) => {
        const angle = (idx / Math.max(1, folderKeys.length)) * 2 * Math.PI;
        const ringRadius = 150 + (idx % 2 === 0 ? 30 : -20);
        const filesInFolder = folderGroups[fKey];
        const totalLoc = filesInFolder.reduce((acc, f) => acc + (f.loc || 0), 0);

        displayNodes.push({
          id: `folder:${fKey}`,
          name: `${fKey}/`,
          isFolder: true,
          folderKey: fKey,
          fileCount: filesInFolder.length,
          loc: totalLoc,
          radius: Math.max(22, Math.min(42, 18 + filesInFolder.length * 1.8)),
          x: Math.cos(angle) * ringRadius,
          y: Math.sin(angle) * ringRadius,
        });
      });

      // Holographic Energy Bus Lines connecting folders
      for (let i = 0; i < displayNodes.length; i++) {
        const next = (i + 1) % displayNodes.length;
        displayLinks.push({
          id: `reactor-ring:${i}-${next}`,
          source: displayNodes[i],
          target: displayNodes[next],
          isRing: true,
        });
      }
    } 
    // VIEW 2: DEEP DIVE INTO ACTIVE FOLDER (Real Inter-File Wiring & Synapses)
    else {
      const files = folderGroups[activeFolder] || [];
      const nodeMap = new Map<string, any>();
      const maxPageRank = Math.max(...(Object.values(graph.nodes) as Array<{ pageRank?: number }>).map((node) => node.pageRank || 0), 0.000001);

      // Center Reactor Core of this Folder
      const centerCore = {
        id: `folder:${activeFolder}`,
        name: `${activeFolder}/ (Core)`,
        isFolder: true,
        isCenterHub: true,
        folderKey: activeFolder,
        radius: 34,
        x: 0,
        y: 0,
        fx: 0,
        fy: 0,
      };
      displayNodes.push(centerCore);
      nodeMap.set(centerCore.id, centerCore);

      files.forEach((fileNode, idx) => {
        const angle = (idx / Math.max(1, files.length)) * 2 * Math.PI;
        const relativeRank = (fileNode.pageRank || 0) / maxPageRank;
        const orbitDist = 130 + (1 - relativeRank) * 130;
        const safeName = fileNode.name || fileNode.id.split('/').pop() || 'mod';

        const childNode = {
          ...fileNode,
          displayName: safeName,
          isFolder: false,
          radius: Math.max(7, Math.min(18, 7 + relativeRank * 11)),
          x: Math.cos(angle) * orbitDist,
          y: Math.sin(angle) * orbitDist,
        };
        displayNodes.push(childNode);
        nodeMap.set(fileNode.id, childNode);

        // Core Tether Spoke
        displayLinks.push({
          id: `spoke:${fileNode.id}`,
          source: centerCore,
          target: childNode,
          isSpoke: true,
        });
      });

      // REAL FILE-TO-FILE CONNECTIONS: Which file imports which inside this folder!
      graph.edges.forEach((edge: any) => {
        if (nodeMap.has(edge.source) && nodeMap.has(edge.target)) {
          displayLinks.push({
            id: edge.id,
            source: nodeMap.get(edge.source),
            target: nodeMap.get(edge.target),
            isRealImportEdge: true,
          });
        }
      });
    }

    simNodesRef.current = displayNodes;
    simLinksRef.current = displayLinks;

    if (simulationRef.current) simulationRef.current.stop();

    simulationRef.current = d3Force.forceSimulation(displayNodes)
      .force('link', d3Force.forceLink(displayLinks).id((d: any) => d.id).distance((l: any) => (l.isSpoke ? 120 : 85)).strength(0.35))
      .force('charge', d3Force.forceManyBody().strength((d: any) => (d.isFolder ? -550 : -200)).distanceMax(850))
      .force('collide', d3Force.forceCollide().radius((d: any) => d.radius + 18).iterations(3))
      .force('center', d3Force.forceCenter(0, 0).strength(0.06))
      .alphaDecay(0.025);

    return () => {
      if (simulationRef.current) simulationRef.current.stop();
    };
  }, [graph, activeFolder, highlightDead]);

  // 60FPS Golden-Amber Tony Stark JARVIS Hologram Renderer
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let animId: number;

    const render = () => {
      if (!containerRef.current) return;
      const dpr = window.devicePixelRatio || 1;
      const w = containerRef.current.clientWidth;
      const h = containerRef.current.clientHeight;

      if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
        canvas.width = w * dpr;
        canvas.height = h * dpr;
      }

      ctx.save();
      ctx.scale(dpr, dpr);

      // Deep Black Arc-Reactor Chamber Background
      ctx.fillStyle = '#030712';
      ctx.fillRect(0, 0, w, h);

      const { x: tx, y: ty, k } = transformRef.current;
      ctx.translate(tx, ty);
      ctx.scale(k, k);

      thinkingRotationRef.current = (thinkingRotationRef.current + 0.004) % (Math.PI * 2);
      reactorPulseRef.current = (reactorPulseRef.current + 0.04) % (Math.PI * 2);
      energyBulletRef.current = (energyBulletRef.current + 0.016) % 1;

      // 1. Central Golden Arc-Reactor Core Ambient Glow (Like Photo)
      const pulseScale = (Math.sin(reactorPulseRef.current) + 1) / 2;
      const coreGrad = ctx.createRadialGradient(0, 0, 20, 0, 0, 750);
      coreGrad.addColorStop(0, `rgba(245, 158, 11, ${0.28 + pulseScale * 0.15})`);
      coreGrad.addColorStop(0.35, 'rgba(14, 165, 233, 0.06)');
      coreGrad.addColorStop(0.7, 'rgba(3, 7, 18, 0)');
      coreGrad.addColorStop(1, 'rgba(2, 3, 7, 0)');
      ctx.fillStyle = coreGrad;
      ctx.fillRect(-1200, -1200, 2400, 2400);

      // 2. Rotating Holographic Thinking Rings (Like Photo)
      ctx.save();
      ctx.rotate(thinkingRotationRef.current);

      [80, 160, 260, 380].forEach((ringR, rIdx) => {
        ctx.beginPath();
        ctx.arc(0, 0, ringR, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(245, 158, 11, ${rIdx === 1 ? 0.35 : 0.14})`;
        ctx.lineWidth = (rIdx === 1 ? 1.6 : 0.8) / k;
        ctx.setLineDash(rIdx % 2 === 0 ? [8, 12] : []);
        ctx.stroke();
      });
      ctx.setLineDash([]);
      ctx.restore();

      const impacted = blastReport?.impactedFileMap || {};
      const activeList = selectedFileIds.length > 0 ? selectedFileIds : selectedFileId ? [selectedFileId] : [];
      const activeSet = new Set(activeList);
      const hasSelection = activeSet.size > 0;

      // 3. Synaptic Energy Connections (Golden Beams & Shockwaves)
      for (const link of simLinksRef.current) {
        if (!link.source.x || !link.target.x) continue;

        const isImpacted =
          hasSelection &&
          impacted[link.source.id] !== undefined &&
          (activeSet.has(link.target.id) || impacted[link.target.id] !== undefined);

        const isConnectedToFile = activeSet.has(link.source.id) || activeSet.has(link.target.id);

        ctx.beginPath();
        ctx.moveTo(link.source.x, link.source.y);
        ctx.lineTo(link.target.x, link.target.y);

        if (isImpacted) {
          // Shockwave Laser
          ctx.strokeStyle = '#ec4899';
          ctx.lineWidth = 2.4 / k;
          ctx.stroke();
        } else if (link.isRealImportEdge || isConnectedToFile) {
          // Real Code Imports: Blazing Golden Laser
          ctx.strokeStyle = '#38bdf8';
          ctx.lineWidth = 1.8 / k;
          ctx.stroke();

          // Action Potential Photon Particle Bullet
          const px = link.source.x + (link.target.x - link.source.x) * energyBulletRef.current;
          const py = link.source.y + (link.target.y - link.source.y) * energyBulletRef.current;
          ctx.beginPath();
          ctx.arc(px, py, 3.2 / k, 0, Math.PI * 2);
          ctx.fillStyle = '#ffffff';
          ctx.shadowColor = '#38bdf8';
          ctx.shadowBlur = 8;
          ctx.fill();
          ctx.shadowBlur = 0;
        } else {
          ctx.strokeStyle = 'rgba(56, 189, 248, 0.12)';
          ctx.lineWidth = 0.8 / k;
          ctx.stroke();
        }
      }

      // 4. Neurons / Arc Reactor Cores (Amber Holographic Nodes)
      for (const node of simNodesRef.current) {
        if (node.x === undefined) continue;
        const radius = node.radius;
        const isSelected = activeSet.has(node.id);
        const isHovered = hoveredNode?.id === node.id;
        const wave = impacted[node.id];
        const liveAlert: LiveInternetAlert | undefined = internetAlerts[node.id];

        let amberFill = '#38bdf8';
        let glowColor = 'rgba(56, 189, 248, 0.12)';

        if (node.isFolder) {
          // Folder Lobe: Pulsing Golden Arc Reactor Core
          amberFill = node.isCenterHub ? '#38bdf8' : '#0284c7';
          glowColor = `rgba(245, 158, 11, ${0.45 + pulseScale * 0.4})`;
        } else if (isSelected) {
          amberFill = '#f43f5e';
          glowColor = 'rgba(244, 63, 94, 0.9)';
        } else if (liveAlert) {
          amberFill = '#ec4899';
          glowColor = 'rgba(236, 72, 153, 0.8)';
        } else if (wave === 1) {
          amberFill = '#fb923c';
          glowColor = 'rgba(251, 146, 60, 0.7)';
        } else if (wave > 1) {
          amberFill = '#38bdf8';
        } else if (node.isDeadCode) {
          amberFill = '#475569';
          glowColor = 'transparent';
        }

        // Hologram Corona Glow
        if (glowColor !== 'transparent' || isHovered) {
          ctx.beginPath();
          ctx.arc(node.x, node.y, radius + (node.isFolder ? 12 : 6) / k, 0, Math.PI * 2);
          ctx.fillStyle = glowColor;
          ctx.fill();
        }

        // Core Solid Body
        ctx.beginPath();
        ctx.arc(node.x, node.y, radius, 0, Math.PI * 2);
        ctx.fillStyle = amberFill;
        ctx.fill();

        ctx.lineWidth = (isSelected || isHovered || node.isFolder ? 2.2 : 1) / k;
        ctx.strokeStyle = isSelected || isHovered ? '#ffffff' : '#030712';
        ctx.stroke();

        // Technical JARVIS Node Label
        const label = node.isFolder ? node.name : node.displayName;
        const fontSize = Math.max(9, Math.min(12, Math.round((node.isFolder ? 12 : 10) / Math.sqrt(k))));
        ctx.font = `${node.isFolder || isSelected ? 'bold ' : 'normal '}${fontSize}px monospace`;
        ctx.fillStyle = node.isFolder ? '#38bdf8' : isSelected ? '#ffffff' : '#e0f2fe';
        ctx.textAlign = 'center';
        ctx.fillText(label, node.x, node.y + radius + 13 / k);

        if (node.isFolder && !node.isCenterHub) {
          ctx.font = `normal ${Math.max(8, Math.min(9, Math.round(8.5 / Math.sqrt(k))))}px monospace`;
          ctx.fillStyle = '#64748b';
          ctx.fillText(`(${node.fileCount} files)`, node.x, node.y + radius + 24 / k);
        }
      }

      ctx.restore();
      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [graph, activeFolder, selectedFileId, selectedFileIds, blastReport, hoveredNode, internetAlerts]);

  const screenToWorld = (clientX: number, clientY: number) => {
    if (!canvasRef.current) return { wx: 0, wy: 0 };
    const rect = canvasRef.current.getBoundingClientRect();
    return {
      wx: (clientX - rect.left - transformRef.current.x) / transformRef.current.k,
      wy: (clientY - rect.top - transformRef.current.y) / transformRef.current.k,
    };
  };

  const getNodeAt = (wx: number, wy: number) => {
    for (let i = simNodesRef.current.length - 1; i >= 0; i--) {
      const n = simNodesRef.current[i];
      if (Math.hypot(wx - n.x, wy - n.y) <= n.radius + 8) {
        return n;
      }
    }
    return null;
  };

  const handlePointerDown = (clientX: number, clientY: number) => {
    const { wx, wy } = screenToWorld(clientX, clientY);
    const hit = getNodeAt(wx, wy);

    if (hit) {
      if (hit.isFolder) {
        if (hit.isCenterHub) {
          setActiveFolder(null); // Click center to step back to macro view
        } else {
          setActiveFolder(hit.folderKey); // Enter folder
        }
      } else {
        draggedNodeRef.current = hit;
        hit.fx = hit.x;
        hit.fy = hit.y;
        onSelectFile(hit.id);
        if (simulationRef.current) simulationRef.current.alphaTarget(0.3).restart();
      }
    } else {
      isDraggingCanvasRef.current = true;
      dragStartRef.current = {
        x: clientX - transformRef.current.x,
        y: clientY - transformRef.current.y,
      };
      if (selectedFileId) onSelectFile('');
    }
  };

  const handlePointerMove = (clientX: number, clientY: number) => {
    const { wx, wy } = screenToWorld(clientX, clientY);

    if (draggedNodeRef.current) {
      draggedNodeRef.current.fx = wx;
      draggedNodeRef.current.fy = wy;
      return;
    }

    if (isDraggingCanvasRef.current) {
      transformRef.current.x = clientX - dragStartRef.current.x;
      transformRef.current.y = clientY - dragStartRef.current.y;
      return;
    }

    setHoveredNode(getNodeAt(wx, wy));
  };

  return (
    <div
      ref={containerRef}
      className="relative flex-1 h-full bg-[#020307] overflow-hidden select-none font-mono"
      style={{ touchAction: 'none' }}
    >
      <canvas
        ref={canvasRef}
        onMouseDown={(e) => handlePointerDown(e.clientX, e.clientY)}
        onMouseMove={(e) => handlePointerMove(e.clientX, e.clientY)}
        onMouseUp={() => (isDraggingCanvasRef.current = false)}
        onWheel={(e) => {
          e.preventDefault();
          const factor = e.deltaY < 0 ? 1.12 : 0.88;
          transformRef.current.k = Math.min(3.5, Math.max(0.18, transformRef.current.k * factor));
        }}
        onDoubleClick={(e) => {
          const { wx, wy } = screenToWorld(e.clientX, e.clientY);
          const hit = getNodeAt(wx, wy);
          if (hit && !hit.isFolder) onOpenCodeModal(hit.id);
        }}
        className="w-full h-full block cursor-grab active:cursor-grabbing"
      />

      {/* Return Button when inside a Folder */}
      {activeFolder && (
        <button
          type="button"
          onClick={() => setActiveFolder(null)}
          className="absolute top-3 left-3 flex items-center gap-1.5 bg-slate-900/90 hover:bg-slate-800 border border-sky-500/40 text-sky-300 px-3 py-1.5 rounded-xl text-xs font-bold transition shadow-2xl cursor-pointer backdrop-blur-md"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Main Core</span>
        </button>
      )}

      {hoveredNode && (
        <div className="absolute bottom-14 left-3 bg-slate-950/95 border border-sky-500/40 rounded-xl p-3 shadow-2xl text-xs pointer-events-none max-w-sm backdrop-blur-lg">
          <div className="text-sky-200 font-bold truncate">
            {hoveredNode.isFolder ? hoveredNode.name : hoveredNode.id}
          </div>
          <div className="text-[10px] text-sky-400 mb-1">
            {hoveredNode.isFolder
              ? `Cluster contains ${hoveredNode.fileCount} active modules`
              : `Package: ${hoveredNode.topDir}/`}
          </div>

          <div className="flex gap-3 text-[11px] text-slate-400 mt-1">
            <span>LOC: <strong className="text-slate-200">{hoveredNode.loc}</strong></span>
            {!hoveredNode.isFolder && (
              <>
                <span>Callers: <strong className="text-sky-400">{hoveredNode.inDegree}</strong></span>
                <span>Rank share: <strong className="text-sky-300">{((hoveredNode.pageRank || 0) * 100).toFixed(2)}%</strong></span>
              </>
            )}
          </div>
        </div>
      )}

      {/* Recenter & Zoom Controls */}
      <div className="absolute bottom-3 right-3 flex items-center gap-1.5 bg-slate-950/90 border border-slate-800 p-1.5 rounded-xl shadow-lg backdrop-blur-md">
        <button
          type="button"
          onClick={() => (transformRef.current.k = Math.min(3.5, transformRef.current.k * 1.2))}
          className="p-1.5 hover:bg-slate-900 text-sky-300 rounded-lg transition"
          title="Zoom In"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => (transformRef.current.k = Math.max(0.18, transformRef.current.k * 0.8))}
          className="p-1.5 hover:bg-slate-900 text-sky-300 rounded-lg transition"
          title="Zoom Out"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => {
            if (!containerRef.current) return;
            transformRef.current = {
              x: containerRef.current.clientWidth / 2,
              y: containerRef.current.clientHeight / 2,
              k: 0.9,
            };
          }}
          className="p-1.5 hover:bg-slate-900 text-sky-300 rounded-lg transition"
          title="Recenter"
        >
          <Maximize2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
});

export default ForceGraphCanvas;



