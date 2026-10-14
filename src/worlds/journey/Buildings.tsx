// Timeline buildings. Each style is a small diorama made of primitives and pixel
// textures, so the town changes character as the visitor walks forward in time:
// brick college, island clinic, market, lab, library, office, glass tower.
import { useFrame } from '@react-three/fiber';
import { useRef, type ReactNode } from 'react';
import { BoxGeometry, CylinderGeometry, Group, Mesh, MeshStandardMaterial, PlaneGeometry, RepeatWrapping, SphereGeometry, TorusGeometry, type Texture } from 'three';
import type { JourneyStop } from '../../content';
import { qualityProfile } from '../../stores/settingsStore';
import { prismGeometry, pyramidGeometry } from './geometry';
import type { StopPlacement } from './layout';
import {
  brickTexture, glassTiles, plasterTexture, shingleTexture, signTexture, stripeTexture, windowTiles,
} from './textures';
import { useOwned } from './useOwned';

/** Shared props and materials, created once for the whole town. */
export function useKit() {
  return useOwned(() => ({
    box: new BoxGeometry(1, 1, 1),
    cyl: new CylinderGeometry(0.5, 0.5, 1, 10),
    ball: new SphereGeometry(0.5, 10, 8),
    plane: new PlaneGeometry(1, 1),
    torus: new TorusGeometry(1, 0.06, 6, 40),
    trim: new MeshStandardMaterial({ color: '#f3ead8', roughness: 0.8 }),
    wood: new MeshStandardMaterial({ color: '#6b4128', roughness: 0.9 }),
    darkWood: new MeshStandardMaterial({ color: '#45291a', roughness: 0.9 }),
    crate: new MeshStandardMaterial({ color: '#b58a52', roughness: 0.9 }),
    cardboard: new MeshStandardMaterial({ color: '#c9a06a', roughness: 1 }),
    iron: new MeshStandardMaterial({ color: '#2f2a2a', roughness: 0.6, metalness: 0.4 }),
    concrete: new MeshStandardMaterial({ color: '#c8c2b8', roughness: 1 }),
    steel: new MeshStandardMaterial({ color: '#9aa4b0', roughness: 0.4, metalness: 0.5 }),
    lampGlow: new MeshStandardMaterial({ color: '#ffd38a', emissive: '#ffb347', emissiveIntensity: 2.2 }),
    redGlow: new MeshStandardMaterial({ color: '#ff5040', emissive: '#ff2a1a', emissiveIntensity: 2.5 }),
    holo: new MeshStandardMaterial({ color: '#7fe3ff', emissive: '#3fc8ff', emissiveIntensity: 1.6, transparent: true, opacity: 0.75 }),
    produce: ['#e2482f', '#f29a2e', '#7dbb3c', '#f2d23c'].map((c) => new MeshStandardMaterial({ color: c, roughness: 0.6 })),
  }));
}
export type Kit = ReturnType<typeof useKit>;

type V3 = [number, number, number];

/** A box from the kit's unit cube. */
function B({ kit, p, s, m, shadow = true }: { kit: Kit; p: V3; s: V3; m: MeshStandardMaterial; shadow?: boolean }) {
  const cast = qualityProfile().shadows && shadow;
  return <mesh geometry={kit.box} material={m} position={p} scale={s} castShadow={cast} receiveShadow />;
}

function Cyl({ kit, p, r, h, m }: { kit: Kit; p: V3; r: number; h: number; m: MeshStandardMaterial }) {
  return <mesh geometry={kit.cyl} material={m} position={p} scale={[r * 2, h, r * 2]} castShadow={qualityProfile().shadows} />;
}

/** Wall material with window tiles that glow at dusk. */
function useWalls(wall: string, frame: string, lit: number, seed: number, w: number, h: number, d: number, arch = false) {
  return useOwned(() => {
    const cols = Math.max(1, Math.round(w / 2.2));
    const rows = Math.max(1, Math.round(h / 2.4));
    const front = windowTiles(wall, frame, lit, seed, cols, rows, arch);
    const side = windowTiles(wall, frame, lit * 0.6, seed + 1, Math.max(1, Math.round(d / 2.2)), rows, arch);
    const mat = (t: { color: Texture; glow: Texture }) =>
      new MeshStandardMaterial({ map: t.color, emissive: '#ffffff', emissiveMap: t.glow, emissiveIntensity: 0.9, roughness: 0.9 });
    const frontMat = mat(front);
    const sideMat = mat(side);
    return { front, side, frontMat, sideMat, dispose: () => [front.color, front.glow, side.color, side.glow, frontMat, sideMat].forEach((x) => x.dispose()) };
  }, [wall, frame, lit, seed, w, h, d, arch]);
}

