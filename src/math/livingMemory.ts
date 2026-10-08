/**
 * Living Holographic Memory & Phase Crystallization Engine
 * 
 * Takes the swarm concept to the next frontier:
 * 1. Sharded Memory: Data is not in a database; it is carried inside the living swarm.
 * 2. Consensus Reconstruction: The picture only appears when Values share witnesses.
 * 3. Thermodynamic Phase Transitions: Gas (Chaos) -> Liquid (Foraging) -> Crystal (Order).
 * 4. Self-Healing Resilience: Survives radiation strikes and regenerates lost data.
 */

import { toroidalDist } from './swarm';
import { applyAffineTransform, invertAffineTransform } from './gf257';

export interface MemoryShard {
  index: number;
  value: number;
}

export interface LivingValue {
  id: string;
  name: string;
  k0: number;
  k1: number;
  vx: number;
  vy: number;
  color: string;
  shards: MemoryShard[]; // The pieces of reality this value remembers
  localConsensusCount: number;
  crystallized: boolean;
  health: number; // 0 to 1
}

export type PhaseState = 'gas' | 'liquid' | 'crystal';

export interface LivingMemoryState {
  values: LivingValue[];
  consensusCanvas: (number | null)[];
  reconstructedCompleteness: number; // 0 to 1
  phase: PhaseState;
  entropy: number; // 0 (frozen crystal) to 1 (pure chaos)
  crystallizationProgress: number; // 0 to 1
  healedCellsCount: number;
  stepCount: number;
}

const LIVING_PALETTE = [
  '#06b6d4', '#38bdf8', '#818cf8', '#a855f7',
  '#ec4899', '#f43f5e', '#f97316', '#eab308',
  '#10b981', '#14b8a6', '#6366f1', '#22d3ee'
];

/**
 * Initialize Living Memory Swarm by sharding the original signal
 */
export function initLivingMemory(
  source: number[],
  valueCount: number = 24,
  shardsPerValue: number = 16
): LivingMemoryState {
  const totalCells = source.length; // 256
  const values: LivingValue[] = [];

  for (let i = 0; i < valueCount; i++) {
    // Distribute sample shards uniformly and overlappingly across values
    const shards: MemoryShard[] = [];
    for (let s = 0; s < shardsPerValue; s++) {
      const cellIdx = (i * 7 + s * 13) % totalCells;
      shards.push({ index: cellIdx, value: source[cellIdx] });
    }

    values.push({
      id: `living_${i}`,
      name: `Witness ${String.fromCharCode(65 + (i % 26))}${i >= 26 ? Math.floor(i / 26) : ''}`,
      k0: Math.floor(Math.random() * 256),
      k1: Math.floor(Math.random() * 256),
      vx: (Math.random() - 0.5) * 2,
      vy: (Math.random() - 0.5) * 2,
      color: LIVING_PALETTE[i % LIVING_PALETTE.length],
      shards,
      localConsensusCount: 0,
      crystallized: false,
      health: 1.0
    });
  }

  return {
    values,
    consensusCanvas: new Array(totalCells).fill(null),
    reconstructedCompleteness: 0,
    phase: 'gas',
    entropy: 0.95,
    crystallizationProgress: 0,
    healedCellsCount: 0,
    stepCount: 0
  };
}

/**
 * Step Living Memory Swarm:
 * Values drift, exchange shards upon proximity, and assemble consensus image.
 */
