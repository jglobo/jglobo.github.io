// The family at home. Jose and his wife turn to face the visitor and wave; their
// son chases a ball across the front yard; the dog wanders, sits and wags, and
// follows you for a while after a pat.
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import { Mesh, MeshStandardMaterial, OctahedronGeometry, Sprite, SpriteMaterial } from 'three';
import { qualityProfile } from '../../stores/settingsStore';
import { useGame } from '../../stores/gameStore';
import { audio } from '../../engine/audio/AudioManager';
import type { Kit } from './Buildings';
import { journeyRuntime, useJourney } from './journeyStore';
import { KID_LANE, YARD, collide, type TownLayout } from './layout';
import { DOG_FRAMES, DOG_H, DOG_LOOK, DOG_W, HUMAN_FRAMES, HUMAN_H, HUMAN_W, LOOKS, dogAtlas, humanAtlas, type HumanLook } from './sprites/pixelArt';
import { PixelSprite, type SpriteState } from './sprites/PixelSprite';
import { heartTexture } from './textures';
import { useOwned } from './useOwned';

const F = (name: (typeof HUMAN_FRAMES)[number]) => HUMAN_FRAMES.indexOf(name);

/** Jose or his wife: stands by the porch, turns toward the visitor, waves hello. */
export function PersonNpc({ id, look, spot, kit, marker }: { id: string; look: HumanLook; spot: { x: number; z: number }; kit: Kit; marker?: string }) {
  const atlas = useMemo(() => humanAtlas(look), [look]);
  const state = useMemo<SpriteState>(() => ({ x: spot.x, y: 0, z: spot.z, frame: 0, flip: false, visible: true }), [spot]);
  const talkTime = useRef(0);
  const greet = useRef(0);
  const wasNear = useRef(false);
  const markerRef = useRef<Mesh>(null);
  const markerGeo = useOwned(() => new OctahedronGeometry(0.22, 0));
  const showMarker = useGame((s) => !!marker && !s.completedInteractions.includes(marker));
  const phase = useMemo(() => spot.x * 1.7, [spot]);

  useFrame((st, dt) => {
    const dx = journeyRuntime.x - spot.x;
    const dz = journeyRuntime.z - spot.z;
    const near = Math.hypot(dx, dz) < 7;
    const talking = useGame.getState().overlay === 'dialogue' && useJourney.getState().talking === id;
    if (near && !wasNear.current) greet.current = 1.6; // wave hello when the visitor walks up
    wasNear.current = near;
    greet.current = Math.max(0, greet.current - dt);
    talkTime.current = talking ? talkTime.current + dt : 0;
    const waving = (talking && talkTime.current < 1.4) || greet.current > 0;
    const t = st.clock.elapsedTime;
    if (waving) {
      state.frame = Math.floor(t * 4) % 2 ? F('wave') : F('down0');
      state.flip = false;
    } else if (near && !talking && Math.abs(dx) > Math.abs(dz) * 1.3) {
      state.frame = F('side0');
      state.flip = dx < 0;
    } else if (near && !talking && dz < -1) {
      state.frame = F('up0');
      state.flip = false;
    } else {
      state.frame = F('down0');
      state.flip = false;
    }
    // A gentle breathing bob.
    state.y = Math.max(0, Math.sin(t * 2.2 + phase)) * 0.02;
    if (markerRef.current) {
      markerRef.current.rotation.y = t * 2;
      markerRef.current.position.y = 2.35 + Math.sin(t * 3) * 0.08;
    }
  });

  return (
    <>
      <PixelSprite atlas={atlas} frames={HUMAN_FRAMES.length} pxW={HUMAN_W} pxH={HUMAN_H} state={state} />
      {showMarker && <mesh ref={markerRef} geometry={markerGeo} material={kit.lampGlow} position={[spot.x, 2.35, spot.z]} />}
    </>
  );
}

export interface KidBrain { x: number; z: number; ballX: number; ballV: number; dir: 1 | -1; dist: number }
export const makeKid = (): KidBrain => ({ x: KID_LANE.x0 + 1, z: KID_LANE.z, ballX: KID_LANE.x0 + 2.5, ballV: 3.2, dir: 1, dist: 0 });

