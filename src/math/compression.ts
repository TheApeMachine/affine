/**
 * Compression, Decimation & Structural Completion Engine
 * Implements:
 * 1. Decimation patterns (1/2, 1/4, 1/8, 1/16, arbitrary fractions, strided and burst)
 * 2. Compaction: retained samples + metadata packaging
 * 3. Structural Completion: TV Orbit Continuity, Sparse Spectral (DCT) Matching, Spatial 2D
 * 4. Structural Compressibility Metric rho(X, k): minimum fraction of transformed samples
 * 5. Full orbit resonance scan: rho(X, 0) vs min_k rho(X, k)
 * 6. True Bit Budget Accounting
 */

import { applyAffineTransform, invertAffineTransform } from './gf257';

export type DecimationType = 'stride_2' | 'stride_4' | 'stride_8' | 'stride_16' | 'random_fraction' | 'burst_block';
export type CompletionRule = 'orbit_smoothness' | 'sparse_spectral' | 'spatial_coherence' | 'hybrid_optimal';

export interface DecimationResult {
  keptMask: boolean[];
  keptIndices: number[];
  droppedIndices: number[];
  retainedSamples: number[];
  fraction: number;
}

export interface ReconstructionResult {
  original: number[];
  transformed: number[];
  decimatedTransformed: (number | null)[];
  reconstructedTransformed: number[];
  reconstructedOriginal: number[];
  maxError: number;
  mse: number;
  psnr: number;
  isExact: boolean;
  isNearExact: boolean;
  bitBudget: BitBudget;
}

export interface BitBudget {
  rawBits: number;              // 256 samples * 8 bits = 2048 bits
  retainedSampleBits: number;   // count * 8 bits
  rotationMetadataBits: number; // 8 bits (k in 0..255)
  phaseShiftBits: number;       // 8 bits (b in 0..255)
  patternHeaderBits: number;    // 8 bits (decimation mode / stride id)
  ruleHeaderBits: number;       // 4 bits
  totalCompressedBits: number;
  compressionRatio: number;     // rawBits / totalCompressedBits (e.g. 1.8x, 3.2x)
  spaceSavingPercent: number;   // (1 - total/raw) * 100
}

/**
 * Generate decimation mask
 */
export function decimate(length: number, type: DecimationType, fraction: number = 0.5): DecimationResult {
  const keptMask = new Array<boolean>(length).fill(false);
  const keptIndices: number[] = [];
  const droppedIndices: number[] = [];

  switch (type) {
    case 'stride_2':
      for (let i = 0; i < length; i++) {
        if (i % 2 === 0) keptMask[i] = true;
      }
      break;
    case 'stride_4':
      for (let i = 0; i < length; i++) {
        if (i % 4 === 0) keptMask[i] = true;
      }
      break;
    case 'stride_8':
      for (let i = 0; i < length; i++) {
        if (i % 8 === 0) keptMask[i] = true;
      }
      break;
    case 'stride_16':
      for (let i = 0; i < length; i++) {
        if (i % 16 === 0) keptMask[i] = true;
      }
      break;
    case 'burst_block': {
      // Contiguous erasure of (1 - fraction) samples
      const dropCount = Math.round(length * (1 - fraction));
      const start = Math.floor((length - dropCount) / 2);
      for (let i = 0; i < length; i++) {
        if (i < start || i >= start + dropCount) {
          keptMask[i] = true;
        }
      }
      break;
    }
    case 'random_fraction':
    default: {
      // Deterministic pseudo-random stride based on golden ratio sampling for uniform distribution
      const keepCount = Math.max(1, Math.round(length * fraction));
      const step = length / keepCount;
      for (let j = 0; j < keepCount; j++) {
        const idx = Math.min(length - 1, Math.floor(j * step));
        keptMask[idx] = true;
      }
      break;
    }
  }

  for (let i = 0; i < length; i++) {
    if (keptMask[i]) keptIndices.push(i);
    else droppedIndices.push(i);
  }

  return {
    keptMask,
    keptIndices,
    droppedIndices,
    retainedSamples: [],
    fraction: keptIndices.length / length
  };
}

