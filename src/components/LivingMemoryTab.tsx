import React, { useState, useEffect, useRef, useMemo } from 'react';
import { SignalSource } from '../math/gf257';
import {
  initLivingMemory,
  stepLivingMemory,
  injectEntropyStrike,
  LivingMemoryState,
  LivingValue
} from '../math/livingMemory';
import { computeMultiscaleSurface } from '../math/multiscale';
import { sonifier } from '../math/audioSynthesis';
import { SignalRaster } from './SignalRaster';

interface LivingMemoryTabProps {
  source: SignalSource;
}

export const LivingMemoryTab: React.FC<LivingMemoryTabProps> = ({ source }) => {
  const [couplingForce, setCouplingForce] = useState<number>(0.75);
  const [isRunning, setIsRunning] = useState<boolean>(true);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(false);
  const [selectedWitnessId, setSelectedWitnessId] = useState<string | null>(null);

  // Compute resonance peak for this source
  const surface = useMemo(() => {
    return computeMultiscaleSurface(source.data, 'orbit_smoothness', 16);
  }, [source.data]);

  const [memoryState, setMemoryState] = useState<LivingMemoryState>(() =>
    initLivingMemory(source.data, 24, 16)
  );

  // Reset when source changes
  useEffect(() => {
    setMemoryState(initLivingMemory(source.data, 24, 16));
  }, [source.id]);

  // Simulation tick loop
  useEffect(() => {
    if (!isRunning) return;

    const interval = setInterval(() => {
      setMemoryState(prev => {
        const next = stepLivingMemory(prev, surface.bestK0, surface.bestK1, couplingForce);

        // Sound sonification update
        if (soundEnabled) {
          sonifier.updateDrone(surface.bestK0, next.crystallizationProgress);
          if (next.phase === 'crystal' && prev.phase !== 'crystal') {
            sonifier.playCrystallizationChord();
          } else if (Math.random() < 0.2) {
            sonifier.playGossipChime(next.crystallizationProgress);
          }
        }

        return next;
      });
    }, 60);

    return () => clearInterval(interval);
  }, [isRunning, couplingForce, surface, soundEnabled]);

  const toggleSound = () => {
    const nextState = !soundEnabled;
    setSoundEnabled(nextState);
    sonifier.init();
    sonifier.setEnabled(nextState);
  };

  const handleCosmicStrike = () => {
    setMemoryState(prev => injectEntropyStrike(prev));
  };

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Render Phase Torus & Living Values
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const scale = width / 256;

    ctx.fillStyle = '#07090e';
    ctx.fillRect(0, 0, width, height);

    // Subtle coordinate grid
    ctx.strokeStyle = '#1e293b30';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 256; i += 32) {
      ctx.beginPath();
      ctx.moveTo(i * scale, 0);
      ctx.lineTo(i * scale, height);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(0, i * scale);
      ctx.lineTo(width, i * scale);
      ctx.stroke();
    }

    // Target resonant crystal well
    const tx = surface.bestK1 * scale;
    const ty = surface.bestK0 * scale;
    ctx.strokeStyle = memoryState.phase === 'crystal' ? '#10b981' : '#06b6d440';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(tx, ty, 20 + Math.sin(Date.now() / 200) * 3, 0, Math.PI * 2);
    ctx.stroke();

    // Draw living witness values
    for (const val of memoryState.values) {
      const isSelected = val.id === selectedWitnessId;
      const x = val.k1 * scale;
      const y = val.k0 * scale;

      // Draw halo
      const glow = val.crystallized ? 8 : 4;
      ctx.fillStyle = val.crystallized ? '#10b98130' : 'rgba(6, 182, 212, 0.15)';
      ctx.beginPath();
      ctx.arc(x, y, glow * (val.shards.length / 10), 0, Math.PI * 2);
      ctx.fill();

      // Draw core
      ctx.fillStyle = val.crystallized ? '#34d399' : val.color;
      ctx.beginPath();
      ctx.arc(x, y, isSelected ? 6 : 3.5, 0, Math.PI * 2);
      ctx.fill();

      // Label
      ctx.fillStyle = '#94a3b8';
      ctx.font = '9px "JetBrains Mono", monospace';
      ctx.fillText(val.name, x + 7, y + 3);
    }
  }, [memoryState, surface, selectedWitnessId]);

  const selectedWitness: LivingValue | undefined = memoryState.values.find(v => v.id === selectedWitnessId);

  return (
    <div className="space-y-6">
      {/* Overview Banner */}
      <div className="bg-[#0b0e17] border border-slate-800 rounded-lg p-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs uppercase tracking-wider text-cyan-400 font-mono">
                Living Holographic Memory & Phase Crystallization
              </span>
              <span className="text-slate-600">·</span>
              <span className="text-xs text-slate-400 font-mono">
                Consensus Storage Without a Central Database
              </span>
            </div>
            <p className="text-sm text-slate-300 mt-1 max-w-3xl leading-relaxed">
              Data does not exist as a static file. Instead, the image is shattered into fragments carried by <span className="text-cyan-300 font-semibold">24 living Values</span>.
              As they wander and exchange shards, they undergo a thermodynamic phase transition from <span className="text-slate-400">Chaos</span> to <span className="text-emerald-400">Crystal Consensus</span>, assembling the image before your eyes!
            </p>
          </div>

          {/* Sound & Entropy Buttons */}
          <div className="flex items-center gap-2.5 shrink-0">
            <button
              onClick={toggleSound}
              className={`px-3 py-1.5 text-xs font-mono rounded border transition-colors flex items-center gap-1.5 ${
                soundEnabled
                  ? 'bg-cyan-500/20 text-cyan-200 border-cyan-500/50 shadow-[0_0_10px_rgba(6,182,212,0.2)]'
                  : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
              }`}
            >
              <span>{soundEnabled ? '🔊 Sound: ON' : '🔈 Sound: Muted'}</span>
            </button>

            <button
              onClick={handleCosmicStrike}
              className="px-3 py-1.5 text-xs font-mono font-medium rounded bg-rose-500/20 text-rose-300 border border-rose-500/50 hover:bg-rose-500/30 transition-all flex items-center gap-1.5 shadow-[0_0_12px_rgba(244,63,94,0.2)]"
            >
              <span>⚡ Cosmic Radiation Strike</span>
            </button>
          </div>
        </div>
      </div>

      {/* Thermodynamic Phase Transition Bar */}
      <div className="bg-[#090c14] border border-slate-800 rounded-lg p-4 space-y-3">
        <div className="flex items-center justify-between text-xs font-mono">
          <div className="flex items-center gap-2">
            <span className="text-slate-400">Thermodynamic State:</span>
            <span className={`font-bold px-2 py-0.5 rounded uppercase text-[11px] ${
              memoryState.phase === 'crystal'
                ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                : memoryState.phase === 'liquid'
                ? 'bg-cyan-950 text-cyan-300 border border-cyan-800'
                : 'bg-rose-950 text-rose-300 border border-rose-800'
            }`}>
              {memoryState.phase === 'crystal' ? '💎 Crystalline Consensus (Harmonic Lock)' : memoryState.phase === 'liquid' ? '🌊 Liquid Gossip (Active Assembly)' : '💨 Disordered Gas (Entropy Chaos)'}
            </span>
          </div>

          <div className="text-slate-400">
            Memory Completeness:{' '}
            <span className="text-emerald-400 font-bold">
              {(memoryState.reconstructedCompleteness * 100).toFixed(0)}%
            </span>
          </div>
        </div>

        {/* Phase transition gauge bar */}
        <div className="w-full h-3 bg-slate-950 rounded-full overflow-hidden border border-slate-800 flex">
          <div
            style={{ width: `${memoryState.crystallizationProgress * 100}%` }}
            className={`h-full transition-all duration-300 ${
              memoryState.phase === 'crystal'
                ? 'bg-gradient-to-r from-cyan-500 to-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.6)]'
                : 'bg-gradient-to-r from-amber-500 to-cyan-500'
            }`}
          />
        </div>

        {/* Coupling Slider: Drag between Chaos and Crystallization */}
        <div className="pt-1">
          <div className="flex justify-between text-[11px] font-mono text-slate-400 mb-1">
            <span>Thermal Chaos (Gas)</span>
            <span className="text-cyan-400 font-bold">
              Coupling Affinity: {(couplingForce * 100).toFixed(0)}%
            </span>
            <span>Resonant Attraction (Crystal)</span>
          </div>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={couplingForce}
            onChange={(e) => setCouplingForce(parseFloat(e.target.value))}
            className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
          />
        </div>
      </div>

      {/* Main Workspace: Swarm Canvas + Collective Consensus Output */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Phase Space Torus */}
        <div className="lg:col-span-7 bg-[#0b0e17] border border-slate-800 rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold text-slate-200 uppercase tracking-wider font-mono">
              Living Witnesses in Transform Torus
            </h3>
            <button
              onClick={() => setIsRunning(!isRunning)}
              className="px-2.5 py-1 text-xs font-mono rounded bg-slate-900 border border-slate-800 text-slate-300 hover:text-white"
            >
              {isRunning ? 'Pause' : 'Resume'}
            </button>
          </div>

          <div className="relative aspect-square w-full bg-slate-950 rounded border border-slate-800/80 overflow-hidden">
            <canvas
              ref={canvasRef}
              width={512}
              height={512}
              className="w-full h-full cursor-pointer"
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const clickX = ((e.clientX - rect.left) / rect.width) * 256;
                const clickY = ((e.clientY - rect.top) / rect.height) * 256;
                let closest: LivingValue | null = null;
                let minDist = 30;
                for (const v of memoryState.values) {
                  const d = Math.hypot(v.k1 - clickX, v.k0 - clickY);
                  if (d < minDist) {
                    minDist = d;
                    closest = v;
                  }
                }
                setSelectedWitnessId(closest ? closest.id : null);
              }}
            />
          </div>

          <div className="flex justify-between text-[11px] font-mono text-slate-500">
            <span>Click any witness dot to inspect its memory shards</span>
            <span>Target Well: ({surface.bestK0}, {surface.bestK1})</span>
          </div>
        </div>

        {/* Right: Collective Consensus Canvas + Witness Inspector */}
        <div className="lg:col-span-5 space-y-4">
          {/* Consensus Canvas */}
          <SignalRaster
            data={memoryState.consensusCanvas}
            title="Collective Consensus Output"
            subtitle={`${(memoryState.reconstructedCompleteness * 100).toFixed(0)}% assembled from shared witnesses`}
          />

          {/* Selected Witness Memory Shard Inspector */}
          <div className="bg-[#0b0e17] border border-slate-800 rounded-lg p-4 space-y-3">
            <h3 className="text-xs font-semibold text-slate-200 uppercase tracking-wider font-mono">
              Witness Memory Shards
            </h3>

            {selectedWitness ? (
              <div className="space-y-2 text-xs font-mono">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: selectedWitness.color }} />
                    <span className="font-bold text-white">{selectedWitness.name}</span>
                  </div>
                  <span className={selectedWitness.crystallized ? 'text-emerald-400 font-bold' : 'text-slate-400'}>
                    {selectedWitness.crystallized ? '● In Consensus Lock' : '○ Foraging'}
                  </span>
                </div>

                <div className="text-slate-400">
                  Holds <span className="text-cyan-300 font-bold">{selectedWitness.shards.length} shards</span> of the image.
                </div>

                <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto pr-1">
                  {selectedWitness.shards.map((sh, idx) => (
                    <span
                      key={idx}
                      className="px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800 text-[10px] text-cyan-400"
                    >
                      cell #{sh.index}
                    </span>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-xs font-mono text-slate-500 py-3 text-center">
                Click any witness in the map to see the exact sample cells it carries.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
