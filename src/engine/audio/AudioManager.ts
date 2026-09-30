// All sound is synthesized with the Web Audio API, so every sound is original and
// nothing has to be downloaded. The context starts only after a user gesture, and
// ambience fades in quietly (no loud autoplay).
import type { WorldId } from '../../content';
import { useSettings } from '../../stores/settingsStore';

type Bus = 'music' | 'sfx' | 'ambience';

class AudioManager {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private buses = {} as Record<Bus, GainNode>;
  private ambience: { stop: () => void } | null = null;
  private ambienceWorld: WorldId | null = null;
  private noise: AudioBuffer | null = null;
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

  play(name: 'ui' | 'select' | 'fire' | 'portalOpen' | 'travel' | 'interact' | 'deny' | 'summon') {
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
    }
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