/** Box body with window walls on the sides and front, plain top and back. */
function Body({ kit, cx, cz, w, h, d, y = 0, walls, roofMat }: {
  kit: Kit; cx: number; cz: number; w: number; h: number; d: number; y?: number;
  walls: ReturnType<typeof useWalls>; roofMat: MeshStandardMaterial;
}) {
  const cast = qualityProfile().shadows;
  // BoxGeometry face order: +x, -x, +y, -y, +z, -z.
  const mats = [walls.sideMat, walls.sideMat, roofMat, roofMat, walls.frontMat, walls.sideMat];
  return <mesh geometry={kit.box} material={mats} position={[cx, y + h / 2, cz]} scale={[w, h, d]} castShadow={cast} receiveShadow />;
}

function Door({ kit, x, z, w = 1.3, h = 2.1 }: { kit: Kit; x: number; z: number; w?: number; h?: number }) {
  return (
    <group position={[x, 0, z]}>
      <mesh geometry={kit.box} material={kit.darkWood} position={[0, h / 2, 0.04]} scale={[w, h, 0.12]} />
      <mesh geometry={kit.box} material={kit.trim} position={[0, h + 0.08, 0.05]} scale={[w + 0.3, 0.16, 0.16]} />
      <mesh geometry={kit.ball} material={kit.lampGlow} position={[w / 2 + 0.35, h - 0.2, 0.18]} scale={0.22} />
    </group>
  );
}

export function Sign({ kit, title, sub, p, width = 3.4, bg, fg, accent }: { kit: Kit; title: string; sub: string; p: V3; width?: number; bg?: string; fg?: string; accent?: string }) {
  const tex = useOwned(() => signTexture(title, sub, { bg, fg, accent }), [title, sub, bg, fg, accent]);
  const mat = useOwned(() => new MeshStandardMaterial({ map: tex, emissive: '#ffffff', emissiveMap: tex, emissiveIntensity: 0.35, roughness: 0.8 }), [tex]);
  return <mesh geometry={kit.plane} material={mat} position={p} scale={[width, width * 0.3125, 1]} />;
}

interface BuildingProps { kit: Kit; place: StopPlacement; stop: JourneyStop }

export function Building(props: BuildingProps) {
  switch (props.place.building) {
    case 'campus': return <Campus {...props} />;
    case 'clinic': return <Clinic {...props} />;
    case 'market': return <Market {...props} />;
    case 'lab': return <Lab {...props} />;
    case 'library': return <Library {...props} />;
    case 'office': return <Office {...props} />;
    case 'tower': return <Tower {...props} />;
  }
}

function useRoof(kind: 'shingle' | 'plaster', color: string, rx = 1, ry = 1) {
  return useOwned(() => {
    const map = kind === 'shingle' ? shingleTexture(color, rx, ry) : plasterTexture(color, rx, ry, 9);
    return { map, mat: new MeshStandardMaterial({ map, roughness: 0.9 }) };
  }, [kind, color, rx, ry]);
}

const front = (p: StopPlacement) => p.cz + p.d / 2;

function Frame({ place, stop, kit, children, signY, signColors }: BuildingProps & { children: ReactNode; signY: number; signColors?: { bg?: string; fg?: string; accent?: string } }) {
  return (
    <group>
      {children}
      <Door kit={kit} x={place.cx} z={front(place)} />
      <Sign kit={kit} title={stop.label} sub={stop.year} p={[place.cx, signY, front(place) + 0.12]} {...signColors} />
    </group>
  );
}

