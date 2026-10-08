/**
 * Harmonic Orbit & Swarm Audio Sonification
 * Uses Web Audio API to translate affine rotations and swarm gossip
 * into pure harmonic overtones and celestial chimes.
 */

class OrbitSonifier {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private baseOsc: OscillatorNode | null = null;
  private harmOsc: OscillatorNode | null = null;
  private isEnabled: boolean = false;

  public init() {
    if (this.ctx) return;
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(0.08, this.ctx.currentTime); // gentle, pleasant volume
      this.masterGain.connect(this.ctx.destination);
    } catch {
      // Audio not supported in environment
    }
  }

  public setEnabled(enable: boolean) {
    this.isEnabled = enable;
    if (enable && this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    if (!enable && this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.05);
    } else if (enable && this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(0.08, this.ctx.currentTime, 0.05);
    }
  }

  public getIsEnabled(): boolean {
    return this.isEnabled;
  }

  /**
   * Play continuous harmonic drone corresponding to affine rotation k and resonance S(k)
   */
  public updateDrone(k: number, resonance: number) {
    if (!this.isEnabled || !this.ctx || !this.masterGain) return;

    // Harmonic pentatonic frequencies based on affine rotation
    const baseFreq = 160 + (k % 32) * 12; // 160Hz to ~540Hz
    const harmonicRatio = resonance > 0.7 ? 1.5 : (resonance > 0.4 ? 1.25 : 1.414); // Pure fifth, major third, or tritone
    const harmFreq = baseFreq * harmonicRatio;

    const now = this.ctx.currentTime;

    if (!this.baseOsc) {
      this.baseOsc = this.ctx.createOscillator();
      this.baseOsc.type = 'sine';
      this.baseOsc.frequency.setValueAtTime(baseFreq, now);

      const oscGain = this.ctx.createGain();
      oscGain.gain.setValueAtTime(0.05, now);
      this.baseOsc.connect(oscGain);
      oscGain.connect(this.masterGain);
      this.baseOsc.start();
    } else {
      this.baseOsc.frequency.setTargetAtTime(baseFreq, now, 0.08);
    }

    if (!this.harmOsc) {
      this.harmOsc = this.ctx.createOscillator();
      this.harmOsc.type = 'triangle';
      this.harmOsc.frequency.setValueAtTime(harmFreq, now);

      const harmGain = this.ctx.createGain();
      harmGain.gain.setValueAtTime(0.04 * resonance, now);
      this.harmOsc.connect(harmGain);
      harmGain.connect(this.masterGain);
      this.harmOsc.start();
    } else {
      this.harmOsc.frequency.setTargetAtTime(harmFreq, now, 0.08);
    }
  }

  /**
   * Play a bell chime when two swarm values exchange high-affinity gossip
   */
  public playGossipChime(resonance: number) {
    if (!this.isEnabled || !this.ctx || !this.masterGain) return;

    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      // Pentatonic pitch selection
      const pitches = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5]; // C5, D5, E5, G5, A5, C6
      const pitch = pitches[Math.floor(Math.random() * pitches.length)];

      osc.type = 'sine';
      osc.frequency.setValueAtTime(pitch, now);

      gain.gain.setValueAtTime(0.03 * Math.min(1, resonance * 1.5), now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);

      osc.connect(gain);
      gain.connect(this.masterGain);

      osc.start(now);
      osc.stop(now + 0.4);
    } catch {
      // Audio interruption safe fallback
    }
  }

  /**
   * Play crystallization chord when swarm locks into peak
   */
  public playCrystallizationChord() {
    if (!this.isEnabled || !this.ctx || !this.masterGain) return;

    try {
      const now = this.ctx.currentTime;
      const chord = [261.63, 329.63, 392.00, 523.25, 659.25]; // C major triad spread

      chord.forEach((freq, idx) => {
        if (!this.ctx || !this.masterGain) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + idx * 0.05);

        gain.gain.setValueAtTime(0.04, now + idx * 0.05);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.2);

        osc.connect(gain);
        gain.connect(this.masterGain);

        osc.start(now + idx * 0.05);
        osc.stop(now + 1.3);
      });
    } catch {
      // Safe fallback
    }
  }
}

export const sonifier = new OrbitSonifier();
