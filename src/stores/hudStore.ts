import { create } from 'zustand';

export interface NavMarker {
  id: string;
  label: string;
  symbol: string;
  /** Screen position in 0..1 (clamped to the edge when off-screen). */
  x: number;
  y: number;
  angle: number;
  distance: number;
  onScreen: boolean;
  discovered: boolean;
  /** Published project page, if any. */
  url?: string;
  projectTitle?: string;
}

/** Low-frequency HUD data written by worlds (navigation markers, hold-to-return charge). */
export const useHud = create<{ markers: NavMarker[]; returnCharge: number; controls: string[] }>(() => ({
  markers: [],
  returnCharge: 0,
  controls: [],
}));
