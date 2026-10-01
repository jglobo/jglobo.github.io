import { create } from 'zustand';

/** On foot in the garage area, or riding one of the vehicles. */
interface SoftwareState {
  riding: string | null;
  set: (p: Partial<Omit<SoftwareState, 'set'>>) => void;
}

export const useSoftware = create<SoftwareState>((set) => ({
  riding: null,
  set: (p) => set(p),
}));

/** Live player position/heading for components that follow it (not React state). */
export const playerRuntime = { x: 0, z: 0, y: 0, heading: 0, speed: 0 };

/** Where each vehicle is parked (or was left). Updated when you get off. */
export const parked: Record<string, { x: number; z: number; heading: number }> = {
  'sports-car': { x: -5, z: -1, heading: Math.PI },
  bicycle: { x: 4, z: 0, heading: Math.PI },
};
