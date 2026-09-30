// Theatrical world transition: fade/tunnel out, make sure the chunk is loaded,
// swap worlds, then reveal. The overlay reads transition.phase to animate.
import type { WorldId } from '../../content';
import { useGame } from '../../stores/gameStore';
import { useSettings } from '../../stores/settingsStore';
import { audio } from '../audio/AudioManager';
import { clearInput } from '../input/input';
import { releaseLock } from '../input/pointerLock';
import { destination } from '../portals/destinations';
import { preloadWorld } from './worlds';
import { track } from '../../analytics/track';

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function travelTo(to: WorldId) {
  const game = useGame.getState();
  if (game.transition.phase !== 'idle') return;

  // Worlds that are not built yet open their Quick Portfolio section instead.
  const dest = destination(to);
  if (dest?.status === 'coming-soon') {
    releaseLock();
    game.setPortal(null);
    game.openOverlay('quick', to === 'journey' ? 'experience' : (to as 'games' | 'software'));
    useGame.setState({ notice: `The ${dest.world} is still being built. Here is that part of the portfolio in the meantime.` });
    return;
  }

  const reduced = useSettings.getState().reducedMotion;
  audio.play('travel');
  game.setTransition({ phase: 'out', to });
  const loading = preloadWorld(to);
  await wait(reduced ? 250 : 900);
  game.setTransition({ phase: 'loading', to });
  try {
    await loading;
  } catch {
    game.setTransition({ phase: 'idle', to: null });
    game.setHint('That world failed to load. The Quick Portfolio (Tab) has everything in it.');
    return;
  }
  clearInput();
  useGame.getState().setWorld(to);
  track('world_entered', { world: to });
  await wait(reduced ? 150 : 350);
  useGame.getState().setTransition({ phase: 'in', to });
  await wait(reduced ? 250 : 1000);
  useGame.getState().setTransition({ phase: 'idle', to: null });
}
