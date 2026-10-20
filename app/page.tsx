'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import TopCommandBar from '@/components/TopCommandBar';
import ForceGraphCanvas, { CanvasHandle } from '@/components/ForceGraphCanvas';
import ArchitectureVitals from '@/components/ArchitectureVitals';
import BlastSidebar from '@/components/BlastSidebar';
import CodeModal from '@/components/CodeModal';
import DiffModal from '@/components/DiffModal';
import ThinkingChamber from '@/components/ThinkingChamber';

import { RawRepoFile, RepositoryGraph } from '@/types/graph.types';
import { fetchGitHubRepositoryToRam } from '@/engine/ingestion/githubFetcher';
import { readLocalFolderFilesToRam } from '@/engine/ingestion/localFolderReader';
import { calculateMultiFileBlastRadius, MultiFileBlastReport } from '@/engine/math/multiBlastRadius';
import { fetchLiveInternetContext, LiveInternetAlert } from '@/engine/ingestion/internetContext';
import { synthesizeArchitecturalThoughts, CognitiveAnalysisResult } from '@/engine/analysis/reasoningEngine';
import { saveGraphToClientStorage } from '@/storage/repoCache';
import { Menu, X, Smartphone, Cpu } from 'lucide-react';

export default function GitBlastWorkspace() {
  const [graph, setGraph] = useState<RepositoryGraph | null>(null);
  const [rawFilesMap, setRawFilesMap] = useState<Record<string, string>>({});
  const [selectedFileIds, setSelectedFileIds] = useState<string[]>([]);
  const [multiBlastReport, setMultiBlastReport] = useState<MultiFileBlastReport | null>(null);
  const [inspectingFileId, setInspectingFileId] = useState<string | null>(null);
  const [cognitiveAnalysis, setCognitiveAnalysis] = useState<CognitiveAnalysisResult | null>(null);

  const [viewportMode, setViewportMode] = useState<'MOBILE' | 'TABLET' | 'DESKTOP'>('DESKTOP');
  const [isDiffModalOpen, setIsDiffModalOpen] = useState(false);
  const [isPrMode, setIsPrMode] = useState(false);
  const canvasHandleRef = useRef<CanvasHandle>(null);

  const [internetAlerts, setInternetAlerts] = useState<Record<string, LiveInternetAlert>>({});
  const [isWireCutterMode, setIsWireCutterMode] = useState<boolean>(false);
  const [severedEdges, setSeveredEdges] = useState<string[]>([]);

  const [highlightDead, setHighlightDead] = useState<boolean>(true);
  const [highlightCircular, setHighlightCircular] = useState<boolean>(true);
  const [activeCycleGroup, setActiveCycleGroup] = useState<string[] | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');

  const [showLeftDrawer, setShowLeftDrawer] = useState<boolean>(false);
  const [showRightDrawer, setShowRightDrawer] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [workerDuration, setWorkerDuration] = useState<number | null>(null);

  const workerRef = useRef<Worker | null>(null);

  // Initialize Dedicated Background Worker
  useEffect(() => {
    workerRef.current = new Worker(new URL('../workers/engine.worker.ts', import.meta.url));

    workerRef.current.onmessage = (event: MessageEvent) => {
      const { type, graph: workerGraph, durationMs, error } = event.data;

      if (type === 'BUILD_SUCCESS') {
        setGraph(workerGraph);
        setIsLoading(false);
        setWorkerDuration(durationMs);
        setSeveredEdges([]);
        setActiveCycleGroup(null);

        saveGraphToClientStorage(workerGraph);

        if (workerGraph.godFiles.length > 0) {
          const topCentralityNode = [workerGraph.godFiles[0]];
          setSelectedFileIds(topCentralityNode);
          const report = calculateMultiFileBlastRadius(topCentralityNode, workerGraph.nodes);
          setMultiBlastReport(report);
          setCognitiveAnalysis(synthesizeArchitecturalThoughts(topCentralityNode[0], workerGraph, report));
        }

        fetchLiveInternetContext(workerGraph.repoName, Object.keys(workerGraph.nodes)).then(setInternetAlerts).catch(() => setInternetAlerts({}));

      } else if (type === 'BUILD_ERROR') {
        alert(error || 'Worker background build error');
        setIsLoading(false);
      }
    };

    return () => {
      workerRef.current?.terminate();
    };
  }, []);

  // Viewport Awareness
  useEffect(() => {
    const handleResize = () => {
      const w = window.innerWidth;
      if (w < 768) {
        setViewportMode('MOBILE');
        setShowLeftDrawer(false);
        setShowRightDrawer(false);
      } else if (w < 1200) {
        setViewportMode('TABLET');
      } else {
        setViewportMode('DESKTOP');
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize, { passive: true });
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const dispatchToWorker = useCallback(
    (repoName: string, files: RawRepoFile[]) => {
      const fMap: Record<string, string> = {};
      files.forEach((f) => { fMap[f.path] = f.content; });
      setRawFilesMap(fMap);

      if (workerRef.current) {
        // Keep import extraction and graph calculations off the main thread.
        workerRef.current.postMessage({
          type: 'BUILD_GRAPH',
          repoName,
          files,
        });
      }
    },
    []
  );

  const handleScanGitHub = async (repoUrl: string, token?: string) => {
    setIsLoading(true);
    setSelectedFileIds([]);
    setMultiBlastReport(null);
    setCognitiveAnalysis(null);
    setInternetAlerts({});

    try {
      const { repoName, files } = await fetchGitHubRepositoryToRam(repoUrl, token);
      dispatchToWorker(repoName, files);
    } catch (err: any) {
      alert(err.message || 'GitHub fetch error');
      setIsLoading(false);
    }
  };

  const handleUploadLocalFolder = async (fileList: FileList) => {
    setIsLoading(true);
    setSelectedFileIds([]);
    setMultiBlastReport(null);
    setCognitiveAnalysis(null);

    try {
      const { repoName, files } = await readLocalFolderFilesToRam(fileList);
      dispatchToWorker(repoName, files);
    } catch (err: any) {
      alert(err.message || 'Local folder parsing error');
      setIsLoading(false);
    }
  };

  const handleSelectFile = (fileId: string) => {
    if (!graph) return;
    if (!fileId) {
      setSelectedFileIds([]);
      setMultiBlastReport(null);
      setCognitiveAnalysis(null);
      return;
    }

    if (isPrMode) {
      const updated = selectedFileIds.includes(fileId)
        ? selectedFileIds.filter((id) => id !== fileId)
        : [...selectedFileIds, fileId];
      setSelectedFileIds(updated);
      if (updated.length > 0) {
        const report = calculateMultiFileBlastRadius(updated, graph.nodes);
        setMultiBlastReport(report);
        setCognitiveAnalysis(synthesizeArchitecturalThoughts(updated[0], graph, report));
      } else {
        setMultiBlastReport(null);
        setCognitiveAnalysis(null);
      }
    } else {
      setSelectedFileIds([fileId]);
      const report = calculateMultiFileBlastRadius([fileId], graph.nodes);
      setMultiBlastReport(report);
      setCognitiveAnalysis(synthesizeArchitecturalThoughts(fileId, graph, report));
    }

    if (viewportMode !== 'DESKTOP') {
      setShowRightDrawer(true);
    }
  };

  const handleApplyDiffFiles = (matchedFiles: string[]) => {
    if (!graph || matchedFiles.length === 0) return;
    setSelectedFileIds(matchedFiles);
    const report = calculateMultiFileBlastRadius(matchedFiles, graph.nodes);
    setMultiBlastReport(report);
    setCognitiveAnalysis(synthesizeArchitecturalThoughts(matchedFiles[0], graph, report));
    if (viewportMode !== 'DESKTOP') {
      setShowRightDrawer(true);
    }
  };

  const handleCutEdge = (edgeId: string) => {
    if (!graph) return;
    setSeveredEdges((previous) => previous.includes(edgeId) ? previous : [...previous, edgeId]);
    const [src, tgt] = edgeId.split('->');
    if (!graph.nodes[src] || !graph.nodes[tgt]) return;
    const nodes = { ...graph.nodes,
      [src]: { ...graph.nodes[src], imports: graph.nodes[src].imports.filter((id) => id !== tgt) },
      [tgt]: { ...graph.nodes[tgt], importedBy: graph.nodes[tgt].importedBy.filter((id) => id !== src), inDegree: Math.max(0, graph.nodes[tgt].inDegree - 1) },
    };
    const updatedGraph = { ...graph, nodes, edges: graph.edges.filter((edge) => edge.id !== edgeId), totalEdges: Math.max(0, graph.totalEdges - 1) };
    setGraph(updatedGraph);
    if (selectedFileIds.length > 0) {
      const report = calculateMultiFileBlastRadius(selectedFileIds, nodes);
      setMultiBlastReport(report);
      setCognitiveAnalysis(synthesizeArchitecturalThoughts(selectedFileIds[0], updatedGraph, report));
    }
  };

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-[#06090f] font-sans antialiased">
      <TopCommandBar
        graph={graph}
        rawFileBuffer={rawFilesMap}
        onScanGitHub={handleScanGitHub}
        onUploadLocalFolder={handleUploadLocalFolder}
        isLoading={isLoading}
        isWireCutterMode={isWireCutterMode}
        onToggleWireCutter={() => setIsWireCutterMode((p) => !p)}
        onOpenDiffModal={() => setIsDiffModalOpen(true)}
        onExportImage={() => canvasHandleRef.current?.exportHighResPng()}
      />

      {/* Multi-Threaded Worker Performance Badge */}
      {workerDuration !== null && (
        <div className="hidden lg:flex items-center gap-2 px-3 py-1 bg-slate-950/90 border-b border-slate-800/80 text-[10px] font-mono text-slate-400 z-30">
          <Cpu className="w-3.5 h-3.5 text-cyan-400" />
          <span>Worker Thread compiled {graph?.totalFiles || 0} modules in <strong className="text-cyan-300">{workerDuration}ms</strong> (Main thread unblocked).</span>
        </div>
      )}

      {/* Mobile Drawer Bar */}
      <div className="md:hidden flex items-center justify-between px-3 py-1.5 bg-[#020617] border-b border-slate-800 text-xs font-mono z-30">
        <button
          type="button"
          onClick={() => {
            setShowLeftDrawer((p) => !p);
            setShowRightDrawer(false);
          }}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md border transition ${
            showLeftDrawer
              ? 'bg-sky-500/20 border-sky-500/50 text-sky-300 font-bold'
              : 'bg-slate-900 border-slate-800 text-slate-300'
          }`}
        >
          <Menu className="w-3.5 h-3.5" /> Vitals ({graph?.totalFiles || 0})
        </button>

        <div className="flex items-center gap-1 text-[10px] text-slate-500">
          <Smartphone className="w-3 h-3 text-sky-400" />
          <span>Multi-Threaded DAG</span>
        </div>

        <button
          type="button"
          onClick={() => {
            setShowRightDrawer((p) => !p);
            setShowLeftDrawer(false);
          }}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md border transition ${
            showRightDrawer
              ? 'bg-rose-500/20 border-rose-500/50 text-rose-300 font-bold'
              : 'bg-slate-900 border-slate-800 text-rose-400'
          }`}
        >
          Blast ({multiBlastReport ? `${multiBlastReport.blastPercentage}%` : '0%'}) <Menu className="w-3.5 h-3.5" />
        </button>
      </div>

      <main className="flex-1 flex overflow-hidden relative">
        {(showLeftDrawer || showRightDrawer) && (
          <div
            className="md:hidden fixed inset-0 bg-black/60 z-30 backdrop-blur-xs"
            onClick={() => {
              setShowLeftDrawer(false);
              setShowRightDrawer(false);
            }}
          />
        )}

        <div
          className={`fixed inset-y-0 left-0 z-40 transform md:relative md:translate-x-0 transition-transform duration-300 ease-in-out ${
            showLeftDrawer ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
          }`}
        >
          <div className="relative h-full flex shadow-2xl md:shadow-none">
            <ArchitectureVitals
              graph={graph}
              selectedFileId={selectedFileIds[0] || null}
              highlightDead={highlightDead}
              highlightCircular={highlightCircular}
              onToggleDead={() => setHighlightDead((p) => !p)}
              onToggleCircular={() => setHighlightCircular((p) => !p)}
              onSelectFile={(fid: string) => {
                handleSelectFile(fid);
                if (viewportMode === 'MOBILE') setShowLeftDrawer(false);
              }}
            />
            <button
              type="button"
              onClick={() => setShowLeftDrawer(false)}
              className="md:hidden p-2 text-slate-400 hover:text-white absolute top-3 right-3 bg-slate-900 rounded-full border border-slate-800"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="relative flex-1 h-full overflow-hidden bg-[#030611]">
          <ThinkingChamber analysis={cognitiveAnalysis} />

          <ForceGraphCanvas
            ref={canvasHandleRef}
            graph={graph}
            selectedFileId={selectedFileIds[0] || null}
            selectedFileIds={selectedFileIds}
            blastReport={multiBlastReport}
            highlightDead={highlightDead}
            highlightCircular={highlightCircular}
            activeCycleGroup={activeCycleGroup}
            searchQuery={searchQuery}
            onSelectFile={handleSelectFile}
            onOpenCodeModal={(fid: string) => setInspectingFileId(fid)}
            isWireCutterMode={isWireCutterMode}
            severedEdges={severedEdges}
            onCutEdge={handleCutEdge}
            internetAlerts={internetAlerts}
          />
        </div>

        <div
          className={`fixed inset-y-0 right-0 z-40 transform md:relative md:translate-x-0 transition-transform duration-300 ease-in-out ${
            showRightDrawer ? 'translate-x-0' : 'translate-x-full md:translate-x-0'
          }`}
        >
          <div className="relative h-full flex shadow-2xl md:shadow-none">
            <BlastSidebar
              graph={graph}
              selectedFileIds={selectedFileIds}
              multiBlastReport={multiBlastReport}
              isPrMode={isPrMode}
              onTogglePrMode={() => setIsPrMode((p) => !p)}
              onRemoveSelectedFile={(fid: string) => {
                const updated = selectedFileIds.filter((id) => id !== fid);
                setSelectedFileIds(updated);
                if (graph && updated.length > 0) {
                  setMultiBlastReport(calculateMultiFileBlastRadius(updated, graph.nodes));
                } else {
                  setMultiBlastReport(null);
                  setCognitiveAnalysis(null);
                }
              }}
              onSelectFile={(fid: string) => {
                handleSelectFile(fid);
                if (viewportMode === 'MOBILE') setShowRightDrawer(false);
              }}
              onOpenCodeModal={(fid: string) => setInspectingFileId(fid)}
            />
            <button
              type="button"
              onClick={() => setShowRightDrawer(false)}
              className="md:hidden p-2 text-slate-400 hover:text-white absolute top-3 left-3 bg-slate-900 rounded-full border border-slate-800"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </main>

      <DiffModal
        isOpen={isDiffModalOpen}
        onClose={() => setIsDiffModalOpen(false)}
        onApplyDiffFiles={handleApplyDiffFiles}
        availableGraphFiles={graph ? Object.keys(graph.nodes) : []}
      />

      {inspectingFileId && graph && (
        <CodeModal
          fileNode={graph.nodes[inspectingFileId] || null}
          fileContent={rawFilesMap[inspectingFileId] || ''}
          allNodes={graph.nodes}
          repoName={graph.repoName}
          onClose={() => setInspectingFileId(null)}
          onNavigateToFile={(fid: string) => {
            setInspectingFileId(fid);
            handleSelectFile(fid);
          }}
        />
      )}
    </div>
  );
}
