// Software Engineering world: a compact town around a garage. Walk to a vehicle,
// ride it, and drive to the billboards where the apps live.
import { useEffect, useMemo, useState } from 'react';
import { Portal } from '../../engine/portals/Portal';
import { HUB_THEME } from '../../engine/portals/destinations';
import { audio } from '../../engine/audio/AudioManager';
import { useGame } from '../../stores/gameStore';
import { useHud } from '../../stores/hudStore';
import { qualityProfile } from '../../stores/settingsStore';
import { Billboards } from './Billboards';
import { Walker, type WalkerPose } from './Character';
import { PORTAL_SPOT, SPAWN } from './layout';
import { CONTROLS, PlayerController, type SoftwareKeys } from './PlayerController';
import { parked, useSoftware } from './softwareStore';
import { Terrain } from './terrain/Terrain';
import { Bicycle } from './vehicles/Bicycle';
import { makePose } from './vehicles/pose';
import { SportsCar } from './vehicles/SportsCar';
import { VehicleGarage } from './VehicleGarage';

export default function SoftwareWorld() {
  const shadows = qualityProfile().shadows;
  const walker = useMemo<WalkerPose>(() => ({ x: SPAWN.x, z: SPAWN.z, heading: 0, speed: 0, visible: true }), []);
  const poses = useMemo(
    () => ({
      'sports-car': makePose(parked['sports-car'].x, parked['sports-car'].z, parked['sports-car'].heading),
      bicycle: makePose(parked.bicycle.x, parked.bicycle.z, parked.bicycle.heading),
    }),
    [],
  );
  const keys = useMemo<SoftwareKeys>(() => ({ held: new Set(), pressed: new Set() }), []);
  const [returnPortal, setReturnPortal] = useState<{ x: number; z: number } | null>(null);

  useEffect(() => {
    useSoftware.setState({ riding: null });
    useHud.setState({ controls: [...CONTROLS.foot] });
    const g = useGame.getState();
    if (!g.completedInteractions.includes('vehicle')) g.setHint('Walk into the garage and press E next to the car or the bike to ride it.');
    const down = (e: KeyboardEvent) => {
      if (e.code === 'Space' && useGame.getState().overlay === 'none') e.preventDefault();
      if (!e.repeat) keys.pressed.add(e.code);
      keys.held.add(e.code);
    };
    const up = (e: KeyboardEvent) => keys.held.delete(e.code);
    const blur = () => keys.held.clear();
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', blur);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', blur);
      useHud.setState({ controls: [], markers: [], returnCharge: 0 });
      useGame.getState().setHint(null);
      useGame.setState({ currentVehicle: null });
      useSoftware.setState({ riding: null });
      audio.setEngine(0, 0);
    };
  }, [keys]);

  return (
    <>
      <color attach="background" args={['#9fd4ff']} />
      <fog attach="fog" args={['#bfe3ff', 70, 160]} />
      <hemisphereLight args={['#dff1ff', '#4f7a3c', 0.9]} />
      <directionalLight
        position={[30, 50, 20]}
        intensity={1.8}
        color="#fff3dd"
        castShadow={shadows}
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-70}
        shadow-camera-right={70}
        shadow-camera-top={70}
        shadow-camera-bottom={-70}
      />
      <Terrain />
      <VehicleGarage />
      <Billboards />
      <SportsCar pose={poses['sports-car']} />
      <Bicycle pose={poses.bicycle} />
      <Walker pose={walker} />
      <Portal position={[PORTAL_SPOT.x, 2.1, PORTAL_SPOT.z]} normal={[0, 0, 1]} color={HUB_THEME.color} color2={HUB_THEME.color2} preview="hub" open={1} scale={0.8} />
      {returnPortal && (
        <Portal position={[returnPortal.x, 2.1, returnPortal.z]} normal={[0, 0, 1]} color={HUB_THEME.color} color2={HUB_THEME.color2} preview="hub" open={1} scale={0.8} />
      )}
      <PlayerController walker={walker} poses={poses} keys={keys} returnPortal={returnPortal} onSummon={setReturnPortal} />
    </>
  );
}
