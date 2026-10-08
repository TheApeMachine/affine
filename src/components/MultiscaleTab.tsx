import React, { useState, useMemo } from 'react';
import { SignalSource } from '../math/gf257';
import {
  holographicEncode,
  holographicDecode,
  computeMultiscaleSurface,
  MultiscaleSurface
} from '../math/multiscale';
import { findMultiscalePathToPeak } from '../math/autoSearch';
import { SignalRaster } from './SignalRaster';

interface MultiscaleTabProps {
  source: SignalSource;
}

export const MultiscaleTab: React.FC<MultiscaleTabProps> = ({ source }) => {
  const [k0, setK0] = useState<number>(17);
  const [k1, setK1] = useState<number>(43);
  const [damageType, setDamageType] = useState<'half_block' | 'center_quad' | 'striped_erasure' | 'custom'>('half_block');
  const [customErasedIndices, setCustomErasedIndices] = useState<Set<number>>(new Set());
  const [isClimbing, setIsClimbing] = useState<boolean>(false);

  // 1. Holographically encode the source
  const { encoded } = useMemo(() => {
    return holographicEncode(source.data, k0, k1, 16);
  }, [source.data, k0, k1]);

  // 2. Apply damage to encoded stream in transit
  const { damagedEncoded, erasedIndices } = useMemo(() => {
    const total = 256;
    const damaged: (number | null)[] = [...encoded];
    const erased = new Set<number>();

    if (damageType === 'half_block') {
      // 50% contiguous erasure: entire bottom half destroyed
      for (let i = 128; i < 256; i++) {
        damaged[i] = null;
        erased.add(i);
      }
    } else if (damageType === 'center_quad') {
      // Center 25% destruction: rows 4..11, cols 4..11
      for (let r = 4; r < 12; r++) {
        for (let c = 4; c < 12; c++) {
          const idx = r * 16 + c;
          damaged[idx] = null;
          erased.add(idx);
        }
      }
    } else if (damageType === 'striped_erasure') {
      // Alternating 4-cell stripes wiped out
      for (let i = 0; i < total; i++) {
        if (Math.floor(i / 8) % 2 === 0) {
          damaged[i] = null;
          erased.add(i);
        }
      }
    } else if (damageType === 'custom') {
      for (const idx of customErasedIndices) {
        damaged[idx] = null;
        erased.add(idx);
      }
    }

    return { damagedEncoded: damaged, erasedIndices: erased };
  }, [encoded, damageType, customErasedIndices]);

  // 3. Decode via Holographic Interleaved Engine
  const holographicResult = useMemo(() => {
    return holographicDecode(damagedEncoded, source.data, k0, k1, 16);
  }, [damagedEncoded, source.data, k0, k1]);

  // 4. Naive baseline: apply same erasure directly on raw un-interleaved space
  const naiveDamaged: (number | null)[] = useMemo(() => {
    return source.data.map((val, idx) => (erasedIndices.has(idx) ? null : val));
  }, [source.data, erasedIndices]);

  // Compute 2D Multiscale Resonance Surface S(k0, k1)
  const surface: MultiscaleSurface = useMemo(() => {
    return computeMultiscaleSurface(source.data, 'orbit_smoothness', 16);
  }, [source.data]);

  const handleAutoClimb = () => {
    if (isClimbing) return;
    setIsClimbing(true);
    const path = findMultiscalePathToPeak(surface, k0, k1);
    let step = 0;
    const interval = setInterval(() => {
      if (step < path.length) {
        setK0(path[step].k0);
        setK1(path[step].k1);
        step++;
      } else {
        clearInterval(interval);
        setIsClimbing(false);
      }
    }, 100);
  };

  const toggleCustomCell = (idx: number) => {
    const next = new Set(customErasedIndices);
    if (next.has(idx)) next.delete(idx);
    else next.add(idx);
    setCustomErasedIndices(next);
  };

  const clearCustomDamage = () => {
    setCustomErasedIndices(new Set());
  };

  return (
    <div className="space-y-6">
      {/* Overview Banner */}
      <div className="bg-[#0b0e17] border border-slate-800 rounded-lg p-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs uppercase tracking-wider text-cyan-400 font-mono">
                Hierarchical GF(257) Multiscale Space & Holographic Erasure
              </span>
              <span className="text-slate-600">·</span>
              <span className="text-xs text-slate-400 font-mono">
                Coordinates (x₀, x₁) ∈ GF(257) × GF(257)
              </span>
            </div>
            <p className="text-sm text-slate-300 mt-1 max-w-3xl leading-relaxed">
              Instead of a single flat field, points contain nested subcells with hierarchical affine rotations:
              <span className="font-mono text-cyan-300"> x₀' = a₀x₀ + b₀</span> (global macro-structure) and{' '}
              <span className="font-mono text-cyan-300">x₁' = a₁x₁ + b₁</span> (intra-cell local structure).
              By deliberately interleaving between scales (<span className="text-amber-300 font-mono">rotate → spread → subdivide → rotate locally → spread</span>),
              local damage cannot erase all witnesses of a feature, creating true holographic error resilience.
            </p>
          </div>

          <div className="flex items-center gap-4 bg-slate-900/80 border border-slate-800 rounded-md px-4 py-2.5 shrink-0">
            <div>
              <div className="text-[10px] uppercase font-mono text-slate-400">Erased Samples</div>
              <div className="text-xl font-mono font-bold text-rose-400">
                {erasedIndices.size} / 256
              </div>
              <div className="text-[10px] text-rose-500 font-mono">
                {((erasedIndices.size / 256) * 100).toFixed(0)}% payload wiped
              </div>
            </div>
            <div className="h-8 w-[1px] bg-slate-800" />
            <div>
              <div className="text-[10px] uppercase font-mono text-slate-400">Holographic PSNR</div>
              <div className="text-xl font-mono font-bold text-emerald-400">
                {holographicResult.psnr.toFixed(1)} dB
              </div>
              <div className="text-[10px] text-emerald-500 font-mono">Dispersed recovery</div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Grid: Controls + Holographic Experiment Stage */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Multiscale Rotations & Damage Injector (4 cols) */}
        <div className="lg:col-span-4 space-y-4">
          {/* Multiscale Parameter Controls */}
          <div className="bg-[#0b0e17] border border-slate-800 rounded-lg p-4 space-y-4">
            <h3 className="text-xs font-semibold text-slate-200 uppercase tracking-wider font-mono">
              1. Hierarchical Viewpoint (k₀, k₁)
            </h3>

            <div>
              <div className="flex justify-between items-center text-xs mb-1 font-mono">
                <span className="text-slate-400">Scale 0 Global Rotation (k₀):</span>
                <span className="text-cyan-400 font-bold">{k0}</span>
              </div>
              <input
                type="range"
                min="0"
                max="255"
                value={k0}
                onChange={(e) => setK0(parseInt(e.target.value))}
                className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
              />
              <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                Permutes macro-regions (large concepts)
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center text-xs mb-1 font-mono">
                <span className="text-slate-400">Scale 1 Local Rotation (k₁):</span>
                <span className="text-cyan-400 font-bold">{k1}</span>
              </div>
              <input
                type="range"
                min="0"
                max="255"
                value={k1}
                onChange={(e) => setK1(parseInt(e.target.value))}
                className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
              />
              <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                Permutes intra-cell structure (fragments / symbols)
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleAutoClimb}
                disabled={isClimbing}
                className="flex-1 py-2 px-3 text-xs font-mono font-medium rounded bg-cyan-500/20 border border-cyan-500/50 text-cyan-200 hover:bg-cyan-500/30 transition-all flex items-center justify-center gap-1.5 shadow-[0_0_10px_rgba(6,182,212,0.15)]"
              >
                <span>✨</span>
                <span>{isClimbing ? 'Climbing to Peak...' : 'Auto-Climb to Peak'}</span>
              </button>

              <button
                onClick={() => {
                  setK0(surface.bestK0);
                  setK1(surface.bestK1);
                }}
                className="py-2 px-3 text-xs font-mono font-medium rounded bg-slate-900 border border-slate-700 text-slate-300 hover:text-white transition-colors"
                title="Instant Snap"
              >
                Peak
              </button>
            </div>
          </div>

          {/* Damage Injector Controls */}
          <div className="bg-[#0b0e17] border border-slate-800 rounded-lg p-4 space-y-3">
            <h3 className="text-xs font-semibold text-slate-200 uppercase tracking-wider font-mono">
              2. Inject Severe Channel Damage
            </h3>
            <p className="text-[11px] text-slate-400">
              Drag your mouse across the middle grid to erase cells, or pick a preset:
            </p>

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setDamageType('half_block')}
                className={`p-2 rounded text-xs font-mono border text-left ${
                  damageType === 'half_block'
                    ? 'bg-rose-500/15 border-rose-500/50 text-rose-300'
                    : 'bg-slate-900/80 border-slate-800 text-slate-400 hover:text-slate-300'
                }`}
              >
                <div className="font-semibold">Half-Plane (50%)</div>
                <div className="text-[10px] text-slate-500">128 contiguous cells</div>
              </button>

              <button
                onClick={() => setDamageType('center_quad')}
                className={`p-2 rounded text-xs font-mono border text-left ${
                  damageType === 'center_quad'
                    ? 'bg-rose-500/15 border-rose-500/50 text-rose-300'
                    : 'bg-slate-900/80 border-slate-800 text-slate-400 hover:text-slate-300'
                }`}
              >
                <div className="font-semibold">Center Core (25%)</div>
                <div className="text-[10px] text-slate-500">64 cells in center</div>
              </button>

              <button
                onClick={() => setDamageType('striped_erasure')}
                className={`p-2 rounded text-xs font-mono border text-left ${
                  damageType === 'striped_erasure'
                    ? 'bg-rose-500/15 border-rose-500/50 text-rose-300'
                    : 'bg-slate-900/80 border-slate-800 text-slate-400 hover:text-slate-300'
                }`}
              >
                <div className="font-semibold">Periodic Stripes</div>
                <div className="text-[10px] text-slate-500">Multiscale bands</div>
              </button>

              <button
                onClick={() => setDamageType('custom')}
                className={`p-2 rounded text-xs font-mono border text-left ${
                  damageType === 'custom'
                    ? 'bg-rose-500/15 border-rose-500/50 text-rose-300'
                    : 'bg-slate-900/80 border-slate-800 text-slate-400 hover:text-slate-300'
                }`}
              >
                <div className="font-semibold">Click to Damage</div>
                <div className="text-[10px] text-slate-500">{customErasedIndices.size} cells erased</div>
              </button>
            </div>

            {damageType === 'custom' && (
              <button
                onClick={clearCustomDamage}
                className="w-full py-1.5 text-xs font-mono text-slate-400 bg-slate-900 border border-slate-800 rounded hover:text-slate-200"
              >
                Clear Custom Erasures
              </button>
            )}
          </div>

          {/* Multiscale 2D Resonance Heatmap S(k0, k1) */}
          <div className="bg-[#0b0e17] border border-slate-800 rounded-lg p-4 space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold text-slate-200 uppercase tracking-wider font-mono">
                Multiscale Surface S(k₀, k₁)
              </h3>
              <span className="text-[11px] font-mono text-slate-400">
                Peak: ({surface.bestK0}, {surface.bestK1})
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              The 256² multiscale orientation surface. Brighter cells represent alignments where multiscale resonance is maximized.
            </p>

            <div
              className="grid gap-[1px] bg-slate-900 border border-slate-800 rounded p-1 aspect-square"
              style={{
                gridTemplateColumns: 'repeat(16, minmax(0, 1fr))',
                gridTemplateRows: 'repeat(16, minmax(0, 1fr))'
              }}
            >
              {surface.grid.map((row, rIdx) =>
                row.map((val, cIdx) => {
                  const isCurrent =
                    Math.abs(surface.k0Values[rIdx] - k0) < 16 &&
                    Math.abs(surface.k1Values[cIdx] - k1) < 16;

                  // Blue to Cyan to Amber heat
                  const r = Math.round(val * 240);
                  const g = Math.round(val * 190);
                  const b = Math.round((1 - val) * 160 + 50);

                  return (
                    <div
                      key={`${rIdx}-${cIdx}`}
                      onClick={() => {
                        setK0(surface.k0Values[rIdx]);
                        setK1(surface.k1Values[cIdx]);
                      }}
                      style={{ backgroundColor: `rgb(${r}, ${g}, ${b})` }}
                      className={`aspect-square cursor-pointer transition-transform hover:scale-125 rounded-[1px] ${
                        isCurrent ? 'ring-2 ring-white z-10' : ''
                      }`}
                      title={`k0=${surface.k0Values[rIdx]}, k1=${surface.k1Values[cIdx]}, S=${val.toFixed(2)}`}
                    />
                  );
                })
              )}
            </div>
            <div className="flex justify-between text-[10px] font-mono text-slate-500">
              <span>k₀ (Macro) →</span>
              <span>↓ k₁ (Micro)</span>
            </div>
          </div>
        </div>

        {/* Right Column: Holographic Interleaving Demonstration (8 cols) */}
        <div className="lg:col-span-8 space-y-6">
          {/* Side-by-side Proof: Naive Un-interleaved vs Holographic Interleaved */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Left: Naive Direct Failure Mode */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-rose-400" />
                <span className="text-xs font-semibold text-rose-300 font-mono uppercase tracking-wide">
                  Baseline Without Interleaving
                </span>
              </div>
              <SignalRaster
                data={naiveDamaged}
                title="Direct Erasure in Spatial Domain"
                subtitle="Catastrophic loss: large contiguous feature permanently destroyed"
                droppedIndices={erasedIndices}
              />
              <div className="p-3 bg-rose-950/20 border border-rose-900/40 rounded text-xs font-mono text-rose-300 space-y-1">
                <div className="font-semibold text-rose-400">Irrecoverable Erasure:</div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  When a large contiguous block is erased in standard coordinates, 0% of the interior pixels survive. No local reconstruction rule can recover the lost features.
                </p>
              </div>
            </div>

            {/* Right: Holographic Interleaved Victory */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-400" />
                <span className="text-xs font-semibold text-emerald-300 font-mono uppercase tracking-wide">
                  Multiscale Holographic Decoding
                </span>
              </div>
              <SignalRaster
                data={holographicResult.reconstructed}
                title="Holographically Reconstructed Object"
                subtitle={`PSNR ${holographicResult.psnr.toFixed(1)} dB (Dispersed completion)`}
              />
              <div className="p-3 bg-emerald-950/20 border border-emerald-900/40 rounded text-xs font-mono text-emerald-300 space-y-1">
                <div className="font-semibold text-emerald-400">Holographic Survival:</div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Because data was interleaved across scale and phase, the same 50% contiguous wipeout was transformed into isolated single-cell punctures evenly distributed across all regions. Surviving neighbors reconstruct the entire geometry!
                </p>
              </div>
            </div>
          </div>

          {/* Holographic Pipeline Walkthrough */}
          <div className="bg-[#0b0e17] border border-slate-800 rounded-lg p-4 space-y-3">
            <h4 className="text-xs font-semibold text-slate-200 uppercase tracking-wider font-mono">
              The Multiscale Interleaving Pipeline
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <SignalRaster
                data={encoded}
                title="1. Holographically Encoded Stream"
                subtitle="Rotate k0 → Spread → Subdivide → Rotate k1"
                mode="heatmap"
              />
              <SignalRaster
                data={damagedEncoded}
                title="2. Channel Damage in Transit"
                subtitle={`${erasedIndices.size} cells destroyed in transit`}
                droppedIndices={erasedIndices}
                interactivePaint={damageType === 'custom'}
                onPaint={toggleCustomCell}
              />
              <SignalRaster
                data={holographicResult.reconstructed}
                title="3. Inverted & Completed Output"
                subtitle="Global structure restored from local witnesses"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-2 text-xs font-mono text-slate-400">
              <span className="text-cyan-400 font-semibold">Recursive Invariant:</span>
              <span>rotate(scale 0)</span>
              <span>→</span>
              <span>interleave/transpose</span>
              <span>→</span>
              <span>rotate(scale 1)</span>
              <span>→</span>
              <span>witness dispersion</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
