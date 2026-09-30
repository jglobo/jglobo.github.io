import { lazy, Suspense, useEffect, useMemo } from 'react';
import { useGame } from '../stores/gameStore';
import { useSettings } from '../stores/settingsStore';
import { detectCapabilities } from './capabilities';
import { Landing } from '../ui/Landing';
import { HUD } from '../ui/HUD';
import { PauseMenu } from '../ui/PauseMenu';
import { TransitionOverlay } from '../ui/TransitionOverlay';
import { QuickPortfolio } from '../portfolio/QuickPortfolio';
import { ProjectInspector } from '../portfolio/ProjectInspector';
import { DebugOverlay } from '../engine/debug/DebugOverlay';
import { preloadWorld } from '../engine/loading/worlds';

const loadShell = () => import('./GameShell');
const GameShell = lazy(loadShell);

export function App() {
  const started = useGame((s) => s.started);
  const highContrast = useSettings((s) => s.highContrast);
  const reducedMotion = useSettings((s) => s.reducedMotion);
  const caps = useMemo(detectCapabilities, []);

  useEffect(() => {
    const s = useSettings.getState();
    if (!s.qualityChosen) s.set({ quality: caps.suggestedQuality });
  }, [caps]);

  useEffect(() => {
    document.documentElement.classList.toggle('high-contrast', highContrast);
    document.documentElement.classList.toggle('reduced-motion', reducedMotion);
  }, [highContrast, reducedMotion]);

  const enter = () => {
    // Start both downloads together; the loader covers them.
    void loadShell();
    void preloadWorld('hub');
    useGame.getState().start();
  };

  return (
    <>
      {!started && <Landing caps={caps} onEnter={enter} />}
      {started && (
        <Suspense fallback={<Loader />}>
          <GameShell />
          <HUD />
        </Suspense>
      )}
      <TransitionOverlay />
      <ProjectInspector />
      <PauseMenu />
      <QuickPortfolio />
      {started && <DebugOverlay />}
    </>
  );
}

function Loader() {
  return (
    <div className="loader" role="status">
      <div className="loader-rings" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
      <p>Calibrating dimensional launcher…</p>
    </div>
  );
}
