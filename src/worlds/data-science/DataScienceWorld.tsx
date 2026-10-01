import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Vector3 } from 'three';
import { Portal } from '../../engine/portals/Portal';
import { publishedUrl } from '../../content';
import { HUB_THEME } from '../../engine/portals/destinations';
import { isDown } from '../../engine/input/input';
import { updateInteractions } from '../../engine/interaction/interactions';
import { audio } from '../../engine/audio/AudioManager';
import { travelTo } from '../../engine/loading/travel';
import { debugInfo } from '../../engine/debug/debugInfo';
import { gameplayBlocked, useGame } from '../../stores/gameStore';
import { useHud, type NavMarker } from '../../stores/hudStore';
import { useSettings } from '../../stores/settingsStore';
import { Astronaut, type AstronautRuntime } from './Astronaut';
import { collideCircle, initialJetpack, stepJetpack, type JetpackState } from './JetpackController';
import { ProjectSites, activeSites } from './ProjectSites';
import { SpaceEnvironment } from './SpaceEnvironment';

const CAMERA_DISTANCE = 17;
const RETURN_HOLD = 0.8;

export default function DataScienceWorld() {
  const runtime = useRef<AstronautRuntime>({ x: 0, y: -1, vx: 0, vy: 0, thrustX: 0, thrustY: 0, boosting: false });
  const [returnPortal, setReturnPortal] = useState<{ x: number; y: number } | null>(null);
  const [arrivalOpen, setArrivalOpen] = useState(1);

  useEffect(() => {
    useHud.setState({ controls: ['WASD / arrows: jetpack', 'Shift: boost', 'E: interact', 'Hold R: return portal', 'Tab: Quick Portfolio'] });
    const s = useGame.getState();
    if (!s.completedInteractions.includes('jetpack')) s.setHint('Use WASD to fly your jetpack. Follow the arrows to a research site.');
    const t = setTimeout(() => setArrivalOpen(0), 2600);
    return () => {
      clearTimeout(t);
      useHud.setState({ markers: [], returnCharge: 0, controls: [] });
      useGame.getState().setHint(null);
      audio.setThrust(0);
    };
  }, []);

  return (
    <>
      <SpaceEnvironment />
      <ProjectSites runtime={runtime} />
      <Astronaut runtime={runtime} />
      <SpaceAstronautController runtime={runtime} returnPortal={returnPortal} onSummon={setReturnPortal} />
      <Portal position={[0, -1, -1]} normal={[0, 0, 1]} color={HUB_THEME.color} color2={HUB_THEME.color2} preview="hub" open={arrivalOpen} scale={0.9} />
      {returnPortal && (
        <Portal position={[returnPortal.x, returnPortal.y, -0.2]} normal={[0, 0, 1]} color={HUB_THEME.color} color2={HUB_THEME.color2} preview="hub" open={1} scale={0.9} />
      )}
    </>
  );
}

