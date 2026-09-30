import { Suspense, useEffect } from 'react';
import { useGame } from '../stores/gameStore';
import { worldComponent } from '../engine/loading/worlds';
import { audio } from '../engine/audio/AudioManager';

/** Mounts exactly one world. Switching worlds unmounts the previous one, which
 *  disposes everything it owned (R3F objects + the world's own cleanup effects). */
export function WorldHost() {
  const current = useGame((s) => s.currentWorld);
  const World = worldComponent(current);
  useEffect(() => audio.setAmbience(current), [current]);
  return (
    <Suspense fallback={null}>
      <World key={current} />
    </Suspense>
  );
}
