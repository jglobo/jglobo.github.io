// Quick Portfolio → a project's 3D world. Starts the game first when the visitor came
// straight from the title screen.
import type { WorldId } from '../content';
import { travelTo } from '../engine/loading/travel';
import { preloadWorld } from '../engine/loading/worlds';
import { useGame } from '../stores/gameStore';

export function visitWorld(world: WorldId) {
  const game = useGame.getState();
  game.closeOverlay();
  if (game.currentWorld === world && game.started) return;
  if (!game.started) {
    void import('../app/GameShell');
    void preloadWorld(world);
    game.start();
  }
  void travelTo(world);
}
