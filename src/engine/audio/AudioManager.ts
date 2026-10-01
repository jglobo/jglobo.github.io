// All sound is synthesized with the Web Audio API, so every sound is original and
// nothing has to be downloaded. The context starts only after a user gesture, and
// ambience fades in quietly (no loud autoplay).
import type { WorldId } from '../../content';
import { useSettings } from '../../stores/settingsStore';

type Bus = 'music' | 'sfx' | 'ambience';
export type SfxName =
  | 'ui' | 'select' | 'fire' | 'portalOpen' | 'travel' | 'interact' | 'deny' | 'summon'
  | 'pickup' | 'putdown' | 'insert' | 'boot' | 'blip' | 'zap' | 'boom' | 'flap' | 'point' | 'click'
  | 'door' | 'trick' | 'thud';

class AudioManager {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private buses = {} as Record<Bus, GainNode>;
  private ambience: { stop: () => void } | null = null;
  private ambienceWorld: WorldId | null = null;
  private noise: AudioBuffer | null = null;
  private engine: { o: OscillatorNode; o2: OscillatorNode; gain: GainNode; filter: BiquadFilterNode } | null = null;
  private thrust: { gain: GainNode; filter: BiquadFilterNode } | null = null;

  /** Call from a click/keypress handler. Safe to call repeatedly. */
  unlock() {
    if (!this.ctx) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.connect(this.ctx.destination);
      for (const bus of ['music', 'sfx', 'ambience'] as Bus[]) {
        this.buses[bus] = this.ctx.createGain();
        this.buses[bus].connect(this.master);
      }
      this.applyVolumes();
      useSettings.subscribe(() => this.applyVolumes());
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }

  private applyVolumes() {
    if (!this.ctx) return;
    const a = useSettings.getState().audio;
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(a.muted ? 0 : a.master, t, 0.05);
    this.buses.music.gain.setTargetAtTime(a.music, t, 0.05);
    this.buses.sfx.gain.setTargetAtTime(a.sfx, t, 0.05);
    this.buses.ambience.gain.setTargetAtTime(a.ambience, t, 0.05);
  }

  private noiseBuffer() {
    if (!this.noise && this.ctx) {
      const len = this.ctx.sampleRate * 2;
      this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noise.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    }
    return this.noise!;
  }

  /** Crossfades to the ambience of a world. */
  setAmbience(world: WorldId | null) {
    if (!this.ctx || world === this.ambienceWorld) return;
    this.ambienceWorld = world;
    this.ambience?.stop();
    this.ambience = world ? this.buildAmbience(world) : null;
  }

