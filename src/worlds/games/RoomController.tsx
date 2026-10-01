// First-person controller for the bedroom: walking, looking at and using things,
// holding a box for inspection, the insert animation and sitting at the TV.
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import { Euler, Matrix4, Quaternion, Raycaster, Vector2, Vector3 } from 'three';
import { projectById } from '../../content';
import { clearInput, consumeLook, isDown, onFire, wasPressed } from '../../engine/input/input';
import { requestLock } from '../../engine/input/pointerLock';
import { audio } from '../../engine/audio/AudioManager';
import { travelTo } from '../../engine/loading/travel';
import { debugInfo } from '../../engine/debug/debugInfo';
import { gameplayBlocked, useGame } from '../../stores/gameStore';
import { useSettings } from '../../stores/settingsStore';
import { EYE, TV, TV_SEAT, collide, inReturnPortal } from './layout';
import { allLookTargets, targetFor, type LookTarget } from './lookTargets';
import { roomRuntime, useRoom } from './roomStore';
import { openManual } from './GameShelf';
import type { CrtSystem } from './crt/CrtSystem';

const WALK = 2.6;
const SPRINT = 4.2;
const INSERT_TIME = 0.8;

export interface RoomKeys {
  held: Set<string>;
  pressed: Set<string>;
  click: boolean;
}

/** Tries to recapture the mouse after putting something down (may need a click instead). */
function tryLock() {
  const el = document.querySelector<HTMLElement>('.canvas-wrap');
  if (el) requestLock(el);
}

export function putBack() {
  const room = useRoom.getState();
  if (room.mode !== 'inspect') return;
  audio.play('putdown');
  room.set({ mode: 'walk', heldId: null });
  useGame.setState({ freeCursor: false });
  clearInput();
  tryLock();
}

export function standUp(crt: CrtSystem) {
  const room = useRoom.getState();
  if (room.mode !== 'crt') return;
  crt.back();
  room.set({ mode: 'walk' });
  useGame.setState({ freeCursor: false });
  clearInput();
  tryLock();
}

