// Pointer lock with graceful fallback: if the browser or an embedding iframe refuses,
// the game keeps working with click-and-drag look.
import { useGame } from '../../stores/gameStore';

let expectingUnlock = false;
/** Time the pause menu was opened by losing pointer lock (Esc may also arrive as a keydown). */
export let lastAutoPause = 0;

export function requestLock(el: HTMLElement) {
  if (document.pointerLockElement === el) return;
  try {
    const result = el.requestPointerLock() as unknown as Promise<void> | undefined;
    result?.catch?.(() => {});
  } catch {
    /* unsupported: drag-to-look still works */
  }
}

export function releaseLock() {
  if (!document.pointerLockElement) return;
  expectingUnlock = true;
  document.exitPointerLock();
}

export function installPointerLockWatcher() {
  document.addEventListener('pointerlockchange', () => {
    const locked = !!document.pointerLockElement;
    const game = useGame.getState();
    game.setPointerLocked(locked);
    // The browser swallows Esc while locked; losing the lock unexpectedly = pause.
    if (!locked && !expectingUnlock && game.started && game.overlay === 'none' && game.transition.phase === 'idle') {
      game.openOverlay('pause');
      lastAutoPause = performance.now();
    }
    if (!locked) expectingUnlock = false;
  });
}
