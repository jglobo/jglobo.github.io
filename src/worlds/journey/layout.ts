// Journey world layout: pure data and maths (no three.js), so it can be unit tested.
// The town is one path running north from home. Each timeline stop in
// content/journey.json gets a building beside the path, oldest first, so walking
// further up the hill means moving forward in time.
import { rng } from '../../utils/random.ts';

export type BuildingStyle = 'campus' | 'clinic' | 'market' | 'lab' | 'library' | 'office' | 'tower';
export interface StopInput { id: string; building: BuildingStyle; district: string }

export interface Box { minX: number; maxX: number; minZ: number; maxZ: number }
export interface Circle { x: number; z: number; r: number }

export interface StopPlacement extends StopInput {
  index: number;
  side: -1 | 1;
  /** Building centre and size (w along x, d along z, h height). */
  cx: number;
  cz: number;
  w: number;
  d: number;
  h: number;
  /** Where the visitor stands to read the memory (in front of the door). */
  door: { x: number; z: number };
  /** Timeline signpost on the other side of the path. */
  sign: { x: number; z: number };
}

/** Building footprints [w, d, h]. */
export const FOOTPRINT: Record<BuildingStyle, [number, number, number]> = {
  campus: [12, 7, 6],
  clinic: [9, 6, 4.2],
  market: [9, 6, 4.4],
  lab: [9, 6, 5],
  library: [9, 7, 6],
  office: [9, 7, 10],
  tower: [8, 8, 17],
};

export const PATH_HALF = 1.6;
export const STOP_START = -16;
export const STOP_SPACING = 15;

/** The path wanders gently left and right as it climbs. */
export const pathX = (z: number) => 2.5 * Math.sin(z / 16);

// Home: the house, its yard and the people in it.
export const HOUSE = { cx: -9.5, cz: -1.5, w: 8, d: 6, h: 4.6 };
export const PORCH = { cx: -9.5, cz: 2.4, w: 5, d: 1.8 };
export const YARD = { minX: -14.5, maxX: -4, minZ: 3.4, maxZ: 8.6 };
export const MAILBOX = { x: -3.3, z: 8.8 };
export const DOGHOUSE = { cx: -13.4, cz: 4.6, w: 1.4, d: 1.3 };
export const JOSE_SPOT = { x: -4.4, z: 5.0 };
export const WIFE_SPOT = { x: -5.9, z: 4.9 };
/** The son runs back and forth along this line chasing his ball. */
export const KID_LANE = { x0: -13, x1: -6.5, z: 7.6 };
export const SPAWN = { x: 1.6, z: 11.5 };
export const PORTAL_SPOT = { x: 6.5, z: 13 };

export interface TownLayout {
  stops: StopPlacement[];
  plaza: { x: number; z: number };
  endZ: number;
  boxes: Box[];
  circles: Circle[];
  ponds: Circle[];
  sand: Circle[];
  trees: { x: number; z: number; s: number; kind: number }[];
  lamps: { x: number; z: number }[];
  fences: Box[];
  bounds: { minZ: number; maxZ: number; halfWidth: number };
}

const box = (cx: number, cz: number, w: number, d: number): Box => ({ minX: cx - w / 2, maxX: cx + w / 2, minZ: cz - d / 2, maxZ: cz + d / 2 });

