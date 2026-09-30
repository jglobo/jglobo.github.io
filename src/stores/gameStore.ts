import { create } from 'zustand';
import type { WorldId } from '../content';
import { load, save } from './persist';

export type Overlay = 'none' | 'pause' | 'quick' | 'inspector' | 'settings' | 'map';
export type QuickSection = 'about' | 'data-science' | 'games' | 'software' | 'experience' | 'resume' | 'contact';
export type Vec3 = [number, number, number];

export interface PortalState {
  id: number;
  position: Vec3;
  normal: Vec3;
  destination: WorldId;
  /** 'opening' while the projectile is in flight and the portal grows. */
  state: 'projectile' | 'opening' | 'open';
  from: Vec3;
}

export interface TransitionState {
  phase: 'idle' | 'out' | 'loading' | 'in';
  to: WorldId | null;
}

interface Progress {
  visitedWorlds: WorldId[];
  discoveredProjects: string[];
  completedInteractions: string[];
  tutorialSeen: boolean;
}

const PROGRESS_KEY = 'portal-hub:progress:v1';
const initialProgress: Progress = { visitedWorlds: [], discoveredProjects: [], completedInteractions: [], tutorialSeen: false };

export interface GameState extends Progress {
  started: boolean;
  currentWorld: WorldId;
  previousWorld: WorldId | null;
  portalDestination: WorldId;
  portal: PortalState | null;
  transition: TransitionState;
  selectedProject: string | null;
  overlay: Overlay;
  quickSection: QuickSection;
  prompt: string | null;
  hint: string | null;
  /** One-off message shown at the top of the Quick Portfolio. */
  notice: string | null;
  pointerLocked: boolean;
  debug: boolean;
  // Reserved for later worlds.
  vehicleSelection: string | null;
  currentVehicle: string | null;
  dialogueProgress: Record<string, number>;

  start: () => void;
  selectDestination: (id: WorldId) => void;
  setPortal: (portal: PortalState | null) => void;
  setTransition: (t: TransitionState) => void;
  setWorld: (id: WorldId) => void;
  openProject: (id: string) => void;
  openOverlay: (overlay: Overlay, section?: QuickSection) => void;
  closeOverlay: () => void;
  setPrompt: (prompt: string | null) => void;
  setHint: (hint: string | null) => void;
  setPointerLocked: (locked: boolean) => void;
  completeInteraction: (id: string) => void;
  toggleDebug: () => void;
  resetProgress: () => void;
}

const addUnique = <T,>(list: T[], item: T) => (list.includes(item) ? list : [...list, item]);

export const useGame = create<GameState>((set) => ({
  ...load(PROGRESS_KEY, initialProgress),
  started: false,
  currentWorld: 'hub',
  previousWorld: null,
  portalDestination: 'data-science',
  portal: null,
  transition: { phase: 'idle', to: null },
  selectedProject: null,
  overlay: 'none',
  quickSection: 'about',
  prompt: null,
  hint: null,
  notice: null,
  pointerLocked: false,
  debug: import.meta.env.DEV || new URLSearchParams(location.search).has('debug'),
  vehicleSelection: null,
  currentVehicle: null,
  dialogueProgress: {},

  start: () => set((s) => ({ started: true, visitedWorlds: addUnique(s.visitedWorlds, 'hub') })),
  selectDestination: (id) => set({ portalDestination: id }),
  setPortal: (portal) => set({ portal }),
  setTransition: (transition) => set({ transition }),
  setWorld: (id) =>
    set((s) => ({
      previousWorld: s.currentWorld,
      currentWorld: id,
      portal: null,
      prompt: null,
      visitedWorlds: addUnique(s.visitedWorlds, id),
    })),
  openProject: (id) =>
    set((s) => ({
      selectedProject: id,
      overlay: 'inspector',
      discoveredProjects: addUnique(s.discoveredProjects, id),
    })),
  openOverlay: (overlay, section) => set((s) => ({ overlay, quickSection: section ?? s.quickSection })),
  closeOverlay: () => set({ overlay: 'none', notice: null }),
  setPrompt: (prompt) => set((s) => (s.prompt === prompt ? s : { prompt })),
  setHint: (hint) => set((s) => (s.hint === hint ? s : { hint })),
  setPointerLocked: (pointerLocked) => set({ pointerLocked }),
  completeInteraction: (id) =>
    set((s) => ({
      completedInteractions: addUnique(s.completedInteractions, id),
      tutorialSeen: s.tutorialSeen || id === 'tutorial',
    })),
  toggleDebug: () => set((s) => ({ debug: !s.debug })),
  resetProgress: () => set({ ...initialProgress, visitedWorlds: ['hub'] }),
}));

useGame.subscribe((s) => {
  save(PROGRESS_KEY, {
    visitedWorlds: s.visitedWorlds,
    discoveredProjects: s.discoveredProjects,
    completedInteractions: s.completedInteractions,
    tutorialSeen: s.tutorialSeen,
  } satisfies Progress);
});

/** Gameplay input is ignored while a menu or panel is open, or during a transition. */
export const gameplayBlocked = () => {
  const s = useGame.getState();
  return s.overlay !== 'none' || s.transition.phase !== 'idle';
};