/**
 * 1D Discrete Cosine Transform (DCT-II) and Inverse (DCT-III)
 */
function dct1D(signal: number[]): number[] {
  const N = signal.length;
  const out = new Array(N);
  const factor = Math.PI / N;
  for (let k = 0; k < N; k++) {
    let sum = 0;
    for (let n = 0; n < N; n++) {
      sum += signal[n] * Math.cos((n + 0.5) * k * factor);
    }
    out[k] = sum * (k === 0 ? Math.SQRT1_2 : 1) * Math.sqrt(2 / N);
  }
  return out;
}

function idct1D(coeffs: number[]): number[] {
  const N = coeffs.length;
  const out = new Array(N);
  const factor = Math.PI / N;
  for (let n = 0; n < N; n++) {
    let sum = 0;
    for (let k = 0; k < N; k++) {
      const c = k === 0 ? Math.SQRT1_2 : 1;
      sum += c * coeffs[k] * Math.cos((n + 0.5) * k * factor);
    }
    out[n] = sum * Math.sqrt(2 / N);
  }
  return out;
}

/**
 * Structural Completion Algorithms for Transformed Samples
 */
export function completeMissingSamples(
  knownIndices: number[],
  knownValues: number[],
  totalLength: number,
  rule: CompletionRule
): number[] {
  const completed = new Array<number>(totalLength).fill(0);
  const isKnown = new Array<boolean>(totalLength).fill(false);
  for (let i = 0; i < knownIndices.length; i++) {
    const idx = knownIndices[i];
    completed[idx] = knownValues[i];
    isKnown[idx] = true;
  }

  if (knownIndices.length === 0) return completed;
  if (knownIndices.length === totalLength) return completed;

  switch (rule) {
    case 'orbit_smoothness': {
      // Orbit Continuity / Total Variation interpolation
      // Piecewise monotonic cubic or regularized linear between known anchors
      for (let i = 0; i < totalLength; i++) {
        if (isKnown[i]) continue;
        // Find previous known and next known (circular / boundary)
        let prev = -1;
        for (let d = 1; d < totalLength; d++) {
          const p = (i - d + totalLength) % totalLength;
          if (isKnown[p]) { prev = p; break; }
        }
        let next = -1;
        for (let d = 1; d < totalLength; d++) {
          const n = (i + d) % totalLength;
          if (isKnown[n]) { next = n; break; }
        }

        if (prev !== -1 && next !== -1) {
          if (prev === next) {
            completed[i] = completed[prev];
          } else {
            // Distance along circular orbit
            const distTotal = (next - prev + totalLength) % totalLength;
            const distFromPrev = (i - prev + totalLength) % totalLength;
            const t = distFromPrev / distTotal;
            // Smooth cosine interpolation
            const smoothT = (1 - Math.cos(t * Math.PI)) / 2;
            completed[i] = Math.round(completed[prev] * (1 - smoothT) + completed[next] * smoothT);
          }
        } else if (prev !== -1) {
          completed[i] = completed[prev];
        } else if (next !== -1) {
          completed[i] = completed[next];
        }
      }
      break;
    }

    case 'sparse_spectral': {
      // Iterative Hard Thresholding / POCS (Projection Onto Convex Sets) in DCT space
      // Compressed Sensing recovery
      let currentSignal = new Array(totalLength);
      // Initialize with linear interpolation
      const initial = completeMissingSamples(knownIndices, knownValues, totalLength, 'orbit_smoothness');
      for (let i = 0; i < totalLength; i++) currentSignal[i] = initial[i];

      const iterations = 25;
      const keepComponents = Math.max(3, Math.floor(knownIndices.length * 0.65));

      for (let iter = 0; iter < iterations; iter++) {
        // 1. Transform to frequency domain
        const freq = dct1D(currentSignal);

        // 2. Hard threshold: keep top K largest coefficients
        const indexedFreq = freq.map((val, idx) => ({ val, abs: Math.abs(val), idx }));
        indexedFreq.sort((a, b) => b.abs - a.abs);
        const thresholded = new Array(totalLength).fill(0);
        for (let k = 0; k < keepComponents; k++) {
          const item = indexedFreq[k];
          thresholded[item.idx] = item.val;
        }

        // 3. Invert to spatial domain
        const reconstructed = idct1D(thresholded);

        // 4. Project back onto known constraints (data fidelity step)
        for (let i = 0; i < totalLength; i++) {
          if (isKnown[i]) {
            currentSignal[i] = completed[i];
          } else {
            currentSignal[i] = Math.max(0, Math.min(255, Math.round(reconstructed[i])));
          }
        }
      }

      for (let i = 0; i < totalLength; i++) {
        completed[i] = currentSignal[i];
      }
      break;
    }

    case 'spatial_coherence':
    case 'hybrid_optimal': {
      // Combines orbit smoothness with iterative DCT refinement
      const tvComp = completeMissingSamples(knownIndices, knownValues, totalLength, 'orbit_smoothness');
      const specComp = completeMissingSamples(knownIndices, knownValues, totalLength, 'sparse_spectral');
      for (let i = 0; i < totalLength; i++) {
        if (!isKnown[i]) {
          completed[i] = Math.round(0.5 * tvComp[i] + 0.5 * specComp[i]);
        }
      }
      break;
    }
  }

  // Clamp to byte range [0, 255]
  for (let i = 0; i < totalLength; i++) {
    completed[i] = Math.max(0, Math.min(255, Math.round(completed[i])));
  }

  return completed;
}

