// Plays one clip at a time on a model, after Jose's cycling controller: switching
// between pedalling clips keeps the pedal phase, other switches can cross-fade, and
// a rider can follow the bike's clip frame for frame.
import { AnimationMixer, type AnimationAction, type AnimationClip, type Object3D } from 'three';
import type { ClipChoice } from './animationStates';

const KEEP_PHASE = new Set(['Cycle', 'CycleFast', 'Walk', 'Run']);

export class ClipSet {
  readonly mixer: AnimationMixer;
  readonly actions: Record<string, AnimationAction> = {};
  current: string | null = null;

  constructor(root: Object3D, clips: AnimationClip[], required: string[]) {
    this.mixer = new AnimationMixer(root);
    for (const clip of clips) this.actions[clip.name] = this.mixer.clipAction(clip);
    for (const name of required) if (!this.actions[name]) throw new Error(`The model is missing its ${name} clip.`);
  }

  get action() {
    return this.current ? this.actions[this.current] : null;
  }

  play(name: string, fade = 0) {
    const next = this.actions[name];
    if (!next) throw new Error(`Unknown clip ${name}`);
    if (name === this.current) return next;
    const prev = this.action;
    const keep = prev && KEEP_PHASE.has(this.current!) && KEEP_PHASE.has(name);
    const phase = keep ? (prev.time / prev.getClip().duration) % 1 : 0;
    next.reset().setEffectiveWeight(1).setEffectiveTimeScale(1).play();
    next.time = phase * next.getClip().duration;
    if (prev) {
      if (fade > 0) next.crossFadeFrom(prev, fade, false);
      else prev.stop();
    }
    this.current = name;
    return next;
  }

  /** Play a chosen clip at its rate. */
  set(choice: ClipChoice, fade = 0) {
    this.play(choice.name, fade).setEffectiveTimeScale(choice.timeScale);
  }

  /** Show exactly the frame another set is on (a rider on the bike). */
  follow(other: ClipSet) {
    const src = other.action;
    if (!src || !other.current) return;
    const a = this.play(other.current);
    a.setEffectiveTimeScale(0);
    a.time = src.time;
  }

  update(dt: number) {
    this.mixer.update(Math.max(0, dt));
  }

  dispose() {
    this.mixer.stopAllAction();
    this.mixer.uncacheRoot(this.mixer.getRoot());
  }
}
