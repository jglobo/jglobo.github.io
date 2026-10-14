// HD-2D character controller: moves the visitor's pixel sprite around the town,
// registers everything you can interact with, drives the portals and writes the
// navigation markers for the HUD.
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import { Vector3 } from 'three';
import { journey } from '../../content';
import { audio } from '../../engine/audio/AudioManager';
import { debugInfo } from '../../engine/debug/debugInfo';
import { isDown } from '../../engine/input/input';
import { updateInteractions, useInteractable, type Interactable } from '../../engine/interaction/interactions';
import { travelTo } from '../../engine/loading/travel';
import { gameplayBlocked, useGame } from '../../stores/gameStore';
import { useHud, type NavMarker } from '../../stores/hudStore';
import { journeyRuntime, useJourney } from './journeyStore';
import { JOSE_SPOT, MAILBOX, PORTAL_SPOT, SPAWN, collide, type TownLayout } from './layout';
import type { DogBrain } from './NPCs';
import { HUMAN_FRAMES, HUMAN_H, HUMAN_W, LOOKS, humanAtlas } from './sprites/pixelArt';
import { PixelSprite, type SpriteState } from './sprites/PixelSprite';

const WALK = 4.2;
const RUN = 6.8;
const RETURN_HOLD = 0.8;

export const CONTROLS = ['WASD: walk · Shift: run', 'E: talk / read a memory', 'Hold R: return portal', 'Tab: Quick Portfolio'];

export const plazaPortal = (layout: TownLayout) => ({ x: layout.plaza.x, z: layout.plaza.z - 5.5 });

export function openMemory(id: string) {
  useJourney.setState({ stop: id });
  const g = useGame.getState();
  g.openOverlay('journal');
  g.completeInteraction(`journey:${id}`);
  audio.play('page');
}

function Interact({ item }: { item: Interactable }) {
  useInteractable(item);
  return null;
}

