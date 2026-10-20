'use client';

import React, { useState, useMemo } from 'react';
import {
  Activity,
  AlertTriangle,
  Flame,
  FileWarning,
  Eye,
  Search,
  ChevronDown,
  ChevronRight,
  Network,
  Radio,
} from 'lucide-react';
import { RepositoryGraph } from '@/types/graph.types';

interface ArchitectureVitalsProps {
  graph: RepositoryGraph | null;
  selectedFileId: string | null;
  highlightDead: boolean;
  highlightCircular: boolean;
  onToggleDead: () => void;
  onToggleCircular: () => void;
  onSelectFile: (fileId: string) => void;
}

export default function ArchitectureVitals({
  graph,
  selectedFileId,
  highlightDead,
  highlightCircular,
  onToggleDead,
  onToggleCircular,
  onSelectFile,
}: ArchitectureVitalsProps) {
  // 1. ALL HOOKS CALLED UNCONDITIONALLY AT THE TOP
  const [deadSearch, setDeadSearch] = useState('');
  const [expandedSection, setExpandedSection] = useState<'god' | 'cycles' | 'dead'>('god');

  const filteredDeadFiles = useMemo(() => {
    if (!graph?.deadFiles) return [];
    return graph.deadFiles.filter((f) =>
      f.toLowerCase().includes(deadSearch.toLowerCase())
    );
  }, [graph?.deadFiles, deadSearch]);

  const healthStatus = useMemo(() => {
    if (!graph) {
      return { label: 'CONNECTING', style: 'bg-slate-800 text-slate-400 border-slate-700' };
    }
    const deadRatio = (graph.deadFiles?.length || 0) / Math.max(1, graph.totalFiles || 1);
    const hasCycles = (graph.circularGroups?.length || 0) > 0;

    if (hasCycles || deadRatio > 0.4) {
      return { label: 'CRITICAL', style: 'bg-sky-500/10 text-sky-400 border-rose-500/30' };
    }
    if (deadRatio > 0.15) {
      return { label: 'DEGRADED', style: 'bg-amber-500/10 text-sky-400 border-amber-500/30' };
    }
    return { label: 'OPTIMAL', style: 'bg-emerald-500/10 text-sky-400 border-emerald-500/30' };
  }, [graph]);

  // 2. CONDITIONAL RETURN COMES AFTER ALL HOOKS
  if (!graph) {
    return (
      <aside className="w-84 bg-[#030712]/95 backdrop-blur-xl border-r border-slate-800/80 p-6 text-slate-500 text-xs font-mono flex flex-col items-center justify-center text-center">
        <Radio className="w-6 h-6 text-slate-700 animate-pulse mb-3" />
        <span className="tracking-wide">Awaiting AST Telemetry Stream...</span>
      </aside>
    );
  }

  return (
    <aside className="w-84 bg-[#030712]/95 backdrop-blur-2xl border-r border-slate-800/80 flex flex-col h-full overflow-hidden select-none font-mono text-xs shrink-0 z-20 shadow-2xl">
      {/* 1. Header & Live Repo Telemetry */}
      <div className="p-4 border-b border-slate-800/70 bg-slate-950/70">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] uppercase tracking-wider text-slate-400 flex items-center gap-1.5 font-bold">
            <Activity className="w-3.5 h-3.5 text-sky-400" />
            System Vitals &amp; Topology
          </span>
          <span className={`text-[9px] px-2 py-0.5 rounded-full border font-bold tracking-wider ${healthStatus.style}`}>
            HEALTH: {healthStatus.label}
          </span>
        </div>

        <div className="text-slate-100 font-semibold text-xs truncate mb-3 flex items-center gap-1.5" title={graph.repoName}>
          <Network className="w-3.5 h-3.5 text-slate-500 shrink-0" />
          <span className="truncate">{graph.repoName}</span>
        </div>

        {/* System Metric Grid */}
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-2.5 text-center shadow-inner">
            <div className="text-sm font-black text-slate-100 tracking-tight">{graph.totalFiles}</div>
            <div className="text-[9px] text-slate-400 uppercase font-medium mt-0.5">Modules</div>
          </div>
          <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-2.5 text-center shadow-inner">
            <div className="text-sm font-black text-sky-400 tracking-tight">{graph.totalEdges}</div>
            <div className="text-[9px] text-slate-400 uppercase font-medium mt-0.5">AST Edges</div>
          </div>
          <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-2.5 text-center shadow-inner">
            <div className="text-sm font-black text-sky-400 tracking-tight">
              {(graph.totalLoc / 1000).toFixed(1)}k
            </div>
            <div className="text-[9px] text-slate-400 uppercase font-medium mt-0.5">Total LOC</div>
          </div>
        </div>

        {/* Global Topology Filters */}
        <div className="mt-3 flex items-center gap-2">
          <button
            type="button"
            onClick={onToggleCircular}
            className={`flex-1 py-1.5 px-2.5 rounded-lg border text-[10px] font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              highlightCircular
                ? 'bg-sky-500/10 border-sky-500/30 text-sky-300 shadow-[0_0_12px_rgba(168,85,247,0.2)]'
                : 'bg-slate-900/80 border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            <Eye className="w-3 h-3" />
            Cycles ({graph.circularGroups.length})
          </button>
          <button
            type="button"
            onClick={onToggleDead}
            className={`flex-1 py-1.5 px-2.5 rounded-lg border text-[10px] font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              highlightDead
                ? 'bg-sky-500/10 border-sky-500/30 text-amber-300 shadow-[0_0_12px_rgba(245,158,11,0.2)]'
                : 'bg-slate-900/80 border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            <Eye className="w-3 h-3" />
            Dead Code ({graph.deadFiles.length})
          </button>
        </div>
      </div>

      {/* 2. Interactive Topology Sections */}
      <div className="flex-1 overflow-y-auto divide-y divide-slate-800/60">
        {/* A. Core Centrality "God Files" */}
        <div>
          <button
            type="button"
            onClick={() => setExpandedSection(expandedSection === 'god' ? ('' as any) : 'god')}
            className="w-full p-3.5 flex items-center justify-between text-left hover:bg-slate-900/40 transition cursor-pointer"
          >
            <span className="text-[11px] font-bold text-sky-400 flex items-center gap-2">
              <Flame className="w-3.5 h-3.5 text-sky-400" />
              Core Centrality Nodes ({graph.godFiles.length})
            </span>
            {expandedSection === 'god' ? (
              <ChevronDown className="w-4 h-4 text-slate-400" />
            ) : (
              <ChevronRight className="w-4 h-4 text-slate-400" />
            )}
          </button>

          {expandedSection === 'god' && (
            <div className="p-3.5 pt-0 space-y-2">
              {graph.godFiles.map((fid) => {
                const node = graph.nodes[fid];
                if (!node) return null;
                const isSelected = selectedFileId === fid;
                const pageRankPct = Math.round((node.pageRank || 0) * 100);

                return (
                  <button
                    key={fid}
                    type="button"
                    onClick={() => onSelectFile(fid)}
                    className={`w-full text-left p-2.5 rounded-xl border transition-all flex flex-col gap-1.5 cursor-pointer ${
                      isSelected
                        ? 'bg-sky-500/10 border-sky-500/30 text-sky-200 shadow-[0_0_15px_rgba(244,63,94,0.15)]'
                        : 'bg-slate-900/50 hover:bg-slate-900 border-slate-800/70 text-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <div className="truncate pr-2">
                        <div className="truncate font-bold text-slate-200 text-xs">{node.name}</div>
                        <div className="text-[10px] text-slate-500 truncate">{node.directory || 'root'}</div>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-[10px] font-extrabold text-sky-400 block font-mono">
                          PR {pageRankPct}%
                        </span>
                        <span className="text-[9px] text-slate-400 block">{node.inDegree} callers</span>
                      </div>
                    </div>

                    <div className="w-full h-1 bg-slate-800 rounded-full overflow-hidden mt-0.5">
                      <div
                        className="h-full bg-sky-500 rounded-full"
                        style={{ width: `${Math.min(100, Math.max(5, pageRankPct))}%` }}
                      />
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* B. Circular Dependency Loops (Cycles) */}
        <div>
          <button
            type="button"
            onClick={() => setExpandedSection(expandedSection === 'cycles' ? ('' as any) : 'cycles')}
            className="w-full p-3.5 flex items-center justify-between text-left hover:bg-slate-900/40 transition cursor-pointer"
          >
            <span className="text-[11px] font-bold text-sky-400 flex items-center gap-2">
              <AlertTriangle className="w-3.5 h-3.5 text-sky-400" />
              Circular Dependencies ({graph.circularGroups.length})
            </span>
            {expandedSection === 'cycles' ? (
              <ChevronDown className="w-4 h-4 text-slate-400" />
            ) : (
              <ChevronRight className="w-4 h-4 text-slate-400" />
            )}
          </button>

          {expandedSection === 'cycles' && (
            <div className="p-3.5 pt-0 space-y-2.5">
              {graph.circularGroups.length === 0 ? (
                <div className="p-3 rounded-xl bg-emerald-950/20 border border-emerald-500/30 text-[11px] text-emerald-300 leading-relaxed">
                  ✓ Clean DAG. Zero cyclic import loops detected in AST.
                </div>
              ) : (
                graph.circularGroups.map((group, idx) => (
                  <div key={idx} className="bg-purple-950/20 border border-purple-500/30 rounded-xl p-3 text-[11px] space-y-2">
                    <div className="text-sky-300 font-bold flex items-center justify-between">
                      <span>Loop #{idx + 1} ({group.length} nodes)</span>
                      <span className="text-[9px] bg-purple-500/20 text-purple-200 px-1.5 py-0.5 rounded font-mono">
                        Cyclic Risk
                      </span>
                    </div>
                    <div className="space-y-1">
                      {group.map((fid, fIdx) => (
                        <button
                          key={fid}
                          type="button"
                          onClick={() => onSelectFile(fid)}
                          className="w-full text-left truncate text-slate-300 hover:text-sky-300 transition block cursor-pointer py-0.5"
                        >
                          <span className="text-purple-500 font-mono mr-1">↻</span>
                          {fIdx + 1}. {fid}
                        </button>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* C. Orphan & Dead Code Audit */}
        <div>
          <button
            type="button"
            onClick={() => setExpandedSection(expandedSection === 'dead' ? ('' as any) : 'dead')}
            className="w-full p-3.5 flex items-center justify-between text-left hover:bg-slate-900/40 transition cursor-pointer"
          >
            <span className="text-[11px] font-bold text-slate-400 flex items-center gap-2">
              <FileWarning className="w-3.5 h-3.5 text-sky-400" />
              Dead Code Modules ({graph.deadFiles.length})
            </span>
            {expandedSection === 'dead' ? (
              <ChevronDown className="w-4 h-4 text-slate-400" />
            ) : (
              <ChevronRight className="w-4 h-4 text-slate-400" />
            )}
          </button>

          {expandedSection === 'dead' && (
            <div className="p-3.5 pt-0 space-y-2.5">
              <div className="relative flex items-center">
                <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 pointer-events-none" />
                <input
                  type="text"
                  value={deadSearch}
                  onChange={(e) => setDeadSearch(e.target.value)}
                  placeholder="Filter orphan modules..."
                  className="w-full bg-slate-900/80 text-slate-200 text-[10px] pl-8 pr-3 py-1.5 rounded-lg border border-slate-800 focus:border-slate-700 focus:outline-none transition"
                />
              </div>

              <div className="max-h-52 overflow-y-auto space-y-1 pr-1">
                {filteredDeadFiles.length === 0 ? (
                  <p className="text-[11px] text-slate-500 py-1">Zero orphan modules matching criteria.</p>
                ) : (
                  filteredDeadFiles.map((fid) => (
                    <button
                      key={fid}
                      type="button"
                      onClick={() => onSelectFile(fid)}
                      className={`w-full text-left p-1.5 rounded-md text-[10px] truncate transition cursor-pointer ${
                        selectedFileId === fid
                          ? 'bg-rose-500/20 text-sky-300 font-bold'
                          : 'hover:bg-slate-900 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      • {fid}
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
