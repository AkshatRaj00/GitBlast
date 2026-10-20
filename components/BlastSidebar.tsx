'use client';

import React, { useState, useMemo } from 'react';
import {
  Flame,
  Code2,
  GitPullRequest,
  AlertOctagon,
  CheckCircle2,
  XCircle,
  ExternalLink,
  X,
  Search,
  Copy,
  Check,
  ShieldCheck,
  ShieldAlert,
  Layers,
  GitFork,
  Radio,
  FileCode2,
  Terminal,
} from 'lucide-react';
import { RepositoryGraph } from '@/types/graph.types';
import { MultiFileBlastReport } from '@/engine/math/multiBlastRadius';

interface BlastSidebarProps {
  graph: RepositoryGraph | null;
  selectedFileIds: string[];
  multiBlastReport: MultiFileBlastReport | null;
  isPrMode: boolean;
  onTogglePrMode: () => void;
  onRemoveSelectedFile: (fileId: string) => void;
  onSelectFile: (fileId: string) => void;
  onOpenCodeModal: (fileId: string) => void;
}

export default function BlastSidebar({
  graph,
  selectedFileIds,
  multiBlastReport,
  isPrMode,
  onTogglePrMode,
  onRemoveSelectedFile,
  onSelectFile,
  onOpenCodeModal,
}: BlastSidebarProps) {
  const [activeTab, setActiveTab] = useState<'waves' | 'causal' | 'quality'>('waves');
  const [waveSearch, setWaveSearch] = useState('');
  const [copiedReport, setCopiedReport] = useState(false);

  const getGitHubFileUrl = (filePath: string) => {
    if (!graph?.repoName) return '#';
    const rawRepo = graph.repoName.replace(/^https?:\/\/github\.com\//, '').replace(/\.git$/, '');
    return `https://github.com/${rawRepo}/blob/main/${filePath}`;
  };

  const handleCopyMarkdownReport = () => {
    if (!multiBlastReport || !graph) return;
    const text = `### ⚡ GitBlast Architectural Impact Analysis
- **Status:** ${multiBlastReport.severity} RISK (${multiBlastReport.blastPercentage}% Impact)
- **Target Epicenters:** \`${selectedFileIds.join('`, `')}\`
- **Downstream Breakage:** ${multiBlastReport.totalImpactedCount} / ${graph.totalFiles} files
- **Quality Gate:** ${multiBlastReport.qualityGate.canMergeSafely ? '✅ PASSED' : '❌ BLOCKED'}
- **Crossfire Dependencies:** ${multiBlastReport.crossfireFiles.length} files`;

    navigator.clipboard.writeText(text);
    setCopiedReport(true);
    setTimeout(() => setCopiedReport(false), 2000);
  };

  const severityBadge = useMemo(() => {
    const sev = multiBlastReport?.severity || 'LOW';
    switch (sev) {
      case 'CRITICAL':
        return 'bg-sky-500/10 text-sky-400 border-sky-500/30 shadow-[0_0_12px_rgba(244,63,94,0.15)]';
      case 'HIGH':
        return 'bg-sky-500/10 text-sky-400 border-sky-500/30 shadow-[0_0_12px_rgba(245,158,11,0.15)]';
      case 'MODERATE':
        return 'bg-yellow-500/10 text-yellow-300 border-yellow-500/30';
      default:
        return 'bg-emerald-500/10 text-sky-400 border-sky-500/30';
    }
  }, [multiBlastReport?.severity]);

  if (!graph) {
    return (
      <aside className="w-96 bg-[#030712]/95 backdrop-blur-xl border-l border-slate-800/80 p-6 text-slate-500 font-mono text-xs flex flex-col items-center justify-center text-center">
        <Radio className="w-6 h-6 text-slate-700 animate-pulse mb-3" />
        <span className="tracking-wide">No active repository telemetry stream.</span>
      </aside>
    );
  }

  return (
    <aside className="w-96 bg-[#030712]/95 backdrop-blur-2xl border-l border-slate-800/80 flex flex-col h-full overflow-hidden select-none font-mono text-xs z-20 shadow-2xl">
      {/* 1. Header Toolbar */}
      <div className="px-4 py-3 border-b border-slate-800/70 bg-slate-950/70 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-sky-500/10 border border-sky-500/20 flex items-center justify-center">
            <GitPullRequest className="w-3.5 h-3.5 text-sky-400" />
          </div>
          <div>
            <span className="font-semibold text-slate-200 tracking-tight block text-[11px]">
              {isPrMode ? 'PR Blast Simulator' : 'Symbol Blast Engine'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {multiBlastReport && (
            <button
              type="button"
              onClick={handleCopyMarkdownReport}
              className="p-1.5 rounded-md bg-slate-900/90 hover:bg-slate-800 text-slate-300 border border-slate-800 transition active:scale-95 cursor-pointer"
              title="Copy PR Markdown Report"
            >
              {copiedReport ? (
                <Check className="w-3.5 h-3.5 text-sky-400" />
              ) : (
                <Copy className="w-3.5 h-3.5 text-slate-400 hover:text-slate-200" />
              )}
            </button>
          )}

          <button
            type="button"
            onClick={onTogglePrMode}
            className={`px-2.5 py-1 rounded-md text-[10px] font-semibold tracking-wide border transition-all cursor-pointer ${
              isPrMode
                ? 'bg-sky-500/20 border-sky-400/50 text-sky-300 shadow-[0_0_12px_rgba(56,189,248,0.25)]'
                : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
            }`}
          >
            {isPrMode ? 'Exit PR' : 'Simulate PR +'}
          </button>
        </div>
      </div>

      {/* 2. Workspace Viewports */}
      {selectedFileIds.length === 0 ? (
        <div className="p-8 flex-1 flex flex-col items-center justify-center text-center">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-b from-slate-900 to-slate-950 border border-slate-800/80 flex items-center justify-center mb-4 shadow-inner">
            <Flame className="w-6 h-6 text-slate-600" />
          </div>
          <h4 className="font-semibold text-slate-300 text-xs tracking-wide">
            Zero Epicenters Selected
          </h4>
          <p className="text-[11px] text-slate-500 mt-1.5 leading-relaxed max-w-[220px]">
            Select target module on DAG to calculate symbol-level cascading breakages.
          </p>
        </div>
      ) : (
        <>
          {/* Modified Targets Chamber */}
          <div className="p-3.5 border-b border-slate-800/70 bg-slate-950/40">
            <div className="text-[10px] uppercase font-semibold text-slate-400 flex items-center justify-between mb-2">
              <span className="flex items-center gap-1.5 text-slate-400">
                <FileCode2 className="w-3 h-3 text-slate-500" />
                Target Epicenters ({selectedFileIds.length})
              </span>
              {multiBlastReport && (
                <span className={`px-2 py-0.5 rounded-full border text-[9px] font-bold tracking-wider ${severityBadge}`}>
                  {multiBlastReport.severity} RISK
                </span>
              )}
            </div>

            <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1">
              {selectedFileIds.map((fid) => (
                <div
                  key={fid}
                  className="group flex items-center justify-between p-2 rounded-lg bg-slate-900/60 hover:bg-slate-900 border border-slate-800/60 hover:border-slate-700/80 transition text-[11px]"
                >
                  <span className="truncate pr-2 text-slate-300 group-hover:text-slate-100 font-medium" title={fid}>
                    {fid}
                  </span>
                  <div className="flex items-center gap-1 shrink-0">
                    <a
                      href={getGitHubFileUrl(fid)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1 hover:text-sky-400 text-slate-500 transition"
                      title="Inspect Source on GitHub"
                    >
                      <ExternalLink className="w-3 h-3" />
                    </a>
                    <button
                      type="button"
                      onClick={() => onOpenCodeModal(fid)}
                      className="p-1 hover:text-sky-400 text-slate-500 transition cursor-pointer"
                      title="Inspect Source Code"
                    >
                      <Code2 className="w-3 h-3" />
                    </button>
                    {isPrMode && (
                      <button
                        type="button"
                        onClick={() => onRemoveSelectedFile(fid)}
                        className="p-1 hover:text-sky-400 text-slate-500 transition cursor-pointer"
                        title="Remove file from PR scope"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Blast Radius Analytics Gauge */}
          {multiBlastReport && (
            <div className="p-4 border-b border-slate-800/70 bg-gradient-to-b from-slate-900/40 to-slate-950/20">
              <div className="flex items-baseline justify-between">
                <div>
                  <div className="text-[9px] text-slate-400 uppercase tracking-wider font-semibold">
                    Blast Exposure
                  </div>
                  <div className="text-3xl font-black text-sky-400 tracking-tight mt-1 flex items-baseline gap-1">
                    {multiBlastReport.blastPercentage}%
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-bold text-slate-200">
                    {multiBlastReport.totalImpactedCount}
                    <span className="text-slate-500 font-normal"> / {Math.max(1, graph.totalFiles - selectedFileIds.length)}</span>
                  </div>
                  <div className="text-[10px] text-slate-400 tracking-tight">Callers Vulnerable</div>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="w-full h-2 bg-slate-900 border border-slate-800 rounded-full overflow-hidden mt-3 p-0.5">
                <div
                  className="h-full bg-sky-500 rounded-full transition-all duration-500 shadow-[0_0_8px_rgba(244,63,94,0.4)]"
                  style={{ width: `${Math.min(100, Math.max(3, multiBlastReport.blastPercentage))}%` }}
                />
              </div>

              {multiBlastReport.crossfireFiles.length > 0 && (
                <div className="mt-3 p-2.5 rounded-lg bg-slate-900/60 border border-sky-500/30 text-[10px] text-sky-300 flex items-start gap-2 shadow-sm">
                  <AlertOctagon className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
                  <div>
                    <strong className="font-semibold text-sky-200">Crossfire Risk:</strong> {multiBlastReport.crossfireFiles.length} downstream modules depend on multiple modified targets.
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Navigation Control Tabs */}
          <div className="flex border-b border-slate-800/80 bg-slate-950/60 p-1 gap-1 text-[10px]">
            <button
              type="button"
              onClick={() => setActiveTab('waves')}
              className={`flex-1 py-1.5 rounded-md font-medium text-center transition cursor-pointer flex items-center justify-center gap-1.5 ${
                activeTab === 'waves'
                  ? 'bg-sky-500/10 border border-sky-500/30 text-sky-400 font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Layers className="w-3 h-3" />
              Waves ({multiBlastReport?.waves.length || 0})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('causal')}
              className={`flex-1 py-1.5 rounded-md font-medium text-center transition cursor-pointer flex items-center justify-center gap-1.5 ${
                activeTab === 'causal'
                  ? 'bg-sky-500/10 border border-sky-500/30 text-sky-400 font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <GitFork className="w-3 h-3" />
              Causal Paths
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('quality')}
              className={`flex-1 py-1.5 rounded-md font-medium text-center transition cursor-pointer flex items-center justify-center gap-1.5 ${
                activeTab === 'quality'
                  ? 'bg-emerald-500/10 border border-sky-500/30 text-sky-400 font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <ShieldCheck className="w-3 h-3" />
              Quality Gate
            </button>
          </div>

          {/* Tab Content Display */}
          <div className="flex-1 overflow-y-auto p-3.5 space-y-3">
            {/* 1. Waves Tab with Impact Hierarchy */}
            {activeTab === 'waves' && (
              <div className="space-y-3">
                <div className="relative flex items-center">
                  <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 pointer-events-none" />
                  <input
                    type="text"
                    value={waveSearch}
                    onChange={(e) => setWaveSearch(e.target.value)}
                    placeholder="Filter broken symbols & modules..."
                    className="w-full bg-slate-900/90 text-slate-200 text-[10px] pl-8 pr-3 py-1.5 rounded-lg border border-slate-800 focus:border-slate-700 focus:outline-none placeholder:text-slate-600 transition"
                  />
                </div>

                {multiBlastReport?.waves.map((wave) => {
                  const filteredWaveFiles = wave.fileIds.filter((fid) =>
                    fid.toLowerCase().includes(waveSearch.toLowerCase())
                  );
                  if (filteredWaveFiles.length === 0) return null;

                  return (
                    <div
                      key={wave.waveIndex}
                      className="bg-slate-900/40 border border-slate-800/80 rounded-xl p-3 space-y-2"
                    >
                      <div className="flex items-center justify-between text-[10px] font-semibold">
                        <span className={wave.waveIndex === 1 ? 'text-sky-400 flex items-center gap-1.5' : 'text-slate-300 flex items-center gap-1.5'}>
                          <Terminal className="w-3 h-3 text-slate-500" />
                          Wave {wave.waveIndex} {wave.waveIndex === 1 ? '(Direct Callers)' : '(Cascading Ripples)'}
                        </span>
                        <span className="bg-slate-800/80 border border-slate-700/50 px-2 py-0.5 rounded text-slate-400 text-[9px]">
                          {filteredWaveFiles.length} files
                        </span>
                      </div>

                      <div className="space-y-1 max-h-40 overflow-y-auto pr-1">
                        {filteredWaveFiles.map((fid) => (
                          <div
                            key={fid}
                            className="flex items-center justify-between p-1.5 rounded-md hover:bg-slate-800/70 text-[10px] text-slate-300 group border border-transparent hover:border-slate-800 transition"
                          >
                            <button
                              type="button"
                              onClick={() => onSelectFile(fid)}
                              className="truncate text-left flex-1 hover:text-sky-300 cursor-pointer font-medium"
                            >
                              {fid}
                            </button>
                            <div className="flex items-center gap-1 shrink-0 opacity-40 group-hover:opacity-100 transition">
                              <a
                                href={getGitHubFileUrl(fid)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-1 hover:text-sky-400 text-slate-400 transition"
                                title="Open on GitHub"
                              >
                                <ExternalLink className="w-3 h-3" />
                              </a>
                              <button
                                type="button"
                                onClick={() => onOpenCodeModal(fid)}
                                className="p-1 hover:text-sky-400 text-slate-400 transition cursor-pointer"
                                title="Inspect Code"
                              >
                                <Code2 className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* 2. Causal Paths Tab */}
            {activeTab === 'causal' && (
              <div className="space-y-2.5">
                {Object.entries(multiBlastReport?.causalPaths || {}).slice(0, 20).map(([targetId, chain]) => (
                  <div
                    key={targetId}
                    className="bg-slate-900/40 border border-slate-800/80 rounded-xl p-3 text-[10px] space-y-2"
                  >
                    <div className="font-semibold text-slate-200 truncate flex items-center justify-between">
                      <span className="truncate pr-2 font-medium" title={targetId}>{targetId}</span>
                      <span className="bg-sky-500/10 border border-sky-500/20 text-sky-400 px-1.5 py-0.5 rounded text-[9px] shrink-0">
                        {chain.length - 1} hops
                      </span>
                    </div>

                    <div className="bg-slate-950/80 p-2.5 rounded-lg border border-slate-800/80 space-y-1.5">
                      {chain.map((hop, idx) => (
                        <div key={idx} className="flex items-center gap-1.5 truncate text-slate-400 text-[10px]">
                          <span className="text-slate-600 text-[9px] w-3.5 shrink-0 font-mono">
                            {idx + 1}.
                          </span>
                          <span
                            className={`truncate ${
                              idx === 0
                                ? 'text-sky-400 font-bold'
                                : idx === chain.length - 1
                                ? 'text-sky-300 font-semibold'
                                : 'text-slate-400'
                            }`}
                            title={hop}
                          >
                            {hop}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* 3. Enterprise Quality Gate Checklist */}
            {activeTab === 'quality' && multiBlastReport && (
              <div className="space-y-3">
                <div
                  className={`p-3.5 rounded-xl border flex items-center gap-3 ${
                    multiBlastReport.qualityGate.canMergeSafely
                      ? 'bg-sky-950/20 border-sky-500/30 text-sky-300'
                      : 'bg-slate-900/60 border-sky-500/30 text-sky-300'
                  }`}
                >
                  {multiBlastReport.qualityGate.canMergeSafely ? (
                    <ShieldCheck className="w-5 h-5 text-sky-400 shrink-0" />
                  ) : (
                    <ShieldAlert className="w-5 h-5 text-sky-400 shrink-0" />
                  )}
                  <div>
                    <div className="font-bold uppercase tracking-wider text-[10px]">
                      {multiBlastReport.qualityGate.canMergeSafely
                        ? 'Passed Architecture Gate'
                        : 'Merge Blocked by Architecture Gate'}
                    </div>
                    <div className="text-[10px] opacity-80 mt-0.5 leading-normal">
                      {multiBlastReport.qualityGate.canMergeSafely
                        ? 'Symbol stability and transitive blast within tolerance.'
                        : 'Symbol changes violate architecture safety boundary.'}
                    </div>
                  </div>
                </div>

                <div className="space-y-2 text-[10px]">
                  <div className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800/80 flex items-center justify-between">
                    <span className="text-slate-300">Public API Surface Exposed</span>
                    {multiBlastReport.qualityGate.breakingApiSurface ? (
                      <span className="text-sky-400 flex items-center gap-1 font-semibold">
                        <AlertOctagon className="w-3.5 h-3.5" /> High Impact
                      </span>
                    ) : (
                      <span className="text-sky-400 flex items-center gap-1 font-semibold">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Safe
                      </span>
                    )}
                  </div>

                  <div className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800/80 flex items-center justify-between">
                    <span className="text-slate-300">High-Centrality God Node</span>
                    {multiBlastReport.qualityGate.highCentralityRisk ? (
                      <span className="text-sky-400 flex items-center gap-1 font-semibold">
                        <XCircle className="w-3.5 h-3.5" /> Critical Symbol
                      </span>
                    ) : (
                      <span className="text-sky-400 flex items-center gap-1 font-semibold">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Normal
                      </span>
                    )}
                  </div>

                  <div className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800/80 flex items-center justify-between">
                    <span className="text-slate-300">Circular Loop Compromised</span>
                    {multiBlastReport.qualityGate.circularDependencyImpact ? (
                      <span className="text-sky-400 flex items-center gap-1 font-semibold">
                        <AlertOctagon className="w-3.5 h-3.5" /> Cyclic Loop
                      </span>
                    ) : (
                      <span className="text-sky-400 flex items-center gap-1 font-semibold">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Clean DAG
                      </span>
                    )}
                  </div>

                  <div className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800/80 flex items-center justify-between">
                    <span className="text-slate-300">Untested Downstream Ratio</span>
                    <span className="text-sky-300 font-bold">
                      {(multiBlastReport.qualityGate.untestedFilesRatio * 100).toFixed(0)}%
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </aside>
  );
}

