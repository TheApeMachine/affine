/**
 * Multiscale GF(257) Hierarchical Space & Holographic Erasure Resilience
 * 
 * Implements:
 * 1. Hierarchical coordinates (x0, x1, ...)
 * 2. Multiscale affine transforms: x0' = a0*x0 + b0, x1' = a1*x1 + b1
 * 3. 2D Resonance Surface S(k0, k1)
 * 4. Interleaving & Holographic Damage Spreading:
 *    Rotate -> Spread/Interleave -> Subdivide -> Rotate Locally -> Spread
 * 5. Recursive Decimation Descent Experiment:
 *    Level 0 (256) -> Level 1 (128) -> Level 2 (64) -> Level 3 (32) -> Level 4 (16) -> Level 5 (8)
 */

import { getAffinePermutation, applyAffineTransform, invertAffineTransform } from './gf257';
import { runDecimationPipeline, CompletionRule, DecimationType } from './compression';

export interface MultiscaleAddress {
  macro: number;   // x0: top-level cell (0..15)
  micro: number;   // x1: subcell inside macro (0..15)
  linearIndex: number;
}

export function indexToAddress(idx: number, macroSize: number = 16): MultiscaleAddress {
  const macro = Math.floor(idx / macroSize);
  const micro = idx % macroSize;
  return { macro, micro, linearIndex: idx };
}

export function addressToIndex(macro: number, micro: number, macroSize: number = 16): number {
  return macro * macroSize + micro;
}

/**
 * Apply multiscale affine rotation parameterized by (k0, k1, b0, b1):
 * Scale 0: global macro-cell permutation
 * Scale 1: local micro-cell permutation inside each macro-cell
 */
export function applyMultiscaleTransform(
  samples: number[],
  k0: number,
  k1: number,
  b0: number = 0,
  b1: number = 0,
  macroCount: number = 16,
  microCount: number = 16
): number[] {
  const total = samples.length;
  const out = new Array<number>(total);

  // 1. Get permutations for scale 0 and scale 1
  const perm0 = getAffinePermutation(k0, b0, macroCount);
  const perm1 = getAffinePermutation(k1, b1, microCount);

  for (let idx = 0; idx < total; idx++) {
    const macro = Math.floor(idx / microCount);
    const micro = idx % microCount;

    const newMacro = perm0.forward[macro];
    const newMicro = perm1.forward[micro];

    const newIdx = newMacro * microCount + newMicro;
    out[newIdx] = samples[idx];
  }

  return out;
}

/**
 * Invert multiscale affine rotation
 */
export function invertMultiscaleTransform(
  transformed: number[],
  k0: number,
  k1: number,
  b0: number = 0,
  b1: number = 0,
  macroCount: number = 16,
  microCount: number = 16
): number[] {
  const total = transformed.length;
  const out = new Array<number>(total);

  const perm0 = getAffinePermutation(k0, b0, macroCount);
  const perm1 = getAffinePermutation(k1, b1, microCount);

  for (let newIdx = 0; newIdx < total; newIdx++) {
    const newMacro = Math.floor(newIdx / microCount);
    const newMicro = newIdx % microCount;

    const origMacro = perm0.inverse[newMacro];
    const origMicro = perm1.inverse[newMicro];

    const origIdx = origMacro * microCount + origMicro;
    out[origIdx] = transformed[newIdx];
  }

  return out;
}

/**
 * Multiscale Interleaving & Holographic Damage Spreading:
 * Pipeline:
 * 1. Global affine rotation at Level 0
 * 2. Interleave / spread: transpose macro and micro indices (matrix corner transposition)
 * 3. Local affine rotation at Level 1 inside each sub-block
 * 4. Secondary interleave / dispersion
 */
export function holographicEncode(
  samples: number[],
  k0: number,
  k1: number,
  dim: number = 16
): { encoded: number[]; interleavingSteps: string[] } {
  // Step 1: Global rotation at level 0
  const step1 = applyAffineTransform(samples, k0, 0);

  // Step 2: Transposition / Spatial Spread
  const step2 = new Array(samples.length);
  for (let r = 0; r < dim; r++) {
    for (let c = 0; c < dim; c++) {
      // Transpose coordinates with affine dispersion
      const spreadIdx = ((c * 11 + r * 7) % dim) * dim + ((r * 13 + c) % dim);
      step2[spreadIdx] = step1[r * dim + c];
    }
  }

  // Step 3: Local affine rotation at Level 1 within blocks
  const step3 = new Array(samples.length);
  const permLocal = getAffinePermutation(k1, 3, dim);
  for (let b = 0; b < dim; b++) {
    for (let cell = 0; cell < dim; cell++) {
      const origPos = b * dim + cell;
      const targetPos = b * dim + permLocal.forward[cell];
      step3[targetPos] = step2[origPos];
    }
  }

  return {
    encoded: step3,
    interleavingSteps: [
      'Scale 0 Global Affine Orbit',
      'Multiscale Interleaving & Coordinate Dispersion',
      'Scale 1 Intra-Cell Local Affine Rotation'
    ]
  };
}

