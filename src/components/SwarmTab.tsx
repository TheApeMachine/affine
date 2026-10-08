import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { SignalSource } from '../math/gf257';
import {
  SwarmConfig,
  SwarmState,
  initSwarm,
  stepSwarm,
  SwarmValue,
  toroidalDist
} from '../math/swarm';
import { computeMultiscaleSurface } from '../math/multiscale';

interface SwarmTabProps {
  source: SignalSource;
}

export const SwarmTab: React.FC<SwarmTabProps> = ({ source }) => {
  const [isRunning, setIsRunning] = useState<boolean>(true);
  const [agentCount, setAgentCount] = useState<number>(24);
  const [affinityStrength, setAffinityStrength] = useState<number>(0.75);
  const [gossipRadius, setGossipRadius] = useState<number>(55);
  const [explorationNoise, setExplorationNoise] = useState<number>(0.35);
  const [asynchronyJitter, setAsynchronyJitter] = useState<number>(0.4);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);

  // Compute multiscale resonance background surface for current source
  const surface = useMemo(() => {
    return computeMultiscaleSurface(source.data, 'orbit_smoothness', 16);
  }, [source.data]);

  // Resonance evaluation function for any (k0, k1) in 0..255
  const evalResonance = useCallback((k0: number, k1: number): number => {
    // Bilinear interpolation on precomputed 16x16 grid for high performance
    const res = 16;
    const step = 256 / res;
    const r = Math.floor(k0 / step) % res;
    const c = Math.floor(k1 / step) % res;
    return surface.grid[r]?.[c] ?? 0.2;
  }, [surface]);

  const config: SwarmConfig = useMemo(() => ({
    agentCount,
    affinityStrength,
    gossipRadius,
    explorationNoise,
    asynchronyJitter
  }), [agentCount, affinityStrength, gossipRadius, explorationNoise, asynchronyJitter]);

  const [swarmState, setSwarmState] = useState<SwarmState>(() => initSwarm(config, evalResonance));

  // Reset when source changes or agent count changes
  const handleReset = () => {
    setSwarmState(initSwarm(config, evalResonance));
  };

  useEffect(() => {
    setSwarmState(initSwarm(config, evalResonance));
  }, [source.id, agentCount]);

  // Asynchronous tick loop
  useEffect(() => {
    if (!isRunning) return;
    const interval = setInterval(() => {
      setSwarmState(prev => stepSwarm(prev, config, evalResonance));
    }, 70);
    return () => clearInterval(interval);
  }, [isRunning, config, evalResonance]);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Draw phase space
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const scale = width / 256;

    // 1. Draw multiscale surface background
    ctx.fillStyle = '#080a10';
    ctx.fillRect(0, 0, width, height);

    // Draw resonance surface coarse blocks
    const cellW = width / 16;
    const cellH = height / 16;
    for (let r = 0; r < 16; r++) {
      for (let c = 0; c < 16; c++) {
        const val = surface.grid[r][c];
        const rColor = Math.round(val * 40);
        const gColor = Math.round(val * 120);
        const bColor = Math.round(val * 160 + 15);
        ctx.fillStyle = `rgba(${rColor}, ${gColor}, ${bColor}, 0.35)`;
        ctx.fillRect(c * cellW, r * cellH, cellW, cellH);
      }
    }

    // Grid lines
    ctx.strokeStyle = '#1e293b40';
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

    // 2. Draw Gossip Links between nearby Values
    ctx.lineWidth = 0.8;
    for (let i = 0; i < swarmState.values.length; i++) {
      const v1 = swarmState.values[i];
      for (let j = i + 1; j < swarmState.values.length; j++) {
        const v2 = swarmState.values[j];
        const { dist } = toroidalDist(v1.k0, v1.k1, v2.k0, v2.k1);
        if (dist <= config.gossipRadius) {
          const alpha = Math.max(0, 1 - dist / config.gossipRadius) * 0.45;
          ctx.strokeStyle = `rgba(6, 182, 212, ${alpha})`;
          ctx.beginPath();
          ctx.moveTo(v1.k1 * scale, v1.k0 * scale);
          ctx.lineTo(v2.k1 * scale, v2.k0 * scale);
          ctx.stroke();
        }
      }
    }

    // 3. Draw Values & Trajectories
    for (const val of swarmState.values) {
      const isSelected = val.id === selectedAgentId;
      const x = val.k1 * scale;
      const y = val.k0 * scale;

      // Draw trail
      if (val.history.length > 1) {
        ctx.strokeStyle = val.color;
        ctx.lineWidth = isSelected ? 2 : 1;
        ctx.beginPath();
        for (let t = 0; t < val.history.length; t++) {
          const tx = val.history[t][1] * scale;
          const ty = val.history[t][0] * scale;
          if (t === 0) ctx.moveTo(tx, ty);
          else ctx.lineTo(tx, ty);
        }
        ctx.stroke();
      }

      // Draw agent body
      const radius = isSelected ? 6 : 4;
      ctx.fillStyle = val.color;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();

      // Outer affinity pulse
      if (val.resonance > 0.5) {
        ctx.strokeStyle = val.color;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(x, y, radius + 4 * val.resonance, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Draw label
      ctx.fillStyle = '#f1f5f9';
      ctx.font = '9px "JetBrains Mono", monospace';
      ctx.fillText(val.label, x + 8, y + 3);
    }

    // Mark Global Theoretical Peak
    const optX = surface.bestK1 * scale;
    const optY = surface.bestK0 * scale;
    ctx.strokeStyle = '#10b981';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.arc(optX, optY, 14, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#10b981';
    ctx.font = '10px "JetBrains Mono", monospace';
    ctx.fillText('Target Resonance Peak', optX + 16, optY - 4);
  }, [swarmState, surface, selectedAgentId, config.gossipRadius]);

  const sortedValues = useMemo(() => {
    return [...swarmState.values].sort((a, b) => b.resonance - a.resonance);
  }, [swarmState.values]);

  return (
    <div className="space-y-6">
      {/* Overview Banner */}
      <div className="bg-[#0b0e17] border border-slate-800 rounded-lg p-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs uppercase tracking-wider text-cyan-400 font-mono">
                Asynchronous Swarm Transform Exploration
              </span>
              <span className="text-slate-600">·</span>
              <span className="text-xs text-slate-400 font-mono">
                No Central Global Clock
              </span>
            </div>
            <p className="text-sm text-slate-300 mt-1 max-w-3xl leading-relaxed">
              Instead of a central algorithm exhaustively searching all <span className="font-mono text-cyan-300">256² = 65,536</span> multiscale viewpoints,
              autonomous Values inhabit different coarse and fine phases <span className="font-mono text-cyan-300">(k₀, k₁)</span>.
              Strong structural responses increase local affinity; through asynchronous peer gossip, computation naturally gathers around transform contexts exhibiting peak structure.
            </p>
          </div>

          <div className="flex items-center gap-4 bg-slate-900/80 border border-slate-800 rounded-md px-4 py-2.5 shrink-0">
            <div>
              <div className="text-[10px] uppercase font-mono text-slate-400">Swarm Best Peak</div>
              <div className="text-xl font-mono font-bold text-cyan-400">
                {(swarmState.globalBestResonance * 100).toFixed(1)}%
              </div>
              <div className="text-[10px] text-cyan-500 font-mono">
                at ({swarmState.globalBestK0}, {swarmState.globalBestK1})
              </div>
            </div>
            <div className="h-8 w-[1px] bg-slate-800" />
            <div>
              <div className="text-[10px] uppercase font-mono text-slate-400">Cluster Concentration</div>
              <div className="text-xl font-mono font-bold text-emerald-400">
                {(swarmState.clusterConcentration * 100).toFixed(1)}%
              </div>
              <div className="text-[10px] text-emerald-500 font-mono">
                {swarmState.clusterConcentration > 0.6 ? 'Tightly Gathered' : 'Active Foraging'}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Stage: Phase Canvas (7 cols) + Swarm Controls & Leaderboard (5 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: 2D Phase Canvas */}
        <div className="lg:col-span-7 bg-[#0b0e17] border border-slate-800 rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold text-slate-200 uppercase tracking-wider font-mono">
              Multiscale Phase Space Torus [0, 256) × [0, 256)
            </h3>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setAffinityStrength(1.0);
                  setGossipRadius(95);
                  setExplorationNoise(0.08);
                  if (!isRunning) setIsRunning(true);
                }}
                className="px-3 py-1 text-xs font-mono font-medium rounded bg-cyan-500/20 text-cyan-200 border border-cyan-500/50 hover:bg-cyan-500/30 transition-all flex items-center gap-1 shadow-[0_0_10px_rgba(6,182,212,0.2)]"
              >
                <span>✨</span>
                <span>Auto-Converge Swarm</span>
              </button>

              <button
                onClick={() => setIsRunning(!isRunning)}
                className={`px-3 py-1 text-xs font-mono font-medium rounded transition-colors ${
                  isRunning
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30'
                    : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/30'
                }`}
              >
                {isRunning ? 'Pause' : 'Resume'}
              </button>
              <button
                onClick={handleReset}
                className="px-2.5 py-1 text-xs font-mono text-slate-400 bg-slate-900 border border-slate-800 rounded hover:text-slate-200"
              >
                Re-scatter
              </button>
            </div>
          </div>

          <div className="relative w-full aspect-square bg-slate-950 rounded border border-slate-800/80 overflow-hidden">
            <canvas
              ref={canvasRef}
              width={512}
              height={512}
              className="w-full h-full cursor-crosshair"
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const clickX = ((e.clientX - rect.left) / rect.width) * 256;
                const clickY = ((e.clientY - rect.top) / rect.height) * 256;
                // Find closest value
                let closest: SwarmValue | null = null;
                let minDist = 30;
                for (const v of swarmState.values) {
                  const d = Math.hypot(v.k1 - clickX, v.k0 - clickY);
                  if (d < minDist) {
                    minDist = d;
                    closest = v;
                  }
                }
                setSelectedAgentId(closest ? closest.id : null);
              }}
            />
          </div>

          <div className="flex items-center justify-between text-[11px] font-mono text-slate-500">
            <span>Horizontal: Local Phase k₁ ∈ [0, 255]</span>
            <span>Vertical: Coarse Phase k₀ ∈ [0, 255]</span>
          </div>
        </div>

        {/* Right: Controls & Values Leaderboard */}
        <div className="lg:col-span-5 space-y-4">
          {/* Swarm Dynamics Controls */}
          <div className="bg-[#0b0e17] border border-slate-800 rounded-lg p-4 space-y-3">
            <h3 className="text-xs font-semibold text-slate-200 uppercase tracking-wider font-mono">
              Swarm Parameters
            </h3>

            <div>
              <div className="flex justify-between text-xs font-mono mb-1">
                <span className="text-slate-400">Values in Swarm:</span>
                <span className="text-cyan-400 font-bold">{agentCount}</span>
              </div>
              <input
                type="range"
                min="8"
                max="48"
                step="4"
                value={agentCount}
                onChange={(e) => setAgentCount(parseInt(e.target.value))}
                className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
              />
            </div>

            <div>
              <div className="flex justify-between text-xs font-mono mb-1">
                <span className="text-slate-400">Gossip Affinity Strength:</span>
                <span className="text-cyan-400 font-bold">{(affinityStrength * 100).toFixed(0)}%</span>
              </div>
              <input
                type="range"
                min="0.1"
                max="1.0"
                step="0.05"
                value={affinityStrength}
                onChange={(e) => setAffinityStrength(parseFloat(e.target.value))}
                className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
              />
            </div>

            <div>
              <div className="flex justify-between text-xs font-mono mb-1">
                <span className="text-slate-400">Gossip Radius:</span>
                <span className="text-cyan-400 font-bold">{gossipRadius} units</span>
              </div>
              <input
                type="range"
                min="20"
                max="100"
                step="5"
                value={gossipRadius}
                onChange={(e) => setGossipRadius(parseInt(e.target.value))}
                className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
              />
            </div>

            <div>
              <div className="flex justify-between text-xs font-mono mb-1">
                <span className="text-slate-400">Exploration Jitter / Noise:</span>
                <span className="text-cyan-400 font-bold">{(explorationNoise * 100).toFixed(0)}%</span>
              </div>
              <input
                type="range"
                min="0.05"
                max="0.8"
                step="0.05"
                value={explorationNoise}
                onChange={(e) => setExplorationNoise(parseFloat(e.target.value))}
                className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
              />
            </div>
          </div>

          {/* Leaderboard of Values */}
          <div className="bg-[#0b0e17] border border-slate-800 rounded-lg p-4 space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold text-slate-200 uppercase tracking-wider font-mono">
                Active Values Leaderboard
              </h3>
              <span className="text-[11px] font-mono text-slate-500">
                {swarmState.totalGossipExchanges} gossip exchanges
              </span>
            </div>

            <div className="max-h-64 overflow-y-auto space-y-1.5 pr-1 font-mono text-xs">
              {sortedValues.slice(0, 8).map((val, rank) => {
                const isSelected = val.id === selectedAgentId;
                return (
                  <div
                    key={val.id}
                    onClick={() => setSelectedAgentId(isSelected ? null : val.id)}
                    className={`p-2 rounded border cursor-pointer transition-colors flex items-center justify-between ${
                      isSelected
                        ? 'bg-cyan-950/40 border-cyan-500 text-white'
                        : 'bg-slate-900/60 border-slate-800 text-slate-300 hover:bg-slate-900'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-slate-500 text-[10px]">#{rank + 1}</span>
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: val.color }} />
                      <span className="font-semibold">{val.label}</span>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="text-slate-400 text-[11px]">
                        ({val.k0}, {val.k1})
                      </span>
                      <span className="font-bold text-cyan-400">
                        {(val.resonance * 100).toFixed(0)}%
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
