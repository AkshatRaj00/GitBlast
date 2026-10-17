'use client';
import React, { useState } from 'react';
import { X, GitCommit, Play, AlertCircle } from 'lucide-react';
import { parseRawGitDiff } from '@/engine/parser/diffParser';

interface DiffModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyDiffFiles: (files: string[]) => void;
  availableGraphFiles: string[];
}

export default function DiffModal({ isOpen, onClose, onApplyDiffFiles, availableGraphFiles }: DiffModalProps) {
  const [rawDiff, setRawDiff] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSimulate = () => {
    setErrorMsg(null);
    if (!rawDiff.trim()) {
      setErrorMsg('Please paste a valid git diff text.');
      return;
    }

    const { modifiedFiles } = parseRawGitDiff(rawDiff);

    if (modifiedFiles.length === 0) {
      setErrorMsg('No modified files detected in the provided diff syntax.');
      return;
    }

    // Match parsed files against loaded graph nodes (fuzzy path check)
    const matchedFiles: string[] = [];
    const graphSet = new Set(availableGraphFiles);

    for (const f of modifiedFiles) {
      if (graphSet.has(f)) {
        matchedFiles.push(f);
      } else {
        // Try matching by base filename or suffix
        const hit = availableGraphFiles.find(gf => gf.endsWith(f) || f.endsWith(gf));
        if (hit) matchedFiles.push(hit);
      }
    }

    if (matchedFiles.length === 0) {
      setErrorMsg(`Parsed ${modifiedFiles.length} file(s), but none exist in the currently loaded repository.`);
      return;
    }

    onApplyDiffFiles(Array.from(new Set(matchedFiles)));
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 font-mono select-none">
      <div className="bg-[#020617] border border-slate-800 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col">
        {/* Header */}
        <div className="p-3.5 px-4 bg-slate-900/80 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <GitCommit className="w-4 h-4 text-emerald-400" />
            <span className="text-xs font-bold text-white uppercase tracking-wider">Simulate Terminal Git Diff</span>
          </div>
          <button type="button" onClick={onClose} className="p-1 rounded text-slate-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 space-y-3">
          <p className="text-[11px] text-slate-400 leading-relaxed">
            Run <code className="text-emerald-400 bg-slate-900 px-1 py-0.5 rounded">git diff</code> or <code className="text-emerald-400 bg-slate-900 px-1 py-0.5 rounded">git diff HEAD~1</code> in your terminal, paste the raw output below, and GitBlast will automatically stage the changed files to calculate their downstream blast wave.
          </p>

          <textarea
            value={rawDiff}
            onChange={(e) => setRawDiff(e.target.value)}
            placeholder="diff --git a/src/auth.ts b/src/auth.ts&#10;index 83a1b..94f2c 100644&#10;--- a/src/auth.ts&#10;+++ b/src/auth.ts&#10;@@ -10,3 +10,4 @@..."
            className="w-full h-48 bg-slate-950 border border-slate-800 rounded-xl p-3 text-[11px] font-mono text-slate-200 focus:outline-none focus:border-emerald-500/50 resize-none select-text"
          />

          {errorMsg && (
            <div className="p-2.5 rounded-lg bg-rose-950/30 border border-rose-500/40 text-rose-300 text-[10px] flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 shrink-0 text-rose-400" />
              <span>{errorMsg}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 bg-slate-950 border-t border-slate-800 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 text-xs transition"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSimulate}
            className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 transition shadow-[0_0_15px_rgba(16,185,129,0.3)]"
          >
            <Play className="w-3.5 h-3.5" />
            <span>Simulate Blast Radius</span>
          </button>
        </div>
      </div>
    </div>
  );
}
