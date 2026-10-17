'use client';
import React, { useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Flame,
  FileWarning,
  Eye,
  Search,
  ChevronDown,
  ChevronRight,
  Layers,
  Sparkles,
  ExternalLink,
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
  const [deadSearch, setDeadSearch] = useState('');
  const [expandedSection, setExpandedSection] = useState<'god' | 'cycles' | 'dead'>('god');

  if (!graph) {
    return (
      <aside className="w-80 bg-[#020617] border-r border-slate-800 p-4 text-slate-500 text-xs font-mono">
        Connecting telemetry...
      </aside>
    );
  }

  const filteredDeadFiles = graph.deadFiles.filter((f) =>
    f.toLowerCase().includes(deadSearch.toLowerCase())
  );

  return (
    <aside className="w-80 bg-[#020617] border-r border-slate-800 flex flex-col h-full overflow-hidden select-none font-mono text-xs shrink-0">
      
      {/* 1. Header & Live Repo Telemetry */}
      <div className="p-3.5 border-b border-slate-800/80 bg-slate-950/60">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] uppercase tracking-wider text-slate-400 flex items-center gap-1.5 font-bold">
            <Activity className="w-3.5 h-3.5 text-emerald-400" />
            Architectural Telemetry
          </span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold">
            HEALTH: {graph.deadFiles.length > 50 ? 'DEGRADED' : 'OPTIMAL'}
          </span>
        </div>

        <div className="text-slate-200 font-bold text-xs truncate mb-3" title={graph.repoName}>
          {graph.repoName}
        </div>

        {/* System Metric Cards */}
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-2 text-center">
            <div className="text-sm font-bold text-white">{graph.totalFiles}</div>
            <div className="text-[9px] text-slate-400 uppercase">Files</div>
          </div>
          <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-2 text-center">
            <div className="text-sm font-bold text-sky-400">{graph.totalEdges}</div>
            <div className="text-[9px] text-slate-400 uppercase">AST Edges</div>
          </div>
          <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-2 text-center">
            <div className="text-sm font-bold text-emerald-400">
              {(graph.totalLoc / 1000).toFixed(1)}k
            </div>
            <div className="text-[9px] text-slate-400 uppercase">Total LOC</div>
          </div>
        </div>

        {/* Global Canvas Highlight Filters */}
        <div className="mt-3 flex items-center gap-2">
          <button
            type="button"
            onClick={onToggleCircular}
            className={`flex-1 py-1.5 px-2 rounded-lg border text-[10px] flex items-center justify-center gap-1.5 transition cursor-pointer ${
              highlightCircular
                ? 'bg-purple-500/15 border-purple-500/40 text-purple-300 font-bold'
                : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            <Eye className="w-3 h-3" />
            Cycles ({graph.circularGroups.length})
          </button>
          <button
            type="button"
            onClick={onToggleDead}
            className={`flex-1 py-1.5 px-2 rounded-lg border text-[10px] flex items-center justify-center gap-1.5 transition cursor-pointer ${
              highlightDead
                ? 'bg-amber-500/15 border-amber-500/40 text-amber-300 font-bold'
                : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            <Eye className="w-3 h-3" />
            Dead Code ({graph.deadFiles.length})
          </button>
        </div>
      </div>

      {/* 2. Interactive Accordion Sections */}
      <div className="flex-1 overflow-y-auto divide-y divide-slate-800/60">
        
        {/* A. Core Critical "God Files" */}
        <div>
          <button
            type="button"
            onClick={() => setExpandedSection(expandedSection === 'god' ? ('' as any) : 'god')}
            className="w-full p-3 flex items-center justify-between text-left hover:bg-slate-900/40 transition cursor-pointer"
          >
            <span className="text-[11px] font-bold text-amber-400 flex items-center gap-1.5">
              <Flame className="w-3.5 h-3.5" /> Core "God Files" ({graph.godFiles.length})
            </span>
            {expandedSection === 'god' ? <ChevronDown className="w-3.5 h-3.5 text-slate-400" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-400" />}
          </button>

          {expandedSection === 'god' && (
            <div className="p-3 pt-0 space-y-1.5">
              {graph.godFiles.map((fid) => {
                const node = graph.nodes[fid];
                if (!node) return null;
                const isSelected = selectedFileId === fid;
                return (
                  <button
                    key={fid}
                    type="button"
                    onClick={() => onSelectFile(fid)}
                    className={`w-full text-left p-2 rounded-lg border transition flex items-center justify-between cursor-pointer ${
                      isSelected
                        ? 'bg-red-500/15 border-red-500/50 text-red-200'
                        : 'bg-slate-900/60 hover:bg-slate-900 border-slate-800/80 text-slate-300'
                    }`}
                  >
                    <div className="truncate pr-2">
                      <div className="truncate font-bold text-slate-200 text-xs">{node.name}</div>
                      <div className="text-[10px] text-slate-500 truncate">{node.directory || 'root'}</div>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="text-[10px] font-bold text-amber-400 block">
                        PR {(node.pageRank * 100).toFixed(0)}%
                      </span>
                      <span className="text-[9px] text-slate-400 block">{node.inDegree} callers</span>
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
            className="w-full p-3 flex items-center justify-between text-left hover:bg-slate-900/40 transition cursor-pointer"
          >
            <span className="text-[11px] font-bold text-purple-400 flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5" /> Circular Loops ({graph.circularGroups.length})
            </span>
            {expandedSection === 'cycles' ? <ChevronDown className="w-3.5 h-3.5 text-slate-400" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-400" />}
          </button>

          {expandedSection === 'cycles' && (
            <div className="p-3 pt-0 space-y-2">
              {graph.circularGroups.length === 0 ? (
                <div className="p-2.5 rounded-lg bg-emerald-950/20 border border-emerald-500/30 text-[11px] text-emerald-300">
                  ✓ Clean DAG. Zero circular import cycles detected!
                </div>
              ) : (
                graph.circularGroups.map((group, idx) => (
                  <div key={idx} className="bg-purple-950/20 border border-purple-500/30 rounded-xl p-2.5 text-[11px]">
                    <div className="text-purple-300 font-bold mb-1.5 flex items-center justify-between">
                      <span>Cycle #{idx + 1} ({group.length} nodes)</span>
                      <span className="text-[9px] bg-purple-500/20 text-purple-200 px-1.5 rounded">Risk: High</span>
                    </div>
                    <div className="space-y-1">
                      {group.map((fid, fIdx) => (
                        <button
                          key={fid}
                          type="button"
                          onClick={() => onSelectFile(fid)}
                          className="w-full text-left truncate text-slate-300 hover:text-purple-300 transition block cursor-pointer"
                        >
                          {fIdx + 1}. ↻ {fid}
                        </button>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* C. Dead Code Repository Audit */}
        <div>
          <button
            type="button"
            onClick={() => setExpandedSection(expandedSection === 'dead' ? ('' as any) : 'dead')}
            className="w-full p-3 flex items-center justify-between text-left hover:bg-slate-900/40 transition cursor-pointer"
          >
            <span className="text-[11px] font-bold text-slate-400 flex items-center gap-1.5">
              <FileWarning className="w-3.5 h-3.5 text-amber-400" /> Dead Files ({graph.deadFiles.length})
            </span>
            {expandedSection === 'dead' ? <ChevronDown className="w-3.5 h-3.5 text-slate-400" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-400" />}
          </button>

          {expandedSection === 'dead' && (
            <div className="p-3 pt-0 space-y-2">
              <div className="relative flex items-center">
                <Search className="w-3 h-3 text-slate-500 absolute left-2.5 pointer-events-none" />
                <input
                  type="text"
                  value={deadSearch}
                  onChange={(e) => setDeadSearch(e.target.value)}
                  placeholder="Filter dead files..."
                  className="w-full bg-slate-900 text-slate-200 text-[11px] pl-7 pr-2 py-1 rounded-lg border border-slate-800 focus:outline-none"
                />
              </div>

              <div className="max-h-48 overflow-y-auto space-y-1 pr-1">
                {filteredDeadFiles.length === 0 ? (
                  <p className="text-[11px] text-slate-500 py-1">No matching dead files.</p>
                ) : (
                  filteredDeadFiles.map((fid) => (
                    <button
                      key={fid}
                      type="button"
                      onClick={() => onSelectFile(fid)}
                      className={`w-full text-left p-1.5 rounded text-[11px] truncate transition cursor-pointer ${
                        selectedFileId === fid
                          ? 'bg-red-500/20 text-red-300 font-bold'
                          : 'hover:bg-slate-900 text-slate-400'
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
