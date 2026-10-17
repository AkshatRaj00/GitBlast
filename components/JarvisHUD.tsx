'use client';
import React, { useState } from 'react';
import { Bot, Send, Sparkles, AlertCircle, ShieldCheck, Cpu, Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import { FileNode, RepositoryGraph } from '@/types/graph.types';
import { MultiFileBlastReport } from '@/engine/math/multiBlastRadius';

interface JarvisHUDProps {
  graph: RepositoryGraph | null;
  selectedFile: FileNode | null;
  blastReport: MultiFileBlastReport | null;
}

export default function JarvisHUD({ graph, selectedFile, blastReport }: JarvisHUDProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [chatLog, setChatLog] = useState<Array<{ role: 'user' | 'jarvis'; text: string; provider?: string }>>([
    {
      role: 'jarvis',
      text: 'Jarvis Architectural Brain online. Ask me about refactoring risks, blast radius containment, or single-points-of-failure.',
    },
  ]);

  const handleAskJarvis = async (customPrompt?: string) => {
    const textToSend = customPrompt || query;
    if (!textToSend.trim() || loading) return;

    const userEntry = { role: 'user' as const, text: textToSend };
    setChatLog((prev) => [...prev, userEntry]);
    setQuery('');
    setLoading(true);

    try {
      const res = await fetch('/api/ai-brain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: textToSend,
          selectedFile,
          blastReport,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setChatLog((prev) => [
          ...prev,
          { role: 'jarvis', text: data.reply, provider: data.provider },
        ]);
      } else {
        setChatLog((prev) => [
          ...prev,
          { role: 'jarvis', text: `❌ ${data.error || 'Failed to connect to AI brain.'}` },
        ]);
      }
    } catch (err: any) {
      setChatLog((prev) => [
        ...prev,
        { role: 'jarvis', text: `❌ Network error: ${err.message}` },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed bottom-3 left-1/2 -translate-x-1/2 z-40 w-full max-w-2xl px-4 font-mono select-none">
      <div className="bg-[#020617]/95 border border-slate-800 rounded-2xl shadow-[0_0_40px_rgba(0,0,0,0.85)] overflow-hidden backdrop-blur-md">
        
        {/* Toggle Bar */}
        <div
          onClick={() => setIsOpen((p) => !p)}
          className="p-2.5 px-4 bg-slate-900/60 border-b border-slate-800/80 flex items-center justify-between cursor-pointer hover:bg-slate-900 transition"
        >
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-md bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-400">
              <Bot className="w-3.5 h-3.5" />
            </div>
            <span className="text-xs font-bold text-slate-200">
              JARVIS ARCHITECTURAL INTELLIGENCE
            </span>
            <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 uppercase">
              5-Tier Engine
            </span>
          </div>

          <div className="flex items-center gap-2 text-slate-400 text-xs">
            {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </div>
        </div>

        {/* Expandable Chat & Diagnostics Drawer */}
        {isOpen && (
          <div className="flex flex-col h-72">
            <div className="flex-1 overflow-y-auto p-3 space-y-3 text-xs">
              {chatLog.map((msg, idx) => (
                <div
                  key={idx}
                  className={`p-2.5 rounded-xl border ${
                    msg.role === 'user'
                      ? 'bg-sky-500/10 border-sky-500/30 text-sky-200 ml-8'
                      : 'bg-slate-900/80 border-slate-800 text-slate-300 mr-8'
                  }`}
                >
                  <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1">
                    <span className="font-bold uppercase tracking-wider">
                      {msg.role === 'user' ? 'Developer' : 'Jarvis Brain'}
                    </span>
                    {msg.provider && (
                      <span className="text-emerald-400 bg-emerald-500/10 px-1 rounded">
                        via {msg.provider}
                      </span>
                    )}
                  </div>
                  <div className="whitespace-pre-wrap leading-relaxed select-text">
                    {msg.text}
                  </div>
                </div>
              ))}
              {loading && (
                <div className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800 text-slate-400 flex items-center gap-2 text-xs mr-8">
                  <Loader2 className="w-4 h-4 animate-spin text-sky-400" />
                  <span>Synthesizing multi-hop AST call-paths...</span>
                </div>
              )}
            </div>

            {/* Quick Action Presets */}
            <div className="px-3 py-1.5 bg-slate-950/80 border-t border-slate-800/60 flex items-center gap-2 overflow-x-auto text-[10px]">
              <button
                type="button"
                onClick={() => handleAskJarvis('Audit the single points of failure in this repository.')}
                className="px-2 py-1 rounded bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 shrink-0 cursor-pointer"
              >
                ⚡ SPOF Audit
              </button>
              <button
                type="button"
                onClick={() => handleAskJarvis(`Propose a refactoring patch to decouple ${selectedFile?.id || 'this file'} and reduce blast radius.`)}
                className="px-2 py-1 rounded bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 shrink-0 cursor-pointer"
              >
                🛠️ Decouple Patch
              </button>
              <button
                type="button"
                onClick={() => handleAskJarvis('Why is this file critical and what breaks if I change its public exports?')}
                className="px-2 py-1 rounded bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 shrink-0 cursor-pointer"
              >
                💥 Breakage Reason
              </button>
            </div>

            {/* Input Form */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleAskJarvis();
              }}
              className="p-2 bg-slate-900/90 border-t border-slate-800 flex items-center gap-2"
            >
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Ask Jarvis to analyze architecture, circular loops, or refactor risks..."
                disabled={loading}
                className="flex-1 bg-slate-950 text-slate-100 placeholder-slate-500 text-xs px-3 py-1.5 rounded-lg border border-slate-800 focus:outline-none focus:border-sky-500/60 font-mono"
              />
              <button
                type="submit"
                disabled={loading || !query.trim()}
                className="p-2 rounded-lg bg-sky-600 hover:bg-sky-500 disabled:bg-slate-800 text-white transition cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
