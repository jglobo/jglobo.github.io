// Map of the Software world: a compact test town around the garage. Pure data and
// helpers (no three.js) so collision and ramps can be unit tested.
// x runs east, z runs south (towards the camera), y is up.
import { KIT_ORIGIN, KIT_PIECES, KIT_SIZES } from './kit.ts';
import { LAMPS, ROAD_RECTS } from './roads.ts';
import { BILLBOARD, LOTS, lotRect } from './neighborhood.ts';

export const WORLD_HALF = 70;

export interface Box { minX: number; maxX: number; minZ: number; maxZ: number; height: number; color?: string }
export interface Circle { x: number; z: number; r: number }
/** A ramp rising along +dir (or along `heading`, if given) from (x,z); length along its axis, width across. */
export interface Ramp { x: number; z: number; dir: 'n' | 's' | 'e' | 'w'; heading?: number; length: number; width: number; height: number }

const G = KIT_SIZES.garage;
export const GARAGE: Box = { minX: KIT_ORIGIN.x - G.halfW, maxX: KIT_ORIGIN.x + G.halfW, minZ: KIT_ORIGIN.z + G.back, maxZ: KIT_ORIGIN.z + G.front, height: G.height };
/** Garage walls you collide with (the south side is open). */
export const GARAGE_WALLS: Box[] = [
  { ...GARAGE, maxZ: GARAGE.minZ + G.wall },
  { ...GARAGE, maxX: GARAGE.minX + G.wall },
  { ...GARAGE, minX: GARAGE.maxX - G.wall },
];

/** Roads: Jose's road pieces, laid out in roads.ts. */
export const ROADS: Box[] = ROAD_RECTS.map((r) => ({ ...r, height: 0 }));

/** Street lamps along the roads (poles you bump into). */
const LAMP_POSTS: Circle[] = LAMPS.map((l) => ({ x: l.x, z: l.z, r: KIT_SIZES.lampR }));

/** Lamps, bollards and the cabinet around the garage. */
export const KIT_PROPS: Circle[] = KIT_PIECES.flatMap((p) => {
  const r = p.file === 'bollard' ? KIT_SIZES.bollardR : p.file === 'street_lamp' ? KIT_SIZES.lampR : p.file === 'utility_cabinet' ? KIT_SIZES.cabinetR : 0;
  return r ? [{ x: KIT_ORIGIN.x + p.position[0], z: KIT_ORIGIN.z + p.position[2], r }] : [];
});
/** Jose's boost ramp (rotated, so it carries its own heading; the model draws it). */
export const KIT_RAMPS: Ramp[] = KIT_PIECES.filter((p) => p.file === 'boost_ramp').map((p) => {
  const heading = -p.rotationY; // the model rises towards its -z
  const { length, width, height } = KIT_SIZES.ramp;
  return {
    x: KIT_ORIGIN.x + p.position[0] - Math.sin(heading) * (length / 2),
    z: KIT_ORIGIN.z + p.position[2] + Math.cos(heading) * (length / 2),
    dir: 'n' as const, heading, length, width, height,
  };
});
/** Keep trees off the garage forecourt. */
const KIT_AREA: Box = { minX: -9, maxX: 8, minZ: GARAGE.minZ - 2, maxZ: 14, height: 0 };

/** Jose's houses and buildings (neighborhood.ts): you bump into their footprints. */
export const BUILDINGS: Box[] = LOTS.map(lotRect);

/** Jumps, drawn with Jose's boost ramp scaled to size: one on the cross street, one at
 *  the end of each road heading south, and two in the dirt park. */
export const RAMPS: Ramp[] = [
  { x: 10, z: -26, dir: 'e', length: 7, width: 3.9, height: 1.6 },
  { x: -20, z: 34, dir: 's', length: 6, width: 3.9, height: 1.4 },
  { x: 30, z: 40, dir: 's', length: 6, width: 3.9, height: 1.6 },
  { x: 44, z: 30, dir: 'n', length: 6, width: 4, height: 1.8 },
  { x: 52, z: 30, dir: 'n', length: 5, width: 4, height: 1.2 },
];

/** Billboards: one per software project, keyed by order (featured first). */
export const BILLBOARD_SPOTS = [
  { x: 0, z: -40, label: 'Downtown screen' },
  { x: 44, z: -10, label: 'East billboard' },
  { x: -44, z: -24, label: 'Campus billboard' },
  { x: -44, z: 32, label: 'South billboard' },
  { x: 16, z: 44, label: 'Park billboard' },
  { x: -18, z: 46, label: 'Meadow billboard' },
];
export const BILLBOARD_POST_HALF = BILLBOARD.legX * BILLBOARD.scale;