export function RoomController({ crt, keys }: { crt: CrtSystem; keys: RoomKeys }) {
  const camera = useThree((s) => s.camera);
  const pos = useRef(new Vector3(0, EYE, 1.7));
  const vel = useRef(new Vector3());
  const yaw = useRef(0);
  const pitch = useRef(-0.05);
  const blend = useRef(0);
  const bob = useRef(0);
  const leaving = useRef(false);
  const active = useRef<LookTarget | null>(null);
  const reducedMotion = useSettings((s) => s.reducedMotion);
  const tmp = useMemo(() => {
    // Camera-style orientation (looking down -z) from the beanbag towards the screen.
    const seatPos = new Vector3(TV_SEAT.x, TV_SEAT.y, TV_SEAT.z);
    const m = new Matrix4().lookAt(seatPos, new Vector3(TV.x, TV.screenY - 0.07, TV.screenZ), new Vector3(0, 1, 0));
    return {
      seatPos,
      seatQuat: new Quaternion().setFromRotationMatrix(m),
      walkPos: new Vector3(),
      walkQuat: new Quaternion(),
      euler: new Euler(0, 0, 0, 'YXZ'),
      fwd: new Vector3(),
      right: new Vector3(),
      move: new Vector3(),
      ray: new Raycaster(),
      center: new Vector2(),
    };
  }, []);

  useEffect(() => {
    camera.position.copy(pos.current);
    // Clicking uses whatever you are looking at (the first click only captures the mouse).
    return onFire(() => {
      const mode = useRoom.getState().mode;
      if (gameplayBlocked()) return;
      if (mode === 'walk') active.current?.use();
      else if (mode === 'crt') keys.click = true;
    });
  }, [camera, keys]);

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    const room = useRoom.getState();
    const game = useGame.getState();
    const blocked = gameplayBlocked();
    const look = consumeLook();
    let prompt: string | null = null;

    if (room.mode === 'walk' && !blocked) {
      yaw.current -= look.x;
      pitch.current = Math.max(-1.35, Math.min(1.35, pitch.current - look.y));
      tmp.fwd.set(-Math.sin(yaw.current), 0, -Math.cos(yaw.current));
      tmp.right.set(-tmp.fwd.z, 0, tmp.fwd.x);
      tmp.move.set(0, 0, 0);
      if (isDown('forward')) tmp.move.add(tmp.fwd);
      if (isDown('back')) tmp.move.sub(tmp.fwd);
      if (isDown('right')) tmp.move.add(tmp.right);
      if (isDown('left')) tmp.move.sub(tmp.right);
      if (tmp.move.lengthSq()) tmp.move.normalize().multiplyScalar(isDown('sprint') ? SPRINT : WALK);
    } else {
      tmp.move.set(0, 0, 0);
    }
    vel.current.x += (tmp.move.x - vel.current.x) * Math.min(1, dt * 12);
    vel.current.z += (tmp.move.z - vel.current.z) * Math.min(1, dt * 12);
    const p = pos.current;
    p.x += vel.current.x * dt;
    p.z += vel.current.z * dt;
    collide(p);
    const speed = Math.hypot(vel.current.x, vel.current.z);
    bob.current += speed * dt * 3.2;

    if (room.mode === 'walk' && !blocked && !leaving.current && inReturnPortal(p)) {
      leaving.current = true;
      void travelTo('hub');
    }

    // Camera: blend between the walking view and the seat in front of the TV.
    const seated = room.mode === 'crt' || room.mode === 'inserting';
    blend.current += ((seated ? 1 : 0) - blend.current) * Math.min(1, dt * 3);
    const b = blend.current * blend.current * (3 - 2 * blend.current);
    tmp.walkPos.set(p.x, EYE + (reducedMotion ? 0 : Math.sin(bob.current) * 0.025 * Math.min(1, speed)), p.z);
    tmp.walkQuat.setFromEuler(tmp.euler.set(pitch.current, yaw.current, 0));
    camera.position.lerpVectors(tmp.walkPos, tmp.seatPos, b);
    camera.quaternion.slerpQuaternions(tmp.walkQuat, tmp.seatQuat, b);

    // What are we looking at?
    active.current = null;
    if (room.mode === 'walk' && !blocked && blend.current < 0.05) {
      const objects = [];
      for (const t of allLookTargets().values()) {
        const o = t.object();
        if (o) objects.push(o);
      }
      tmp.ray.setFromCamera(tmp.center, camera);
      tmp.ray.far = 3.2;
      const hit = tmp.ray.intersectObjects(objects, true)[0];
      const target = hit ? targetFor(hit.object) : null;
      if (target && hit!.distance <= (target.reach ?? 2.5)) {
        active.current = target;
        prompt = target.prompt();
        if (wasPressed('interact')) {
          audio.play('interact');
          target.use();
        } else if (wasPressed('inspect')) target.inspect?.();
      }
    }

    if (room.mode === 'inspect') {
      const p = room.heldId ? projectById(room.heldId) : undefined;
      if (!blocked) {
        roomRuntime.inspectYaw += look.x * 1.6;
        roomRuntime.inspectPitch += look.y * 1.6;
        const turn = dt * 2.2;
        if (isDown('left')) roomRuntime.inspectYaw -= turn;
        if (isDown('right')) roomRuntime.inspectYaw += turn;
        if (isDown('forward')) roomRuntime.inspectPitch -= turn;
        if (isDown('back')) roomRuntime.inspectPitch += turn;
        roomRuntime.inspectPitch = Math.max(-1.4, Math.min(1.4, roomRuntime.inspectPitch));
        if (wasPressed('interact')) {
          audio.play('insert');
          roomRuntime.insertT = 0;
          room.set({ mode: 'inserting' });
        } else if (wasPressed('inspect') && p) openManual(p);
        else if (keys.pressed.has('KeyQ')) putBack();
      }
      prompt = `[E] Play on the TV   [I] Manual   [Q] Put back   ·   drag or WASD to turn it`;
    }

    if (room.mode === 'inserting') {
      roomRuntime.insertT += rawDt / INSERT_TIME;
      if (roomRuntime.insertT >= 1) {
        const p = room.heldId ? projectById(room.heldId) : undefined;
        room.set({ mode: 'crt', insertedId: room.heldId, heldId: null });
        clearInput();
        if (p) crt.insert(p);
        game.completeInteraction('game-inserted');
      }
    }

    // The TV always runs; it only gets the keyboard while you sit in front of it.
    const playing = room.mode === 'crt' && !blocked;
    crt.update(rawDt, playing ? keys : { held: EMPTY, pressed: EMPTY, click: false });
    if (room.mode === 'crt') prompt = crt.controls;
    keys.pressed.clear();
    keys.click = false;

    game.setPrompt(blocked ? null : prompt);
    debugInfo.player = [p.x, EYE, p.z];
    debugInfo.camera = [camera.position.x, camera.position.y, camera.position.z];
  });

  return null;
}

const EMPTY: ReadonlySet<string> = new Set();
