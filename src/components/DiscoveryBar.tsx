import React from 'react';

interface DiscoveryBarProps {
  onSelectDiscovery: (type: 'circle_magic' | 'holographic_shield' | 'swarm_fireflies' | 'noise_proof' | 'living_memory' | 'moire_alice' | 'zero_training_predictor') => void;
  onAutoTune: () => void;
  isScanning?: boolean;
}

export const DiscoveryBar: React.FC<DiscoveryBarProps> = ({
  onSelectDiscovery,
  onAutoTune,
  isScanning = false
}) => {
  return (
    <div className="bg-[#090c14] border border-slate-800 rounded-lg p-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-sm">
      <div className="flex items-center gap-2.5">
        <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
        <span className="text-xs font-semibold text-slate-200 font-mono tracking-wide">
          Curated Discoveries:
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => onSelectDiscovery('zero_training_predictor')}
          className="px-2.5 py-1.5 text-xs font-mono rounded bg-cyan-950/80 border border-cyan-400/60 text-cyan-200 hover:bg-cyan-900/80 transition-colors flex items-center gap-1.5 shadow-[0_0_12px_rgba(6,182,212,0.3)] font-semibold"
        >
          <span>⚡</span>
          <span>Zero-Training Token Predictor</span>
        </button>

        <button
          onClick={() => onSelectDiscovery('moire_alice')}
          className="px-2.5 py-1.5 text-xs font-mono rounded bg-slate-900 border border-slate-800 text-slate-300 hover:text-cyan-300 hover:border-cyan-500/50 transition-colors flex items-center gap-1.5"
        >
          <span>📖</span>
          <span>Alice Moiré Synthesizer</span>
        </button>

        <button
          onClick={() => onSelectDiscovery('circle_magic')}
          className="px-2.5 py-1.5 text-xs font-mono rounded bg-slate-900 border border-slate-800 text-slate-300 hover:text-cyan-300 hover:border-cyan-500/50 transition-colors flex items-center gap-1.5"
        >
          <span className="text-cyan-400">🎯</span>
          <span>Invisibility Miracle (94% Discarded)</span>
        </button>

        <button
          onClick={() => onSelectDiscovery('holographic_shield')}
          className="px-2.5 py-1.5 text-xs font-mono rounded bg-slate-900 border border-slate-800 text-slate-300 hover:text-emerald-300 hover:border-emerald-500/50 transition-colors flex items-center gap-1.5"
        >
          <span className="text-emerald-400">🛡️</span>
          <span>Holographic Shield (50% Erased)</span>
        </button>

        <button
          onClick={() => onSelectDiscovery('living_memory')}
          className="px-2.5 py-1.5 text-xs font-mono rounded bg-slate-900 border border-slate-800 text-slate-300 hover:text-purple-300 hover:border-purple-500/50 transition-colors flex items-center gap-1.5"
        >
          <span className="text-purple-400">💎</span>
          <span>Phase Crystallization</span>
        </button>

        <button
          onClick={() => onSelectDiscovery('swarm_fireflies')}
          className="px-2.5 py-1.5 text-xs font-mono rounded bg-slate-900 border border-slate-800 text-slate-300 hover:text-amber-300 hover:border-amber-500/50 transition-colors flex items-center gap-1.5"
        >
          <span className="text-amber-400">🐝</span>
          <span>Firefly Swarm</span>
        </button>

        <button
          onClick={() => onSelectDiscovery('noise_proof')}
          className="px-2.5 py-1.5 text-xs font-mono rounded bg-slate-900 border border-slate-800 text-slate-300 hover:text-rose-300 hover:border-rose-500/50 transition-colors flex items-center gap-1.5"
        >
          <span className="text-rose-400">🎲</span>
          <span>Noise Proof (Chaos Collapse)</span>
        </button>

        <button
          onClick={onAutoTune}
          disabled={isScanning}
          className="px-3 py-1.5 text-xs font-mono font-medium rounded bg-cyan-500/20 text-cyan-200 border border-cyan-500/50 hover:bg-cyan-500/30 transition-all flex items-center gap-1.5 shadow-[0_0_12px_rgba(6,182,212,0.2)] ml-auto"
        >
          <span>✨</span>
          <span>{isScanning ? 'Auto-Scanning...' : 'Auto-Optimize Sweet Spot'}</span>
        </button>
      </div>
    </div>
  );
};
