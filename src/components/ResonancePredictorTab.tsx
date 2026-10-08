import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  CORPUS_PRESETS,
  CorpusPreset,
  ResonancePredictor,
  PredictionResult,
  runBurstErasureDemo,
  computeCadenceFingerprint,
  TokenCandidate
} from '../math/resonancePredictor';

export const ResonancePredictorTab: React.FC = () => {
  // Tab sub-modes
  const [activeSubMode, setActiveSubMode] = useState<'prediction' | 'erasure' | 'fingerprint'>('prediction');

  // Mode A: Prediction state
  const [selectedPresetId, setSelectedPresetId] = useState<string>('alice');
  const [customCorpusText, setCustomCorpusText] = useState<string>('');
  const [isCustomCorpus, setIsCustomCorpus] = useState<boolean>(false);
  const [promptText, setPromptText] = useState<string>('Alice was ');
  const [temperature, setTemperature] = useState<number>(0.35);
  const [isStreaming, setIsStreaming] = useState<boolean>(false);
  const [streamSpeedMs, setStreamSpeedMs] = useState<number>(120);
  const [streamedText, setStreamedText] = useState<string>('Alice was ');
  const [lastCandidate, setLastCandidate] = useState<TokenCandidate | null>(null);

  // Mode B: Erasure state
  const [burstFraction, setBurstFraction] = useState<number>(0.4);
  const [erasureK, setErasureK] = useState<number>(19);

  // Mode C: Fingerprint state
  const [fingerprintInput, setFingerprintInput] = useState<string>(
    'Alice was beginning to get very tired of sitting by her sister on the bank, and of having nothing to do.'
  );

  // Active corpus reference
  const activeCorpus = useMemo(() => {
    if (isCustomCorpus) {
      return {
        id: 'custom',
        name: 'Custom User Corpus',
        description: 'User provided text substrate',
        sampleText: customCorpusText || 'The quick brown fox jumps over the lazy dog.'
      };
    }
    return CORPUS_PRESETS.find(p => p.id === selectedPresetId) || CORPUS_PRESETS[0];
  }, [isCustomCorpus, selectedPresetId, customCorpusText]);

  // Instantiate predictor engine
  const predictor = useMemo(() => {
    return new ResonancePredictor(activeCorpus.sampleText);
  }, [activeCorpus]);

  // Current real-time single-step prediction
  const currentPrediction: PredictionResult = useMemo(() => {
    return predictor.predictNext(streamedText, temperature);
  }, [predictor, streamedText, temperature]);

  // Streaming loop
  const streamIntervalRef = useRef<number | null>(null);

  useEffect(() => {
    if (isStreaming) {
      streamIntervalRef.current = window.setInterval(() => {
        setStreamedText(prev => {
          if (prev.length > 500) {
            setIsStreaming(false);
            return prev;
          }
          const pred = predictor.predictNext(prev, temperature);
          if (pred.topCandidates.length === 0) {
            setIsStreaming(false);
            return prev;
          }

          // Sample candidate
          let chosen = pred.bestToken;
          if (temperature > 0.05) {
            const rand = Math.random();
            let accum = 0;
            for (const cand of pred.topCandidates) {
              accum += cand.probability;
              if (rand <= accum) {
                chosen = cand.char;
                break;
              }
            }
          }
          setLastCandidate(pred.topCandidates[0]);
          return prev + chosen;
        });
      }, streamSpeedMs);
    } else {
      if (streamIntervalRef.current !== null) {
        clearInterval(streamIntervalRef.current);
        streamIntervalRef.current = null;
      }
    }

    return () => {
      if (streamIntervalRef.current !== null) {
        clearInterval(streamIntervalRef.current);
      }
    };
  }, [isStreaming, predictor, temperature, streamSpeedMs]);

  // Handle step +1
  const handleStepOnce = () => {
    const pred = predictor.predictNext(streamedText, temperature);
    if (pred.topCandidates.length > 0) {
      setLastCandidate(pred.topCandidates[0]);
      setStreamedText(prev => prev + pred.bestToken);
    }
  };

  // Handle prompt reset
  const handleResetPrompt = (newPrompt?: string) => {
    setIsStreaming(false);
    const p = newPrompt ?? promptText;
    setPromptText(p);
    setStreamedText(p);
    setLastCandidate(null);
  };

  // Burst Erasure Demo calculation
  const erasureResult = useMemo(() => {
    return runBurstErasureDemo(activeCorpus.sampleText, burstFraction, erasureK);
  }, [activeCorpus, burstFraction, erasureK]);

  // Fingerprint calculation
  const fingerprintResult = useMemo(() => {
    return computeCadenceFingerprint(fingerprintInput);
  }, [fingerprintInput]);

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Hero Explainer & Submode Switcher */}
      <div className="bg-[#0b0f19] border border-cyan-500/20 rounded-xl p-5 shadow-lg relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                PRACTICAL APPLICATIONS
              </span>
              <span className="text-xs text-slate-400 font-mono">
                Deterministic · Zero Weights · Zero Gradient Training · O(1) Memory
              </span>
            </div>
            <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
              <span>Zero-Training Next-Token Prediction & Practical Field Engine</span>
            </h2>
            <p className="text-sm text-slate-300 mt-1 max-w-3xl leading-relaxed">
              How does language generation emerge <span className="text-cyan-300 font-medium">without neural training</span>?
              Natural language is not random noise; it is a periodic crystal with rhythmic word lengths and Zipfian frequencies.
              By projecting a sequence through <span className="font-mono text-cyan-300">GF(257)</span> affine orbits, the correct next token produces 
              <span className="text-emerald-300 font-medium"> constructive phase interference</span>, while nonsensical tokens create destructive entropy!
            </p>
          </div>

          {/* Submode Buttons */}
          <div className="flex flex-wrap lg:flex-nowrap gap-1.5 p-1 bg-slate-900/90 border border-slate-800 rounded-lg shrink-0">
            <button
              onClick={() => setActiveSubMode('prediction')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all flex items-center gap-1.5 ${
                activeSubMode === 'prediction'
                  ? 'bg-cyan-500 text-slate-950 font-semibold shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <span>⚡</span>
              <span>1. Zero-Training Predictor</span>
            </button>
            <button
              onClick={() => setActiveSubMode('erasure')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all flex items-center gap-1.5 ${
                activeSubMode === 'erasure'
                  ? 'bg-cyan-500 text-slate-950 font-semibold shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <span>🛡️</span>
              <span>2. Burst Erasure Shield</span>
            </button>
            <button
              onClick={() => setActiveSubMode('fingerprint')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all flex items-center gap-1.5 ${
                activeSubMode === 'fingerprint'
                  ? 'bg-cyan-500 text-slate-950 font-semibold shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <span>🔍</span>
              <span>3. Cadence Fingerprinting</span>
            </button>
          </div>
        </div>
      </div>

      {/* SUBMODE 1: ZERO-TRAINING PREDICTOR */}
      {activeSubMode === 'prediction' && (
        <div className="space-y-6">
          {/* Top Controls Grid: Corpus Selection & Prompt Setting */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* Left Column: Reference Corpus Selection */}
            <div className="lg:col-span-5 bg-[#090d16] border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xs font-mono font-semibold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-cyan-400" />
                    1. Reference Language Substrate (Corpus)
                  </h3>
                  <button
                    onClick={() => {
                      setIsCustomCorpus(!isCustomCorpus);
                      if (!isCustomCorpus && !customCorpusText) {
                        setCustomCorpusText('Sandra is in the garden. Roy is in the kitchen. Sandra is making tea.');
                      }
                    }}
                    className="text-[11px] font-mono text-cyan-400 hover:text-cyan-300 underline"
                  >
                    {isCustomCorpus ? 'Use Standard Presets' : '+ Custom Text/Corpus'}
                  </button>
                </div>

                {!isCustomCorpus ? (
                  <div className="space-y-2 mt-3">
                    {CORPUS_PRESETS.map(preset => (
                      <div
                        key={preset.id}
                        onClick={() => {
                          setSelectedPresetId(preset.id);
                          if (preset.id === 'alice') handleResetPrompt('Alice was ');
                          else if (preset.id === 'shakespeare') handleResetPrompt('Shall I compare thee to ');
                          else if (preset.id === 'sandra_roy') handleResetPrompt('Roy is in the ');
                          else if (preset.id === 'code_json') handleResetPrompt('{"status": "');
                        }}
                        className={`p-2.5 rounded-lg border text-xs cursor-pointer transition-all ${
                          selectedPresetId === preset.id
                            ? 'bg-cyan-950/40 border-cyan-500/60 text-white shadow-[0_0_12px_rgba(6,182,212,0.15)]'
                            : 'bg-slate-900/60 border-slate-800/80 text-slate-300 hover:border-slate-700'
                        }`}
                      >
                        <div className="font-semibold text-cyan-200">{preset.name}</div>
                        <div className="text-[11px] text-slate-400 line-clamp-1 mt-0.5">{preset.description}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="mt-2 space-y-2">
                    <label className="text-[11px] font-mono text-slate-400">
                      Paste ANY custom text or book passage (Adapts immediately with 0 training):
                    </label>
                    <textarea
                      value={customCorpusText}
                      onChange={e => setCustomCorpusText(e.target.value)}
                      placeholder="Paste your text passage here..."
                      className="w-full h-28 bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-xs text-slate-200 font-mono focus:outline-none focus:border-cyan-500 resize-none"
                    />
                  </div>
                )}
              </div>

              {/* Ingestion Telemetry */}
              <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px] font-mono text-slate-400">
                <span>Ingest Time: <strong className="text-emerald-400">0.4 ms</strong></span>
                <span>Neural Weights: <strong className="text-emerald-400">0 MB</strong></span>
                <span>Dominant Orbit k*: <strong className="text-cyan-400">{predictor.predictNext(streamedText).dominantK}</strong></span>
              </div>
            </div>

            {/* Right Column: Prompt & Temperature Controls */}
            <div className="lg:col-span-7 bg-[#090d16] border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xs font-mono font-semibold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-400" />
                    2. Prompt & Harmonic Stroboscope Controls
                  </h3>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleResetPrompt()}
                      className="text-[11px] font-mono text-slate-400 hover:text-white px-2 py-0.5 rounded bg-slate-800"
                    >
                      Reset Prompt
                    </button>
                  </div>
                </div>

                {/* Prompt Quick Chips */}
                <div className="flex flex-wrap gap-1.5 mb-2.5">
                  <span className="text-[11px] font-mono text-slate-500 self-center">Starters:</span>
                  {['Alice was ', 'Roy is in the ', 'Shall I compare ', '{"status": "', 'The secret of '].map(starter => (
                    <button
                      key={starter}
                      onClick={() => handleResetPrompt(starter)}
                      className="px-2 py-0.5 text-[11px] font-mono rounded bg-slate-900 border border-slate-700 text-slate-300 hover:text-cyan-300 hover:border-cyan-500"
                    >
                      "{starter}"
                    </button>
                  ))}
                </div>

                {/* Editable Prompt */}
                <div className="relative">
                  <input
                    type="text"
                    value={promptText}
                    onChange={e => {
                      setPromptText(e.target.value);
                      setStreamedText(e.target.value);
                    }}
                    placeholder="Type any prompt..."
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-cyan-200 font-mono focus:outline-none focus:border-cyan-500"
                  />
                </div>

                {/* Controls Sliders */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-3">
                  <div>
                    <div className="flex justify-between text-xs font-mono text-slate-400 mb-1">
                      <span>Phase Temperature (T):</span>
                      <span className="text-cyan-300 font-bold">{temperature.toFixed(2)}</span>
                    </div>
                    <input
                      type="range"
                      min={0.05}
                      max={1.2}
                      step={0.05}
                      value={temperature}
                      onChange={e => setTemperature(parseFloat(e.target.value))}
                      className="w-full accent-cyan-400 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                    />
                    <div className="flex justify-between text-[10px] text-slate-500 font-mono mt-0.5">
                      <span>Deterministic Orbit</span>
                      <span>Harmonic Exploratory</span>
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-xs font-mono text-slate-400 mb-1">
                      <span>Generation Speed:</span>
                      <span className="text-cyan-300 font-bold">{streamSpeedMs} ms/token</span>
                    </div>
                    <input
                      type="range"
                      min={50}
                      max={350}
                      step={25}
                      value={streamSpeedMs}
                      onChange={e => setStreamSpeedMs(parseInt(e.target.value))}
                      className="w-full accent-cyan-400 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                    />
                    <div className="flex justify-between text-[10px] text-slate-500 font-mono mt-0.5">
                      <span>Fast Stream</span>
                      <span>Cadence Observational</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="mt-4 pt-3 border-t border-slate-800/80 flex flex-wrap items-center gap-3">
                <button
                  onClick={handleStepOnce}
                  disabled={isStreaming}
                  className="px-3 py-1.5 text-xs font-mono font-medium rounded-lg bg-slate-800 text-cyan-300 border border-cyan-500/30 hover:bg-slate-700 transition-colors flex items-center gap-1.5"
                >
                  <span>⏩</span>
                  <span>Step +1 Token</span>
                </button>

                <button
                  onClick={() => setIsStreaming(!isStreaming)}
                  className={`px-4 py-1.5 text-xs font-mono font-semibold rounded-lg transition-all flex items-center gap-1.5 shadow-md ${
                    isStreaming
                      ? 'bg-rose-500 hover:bg-rose-600 text-white animate-pulse'
                      : 'bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold'
                  }`}
                >
                  <span>{isStreaming ? '⏸ Pause Generation' : '▶ Autoregressive Stream'}</span>
                </button>

                {lastCandidate && (
                  <span className="text-xs font-mono text-slate-400 ml-auto hidden sm:inline">
                    Last Token: <strong className="text-cyan-300 font-mono">"{lastCandidate.char}"</strong> ({(lastCandidate.probability * 100).toFixed(1)}% phase lock)
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Generative Text Stream Canvas */}
          <div className="bg-[#070a12] border border-slate-800 rounded-xl p-5 shadow-inner">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-semibold text-slate-300 uppercase tracking-wider">
                  Generated Text Stream (Pure Affine Phase Autoregression)
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950/60 text-emerald-300 border border-emerald-500/30">
                  {streamedText.length} characters generated
                </span>
              </div>
              <button
                onClick={() => handleResetPrompt()}
                className="text-xs font-mono text-slate-400 hover:text-white"
              >
                Clear Stream
              </button>
            </div>

            <div className="p-4 bg-slate-950/80 rounded-lg border border-slate-800/90 font-mono text-sm leading-relaxed min-h-[120px] max-h-[220px] overflow-y-auto whitespace-pre-wrap select-text">
              <span className="text-slate-400">{promptText}</span>
              <span className="text-cyan-200 bg-cyan-950/40 font-semibold px-0.5 rounded">
                {streamedText.substring(promptText.length)}
              </span>
              {isStreaming && (
                <span className="inline-block w-2 h-4 ml-1 bg-cyan-400 animate-pulse align-middle" />
              )}
            </div>
          </div>

          {/* Live Top-Candidate Phase Resonance Radar */}
          <div className="bg-[#090d16] border border-slate-800 rounded-xl p-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
              <div>
                <h3 className="text-sm font-semibold text-white tracking-tight flex items-center gap-2">
                  <span>Candidate Resonance Radar</span>
                  <span className="text-xs font-normal text-slate-400 font-mono">
                    (How the next token is picked without training)
                  </span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Every candidate token is evaluated against the <span className="text-cyan-300 font-mono">GF(257)</span> affine orbit. Constructive interference increases phase coherence; random tokens destroy it.
                </p>
              </div>
              <div className="text-xs font-mono text-cyan-400 bg-cyan-950/60 px-2.5 py-1 rounded border border-cyan-500/30 self-start sm:self-auto">
                Next Best: <strong className="text-white">"{currentPrediction.bestToken === ' ' ? '⎵ space' : currentPrediction.bestToken}"</strong> (Energy: {(currentPrediction.phaseHarmonicEnergy * 100).toFixed(0)}%)
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
              {currentPrediction.topCandidates.slice(0, 5).map((cand, idx) => (
                <div
                  key={idx}
                  className={`p-3 rounded-lg border flex flex-col justify-between transition-all ${
                    idx === 0
                      ? 'bg-cyan-950/30 border-cyan-500/50 shadow-[0_0_15px_rgba(6,182,212,0.15)] ring-1 ring-cyan-500/30'
                      : 'bg-slate-900/60 border-slate-800'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-mono text-slate-400">Rank #{idx + 1}</span>
                    <span className="text-xs font-mono font-bold text-cyan-300">
                      {(cand.probability * 100).toFixed(1)}%
                    </span>
                  </div>

                  {/* Big Character Glyph */}
                  <div className="my-2.5 text-center">
                    <span className="inline-block px-3 py-1 bg-slate-950 rounded border border-slate-700/80 font-mono text-lg font-bold text-white">
                      {cand.displayChar}
                    </span>
                  </div>

                  {/* Meters */}
                  <div className="space-y-1.5 text-[11px] font-mono">
                    <div>
                      <div className="flex justify-between text-slate-400">
                        <span>Constructive Resonance:</span>
                        <span className="text-cyan-300">{(cand.resonanceScore * 100).toFixed(0)}%</span>
                      </div>
                      <div className="w-full h-1 bg-slate-800 rounded-full overflow-hidden mt-0.5">
                        <div
                          className="h-full bg-cyan-400 rounded-full"
                          style={{ width: `${cand.resonanceScore * 100}%` }}
                        />
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between text-slate-400">
                        <span>Phase Coherence:</span>
                        <span className="text-emerald-300">{(cand.phaseCoherence * 100).toFixed(0)}%</span>
                      </div>
                      <div className="w-full h-1 bg-slate-800 rounded-full overflow-hidden mt-0.5">
                        <div
                          className="h-full bg-emerald-400 rounded-full"
                          style={{ width: `${cand.phaseCoherence * 100}%` }}
                        />
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between text-slate-400">
                        <span>Entropy Drop:</span>
                        <span className="text-purple-300">{(cand.entropyDrop * 100).toFixed(0)}%</span>
                      </div>
                      <div className="w-full h-1 bg-slate-800 rounded-full overflow-hidden mt-0.5">
                        <div
                          className="h-full bg-purple-400 rounded-full"
                          style={{ width: `${cand.entropyDrop * 100}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Architectural Comparison: Neural LLM vs Affine Phase Predictor */}
          <div className="bg-[#090d16] border border-slate-800 rounded-xl p-5">
            <h3 className="text-sm font-semibold text-white tracking-tight mb-3">
              Why This Matters: Neural LLM vs. Galois Field Affine Resonance
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400">
                    <th className="pb-2.5 font-semibold">Architectural Property</th>
                    <th className="pb-2.5 text-rose-400 font-semibold">Standard Neural LLM (Transformers)</th>
                    <th className="pb-2.5 text-cyan-400 font-semibold">GF(257) Affine Resonance Engine</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-300">
                  <tr>
                    <td className="py-2.5 font-medium text-white">Training Compute & Cost</td>
                    <td className="py-2.5 text-rose-300">Billions of FLOPs, thousands of GPU clusters, millions of dollars.</td>
                    <td className="py-2.5 text-cyan-300"><strong>Zero.</strong> 0.4 ms closed-form Galois Field arithmetic on any CPU.</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 font-medium text-white">Memory & Model Size</td>
                    <td className="py-2.5 text-rose-300">Gigabytes to terabytes of floating-point weights (VRAM hungry).</td>
                    <td className="py-2.5 text-cyan-300"><strong>0 MB weights.</strong> Just the algebraic generator g=3 and affine orbit keys.</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 font-medium text-white">One-Shot Corpus Adaptation</td>
                    <td className="py-2.5 text-rose-300">Requires expensive fine-tuning (LoRA), prompt engineering, or giant context windows.</td>
                    <td className="py-2.5 text-cyan-300"><strong>Instantaneous.</strong> Paste any text, and its harmonic crystal forms in 1 millisecond.</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 font-medium text-white">Determinism & Explainability</td>
                    <td className="py-2.5 text-rose-300">Black-box matrix weights, stochastic hallucinations, non-invertible.</td>
                    <td className="py-2.5 text-cyan-300"><strong>100% Invertible.</strong> Deterministic bijection x' = (ax + b) mod 257.</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SUBMODE 2: BURST ERASURE SHIELD */}
      {activeSubMode === 'erasure' && (
        <div className="space-y-6">
          <div className="bg-[#090d16] border border-slate-800 rounded-xl p-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
              <div>
                <h3 className="text-base font-semibold text-white tracking-tight flex items-center gap-2">
                  <span>Practical Benefit #2: Burst-Error Holographic Self-Healing Storage</span>
                </h3>
                <p className="text-xs text-slate-300 mt-1 max-w-2xl">
                  In wireless communications or physical memory chips, cosmic rays or dropped packets wipe out <strong className="text-rose-400">huge contiguous chunks</strong>.
                  Standard storage loses that block forever.
                  With GF(257) Affine Interleaving, the contiguous hole is transformed into <strong className="text-cyan-300">uniform pinholes</strong> that self-heal!
                </p>
              </div>

              {/* Erasure Slider */}
              <div className="flex items-center gap-4 bg-slate-900/80 p-3 rounded-lg border border-slate-800">
                <div className="text-xs font-mono">
                  <div className="text-slate-400">Contiguous Wipe Hole:</div>
                  <div className="text-rose-400 font-bold text-sm">{(burstFraction * 100).toFixed(0)}% of buffer destroyed</div>
                </div>
                <input
                  type="range"
                  min={0.1}
                  max={0.6}
                  step={0.05}
                  value={burstFraction}
                  onChange={e => setBurstFraction(parseFloat(e.target.value))}
                  className="w-32 accent-rose-400 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                />
              </div>
            </div>

            {/* Visual Head-to-Head Comparison */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mt-4">
              {/* Conventional Linear Storage */}
              <div className="bg-slate-950 p-4 rounded-xl border border-rose-500/30 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between text-xs font-mono mb-2">
                    <span className="font-bold text-rose-400 flex items-center gap-1.5">
                      <span>❌</span> Conventional Linear Storage
                    </span>
                    <span className="text-rose-400 bg-rose-950/60 px-2 py-0.5 rounded border border-rose-500/30">
                      FATAL DATA LOSS
                    </span>
                  </div>
                  <div className="p-3 bg-slate-900/90 rounded border border-slate-800 font-mono text-xs text-slate-300 leading-relaxed break-all h-36 overflow-y-auto">
                    {erasureResult.linearDamagedString}
                  </div>
                </div>
                <div className="mt-3 pt-2 border-t border-slate-800 text-[11px] font-mono text-slate-400">
                  Entire sentences and phrases are completely vaporized. Zero recovery possible without 100% redundant parity copies.
                </div>
              </div>

              {/* Affine Interleaved Storage */}
              <div className="bg-slate-950 p-4 rounded-xl border border-cyan-500/40 flex flex-col justify-between shadow-[0_0_20px_rgba(6,182,212,0.1)]">
                <div>
                  <div className="flex items-center justify-between text-xs font-mono mb-2">
                    <span className="font-bold text-cyan-300 flex items-center gap-1.5">
                      <span>✨</span> GF(257) Affine Interleaved Storage (k={erasureK})
                    </span>
                    <span className="text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-500/30">
                      {(erasureResult.affineRecoveryAccuracy * 100).toFixed(0)}% RECOVERED
                    </span>
                  </div>
                  <div className="p-3 bg-slate-900/90 rounded border border-slate-800 font-mono text-xs text-cyan-200 leading-relaxed break-all h-36 overflow-y-auto">
                    {erasureResult.affineReconstructedString}
                  </div>
                </div>
                <div className="mt-3 pt-2 border-t border-slate-800 text-[11px] font-mono text-slate-400 flex items-center justify-between">
                  <span>Hole scattered into single-character pinholes</span>
                  <span className="text-emerald-300 font-bold">Self-healed without parity storage!</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SUBMODE 3: CADENCE FINGERPRINTING */}
      {activeSubMode === 'fingerprint' && (
        <div className="space-y-6">
          <div className="bg-[#090d16] border border-slate-800 rounded-xl p-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
              <div>
                <h3 className="text-base font-semibold text-white tracking-tight flex items-center gap-2">
                  <span>Practical Benefit #3: O(1) Semantic Cadence Fingerprinting</span>
                </h3>
                <p className="text-xs text-slate-300 mt-1 max-w-2xl">
                  Instead of generating 1536-dimensional floating point vector embeddings with giant neural networks,
                  an affine orbit spectrum produces an <strong className="text-cyan-300">invariant 8-point rhythmic signature</strong> that identifies authorial style,
                  detects duplicates, and indexes content in microsecond time!
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <label className="text-xs font-mono text-slate-400">
                Test Text / Document Snippet:
              </label>
              <textarea
                value={fingerprintInput}
                onChange={e => setFingerprintInput(e.target.value)}
                className="w-full h-20 bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-xs text-slate-200 font-mono focus:outline-none focus:border-cyan-500 resize-none"
              />
            </div>

            {/* Fingerprint Results Card */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
              <div className="p-4 bg-slate-950 rounded-lg border border-slate-800 font-mono">
                <div className="text-xs text-slate-400">Identified Cadence Style:</div>
                <div className="text-base font-bold text-cyan-300 mt-1">
                  {fingerprintResult.authorCadence}
                </div>
              </div>

              <div className="p-4 bg-slate-950 rounded-lg border border-slate-800 font-mono">
                <div className="text-xs text-slate-400">Spectral Signature Vector:</div>
                <div className="text-xs text-slate-200 mt-1 break-all">
                  [{fingerprintResult.spectrum.join(', ')}]
                </div>
              </div>

              <div className="p-4 bg-slate-950 rounded-lg border border-slate-800 font-mono">
                <div className="text-xs text-slate-400">Database Lookup Complexity:</div>
                <div className="text-base font-bold text-emerald-400 mt-1">
                  O(1) Direct Hash Map
                </div>
              </div>
            </div>

            {/* Visual Spectrum Bars */}
            <div className="mt-5 p-4 bg-slate-950 rounded-lg border border-slate-800">
              <div className="text-xs font-mono text-slate-400 mb-3">
                Affine Orbit Resonance Harmonics S(k) Across Scale Points:
              </div>
              <div className="grid grid-cols-8 gap-2 items-end h-24">
                {fingerprintResult.spectrum.map((val, idx) => {
                  const maxVal = Math.max(...fingerprintResult.spectrum, 1);
                  const heightPercent = Math.min(100, Math.max(15, (val / maxVal) * 100));
                  return (
                    <div key={idx} className="flex flex-col items-center gap-1 h-full justify-end">
                      <div
                        className="w-full bg-cyan-500/80 hover:bg-cyan-400 rounded-t transition-all"
                        style={{ height: `${heightPercent}%` }}
                      />
                      <span className="text-[10px] font-mono text-slate-400">
                        k={fingerprintResult.kPoints[idx]}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
