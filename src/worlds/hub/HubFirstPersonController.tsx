// First-person movement, look, aiming and portal firing for the Hub.
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef, type RefObject } from 'react';
import { Euler, Raycaster, Vector2, Vector3, type Mesh } from 'three';
import { consumeLook, consumeWheel, isDown, onFire, wasPressed } from '../../engine/input/input';
import { updateInteractions } from '../../engine/interaction/interactions';
import { audio } from '../../engine/audio/AudioManager';
import { DESTINATIONS } from '../../engine/portals/destinations';
import { travelTo } from '../../engine/loading/travel';
import { debugInfo } from '../../engine/debug/debugInfo';
import { gameplayBlocked, useGame } from '../../stores/gameStore';
import { useSettings } from '../../stores/settingsStore';
import { CORE_RADIUS, ROOM, type HubEnvironmentHandle } from './HubEnvironment';
import { launcherRuntime } from './PortalLauncher';
import { hubAim } from './hubAim';

const EYE = 1.7;
const RADIUS = 0.45;
const WALK = 4.2;
const SPRINT = 7;
const PORTAL_HALF_W = 1.28;
const PORTAL_CENTER_Y = 1.72;

export function HubFirstPersonController({ env }: { env: RefObject<HubEnvironmentHandle | null> }) {
  const camera = useThree((s) => s.camera);
  const vel = useRef(new Vector3());
  const yaw = useRef(0);
  const pitch = useRef(0);
  const intro = useRef(0);
  const raycaster = useMemo(() => new Raycaster(), []);
  const center = useMemo(() => new Vector2(0, 0), []);
  const tmp = useMemo(() => ({ fwd: new Vector3(), right: new Vector3(), move: new Vector3(), euler: new Euler(0, 0, 0, 'YXZ') }), []);
  const reducedMotion = useSettings((s) => s.reducedMotion);

  // Spawn: in front of the core, or in front of the wall we came back through.
  useEffect(() => {
    const cameFromWorld = useGame.getState().previousWorld && useGame.getState().previousWorld !== 'hub';
    camera.position.set(0, EYE, cameFromWorld ? 10.5 : 9);
    yaw.current = 0;
    pitch.current = 0;
    intro.current = reducedMotion || cameFromWorld ? 1 : 0;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [camera]);

  // Firing a portal.
  useEffect(
    () =>
      onFire(() => {
        const game = useGame.getState();
        if (gameplayBlocked() || game.currentWorld !== 'hub') return;
        const hit = hubAim.hit;
        if (!hit) {
          audio.play('deny');
          return;
        }
        launcherRuntime.recoil = 1;
        audio.play('fire');
        game.completeInteraction('portal-fired');
        game.setPortal({
          id: performance.now(),
          from: launcherRuntime.muzzle.toArray() as [number, number, number],
          position: hit.position.toArray() as [number, number, number],
          normal: hit.normal.toArray() as [number, number, number],
          destination: game.portalDestination,
          state: 'projectile',
        });
      }),
    [],
  );

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    const game = useGame.getState();
    const blocked = gameplayBlocked();

    // Brief camera reveal on first entry.
    if (intro.current < 1) intro.current = Math.min(1, intro.current + Math.min(rawDt, 0.2) * 0.6);
    const reveal = 1 - Math.pow(1 - intro.current, 3);

    if (!blocked && intro.current >= 1) {
      const look = consumeLook();
      yaw.current -= look.x;
      pitch.current = Math.max(-1.4, Math.min(1.4, pitch.current - look.y));

      // Destination selection: 1-4 or mouse wheel.
      const keys = ['dest1', 'dest2', 'dest3', 'dest4'] as const;
      keys.forEach((k, i) => {
        if (wasPressed(k)) selectDestination(i);
      });
      const w = consumeWheel();
      if (w) {
        const idx = DESTINATIONS.findIndex((d) => d.id === game.portalDestination);
        selectDestination((idx + w + DESTINATIONS.length) % DESTINATIONS.length);
      }
    } else {
      consumeLook();
      consumeWheel();
    }

    tmp.euler.set(pitch.current * reveal + (1 - reveal) * 0.45, yaw.current, 0);
    camera.quaternion.setFromEuler(tmp.euler);

    // Movement relative to yaw only.
    tmp.fwd.set(-Math.sin(yaw.current), 0, -Math.cos(yaw.current));
    tmp.right.set(-tmp.fwd.z, 0, tmp.fwd.x);
    tmp.move.set(0, 0, 0);
    if (!blocked && intro.current >= 1) {
      if (isDown('forward')) tmp.move.add(tmp.fwd);
      if (isDown('back')) tmp.move.sub(tmp.fwd);
      if (isDown('right')) tmp.move.add(tmp.right);
      if (isDown('left')) tmp.move.sub(tmp.right);
    }
    const speed = isDown('sprint') ? SPRINT : WALK;
    if (tmp.move.lengthSq() > 0) tmp.move.normalize().multiplyScalar(speed);
    const accel = tmp.move.lengthSq() > 0 ? 12 : 10;
    vel.current.x += (tmp.move.x - vel.current.x) * Math.min(1, accel * dt);
    vel.current.z += (tmp.move.z - vel.current.z) * Math.min(1, accel * dt);

    const p = camera.position;
    p.x += vel.current.x * dt;
    p.z += vel.current.z * dt;

    // Walking into an open portal starts the trip.
    const portal = game.portal;
    let insidePortalZone = false;
    if (portal && portal.state === 'open') {
      const n = new Vector3(...portal.normal);
      const toPlayer = new Vector3(p.x - portal.position[0], 0, p.z - portal.position[2]);
      const along = toPlayer.dot(n);
      const lateral = toPlayer.sub(n.clone().multiplyScalar(along)).length();
      insidePortalZone = lateral < PORTAL_HALF_W * 0.85;
      if (insidePortalZone && along < 0.25 && !blocked) {
        game.completeInteraction('portal-entered');
        void travelTo(portal.destination);
      }
    }

    // Collision: room bounds (softened where an open portal is) and the central core.
    const lim = ROOM.half - RADIUS - (insidePortalZone ? -0.3 : 0);
    p.x = Math.max(-lim, Math.min(lim, p.x));
    p.z = Math.max(-lim, Math.min(lim, p.z));
    const dCore = Math.hypot(p.x, p.z);
    if (dCore < CORE_RADIUS + RADIUS) {
      const k = (CORE_RADIUS + RADIUS) / (dCore || 1);
      p.x *= k;
      p.z *= k;
    }
    p.y = EYE + (1 - reveal) * 2.2;
    launcherRuntime.speed = Math.hypot(vel.current.x, vel.current.z);

    // Aim at portal-compatible surfaces.
    hubAim.hit = null;
    const targets = env.current ? [...env.current.surfaces, ...env.current.occluders] : [];
    if (!blocked) {
      raycaster.setFromCamera(center, camera);
      raycaster.far = 30;
      const hits = raycaster.intersectObjects(targets, false);
      const h = hits[0];
      if (h && h.face && h.object.userData.portalSurface) {
        const normal = h.face.normal.clone().transformDirection((h.object as Mesh).matrixWorld);
        // Snap the portal to floor level and keep it inside the panel.
        const local = (h.object as Mesh).worldToLocal(h.point.clone());
        const halfW = (h.object.userData.halfWidth as number) - PORTAL_HALF_W - 0.1;
        local.x = Math.max(-halfW, Math.min(halfW, local.x));
        const world = (h.object as Mesh).localToWorld(local);
        world.y = PORTAL_CENTER_Y;
        world.addScaledVector(normal, 0.03);
        hubAim.hit = { position: world, normal };
      }
    }
    hubAim.surface = hubAim.hit ? 1 : 0;

    updateInteractions(p, !blocked);
    debugInfo.player = [p.x, p.y, p.z];
    debugInfo.camera = [p.x, p.y, p.z];
  });

  return null;
}

function selectDestination(i: number) {
  const d = DESTINATIONS[i];
  const game = useGame.getState();
  if (!d || d.id === game.portalDestination) return;
  game.selectDestination(d.id);
  game.completeInteraction('destination-selected');
  audio.play('select');
}