function Campus(props: BuildingProps) {
  const { kit, place: p } = props;
  const walls = useWalls('#9c4a36', '#efe6d2', 0.55, 21, p.w, p.h, p.d);
  const roof = useRoof('shingle', '#4d4a58');
  const brick = useOwned(() => {
    const map = brickTexture('#9c4a36', 3, 3);
    return { map, mat: new MeshStandardMaterial({ map, roughness: 0.9 }) };
  });
  const pediment = useOwned(() => prismGeometry(5.6, 1.2, 1.2));
  const tower = useOwned(() => pyramidGeometry(2.2, 1.8, 2.2));
  const f = front(p);
  return (
    <Frame {...props} signY={4.15}>
      <Body kit={kit} cx={p.cx} cz={p.cz} w={p.w} h={p.h} d={p.d} walls={walls} roofMat={roof.mat} />
      {/* Portico: steps, four columns and a pediment. */}
      <B kit={kit} p={[p.cx, 0.15, f + 1.3]} s={[6.2, 0.3, 2.6]} m={kit.trim} />
      {[-2.2, -0.75, 0.75, 2.2].map((dx) => (
        <Cyl key={dx} kit={kit} p={[p.cx + dx, 1.9, f + 2.1]} r={0.22} h={3.2} m={kit.trim} />
      ))}
      <B kit={kit} p={[p.cx, 3.6, f + 1.3]} s={[5.6, 0.3, 2.4]} m={kit.trim} />
      <mesh geometry={pediment} material={kit.trim} position={[p.cx, 3.75, f + 2.0]} scale={[1, 0.8, 0.9]} />
      {/* Clock tower. */}
      <B kit={kit} p={[p.cx, p.h + 1.2, p.cz]} s={[2, 2.4, 2]} m={brick.mat} />
      <mesh geometry={tower} material={roof.mat} position={[p.cx, p.h + 2.4, p.cz]} castShadow={qualityProfile().shadows} />
      <mesh geometry={kit.cyl} material={kit.trim} position={[p.cx, p.h + 1.4, p.cz + 1.02]} rotation-x={Math.PI / 2} scale={[1.1, 0.06, 1.1]} />
      <mesh geometry={kit.box} material={kit.iron} position={[p.cx, p.h + 1.55, p.cz + 1.08]} scale={[0.06, 0.4, 0.02]} />
    </Frame>
  );
}

function Palm({ kit, x, z, s = 1, leaf }: { kit: Kit; x: number; z: number; s?: number; leaf: MeshStandardMaterial }) {
  return (
    <group position={[x, 0, z]} scale={s}>
      {[0, 1, 2, 3, 4].map((i) => (
        <Cyl key={i} kit={kit} p={[i * 0.08, 0.5 + i * 0.9, 0]} r={0.16 - i * 0.015} h={0.95} m={kit.wood} />
      ))}
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <mesh key={i} geometry={kit.box} material={leaf} position={[0.4, 4.6, 0]} rotation={[0, (i / 6) * Math.PI * 2, -0.35]} scale={[2.4, 0.06, 0.5]} castShadow={qualityProfile().shadows} />
      ))}
    </group>
  );
}

function Clinic(props: BuildingProps) {
  const { kit, place: p } = props;
  const walls = useWalls('#f2ece0', '#2f8f8a', 0.5, 33, p.w, p.h, p.d, true);
  const roof = useRoof('shingle', '#2f8f8a');
  const hip = useOwned(() => pyramidGeometry(p.w + 0.8, 2, p.d + 0.8), [p.w, p.d]);
  const leaf = useOwned(() => new MeshStandardMaterial({ color: '#4f9a3a', roughness: 0.8 }));
  const f = front(p);
  return (
    <Frame {...props} signY={3.1} signColors={{ bg: '#2f8f8a', accent: '#f7e3a1' }}>
      <Body kit={kit} cx={p.cx} cz={p.cz} w={p.w} h={p.h} d={p.d} walls={walls} roofMat={roof.mat} />
      <mesh geometry={hip} material={roof.mat} position={[p.cx, p.h, p.cz]} castShadow={qualityProfile().shadows} />
      <B kit={kit} p={[p.cx, 0.1, f + 0.9]} s={[3.2, 0.2, 1.8]} m={kit.trim} />
      <Palm kit={kit} x={p.cx - p.w / 2 - 1.2} z={f + 1} leaf={leaf} />
      <Palm kit={kit} x={p.cx + p.w / 2 + 1.4} z={f + 0.4} s={1.15} leaf={leaf} />
      <Palm kit={kit} x={p.cx + p.side * (p.w / 2 + 6)} z={p.cz - 2.5} s={0.9} leaf={leaf} />
    </Frame>
  );
}