export function holographicDecode(
  damagedEncoded: (number | null)[],
  originalSamples: number[],
  k0: number,
  k1: number,
  dim: number = 16
): {
  reconstructed: number[];
  recoveredCount: number;
  missingCount: number;
  mse: number;
  psnr: number;
} {
  const total = originalSamples.length;
  // Invert step 3 (Local affine)
  const permLocal = getAffinePermutation(k1, 3, dim);
  const step2Recovered: (number | null)[] = new Array(total).fill(null);
  for (let b = 0; b < dim; b++) {
    for (let cell = 0; cell < dim; cell++) {
      const currentPos = b * dim + permLocal.forward[cell];
      step2Recovered[b * dim + cell] = damagedEncoded[currentPos];
    }
  }

  // Invert step 2 (Transposition / Spread)
  const step1Recovered: (number | null)[] = new Array(total).fill(null);
  for (let r = 0; r < dim; r++) {
    for (let c = 0; c < dim; c++) {
      const spreadIdx = ((c * 11 + r * 7) % dim) * dim + ((r * 13 + c) % dim);
      step1Recovered[r * dim + c] = step2Recovered[spreadIdx];
    }
  }

  // Invert step 1 (Global affine)
  const permGlobal = getAffinePermutation(k0, 0, total);
  const reconstructed: (number | null)[] = new Array(total).fill(null);
  for (let i = 0; i < total; i++) {
    reconstructed[permGlobal.inverse[i]] = step1Recovered[i];
  }

  // Now, missing samples in the spatial domain are dispersed across the entire image
  // rather than a giant contiguous gaping hole!
  // Complete the remaining isolated missing pixels using 2D neighbor consensus
  let recoveredCount = 0;
  let missingCount = 0;
  const finalImage = new Array<number>(total);

  for (let i = 0; i < total; i++) {
    if (reconstructed[i] !== null) {
      finalImage[i] = reconstructed[i] as number;
      recoveredCount++;
    } else {
      missingCount++;
    }
  }

  // Iterative neighborhood completion on dispersed missing cells
  for (let iter = 0; iter < 4; iter++) {
    for (let y = 0; y < dim; y++) {
      for (let x = 0; x < dim; x++) {
        const idx = y * dim + x;
        if (reconstructed[idx] === null) {
          // Average valid neighbors
          let sum = 0, count = 0;
          const neighbors = [
            [y - 1, x], [y + 1, x], [y, x - 1], [y, x + 1],
            [y - 1, x - 1], [y - 1, x + 1], [y + 1, x - 1], [y + 1, x + 1]
          ];
          for (const [ny, nx] of neighbors) {
            if (ny >= 0 && ny < dim && nx >= 0 && nx < dim) {
              const nIdx = ny * dim + nx;
              if (reconstructed[nIdx] !== null) {
                sum += reconstructed[nIdx] as number;
                count++;
              }
            }
          }
          finalImage[idx] = count > 0 ? Math.round(sum / count) : 128;
        }
      }
    }
  }

  let sse = 0;
  for (let i = 0; i < total; i++) {
    const err = originalSamples[i] - finalImage[i];
    sse += err * err;
  }
  const mse = sse / total;
  const psnr = mse === 0 ? 100 : 10 * Math.log10((255 * 255) / mse);

  return {
    reconstructed: finalImage,
    recoveredCount,
    missingCount,
    mse,
    psnr
  };
}

/**
 * 2D Multiscale Resonance Surface S(k0, k1):
 * Evaluates compressibility across a grid of (k0, k1) viewpoints
 */
export interface MultiscaleSurface {
  k0Values: number[];
  k1Values: number[];
  grid: number[][]; // [k0Index][k1Index] = S(k0, k1) in [0, 1]
  bestK0: number;
  bestK1: number;
  bestScore: number;
}

export function computeMultiscaleSurface(
  samples: number[],
  rule: CompletionRule = 'orbit_smoothness',
  resolution: number = 16
): MultiscaleSurface {
  const step = Math.floor(256 / resolution);
  const k0Values: number[] = [];
  const k1Values: number[] = [];
  for (let i = 0; i < resolution; i++) {
    k0Values.push(i * step);
    k1Values.push(i * step);
  }

  const grid: number[][] = [];
  let bestK0 = 0, bestK1 = 0, bestScore = -1;

  for (let i = 0; i < resolution; i++) {
    const row: number[] = [];
    const k0 = k0Values[i];
    for (let j = 0; j < resolution; j++) {
      const k1 = k1Values[j];
      // Run multiscale transform
      const transformed = applyMultiscaleTransform(samples, k0, k1);
      // Evaluate compression ratio at 1/2 decimation
      const res = runDecimationPipeline(transformed, 0, 0, 'stride_2', 0.5, rule);
      const score = Math.max(0, Math.min(1, (res.psnr - 15) / 50));
      row.push(score);

      if (score > bestScore) {
        bestScore = score;
        bestK0 = k0;
        bestK1 = k1;
      }
    }
    grid.push(row);
  }

  return {
    k0Values,
    k1Values,
    grid,
    bestK0,
    bestK1,
    bestScore
  };
}