  private buildAmbience(world: WorldId) {
    const ctx = this.ctx!;
    const out = ctx.createGain();
    out.gain.value = 0;
    out.gain.setTargetAtTime(0.35, ctx.currentTime, 1.2);
    out.connect(this.buses.ambience);
    const nodes: AudioScheduledSourceNode[] = [];

    const drone = (freq: number, type: OscillatorType, gain: number, cutoff: number) => {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.value = freq;
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = cutoff;
      const g = ctx.createGain();
      g.gain.value = gain;
      o.connect(f).connect(g).connect(out);
      o.start();
      nodes.push(o);
      return { o, f, g };
    };
    const lfo = (target: AudioParam, rate: number, depth: number) => {
      const l = ctx.createOscillator();
      l.frequency.value = rate;
      const g = ctx.createGain();
      g.gain.value = depth;
      l.connect(g).connect(target);
      l.start();
      nodes.push(l);
    };
    const noiseBed = (cutoff: number, gain: number) => {
      const n = ctx.createBufferSource();
      n.buffer = this.noiseBuffer();
      n.loop = true;
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = cutoff;
      const g = ctx.createGain();
      g.gain.value = gain;
      n.connect(f).connect(g).connect(out);
      n.start();
      nodes.push(n);
      return f;
    };

    if (world === 'hub') {
      // Machinery hum: two detuned saws, a 60 Hz-ish hum and slow filter movement.
      const a = drone(55, 'sawtooth', 0.12, 240);
      drone(55.4, 'sawtooth', 0.1, 240);
      drone(110, 'sine', 0.05, 800);
      lfo(a.f.frequency, 0.07, 120);
      noiseBed(500, 0.05);
    } else if (world === 'data-science') {
      // Quiet space: airy noise, a soft minor pad that breathes.
      const f = noiseBed(900, 0.05);
      lfo(f.frequency, 0.05, 400);
      for (const [freq, g] of [[146.8, 0.05], [174.6, 0.04], [220, 0.035], [293.7, 0.02]] as const) {
        const d = drone(freq, 'triangle', g, 1200);
        lfo(d.g.gain, 0.08 + freq / 5000, g * 0.6);
      }
    } else if (world === 'software') {
      // Energetic exploration loop: a pulsing bass line and a bright arpeggio.
      const bass = drone(55, 'sawtooth', 0, 420);
      const lead = drone(440, 'square', 0, 2400);
      const bassLine = [55, 55, 65.4, 73.4, 55, 55, 82.4, 73.4];
      const arp = [440, 554.4, 659.3, 880, 659.3, 554.4, 493.9, 587.3];
      let step = 0;
      const beat = 0.22;
      const tick = () => {
        const t = ctx.currentTime;
        bass.o.frequency.setValueAtTime(bassLine[step % 8], t);
        bass.g.gain.setValueAtTime(0.11, t);
        bass.g.gain.setTargetAtTime(0.03, t + 0.02, 0.08);
        lead.o.frequency.setValueAtTime(arp[(step * 3) % 8] * (step % 16 < 8 ? 1 : 1.122), t);
        lead.g.gain.setValueAtTime(0.022, t);
        lead.g.gain.setTargetAtTime(0, t + 0.01, 0.06);
        step++;
      };
      const id = setInterval(tick, beat * 1000);
      nodes.push({ stop: () => clearInterval(id) } as unknown as AudioScheduledSourceNode);
    } else if (world === 'games') {
      // Bedroom at night: soft room tone and a slow, warm lo-fi chord loop.
      noiseBed(380, 0.035);
      const chords = [[196, 246.9, 293.7], [174.6, 220, 261.6], [164.8, 207.7, 246.9], [174.6, 220, 277.2]];
      const voices = [0, 1, 2].map(() => drone(196, 'triangle', 0.028, 900));
      let step = 0;
      const tick = () => {
        const t = ctx.currentTime;
        chords[step % chords.length].forEach((f, i) => voices[i].o.frequency.setTargetAtTime(f, t, 0.25));
        step++;
      };
      tick();
      const id = setInterval(tick, 3200);
      nodes.push({ stop: () => clearInterval(id) } as unknown as AudioScheduledSourceNode);
      voices.forEach((v, i) => lfo(v.g.gain, 0.11 + i * 0.03, 0.012));
    } else {
      drone(98, 'triangle', 0.06, 900);
      drone(147, 'sine', 0.04, 900);
    }

    return {
      stop: () => {
        const t = ctx.currentTime;
        out.gain.cancelScheduledValues(t);
        out.gain.setTargetAtTime(0, t, 0.4);
        setTimeout(() => {
          nodes.forEach((n) => { try { n.stop(); } catch { /* already stopped */ } });
          out.disconnect();
        }, 2000);
      },
    };
  }

  private env(duration: number, peak = 1, bus: Bus = 'sfx') {
    const ctx = this.ctx!;
    const g = ctx.createGain();
    const t = ctx.currentTime;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    g.connect(this.buses[bus]);
    return { g, t };
  }

  private tone(type: OscillatorType, from: number, to: number, duration: number, peak: number) {
    if (!this.ctx) return;
    const { g, t } = this.env(duration, peak);
    const o = this.ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(from, t);
    o.frequency.exponentialRampToValueAtTime(to, t + duration);
    o.connect(g);
    o.start(t);
    o.stop(t + duration + 0.05);
  }

  private whoosh(duration: number, from: number, to: number, peak: number) {
    if (!this.ctx) return;
    const { g, t } = this.env(duration, peak);
    const n = this.ctx.createBufferSource();
    n.buffer = this.noiseBuffer();
    const f = this.ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.Q.value = 2;
    f.frequency.setValueAtTime(from, t);
    f.frequency.exponentialRampToValueAtTime(to, t + duration);
    n.connect(f).connect(g);
    n.start(t);
    n.stop(t + duration + 0.05);
  }

