import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  SUBSTRATES,
  PRESET_TRAJECTORIES,
  computeMoireSuperposition,
  MoireSubstrate,
  TrajectoryStep
} from '../math/moireGenerative';
import { sonifier } from '../math/audioSynthesis';

export const GenerativeMoireTab: React.FC = () => {
  const [selectedSubstrateId, setSelectedSubstrateId] = useState<string>('alice_wonderland');
  const [selectedTrajectoryId, setSelectedTrajectoryId] = useState<string>('alice_unfolding');
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);

  // Manual transform state for Grid A and Grid B
  const [k1, setK1] = useState<number>(0);
  const [shiftX1, setShiftX1] = useState<number>(0);
  const [shiftY1, setShiftY1] = useState<number>(0);

  const [k2, setK2] = useState<number>(0);
  const [shiftX2, setShiftX2] = useState<number>(0);
  const [shiftY2, setShiftY2] = useState<number>(0);

  const [synthesizedStory, setSynthesizedStory] = useState<string[]>(["ALICE"]);
  const [viewMode, setViewMode] = useState<'superposition' | 'side_by_side'>('superposition');

  const substrate: MoireSubstrate = useMemo(() => {
    return SUBSTRATES.find(s => s.id === selectedSubstrateId) || SUBSTRATES[0];
  }, [selectedSubstrateId]);

  const activeTrajectory = useMemo(() => {
    return PRESET_TRAJECTORIES.find(t => t.id === selectedTrajectoryId) || PRESET_TRAJECTORIES[0];
  }, [selectedTrajectoryId]);

  // Compute Moiré Superposition
  const moireResult = useMemo(() => {
    return computeMoireSuperposition(substrate.characters, k1, shiftX1, shiftY1, k2, shiftX2, shiftY2);
  }, [substrate.characters, k1, shiftX1, shiftY1, k2, shiftX2, shiftY2]);

  // Apply trajectory step
  const applyStep = (step: TrajectoryStep) => {
    setK1(step.k1);
    setShiftX1(step.shiftX1);
    setShiftY1(step.shiftY1);
    setK2(step.k2);
    setShiftX2(step.shiftX2);
    setShiftY2(step.shiftY2);

    if (sonifier.getIsEnabled()) {
      sonifier.playGossipChime(step.resonanceEnergy);
    }
  };

  // Trajectory playback loop
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!isPlaying) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    timerRef.current = setInterval(() => {
      setCurrentStepIndex(prev => {
        const nextIdx = (prev + 1) % activeTrajectory.steps.length;
        const nextStep = activeTrajectory.steps[nextIdx];
        applyStep(nextStep);

        setSynthesizedStory(story => {
          if (nextIdx === 0) return [nextStep.generatedToken];
          return [...story, nextStep.generatedToken];
        });

        return nextIdx;
      });
    }, 1200);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isPlaying, activeTrajectory]);

  // Handle manual step jump
  const handleSelectStep = (idx: number) => {
    setCurrentStepIndex(idx);
    const step = activeTrajectory.steps[idx];
    applyStep(step);

    // Rebuild story up to this step
    const slice = activeTrajectory.steps.slice(0, idx + 1).map(s => s.generatedToken);
    setSynthesizedStory(slice);
  };

  const currentStep = activeTrajectory.steps[currentStepIndex];

  return (
    <div className="space-y-6">
      {/* Overview Banner */}
      <div className="bg-[#0b0e17] border border-slate-800 rounded-lg p-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs uppercase tracking-wider text-cyan-400 font-mono">
                Generative Moiré Interference & Affine Trajectory Synthesis
              </span>
              <span className="text-slate-600">·</span>
              <span className="text-xs text-slate-400 font-mono">
                Iterated Function Systems (IFS) for Natural Language
              </span>
            </div>
            <p className="text-sm text-slate-300 mt-1 max-w-3xl leading-relaxed">
              Instead of relying on multi-billion parameter neural nets, language is treated as a <span className="text-cyan-300 font-semibold">deterministic trajectory through affine space</span>.
              By rotating and shifting multiple copies of a base alphabet crystal, <span className="text-emerald-300 font-semibold">Moiré interference fringes</span> filter, group, and synthesize coherent text from pure geometry!
            </p>
          </div>

          <div className="flex items-center gap-3 bg-slate-900/90 border border-slate-800 rounded-lg px-4 py-2.5 shrink-0">
            <div>
              <div className="text-[10px] uppercase font-mono text-slate-400">Resonant Cells</div>
              <div className="text-xl font-mono font-bold text-cyan-400">
                {moireResult.constructiveCount} / 256
              </div>
              <div className="text-[10px] text-cyan-500 font-mono">Constructive overlap</div>
            </div>
            <div className="h-8 w-[1px] bg-slate-800" />
            <div>
              <div className="text-[10px] uppercase font-mono text-slate-400">Generative State</div>
              <div className="text-sm font-mono font-bold text-emerald-400 mt-1">
                {currentStep?.generatedToken || "SYNTHESIS"}
              </div>
              <div className="text-[10px] text-emerald-500 font-mono">Step #{currentStepIndex + 1}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Trajectory Sequencer Control Bar */}
      <div className="bg-[#090c14] border border-cyan-950/60 rounded-lg p-4 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="text-base">📜</span>
            <div>
              <h4 className="text-xs font-semibold text-cyan-300 uppercase tracking-wider font-mono">
                Trajectory Player: "Playing Language Like Sheet Music"
              </h4>
              <p className="text-[11px] text-slate-400 font-mono">
                A document is simply an orbit trajectory: <span className="text-slate-200">[k₁, Δx₁, Δy₁] → [k₂, Δx₂, Δy₂]</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={selectedTrajectoryId}
              onChange={(e) => {
                setSelectedTrajectoryId(e.target.value);
                const traj = PRESET_TRAJECTORIES.find(t => t.id === e.target.value);
                if (traj) {
                  setSelectedSubstrateId(traj.substrateId);
                  setCurrentStepIndex(0);
                  applyStep(traj.steps[0]);
                  setSynthesizedStory([traj.steps[0].generatedToken]);
                }
              }}
              className="bg-slate-900 border border-slate-700 text-xs font-mono text-slate-200 rounded px-2.5 py-1.5 focus:border-cyan-500"
            >
              {PRESET_TRAJECTORIES.map(t => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>

            <button
              onClick={() => setIsPlaying(!isPlaying)}
              className={`px-3 py-1.5 text-xs font-mono font-medium rounded transition-all flex items-center gap-1.5 ${
                isPlaying
                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/50'
                  : 'bg-cyan-500/20 text-cyan-200 border border-cyan-500/50 hover:bg-cyan-500/30 shadow-[0_0_10px_rgba(6,182,212,0.2)]'
              }`}
            >
              <span>{isPlaying ? '⏸ Pause Trajectory' : '▶ Play Trajectory'}</span>
            </button>
          </div>
        </div>

        {/* Step Timeline Chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 pt-2 font-mono text-xs">
          {activeTrajectory.steps.map((step, idx) => {
            const isActive = idx === currentStepIndex;
            return (
              <button
                key={idx}
                onClick={() => handleSelectStep(idx)}
                className={`px-3 py-2 rounded-lg border text-left shrink-0 transition-all ${
                  isActive
                    ? 'bg-cyan-950/60 border-cyan-400 text-cyan-200 shadow-[0_0_10px_rgba(6,182,212,0.25)]'
                    : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-slate-500">#{idx + 1}</span>
                  <span className="font-bold text-white">{step.generatedToken}</span>
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5">
                  k₁={step.k1}, k₂={step.k2}
                </div>
              </button>
            );
          })}
        </div>

        {/* Current Step Explanation Box */}
        {currentStep && (
          <div className="p-3 bg-slate-900/80 border border-slate-800 rounded text-xs font-mono flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block shrink-0" />
              <span className="text-slate-300">{currentStep.explanation}</span>
            </div>
            <div className="text-cyan-400 font-bold shrink-0">
              Transform: [k₁={k1}, Δx₁={shiftX1}, Δy₁={shiftY1}] × [k₂={k2}, Δx₂={shiftX2}, Δy₂={shiftY2}]
            </div>
          </div>
        )}
      </div>

      {/* Main Grid: Controls + Visual Moiré Canvas + Generated Output */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Dual Grid Knobs (4 cols) */}
        <div className="lg:col-span-4 space-y-4 font-mono text-xs">
          {/* Grid A Controls */}
          <div className="bg-[#0b0e17] border border-cyan-950/60 rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-cyan-300 uppercase tracking-wider text-xs">
                Grid A (Grammar Frame)
              </h3>
              <span className="text-[11px] text-cyan-400">Phase k₁ = {k1}</span>
            </div>

            <div>
              <div className="flex justify-between text-slate-400 text-[11px] mb-1">
                <span>Affine Rotation k₁:</span>
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
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <div className="text-slate-400 text-[10px] mb-1">Shift X₁: {shiftX1}</div>
                <input
                  type="range"
                  min="0"
                  max="15"
                  value={shiftX1}
                  onChange={(e) => setShiftX1(parseInt(e.target.value))}
                  className="w-full h-1 bg-slate-800 rounded appearance-none cursor-pointer accent-cyan-400"
                />
              </div>
              <div>
                <div className="text-slate-400 text-[10px] mb-1">Shift Y₁: {shiftY1}</div>
                <input
                  type="range"
                  min="0"
                  max="15"
                  value={shiftY1}
                  onChange={(e) => setShiftY1(parseInt(e.target.value))}
                  className="w-full h-1 bg-slate-800 rounded appearance-none cursor-pointer accent-cyan-400"
                />
              </div>
            </div>
          </div>

          {/* Grid B Controls */}
          <div className="bg-[#0b0e17] border border-purple-950/60 rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-purple-300 uppercase tracking-wider text-xs">
                Grid B (Cadence Frame)
              </h3>
              <span className="text-[11px] text-purple-400">Phase k₂ = {k2}</span>
            </div>

            <div>
              <div className="flex justify-between text-slate-400 text-[11px] mb-1">
                <span>Affine Rotation k₂:</span>
                <span className="text-purple-400 font-bold">{k2}</span>
              </div>
              <input
                type="range"
                min="0"
                max="255"
                value={k2}
                onChange={(e) => setK2(parseInt(e.target.value))}
                className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-purple-400"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <div className="text-slate-400 text-[10px] mb-1">Shift X₂: {shiftX2}</div>
                <input
                  type="range"
                  min="0"
                  max="15"
                  value={shiftX2}
                  onChange={(e) => setShiftX2(parseInt(e.target.value))}
                  className="w-full h-1 bg-slate-800 rounded appearance-none cursor-pointer accent-purple-400"
                />
              </div>
              <div>
                <div className="text-slate-400 text-[10px] mb-1">Shift Y₂: {shiftY2}</div>
                <input
                  type="range"
                  min="0"
                  max="15"
                  value={shiftY2}
                  onChange={(e) => setShiftY2(parseInt(e.target.value))}
                  className="w-full h-1 bg-slate-800 rounded appearance-none cursor-pointer accent-purple-400"
                />
              </div>
            </div>
          </div>

          {/* Quick Harmonic Snaps (The Screenshot Phenomema!) */}
          <div className="bg-[#0b0e17] border border-slate-800 rounded-lg p-4 space-y-2">
            <h4 className="text-slate-400 text-[11px] font-semibold uppercase tracking-wider">
              Quick Snaps: Screenshot Phenomena
            </h4>
            <div className="grid grid-cols-2 gap-1.5 text-[11px]">
              <button
                onClick={() => { setK1(3); setK2(3); }}
                className="p-1.5 rounded bg-slate-900 border border-slate-800 text-slate-300 hover:text-cyan-300 hover:border-cyan-500/40 text-left"
              >
                Vertical Stripes (k=3)
              </button>
              <button
                onClick={() => { setK1(19); setK2(19); }}
                className="p-1.5 rounded bg-slate-900 border border-slate-800 text-slate-300 hover:text-cyan-300 hover:border-cyan-500/40 text-left"
              >
                Horizontal Bands (k=19)
              </button>
              <button
                onClick={() => { setK1(14); setK2(14); }}
                className="p-1.5 rounded bg-slate-900 border border-slate-800 text-slate-300 hover:text-cyan-300 hover:border-cyan-500/40 text-left"
              >
                4 Mini-Circles (k=14)
              </button>
              <button
                onClick={() => { setK1(48); setK2(48); }}
                className="p-1.5 rounded bg-slate-900 border border-slate-800 text-slate-300 hover:text-cyan-300 hover:border-cyan-500/40 text-left"
              >
                Cardioid Vortex (k=48)
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Visual Moiré Canvas & Story Output (8 cols) */}
        <div className="lg:col-span-8 space-y-4">
          {/* Moiré Superposition Canvas */}
          <div className="bg-[#0b0e17] border border-slate-800 rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-xs font-semibold text-slate-200 uppercase tracking-wider font-mono">
                  Moiré Interference Superposition (Grid A ⊕ Grid B)
                </h4>
                <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                  Overlapping letters light up where constructive interference aligns the phonetic structure.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[11px] font-mono text-emerald-400 font-bold">
                  ● Glowing = Resonance Lock
                </span>
              </div>
            </div>

            {/* 16x16 Superposition Grid */}
            <div
              className="grid gap-[1px] bg-slate-950 border border-slate-800 rounded p-1.5 aspect-square max-w-[420px] mx-auto select-none"
              style={{
                gridTemplateColumns: 'repeat(16, minmax(0, 1fr))',
                gridTemplateRows: 'repeat(16, minmax(0, 1fr))'
              }}
            >
              {moireResult.cells.map((cell) => {
                const isMatch = cell.charA === cell.charB && cell.charA !== ' ' && cell.charA !== '.';
                const isCons = cell.isConstructive;

                // Color coding for Moiré fringes
                let bg = '#0f172a'; // dark slate
                let textColor = '#64748b'; // muted

                if (isMatch) {
                  bg = '#052e16'; // deep emerald match
                  textColor = '#34d399';
                } else if (isCons) {
                  bg = '#164e63'; // deep cyan constructive
                  textColor = '#38bdf8';
                }

                return (
                  <div
                    key={cell.index}
                    style={{ backgroundColor: bg, color: textColor }}
                    className={`aspect-square rounded-[1px] flex items-center justify-center font-mono text-[11px] font-bold transition-all duration-150 ${
                      isMatch
                        ? 'ring-1 ring-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.4)] z-10 scale-105'
                        : isCons
                        ? 'ring-1 ring-cyan-500/50'
                        : ''
                    }`}
                    title={`A: '${cell.charA}' | B: '${cell.charB}'`}
                  >
                    {cell.charA}
                  </div>
                );
              })}
            </div>

            <div className="flex justify-between items-center text-[11px] font-mono text-slate-500">
              <span>Grid A: Cyan Tone</span>
              <span>Constructive Resonance: Emerald Glow</span>
              <span>Grid B: Violet Tone</span>
            </div>
          </div>

          {/* Synthesized Output Terminal */}
          <div className="bg-[#0b0e17] border border-slate-800 rounded-lg p-4 space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-semibold text-slate-200 uppercase tracking-wider font-mono">
                Synthesized Language Terminal (Emergent Stream)
              </h4>
              <button
                onClick={() => setSynthesizedStory([])}
                className="text-[10px] font-mono text-slate-400 hover:text-slate-200"
              >
                Clear Stream
              </button>
            </div>

            <div className="p-3 bg-slate-950 rounded border border-slate-800/80 font-mono text-sm min-h-[60px] flex flex-wrap items-center gap-2">
              {synthesizedStory.map((tok, idx) => (
                <span
                  key={idx}
                  className="px-2 py-0.5 rounded bg-cyan-950/40 border border-cyan-800/60 text-cyan-200 font-bold animate-fadeIn"
                >
                  {tok}
                </span>
              ))}
              {isPlaying && (
                <span className="w-2 h-4 bg-cyan-400 animate-pulse inline-block" />
              )}
            </div>

            <p className="text-[11px] font-mono text-slate-400 leading-relaxed">
              This text is generated deterministically from the sequence of affine coordinates — not generated by guessing weights or calling an external LLM.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
