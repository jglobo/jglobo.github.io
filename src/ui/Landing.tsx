import { profile, projects } from '../content';
import { useGame } from '../stores/gameStore';
import { useSettings } from '../stores/settingsStore';
import { audio } from '../engine/audio/AudioManager';
import { track } from '../analytics/track';
import type { Capabilities } from '../app/capabilities';

export function Landing({ caps, onEnter }: { caps: Capabilities; onEnter: () => void }) {
  const quality = useSettings((s) => s.quality);
  const canPlay = caps.webgl;
  const openQuick = () => {
    audio.unlock();
    useGame.getState().openOverlay('quick', 'about');
  };
  return (
    <div className="landing">
      <div className="landing-bg" aria-hidden="true">
        <div className="ring r1" />
        <div className="ring r2" />
        <div className="ring r3" />
      </div>
      <div className="landing-card">
        <p className="landing-kicker">Portfolio</p>
        <h1>{profile.name}</h1>
        <p className="landing-title">{profile.title}</p>
        <p className="landing-tagline">
          A playable portfolio. Step into a dimensional lab and open portals to worlds built around my work.
        </p>
        <div className="landing-actions">
          <button
            className="btn primary big"
            disabled={!canPlay}
            onClick={() => {
              audio.unlock();
              track('portfolio_entered');
              onEnter();
            }}
          >
            Enter portfolio
          </button>
          <button className="btn big" onClick={openQuick}>
            Quick portfolio
          </button>
          <button className="btn big ghost" onClick={() => useGame.getState().openOverlay('settings')}>
            Settings
          </button>
        </div>
        {!canPlay && <p className="landing-note">Your browser can't run WebGL, so the game is unavailable here. The Quick Portfolio has everything.</p>}
        {canPlay && caps.mobile && <p className="landing-note">The game is built for keyboard and mouse. On a phone, the Quick Portfolio is the better way in.</p>}
        {canPlay && !caps.mobile && <p className="landing-note muted">Keyboard + mouse · Graphics: {quality} · {projects.length} projects inside</p>}
      </div>
    </div>
  );
}
