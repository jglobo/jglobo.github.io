import { create } from 'zustand';

/**
 * walk: free first-person movement
 * inspect: holding a game box in front of the camera
 * inserting: the box is flying to the console (short animation)
 * crt: sitting in front of the TV, the screen takes the keyboard
 */
export type RoomMode = 'walk' | 'inspect' | 'inserting' | 'crt';

interface RoomState {
  mode: RoomMode;
  heldId: string | null;
  insertedId: string | null;
  lampOn: boolean;
  cheat: boolean;
  set: (p: Partial<Omit<RoomState, 'set'>>) => void;
}

export const useRoom = create<RoomState>((set) => ({
  mode: 'walk',
  heldId: null,
  insertedId: null,
  lampOn: true,
  cheat: false,
  set: (p) => set(p),
}));

const SCORES_KEY = 'portal-hub:crt-scores:v1';

export function loadBest(game: string): number {
  try {
    return Number(JSON.parse(localStorage.getItem(SCORES_KEY) ?? '{}')[game]) || 0;
  } catch {
    return 0;
  }
}

export function saveBest(game: string, score: number) {
  try {
    const all = JSON.parse(localStorage.getItem(SCORES_KEY) ?? '{}');
    all[game] = score;
    localStorage.setItem(SCORES_KEY, JSON.stringify(all));
  } catch {
    /* storage unavailable: scores just are not kept */
  }
}

/** Per-frame values shared by the room's components (not React state). */
export const roomRuntime = {
  /** Rotation of the box being inspected, driven by mouse drag / arrow keys. */
  inspectYaw: 0,
  inspectPitch: 0,
  /** 0..1 progress of the box flying into the console. */
  insertT: 0,
};
