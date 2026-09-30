import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import { installInput, clearInput } from './engine/input/input';
import { installPointerLockWatcher, lastAutoPause, releaseLock } from './engine/input/pointerLock';
import { useGame } from './stores/gameStore';
import { audio } from './engine/audio/AudioManager';
import './styles.css';

installInput();
installPointerLockWatcher();

// Global shortcuts: Esc (menu / close), Tab (Quick Portfolio), ` (debug overlay).
window.addEventListener('keydown', (e) => {
  const game = useGame.getState();
  if (e.code === 'Tab') {
    e.preventDefault();
    if (game.overlay === 'quick') game.closeOverlay();
    else {
      releaseLock();
      game.openOverlay('quick');
    }
    audio.play('ui');
  } else if (e.code === 'Escape') {
    if (performance.now() - lastAutoPause < 300) return;
    if (game.overlay !== 'none') {
      game.closeOverlay();
      clearInput();
    } else if (game.started) {
      releaseLock();
      game.openOverlay('pause');
    }
  } else if (e.code === 'Backquote' && game.started) {
    game.toggleDebug();
  }
});

document.documentElement.classList.add('js-app');
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
