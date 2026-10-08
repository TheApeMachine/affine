import React, { useState, useMemo, useEffect, useRef } from 'react';
import { SignalSource, GENERATOR_POWERS } from '../math/gf257';
import {
  DecimationType,
  CompletionRule,
  runDecimationPipeline,
  computeRho,
  scanOrbitResonance
} from '../math/compression';
import { findTopDiscoveries, ResonantDiscovery } from '../math/autoSearch';
import { SignalRaster } from './SignalRaster';
import { OrbitWheelVisualizer } from './OrbitWheelVisualizer';
import { VisualComparisonOverlay } from './VisualComparisonOverlay';

interface DecimationTabProps {
  source: SignalSource;
  onUpdateSourceData: (newData: number[]) => void;
  externalTriggerK?: number | null;
}

export const DecimationTab: React.FC<DecimationTabProps> = ({
  source,
  onUpdateSourceData,
  externalTriggerK
}) => {
  const [rotationK, setRotationK] = useState<number>(0);
  const [phaseB, setPhaseB] = useState<number>(0);
  const [decimationMode, setDecimationMode] = useState<DecimationType>('stride_2');
  const [customFraction, setCustomFraction] = useState<number>(0.5);
  const [completionRule, setCompletionRule] = useState<CompletionRule>('orbit_smoothness');
  const [isAutoSweeping, setIsAutoSweeping] = useState<boolean>(false);
  const [displayView, setDisplayView] = useState<'rasters' | 'wheel' | 'comparison'>('rasters');

  // Handle external trigger if supplied by discovery tour
  useEffect(() => {
    if (externalTriggerK !== undefined && externalTriggerK !== null) {
      setRotationK(externalTriggerK);
    }
  }, [externalTriggerK]);

  // Compute active fraction
  const currentFraction = useMemo(() => {
    switch (decimationMode) {
      case 'stride_2': return 0.5;
      case 'stride_4': return 0.25;
      case 'stride_8': return 0.125;
      case 'stride_16': return 0.0625;
      case 'burst_block': return 0.5;
      case 'random_fraction': return customFraction;
      default: return 0.5;
    }
  }, [decimationMode, customFraction]);

  // Run pipeline for current settings
  const pipelineResult = useMemo(() => {
    return runDecimationPipeline(
      source.data,
      rotationK,
      phaseB,
      decimationMode,
      currentFraction,
      completionRule
    );
  }, [source.data, rotationK, phaseB, decimationMode, currentFraction, completionRule]);

  // Compute baseline rho(X, 0)
  const baselineRhoInfo = useMemo(() => {
    return computeRho(source.data, 0, 0, completionRule);
  }, [source.data, completionRule]);

  // Scan full orbit resonance spectrum S(k)
  const orbitScan = useMemo(() => {
    return scanOrbitResonance(source.data, completionRule, phaseB, 2);
  }, [source.data, completionRule, phaseB]);

  // Automated Sweet Spot Discoveries
  const discoveries: ResonantDiscovery[] = useMemo(() => {
    return findTopDiscoveries(source.data, completionRule);
  }, [source.data, completionRule]);

  // Auto-sweep animation loop
  const sweepIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const startAutoSweep = () => {
    if (isAutoSweeping) {
      if (sweepIntervalRef.current) clearInterval(sweepIntervalRef.current);
      setIsAutoSweeping(false);
      return;
    }

    setIsAutoSweeping(true);
    let currentK = rotationK;
    let stepsRemaining = 128;

    sweepIntervalRef.current = setInterval(() => {
      currentK = (currentK + 2) % 256;
      setRotationK(currentK);
      stepsRemaining--;

      // If we land right on the optimal peak, celebrate and stop!
      if (currentK === orbitScan.bestK || stepsRemaining <= 0) {
        if (sweepIntervalRef.current) clearInterval(sweepIntervalRef.current);
        setIsAutoSweeping(false);
      }
    }, 45);
  };

  useEffect(() => {
    return () => {
      if (sweepIntervalRef.current) clearInterval(sweepIntervalRef.current);
    };
  }, []);

  const multiplierA = GENERATOR_POWERS[((rotationK % 256) + 256) % 256];
  const retainedCount = Math.round(currentFraction * 256);

  return (
    <div className="space-y-6">
      {/* Visual Summary Card */}
      <div className="bg-[#0b0e17] border border-slate-800 rounded-lg p-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs uppercase tracking-wider text-cyan-400 font-mono">
                Decimation & Structural Completion
              </span>
              <span className="text-slate-600">·</span>
              <span className="text-xs text-slate-400 font-mono">
                {source.name}
              </span>
            </div>
            <p className="text-sm text-slate-300 mt-1 max-w-3xl leading-relaxed">
              Rotate data under affine orbit <span className="font-mono text-cyan-300">k</span>, throw away cells, and complete missing pieces.
              Watch how certain rotations align the shapes so that discarded pixels become completely predictable!
            </p>
          </div>

          {/* Visual Outcome Badges */}
          <div className="flex items-center gap-3 bg-slate-900/90 border border-slate-800 rounded-lg px-4 py-3 shrink-0">
            <div>
              <div className="text-[10px] uppercase font-mono text-slate-400">Visual Quality</div>
              <div className="flex items-center gap-1.5 mt-0.5">
                {pipelineResult.isExact ? (
                  <>
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping inline-block" />
                    <span className="text-sm font-bold font-mono text-emerald-400">FLAWLESS MATCH</span>
                  </>
                ) : pipelineResult.isNearExact ? (
                  <>
                    <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />
                    <span className="text-sm font-bold font-mono text-amber-400">HIGH CLARITY</span>
                  </>
                ) : (
                  <>
                    <span className="w-2 h-2 rounded-full bg-rose-400 inline-block" />
                    <span className="text-sm font-bold font-mono text-rose-400">PARTIAL BLUR</span>
                  </>
                )}
              </div>
              <div className="text-[11px] text-slate-400 font-mono">
                {pipelineResult.psnr >= 90 ? '0 pixel discrepancy' : `${pipelineResult.psnr.toFixed(0)} dB fidelity`}
              </div>
            </div>

            <div className="h-8 w-[1px] bg-slate-800 mx-1" />

            <div>
              <div className="text-[10px] uppercase font-mono text-slate-400">Compression</div>
              <div className="text-lg font-mono font-bold text-cyan-400 mt-0.5">
                {pipelineResult.bitBudget.compressionRatio.toFixed(1)}× Smaller
              </div>
              <div className="text-[11px] text-emerald-400 font-mono">
                {retainedCount} of 256 cells kept
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Automated Sweet Spot Discoveries: 1-Click Cards */}
      <div className="bg-[#090c14] border border-cyan-950/60 rounded-lg p-4 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="text-base">✨</span>
            <h4 className="text-xs font-semibold text-cyan-300 uppercase tracking-wider font-mono">
              Auto-Discovered Sweet Spots for {source.name}
            </h4>
          </div>
          <button
            onClick={startAutoSweep}
            className={`px-3 py-1.5 text-xs font-mono font-medium rounded transition-all flex items-center gap-1.5 ${
              isAutoSweeping
                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/50'
                : 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/40 hover:bg-cyan-500/25'
            }`}
          >
            <span>{isAutoSweeping ? '⏹ Stop Scanner' : '🔍 Live Auto-Sweep Orbit'}</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
          {discoveries.map((disc, idx) => {
            const isSelected = rotationK === disc.k;
            return (
              <button
                key={idx}
                onClick={() => {
                  setRotationK(disc.k);
                  if (disc.rho <= 0.125) setDecimationMode('stride_8');
                  else if (disc.rho <= 0.25) setDecimationMode('stride_4');
                  else if (disc.rho <= 0.5) setDecimationMode('stride_2');
                }}
                className={`p-3 rounded-lg border text-left transition-all ${
                  isSelected
                    ? 'bg-cyan-950/40 border-cyan-400 shadow-[0_0_12px_rgba(6,182,212,0.25)]'
                    : 'bg-slate-900/60 border-slate-800 hover:bg-slate-900 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded font-semibold ${
                    disc.badge === 'Maximum Space Saving'
                      ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                      : disc.badge === 'Exact Structural Lock'
                      ? 'bg-cyan-950 text-cyan-300 border border-cyan-800'
                      : 'bg-amber-950 text-amber-300 border border-amber-800'
                  }`}>
                    {disc.badge}
                  </span>
                  <span className="text-xs font-mono font-bold text-cyan-400">
                    k = {disc.k}
                  </span>
                </div>
                <div className="text-xs font-semibold text-slate-200 mt-1">
                  {disc.label}
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5 leading-snug">
                  {disc.description}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Grid: Controls + Visual Stages */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Interactive Parameters (4 cols) */}
        <div className="lg:col-span-4 space-y-4">
          {/* Rotation Scrubber */}
          <div className="bg-[#0b0e17] border border-slate-800 rounded-lg p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold text-slate-200 uppercase tracking-wider font-mono">
                1. Affine Rotation Phase (k)
              </h3>
              <button
                onClick={() => setRotationK(orbitScan.bestK)}
                className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950/60 text-emerald-300 border border-emerald-800/60 hover:bg-emerald-900/60"
              >
                Snap to Peak (k={orbitScan.bestK})
              </button>
            </div>

            <div>
              <div className="flex justify-between items-center text-xs mb-1.5 font-mono">
                <span className="text-slate-400">Rotation Angle k:</span>
                <span className="text-cyan-400 font-bold text-sm">{rotationK}</span>
              </div>
              <input
                type="range"
                min="0"
                max="255"
                value={rotationK}
                onChange={(e) => setRotationK(parseInt(e.target.value))}
                className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
              />
              <div className="flex justify-between text-[10px] text-slate-500 font-mono mt-1">
                <span>0 (Unrotated)</span>
                <span>multiplier a = {multiplierA}</span>
                <span>255</span>
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center text-xs mb-1 font-mono">
                <span className="text-slate-400">Shift Offset b:</span>
                <span className="text-slate-300 font-bold">{phaseB}</span>
              </div>
              <input
                type="range"
                min="0"
                max="255"
                value={phaseB}
                onChange={(e) => setPhaseB(parseInt(e.target.value))}
                className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
              />
            </div>
          </div>

          {/* Decimation Selector */}
          <div className="bg-[#0b0e17] border border-slate-800 rounded-lg p-4 space-y-3">
            <h3 className="text-xs font-semibold text-slate-200 uppercase tracking-wider font-mono">
              2. How Much Data to Keep
            </h3>

            <div className="grid grid-cols-2 gap-1.5 font-mono">
              {[
                { id: 'stride_2', label: 'Keep 50% (128 cells)', desc: '2x smaller' },
                { id: 'stride_4', label: 'Keep 25% (64 cells)', desc: '4x smaller' },
                { id: 'stride_8', label: 'Keep 12.5% (32 cells)', desc: '8x smaller' },
                { id: 'stride_16', label: 'Keep 6.25% (16 cells)', desc: '16x smaller' },
              ].map((item) => (
                <button
                  key={item.id}
                  onClick={() => setDecimationMode(item.id as DecimationType)}
                  className={`p-2 text-left rounded text-xs transition-colors border ${
                    decimationMode === item.id
                      ? 'bg-cyan-500/15 border-cyan-500 text-cyan-200 font-medium'
                      : 'bg-slate-900/80 border-slate-800 text-slate-400 hover:text-slate-300'
                  }`}
                >
                  <div>{item.label}</div>
                  <div className="text-[10px] text-emerald-400">{item.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Reconstruction Rule */}
          <div className="bg-[#0b0e17] border border-slate-800 rounded-lg p-4 space-y-2">
            <h3 className="text-xs font-semibold text-slate-200 uppercase tracking-wider font-mono">
              3. Completion Engine
            </h3>
            <div className="space-y-1.5">
              {[
                { id: 'orbit_smoothness', label: 'Orbit Continuity (Natural flow)', desc: 'Fills gaps by following harmonic curves' },
                { id: 'sparse_spectral', label: 'Compressed Sensing (Frequency)', desc: 'Solves sparse frequency basis pursuit' },
                { id: 'hybrid_optimal', label: 'Hybrid Structural Consensus', desc: 'Combines geometric and frequency agreement' },
              ].map((r) => (
                <button
                  key={r.id}
                  onClick={() => setCompletionRule(r.id as CompletionRule)}
                  className={`w-full p-2 text-left rounded text-xs border font-mono transition-colors ${
                    completionRule === r.id
                      ? 'bg-cyan-500/10 border-cyan-500/50 text-cyan-200'
                      : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <div className="font-semibold text-slate-200">{r.label}</div>
                  <div className="text-[10px] text-slate-500">{r.desc}</div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Visual Stage / Wheel / Comparison (8 cols) */}
        <div className="lg:col-span-8 space-y-4">
          {/* View Mode Switcher */}
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <div className="flex items-center gap-1.5 p-0.5 bg-slate-900 border border-slate-800 rounded">
              <button
                onClick={() => setDisplayView('rasters')}
                className={`px-3 py-1.5 text-xs font-mono rounded transition-colors ${
                  displayView === 'rasters'
                    ? 'bg-cyan-500/20 text-cyan-300 font-medium'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                4-Stage Pipeline Grids
              </button>
              <button
                onClick={() => setDisplayView('comparison')}
                className={`px-3 py-1.5 text-xs font-mono rounded transition-colors ${
                  displayView === 'comparison'
                    ? 'bg-cyan-500/20 text-cyan-300 font-medium'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Before / After Visual Slider
              </button>
              <button
                onClick={() => setDisplayView('wheel')}
                className={`px-3 py-1.5 text-xs font-mono rounded transition-colors ${
                  displayView === 'wheel'
                    ? 'bg-cyan-500/20 text-cyan-300 font-medium'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Orbit Ring Wheel
              </button>
            </div>

            <div className="text-xs font-mono text-slate-400 hidden sm:block">
              {retainedCount} cells kept → 256 recovered
            </div>
          </div>

          {/* Conditional View: 4-Stage Rasters */}
          {displayView === 'rasters' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
              <SignalRaster
                data={pipelineResult.original}
                title="1. Original Input"
                subtitle="Complete uncompressed image"
              />
              <SignalRaster
                data={pipelineResult.transformed}
                title="2. Affine Orbit Twist"
                subtitle={`Rotated by phase k = ${rotationK}`}
                mode="heatmap"
              />
              <SignalRaster
                data={pipelineResult.decimatedTransformed}
                title="3. Decimated Survivors"
                subtitle={`Only ${retainedCount} dots retained`}
                mode="heatmap"
              />
              <SignalRaster
                data={pipelineResult.reconstructedOriginal}
                title="4. Reconstructed Output"
                subtitle={pipelineResult.isExact ? 'Flawless 100% match' : 'Completed image'}
              />
            </div>
          )}

          {/* Conditional View: Split Slider / Discrepancy Heatmap */}
          {displayView === 'comparison' && (
            <VisualComparisonOverlay
              original={pipelineResult.original}
              reconstructed={pipelineResult.reconstructedOriginal}
              retainedCount={retainedCount}
              isExact={pipelineResult.isExact}
              psnr={pipelineResult.psnr}
            />
          )}

          {/* Conditional View: Orbit Wheel */}
          {displayView === 'wheel' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
              <OrbitWheelVisualizer
                k={rotationK}
                b={phaseB}
                keptMask={pipelineResult.transformed.map((_, i) => pipelineResult.decimatedTransformed[i] !== null)}
              />
              <div className="space-y-3 p-4 bg-[#0b0e17] border border-slate-800 rounded-lg">
                <h4 className="text-xs font-semibold text-slate-200 font-mono uppercase tracking-wider">
                  How the Wheel Works
                </h4>
                <p className="text-xs text-slate-300 leading-relaxed">
                  The perimeter represents the 256 cells arranged around a finite field ring.
                  The chords show how rotation <span className="text-cyan-300 font-mono">k = {rotationK}</span> maps each cell.
                  When chords form symmetrical geometric patterns (stars, braids, or harmonic spokes), the transformed signal achieves maximum compressibility!
                </p>
                <div className="p-3 bg-slate-900 rounded border border-slate-800 text-xs font-mono text-cyan-400">
                  Multiplier a = {multiplierA} (Primitive Root generator g = 3)
                </div>
              </div>
            </div>
          )}

          {/* Resonance Spectrum S(k) Chart with Interactive Click-to-Snap */}
          <div className="bg-[#0b0e17] border border-slate-800 rounded-lg p-4 space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-xs font-semibold text-slate-200 uppercase tracking-wider font-mono">
                  Orbit Resonance Landscape S(k)
                </h4>
                <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                  High peaks are sweet spots where the object's hidden redundancy is easiest to exploit.
                </p>
              </div>
              <div className="text-xs font-mono text-emerald-400 font-bold">
                Optimal Peak: k* = {orbitScan.bestK}
              </div>
            </div>

            <div
              className="relative w-full h-28 bg-slate-950 rounded border border-slate-800/80 p-2 cursor-pointer"
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const clickFraction = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
                const clickedK = Math.round(clickFraction * 255);
                setRotationK(clickedK);
              }}
            >
              <svg className="w-full h-full overflow-visible" preserveAspectRatio="none" viewBox="0 0 256 100">
                <path
                  d={`M 0 100 ${orbitScan.rotations
                    .map((k, idx) => `L ${k} ${100 - orbitScan.resonanceScores[idx] * 90}`)
                    .join(' ')} L 256 100 Z`}
                  fill="url(#specGrad)"
                  opacity="0.3"
                />
                <path
                  d={`M 0 ${100 - orbitScan.resonanceScores[0] * 90} ${orbitScan.rotations
                    .map((k, idx) => `L ${k} ${100 - orbitScan.resonanceScores[idx] * 90}`)
                    .join(' ')}`}
                  fill="none"
                  stroke="#06b6d4"
                  strokeWidth="1.5"
                />
                {/* Active rotation marker line */}
                <line
                  x1={rotationK}
                  y1="0"
                  x2={rotationK}
                  y2="100"
                  stroke="#38bdf8"
                  strokeWidth="2"
                />
                {/* Optimal peak marker */}
                <circle
                  cx={orbitScan.bestK}
                  cy={100 - (1 - orbitScan.bestRho) * 90}
                  r="4"
                  fill="#10b981"
                  stroke="#080a10"
                  strokeWidth="1.5"
                />
                <defs>
                  <linearGradient id="specGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.8" />
                    <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.0" />
                  </linearGradient>
                </defs>
              </svg>
            </div>
            <div className="flex justify-between text-[10px] font-mono text-slate-500">
              <span>Click anywhere on the curve to test that rotation</span>
              <span>k ∈ [0, 255]</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
