'use client';
import React, { useState } from 'react';
import { Brain, ChevronDown, ChevronUp, Cpu, CheckCircle2, AlertTriangle, ShieldAlert } from 'lucide-react';
import { CognitiveAnalysisResult } from '@/engine/analysis/reasoningEngine';

interface ThinkingChamberProps {
  analysis: CognitiveAnalysisResult | null;
}

export default function ThinkingChamber({ analysis }: ThinkingChamberProps) {
  const [isOpen, setIsOpen] = useState(true);

  if (!analysis || analysis.thoughtChain.length === 0) return null;

  const verdictStyles = {
    SAFE_TO_MODIFY: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    REQUIRES_REFACTOR: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
    CRITICAL_BOTTLENECK: 'bg-rose-500/10 text-rose-400 border-rose-500/30',
  }[analysis.verdict];

  return (
    <div className="absolute top-14 left-3 z-30 w-84 bg-[#020617]/95 border border-slate-800 rounded-xl shadow-2xl backdrop-blur-md font-mono select-none overflow-hidden">
      {/* Header */}
      <div
        onClick={() => setIsOpen((p) => !p)}
        className="p-2.5 px-3 bg-slate-900/60 border-b border-slate-800/80 flex items-center justify-between cursor-pointer hover:bg-slate-900 transition"
      >
        <div className="flex items-center gap-2">
          <Brain className="w-3.5 h-3.5 text-sky-400 animate-pulse" />
          <span className="text-[11px] font-bold text-slate-200">COGNITIVE REASONING</span>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-[9px] px-1.5 py-0.2 rounded border font-bold uppercase ${verdictStyles}`}>
            {analysis.verdict.replace(/_/g, ' ')}
          </span>
          {isOpen ? <ChevronUp className="w-3.5 h-3.5 text-slate-400" /> : <ChevronDown className="w-3.5 h-3.5 text-slate-400" />}
        </div>
      </div>

      {/* Internal Deliberation Stream */}
      {isOpen && (
        <div className="p-3 space-y-2.5 max-h-72 overflow-y-auto text-[11px]">
          {analysis.thoughtChain.map((step, idx) => (
            <div key={idx} className="space-y-1">
              <div className="flex items-center gap-1.5 text-slate-400 font-bold text-[10px] uppercase">
                <span className="w-1.5 h-1.5 rounded-full bg-sky-400"></span>
                <span>{step.phase}</span>
              </div>
              <p className="text-slate-300 text-[10px] pl-3 border-l border-slate-800">{step.description}</p>
              <div className="ml-3 p-1.5 rounded bg-slate-950 border border-slate-800/80 text-[10px] text-slate-400">
                {step.telemetry}
              </div>
            </div>
          ))}

          <div className="pt-2 border-t border-slate-800/80">
            <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Architectural Advice:</span>
            <p className="text-[10px] text-amber-300/90 leading-relaxed bg-amber-950/20 p-2 rounded border border-amber-500/20">
              {analysis.recommendation}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
