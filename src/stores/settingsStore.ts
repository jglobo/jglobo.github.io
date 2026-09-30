import { create } from 'zustand';
import { load, save } from './persist';

export type Quality = 'low' | 'medium' | 'high' | 'ultra';

export interface QualityProfile {
  maxDpr: number;
  shadows: boolean;
  stars: number;
  asteroids: number;
  particles: number;
  earthSegments: number;
}

export const QUALITY_PROFILES: Record<Quality, QualityProfile> = {
  low: { maxDpr: 1, shadows: false, stars: 1500, asteroids: 60, particles: 40, earthSegments: 48 },
  medium: { maxDpr: 1.5, shadows: false, stars: 4000, asteroids: 140, particles: 90, earthSegments: 72 },
  high: { maxDpr: 2, shadows: true, stars: 8000, asteroids: 260, particles: 160, earthSegments: 96 },
  ultra: { maxDpr: 2.5, shadows: true, stars: 14000, asteroids: 420, particles: 260, earthSegments: 128 },
};

export type Action =
  | 'forward' | 'back' | 'left' | 'right' | 'sprint' | 'interact' | 'returnPortal'
  | 'dest1' | 'dest2' | 'dest3' | 'dest4';

export const DEFAULT_BINDINGS: Record<Action, string[]> = {
  forward: ['KeyW', 'ArrowUp'],
  back: ['KeyS', 'ArrowDown'],
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
  sprint: ['ShiftLeft', 'ShiftRight'],
  interact: ['KeyE', 'Enter'],
  returnPortal: ['KeyR'],
  dest1: ['Digit1'],
  dest2: ['Digit2'],
  dest3: ['Digit3'],
  dest4: ['Digit4'],
};

export interface Settings {
  quality: Quality;
  qualityChosen: boolean;
  audio: { master: number; music: number; sfx: number; ambience: number; muted: boolean };
  mouseSensitivity: number;
  invertY: boolean;
  reducedMotion: boolean;
  reducedParticles: boolean;
  highContrast: boolean;
  subtitles: boolean;
  bindings: Record<Action, string[]>;
}

const KEY = 'portal-hub:settings:v1';

const prefersReducedMotion =
  typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

const defaults: Settings = {
  quality: 'medium',
  qualityChosen: false,
  audio: { master: 0.6, music: 0.5, sfx: 0.7, ambience: 0.5, muted: false },
  mouseSensitivity: 1,
  invertY: false,
  reducedMotion: prefersReducedMotion,
  reducedParticles: false,
  highContrast: false,
  subtitles: true,
  bindings: DEFAULT_BINDINGS,
};

interface SettingsStore extends Settings {
  set: (patch: Partial<Settings>) => void;
  setAudio: (patch: Partial<Settings['audio']>) => void;
  rebind: (action: Action, code: string) => void;
  resetBindings: () => void;
}

export const useSettings = create<SettingsStore>((set) => ({
  ...load(KEY, defaults),
  set: (patch) => set(patch),
  setAudio: (patch) => set((s) => ({ audio: { ...s.audio, ...patch } })),
  rebind: (action, code) => set((s) => ({ bindings: { ...s.bindings, [action]: [code] } })),
  resetBindings: () => set({ bindings: DEFAULT_BINDINGS }),
}));

useSettings.subscribe((s) => {
  const { set: _a, setAudio: _b, rebind: _c, resetBindings: _d, ...data } = s;
  save(KEY, data);
});

export const qualityProfile = () => {
  const s = useSettings.getState();
  const p = QUALITY_PROFILES[s.quality];
  return s.reducedParticles ? { ...p, particles: Math.round(p.particles / 3), stars: Math.round(p.stars / 2) } : p;
};