  play(name: SfxName) {
    if (!this.ctx) return;
    switch (name) {
      case 'ui': return this.tone('sine', 880, 1320, 0.08, 0.15);
      case 'select': return this.tone('triangle', 440, 660, 0.14, 0.25);
      case 'fire':
        this.tone('square', 220, 1760, 0.18, 0.12);
        return this.whoosh(0.25, 800, 4000, 0.3);
      case 'portalOpen':
        this.whoosh(1.2, 200, 1600, 0.35);
        [261.6, 329.6, 392, 523.3].forEach((f, i) => setTimeout(() => this.tone('sine', f, f * 1.01, 1.4, 0.08), i * 70));
        return;
      case 'travel':
        this.whoosh(1.4, 3000, 120, 0.5);
        return this.tone('sawtooth', 110, 40, 1.2, 0.1);
      case 'interact': return this.tone('sine', 660, 990, 0.18, 0.2);
      case 'deny': return this.tone('square', 180, 120, 0.2, 0.08);
      case 'summon':
        return this.whoosh(0.8, 300, 2200, 0.25);
      case 'pickup': return this.whoosh(0.18, 600, 1800, 0.18);
      case 'putdown': return this.tone('triangle', 260, 180, 0.12, 0.18);
      case 'insert':
        this.tone('square', 120, 90, 0.08, 0.12);
        return setTimeout(() => this.tone('square', 90, 70, 0.08, 0.14), 140);
      case 'boot':
        // Console power-on chime: a quick rising arpeggio.
        [392, 523.3, 659.3, 1046.5].forEach((f, i) => setTimeout(() => this.tone('square', f, f, i === 3 ? 0.6 : 0.12, 0.07), i * 110));
        return;
      case 'blip': return this.tone('square', 990, 990, 0.05, 0.06);
      case 'zap': return this.tone('square', 1400, 300, 0.12, 0.05);
      case 'boom': return this.whoosh(0.35, 900, 120, 0.3);
      case 'flap': return this.tone('triangle', 500, 900, 0.09, 0.1);
      case 'point': return this.tone('square', 1320, 1760, 0.12, 0.06);
      case 'click': return this.tone('square', 1800, 1200, 0.03, 0.05);
      case 'door': return this.tone('triangle', 220, 160, 0.15, 0.2);
      case 'trick':
        [523.3, 659.3, 784, 1046.5].forEach((f, i) => setTimeout(() => this.tone('square', f, f, 0.1, 0.06), i * 70));
        return;
      case 'thud': return this.whoosh(0.2, 400, 90, 0.25);
    }
  }

  /** Engine note for vehicles: level 0..1 (0 = silent), pitch rises with rpm 0..1. */
  setEngine(level: number, rpm: number, kind: 'car' | 'bike' = 'car') {
    if (!this.ctx) return;
    if (!this.engine) {
      const o = this.ctx.createOscillator();
      o.type = 'sawtooth';
      const o2 = this.ctx.createOscillator();
      o2.type = 'square';
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 500;
      const gain = this.ctx.createGain();
      gain.gain.value = 0;
      o.connect(filter);
      o2.connect(filter);
      filter.connect(gain).connect(this.buses.sfx);
      o.start();
      o2.start();
      this.engine = { o, o2, gain, filter };
    }
    const t = this.ctx.currentTime;
    const e = this.engine;
    const base = kind === 'car' ? 48 + rpm * 110 : 0;
    e.o.frequency.setTargetAtTime(Math.max(20, base), t, 0.05);
    e.o2.frequency.setTargetAtTime(Math.max(20, base * 0.5), t, 0.05);
    e.filter.frequency.setTargetAtTime(300 + rpm * 1400, t, 0.08);
    e.gain.gain.setTargetAtTime(kind === 'car' ? level * 0.06 : 0, t, 0.1);
  }

  /** Continuous jetpack hiss driven every frame (0..1). */
  setThrust(amount: number) {
    if (!this.ctx) return;
    if (!this.thrust) {
      const n = this.ctx.createBufferSource();
      n.buffer = this.noiseBuffer();
      n.loop = true;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.Q.value = 0.8;
      filter.frequency.value = 600;
      const gain = this.ctx.createGain();
      gain.gain.value = 0;
      n.connect(filter).connect(gain).connect(this.buses.sfx);
      n.start();
      this.thrust = { gain, filter };
    }
    const t = this.ctx.currentTime;
    this.thrust.gain.gain.setTargetAtTime(amount * 0.18, t, 0.08);
    this.thrust.filter.frequency.setTargetAtTime(500 + amount * 900, t, 0.1);
  }
}

export const audio = new AudioManager();