/**
 * Recursive Decimation Descent Experiment:
 * rotate at level 0 -> decimate -> rotate within survivors at level 1 -> decimate -> ...
 * Measure: How deep can we recurse before the original stops being uniquely reconstructible?
 */
export interface RecursiveLevelResult {
  level: number;
  inputSamplesCount: number;
  keptSamplesCount: number;
  fractionKept: number;
  rotationK: number;
  reconstructionPsnr: number;
  reconstructionMaxError: number;
  isExact: boolean;
  isNearExact: boolean;
  compressedBits: number;
  compressionRatio: number;
  reconstructedSignal: number[];
}

export interface RecursiveDescentExperiment {
  levels: RecursiveLevelResult[];
  deepestExactLevel: number;
  deepestNearExactLevel: number;
  finalCompressionRatio: number;
  conclusion: string;
}

export function runRecursiveDescent(
  source: number[],
  rotations: number[],
  rule: CompletionRule = 'orbit_smoothness'
): RecursiveDescentExperiment {
  const levels: RecursiveLevelResult[] = [];
  let currentSignal = [...source];
  let deepestExact = -1;
  let deepestNear = -1;

  // Level 0: 256 -> 128 (keep 1/2)
  // Level 1: 128 -> 64  (keep 1/2)
  // Level 2: 64 -> 32   (keep 1/2)
  // Level 3: 32 -> 16   (keep 1/2)
  // Level 4: 16 -> 8    (keep 1/2)

  const totalRawBits = source.length * 8; // 2048 bits

  for (let lvl = 0; lvl < 5; lvl++) {
    const k = rotations[lvl % rotations.length] || 17;
    const inputCount = currentSignal.length;
    const keptCount = Math.floor(inputCount / 2);
    if (keptCount < 4) break;

    // Apply rotation at current level
    const transformed = applyAffineTransform(currentSignal, k, 0);

    // Decimate: keep even indices (1/2)
    const keptSamples: number[] = [];
    for (let i = 0; i < inputCount; i += 2) {
      keptSamples.push(transformed[i]);
    }

    // Now attempt recursive reconstruction back to the full original source (256 samples)
    // 1. Structural completion of current level
    const knownIndices = [];
    for (let i = 0; i < inputCount; i += 2) knownIndices.push(i);
    const completedCurrent = runDecimationPipeline(currentSignal, k, 0, 'stride_2', 0.5, rule);

    // Propagate up: compare completed reconstruction against original source
    let reconstructedFull = [...completedCurrent.reconstructedOriginal];
    if (lvl > 0 && levels[lvl - 1]) {
      // Scale back to 256
      const prev = levels[lvl - 1].reconstructedSignal;
      reconstructedFull = prev.map((val, idx) => Math.round((val + (reconstructedFull[idx % reconstructedFull.length] || val)) / 2));
    }

    // Metrics against original 256 samples
    let maxErr = 0;
    let sse = 0;
    for (let i = 0; i < source.length; i++) {
      const err = Math.abs(source[i] - (reconstructedFull[i] || 0));
      if (err > maxErr) maxErr = err;
      sse += err * err;
    }
    const mse = sse / source.length;
    const psnr = mse === 0 ? 100 : 10 * Math.log10((255 * 255) / mse);
    const isExact = maxErr <= 1;
    const isNearExact = maxErr <= 5 && psnr >= 32;

    if (isExact) deepestExact = lvl;
    if (isNearExact) deepestNear = lvl;

    // Bit budget accounting at level L
    // Kept samples * 8 + (lvl + 1) * 8 bits rotation metadata + 8 bits header
    const compressedBits = keptCount * 8 + (lvl + 1) * 8 + 12;
    const compRatio = totalRawBits / compressedBits;

    levels.push({
      level: lvl,
      inputSamplesCount: inputCount,
      keptSamplesCount: keptCount,
      fractionKept: keptCount / source.length,
      rotationK: k,
      reconstructionPsnr: psnr,
      reconstructionMaxError: maxErr,
      isExact,
      isNearExact,
      compressedBits,
      compressionRatio: compRatio,
      reconstructedSignal: reconstructedFull
    });

    // Advance to survivors for next scale
    currentSignal = keptSamples;
  }

  let conclusion = '';
  if (deepestExact >= 2) {
    conclusion = `Strong structural redundancy: reconstructed exactly through Level ${deepestExact} (${levels[deepestExact].keptSamplesCount} survivors, ${levels[deepestExact].compressionRatio.toFixed(1)}x compression ratio).`;
  } else if (deepestNear >= 1) {
    conclusion = `Moderate structural resilience: high fidelity maintained to Level ${deepestNear} (${levels[deepestNear].keptSamplesCount} survivors, PSNR ${levels[deepestNear].reconstructionPsnr.toFixed(1)} dB).`;
  } else {
    conclusion = `Fragile source structure: representation collapses quickly past Level 0; entropy limits decimation without loss.`;
  }

  return {
    levels,
    deepestExactLevel: deepestExact,
    deepestNearExactLevel: deepestNear,
    finalCompressionRatio: levels[levels.length - 1]?.compressionRatio || 1,
    conclusion
  };
}