/** Jose's son, running back and forth across the front yard after his ball. */
export function Kid({ kid, kit }: { kid: KidBrain; kit: Kit }) {
  const atlas = useMemo(() => humanAtlas(LOOKS.son), []);
  const state = useMemo<SpriteState>(() => ({ x: kid.x, y: 0, z: kid.z, frame: 0, flip: false, visible: true }), [kid]);
  const ball = useRef<Mesh>(null);
  const ballMat = useOwned(() => new MeshStandardMaterial({ color: '#e8453c', roughness: 0.5 }));
  const spin = useRef(0);

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    // The ball rolls and slows down; the boy runs after it and kicks it back.
    kid.ballX += kid.ballV * dt;
    kid.ballV *= Math.pow(0.55, dt);
    if (kid.ballX < KID_LANE.x0 || kid.ballX > KID_LANE.x1) {
      kid.ballX = Math.max(KID_LANE.x0, Math.min(KID_LANE.x1, kid.ballX));
      kid.ballV *= -0.5;
    }
    spin.current += kid.ballV * dt * 3;
    const gap = kid.ballX - kid.x;
    const target = kid.ballX - Math.sign(gap || 1) * 0.45;
    const speed = Math.min(3.6, Math.abs(target - kid.x) * 4);
    const step = Math.sign(target - kid.x) * Math.min(Math.abs(target - kid.x), speed * dt);
    kid.x += step;
    kid.dist += Math.abs(step);
    if (Math.abs(step) > 1e-3) kid.dir = step > 0 ? 1 : -1;
    if (Math.abs(gap) < 0.6 && Math.abs(kid.ballV) < 0.8) {
      // Kick toward whichever end of the yard is farther away.
      const towardEnd = kid.ballX - KID_LANE.x0 > KID_LANE.x1 - kid.ballX ? -1 : 1;
      kid.ballV = towardEnd * (3.4 + Math.random() * 1.6);
      audio.play('click');
    }
    const running = Math.abs(step) > 1e-3;
    state.x = kid.x;
    state.z = kid.z;
    state.flip = kid.dir < 0;
    state.frame = running ? F(`side${[1, 0, 2, 0][Math.floor(kid.dist / 0.28) % 4]}` as (typeof HUMAN_FRAMES)[number]) : F('down0');
    state.y = running ? Math.abs(Math.sin(kid.dist * 9)) * 0.05 : 0;
    if (ball.current) {
      ball.current.position.set(kid.ballX, 0.16, kid.z + 0.25);
      ball.current.rotation.z = -spin.current;
    }
  });

  return (
    <>
      <PixelSprite atlas={atlas} frames={HUMAN_FRAMES.length} pxW={HUMAN_W} pxH={HUMAN_H} state={state} scale={0.68} shadowSize={0.6} />
      <mesh ref={ball} geometry={kit.ball} material={ballMat} scale={0.32} castShadow={qualityProfile().shadows} />
    </>
  );
}

export interface DogBrain {
  x: number;
  z: number;
  mode: 'walk' | 'sit';
  tx: number;
  tz: number;
  timer: number;
  follow: number;
  dist: number;
  /** Set by the controller when the visitor pets the dog. */
  petted: boolean;
}

export const makeDog = (): DogBrain => ({ x: -8.5, z: 6.6, mode: 'sit', tx: -8.5, tz: 6.6, timer: 2, follow: 0, dist: 0, petted: false });

