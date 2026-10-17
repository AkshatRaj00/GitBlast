'use client';
import React, { useState } from 'react';
import { X, FileCode2, Copy, Check, ExternalLink, GitPullRequest, Bug } from 'lucide-react';
import { FileNode } from '@/types/graph.types';
import { detectBugsInSource } from '@/engine/security/bugRadar';

interface CodeModalProps {
  fileNode: FileNode | null;
  allNodes: Record<string, FileNode>;
  repoName: string;
  onClose: () => void;
  onNavigateToFile: (fileId: string) => void;
}

export default function CodeModal({ fileNode, repoName, onClose }: CodeModalProps) {
  const [copied, setCopied] = useState(false);

  if (!fileNode) return null;

  const rawContent = fileNode.content || '// Source buffer empty or file is binary.';
  const lines = rawContent.split(/\r?\n/);
  const cleanRepo = repoName.replace(/^https?:\/\/github\.com\//, '').replace(/\.git$/, '');

  const gitHubEditUrl = `https://github.com/${cleanRepo}/edit/main/${fileNode.id}`;
  const gitHubBlobUrl = `https://github.com/${cleanRepo}/blob/main/${fileNode.id}`;

  const detectedBugs = detectBugsInSource(fileNode.id, rawContent);

  const handleCopyCode = () => {
    navigator.clipboard.writeText(rawContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 font-mono select-none">
      <div className="bg-[#020617] border border-slate-800 rounded-2xl w-full max-w-7xl h-[92vh] flex flex-col shadow-[0_0_50px_rgba(0,0,0,0.9)] overflow-hidden">
        
        {/* Top Header */}
        <div className="px-5 py-3.5 bg-slate-950 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2 rounded-lg bg-sky-500/10 border border-sky-500/30 text-sky-400 shrink-0">
              <FileCode2 className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-white truncate">{fileNode.id}</span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700 uppercase">
                  {fileNode.language}
                </span>
                {detectedBugs.length > 0 && (
                  <span className="text-[10px] bg-amber-500/15 text-amber-400 border border-amber-500/40 px-2 py-0.5 rounded flex items-center gap-1 font-bold">
                    <Bug className="w-3.5 h-3.5 text-amber-400" /> {detectedBugs.length} VULNERABILITIES
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3 text-[11px] text-slate-400 mt-0.5">
                <span>LOC: <strong className="text-slate-200">{lines.length}</strong></span>
                <span>•</span>
                <span>In-Degree: <strong className="text-red-400">{fileNode.inDegree}</strong></span>
                <span>•</span>
                <span>PageRank: <strong className="text-sky-400">{(fileNode.pageRank * 100).toFixed(1)}%</strong></span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <a
              href={gitHubEditUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 transition cursor-pointer shadow-[0_0_15px_rgba(16,185,129,0.35)]"
            >
              <GitPullRequest className="w-3.5 h-3.5" />
              <span>Edit &amp; PR on GitHub</span>
              <ExternalLink className="w-3 h-3 opacity-70" />
            </a>

            <a
              href={gitHubBlobUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-sky-400 text-xs flex items-center gap-1.5 transition cursor-pointer border border-slate-700"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>GitHub Source</span>
            </a>

            <button
              type="button"
              onClick={handleCopyCode}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs flex items-center gap-1.5 transition cursor-pointer"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 flex overflow-hidden">
          
          {/* Left Bug Radar */}
          <div className="w-80 bg-[#070b14] border-r border-slate-800 flex flex-col text-xs overflow-hidden shrink-0">
            <div className="p-3 border-b border-slate-800 bg-slate-900/60 flex items-center justify-between font-bold">
              <span className="text-amber-400 flex items-center gap-1.5 text-[11px]">
                <Bug className="w-3.5 h-3.5 text-amber-400" /> REAL BUG RADAR ({detectedBugs.length})
              </span>
              <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20">
                ACTIVE
              </span>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
              {detectedBugs.length === 0 ? (
                <div className="p-3 rounded-xl bg-emerald-950/20 border border-emerald-500/30 text-emerald-300 text-[11px] leading-relaxed">
                  ✓ Code Integrity Checked: Zero syntax leaks, unhandled async chains, or SQLi flaws found.
                </div>
              ) : (
                detectedBugs.map((b, idx) => (
                  <div key={idx} className="p-3 rounded-xl bg-amber-950/25 border border-amber-500/35 text-[11px] space-y-1.5">
                    <div className="flex items-center justify-between text-amber-300 font-bold">
                      <span className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-amber-400 inline-block animate-pulse"></span>
                        Line {b.line}: {b.type}
                      </span>
                      <span className="text-[9px] bg-amber-500/20 px-1.5 py-0.2 rounded uppercase">
                        {b.severity}
                      </span>
                    </div>
                    <p className="text-slate-300 text-[10px] leading-relaxed">{b.message}</p>
                    <div className="bg-[#020617] p-2 rounded-lg border border-slate-800 font-mono text-[10px] text-amber-200/90 truncate">
                      {b.snippet}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Native High-Performance Code Viewer */}
          <div className="flex-1 h-full bg-[#0d1117] overflow-auto p-4 font-mono text-xs select-text">
            <table className="w-full border-collapse">
              <tbody>
                {lines.map((lineText, idx) => (
                  <tr key={idx} className="hover:bg-slate-800/40 leading-relaxed">
                    <td className="w-12 text-right pr-4 select-none text-slate-600 border-r border-slate-800/80 align-top text-[11px]">
                      {idx + 1}
                    </td>
                    <td className="pl-4 text-slate-200 whitespace-pre font-mono text-[12px] align-top">
                      {lineText || ' '}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

        </div>
      </div>
    </div>
  );
}
