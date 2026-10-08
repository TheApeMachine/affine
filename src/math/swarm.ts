/**
 * Asynchronous Autonomous Swarm Explorer for Multiscale Transform Spaces
 * 
 * Implements:
 * - Autonomous "Values" inhabiting different transform scales/phases (k0, k1)
 * - Decoupled local clocks (no global synchronous clock)
 * - Gossip & affinity-mediated attraction: structural resonance increases affinity,
 *   concentrating computation around transform contexts exhibiting strong structure.
 */

export interface SwarmValue {
  id: string;
  label: string;
  k0: number; // Coarse scale phase [0, 255]
  k1: number; // Fine scale phase [0, 255]
  vx: number;
  vy: number;
  resonance: number; // S(k0, k1) in [0, 1]
  localClock: number; // Individual asynchronous tick counter
  tickRate: number;   // Asynchronous frequency multiplier
  affinityPeers: string[];
  history: [number, number][]; // recent coordinates for particle trails
  color: string;
}

export interface SwarmConfig {
  agentCount: number;
  affinityStrength: number;  // 0 to 1
  gossipRadius: number;      // distance in (k0, k1) space
  explorationNoise: number;  // random diffusion
  asynchronyJitter: number;  // clock phase variance
}

export interface SwarmState {
  values: SwarmValue[];
  globalBestResonance: number;
  globalBestK0: number;
  globalBestK1: number;
  totalGossipExchanges: number;
  clusterConcentration: number; // 0 (uniform spread) to 1 (tightly clustered)
  stepCount: number;
}

const VALUE_COLORS = [
  '#06b6d4', '#38bdf8', '#818cf8', '#a855f7',
  '#ec4899', '#f43f5e', '#f97316', '#eab308',
  '#10b981', '#14b8a6', '#6366f1', '#22d3ee'
];

/**
 * Toroidal distance in 256x256 phase space
 */
export function toroidalDist(x1: number, y1: number, x2: number, y2: number): { dx: number; dy: number; dist: number } {
  let dx = x2 - x1;
  let dy = y2 - y1;
  if (dx > 128) dx -= 256;
  if (dx < -128) dx += 256;
  if (dy > 128) dy -= 256;
  if (dy < -128) dy += 256;
  return { dx, dy, dist: Math.hypot(dx, dy) };
}

/**
 * Initialize swarm
 */
export function initSwarm(
  config: SwarmConfig,
  evalResonance: (k0: number, k1: number) => number
): SwarmState {
  const values: SwarmValue[] = [];
  let bestScore = -1, bestK0 = 0, bestK1 = 0;

  for (let i = 0; i < config.agentCount; i++) {
    const k0 = Math.floor(Math.random() * 256);
    const k1 = Math.floor(Math.random() * 256);
    const res = evalResonance(k0, k1);

    if (res > bestScore) {
      bestScore = res;
      bestK0 = k0;
      bestK1 = k1;
    }

    values.push({
      id: `val_${i.toString().padStart(2, '0')}`,
      label: `Value ${String.fromCharCode(65 + (i % 26))}${i >= 26 ? Math.floor(i / 26) : ''}`,
      k0,
      k1,
      vx: (Math.random() - 0.5) * 2,
      vy: (Math.random() - 0.5) * 2,
      resonance: res,
      localClock: Math.random() * 100,
      tickRate: 0.7 + Math.random() * 0.6, // distinct asynchronous clock frequency
      affinityPeers: [],
      history: [[k0, k1]],
      color: VALUE_COLORS[i % VALUE_COLORS.length]
    });
  }

  return {
    values,
    globalBestResonance: bestScore,
    globalBestK0: bestK0,
    globalBestK1: bestK1,
    totalGossipExchanges: 0,
    clusterConcentration: 0.1,
    stepCount: 0
  };
}

/**
 * Step swarm asynchronously:
 * Each Value updates according to its own local clock timer.
 * Values with high structural resonance emit gossip pull; others migrate towards
 * high-resonance regions while continuing asynchronous exploration.
 */