export function stepLivingMemory(
  state: LivingMemoryState,
  targetK0: number,
  targetK1: number,
  couplingForce: number = 0.5
): LivingMemoryState {
  const totalCells = 256;
  const canvas: (number | null)[] = [...state.consensusCanvas];
  let sharedWitnesses = 0;

  // 1. Move and Gossip
  const updatedValues = state.values.map(val => {
    let vx = val.vx * 0.9;
    let vy = val.vy * 0.9;

    // Pull toward target resonant crystal lattice if coupling force > 0
    const { dx: targetDx, dy: targetDy, dist: targetDist } = toroidalDist(val.k0, val.k1, targetK0, targetK1);
    vx += (targetDx / (targetDist + 8)) * couplingForce * 1.8;
    vy += (targetDy / (targetDist + 8)) * couplingForce * 1.8;

    // Brownian thermal noise based on entropy
    const thermal = state.entropy * 1.5;
    vx += (Math.random() - 0.5) * thermal;
    vy += (Math.random() - 0.5) * thermal;

    const newK0 = Math.round((val.k0 + vx + 256) % 256);
    const newK1 = Math.round((val.k1 + vy + 256) % 256);

    // Deposit shards into consensus canvas
    for (const sh of val.shards) {
      if (canvas[sh.index] === null) {
        canvas[sh.index] = sh.value;
        sharedWitnesses++;
      }
    }

    const isCrystallized = targetDist < 20 && couplingForce > 0.6;

    return {
      ...val,
      k0: newK0,
      k1: newK1,
      vx,
      vy,
      crystallized: isCrystallized
    };
  });

  // 2. Peer-to-Peer Shard Insemination:
  // When two values pass within radius 40, they exchange their rare shards!
  for (let i = 0; i < updatedValues.length; i++) {
    for (let j = i + 1; j < updatedValues.length; j++) {
      const v1 = updatedValues[i];
      const v2 = updatedValues[j];
      const { dist } = toroidalDist(v1.k0, v1.k1, v2.k0, v2.k1);

      if (dist < 40) {
        // Exchange a missing shard
        const missingForV1 = v2.shards.find(s2 => !v1.shards.some(s1 => s1.index === s2.index));
        if (missingForV1 && v1.shards.length < 32) {
          v1.shards.push(missingForV1);
        }
        const missingForV2 = v1.shards.find(s1 => !v2.shards.some(s2 => s2.index === s1.index));
        if (missingForV2 && v2.shards.length < 32) {
          v2.shards.push(missingForV2);
        }
      }
    }
  }

  // 3. Evaluate Consensus Completeness & Phase
  let knownCount = 0;
  for (let i = 0; i < totalCells; i++) {
    if (canvas[i] !== null) knownCount++;
  }
  const completeness = knownCount / totalCells;

  // Determine thermodynamic phase
  let phase: PhaseState = 'gas';
  let entropy = Math.max(0.05, 1 - couplingForce);
  let crystallizationProgress = 0;

  if (couplingForce > 0.7 && completeness > 0.8) {
    phase = 'crystal';
    entropy = 0.08;
    crystallizationProgress = Math.min(1, completeness * 1.1);
  } else if (couplingForce > 0.3 || completeness > 0.4) {
    phase = 'liquid';
    entropy = 0.45;
    crystallizationProgress = completeness * 0.6;
  }

  return {
    values: updatedValues,
    consensusCanvas: canvas,
    reconstructedCompleteness: completeness,
    phase,
    entropy,
    crystallizationProgress,
    healedCellsCount: state.healedCellsCount + sharedWitnesses,
    stepCount: state.stepCount + 1
  };
}

/**
 * Cosmic Radiation / Entropy Strike:
 * Scatters the swarm and wipes out 50% of memory shards to demonstrate self-healing!
 */
export function injectEntropyStrike(state: LivingMemoryState): LivingMemoryState {
  const damagedCanvas = new Array(256).fill(null);

  // Scatter all values with huge explosive impulse
  const scatteredValues = state.values.map(val => {
    // 50% chance of shard loss
    const remainingShards = val.shards.filter(() => Math.random() > 0.4);

    return {
      ...val,
      vx: (Math.random() - 0.5) * 16,
      vy: (Math.random() - 0.5) * 16,
      crystallized: false,
      shards: remainingShards,
      health: 0.5
    };
  });

  return {
    ...state,
    values: scatteredValues,
    consensusCanvas: damagedCanvas,
    reconstructedCompleteness: 0.2,
    phase: 'gas',
    entropy: 1.0,
    crystallizationProgress: 0
  };
}
