// Software world player: walks on foot, gets on/off vehicles, drives them with the
// shared arcade physics, and owns the elevated follow camera, nav markers and the
// return portal. Vehicle models read the poses written here.
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import { Vector3 } from 'three';
import { publishedUrl } from '../../content';
import { isDown } from '../../engine/input/input';
import { activeInteractable, updateInteractions, useInteractable } from '../../engine/interaction/interactions';
import { wasPressed } from '../../engine/input/input';
import { audio } from '../../engine/audio/AudioManager';
import { travelTo } from '../../engine/loading/travel';
import { debugInfo } from '../../engine/debug/debugInfo';
import { gameplayBlocked, useGame } from '../../stores/gameStore';
import { useHud, type NavMarker } from '../../stores/hudStore';
import { useSettings } from '../../stores/settingsStore';
import { billboardProjects } from './Billboards';
import { collide, PORTAL_SPOT, SPAWN } from './layout';
import { parked, playerRuntime, useSoftware } from './softwareStore';
import { SPECS, forwardOf, initialVehicle, speedOf, stepVehicle, type VehicleState } from './vehicles/vehiclePhysics';
import type { VehiclePose } from './vehicles/pose';
import type { WalkerPose } from './Character';

const WALK = 4.5;
const RUN = 7.5;
const RETURN_HOLD = 0.8;
export const CONTROLS = {
  foot: ['WASD: walk · Shift: run', 'E: ride a vehicle / inspect a billboard', 'Hold R: return portal', 'Tab: Quick Portfolio'],
  'sports-car': ['W/S: gas and brake · A/D: steer', 'Space: handbrake (drift)', 'E: get out / inspect a billboard', 'Hold R: return portal'],
  bicycle: ['W/S: pedal and brake · A/D: steer', 'Space: hop · A/D in the air: spin', 'E: get off / inspect a billboard', 'Hold R: return portal'],
} as const;

export interface SoftwareKeys { held: Set<string>; pressed: Set<string> }