export function stepSwarm(
  state: SwarmState,
  config: SwarmConfig,
  evalResonance: (k0: number, k1: number) => number
): SwarmState {
  let bestScore = state.globalBestResonance;
  let bestK0 = state.globalBestK0;
  let bestK1 = state.globalBestK1;
  let gossipCount = state.totalGossipExchanges;

  const newValues = state.values.map(agent => {
    // 1. Advance asynchronous local clock with jitter
    const clockAdvance = agent.tickRate * (1 + (Math.random() - 0.5) * config.asynchronyJitter);
    const updatedClock = agent.localClock + clockAdvance;

    // Check if this agent's local cycle triggered
    // An agent acts when its fractional clock overflows
    let newK0 = agent.k0;
    let newK1 = agent.k1;
    let newVx = agent.vx * 0.85;
    let newVy = agent.vy * 0.85;
    const peers: string[] = [];

    // 2. Gossip with other Values
    let pullDx = 0;
    let pullDy = 0;
    let totalWeight = 0;

    for (const other of state.values) {
      if (other.id === agent.id) continue;
      const { dx, dy, dist } = toroidalDist(agent.k0, agent.k1, other.k0, other.k1);

      if (dist <= config.gossipRadius) {
        peers.push(other.id);
        gossipCount++;

        // Affinity weight: proportional to other agent's structural resonance
        // and inversely proportional to distance
        const resonanceBonus = Math.pow(other.resonance, 2.5);
        const weight = (resonanceBonus / (dist + 4)) * config.affinityStrength;

        pullDx += dx * weight;
        pullDy += dy * weight;
        totalWeight += weight;
      }
    }

    if (totalWeight > 0) {
      newVx += (pullDx / totalWeight) * 1.8;
      newVy += (pullDy / totalWeight) * 1.8;
    }

    // 3. Stochastic exploration (Lévy-like Brownian diffusion)
    const noise = config.explorationNoise * 2.5;
    newVx += (Math.random() - 0.5) * noise;
    newVy += (Math.random() - 0.5) * noise;

    // Clamp velocity
    const speed = Math.hypot(newVx, newVy);
    if (speed > 8) {
      newVx = (newVx / speed) * 8;
      newVy = (newVy / speed) * 8;
    }

    // Update position on toroidal manifold [0, 256)
    newK0 = Math.round((agent.k0 + newVx + 256) % 256);
    newK1 = Math.round((agent.k1 + newVy + 256) % 256);

    // Evaluate local structural resonance at new coordinates
    const resonance = evalResonance(newK0, newK1);

    if (resonance > bestScore) {
      bestScore = resonance;
      bestK0 = newK0;
      bestK1 = newK1;
    }

    // Trail history
    const history = [...agent.history.slice(-8), [newK0, newK1] as [number, number]];

    return {
      ...agent,
      k0: newK0,
      k1: newK1,
      vx: newVx,
      vy: newVy,
      resonance,
      localClock: updatedClock,
      affinityPeers: peers,
      history,
    };
  });

  // Calculate cluster concentration (mean pairwise distance normalized)
  let sumDist = 0;
  let count = 0;
  for (let i = 0; i < newValues.length; i++) {
    for (let j = i + 1; j < newValues.length; j++) {
      const { dist } = toroidalDist(newValues[i].k0, newValues[i].k1, newValues[j].k0, newValues[j].k1);
      sumDist += dist;
      count++;
    }
  }
  const avgDist = count > 0 ? sumDist / count : 128;
  // Maximum possible avg distance on 256x256 torus is ~90. If avgDist is small -> high concentration
  const clusterConcentration = Math.max(0, Math.min(1, 1 - (avgDist / 90)));

  return {
    values: newValues,
    globalBestResonance: bestScore,
    globalBestK0: bestK0,
    globalBestK1: bestK1,
    totalGossipExchanges: gossipCount,
    clusterConcentration,
    stepCount: state.stepCount + 1
  };
}