export const PORTAL_SPOT = { x: -7.5, z: 3.8 };
export const SPAWN = { x: -6.5, z: 6.2 };

export const TREES: Circle[] = (() => {
  const out: Circle[] = [];
  let seed = 9;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 160 && out.length < 70; i++) {
    const x = (rand() * 2 - 1) * (WORLD_HALF - 4);
    const z = (rand() * 2 - 1) * (WORLD_HALF - 4);
    const blocked =
      [...ROADS, ...BUILDINGS, KIT_AREA].some((b) => x > b.minX - 3 && x < b.maxX + 3 && z > b.minZ - 3 && z < b.maxZ + 3) ||
      RAMPS.some((r) => Math.hypot(x - r.x, z - r.z) < 10) ||
      BILLBOARD_SPOTS.some((b) => Math.hypot(x - b.x, z - b.z) < 10) ||
      Math.hypot(x - PORTAL_SPOT.x, z - PORTAL_SPOT.z) < 6 ||
      (x > 38 && x < 60 && z > 20 && z < 40);
    if (!blocked) out.push({ x, z, r: 0.7 });
  }
  return out;
})();

const DIRS = { n: [0, -1], s: [0, 1], e: [1, 0], w: [-1, 0] } as const;

/** Ground height and the slope (rise per metre) along the vehicle's travel direction. */
export function groundAt(x: number, z: number): number {
  for (const r of [...RAMPS, ...KIT_RAMPS]) {
    const [dx, dz] = r.heading === undefined ? DIRS[r.dir] : [Math.sin(r.heading), -Math.cos(r.heading)];
    const along = (x - r.x) * dx + (z - r.z) * dz;
    const across = Math.abs((x - r.x) * -dz + (z - r.z) * dx);
    if (along >= 0 && along <= r.length && across <= r.width / 2) return (along / r.length) * r.height;
  }
  return 0;
}

export const onRoad = (x: number, z: number) => ROADS.some((b) => x >= b.minX && x <= b.maxX && z >= b.minZ && z <= b.maxZ);

export interface Push { x: number; z: number; nx: number; nz: number; hit: boolean }

/** Pushes a circle out of buildings, garage walls, trees, billboard posts and the map edge. */
export function collide(x: number, z: number, r: number): Push {
  let nx = 0;
  let nz = 0;
  let hit = false;
  const lim = WORLD_HALF - r;
  if (Math.abs(x) > lim || Math.abs(z) > lim) {
    const cx = Math.max(-lim, Math.min(lim, x));
    const cz = Math.max(-lim, Math.min(lim, z));
    nx += cx - x;
    nz += cz - z;
    x = cx;
    z = cz;
    hit = true;
  }
  for (const b of [...BUILDINGS, ...GARAGE_WALLS]) {
    const cx = Math.max(b.minX, Math.min(b.maxX, x));
    const cz = Math.max(b.minZ, Math.min(b.maxZ, z));
    const dx = x - cx;
    const dz = z - cz;
    const d2 = dx * dx + dz * dz;
    if (d2 >= r * r) continue;
    hit = true;
    if (d2 > 1e-9) {
      const d = Math.sqrt(d2);
      x = cx + (dx / d) * r;
      z = cz + (dz / d) * r;
      nx += dx / d;
      nz += dz / d;
    } else {
      const exits = [x - b.minX, b.maxX - x, z - b.minZ, b.maxZ - z];
      const i = exits.indexOf(Math.min(...exits));
      if (i === 0) { x = b.minX - r; nx -= 1; }
      else if (i === 1) { x = b.maxX + r; nx += 1; }
      else if (i === 2) { z = b.minZ - r; nz -= 1; }
      else { z = b.maxZ + r; nz += 1; }
    }
  }
  const circles: Circle[] = [...TREES, ...KIT_PROPS, ...LAMP_POSTS];
  for (const s of BILLBOARD_SPOTS) {
    circles.push({ x: s.x - BILLBOARD_POST_HALF, z: s.z, r: 0.55 }, { x: s.x + BILLBOARD_POST_HALF, z: s.z, r: 0.55 });
  }
  for (const c of circles) {
    const dx = x - c.x;
    const dz = z - c.z;
    const d = Math.hypot(dx, dz);
    const min = c.r + r;
    if (d < min && d > 1e-6) {
      x = c.x + (dx / d) * min;
      z = c.z + (dz / d) * min;
      nx += dx / d;
      nz += dz / d;
      hit = true;
    }
  }
  const n = Math.hypot(nx, nz);
  return { x, z, nx: n ? nx / n : 0, nz: n ? nz / n : 0, hit };
}
