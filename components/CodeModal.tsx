'use client';

import React, { useState } from 'react';
import { X, Code2, Copy, Check, FileCode, ExternalLink } from 'lucide-react';
import { FileNode } from '@/types/graph.types';

interface CodeModalProps {
  fileNode: FileNode | null;
  fileContent?: string;
  allNodes: Record<string, FileNode>;
  repoName: string;
  onClose: () => void;
  onNavigateToFile: (fileId: string) => void;
}

export default function CodeModal({
  fileNode,
  fileContent = '',
  allNodes,
  repoName,
  onClose,
  onNavigateToFile,
}: CodeModalProps) {
  const [copied, setCopied] = useState(false);

  if (!fileNode) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(fileContent || '// No raw source cached in memory.');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const cleanRepo = repoName.replace(/^https?:\/\/github\.com\//, '').replace(/\.git$/, '');
  const ghUrl = `https://github.com/${cleanRepo}/blob/main/${fileNode.id}`;

  const lines = (fileContent || '// Source code buffer empty or file stream pending.').split('\n');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 select-none font-mono">
      <div className="w-full max-w-4xl max-h-[85vh] bg-[#030712] border border-cyan-500/40 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-4 py-3 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2 truncate">
            <FileCode className="w-4 h-4 text-cyan-400 shrink-0" />
            <span className="font-bold text-slate-200 text-xs truncate">{fileNode.id}</span>
            <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
              {fileNode.loc} LOC
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <a
              href={ghUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-cyan-400 transition"
              title="Open on GitHub"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
            <button
              type="button"
              onClick={handleCopy}
              className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200 transition"
              title="Copy Source"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-rose-400 transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Code Content Stream */}
        <div className="flex-1 overflow-auto p-4 bg-[#02040a] text-xs font-mono leading-relaxed">
          <table className="w-full border-collapse">
            <tbody>
              {lines.map((line, idx) => (
                <tr key={idx} className="hover:bg-slate-900/40 transition">
                  <td className="w-10 text-right pr-4 text-slate-600 select-none text-[11px] align-top">
                    {idx + 1}
                  </td>
                  <td className="text-slate-300 font-mono whitespace-pre break-all">
                    {line || ' '}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Footer Connections Bar */}
        <div className="px-4 py-2.5 bg-slate-950 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
          <div className="flex items-center gap-3">
            <span>Direct Imports: <strong className="text-cyan-400">{fileNode.imports.length}</strong></span>
            <span>Imported By: <strong className="text-rose-400">{fileNode.importedBy.length}</strong></span>
          </div>
          <div className="text-[10px] text-slate-500">
            In-memory source file
          </div>
        </div>
      </div>
    </div>
  );
}
