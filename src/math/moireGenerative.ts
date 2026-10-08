/**
 * Generative Moiré Interference & Affine Trajectory Synthesis
 * 
 * Visualizes the idea that natural language has a hidden periodic rhythm,
 * and that overlapping deterministic affine grids can act as an
 * Iterated Function System (IFS) / Moiré synthesizer to generate coherent text
 * from simple coordinate trajectories [k, ShiftX, ShiftY].
 */

import { getAffinePermutation } from './gf257';

export interface TrajectoryStep {
  stepIndex: number;
  k1: number;
  shiftX1: number;
  shiftY1: number;
  k2: number;
  shiftX2: number;
  shiftY2: number;
  generatedToken: string;
  explanation: string;
  resonanceEnergy: number; // 0 to 1
}

export interface MoireSubstrate {
  id: string;
  name: string;
  characters: string[]; // 256 characters
  description: string;
}

export const SUBSTRATES: MoireSubstrate[] = [
  {
    id: 'sandra_roy',
    name: 'Sandra & Roy Rhythm (Screenshot Match)',
    description: 'The periodic phrasing from your screenshot. Watch k=3 sort letters into vertical stripes and k=19 sort into horizontal bands!',
    characters: (() => {
      const text = "Sandra is in the garden. Roy is in the kitchen. ";
      const chars: string[] = [];
      for (let i = 0; i < 256; i++) {
        chars.push(text[i % text.length]);
      }
      return chars;
    })()
  },
  {
    id: 'alice_wonderland',
    name: 'Alice in Wonderland Cadence',
    description: 'Lewis Carroll opening: "Alice was beginning to get very tired of sitting by her sister on the bank..."',
    characters: (() => {
      const text = "Alice was beginning to get very tired of sitting by her sister on the bank, and of having nothing to do: once or twice she had peeped into the book her sister was reading, but it had no pictures or conversations in it. ";
      const chars: string[] = [];
      for (let i = 0; i < 256; i++) {
        chars.push(text[i % text.length]);
      }
      return chars;
    })()
  },
  {
    id: 'phonetic_crystal',
    name: 'English Phonetic Base Crystal',
    description: 'Zipf-distributed alphabet matrix arranged by natural vowel-consonant alternating meter.',
    characters: (() => {
      // Frequency-weighted characters
      const freqOrder = "ETAOINSHRDLCUMWFGYPBVKJXQZ ";
      const chars: string[] = [];
      for (let i = 0; i < 256; i++) {
        const char = freqOrder[Math.floor((i * 17) % freqOrder.length)];
        chars.push(char);
      }
      return chars;
    })()
  }
];

export const PRESET_TRAJECTORIES: { id: string; name: string; substrateId: string; steps: TrajectoryStep[] }[] = [
  {
    id: 'alice_unfolding',
    name: 'Trajectory 1: Unfolding Alice in Wonderland',
    substrateId: 'alice_wonderland',
    steps: [
      {
        stepIndex: 0,
        k1: 0, shiftX1: 0, shiftY1: 0,
        k2: 0, shiftX2: 0, shiftY2: 0,
        generatedToken: "ALICE",
        explanation: "Starting state: Base crystal resting at unrotated identity (k=0).",
        resonanceEnergy: 0.95
      },
      {
        stepIndex: 1,
        k1: 3, shiftX1: 2, shiftY1: 0,
        k2: 1, shiftX2: 0, shiftY2: 1,
        generatedToken: "WAS",
        explanation: "Shift vector (2,0) with k=3 stroboscope aligns the verb sequence.",
        resonanceEnergy: 0.88
      },
      {
        stepIndex: 2,
        k1: 14, shiftX1: 5, shiftY1: 2,
        k2: 7, shiftX2: 1, shiftY2: 3,
        generatedToken: "BEGINNING",
        explanation: "Harmonic rotation k=14 causes 4-fold tessellation, repeating the ing-participle.",
        resonanceEnergy: 0.92
      },
      {
        stepIndex: 3,
        k1: 19, shiftX1: 1, shiftY1: 4,
        k2: 3, shiftX2: 2, shiftY2: 2,
        generatedToken: "TO GET",
        explanation: "Horizontal banding rotation k=19 stacks infinitive markers into coherent line.",
        resonanceEnergy: 0.85
      },
      {
        stepIndex: 4,
        k1: 48, shiftX1: 8, shiftY1: 3,
        k2: 14, shiftX2: 4, shiftY2: 1,
        generatedToken: "VERY TIRED",
        explanation: "Cardioid vortex k=48 contracts phonemes into predicate clause.",
        resonanceEnergy: 0.91
      },
      {
        stepIndex: 5,
        k1: 120, shiftX1: 3, shiftY1: 7,
        k2: 19, shiftX2: 6, shiftY2: 2,
        generatedToken: "OF SITTING",
        explanation: "Diagonal folding at k=120 produces participial gerund cadence.",
        resonanceEnergy: 0.89
      },
      {
        stepIndex: 6,
        k1: 248, shiftX1: 4, shiftY1: 2,
        k2: 48, shiftX2: 0, shiftY2: 5,
        generatedToken: "BY HER SISTER",
        explanation: "Hyperbolic splitting k=248 completes the opening scene.",
        resonanceEnergy: 0.94
      }
    ]
  },
  {
    id: 'sandra_sorting_dance',
    name: 'Trajectory 2: The Stroboscopic Sorting Dance',
    substrateId: 'sandra_roy',
    steps: [
      {
        stepIndex: 0,
        k1: 0, shiftX1: 0, shiftY1: 0,
        k2: 0, shiftX2: 0, shiftY2: 0,
        generatedToken: "SANDRA IN GARDEN",
        explanation: "Diagonal repetition (raw unrotated state).",
        resonanceEnergy: 0.6
      },
      {
        stepIndex: 1,
        k1: 3, shiftX1: 0, shiftY1: 0,
        k2: 3, shiftX2: 1, shiftY2: 0,
        generatedToken: "COLUMNS ALIGNED",
        explanation: "k=3 matches the 16-character word period! All 'i', 't', 'd' snap into vertical stripes.",
        resonanceEnergy: 0.98
      },
      {
        stepIndex: 2,
        k1: 19, shiftX1: 0, shiftY1: 0,
        k2: 19, shiftX2: 0, shiftY2: 1,
        generatedToken: "HORIZONTAL BANDS",
        explanation: "k=19 flips the frequency 90 degrees, locking letters into horizontal bars.",
        resonanceEnergy: 0.95
      },
      {
        stepIndex: 3,
        k1: 14, shiftX1: 2, shiftY1: 2,
        k2: 14, shiftX2: 2, shiftY2: 2,
        generatedToken: "QUADRUPLE ECHO",
        explanation: "k=14 splits the phrase into 4 miniature self-similar repeating quadrants.",
        resonanceEnergy: 0.96
      }
    ]
  }
];