export function PlayerController({
  walker,
  poses,
  keys,
  returnPortal,
  onSummon,
}: {
  walker: WalkerPose;
  poses: Record<string, VehiclePose>;
  keys: SoftwareKeys;
  returnPortal: { x: number; z: number } | null;
  onSummon: (p: { x: number; z: number }) => void;
}) {
  const camera = useThree((s) => s.camera);
  const states = useRef<Record<string, VehicleState>>(
    Object.fromEntries(Object.entries(parked).map(([id, p]) => [id, initialVehicle(p.x, p.z, p.heading)])),
  );
  const camTarget = useMemo(() => new Vector3(SPAWN.x, 0, SPAWN.z), []);
  const player = useMemo(() => new Vector3(), []);
  const projected = useMemo(() => new Vector3(), []);
  const hold = useRef(0);
  const navTimer = useRef(0);
  const leaving = useRef(false);
  const lastSide = useRef(0);
  const trickTimer = useRef(0);
  const boards = useMemo(billboardProjects, []);
  const reducedMotion = useSettings((s) => s.reducedMotion);

  // Vehicles you can get on while walking.
  const rideItems = useMemo(
    () =>
      Object.keys(SPECS).map((id) => {
        const far = new Vector3(1e6, 0, 1e6);
        const at = new Vector3();
        return {
          id: `ride-${id}`,
          label: `[E] Ride the ${SPECS[id].name.toLowerCase()}`,
          position: () => {
            if (useSoftware.getState().riding) return far;
            const s = states.current[id];
            return at.set(s.x, 0, s.z);
          },
          radius: id === 'sports-car' ? 4 : 2.4,
          onInteract: () => mount(id),
        };
      }),
    [],
  );
  useInteractable(rideItems[0]);
  useInteractable(rideItems[1]);

  function mount(id: string) {
    useSoftware.getState().set({ riding: id });
    useGame.setState({ currentVehicle: id, vehicleSelection: id });
    useHud.setState({ controls: [...CONTROLS[id as keyof typeof CONTROLS]] });
    audio.play('door');
    const g = useGame.getState();
    if (!g.completedInteractions.includes('vehicle')) {
      g.completeInteraction('vehicle');
      g.setHint('Drive to the glowing billboards to see the apps. Follow the arrows.');
      setTimeout(() => useGame.getState().setHint(null), 6000);
    }
  }

  function dismount() {
    const id = useSoftware.getState().riding;
    if (!id) return;
    const s = states.current[id];
    s.vx = s.vz = 0;
    const f = forwardOf(s.heading);
    // Step out to the left of the vehicle.
    const out = collide(s.x + f.z * (SPECS[id].radius + 0.8), s.z - f.x * (SPECS[id].radius + 0.8), 0.4);
    walker.x = out.x;
    walker.z = out.z;
    walker.heading = s.heading;
    parked[id] = { x: s.x, z: s.z, heading: s.heading };
    useSoftware.getState().set({ riding: null });
    useGame.setState({ currentVehicle: null });
    useHud.setState({ controls: [...CONTROLS.foot] });
    audio.play('door');
    audio.setEngine(0, 0);
  }

  useEffect(() => {
    walker.x = SPAWN.x;
    walker.z = SPAWN.z;
    walker.heading = 0;
    camera.position.set(SPAWN.x, 16, SPAWN.z + 19);
    camera.lookAt(SPAWN.x, 0, SPAWN.z);
    return () => audio.setEngine(0, 0);
  }, [camera, walker]);

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    const blocked = gameplayBlocked();
    const riding = useSoftware.getState().riding;
    let px: number;
    let pz: number;
    let speed = 0;
    let heading: number;

    // Vehicles: integrate the ridden one, settle the parked ones.
    for (const [id, st] of Object.entries(states.current)) {
      const ridden = id === riding;
      const input = ridden && !blocked
        ? {
            throttle: (isDown('forward') ? 1 : 0) - (isDown('back') ? 1 : 0),
            steer: (isDown('right') ? 1 : 0) - (isDown('left') ? 1 : 0),
            handbrake: id === 'sports-car' && keys.held.has('Space'),
            jump: id === 'bicycle' && keys.pressed.has('Space'),
          }
        : { throttle: 0, steer: 0, handbrake: true, jump: false };
      const prev = st;
      const s = stepVehicle(st, SPECS[id], input, dt);
      states.current[id] = s;
      const pose = poses[id];
      const fwd = speedOf(s);
      const side = s.vx * -forwardOf(s.heading).z + s.vz * forwardOf(s.heading).x;
      pose.x = s.x;
      pose.y = s.y;
      pose.z = s.z;
      pose.heading = s.heading;
      pose.speed = fwd;
      pose.steer += (input.steer - pose.steer) * Math.min(1, dt * 8);
      pose.ridden = ridden;
      if (id === 'bicycle') pose.roll += ((ridden ? input.steer * Math.min(1, Math.abs(fwd) / 6) * 0.35 : 0.12) - pose.roll) * Math.min(1, dt * 5);
      else pose.roll += (Math.max(-0.08, Math.min(0.08, side * -0.02)) - pose.roll) * Math.min(1, dt * 6);
      pose.pitch += (Math.max(-0.06, Math.min(0.06, (fwd - speedOf(prev)) / Math.max(dt, 1e-3) * -0.004)) - pose.pitch) * Math.min(1, dt * 6);
      if (ridden) {
        if (s.landedSpins > 0) {
          audio.play('trick');
          useGame.getState().setHint(s.landedSpins > 1 ? `${s.landedSpins * 360}° spin!` : '360° bunny hop!');
          trickTimer.current = 1.6;
        }
        if (!prev.grounded && s.grounded && prev.vy < -6) audio.play('thud');
        audio.setEngine(1, Math.min(1, Math.abs(fwd) / SPECS[id].maxSpeed), id === 'sports-car' ? 'car' : 'bike');
        lastSide.current = side;
      }
    }
    keys.pressed.clear();
    if (trickTimer.current > 0) {
      trickTimer.current -= dt;
      if (trickTimer.current <= 0) useGame.getState().setHint(null);
    }

    if (riding) {
      const s = states.current[riding];
      px = s.x;
      pz = s.z;
      speed = Math.hypot(s.vx, s.vz);
      heading = s.heading;
      walker.visible = false;
    } else {
      // On foot: screen-relative movement (the camera always looks north).
      let mx = 0;
      let mz = 0;
      if (!blocked) {
        if (isDown('forward')) mz -= 1;
        if (isDown('back')) mz += 1;
        if (isDown('right')) mx += 1;
        if (isDown('left')) mx -= 1;
      }
      const len = Math.hypot(mx, mz);
      const target = len ? (isDown('sprint') ? RUN : WALK) : 0;
      walker.speed += (target - walker.speed) * Math.min(1, dt * 10);
      if (len) {
        const want = Math.atan2(mx, -mz);
        let d = want - walker.heading;
        d = Math.atan2(Math.sin(d), Math.cos(d));
        walker.heading += d * Math.min(1, dt * 12);
      }
      const f = forwardOf(walker.heading);
      const c = collide(walker.x + f.x * walker.speed * dt, walker.z + f.z * walker.speed * dt, 0.4);
      walker.x = c.x;
      walker.z = c.z;
      walker.visible = true;
      px = walker.x;
      pz = walker.z;
      speed = walker.speed;
      heading = walker.heading;
    }
    playerRuntime.x = px;
    playerRuntime.z = pz;
    playerRuntime.heading = heading;
    playerRuntime.speed = speed;

    // Interactions: billboards and vehicles; E with nothing in reach gets you off.
    player.set(px, 0, pz);
    updateInteractions(player, !blocked);
    if (riding && !blocked && !activeInteractable() && wasPressed('interact')) dismount();

    // Portals: the arrival portal by the garage and a summoned one.
    const nearPortal = (p: { x: number; z: number }) => Math.abs(px - p.x) < 1.3 && Math.abs(pz - p.z) < 0.9;
    if (!blocked && !leaving.current && (nearPortal(PORTAL_SPOT) || (returnPortal && nearPortal(returnPortal)))) {
      leaving.current = true;
      void travelTo('hub');
    }
    if (!blocked && isDown('returnPortal') && !returnPortal) {
      hold.current += Math.min(rawDt, 0.2);
      if (hold.current >= RETURN_HOLD) {
        hold.current = 0;
        const f = forwardOf(heading);
        const spot = collide(px + f.x * 6, pz + f.z * 6, 1.5);
        onSummon({ x: spot.x, z: spot.z });
        audio.play('summon');
        useGame.getState().setHint('Go through the portal to return to the Hub');
      }
    } else hold.current = Math.max(0, hold.current - dt * 2);

    // Elevated follow camera: looks north, leads the motion, pulls back with speed.
    const zoom = 1 + Math.min(0.6, speed / 40);
    const lead = riding ? 0.45 : 0.2;
    const s = riding ? states.current[riding] : null;
    const vx = s ? s.vx : forwardOf(walker.heading).x * walker.speed;
    const vz = s ? s.vz : forwardOf(walker.heading).z * walker.speed;
    camTarget.x += (px + vx * lead - camTarget.x) * Math.min(1, dt * 3);
    camTarget.z += (pz + vz * lead - camTarget.z) * Math.min(1, dt * 3);
    camTarget.y = s ? s.y * 0.5 : 0;
    const shake = !reducedMotion && s?.drifting ? (Math.random() - 0.5) * 0.08 : 0;
    camera.position.set(camTarget.x + shake, camTarget.y + 16 * zoom, camTarget.z + 19 * zoom);
    camera.lookAt(camTarget.x, camTarget.y, camTarget.z - 1);

    // Navigation markers to the billboards (~12 Hz).
    navTimer.current += dt;
    if (navTimer.current > 0.08) {
      navTimer.current = 0;
      const discovered = useGame.getState().discoveredProjects;
      const markers: NavMarker[] = boards.map(({ project, spot }) => {
        projected.set(spot.x, 7, spot.z).project(camera);
        const onScreen = Math.abs(projected.x) < 0.92 && Math.abs(projected.y) < 0.88 && projected.z < 1;
        const angle = Math.atan2(-(spot.z - pz), spot.x - px);
        const distance = Math.hypot(spot.x - px, spot.z - pz);
        let x = (projected.x + 1) / 2;
        let y = (1 - projected.y) / 2;
        if (!onScreen) {
          const dx = Math.cos(angle);
          const dy = -Math.sin(angle);
          const t = Math.min(0.44 / Math.max(Math.abs(dx), 1e-6), 0.42 / Math.max(Math.abs(dy), 1e-6));
          x = 0.5 + dx * t;
          y = 0.5 + dy * t;
        }
        return {
          id: project.id,
          label: project.title,
          symbol: '⬢',
          x,
          y,
          angle,
          distance,
          onScreen,
          discovered: discovered.includes(project.id),
          // Only offer the direct link when you are close, so the edges stay tidy.
          url: distance < 32 ? publishedUrl(project) : undefined,
          projectTitle: project.title,
        };
      });
      useHud.setState({ markers, returnCharge: hold.current / RETURN_HOLD });
    }

    debugInfo.player = [px, s ? s.y : 0, pz];
    debugInfo.camera = [camera.position.x, camera.position.y, camera.position.z];
  });

  return null;
}
