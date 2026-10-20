'use client';

import React, { useRef, useState } from 'react';
import {
  Zap,
  FolderOpen,
  Loader2,
  Download,
  FileText,
  FileCode,
  Check,
  Scissors,
  Camera,
  GitCommit,
  MoreVertical,
} from 'lucide-react';
import { RepositoryGraph } from '@/types/graph.types';
import {
  generatePrunedRepoZip,
  generateArchitectureMarkdown,
  generateGitHubActionYaml,
} from '@/engine/analysis/repoPruner';
import RealNetworkTelemetry from './LivePresenceBadge';

function GitHubIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24">
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
      />
    </svg>
  );
}

interface TopCommandBarProps {
  graph: RepositoryGraph | null;
  onScanGitHub: (repoUrl: string, token?: string) => void;
  onUploadLocalFolder: (files: FileList) => void;
  isLoading: boolean;
  isWireCutterMode: boolean;
  onToggleWireCutter: () => void;
  onOpenDiffModal: () => void;
  onExportImage: () => void;
}

export default function TopCommandBar({
  graph,
  onScanGitHub,
  onUploadLocalFolder,
  isLoading,
  isWireCutterMode,
  onToggleWireCutter,
  onOpenDiffModal,
  onExportImage,
}: TopCommandBarProps) {
  const [repoInput, setRepoInput] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  const [copiedDoc, setCopiedDoc] = useState(false);
  const [copiedYaml, setCopiedYaml] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const folderRef = useRef<HTMLInputElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const target = repoInput.trim();
    if (!target || isLoading) return;
    onScanGitHub(target);
  };

  const handleDownloadPrunedZip = async () => {
    if (!graph || isExporting) return;
    setIsExporting(true);
    try {
      const blob = await generatePrunedRepoZip(graph);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${graph.repoName.split('/').pop() || 'clean-repo'}-pruned.zip`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert('Failed to compress pruned archive.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleCopyArchitectureDoc = () => {
    if (!graph) return;
    const doc = generateArchitectureMarkdown(graph);
    navigator.clipboard.writeText(doc);
    setCopiedDoc(true);
    setTimeout(() => setCopiedDoc(false), 2000);
  };

  const handleCopyGitHubActionYaml = () => {
    const yaml = generateGitHubActionYaml();
    navigator.clipboard.writeText(yaml);
    setCopiedYaml(true);
    setTimeout(() => setCopiedYaml(false), 2000);
  };

  return (
    <header className="w-full bg-[#020617] border-b border-slate-800/80 px-3 py-2 z-30 select-none font-mono text-xs">
      <div className="flex items-center justify-between gap-2 max-w-full">
        {/* Brand Core */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="h-7 w-7 rounded-lg bg-sky-500/10 border border-sky-500/30 flex items-center justify-center shadow-[0_0_12px_rgba(239,68,68,0.3)]">
            <Zap className="w-3.5 h-3.5 text-sky-400" />
          </div>
          <span className="font-bold text-white text-sm tracking-tight hidden sm:inline">
            Git<span className="text-sky-400">Blast</span>
          </span>
        </div>

        {/* Dynamic Scan Input */}
        <form onSubmit={handleSubmit} className="flex-1 max-w-lg flex items-center gap-1.5 min-w-0">
          <div className="relative flex-1 flex items-center min-w-0">
            <GitHubIcon className="w-3 h-3 text-slate-500 absolute left-2.5 pointer-events-none shrink-0" />
            <input
              type="text"
              value={repoInput}
              onChange={(e) => setRepoInput(e.target.value)}
              placeholder="github.com/owner/repo"
              disabled={isLoading}
              className="w-full bg-slate-900/90 text-slate-100 placeholder-slate-500 text-[11px] pl-7 pr-2 py-1.5 rounded-lg border border-slate-800 focus:outline-none focus:border-red-500/60 truncate transition"
            />
          </div>
          <button
            type="submit"
            disabled={isLoading || !repoInput.trim()}
            className="px-3 py-1.5 rounded-lg bg-sky-500 hover:bg-sky-400 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-xs flex items-center gap-1 transition shrink-0 cursor-pointer shadow-[0_0_10px_rgba(220,38,38,0.35)]"
          >
            {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">Scan</span>
          </button>
        </form>

        {/* Desktop Operations Toolbar */}
        <div className="hidden lg:flex items-center gap-1.5 shrink-0">
          <RealNetworkTelemetry />

          {graph && (
            <>
              <button
                type="button"
                onClick={onOpenDiffModal}
                className="px-2.5 py-1.5 rounded-lg bg-sky-500/10 border border-sky-500/30 text-sky-400 hover:bg-sky-500/20 font-bold flex items-center gap-1.5 transition cursor-pointer text-[11px]"
                title="Paste raw terminal git diff to simulate blast"
              >
                <GitCommit className="w-3.5 h-3.5" />
                <span>Paste Diff</span>
              </button>

              <button
                type="button"
                onClick={onExportImage}
                className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 transition cursor-pointer"
                title="Export High-Resolution Canvas PNG"
              >
                <Camera className="w-3.5 h-3.5 text-sky-400" />
              </button>
            </>
          )}

          <button
            type="button"
            onClick={onToggleWireCutter}
            className={`px-2.5 py-1.5 rounded-lg border flex items-center gap-1.5 transition cursor-pointer text-[11px] ${
              isWireCutterMode
                ? 'bg-amber-500/20 border-amber-500/60 text-amber-300 font-bold shadow-[0_0_10px_rgba(245,158,11,0.25)]'
                : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
            title="Wire Cutter Sandbox: Cut dependency edges on canvas"
          >
            <Scissors className="w-3.5 h-3.5" />
            <span>{isWireCutterMode ? 'Active' : 'Cut Wire'}</span>
          </button>

          {graph && graph.deadFiles.length > 0 && (
            <button
              type="button"
              disabled={isExporting}
              onClick={handleDownloadPrunedZip}
              className="px-2.5 py-1.5 rounded-lg bg-sky-500/10 hover:bg-emerald-500/25 border border-sky-500/30 text-sky-300 font-bold flex items-center gap-1.5 transition cursor-pointer text-[11px]"
              title={`Download repository without ${graph.deadFiles.length} dead files`}
            >
              {isExporting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3 text-sky-400" />}
              <span>Slim ({graph.deadFiles.length})</span>
            </button>
          )}

          {graph && (
            <>
              <button
                type="button"
                onClick={handleCopyArchitectureDoc}
                className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 transition cursor-pointer"
                title="Copy ARCHITECTURE.md"
              >
                {copiedDoc ? <Check className="w-3.5 h-3.5 text-sky-400" /> : <FileText className="w-3.5 h-3.5 text-sky-400" />}
              </button>
              <button
                type="button"
                onClick={handleCopyGitHubActionYaml}
                className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 transition cursor-pointer"
                title="Copy GitHub Action CI/CD YAML"
              >
                {copiedYaml ? <Check className="w-3.5 h-3.5 text-sky-400" /> : <FileCode className="w-3.5 h-3.5 text-sky-400" />}
              </button>
            </>
          )}

          <button
            type="button"
            onClick={() => folderRef.current?.click()}
            className="px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:text-white flex items-center gap-1.5 transition cursor-pointer text-[11px]"
            title="Scan Local Directory"
          >
            <FolderOpen className="w-3.5 h-3.5 text-sky-400" />
            <span>Drop Folder</span>
          </button>
        </div>

        {/* Mobile Viewport Toggle */}
        <div className="flex lg:hidden items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => setMobileMenuOpen((p) => !p)}
            className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:text-white transition"
            title="Toggle Action Drawer"
          >
            <MoreVertical className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Directory File Input */}
      {React.createElement('input', {
        ref: folderRef,
        type: 'file',
        multiple: true,
        directory: '',
        webkitdirectory: '',
        onChange: (e: any) => e.target.files && onUploadLocalFolder(e.target.files),
        className: 'hidden',
      } as any)}

      {/* Mobile Drawer (No Canvas Collision) */}
      {mobileMenuOpen && (
        <div className="lg:hidden mt-2 pt-2 border-t border-slate-800/80 grid grid-cols-2 sm:grid-cols-3 gap-1.5 bg-[#020617] p-1">
          <button
            type="button"
            onClick={() => {
              folderRef.current?.click();
              setMobileMenuOpen(false);
            }}
            className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 text-[10px] flex items-center justify-center gap-1.5"
          >
            <FolderOpen className="w-3.5 h-3.5 text-sky-400" /> Drop Folder
          </button>

          <button
            type="button"
            onClick={() => {
              onToggleWireCutter();
              setMobileMenuOpen(false);
            }}
            className={`p-2 rounded-lg border text-[10px] flex items-center justify-center gap-1.5 ${
              isWireCutterMode
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 font-bold'
                : 'bg-slate-900 border-slate-800 text-slate-300'
            }`}
          >
            <Scissors className="w-3.5 h-3.5" /> Wire Cutter
          </button>

          {graph && (
            <>
              <button
                type="button"
                onClick={() => {
                  onOpenDiffModal();
                  setMobileMenuOpen(false);
                }}
                className="p-2 rounded-lg bg-sky-500/10 border border-sky-500/30 text-sky-400 text-[10px] flex items-center justify-center gap-1.5"
              >
                <GitCommit className="w-3.5 h-3.5" /> Paste Diff
              </button>

              <button
                type="button"
                onClick={() => {
                  onExportImage();
                  setMobileMenuOpen(false);
                }}
                className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-sky-400 text-[10px] flex items-center justify-center gap-1.5"
              >
                <Camera className="w-3.5 h-3.5" /> Export Image
              </button>

              {graph.deadFiles.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    handleDownloadPrunedZip();
                    setMobileMenuOpen(false);
                  }}
                  className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-sky-300 text-[10px] flex items-center justify-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" /> Slim ({graph.deadFiles.length})
                </button>
              )}
            </>
          )}
        </div>
      )}
    </header>
  );
}