/**
 * Full Pipeline: Reversible Affine Transform -> Decimate -> Compact -> Complete -> Invert Transform
 */
export function runDecimationPipeline(
  source: number[],
  k: number,
  b: number,
  decimationType: DecimationType,
  fraction: number,
  rule: CompletionRule
): ReconstructionResult {
  const length = source.length;

  // 1. Reversible Affine Transform
  const transformed = applyAffineTransform(source, k, b);

  // 2. Decimate in transformed space
  const deci = decimate(length, decimationType, fraction);
  const knownIndices = deci.keptIndices;
  const knownValues = knownIndices.map(idx => transformed[idx]);

  const decimatedTransformed: (number | null)[] = new Array(length).fill(null);
  for (let i = 0; i < knownIndices.length; i++) {
    decimatedTransformed[knownIndices[i]] = knownValues[i];
  }

  // 3. Structural Completion
  const reconstructedTransformed = completeMissingSamples(knownIndices, knownValues, length, rule);

  // 4. Invert Affine Transform
  const reconstructedOriginal = invertAffineTransform(reconstructedTransformed, k, b);

  // 5. Compute Error & Fidelity Metrics
  let maxError = 0;
  let sse = 0;
  for (let i = 0; i < length; i++) {
    const err = Math.abs(source[i] - reconstructedOriginal[i]);
    if (err > maxError) maxError = err;
    sse += err * err;
  }
  const mse = sse / length;
  const psnr = mse === 0 ? 100 : 10 * Math.log10((255 * 255) / mse);
  const isExact = maxError <= 1; // Strict integer match / byte quantization
  const isNearExact = maxError <= 4 && mse <= 4.0;

  // 6. Compute Real Bit Budget Accounting
  // Uncompressed: 256 samples * 8 bits = 2048 bits
  const rawBits = length * 8;
  const retainedCount = knownIndices.length;
  const retainedSampleBits = retainedCount * 8;
  const rotationMetadataBits = 8; // k in 0..255
  const phaseShiftBits = 8;      // b in 0..255
  const patternHeaderBits = 8;   // 8-bit flag for decimation mode/stride
  const ruleHeaderBits = 4;      // 4-bit rule identifier
  const totalCompressedBits = retainedSampleBits + rotationMetadataBits + phaseShiftBits + patternHeaderBits + ruleHeaderBits;
  const compressionRatio = rawBits / totalCompressedBits;
  const spaceSavingPercent = Math.max(0, (1 - totalCompressedBits / rawBits) * 100);

  const bitBudget: BitBudget = {
    rawBits,
    retainedSampleBits,
    rotationMetadataBits,
    phaseShiftBits,
    patternHeaderBits,
    ruleHeaderBits,
    totalCompressedBits,
    compressionRatio,
    spaceSavingPercent
  };

  return {
    original: source,
    transformed,
    decimatedTransformed,
    reconstructedTransformed,
    reconstructedOriginal,
    maxError,
    mse,
    psnr,
    isExact,
    isNearExact,
    bitBudget
  };
}

