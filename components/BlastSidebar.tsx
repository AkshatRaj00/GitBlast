'use client';
import React, { useState } from 'react';
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
  ArrowRight,
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

  if (!graph) {
    return (
      <aside className="w-88 bg-[#020617] border-l border-slate-800 p-4 text-slate-500 font-mono text-xs">
        No active repository telemetry.
      </aside>
    );
  }

  const getGitHubFileUrl = (filePath: string) => {
    const rawRepo = graph.repoName.replace(/^https?:\/\/github\.com\//, '').replace(/\.git$/, '');
    return `https://github.com/${rawRepo}/blob/main/${filePath}`;
  };

  const handleCopyMarkdownReport = () => {
    if (!multiBlastReport) return;
    const text = `### ⚡ GitBlast Architectural Impact Analysis
- **Status:** ${multiBlastReport.severity} RISK (${multiBlastReport.blastPercentage}% Impact)
- **Files Modified:** \`${selectedFileIds.join('`, `')}\`
- **Downstream Breakage:** ${multiBlastReport.totalImpactedCount} / ${graph.totalFiles} files
- **Quality Gate:** ${multiBlastReport.qualityGate.canMergeSafely ? '✅ PASSED' : '❌ BLOCKED'}
- **Crossfire Conflicts:** ${multiBlastReport.crossfireFiles.length} files`;

    navigator.clipboard.writeText(text);
    setCopiedReport(true);
    setTimeout(() => setCopiedReport(false), 2000);
  };

  const severityStyles = {
    CRITICAL: 'bg-red-500/20 text-red-400 border-red-500/50',
    HIGH: 'bg-orange-500/20 text-orange-400 border-orange-500/50',
    MODERATE: 'bg-amber-500/20 text-amber-300 border-amber-500/50',
    LOW: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50',
  }[multiBlastReport?.severity || 'LOW'];

  return (
    <aside className="w-88 bg-[#020617] border-l border-slate-800 flex flex-col h-full overflow-hidden select-none shrink-0 font-mono text-xs">
      
      {/* 1. Header Toolbar */}
      <div className="p-3 border-b border-slate-800/80 bg-slate-950/60 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <GitPullRequest className="w-4 h-4 text-sky-400" />
          <span className="font-bold text-slate-200">
            {isPrMode ? 'PR Blast Simulator' : 'Blast Radius Engine'}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          {multiBlastReport && (
            <button
              type="button"
              onClick={handleCopyMarkdownReport}
              className="p-1 rounded bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 transition cursor-pointer"
              title="Copy PR Markdown Comment"
            >
              {copiedReport ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          )}
          <button
            type="button"
            onClick={onTogglePrMode}
            className={`px-2 py-0.5 rounded text-[10px] border transition cursor-pointer ${
              isPrMode
                ? 'bg-sky-500/20 border-sky-500/50 text-sky-300 font-bold'
                : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            {isPrMode ? 'Exit PR' : 'Simulate PR +'}
          </button>
        </div>
      </div>

      {selectedFileIds.length === 0 ? (
        <div className="p-6 flex-1 flex flex-col items-center justify-center text-center">
          <div className="w-10 h-10 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center mb-2.5">
            <Flame className="w-5 h-5 text-slate-600" />
          </div>
          <h4 className="font-bold text-slate-300 text-xs">Zero Epicenters Selected</h4>
          <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
            Click any neuron on canvas to calculate its downstream breakages.
          </p>
        </div>
      ) : (
        <>
          {/* Modified Target Files */}
          <div className="p-3 border-b border-slate-800/80 bg-slate-950/40">
            <div className="text-[10px] uppercase text-slate-400 flex items-center justify-between mb-1.5">
              <span>Modified Files ({selectedFileIds.length})</span>
              {multiBlastReport && (
                <span className={`px-1.5 py-0.2 rounded border text-[9px] font-bold ${severityStyles}`}>
                  {multiBlastReport.severity} RISK
                </span>
              )}
            </div>

            <div className="space-y-1 max-h-28 overflow-y-auto pr-1">
              {selectedFileIds.map((fid) => (
                <div
                  key={fid}
                  className="flex items-center justify-between p-1.5 rounded-lg bg-slate-900/80 border border-slate-800 text-[11px]"
                >
                  <span className="truncate pr-2 text-slate-200" title={fid}>
                    {fid}
                  </span>
                  <div className="flex items-center gap-1 shrink-0">
                    <a
                      href={getGitHubFileUrl(fid)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1 hover:text-sky-400 text-slate-500 transition"
                      title="Open on GitHub"
                    >
                      <ExternalLink className="w-3 h-3" />
                    </a>
                    <button
                      type="button"
                      onClick={() => onOpenCodeModal(fid)}
                      className="p-1 hover:text-emerald-400 text-slate-500 transition cursor-pointer"
                      title="Inspect AST Code"
                    >
                      <Code2 className="w-3 h-3" />
                    </button>
                    {isPrMode && (
                      <button
                        type="button"
                        onClick={() => onRemoveSelectedFile(fid)}
                        className="p-1 hover:text-red-400 text-slate-500 transition cursor-pointer"
                        title="Remove from PR"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Real Metrics Gauge */}
          {multiBlastReport && (
            <div className="p-3.5 border-b border-slate-800/80 bg-slate-900/30">
              <div className="flex items-baseline justify-between">
                <div>
                  <div className="text-[9px] text-slate-400 uppercase tracking-wider">Total Blast Radius</div>
                  <div className="text-2xl font-black text-red-500 mt-0.5">
                    {multiBlastReport.blastPercentage}%
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs font-bold text-slate-200">
                    {multiBlastReport.totalImpactedCount} / {Math.max(1, graph.totalFiles - selectedFileIds.length)}
                  </div>
                  <div className="text-[9px] text-slate-400">Files Compromised</div>
                </div>
              </div>

              <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden mt-2">
                <div
                  className="h-full bg-gradient-to-r from-orange-500 to-red-600 transition-all duration-300"
                  style={{ width: `${Math.min(100, multiBlastReport.blastPercentage)}%` }}
                />
              </div>

              {multiBlastReport.crossfireFiles.length > 0 && (
                <div className="mt-2.5 p-2 rounded-lg bg-red-950/30 border border-red-500/40 text-[10px] text-red-300 flex items-start gap-1.5">
                  <AlertOctagon className="w-3.5 h-3.5 text-red-400 shrink-0 mt-0.5" />
                  <div>
                    <strong>Crossfire Warning!</strong> {multiBlastReport.crossfireFiles.length} files rely on multiple modified targets.
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Navigation Tabs */}
          <div className="flex border-b border-slate-800 bg-[#020617] text-[10px]">
            <button
              type="button"
              onClick={() => setActiveTab('waves')}
              className={`flex-1 py-2 text-center border-b-2 transition cursor-pointer ${
                activeTab === 'waves'
                  ? 'border-red-500 text-red-400 font-bold bg-slate-900/40'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              Waves ({multiBlastReport?.waves.length || 0})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('causal')}
              className={`flex-1 py-2 text-center border-b-2 transition cursor-pointer ${
                activeTab === 'causal'
                  ? 'border-sky-500 text-sky-400 font-bold bg-slate-900/40'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              Causal Paths
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('quality')}
              className={`flex-1 py-2 text-center border-b-2 transition cursor-pointer ${
                activeTab === 'quality'
                  ? 'border-emerald-500 text-emerald-400 font-bold bg-slate-900/40'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              Quality Gate
            </button>
          </div>

          {/* TAB CONTENT */}
          <div className="flex-1 overflow-y-auto p-3">
            
            {/* 1. Waves with Live Search */}
            {activeTab === 'waves' && (
              <div className="space-y-3">
                <div className="relative flex items-center">
                  <Search className="w-3 h-3 text-slate-500 absolute left-2.5 pointer-events-none" />
                  <input
                    type="text"
                    value={waveSearch}
                    onChange={(e) => setWaveSearch(e.target.value)}
                    placeholder="Search impacted files..."
                    className="w-full bg-slate-900 text-slate-200 text-[10px] pl-7 pr-2 py-1 rounded-lg border border-slate-800 focus:outline-none"
                  />
                </div>

                {multiBlastReport?.waves.map((wave) => {
                  const filteredWaveFiles = wave.fileIds.filter((fid) =>
                    fid.toLowerCase().includes(waveSearch.toLowerCase())
                  );
                  if (filteredWaveFiles.length === 0) return null;

                  return (
                    <div key={wave.waveIndex} className="bg-slate-900/70 border border-slate-800 rounded-xl p-2.5">
                      <div className="flex items-center justify-between text-[10px] mb-1.5 font-bold">
                        <span className={wave.waveIndex === 1 ? 'text-orange-400' : 'text-amber-300'}>
                          Wave {wave.waveIndex} {wave.waveIndex === 1 ? '(Direct Callers)' : '(Cascade Ripple)'}
                        </span>
                        <span className="bg-slate-800 px-1.5 py-0.2 rounded text-slate-400">
                          {filteredWaveFiles.length} files
                        </span>
                      </div>

                      <div className="space-y-1 max-h-36 overflow-y-auto pr-1">
                        {filteredWaveFiles.map((fid) => (
                          <div
                            key={fid}
                            className="flex items-center justify-between p-1 rounded hover:bg-slate-800 text-[10px] text-slate-300 group"
                          >
                            <button
                              type="button"
                              onClick={() => onSelectFile(fid)}
                              className="truncate text-left flex-1 hover:text-red-300 cursor-pointer"
                            >
                              {fid}
                            </button>
                            <div className="flex items-center gap-1 shrink-0 opacity-70 group-hover:opacity-100">
                              <a
                                href={getGitHubFileUrl(fid)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-0.5 hover:text-sky-400 text-slate-500"
                                title="Open on GitHub"
                              >
                                <ExternalLink className="w-2.5 h-2.5" />
                              </a>
                              <button
                                type="button"
                                onClick={() => onOpenCodeModal(fid)}
                                className="p-0.5 hover:text-emerald-400 text-slate-500 cursor-pointer"
                                title="Code"
                              >
                                <Code2 className="w-2.5 h-2.5" />
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

            {/* 2. Causal Breadcrumb Paths */}
            {activeTab === 'causal' && (
              <div className="space-y-2">
                {Object.entries(multiBlastReport?.causalPaths || {}).slice(0, 15).map(([targetId, chain]) => (
                  <div key={targetId} className="bg-slate-900/80 border border-slate-800 rounded-xl p-2.5 text-[10px]">
                    <div className="font-bold text-slate-200 truncate mb-1 flex items-center justify-between">
                      <span className="truncate">{targetId}</span>
                      <span className="bg-sky-500/10 text-sky-400 px-1.5 rounded">{chain.length - 1} hops</span>
                    </div>
                    <div className="bg-slate-950 p-2 rounded border border-slate-800/80 space-y-1">
                      {chain.map((hop, idx) => (
                        <div key={idx} className="flex items-center gap-1 truncate text-slate-400">
                          <span className="text-slate-600 text-[9px] w-3">{idx + 1}.</span>
                          <span className={idx === 0 ? 'text-red-400 font-bold' : idx === chain.length - 1 ? 'text-amber-300 font-semibold' : ''}>
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
              <div className="space-y-2.5">
                <div
                  className={`p-3 rounded-xl border flex items-center gap-2 ${
                    multiBlastReport.qualityGate.canMergeSafely
                      ? 'bg-emerald-950/20 border-emerald-500/40 text-emerald-300'
                      : 'bg-red-950/20 border-red-500/40 text-red-300'
                  }`}
                >
                  {multiBlastReport.qualityGate.canMergeSafely ? (
                    <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                  ) : (
                    <ShieldAlert className="w-4 h-4 text-red-400 shrink-0" />
                  )}
                  <div>
                    <div className="font-bold uppercase text-[10px]">
                      {multiBlastReport.qualityGate.canMergeSafely ? 'Passed Quality Gate' : 'Merge Blocked by Policy'}
                    </div>
                    <div className="text-[9px] opacity-80 mt-0.5">
                      {multiBlastReport.qualityGate.canMergeSafely
                        ? 'Architecture integrity intact.'
                        : 'High blast radius or critical core nodes compromised.'}
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5 text-[10px]">
                  <div className="p-2 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-between">
                    <span className="text-slate-300">Public API Surface Exposed</span>
                    {multiBlastReport.qualityGate.breakingApiSurface ? (
                      <span className="text-amber-400 flex items-center gap-1">
                        <AlertOctagon className="w-3 h-3" /> High Impact
                      </span>
                    ) : (
                      <span className="text-emerald-400 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> Safe
                      </span>
                    )}
                  </div>

                  <div className="p-2 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-between">
                    <span className="text-slate-300">High-PageRank Centrality File</span>
                    {multiBlastReport.qualityGate.highCentralityRisk ? (
                      <span className="text-red-400 flex items-center gap-1">
                        <XCircle className="w-3 h-3" /> Critical Node
                      </span>
                    ) : (
                      <span className="text-emerald-400 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> Normal
                      </span>
                    )}
                  </div>

                  <div className="p-2 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-between">
                    <span className="text-slate-300">Circular Loop Compromised</span>
                    {multiBlastReport.qualityGate.circularDependencyImpact ? (
                      <span className="text-purple-400 flex items-center gap-1">
                        <AlertOctagon className="w-3 h-3" /> In Loop
                      </span>
                    ) : (
                      <span className="text-emerald-400 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> Clean DAG
                      </span>
                    )}
                  </div>

                  <div className="p-2 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-between">
                    <span className="text-slate-300">Untested Downstream Code</span>
                    <span className="text-amber-300 font-bold">
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
