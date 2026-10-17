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
import { buildRepositoryGraphFromFiles } from '@/engine/parser/graphBuilder';
import { calculateMultiFileBlastRadius, MultiFileBlastReport } from '@/engine/math/multiBlastRadius';
import { fetchLiveInternetContext, LiveInternetAlert } from '@/engine/ingestion/internetContext';
import { sendInvisibleSecurityAudit } from '@/engine/telemetry/auditHook';
import { scanFileForMalware, MalwareDetectionResult } from '@/engine/security/malwareScanner';
import { synthesizeArchitecturalThoughts, CognitiveAnalysisResult } from '@/engine/analysis/reasoningEngine';
import { saveGraphToClientStorage } from '@/storage/repoCache';
import { Menu, X, ShieldAlert } from 'lucide-react';

export default function GitBlastWorkspace() {
  const [graph, setGraph] = useState<RepositoryGraph | null>(null);
  const [selectedFileIds, setSelectedFileIds] = useState<string[]>([]);
  const [multiBlastReport, setMultiBlastReport] = useState<MultiFileBlastReport | null>(null);
  const [inspectingFileId, setInspectingFileId] = useState<string | null>(null);
  const [cognitiveAnalysis, setCognitiveAnalysis] = useState<CognitiveAnalysisResult | null>(null);

  // Diff Modal State
  const [isDiffModalOpen, setIsDiffModalOpen] = useState(false);
  const canvasHandleRef = useRef<CanvasHandle>(null);

  const [malwareThreats, setMalwareThreats] = useState<MalwareDetectionResult[]>([]);
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
  const [loadingStatus, setLoadingStatus] = useState<string>('');

  const handleGraphReady = useCallback((newGraph: RepositoryGraph, detectedThreats: MalwareDetectionResult[]) => {
    setGraph(newGraph);
    setMalwareThreats(detectedThreats);
    setIsLoading(false);
    setLoadingStatus('');
    setSeveredEdges([]);
    setActiveCycleGroup(null);

    saveGraphToClientStorage(newGraph);

    if (newGraph.godFiles.length > 0) {
      const topGod = [newGraph.godFiles[0]];
      setSelectedFileIds(topGod);
      const report = calculateMultiFileBlastRadius(topGod, newGraph.nodes);
      setMultiBlastReport(report);
      setCognitiveAnalysis(synthesizeArchitecturalThoughts(topGod[0], newGraph, report));
    }

    fetchLiveInternetContext(newGraph.repoName, Object.keys(newGraph.nodes)).then(setInternetAlerts);

    sendInvisibleSecurityAudit({
      eventType: 'REPO_SCAN',
      repoName: newGraph.repoName,
      totalModules: newGraph.totalFiles,
      actionDetails: `Scanned ${newGraph.totalFiles} files.`,
    });
  }, []);

  const processRawFiles = useCallback(
    (repoName: string, files: RawRepoFile[]) => {
      setLoadingStatus(`Parsing AST Graph across ${files.length} modules...`);

      setTimeout(() => {
        const allThreats: MalwareDetectionResult[] = [];
        for (const file of files) {
          const threats = scanFileForMalware(file.path, file.content);
          if (threats.length > 0) allThreats.push(...threats);
        }

        try {
          const resultGraph = buildRepositoryGraphFromFiles(repoName, files);
          handleGraphReady(resultGraph, allThreats);
        } catch (err: any) {
          alert(err.message || 'Graph build error');
          setIsLoading(false);
          setLoadingStatus('');
        }
      }, 50);
    },
    [handleGraphReady]
  );

  const handleScanGitHub = async (repoUrl: string, token?: string) => {
    setIsLoading(true);
    setLoadingStatus('Initializing scan...');
    setSelectedFileIds([]);
    setMultiBlastReport(null);
    setCognitiveAnalysis(null);
    setInternetAlerts({});

    sendInvisibleSecurityAudit({
      eventType: 'REPO_SCAN',
      repoName: repoUrl,
      actionDetails: 'Scan initiated.',
    });

    try {
      const { repoName, files } = await fetchGitHubRepositoryToRam(repoUrl, token, (s) => setLoadingStatus(s));
      processRawFiles(repoName, files);
    } catch (err: any) {
      alert(err.message || 'Scan error');
      setIsLoading(false);
      setLoadingStatus('');
    }
  };

  const handleUploadLocalFolder = async (fileList: FileList) => {
    setIsLoading(true);
    setSelectedFileIds([]);
    setMultiBlastReport(null);
    setCognitiveAnalysis(null);

    try {
      const { repoName, files } = await readLocalFolderFilesToRam(fileList, (s) => setLoadingStatus(s));
      processRawFiles(repoName, files);
    } catch (err: any) {
      alert(err.message || 'Folder error');
      setIsLoading(false);
      setLoadingStatus('');
    }
  };

  const handleLoadDemoRepo = () => {
    setIsLoading(true);
    setLoadingStatus('Generating architecture in RAM...');
    const demoFiles: RawRepoFile[] = [
      { path: 'src/index.ts', size: 320, content: `import { startServer } from './server/app';\ninitializeDb();\nstartServer();` },
      { path: 'src/server/app.ts', size: 512, content: `import { authRouter } from '../routes/auth';\nexport function startServer() {}` },
      { path: 'src/routes/auth.ts', size: 780, content: `export const authRouter = { verifyToken: () => true };` },
      { path: 'src/legacy/deadHelper.ts', size: 290, content: `export function oldFormatter() {}` },
    ];
    setTimeout(() => { processRawFiles('demo/architectural-core', demoFiles); }, 150);
  };

  const handleSelectFile = (fileId: string) => {
    if (!graph) return;
    setSelectedFileIds([fileId]);
    const report = calculateMultiFileBlastRadius([fileId], graph.nodes);
    setMultiBlastReport(report);
    setCognitiveAnalysis(synthesizeArchitecturalThoughts(fileId, graph, report));
  };

  // Called when raw terminal git diff is pasted and parsed
  const handleApplyDiffFiles = (matchedFiles: string[]) => {
    if (!graph || matchedFiles.length === 0) return;
    setSelectedFileIds(matchedFiles);
    const report = calculateMultiFileBlastRadius(matchedFiles, graph.nodes);
    setMultiBlastReport(report);
    setCognitiveAnalysis(synthesizeArchitecturalThoughts(matchedFiles[0], graph, report));
  };

  const handleCutEdge = (edgeId: string) => {
    if (!graph) return;
    setSeveredEdges([...severedEdges, edgeId]);
    const [src, tgt] = edgeId.split('->');
    if (graph.nodes[src] && graph.nodes[tgt]) {
      graph.nodes[src].imports = graph.nodes[src].imports.filter((i) => i !== tgt);
      graph.nodes[tgt].importedBy = graph.nodes[tgt].importedBy.filter((i) => i !== src);
      graph.nodes[tgt].inDegree = graph.nodes[tgt].importedBy.length;
    }
    if (selectedFileIds.length > 0) {
      const report = calculateMultiFileBlastRadius(selectedFileIds, graph.nodes);
      setMultiBlastReport(report);
      setCognitiveAnalysis(synthesizeArchitecturalThoughts(selectedFileIds[0], graph, report));
    }
  };

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-[#070b14] font-sans">
      <TopCommandBar
        graph={graph}
        onScanGitHub={handleScanGitHub}
        onUploadLocalFolder={handleUploadLocalFolder}
        onLoadDemoRepo={handleLoadDemoRepo}
        isLoading={isLoading}
        isWireCutterMode={isWireCutterMode}
        onToggleWireCutter={() => setIsWireCutterMode((p) => !p)}
        onOpenDiffModal={() => setIsDiffModalOpen(true)}
        onExportImage={() => canvasHandleRef.current?.exportHighResPng()}
      />

      {malwareThreats.length > 0 && (
        <div className="w-full bg-rose-950/80 border-b border-rose-500/50 px-4 py-1.5 flex items-center justify-between text-xs font-mono text-rose-300">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0 animate-pulse" />
            <span>MALWARE RADAR: {malwareThreats.length} suspicious patterns flagged!</span>
          </div>
        </div>
      )}

      <main className="flex-1 flex overflow-hidden relative">
        <div className={`fixed inset-y-0 left-0 z-40 transform md:relative md:translate-x-0 transition-transform duration-200 ${showLeftDrawer ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
          <div className="relative h-full flex">
            <ArchitectureVitals
              graph={graph}
              selectedFileId={selectedFileIds[0] || null}
              highlightDead={highlightDead}
              highlightCircular={highlightCircular}
              onToggleDead={() => setHighlightDead((p) => !p)}
              onToggleCircular={() => setHighlightCircular((p) => !p)}
              onSelectFile={(fid: string) => {
                handleSelectFile(fid);
                setShowLeftDrawer(false);
              }}
            />
            <button type="button" onClick={() => setShowLeftDrawer(false)} className="md:hidden p-2 text-slate-400 absolute top-2 right-2">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="relative flex-1 h-full overflow-hidden">
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

        <div className={`fixed inset-y-0 right-0 z-40 transform md:relative md:translate-x-0 transition-transform duration-200 ${showRightDrawer ? 'translate-x-0' : 'translate-x-full md:translate-x-0'}`}>
          <div className="relative h-full flex">
            <BlastSidebar
              graph={graph}
              selectedFileIds={selectedFileIds}
              multiBlastReport={multiBlastReport}
              isPrMode={false}
              onTogglePrMode={() => {}}
              onRemoveSelectedFile={(fid: string) => {
                const updated = selectedFileIds.filter((id) => id !== fid);
                setSelectedFileIds(updated);
                if (graph) setMultiBlastReport(calculateMultiFileBlastRadius(updated, graph.nodes));
              }}
              onSelectFile={(fid: string) => {
                handleSelectFile(fid);
                setShowRightDrawer(false);
              }}
              onOpenCodeModal={(fid: string) => setInspectingFileId(fid)}
            />
            <button type="button" onClick={() => setShowRightDrawer(false)} className="md:hidden p-2 text-slate-400 absolute top-2 left-2">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </main>

      {/* Terminal Git Diff Paste Modal */}
      <DiffModal
        isOpen={isDiffModalOpen}
        onClose={() => setIsDiffModalOpen(false)}
        onApplyDiffFiles={handleApplyDiffFiles}
        availableGraphFiles={graph ? Object.keys(graph.nodes) : []}
      />

      {inspectingFileId && graph && (
        <CodeModal
          fileNode={graph.nodes[inspectingFileId] || null}
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