export function Dog({ dog, layout }: { dog: DogBrain; layout: TownLayout }) {
  const atlas = useMemo(() => dogAtlas(DOG_LOOK), []);
  const state = useMemo<SpriteState>(() => ({ x: dog.x, y: 0, z: dog.z, frame: 3, flip: false, visible: true }), [dog]);
  const hearts = useRef<(Sprite | null)[]>([]);
  const heartLife = useRef<number[]>([0, 0, 0, 0, 0]);
  const heart = useOwned(() => {
    const map = heartTexture();
    return { map, mats: [0, 1, 2, 3, 4].map(() => new SpriteMaterial({ map, transparent: true, depthWrite: false })) };
  });
  const yip = useRef(0);

  useFrame((st, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    if (dog.petted) {
      dog.petted = false;
      dog.follow = 25;
      heartLife.current = heartLife.current.map((_, i) => 1.4 + i * 0.12);
      audio.play('woof');
    }
    let speed = 0;
    if (dog.follow > 0) {
      dog.follow -= dt;
      // Trot after the visitor, keeping a polite distance.
      const dx = journeyRuntime.x - dog.x;
      const dz = journeyRuntime.z + 0.6 - dog.z;
      const d = Math.hypot(dx, dz);
      dog.mode = d > 1.7 ? 'walk' : 'sit';
      if (dog.mode === 'walk') {
        speed = Math.min(journeyRuntime.running ? 7.4 : 5, d * 2.2);
        dog.tx = journeyRuntime.x;
        dog.tz = journeyRuntime.z;
      }
      yip.current -= dt;
      if (journeyRuntime.running && d > 4 && yip.current <= 0) {
        audio.play('woof');
        yip.current = 6;
      }
      if (dog.follow <= 0) {
        dog.mode = 'walk';
        dog.tx = (YARD.minX + YARD.maxX) / 2;
        dog.tz = (YARD.minZ + YARD.maxZ) / 2;
      }
    } else {
      dog.timer -= dt;
      const d = Math.hypot(dog.tx - dog.x, dog.tz - dog.z);
      if (dog.mode === 'walk') {
        speed = 1.8;
        if (d < 0.3) {
          dog.mode = 'sit';
          dog.timer = 2 + Math.random() * 4;
        }
      } else if (dog.timer <= 0) {
        dog.mode = 'walk';
        dog.tx = YARD.minX + 1 + Math.random() * (YARD.maxX - YARD.minX - 2);
        dog.tz = YARD.minZ + 0.5 + Math.random() * (YARD.maxZ - YARD.minZ - 1);
      }
    }
    if (dog.mode === 'walk' && speed > 0) {
      const dx = dog.tx - dog.x;
      const dz = dog.tz - dog.z;
      const d = Math.hypot(dx, dz) || 1;
      const step = Math.min(d, speed * dt);
      const c = collide(layout, dog.x + (dx / d) * step, dog.z + (dz / d) * step, 0.35);
      dog.dist += Math.hypot(c.x - dog.x, c.z - dog.z);
      dog.x = c.x;
      dog.z = c.z;
      state.flip = dx < 0;
      state.frame = [1, 0, 2, 0][Math.floor(dog.dist / 0.3) % 4];
      if (c.hit && dog.follow <= 0) dog.timer = 0; // bumped into something: pick another spot
    } else {
      state.frame = DOG_FRAMES.indexOf(Math.floor(st.clock.elapsedTime * (dog.follow > 0 ? 6 : 2.5)) % 2 ? 'sit1' : 'sit0');
    }
    state.x = dog.x;
    state.z = dog.z;
    state.y = dog.mode === 'walk' ? Math.abs(Math.sin(dog.dist * 5)) * 0.05 : 0;

    hearts.current.forEach((h, i) => {
      if (!h) return;
      const life = (heartLife.current[i] = Math.max(0, heartLife.current[i] - dt));
      h.visible = life > 0 && life < 1.4;
      if (!h.visible) return;
      const p = 1 - life / 1.4;
      h.position.set(dog.x + Math.sin(i * 2.3 + p * 4) * 0.4, 0.9 + p * 1.4, dog.z + 0.1);
      heart.mats[i].opacity = Math.min(1, life * 2);
    });
  });

  return (
    <>
      <PixelSprite atlas={atlas} frames={DOG_FRAMES.length} pxW={DOG_W} pxH={DOG_H} state={state} shadowSize={1} />
      {heart.mats.map((m, i) => (
        <sprite key={i} ref={(s) => { hearts.current[i] = s; }} material={m} scale={[0.36, 0.32, 1]} visible={false} />
      ))}
    </>
  );
}
