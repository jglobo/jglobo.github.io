// First-person movement, look, aiming and portal firing for the Hub test chamber.
// The player has gravity, so they can fall through a floor portal, drop out of a ceiling
// portal, and keep their momentum through a pair ("fling"). Walking into one portal
// brings them out of the other.
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import { Euler, Raycaster, Vector2, Vector3 } from 'three';
import { consumeLook, consumeWheel, isDown, onAltFire, onFire, wasPressed } from '../../engine/input/input';
import { updateInteractions } from '../../engine/interaction/interactions';
import { audio } from '../../engine/audio/AudioManager';
import { travelTo } from '../../engine/loading/travel';
import { debugInfo } from '../../engine/debug/debugInfo';
import { gameplayBlocked, useGame } from '../../stores/gameStore';
import { useSettings } from '../../stores/settingsStore';
import {
  BODY, CHASM, DOORS, EYE, GRAVITY, LEDGE_Z, PIT, ROOM, SPAWN, collidePlayer, doorDepth, floorAt, inChasm, inPit, insideHole, linked,
  mapDir, mapPoint, overlaps, snapPortal, surfaceById, type DoorWorld, type PortalColor,
} from './chamber';
import { fireGun, launcherRuntime } from './PortalLauncher';
import { hubAim } from './hubAim';
import { isSolved, puzzleKey, readyPortals, useHub } from './hubStore';

const WALK = 4.2;
const SPRINT = 7;
const HEAD = 1.85;

/** Where you arrive back from each world, and which way you face (yaw). */
const ARRIVALS: Record<string, { x: number; z: number; yaw: number }> = {
  games: { x: 0, z: -10.5, yaw: Math.PI },
  software: { x: -10.5, z: 0, yaw: -Math.PI / 2 },
  'data-science': { x: 7.5, z: 0, yaw: Math.PI / 2 },
};