export function buildLayout(input: StopInput[]): TownLayout {
  const stops: StopPlacement[] = input.map((s, index) => {
    const side: -1 | 1 = index % 2 === 0 ? -1 : 1;
    const z = STOP_START - index * STOP_SPACING;
    const [w, d, h] = FOOTPRINT[s.building];
    const cx = pathX(z) + side * (5 + w / 2);
    const front = z - 1;
    return {
      ...s,
      index,
      side,
      cx,
      cz: front - d / 2,
      w,
      d,
      h,
      door: { x: cx, z: front + 1.4 },
      sign: { x: pathX(z + 3) - side * (PATH_HALF + 1.2), z: z + 3 },
    };
  });
  const lastZ = STOP_START - Math.max(0, input.length - 1) * STOP_SPACING;
  const endZ = lastZ - 16;
  const plaza = { x: pathX(endZ), z: endZ };

  const fences: Box[] = [box(-15.2, 1.6, 0.25, 14.4), box(-10.6, 8.9, 9.4, 0.25)];
  const boxes: Box[] = [
    box(HOUSE.cx, HOUSE.cz, HOUSE.w, HOUSE.d),
    ...fences,
    box(MAILBOX.x, MAILBOX.z, 0.5, 0.5),
    box(DOGHOUSE.cx, DOGHOUSE.cz, DOGHOUSE.w, DOGHOUSE.d),
    ...stops.map((s) => box(s.cx, s.cz, s.w, s.d)),
  ];

  const ponds: Circle[] = [];
  const sand: Circle[] = [];
  for (const s of stops) {
    if (s.district !== 'island') continue;
    const pond = { x: s.cx + s.side * 9.5, z: s.cz + 1, r: 3.6 };
    ponds.push(pond);
    sand.push({ x: s.cx + s.side * 3, z: s.cz + 1.5, r: 10 });
  }

  const halfWidth = 24;
  const bounds = { minZ: endZ - 8, maxZ: 18, halfWidth };

  // Trees: seeded scatter, kept off the path, the walkways and the buildings.
  const r = rng(77);
  const trees: TownLayout['trees'] = [];
  const clearOf = (x: number, z: number, m: number) =>
    !boxes.some((b) => x > b.minX - m && x < b.maxX + m && z > b.minZ - m && z < b.maxZ + m) &&
    !ponds.some((p) => Math.hypot(x - p.x, z - p.z) < p.r + m) &&
    Math.abs(x - pathX(z)) > PATH_HALF + 2.2 &&
    !stops.some((s) => Math.abs(z - s.door.z) < 2.2 && (x - pathX(z)) * s.side > 0 && Math.abs(x - pathX(z)) < Math.abs(s.cx - pathX(z)) + 1) &&
    !(x > YARD.minX - 1 && x < 4 && z > -5 && z < 17) && // keep the view of the yard clear
    Math.hypot(x - PORTAL_SPOT.x, z - PORTAL_SPOT.z) > 3 &&
    Math.hypot(x - plaza.x, z - plaza.z) > 9;
  for (let i = 0; i < 400 && trees.length < 90; i++) {
    const z = bounds.minZ + 2 + r() * (bounds.maxZ - bounds.minZ - 4);
    const x = pathX(z) + (r() * 2 - 1) * (halfWidth - 1.5);
    if (!clearOf(x, z, 1.6)) continue;
    if (trees.some((t) => Math.hypot(t.x - x, t.z - z) < 3.2)) continue;
    trees.push({ x, z, s: 0.8 + r() * 0.6, kind: Math.floor(r() * 3) });
  }
  const circles: Circle[] = [...trees.map((t) => ({ x: t.x, z: t.z, r: 0.45 * t.s })), ...ponds];

  const lamps: TownLayout['lamps'] = [];
  for (let z = 6, i = 0; z > endZ + 6; z -= 9, i++) {
    const side = i % 2 ? 1 : -1;
    const x = pathX(z) + side * (PATH_HALF + 0.7);
    if (stops.some((s) => Math.abs(z - s.door.z) < 2.5 && s.side === side)) continue;
    lamps.push({ x, z });
  }
  circles.push(...lamps.map((l) => ({ x: l.x, z: l.z, r: 0.2 })));

  return { stops, plaza, endZ, boxes, circles, ponds, sand, trees, lamps, fences, bounds };
}

/** Pushes a circle of radius r out of buildings, trees, ponds and the town edge. */
export function collide(layout: TownLayout, x: number, z: number, r: number) {
  let hit = false;
  for (const b of layout.boxes) {
    const nx = Math.max(b.minX, Math.min(x, b.maxX));
    const nz = Math.max(b.minZ, Math.min(z, b.maxZ));
    const dx = x - nx;
    const dz = z - nz;
    const d2 = dx * dx + dz * dz;
    if (d2 >= r * r) continue;
    hit = true;
    if (d2 > 1e-8) {
      const d = Math.sqrt(d2);
      x = nx + (dx / d) * r;
      z = nz + (dz / d) * r;
    } else {
      // Centre inside the box: leave by the nearest face.
      const out = [x - b.minX, b.maxX - x, z - b.minZ, b.maxZ - z];
      const m = Math.min(...out);
      if (m === out[0]) x = b.minX - r;
      else if (m === out[1]) x = b.maxX + r;
      else if (m === out[2]) z = b.minZ - r;
      else z = b.maxZ + r;
    }
  }
  for (const c of layout.circles) {
    const dx = x - c.x;
    const dz = z - c.z;
    const d = Math.hypot(dx, dz);
    const min = c.r + r;
    if (d < min) {
      hit = true;
      const k = d > 1e-6 ? min / d : 1;
      x = c.x + (d > 1e-6 ? dx * k : min);
      z = c.z + (d > 1e-6 ? dz * k : 0);
    }
  }
  const { minZ, maxZ, halfWidth } = layout.bounds;
  const cz = Math.max(minZ, Math.min(maxZ, z));
  if (cz !== z) hit = true;
  z = cz;
  const px = pathX(z);
  const cx = Math.max(px - halfWidth, Math.min(px + halfWidth, x));
  if (cx !== x) hit = true;
  return { x: cx, z, hit };
}

/** The stop whose stretch of path the visitor is on (for district tinting). */
export function districtAt(layout: TownLayout, z: number) {
  if (z > STOP_START + STOP_SPACING / 2) return 'home';
  let best = layout.stops[0];
  for (const s of layout.stops) if (Math.abs(s.door.z - z) < Math.abs(best.door.z - z)) best = s;
  return best?.district ?? 'home';
}
