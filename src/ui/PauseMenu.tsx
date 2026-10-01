import { useEffect, useRef, useState } from 'react';
import { useGame, type QuickSection } from '../stores/gameStore';
import { travelTo } from '../engine/loading/travel';
import { audio } from '../engine/audio/AudioManager';
import { WorldMap } from './WorldMap';
import { SettingsPanel } from './SettingsPanel';

type View = 'main' | 'map' | 'settings';

/** Pause / portfolio menu (Esc). */
export function PauseMenu() {
  const overlay = useGame((s) => s.overlay);
  const world = useGame((s) => s.currentWorld);
  const [view, setView] = useState<View>('main');
  const first = useRef<HTMLButtonElement>(null);
  const open = overlay === 'pause' || overlay === 'settings' || overlay === 'map';

  useEffect(() => {
    if (overlay === 'settings') setView('settings');
    else if (overlay === 'map') setView('map');
    else if (overlay === 'pause') setView('main');
  }, [overlay]);
  useEffect(() => {
    if (open && view === 'main') first.current?.focus();
  }, [open, view]);

  if (!open) return null;
  const game = useGame.getState();
  const quick = (section: QuickSection) => {
    audio.play('ui');
    game.openOverlay('quick', section);
  };
  const started = useGame.getState().started;

  return (
    <div className="overlay-backdrop">
      <section className="pause" role="dialog" aria-modal="true" aria-labelledby="pause-title">
        {view === 'main' && (
          <>
            <h2 id="pause-title">Paused</h2>
            <nav className="pause-list">
              {started && (
                <button ref={first} className="btn primary" onClick={() => game.closeOverlay()}>
                  Resume game
                </button>
              )}
              <button className="btn" onClick={() => setView('map')}>Worlds</button>
              <button className="btn" onClick={() => quick('data-science')}>Projects</button>
              <button className="btn" onClick={() => quick('about')}>About</button>
              <button className="btn" onClick={() => quick('resume')}>Resume</button>
              <button className="btn" onClick={() => quick('contact')}>Contact</button>
              <button className="btn" onClick={() => setView('settings')}>Settings</button>
              {started && world !== 'hub' && (
                <button
                  className="btn"
                  onClick={() => {
                    game.closeOverlay();
                    void travelTo('hub');
                  }}
                >
                  Return to Hub
                </button>
              )}
            </nav>
          </>
        )}
        {view !== 'main' && (
          <>
            <header className="pause-header">
              <button className="btn small" onClick={() => (overlay === 'pause' ? setView('main') : game.closeOverlay())}>
                ← Back
              </button>
              <h2 id="pause-title">{view === 'map' ? 'World map' : 'Settings'}</h2>
            </header>
            {view === 'map' ? <WorldMap /> : <SettingsPanel />}
          </>
        )}
      </section>
    </div>
  );
}
