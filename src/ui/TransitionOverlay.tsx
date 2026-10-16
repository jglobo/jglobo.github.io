import { useGame } from '../stores/gameStore';
import { worldTheme } from '../engine/portals/destinations';
import { worldName } from './worldNames';

/** Tunnel / chromatic sweep that hides the world swap. */
export function TransitionOverlay() {
  const { phase, to } = useGame((s) => s.transition);
  if (phase === 'idle' || !to) return null;
  const theme = worldTheme(to);
  return (
    <div className={`transition ${phase}`} style={{ ['--accent' as string]: theme.color, ['--accent2' as string]: theme.color2 }} aria-live="assertive">
      <div className="tunnel" />
      <div className="transition-label">
        <span className="transition-symbol" aria-hidden="true">{theme.symbol}</span>
        <span>{phase === 'loading' ? `Stabilising rift to ${worldName(to)}…` : worldName(to)}</span>
      </div>
    </div>
  );
}
