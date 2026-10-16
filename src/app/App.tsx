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
import { usePaperUiClass } from '../ui/ThemeToggle';

const loadShell = () => import('./GameShell');
// The Journey world's dialogue box and memory journal (DOM), part of its own chunk.
const JourneyOverlay = lazy(() => import('../worlds/journey/ui/JourneyOverlay'));
const GameShell = lazy(loadShell);

export function App() {
  const started = useGame((s) => s.started);
  const world = useGame((s) => s.currentWorld);
  const highContrast = useSettings((s) => s.highContrast);
  const reducedMotion = useSettings((s) => s.reducedMotion);
  const caps = useMemo(detectCapabilities, []);
  const paperUi = usePaperUiClass();

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
    <div className={paperUi}>
      {!started && <Landing caps={caps} onEnter={enter} />}
      {started && (
        <Suspense fallback={<Loader />}>
          <GameShell />
          <HUD />
        </Suspense>
      )}
      {started && world === 'journey' && (
        <Suspense fallback={null}>
          <JourneyOverlay />
        </Suspense>
      )}
      <TransitionOverlay />
      <ProjectInspector />
      <PauseMenu />
      <QuickPortfolio />
      {started && <DebugOverlay />}
    </div>
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
