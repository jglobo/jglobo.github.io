// My Journey: an HD-2D life town. Pixel-art characters in a 3D diorama, a home
// with Jose and the family dog, and a path up the hill where each building is a
// chapter of the résumé, oldest first.
import { useEffect, useMemo, useState } from 'react';
import { journey } from '../../content';
import { audio } from '../../engine/audio/AudioManager';
import { Portal } from '../../engine/portals/Portal';
import { HUB_THEME } from '../../engine/portals/destinations';
import { useGame } from '../../stores/gameStore';
import { useHud } from '../../stores/hudStore';
import { useSettings } from '../../stores/settingsStore';
import { Atmosphere } from './Atmosphere';
import { useKit } from './Buildings';
import { HD2DCamera } from './HD2DCamera';
import { Home } from './Home';
import { CONTROLS, JourneyController, plazaPortal } from './JourneyController';
import { useJourney } from './journeyStore';
import { PORTAL_SPOT, buildLayout } from './layout';
import { Dog, JoseNpc, makeDog } from './NPCs';
import { TiltShift } from './TiltShift';
import { Town } from './Town';

const TILT: Record<string, number> = { low: 0, medium: 2.2, high: 3, ultra: 3.4 };

export default function JourneyWorld() {
  const layout = useMemo(() => buildLayout(journey.stops), []);
  const kit = useKit();
  const dog = useMemo(makeDog, []);
  const quality = useSettings((s) => s.quality);
  const [returnPortal, setReturnPortal] = useState<{ x: number; z: number } | null>(null);
  const exit = plazaPortal(layout);

  useEffect(() => {
    useJourney.setState({ talking: null, stop: null });
    useHud.setState({ controls: [...CONTROLS] });
    const g = useGame.getState();
    if (!g.completedInteractions.includes('journey:talk-jose')) {
      g.setHint('Say hi to Jose by the house, then follow the path. Each building is a chapter, oldest first.');
    }
    const t = setTimeout(() => useGame.getState().setHint(null), 9000);
    return () => {
      clearTimeout(t);
      useHud.setState({ controls: [], markers: [], returnCharge: 0 });
      useGame.getState().setHint(null);
      useJourney.setState({ talking: null, stop: null });
      audio.setEngine(0, 0);
    };
  }, []);

  return (
    <>
      <Atmosphere />
      <Town kit={kit} layout={layout} />
      <Home kit={kit} layout={layout} />
      <JoseNpc kit={kit} />
      <Dog dog={dog} layout={layout} />
      <Portal position={[PORTAL_SPOT.x, 1.9, PORTAL_SPOT.z]} normal={[0, 0, 1]} color={HUB_THEME.color} color2={HUB_THEME.color2} preview="hub" open={1} scale={0.7} />
      <Portal position={[exit.x, 1.9, exit.z]} normal={[0, 0, 1]} color={HUB_THEME.color} color2={HUB_THEME.color2} preview="hub" open={1} scale={0.7} />
      {returnPortal && (
        <Portal position={[returnPortal.x, 1.9, returnPortal.z]} normal={[0, 0, 1]} color={HUB_THEME.color} color2={HUB_THEME.color2} preview="hub" open={1} scale={0.7} />
      )}
      <JourneyController layout={layout} dog={dog} returnPortal={returnPortal} onSummon={setReturnPortal} />
      <HD2DCamera />
      {TILT[quality] > 0 && <TiltShift strength={TILT[quality]} />}
    </>
  );
}