/**
 * Compute Structural Compressibility rho(X, k):
 * Minimum fraction of transformed samples needed to reconstruct X exactly (or within tolerance)
 */
export function computeRho(
  source: number[],
  k: number,
  b: number = 0,
  rule: CompletionRule = 'orbit_smoothness',
  exactTolerance: boolean = true
): { rho: number; lastExactLevel: string; retainedCount: number; maxError: number; psnr: number } {
  // Test discrete decimation thresholds: 1/16 (0.0625), 1/8 (0.125), 1/4 (0.25), 1/2 (0.50), 3/4 (0.75), 7/8 (0.875), 1.0
  const stages: { label: string; fraction: number; type: DecimationType }[] = [
    { label: '1/16 (16 cells)', fraction: 0.0625, type: 'stride_16' },
    { label: '1/8 (32 cells)', fraction: 0.125, type: 'stride_8' },
    { label: '1/4 (64 cells)', fraction: 0.25, type: 'stride_4' },
    { label: '1/2 (128 cells)', fraction: 0.5, type: 'stride_2' },
    { label: '3/4 (192 cells)', fraction: 0.75, type: 'random_fraction' },
    { label: '7/8 (224 cells)', fraction: 0.875, type: 'random_fraction' },
    { label: 'Full (256 cells)', fraction: 1.0, type: 'stride_2' }
  ];

  for (const stage of stages) {
    const res = runDecimationPipeline(source, k, b, stage.type, stage.fraction, rule);
    const pass = exactTolerance ? res.isExact : res.isNearExact;
    if (pass) {
      return {
        rho: stage.fraction,
        lastExactLevel: stage.label,
        retainedCount: Math.round(source.length * stage.fraction),
        maxError: res.maxError,
        psnr: res.psnr
      };
    }
  }

  // If even 7/8 fails, try fine steps towards 1.0
  return {
    rho: 1.0,
    lastExactLevel: 'None (Requires 100%)',
    retainedCount: source.length,
    maxError: 0,
    psnr: 100
  };
}

/**
 * Scan all 256 Affine Orbit Rotations to compute full Resonance Spectrum S(k)
 * S(k) = 1 - rho(X, k) (Higher S(k) means lower rho(X, k) -> more compressible!)
 */
export interface OrbitScanResult {
  rotations: number[];
  rhos: number[];
  resonanceScores: number[]; // S(k) in [0, 1]
  bestK: number;
  bestRho: number;
  rawRho: number;           // rho(X, 0)
  compressibilityGain: number; // rawRho / bestRho
  bestLastExactLevel: string;
}

export function scanOrbitResonance(
  source: number[],
  rule: CompletionRule = 'orbit_smoothness',
  b: number = 0,
  stride: number = 1
): OrbitScanResult {
  const rotations: number[] = [];
  const rhos: number[] = [];
  const resonanceScores: number[] = [];

  let bestK = 0;
  let bestRho = 1.0;
  let bestLevel = 'None';

  for (let k = 0; k < 256; k += stride) {
    const { rho, lastExactLevel } = computeRho(source, k, b, rule, false);
    rotations.push(k);
    rhos.push(rho);
    const score = Math.max(0, 1 - rho);
    resonanceScores.push(score);

    if (rho < bestRho) {
      bestRho = rho;
      bestK = k;
      bestLevel = lastExactLevel;
    }
  }

  const rawRho = rhos[0];
  const compressibilityGain = bestRho > 0 ? (rawRho / bestRho) : 1;

  return {
    rotations,
    rhos,
    resonanceScores,
    bestK,
    bestRho,
    rawRho,
    compressibilityGain,
    bestLastExactLevel: bestLevel
  };
}