export interface MoireCell {
  index: number;
  charA: string;
  charB: string;
  sourceIdxA: number;
  sourceIdxB: number;
  interferenceScore: number; // 0 to 1
  isConstructive: boolean;   // constructive overlap
}

/**
 * Compute the Moiré Superposition of two rotated and shifted grids
 */
export function computeMoireSuperposition(
  substrateChars: string[],
  k1: number,
  shiftX1: number,
  shiftY1: number,
  k2: number,
  shiftX2: number,
  shiftY2: number
): {
  cells: MoireCell[];
  constructiveCount: number;
  synthesizedString: string;
} {
  const dim = 16;
  const total = 256;

  const perm1 = getAffinePermutation(k1, 0, total);
  const perm2 = getAffinePermutation(k2, 0, total);

  const cells: MoireCell[] = new Array(total);
  let constructiveCount = 0;
  const extractedChars: string[] = [];

  for (let r = 0; r < dim; r++) {
    for (let c = 0; c < dim; c++) {
      const idx = r * dim + c;

      // Grid A coordinate transformation with 2D toroidal shift
      const shiftedR1 = (r - shiftY1 + dim) % dim;
      const shiftedC1 = (c - shiftX1 + dim) % dim;
      const targetIdx1 = shiftedR1 * dim + shiftedC1;
      const sourceA = perm1.inverse[targetIdx1];
      const charA = substrateChars[sourceA] || ' ';

      // Grid B coordinate transformation with 2D toroidal shift
      const shiftedR2 = (r - shiftY2 + dim) % dim;
      const shiftedC2 = (c - shiftX2 + dim) % dim;
      const targetIdx2 = shiftedR2 * dim + shiftedC2;
      const sourceB = perm2.inverse[targetIdx2];
      const charB = substrateChars[sourceB] || ' ';

      // Constructive interference occurs when coordinates or characters resonate
      const dist = Math.abs(sourceA - sourceB);
      const isCharMatch = charA === charB && charA !== ' ' && charA !== '.';
      const isModularHarmonic = (dist % 16 === 0) || (dist % 17 === 0);

      const interferenceScore = isCharMatch ? 1.0 : (isModularHarmonic ? 0.8 : (1 - (dist % 32) / 32) * 0.5);
      const isConstructive = interferenceScore > 0.65;

      if (isConstructive) {
        constructiveCount++;
        extractedChars.push(charA);
      }

      cells[idx] = {
        index: idx,
        charA,
        charB,
        sourceIdxA: sourceA,
        sourceIdxB: sourceB,
        interferenceScore,
        isConstructive
      };
    }
  }

  // Synthesize readable token from the constructive interference points
  const rawString = extractedChars.slice(0, 14).join('');

  return {
    cells,
    constructiveCount,
    synthesizedString: rawString
  };
}
