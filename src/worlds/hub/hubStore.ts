// Hub-only state: the two placed portals and the puzzle props. Solved puzzles are kept
// in the game's saved progress (completedInteractions 'puzzle-<world>').
import { create } from 'zustand';
import type { WorldId } from '../../content';
import { useGame } from '../../stores/gameStore';
import type { PortalColor, PortalFrame, Portals } from './chamber';

export interface PlacedPortal extends PortalFrame {
  id: number;
  /** Seconds since it landed; a portal can be used once it has opened. */
  age: number;
}
export const OPEN_SECONDS = 0.6;
export const portalReady = (p: PlacedPortal | null) => !!p && p.age >= OPEN_SECONDS * 0.6;

interface HubState {
  blue: PlacedPortal | null;
  orange: PlacedPortal | null;
  bridgeOn: boolean;
  /** Last colour fired (the gun glows in it). */
  lastFired: PortalColor;
  place: (color: PortalColor, frame: PortalFrame) => void;
  clear: () => void;
  set: (patch: Partial<HubState>) => void;
}

export const useHub = create<HubState>((set) => ({
  blue: null,
  orange: null,
  bridgeOn: false,
  lastFired: 'blue',
  place: (color, frame) => set({ [color]: { ...frame, id: performance.now(), age: 0 }, lastFired: color } as Partial<HubState>),
  clear: () => set({ blue: null, orange: null }),
  set: (patch) => set(patch),
}));

/** The portals that are open enough to pass through. */
export function readyPortals(): Portals {
  const { blue, orange } = useHub.getState();
  return { blue: portalReady(blue) ? blue : null, orange: portalReady(orange) ? orange : null };
}

export type PuzzleWorld = Exclude<WorldId, 'hub'>;
export const puzzleKey = (w: PuzzleWorld) => `puzzle-${w}`;
export const isSolved = (w: PuzzleWorld) => useGame.getState().completedInteractions.includes(puzzleKey(w));
export const useSolved = (w: PuzzleWorld) => useGame((s) => s.completedInteractions.includes(puzzleKey(w)));