function Market(props: BuildingProps) {
  const { kit, place: p } = props;
  const walls = useWalls('#efe0bf', '#7a4a2a', 0.6, 45, p.w, p.h, p.d);
  const roof = useRoof('plaster', '#8a5a3a');
  const awning = useOwned(() => {
    const map = stripeTexture('#e8553f', '#fbf1dc');
    map.repeat.set(4, 1);
    map.wrapS = RepeatWrapping;
    return { map, mat: new MeshStandardMaterial({ map, roughness: 0.9 }) };
  });
  const f = front(p);
  const crates = [-3.4, -2.2, 2.2, 3.4];
  return (
    <Frame {...props} signY={3.75} signColors={{ bg: '#2e5a3a' }}>
      <Body kit={kit} cx={p.cx} cz={p.cz} w={p.w} h={p.h} d={p.d} walls={walls} roofMat={roof.mat} />
      <B kit={kit} p={[p.cx, p.h + 0.3, p.cz]} s={[p.w + 0.2, 0.6, p.d + 0.2]} m={roof.mat} />
      <mesh geometry={kit.box} material={awning.mat} position={[p.cx, 2.75, f + 0.8]} rotation-x={0.45} scale={[p.w - 0.4, 0.08, 1.8]} castShadow={qualityProfile().shadows} />
      {crates.map((dx, i) => (
        <group key={dx} position={[p.cx + dx, 0, f + 1.2]}>
          <B kit={kit} p={[0, 0.35, 0]} s={[0.9, 0.7, 0.7]} m={kit.crate} />
          <B kit={kit} p={[0, 0.78, 0]} s={[0.78, 0.16, 0.58]} m={kit.produce[i % kit.produce.length]} shadow={false} />
        </group>
      ))}
      {/* Fulfillment corner: a pallet of boxes (the warehouse years). */}
      <group position={[p.cx - p.side * (p.w / 2 + 1.6), 0, f - 1.2]}>
        <B kit={kit} p={[0, 0.08, 0]} s={[1.6, 0.16, 1.6]} m={kit.wood} />
        {[[-0.4, -0.4], [0.4, -0.4], [-0.4, 0.4], [0.4, 0.4]].map(([x, z]) => (
          <B key={`${x}${z}`} kit={kit} p={[x, 0.5, z]} s={[0.74, 0.66, 0.74]} m={kit.cardboard} />
        ))}
        <B kit={kit} p={[0, 1.15, 0]} s={[0.74, 0.62, 0.74]} m={kit.cardboard} />
      </group>
    </Frame>
  );
}

function Lab(props: BuildingProps) {
  const { kit, place: p } = props;
  const walls = useWalls('#e9eef2', '#3f6fa8', 0.55, 57, p.w, p.h, p.d);
  const roof = useRoof('plaster', '#b7bfc8');
  const band = useOwned(() => new MeshStandardMaterial({ color: '#3f6fa8', roughness: 0.6 }));
  const f = front(p);
  return (
    <Frame {...props} signY={3.6} signColors={{ bg: '#3f6fa8', accent: '#cfe6ff' }}>
      <Body kit={kit} cx={p.cx} cz={p.cz} w={p.w} h={p.h} d={p.d} walls={walls} roofMat={roof.mat} />
      <B kit={kit} p={[p.cx, 2.45, f + 0.03]} s={[p.w + 0.05, 0.35, 0.1]} m={band} shadow={false} />
      <B kit={kit} p={[p.cx - 2, p.h + 0.45, p.cz - 0.5]} s={[1.6, 0.9, 1.4]} m={kit.steel} />
      <B kit={kit} p={[p.cx + 2.2, p.h + 0.35, p.cz + 0.6]} s={[1.2, 0.7, 1.2]} m={kit.steel} />
      <B kit={kit} p={[p.cx, 0.1, f + 0.9]} s={[2.8, 0.2, 1.6]} m={kit.concrete} />
    </Frame>
  );
}

function Library(props: BuildingProps) {
  const { kit, place: p } = props;
  const walls = useWalls('#b9ad98', '#5a4a3a', 0.65, 69, p.w, p.h, p.d, true);
  const roof = useRoof('shingle', '#3d4a5c');
  const gable = useOwned(() => prismGeometry(p.w + 0.6, 2.4, p.d + 0.8), [p.w, p.d]);
  const f = front(p);
  return (
    <Frame {...props} signY={4.3} signColors={{ bg: '#3d4a5c', accent: '#ffd27a' }}>
      <Body kit={kit} cx={p.cx} cz={p.cz} w={p.w} h={p.h} d={p.d} walls={walls} roofMat={roof.mat} />
      <mesh geometry={gable} material={roof.mat} position={[p.cx, p.h, p.cz]} castShadow={qualityProfile().shadows} />
      <B kit={kit} p={[p.cx, 0.12, f + 0.9]} s={[3.4, 0.24, 1.8]} m={kit.concrete} />
      {/* Notice board with the certificates pinned to it. */}
      <group position={[p.cx - p.side * 3.2, 0, f + 1.6]}>
        <B kit={kit} p={[-0.7, 0.7, 0]} s={[0.12, 1.4, 0.12]} m={kit.wood} />
        <B kit={kit} p={[0.7, 0.7, 0]} s={[0.12, 1.4, 0.12]} m={kit.wood} />
        <B kit={kit} p={[0, 1.35, 0]} s={[1.7, 0.9, 0.08]} m={kit.crate} />
        {[-0.5, 0, 0.5].map((x, i) => (
          <B key={x} kit={kit} p={[x, 1.38 + (i % 2) * 0.1, 0.06]} s={[0.36, 0.42, 0.02]} m={kit.trim} shadow={false} />
        ))}
      </group>
    </Frame>
  );
}