export function HubFirstPersonController() {
  const camera = useThree((s) => s.camera);
  const vel = useRef(new Vector3());
  const feet = useRef(0);
  const grounded = useRef(true);
  const yaw = useRef(0);
  const pitch = useRef(0);
  const intro = useRef(0);
  const cooldown = useRef(0);
  const leaving = useRef(false);
  const raycaster = useMemo(() => new Raycaster(), []);
  const center = useMemo(() => new Vector2(0, 0), []);
  const tmp = useMemo(() => ({ fwd: new Vector3(), right: new Vector3(), move: new Vector3(), euler: new Euler(0, 0, 0, 'YXZ'), prev: new Vector3(), body: new Vector3() }), []);
  const reducedMotion = useSettings((s) => s.reducedMotion);
  const fireRef = useRef<(c: PortalColor) => void>(() => {});

  // Spawn: in front of the console, or back where you left for a world.
  useEffect(() => {
    const prev = useGame.getState().previousWorld;
    const a = (prev && ARRIVALS[prev]) || { x: SPAWN.x, z: SPAWN.z, yaw: 0 };
    camera.position.set(a.x, EYE, a.z);
    feet.current = 0;
    vel.current.set(0, 0, 0);
    yaw.current = a.yaw;
    pitch.current = 0;
    intro.current = reducedMotion || (prev && prev !== 'hub') ? 1 : 0;
    useHub.getState().clear();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [camera]);

  // Firing: left click (or 1) blue, right click (or 2) orange.
  useEffect(() => {
    const fire = (color: PortalColor) => {
      const game = useGame.getState();
      if (gameplayBlocked() || game.currentWorld !== 'hub' || intro.current < 1) return;
      const hit = hubAim.hit;
      const otherColor = color === 'blue' ? 'orange' : 'blue';
      const frame = hit?.frame && !overlaps(hit.frame, useHub.getState()[otherColor]) ? hit.frame : null;
      if (!fireGun(color, frame, hit?.point)) return;
      audio.play('fire');
      if (!frame) {
        audio.play('deny');
        return;
      }
      game.completeInteraction(`portal-${color}`);
    };
    const offA = onFire(() => fire('blue'));
    const offB = onAltFire(() => fire('orange'));
    fireRef.current = fire;
    return () => {
      offA();
      offB();
    };
  }, []);

  // ?debug: a small console API for scripted checks (place the player, aim, fire).
  useEffect(() => {
    if (!useGame.getState().debug) return;
    const w = window as unknown as Record<string, unknown>;
    w.__hub = {
      view: (x: number, z: number, yawDeg: number, pitchDeg = 0) => {
        camera.position.set(x, EYE, z);
        feet.current = 0;
        vel.current.set(0, 0, 0);
        yaw.current = (yawDeg * Math.PI) / 180;
        pitch.current = (pitchDeg * Math.PI) / 180;
      },
      fire: (c: PortalColor) => fireRef.current(c),
      state: () => ({ pos: camera.position.toArray(), feet: feet.current, blue: useHub.getState().blue?.surface ?? null, orange: useHub.getState().orange?.surface ?? null, aim: hubAim.hit?.frame?.surface ?? null }),
    };
    return () => void delete w.__hub;
  }, [camera]);

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    const game = useGame.getState();
    const blocked = gameplayBlocked();
    cooldown.current = Math.max(0, cooldown.current - dt);

    // Brief camera reveal on first entry.
    if (intro.current < 1) intro.current = Math.min(1, intro.current + Math.min(rawDt, 0.2) * 0.6);
    const reveal = 1 - Math.pow(1 - intro.current, 3);
    const active = !blocked && intro.current >= 1;

    if (active) {
      const look = consumeLook();
      yaw.current -= look.x;
      pitch.current = Math.max(-1.45, Math.min(1.45, pitch.current - look.y));
      if (wasPressed('dest1')) fireRef.current('blue');
      if (wasPressed('dest2')) fireRef.current('orange');
      if (wasPressed('returnPortal') && (useHub.getState().blue || useHub.getState().orange)) {
        useHub.getState().clear();
        audio.play('putdown');
      }
    } else consumeLook();
    consumeWheel();

    tmp.euler.set(pitch.current * reveal + (1 - reveal) * 0.45, yaw.current, 0);
    camera.quaternion.setFromEuler(tmp.euler);

    // Movement relative to yaw; full control on the ground, a little in the air.
    tmp.fwd.set(-Math.sin(yaw.current), 0, -Math.cos(yaw.current));
    tmp.right.set(-tmp.fwd.z, 0, tmp.fwd.x);
    tmp.move.set(0, 0, 0);
    if (active) {
      if (isDown('forward')) tmp.move.add(tmp.fwd);
      if (isDown('back')) tmp.move.sub(tmp.fwd);
      if (isDown('right')) tmp.move.add(tmp.right);
      if (isDown('left')) tmp.move.sub(tmp.right);
    }
    const speed = isDown('sprint') ? SPRINT : WALK;
    const wish = tmp.move.lengthSq() > 0;
    if (wish) tmp.move.normalize().multiplyScalar(speed);
    const v = vel.current;
    if (grounded.current) {
      const accel = wish ? 12 : 10;
      v.x += (tmp.move.x - v.x) * Math.min(1, accel * dt);
      v.z += (tmp.move.z - v.z) * Math.min(1, accel * dt);
    } else if (wish) {
      v.x += (tmp.move.x - v.x) * Math.min(1, 1.2 * dt);
      v.z += (tmp.move.z - v.z) * Math.min(1, 1.2 * dt);
    }
    v.y -= GRAVITY * dt;

    const p = camera.position;
    tmp.prev.set(p.x, feet.current + BODY, p.z);
    const prevFeet = feet.current;
    p.x += v.x * dt;
    p.z += v.z * dt;
    feet.current += v.y * dt;

    // Through a portal.
    const portals = readyPortals();
    tmp.body.set(p.x, feet.current + BODY, p.z);
    if (cooldown.current <= 0) {
      for (const [a, b] of linked(portals)) {
        const d0 = tmp.prev.clone().sub(a.pos).dot(a.normal);
        const d1 = tmp.body.clone().sub(a.pos).dot(a.normal);
        if (d0 < 0 || d1 > 0) continue;
        const at = tmp.prev.clone().lerp(tmp.body, d0 / (d0 - d1 || 1));
        if (!insideHole(a, at)) continue;
        const out = mapPoint(a, b, at);
        const clearance = b.kind === 'wall' ? 0.55 : 1.05;
        const along = out.clone().sub(b.pos).dot(b.normal);
        if (along < clearance) out.addScaledVector(b.normal, clearance - along);
        const nv = mapDir(a, b, v);
        const minOut = b.kind === 'wall' ? 2.5 : b.kind === 'floor' ? 4 : 0.5;
        const vo = nv.dot(b.normal);
        if (vo < minOut) nv.addScaledVector(b.normal, minOut - vo);
        v.copy(nv);
        const f = mapDir(a, b, tmp.fwd);
        if (Math.hypot(f.x, f.z) > 0.3) yaw.current = Math.atan2(-f.x, -f.z);
        p.x = out.x;
        p.z = out.z;
        feet.current = out.y - BODY;
        grounded.current = false;
        cooldown.current = 0.25;
        audio.play('pickup');
        game.completeInteraction('portal-entered');
        break;
      }
    }

    // Walls, props, open doorways.
    const openDoors = (Object.keys(DOORS) as DoorWorld[]).filter((w) => game.completedInteractions.includes(puzzleKey(w)));
    [p.x, p.z] = collidePlayer(p.x, p.z, { feet: feet.current, portals, openDoors, falling: !grounded.current && v.y < 0 });

    // Floor, falling and the ceiling.
    const ground = floorAt(p.x, p.z, portals, hubAim.bridge);
    if (feet.current <= ground && v.y <= 0 && prevFeet >= ground - 0.3) {
      feet.current = ground;
      v.y = 0;
      grounded.current = true;
    } else if (feet.current > ground + 0.05 || ground === -Infinity) grounded.current = false;
    if (feet.current + HEAD > ROOM.height - 0.05) {
      const top = tmp.body.set(p.x, ROOM.height - 0.02, p.z);
      const intoPortal = linked(portals).some(([a]) => a.kind === 'ceiling' && insideHole(a, top));
      if (!intoPortal) {
        feet.current = ROOM.height - 0.05 - HEAD;
        v.y = Math.min(v.y, 0);
      }
    }

    if (!leaving.current) {
      // Falling into the data science pit.
      if (inPit(p.x, p.z) && feet.current < -1.2) {
        leaving.current = true;
        game.completeInteraction(puzzleKey('data-science'));
        audio.play('travel');
        void travelTo('data-science');
      }
      // Into the chasm: back to the near edge.
      if (inChasm(p.z) && feet.current < -2.5) {
        audio.play('thud');
        p.z = CHASM.minZ - 1.2;
        feet.current = 0;
        v.set(0, 0, 0);
      }
      if (feet.current < -8 || Math.abs(p.x) > ROOM.half + 4 || Math.abs(p.z) > ROOM.half + 4) {
        p.set(SPAWN.x, EYE, SPAWN.z);
        feet.current = 0;
        v.set(0, 0, 0);
      }
      // Across the chasm: the journey door opens.
      if (p.z > LEDGE_Z + 0.3 && feet.current > -0.2 && !isSolved('journey')) {
        game.completeInteraction(puzzleKey('journey'));
        audio.play('door');
      }
      // Through an open door.
      for (const w of openDoors) {
        if (doorDepth(w, p.x, p.z) > 0.8) {
          leaving.current = true;
          audio.play('travel');
          void travelTo(w);
          break;
        }
      }
    }
    if (inPit(p.x, p.z) && feet.current < -PIT.depth + 0.2) feet.current = -PIT.depth + 0.2;

    p.y = feet.current + EYE + (1 - reveal) * 2.2;
    launcherRuntime.speed = grounded.current ? Math.hypot(v.x, v.z) : 0;

    // Aim: the first surface the crosshair meets.
    hubAim.hit = null;
    if (!blocked) {
      raycaster.setFromCamera(center, camera);
      raycaster.far = 40;
      const h = raycaster.intersectObjects([...hubAim.targets], false)[0];
      if (h) {
        const s = h.object.userData.surfaceId ? surfaceById(h.object.userData.surfaceId as string) : undefined;
        hubAim.hit = { point: h.point.clone(), frame: s ? snapPortal(s, h.point) : null };
      }
    }

    updateInteractions(p, active);
    debugInfo.player = [p.x, p.y, p.z];
    debugInfo.camera = [p.x, p.y, p.z];
  });

  return null;
}
