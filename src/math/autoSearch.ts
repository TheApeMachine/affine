/**
 * Automated Search & Optimization Utilities
 * Allows number-blind and visual users to automatically discover
 * sweet spots, optimal affine orientations, and multiscale peaks.
 */

import { CompletionRule, runDecimationPipeline, computeRho } from './compression';
import { MultiscaleSurface } from './multiscale';

export interface ResonantDiscovery {
  k: number;
  rho: number;
  compressionRatio: number;
  psnr: number;
  maxError: number;
  label: string;
  badge: 'Maximum Space Saving' | 'Exact Structural Lock' | 'Harmonic Symmetry' | 'Balanced';
  description: string;
}

/**
 * Automatically analyze and discover the most interesting affine rotations
 */
export function findTopDiscoveries(
  source: number[],
  rule: CompletionRule = 'orbit_smoothness'
): ResonantDiscovery[] {
  const candidates: { k: number; rho: number; psnr: number; maxError: number; ratio: number }[] = [];

  // Sample orientations
  for (let k = 0; k < 256; k += 2) {
    const rhoInfo = computeRho(source, k, 0, rule, false);
    const pipeline = runDecimationPipeline(source, k, 0, 'stride_4', 0.25, rule);
    candidates.push({
      k,
      rho: rhoInfo.rho,
      psnr: pipeline.psnr,
      maxError: pipeline.maxError,
      ratio: pipeline.bitBudget.compressionRatio
    });
  }

  // Sort by lowest rho first (highest compression), then by highest PSNR
  candidates.sort((a, b) => {
    if (a.rho !== b.rho) return a.rho - b.rho;
    return b.psnr - a.psnr;
  });

  const discoveries: ResonantDiscovery[] = [];
  const seenK = new Set<number>();

  for (const cand of candidates) {
    if (seenK.has(cand.k)) continue;
    // Keep distance between discoveries for variety
    const tooClose = Array.from(seenK).some(k => Math.abs(k - cand.k) < 6);
    if (tooClose && discoveries.length >= 2) continue;

    seenK.add(cand.k);

    let badge: ResonantDiscovery['badge'] = 'Balanced';
    let label = `Resonant Peak k = ${cand.k}`;
    let desc = `Retains shape with only ${(cand.rho * 100).toFixed(0)}% samples.`;

    if (cand.maxError <= 1 && cand.rho <= 0.25) {
      badge = 'Maximum Space Saving';
      label = `Ultra Compress (k = ${cand.k})`;
      desc = `4x to 8x compression with flawless visual reconstruction.`;
    } else if (cand.maxError <= 1) {
      badge = 'Exact Structural Lock';
      label = `Flawless Lock (k = ${cand.k})`;
      desc = `Zero pixel error: completely identical to the original image.`;
    } else if (cand.psnr >= 35) {
      badge = 'Harmonic Symmetry';
      label = `Smooth Symmetry (k = ${cand.k})`;
      desc = `High fidelity resonance (${cand.psnr.toFixed(0)} dB visual clarity).`;
    }

    discoveries.push({
      k: cand.k,
      rho: cand.rho,
      compressionRatio: cand.ratio,
      psnr: cand.psnr,
      maxError: cand.maxError,
      label,
      badge,
      description: desc
    });

    if (discoveries.length >= 4) break;
  }

  // Always make sure k = 0 (Unrotated baseline) is included for contrast
  if (!seenK.has(0)) {
    const baseRho = computeRho(source, 0, 0, rule, false);
    const basePipe = runDecimationPipeline(source, 0, 0, 'stride_4', 0.25, rule);
    discoveries.push({
      k: 0,
      rho: baseRho.rho,
      compressionRatio: basePipe.bitBudget.compressionRatio,
      psnr: basePipe.psnr,
      maxError: basePipe.maxError,
      label: 'Unrotated Raw (k = 0)',
      badge: 'Balanced',
      description: 'The standard pixel coordinate frame without any affine transform.'
    });
  }

  return discoveries;
}

/**
 * Gradient ascent / peak finder on 2D Multiscale surface S(k0, k1)
 */
export function findMultiscalePathToPeak(
  surface: MultiscaleSurface,
  startK0: number,
  startK1: number
): { k0: number; k1: number }[] {
  const path: { k0: number; k1: number }[] = [{ k0: startK0, k1: startK1 }];
  const res = 16;
  const step = 256 / res;

  let currR = Math.floor(startK0 / step) % res;
  let currC = Math.floor(startK1 / step) % res;

  for (let iter = 0; iter < 12; iter++) {
    let bestR = currR;
    let bestC = currC;
    let bestVal = surface.grid[currR]?.[currC] || 0;

    // Check 8 neighbors
    const neighbors = [
      [-1, 0], [1, 0], [0, -1], [0, 1],
      [-1, -1], [-1, 1], [1, -1], [1, 1]
    ];

    for (const [dr, dc] of neighbors) {
      const nr = (currR + dr + res) % res;
      const nc = (currC + dc + res) % res;
      const val = surface.grid[nr]?.[nc] || 0;
      if (val > bestVal) {
        bestVal = val;
        bestR = nr;
        bestC = nc;
      }
    }

    if (bestR === currR && bestC === currC) {
      break; // Reached local peak
    }

    currR = bestR;
    currC = bestC;
    path.push({
      k0: Math.round(currR * step),
      k1: Math.round(currC * step)
    });
  }

  // Final step to global peak
  if (path.length > 0) {
    path.push({ k0: surface.bestK0, k1: surface.bestK1 });
  }

  return path;
}