function Office(props: BuildingProps) {
  const { kit, place: p } = props;
  const walls = useWalls('#c9c1b4', '#4a5a6a', 0.6, 81, p.w, p.h, p.d);
  const roof = useRoof('plaster', '#8e959c');
  const f = front(p);
  return (
    <Frame {...props} signY={3.3} signColors={{ bg: '#24313f', accent: '#8fd3ff' }}>
      <Body kit={kit} cx={p.cx} cz={p.cz} w={p.w} h={p.h} d={p.d} walls={walls} roofMat={roof.mat} />
      <B kit={kit} p={[p.cx, p.h + 0.25, p.cz]} s={[p.w + 0.3, 0.5, p.d + 0.3]} m={kit.concrete} />
      <B kit={kit} p={[p.cx, 2.55, f + 0.9]} s={[3.6, 0.16, 1.8]} m={kit.steel} />
      <B kit={kit} p={[p.cx - 1.6, 1.25, f + 1.7]} s={[0.1, 2.5, 0.1]} m={kit.steel} />
      <B kit={kit} p={[p.cx + 1.6, 1.25, f + 1.7]} s={[0.1, 2.5, 0.1]} m={kit.steel} />
    </Frame>
  );
}

function Tower(props: BuildingProps) {
  const { kit, place: p } = props;
  const glass = useOwned(() => {
    const g = glassTiles(93, 12, 24);
    const mat = new MeshStandardMaterial({ map: g.color, emissive: '#ffffff', emissiveMap: g.glow, emissiveIntensity: 0.8, roughness: 0.25, metalness: 0.35 });
    return { ...g, mat, dispose: () => [g.color, g.glow, mat].forEach((x) => x.dispose()) };
  });
  const ring = useRef<Group>(null);
  const beacon = useRef<Mesh>(null);
  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (ring.current) ring.current.rotation.y = t * 0.4;
    if (beacon.current) beacon.current.visible = Math.sin(t * 3) > 0;
  });
  const f = front(p);
  const lobby = 3.2;
  return (
    <Frame {...props} signY={2.75} signColors={{ bg: '#1d2a3f', accent: '#7fe3ff' }}>
      <B kit={kit} p={[p.cx, lobby / 2, p.cz]} s={[p.w, lobby, p.d]} m={kit.concrete} />
      <mesh geometry={kit.box} material={glass.mat} position={[p.cx, lobby + (p.h - lobby) / 2, p.cz]} scale={[p.w - 0.6, p.h - lobby, p.d - 0.6]} castShadow={qualityProfile().shadows} receiveShadow />
      <B kit={kit} p={[p.cx, p.h + 0.2, p.cz]} s={[p.w - 0.2, 0.4, p.d - 0.2]} m={kit.steel} />
      <B kit={kit} p={[p.cx, p.h + 1.6, p.cz]} s={[0.12, 2.8, 0.12]} m={kit.iron} />
      <mesh ref={beacon} geometry={kit.ball} material={kit.redGlow} position={[p.cx, p.h + 3.05, p.cz]} scale={0.3} />
      {/* Data rings orbiting the top: a nod to the data science work done here. */}
      <group ref={ring} position={[p.cx, p.h - 2, p.cz]}>
        <mesh geometry={kit.torus} material={kit.holo} rotation-x={Math.PI / 2} scale={p.w * 0.72} />
        <mesh geometry={kit.torus} material={kit.holo} rotation={[Math.PI / 2 + 0.3, 0, 0.2]} scale={p.w * 0.62} position-y={1.2} />
      </group>
      <B kit={kit} p={[p.cx, 0.1, f + 1]} s={[4, 0.2, 2]} m={kit.concrete} />
    </Frame>
  );
}