/** Zero-g jetpack input + physics, 2.5D follow camera, nav markers and the return portal. */
function SpaceAstronautController({
  runtime,
  returnPortal,
  onSummon,
}: {
  runtime: React.RefObject<AstronautRuntime>;
  returnPortal: { x: number; y: number } | null;
  onSummon: (p: { x: number; y: number } | null) => void;
}) {
  const camera = useThree((s) => s.camera);
  const state = useRef<JetpackState>(initialJetpack(0, -1));
  const hold = useRef(0);
  const shake = useRef(0);
  const navTimer = useRef(0);
  const wasBoosting = useRef(false);
  const facing = useRef(1);
  const player = useMemo(() => new Vector3(), []);
  const lookTarget = useMemo(() => new Vector3(0, 0, 0), []);
  const projected = useMemo(() => new Vector3(), []);
  const sites = useMemo(activeSites, []);
  const reducedMotion = useSettings((s) => s.reducedMotion);

  useEffect(() => {
    camera.position.set(0, 0.5, CAMERA_DISTANCE + 6);
    camera.lookAt(0, 0, 0);
  }, [camera]);

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    const blocked = gameplayBlocked();
    const input = { x: 0, y: 0, boost: false };
    if (!blocked) {
      if (isDown('right')) input.x += 1;
      if (isDown('left')) input.x -= 1;
      if (isDown('forward')) input.y += 1;
      if (isDown('back')) input.y -= 1;
      input.boost = isDown('sprint');
    }

    let s = stepJetpack(state.current, input, dt);
    for (const { site } of sites) s = collideCircle(s, site.x, site.y, site.collide);
    state.current = s;

    const r = runtime.current!;
    r.x = s.x;
    r.y = s.y;
    r.vx = s.vx;
    r.vy = s.vy;
    r.thrustX = input.x;
    r.thrustY = input.y;
    r.boosting = s.boostLeft > 0;
    if (input.x) facing.current = Math.sign(input.x);

    const thrusting = input.x !== 0 || input.y !== 0;
    audio.setThrust(thrusting ? (r.boosting ? 1 : 0.55) : 0);
    if (thrusting) {
      const g = useGame.getState();
      if (!g.completedInteractions.includes('jetpack')) {
        g.completeInteraction('jetpack');
        setTimeout(() => useGame.getState().setHint(null), 2500);
      }
    }
    if (r.boosting && !wasBoosting.current && !reducedMotion) shake.current = 0.35;
    wasBoosting.current = r.boosting;

    // Camera: side-on follow with lag and a little look-ahead.
    shake.current = Math.max(0, shake.current - dt);
    const sx = (Math.random() - 0.5) * shake.current * 0.6;
    const sy = (Math.random() - 0.5) * shake.current * 0.6;
    const k = Math.min(1, dt * 2.5);
    camera.position.x += (s.x + s.vx * 0.35 - camera.position.x) * k + sx;
    camera.position.y += (s.y + 1.2 + s.vy * 0.25 - camera.position.y) * k + sy;
    camera.position.z += (CAMERA_DISTANCE + Math.hypot(s.vx, s.vy) * 0.25 - camera.position.z) * k;
    lookTarget.x += (s.x + s.vx * 0.2 - lookTarget.x) * k;
    lookTarget.y += (s.y + 0.4 - lookTarget.y) * k;
    camera.lookAt(lookTarget);

    player.set(s.x, s.y, 0);
    updateInteractions(player, !blocked);

    // Hold R to summon a return portal just ahead of the astronaut.
    if (!blocked && isDown('returnPortal') && !returnPortal) {
      hold.current += Math.min(rawDt, 0.2);
      if (hold.current >= RETURN_HOLD) {
        hold.current = 0;
        audio.play('summon');
        onSummon({ x: s.x + facing.current * 3.2, y: s.y });
        useGame.getState().setHint('Fly into the portal to return to the Hub');
      }
    } else {
      hold.current = Math.max(0, hold.current - dt * 2);
    }
    if (returnPortal && Math.hypot(s.x - returnPortal.x, s.y - returnPortal.y) < 1.1 && !blocked) {
      useGame.getState().setHint(null);
      void travelTo('hub');
    }

    // Navigation markers (~12 Hz is plenty for the HUD).
    navTimer.current += dt;
    if (navTimer.current > 0.08) {
      navTimer.current = 0;
      const discovered = useGame.getState().discoveredProjects;
      const markers: NavMarker[] = sites.map(({ site, project }) => {
        projected.set(site.x, site.y, 0).project(camera);
        const onScreen = Math.abs(projected.x) < 0.92 && Math.abs(projected.y) < 0.88 && projected.z < 1;
        const angle = Math.atan2(site.y - s.y, site.x - s.x);
        let x = (projected.x + 1) / 2;
        let y = (1 - projected.y) / 2;
        if (!onScreen) {
          // Pin to the screen edge in the direction of the site.
          const dx = Math.cos(angle);
          const dy = -Math.sin(angle);
          const t = Math.min(0.44 / Math.max(Math.abs(dx), 1e-6), 0.42 / Math.max(Math.abs(dy), 1e-6));
          x = 0.5 + dx * t;
          y = 0.5 + dy * t;
        }
        return {
          id: site.id,
          label: site.name,
          symbol: site.symbol,
          x,
          y,
          angle,
          distance: Math.hypot(site.x - s.x, site.y - s.y),
          onScreen,
          discovered: discovered.includes(project.id),
          url: publishedUrl(project),
          projectTitle: project.title,
        };
      });
      useHud.setState({ markers, returnCharge: hold.current / RETURN_HOLD });
    }

    debugInfo.player = [s.x, s.y, 0];
    debugInfo.camera = [camera.position.x, camera.position.y, camera.position.z];
  });

  return null;
}