export function JourneyController({
  layout,
  dog,
  returnPortal,
  onSummon,
}: {
  layout: TownLayout;
  dog: DogBrain;
  returnPortal: { x: number; z: number } | null;
  onSummon: (p: { x: number; z: number }) => void;
}) {
  const camera = useThree((s) => s.camera);
  const atlas = useMemo(() => humanAtlas(LOOKS.visitor), []);
  const sprite = useMemo<SpriteState>(() => ({ x: SPAWN.x, y: 0, z: SPAWN.z, frame: 0, flip: false, visible: true }), []);
  const me = useRef({ x: SPAWN.x, z: SPAWN.z, dir: 'down' as 'down' | 'up' | 'side', flip: false, dist: 0, speed: 0 });
  const player = useMemo(() => new Vector3(), []);
  const projected = useMemo(() => new Vector3(), []);
  const hold = useRef(0);
  const navTimer = useRef(0);
  const leaving = useRef(false);
  const exitPortal = useMemo(() => plazaPortal(layout), [layout]);

  const items = useMemo<Interactable[]>(() => {
    const at = (x: number, z: number) => {
      const v = new Vector3(x, 0, z);
      return () => v;
    };
    const dogPos = new Vector3();
    return [
      ...layout.stops.map((s) => {
        const stop = journey.stops.find((j) => j.id === s.id)!;
        return { id: `stop-${s.id}`, label: `[E] Remember: ${stop.label} (${stop.year})`, position: at(s.door.x, s.door.z), radius: 3.2, onInteract: () => openMemory(s.id) };
      }),
      {
        id: 'jose',
        label: '[E] Talk to Jose',
        position: at(JOSE_SPOT.x, JOSE_SPOT.z),
        radius: 2.6,
        onInteract: () => {
          useJourney.setState({ talking: 'jose' });
          useGame.getState().openOverlay('dialogue');
          useGame.getState().completeInteraction('journey:talk-jose');
        },
      },
      {
        id: 'dog',
        label: '[E] Pet the dog',
        // Once it is following you, the dog stops competing with doors for the E prompt.
        position: () => (dog.follow > 0 ? dogPos.set(1e6, 0, 1e6) : dogPos.set(dog.x, 0, dog.z)),
        radius: 1.9,
        onInteract: () => {
          dog.petted = true;
          const lines = journey.npcs.find((n) => n.id === 'dog')?.lines ?? [];
          const g = useGame.getState();
          g.setHint(lines[Math.floor(Math.random() * lines.length)] ?? 'Woof!');
          g.completeInteraction('journey:pet-dog');
          setTimeout(() => useGame.getState().setHint(null), 3500);
        },
      },
      {
        id: 'mailbox',
        label: '[E] Check the mailbox',
        position: at(MAILBOX.x, MAILBOX.z),
        radius: 1.8,
        onInteract: () => {
          audio.play('page');
          useGame.getState().openOverlay('quick', 'contact');
          useGame.setState({ notice: "You've got mail! Here is how to reach Jose." });
        },
      },
      {
        id: 'today',
        label: '[E] Today: this portfolio',
        position: at(layout.plaza.x, layout.plaza.z + 1.6),
        radius: 3.4,
        onInteract: () => useGame.getState().openProject('portal-hub'),
      },
    ];
  }, [layout, dog]);

  useEffect(() => {
    journeyRuntime.x = SPAWN.x;
    journeyRuntime.z = SPAWN.z;
    journeyRuntime.time = 0;
    journeyRuntime.focus = null;
  }, []);

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    journeyRuntime.time += rawDt;
    const blocked = gameplayBlocked();
    const p = me.current;

    // Screen-relative movement: the camera always looks north.
    let mx = 0;
    let mz = 0;
    if (!blocked) {
      if (isDown('forward')) mz -= 1;
      if (isDown('back')) mz += 1;
      if (isDown('right')) mx += 1;
      if (isDown('left')) mx -= 1;
    }
    const len = Math.hypot(mx, mz);
    const running = isDown('sprint');
    const target = len ? (running ? RUN : WALK) : 0;
    p.speed += (target - p.speed) * Math.min(1, dt * 12);
    if (len) {
      mx /= len;
      mz /= len;
      if (Math.abs(mx) > Math.abs(mz) * 1.05) {
        p.dir = 'side';
        p.flip = mx < 0;
      } else p.dir = mz < 0 ? 'up' : 'down';
      const c = collide(layout, p.x + mx * p.speed * dt, p.z + mz * p.speed * dt, 0.38);
      p.dist += Math.hypot(c.x - p.x, c.z - p.z);
      p.x = c.x;
      p.z = c.z;
    }
    const moving = len > 0 && p.speed > 0.5;
    const step = moving ? [1, 0, 2, 0][Math.floor(p.dist / (running ? 0.55 : 0.42)) % 4] : 0;
    sprite.frame = HUMAN_FRAMES.indexOf(`${p.dir}${step}` as (typeof HUMAN_FRAMES)[number]);
    sprite.flip = p.dir === 'side' && p.flip;
    sprite.x = p.x;
    sprite.z = p.z;
    sprite.y = moving ? Math.abs(Math.sin(p.dist * (running ? 5.7 : 7.4))) * 0.05 : 0;
    journeyRuntime.x = p.x;
    journeyRuntime.z = p.z;
    journeyRuntime.moving = moving;
    journeyRuntime.running = moving && running;

    // Frame the building whose door the visitor is standing at.
    let focus: { x: number; z: number } | null = null;
    for (const s of layout.stops) {
      if (Math.hypot(s.door.x - p.x, s.door.z - p.z) < 4.5) focus = { x: s.cx, z: s.door.z };
    }
    journeyRuntime.focus = focus;

    player.set(p.x, 0, p.z);
    updateInteractions(player, !blocked);

    // Portals: the arrival portal by the house, the one at the plaza, a summoned one.
    const near = (q: { x: number; z: number }) => Math.abs(p.x - q.x) < 1.2 && Math.abs(p.z - q.z) < 0.7;
    if (!blocked && !leaving.current && (near(PORTAL_SPOT) || near(exitPortal) || (returnPortal && near(returnPortal)))) {
      leaving.current = true;
      void travelTo('hub');
    }
    if (!blocked && isDown('returnPortal') && !returnPortal) {
      hold.current += Math.min(rawDt, 0.2);
      if (hold.current >= RETURN_HOLD) {
        hold.current = 0;
        const fx = p.dir === 'side' ? (p.flip ? -1 : 1) : 0;
        const fz = p.dir === 'up' ? -1 : p.dir === 'down' ? 1 : 0;
        const spot = collide(layout, p.x + fx * 4, p.z + fz * 4, 1.4);
        onSummon({ x: spot.x, z: spot.z });
        audio.play('summon');
        useGame.getState().setHint('Walk through the portal to return to the Hub');
      }
    } else hold.current = Math.max(0, hold.current - dt * 2);

    // Navigation: the next chapter you have not visited, plus anything close by.
    navTimer.current += dt;
    if (navTimer.current > 0.1) {
      navTimer.current = 0;
      const done = useGame.getState().completedInteractions;
      const next = layout.stops.find((s) => !done.includes(`journey:${s.id}`));
      const targets: { id: string; label: string; x: number; z: number; seen: boolean }[] = [];
      for (const s of layout.stops) {
        const d = Math.hypot(s.door.x - p.x, s.door.z - p.z);
        const stop = journey.stops.find((j) => j.id === s.id)!;
        // Close enough to read the building's own sign: no marker needed.
        if (d > 7 && (s === next || d < 22)) targets.push({ id: s.id, label: `${stop.label} · ${stop.year}`, x: s.door.x, z: s.door.z - 2, seen: done.includes(`journey:${s.id}`) });
      }
      if (!done.includes('journey:talk-jose') && Math.hypot(JOSE_SPOT.x - p.x, JOSE_SPOT.z - p.z) < 40) targets.push({ id: 'jose', label: 'Jose', x: JOSE_SPOT.x, z: JOSE_SPOT.z, seen: false });
      if (!next) targets.push({ id: 'today', label: 'Today', x: layout.plaza.x, z: layout.plaza.z, seen: false });
      const markers: NavMarker[] = targets.map((t) => {
        projected.set(t.x, 3.2, t.z).project(camera);
        const onScreen = Math.abs(projected.x) < 0.9 && Math.abs(projected.y) < 0.85 && projected.z < 1;
        const angle = Math.atan2(-(t.z - p.z), t.x - p.x);
        let x = (projected.x + 1) / 2;
        let y = (1 - projected.y) / 2;
        if (!onScreen) {
          const dx = Math.cos(angle);
          const dy = -Math.sin(angle);
          const k = Math.min(0.44 / Math.max(Math.abs(dx), 1e-6), 0.42 / Math.max(Math.abs(dy), 1e-6));
          x = 0.5 + dx * k;
          y = 0.5 + dy * k;
        }
        return { id: t.id, label: t.label, symbol: '❖', x, y, angle, distance: Math.hypot(t.x - p.x, t.z - p.z), onScreen, discovered: t.seen };
      });
      useHud.setState({ markers, returnCharge: hold.current / RETURN_HOLD });

      if (!next && !done.includes('journey:complete')) {
        useGame.getState().completeInteraction('journey:complete');
        useGame.getState().setHint('Time traveler: you have walked the whole timeline. Today is at the end of the road.');
        audio.play('trick');
        setTimeout(() => useGame.getState().setHint(null), 6000);
      }
    }

    debugInfo.player = [p.x, 0, p.z];
  });

  return (
    <>
      {items.map((item) => (
        <Interact key={item.id} item={item} />
      ))}
      <PixelSprite atlas={atlas} frames={HUMAN_FRAMES.length} pxW={HUMAN_W} pxH={HUMAN_H} state={sprite} />
    </>
  );
}
