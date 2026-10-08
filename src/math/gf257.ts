/**
 * Finite Field GF(257) Arithmetic & Affine Orbit Transformations
 * 257 is the Fermat prime 2^(2^3) + 1 = 256 + 1.
 * The multiplicative group (Z/257Z)* is cyclic of order 256 with generator g = 3.
 */

export const P = 257;
export const G = 3; // Primitive root generator modulo 257

/** Modular addition in GF(257) */
export function gfAdd(x: number, y: number): number {
  const sum = (x + y) % P;
  return sum < 0 ? sum + P : sum;
}

/** Modular subtraction in GF(257) */
export function gfSub(x: number, y: number): number {
  const diff = (x - y) % P;
  return diff < 0 ? diff + P : diff;
}

/** Modular multiplication in GF(257) */
export function gfMul(x: number, y: number): number {
  return ((x % P) * (y % P)) % P;
}

/** Modular exponentiation x^e mod 257 */
export function gfPow(x: number, e: number): number {
  let base = (x % P + P) % P;
  let exp = e;
  if (exp < 0) {
    base = gfInv(base);
    exp = -exp;
  }
  let res = 1;
  while (exp > 0) {
    if (exp & 1) res = (res * base) % P;
    base = (base * base) % P;
    exp >>= 1;
  }
  return res;
}

/** Modular inverse via Extended Euclidean Algorithm */
export function gfInv(n: number): number {
  let a = (n % P + P) % P;
  if (a === 0) throw new Error("Division by zero in GF(257)");
  let m = P;
  let y0 = 0, y1 = 1;
  while (a > 1) {
    const q = Math.floor(a / m);
    let t = m;
    m = a % m;
    a = t;
    t = y0;
    y0 = y1 - q * y0;
    y1 = t;
  }
  return y1 < 0 ? y1 + P : y1;
}

/** Table of generator powers g^k mod 257 for k in 0..255 */
export const GENERATOR_POWERS: number[] = (() => {
  const table = new Array(256);
  let val = 1;
  for (let k = 0; k < 256; k++) {
    table[k] = val;
    val = (val * G) % P;
  }
  return table;
})();

/** Inverse lookups: for unit a in 1..256, find k such that g^k = a */
export const DISCRETE_LOG: number[] = (() => {
  const table = new Array(257).fill(-1);
  for (let k = 0; k < 256; k++) {
    table[GENERATOR_POWERS[k]] = k;
  }
  return table;
})();

/**
 * Affine transformation permutation on indices 0..255 (256-cell raster):
 * Uses unit a = g^k mod 257 (for k in 0..255) and shift b in 0..255.
 * Maps 1..256 bijectively onto 1..256:
 * x' = ((a * (x + 1) + b - 1) mod 256) (guaranteed bijection)
 * Or pure GF(257) non-zero mapping:
 * pi(x) = (a * (x + 1) mod 257) - 1. Since 257 is prime and a in 1..256,
 * this is a strict bijection on {0, ..., 255}!
 */
export function getAffinePermutation(k: number, b: number = 0, size: number = 256): {
  forward: number[];
  inverse: number[];
  a: number;
} {
  const normK = ((k % 256) + 256) % 256;
  const a = GENERATOR_POWERS[normK];
  const aInv = gfInv(a);

  const forward = new Array(size);
  const inverse = new Array(size);

  if (size === 256) {
    for (let x = 0; x < 256; x++) {
      // Pure GF(257) orbit mapping on {1..256}
      // x in 0..255 -> val in 1..256
      const val = x + 1;
      const mappedVal = (a * val) % P; // 1..256
      let target = mappedVal - 1;
      if (b !== 0) {
        target = (target + b) % 256;
      }
      forward[x] = target;
      inverse[target] = x;
    }
  } else {
    // For arbitrary size (e.g. 128, 64, 32, 16):
    // If size is a power of 2, ensure multiplier is odd so gcd(aMod, size) == 1
    let aMod = a % size;
    if (aMod % 2 === 0) aMod = (aMod + 1) % size;
    if (aMod === 0) aMod = 1;

    for (let x = 0; x < size; x++) {
      const target = ((aMod * x + b) % size + size) % size;
      forward[x] = target;
      inverse[target] = x;
    }
  }

  return { forward, inverse, a };
}

/**
 * Apply affine orbit transform to an array of samples:
 * Permutes sample positions by forward mapping.
 */
export function applyAffineTransform(samples: number[], k: number, b: number = 0): number[] {
  const n = samples.length;
  const { forward } = getAffinePermutation(k, b, n);
  const transformed = new Array(n);
  for (let i = 0; i < n; i++) {
    transformed[forward[i]] = samples[i];
  }
  return transformed;
}

/**
 * Invert affine orbit transform:
 */
