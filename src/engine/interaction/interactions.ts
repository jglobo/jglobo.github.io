// Interaction registry. Worlds register interactables; the active player controller
// calls updateInteractions() each frame with the player position. The nearest
// interactable in range becomes the HUD prompt, and the interact key triggers it.
import { useEffect } from 'react';
import type { Vector3 } from 'three';
import { useGame } from '../../stores/gameStore';
import { wasPressed } from '../input/input';
import { audio } from '../audio/AudioManager';

export interface Interactable {
  id: string;
  label: string;
  /** World-space position, read every frame (may move). */
  position: () => Vector3;
  radius: number;
  onInteract: () => void;
}

const registry = new Map<string, Interactable>();
let active: Interactable | null = null;

export function useInteractable(item: Interactable | null) {
  useEffect(() => {
    if (!item) return;
    registry.set(item.id, item);
    return () => {
      registry.delete(item.id);
      if (active?.id === item.id) {
        active = null;
        useGame.getState().setPrompt(null);
      }
    };
  }, [item]);
}

export function updateInteractions(player: Vector3, enabled = true) {
  let best: Interactable | null = null;
  let bestD = Infinity;
  if (enabled) {
    for (const item of registry.values()) {
      const d = item.position().distanceTo(player);
      if (d < item.radius && d < bestD) {
        best = item;
        bestD = d;
      }
    }
  }
  active = best;
  useGame.getState().setPrompt(best ? best.label : null);
  if (best && wasPressed('interact')) {
    audio.play('interact');
    best.onInteract();
  }
}

export const activeInteractable = () => active?.id ?? null;
export const interactableCount = () => registry.size;
