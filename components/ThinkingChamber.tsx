'use client';

import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Network, ShieldAlert } from 'lucide-react';
import { CognitiveAnalysisResult } from '@/engine/analysis/reasoningEngine';

interface ThinkingChamberProps {
  analysis: CognitiveAnalysisResult | null;
}

const verdictStyles: Record<CognitiveAnalysisResult['verdict'], string> = {
  LOW_GRAPH_RISK: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30',
  REQUIRES_REVIEW: 'bg-amber-500/10 text-amber-300 border-amber-500/30',
  HIGH_GRAPH_RISK: 'bg-rose-500/10 text-rose-300 border-rose-500/30',
};

export default function ThinkingChamber({ analysis }: ThinkingChamberProps) {
  const [isOpen, setIsOpen] = useState(true);

  if (!analysis || analysis.thoughtChain.length === 0) return null;

  const observation = analysis.thoughtChain.find((step) => step.phase === 'OBSERVATION');
  const deduction = analysis.thoughtChain.find((step) => step.phase === 'DEDUCTION');
  const pageRank = Number(observation?.telemetry.match(/PageRank share: ([\d.]+)%/)?.[1] || 0);

  return (
    <section className="absolute top-14 left-3 z-30 w-[min(24rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-slate-800 bg-[#020617]/95 font-mono shadow-2xl backdrop-blur-md">
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        className="flex w-full items-center justify-between border-b border-slate-800/80 bg-slate-900/60 px-3 py-2.5 text-left hover:bg-slate-900"
        aria-expanded={isOpen}
      >
        <span className="flex items-center gap-2">
          <Network className="h-3.5 w-3.5 text-cyan-400" />
          <span className="text-[11px] font-bold text-slate-100">STRUCTURAL RISK</span>
          <span className="rounded border border-slate-700 px-1.5 py-0.5 text-[8px] font-semibold text-slate-400">STATIC GRAPH</span>
        </span>
        <span className="flex items-center gap-2">
          <span className={`rounded border px-1.5 py-0.5 text-[8px] font-bold ${verdictStyles[analysis.verdict]}`}>
            {analysis.verdict.replace(/_/g, ' ')}
          </span>
          {isOpen ? <ChevronUp className="h-3.5 w-3.5 text-slate-400" /> : <ChevronDown className="h-3.5 w-3.5 text-slate-400" />}
        </span>
      </button>

      {isOpen && (
        <div className="space-y-3 p-3">
          <div className="grid grid-cols-4 gap-1.5">
            {[
              ['CALLERS', analysis.metrics.afferentCoupling],
              ['IMPORTS', analysis.metrics.efferentCoupling],
              ['REACH', `${analysis.targetNodeId ? (analysis.thoughtChain.find((step) => step.phase === 'DELIBERATION')?.telemetry.match(/(\d+(?:\.\d+)?)% codebase coverage/)?.[1] || '0') : '0'}%`],
              ['RANK SHARE', `${pageRank.toFixed(2)}%`],
            ].map(([label, value]) => (
              <div key={label} className="rounded-lg border border-slate-800 bg-slate-950/80 px-2 py-2">
                <div className="text-sm font-bold text-slate-100">{value}</div>
                <div className="mt-0.5 text-[8px] tracking-wide text-slate-500">{label}</div>
              </div>
            ))}
          </div>

          <p className="text-[10px] leading-relaxed text-slate-300">{deduction?.telemetry}</p>
          <div className="rounded-lg border border-cyan-500/20 bg-cyan-950/15 p-2.5">
            <div className="mb-1 text-[9px] font-bold uppercase tracking-wide text-cyan-300">Suggested review</div>
            <p className="text-[10px] leading-relaxed text-slate-300">{analysis.recommendation}</p>
          </div>

          <div className="flex gap-2 border-t border-slate-800 pt-2 text-[9px] leading-relaxed text-slate-500">
            <ShieldAlert className="mt-0.5 h-3 w-3 shrink-0 text-amber-400" />
            Import-based estimate. Dynamic imports, reflection, and framework references may be missing; this is not a test or security scan.
          </div>
        </div>
      )}
    </section>
  );
}
