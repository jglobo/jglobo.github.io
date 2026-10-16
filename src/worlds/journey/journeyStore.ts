import { create } from 'zustand';

/** Which NPC the visitor is talking to and which memory is open. */
export const useJourney = create<{ talking: string | null; stop: string | null; asked: string[] }>(() => ({
  talking: null,
  stop: null,
  asked: [],
}));

/** Per-frame player data shared by the camera, NPCs and HUD (not React state). */
export const journeyRuntime = {
  x: 0,
  z: 0,
  moving: false,
  running: false,
  /** Point the camera eases toward when the visitor is at a building door. */
  focus: null as { x: number; z: number } | null,
  /** Seconds since the world started (camera intro). */
  time: 0,
};
