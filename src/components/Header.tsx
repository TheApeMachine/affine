import React from 'react';
import { SignalSource } from '../math/gf257';

interface HeaderProps {
  activeTab: 'decimation' | 'multiscale' | 'swarm' | 'recursive' | 'living' | 'moire' | 'predictor';
  setActiveTab: (tab: 'decimation' | 'multiscale' | 'swarm' | 'recursive' | 'living' | 'moire' | 'predictor') => void;
  signals: SignalSource[];
  selectedSignalId: string;
  onSelectSignal: (id: string) => void;
  onReset: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  signals,
  selectedSignalId,
  onSelectSignal,
  onReset
}) => {
  return (
    <header className="border-b border-slate-800 bg-[#07090e] px-4 lg:px-8 py-3.5 sticky top-0 z-40 backdrop-blur-md">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Zone 1: Single text element wordmark */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="w-2.5 h-2.5 rounded-full bg-cyan-400 ring-4 ring-cyan-400/20" />
          <span className="text-base font-semibold tracking-tight text-white whitespace-nowrap">
            Affine Orbit & Multiscale Compression Lab
          </span>
        </div>

        {/* Zone 2: Clean 6 nav links / segmented tabs */}
        <nav className="flex items-center gap-1 p-1 bg-slate-900/90 rounded-lg border border-slate-800/80 overflow-x-auto max-w-full">
          <button
            onClick={() => setActiveTab('decimation')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
              activeTab === 'decimation'
                ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Decimation & ρ(X,k)
          </button>
          <button
            onClick={() => setActiveTab('multiscale')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
              activeTab === 'multiscale'
                ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Hierarchical & Holographic
          </button>
          <button
            onClick={() => setActiveTab('swarm')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
              activeTab === 'swarm'
                ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Swarm Explorer
          </button>
          <button
            onClick={() => setActiveTab('living')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
              activeTab === 'living'
                ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Living Memory & Phase
          </button>
          <button
            onClick={() => setActiveTab('moire')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
              activeTab === 'moire'
                ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Generative Moiré
          </button>
          <button
            onClick={() => setActiveTab('predictor')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
              activeTab === 'predictor'
                ? 'bg-cyan-500/25 text-cyan-200 border border-cyan-400/50 shadow-[0_0_10px_rgba(6,182,212,0.25)] font-semibold'
                : 'text-cyan-400/80 hover:text-cyan-300 bg-cyan-950/20'
            }`}
          >
            ⚡ Zero-Training Predictor
          </button>
          <button
            onClick={() => setActiveTab('recursive')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
              activeTab === 'recursive'
                ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Recursive Descent
          </button>
        </nav>

        {/* Zone 3: Signal selector & Reset actions */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="flex items-center gap-2">
            <label htmlFor="source-select" className="text-xs text-slate-400 font-mono hidden sm:inline">
              Source:
            </label>
            <select
              id="source-select"
              value={selectedSignalId}
              onChange={(e) => onSelectSignal(e.target.value)}
              className="bg-slate-900 border border-slate-700 text-xs text-slate-200 rounded px-2.5 py-1.5 focus:outline-none focus:border-cyan-500 font-mono"
            >
              {signals.map((sig) => (
                <option key={sig.id} value={sig.id}>
                  {sig.name} ({sig.category})
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={onReset}
            className="px-3 py-1.5 text-xs font-medium text-slate-300 bg-slate-800/80 hover:bg-slate-700/80 rounded border border-slate-700 transition-colors whitespace-nowrap"
          >
            Reset
          </button>
        </div>
      </div>
    </header>
  );
};