export function invertAffineTransform(transformed: number[], k: number, b: number = 0): number[] {
  const n = transformed.length;
  const { inverse } = getAffinePermutation(k, b, n);
  const original = new Array(n);
  for (let i = 0; i < n; i++) {
    original[inverse[i]] = transformed[i];
  }
  return original;
}

/**
 * Test signals of length 256 (16x16 grid):
 */
export interface SignalSource {
  id: string;
  name: string;
  category: 'geometric' | 'language' | 'harmonic' | 'noise';
  description: string;
  data: number[];
  width: number;
  height: number;
}

export function generateTestSignals(): SignalSource[] {
  const size = 256;
  const dim = 16;

  // 1. Circle / Disk (Geometric primitive)
  const circleData = new Array(size);
  const cx = 7.5, cy = 7.5, r = 5.2;
  for (let y = 0; y < dim; y++) {
    for (let x = 0; x < dim; x++) {
      const d = Math.hypot(x - cx, y - cy);
      // Normalized intensity 0..255
      const val = d <= r ? 240 : (d <= r + 1.2 ? 110 : 20);
      circleData[y * dim + x] = Math.round(val);
    }
  }

  // 2. Concentric Rings (Rich structural symmetry)
  const ringsData = new Array(size);
  for (let y = 0; y < dim; y++) {
    for (let x = 0; x < dim; x++) {
      const d = Math.hypot(x - cx, y - cy);
      const ring = Math.sin(d * 1.8) * 0.5 + 0.5;
      ringsData[y * dim + x] = Math.round(ring * 255);
    }
  }

  // 3. Natural Language ASCII Quote (Repeated/Structured Text)
  // "AFFINE ORBITS PRESERVE REDUNDANCY ACROSS SCALE AND PHASE GF(257) SWARM STRUCTURE..."
  const rawText = "AFFINE ORBITS PRESERVE REDUNDANCY ACROSS SCALE AND PHASE GF(257) SWARM STRUCTURE RECURSION HOLOGRAPHIC COMPLETION EXPERIMENT COMPRESSIBLE STATE";
  const textData = new Array(size);
  for (let i = 0; i < size; i++) {
    const charCode = rawText.charCodeAt(i % rawText.length);
    textData[i] = charCode;
  }

  // 4. Harmonic Dual Waveform (Periodic spectral structure)
  const harmonicData = new Array(size);
  for (let i = 0; i < size; i++) {
    const t = (i / size) * Math.PI * 8;
    const wave = Math.sin(t) * 0.6 + Math.cos(t * 3) * 0.4;
    harmonicData[i] = Math.round(((wave + 1) / 2) * 255);
  }

  // 5. Star Polygon / Diamond
  const starData = new Array(size);
  for (let y = 0; y < dim; y++) {
    for (let x = 0; x < dim; x++) {
      const manhattan = Math.abs(x - cx) + Math.abs(y - cy);
      const val = manhattan <= 6 ? 245 : 15;
      starData[y * dim + x] = val;
    }
  }

  // 6. Uniform Random Noise (Control sample - high entropy, fragile structure)
  // Seeded deterministic pseudo-random
  const noiseData = new Array(size);
  let seed = 1337;
  for (let i = 0; i < size; i++) {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    noiseData[i] = Math.floor((seed / 4294967296) * 256);
  }

  return [
    {
      id: 'circle',
      name: 'Geometric Circle Disk',
      category: 'geometric',
      description: 'Extremely high redundancy; description is center + radius. Should compress aggressively at favorable affine alignments.',
      data: circleData,
      width: dim,
      height: dim,
    },
    {
      id: 'rings',
      name: 'Concentric Wave Rings',
      category: 'geometric',
      description: 'Radial harmonic rings with rotational and mirror invariants.',
      data: ringsData,
      width: dim,
      height: dim,
    },
    {
      id: 'natural_text',
      name: 'Natural Language ASCII',
      category: 'language',
      description: 'Natural language phrase; high lexical & n-gram redundancy across English byte patterns.',
      data: textData,
      width: dim,
      height: dim,
    },
    {
      id: 'harmonic',
      name: 'Dual Harmonic Sinusoid',
      category: 'harmonic',
      description: 'Superposition of discrete Fourier modes. Sparse in frequency domain.',
      data: harmonicData,
      width: dim,
      height: dim,
    },
    {
      id: 'star',
      name: 'Diamond Cross Lattice',
      category: 'geometric',
      description: 'Manhattan distance contour; sparse corner structure.',
      data: starData,
      width: dim,
      height: dim,
    },
    {
      id: 'noise',
      name: 'Uniform Random Noise',
      category: 'noise',
      description: 'Control baseline. Independent identically distributed cells; should collapse quickly under decimation (ρ ≈ 1.0).',
      data: noiseData,
      width: dim,
      height: dim,
    }
  ];
}
