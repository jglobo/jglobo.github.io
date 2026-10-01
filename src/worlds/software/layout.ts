// Map of the Software world: a compact test town around the garage. Pure data and
// helpers (no three.js) so collision and ramps can be unit tested.
// x runs east, z runs south (towards the camera), y is up.

export const WORLD_HALF = 70;

export interface Box { minX: number; maxX: number; minZ: number; maxZ: number; height: number; color?: string }
export interface Circle { x: number; z: number; r: number }
/** A ramp rising along +dir from (x,z); length along its axis, width across. */
export interface Ramp { x: number; z: number; dir: 'n' | 's' | 'e' | 'w'; length: number; width: number; height: number }

export const GARAGE: Box = { minX: -12, maxX: 12, minZ: -8, maxZ: 6, height: 5.5 };
/** Garage walls you collide with (the south side is open). */
export const GARAGE_WALLS: Box[] = [
  { minX: -12, maxX: 12, minZ: -8, maxZ: -7.4, height: 5.5 },
  { minX: -12, maxX: -11.4, minZ: -8, maxZ: 6, height: 5.5 },
  { minX: 11.4, maxX: 12, minZ: -8, maxZ: 6, height: 5.5 },
];

/** Roads: a loop around the garage and a boulevard north to downtown. */
export const ROADS: Box[] = [
  { minX: -36, maxX: 36, minZ: 16, maxZ: 24, height: 0 },
  { minX: -36, maxX: 36, minZ: -30, maxZ: -22, height: 0 },
  { minX: -36, maxX: -28, minZ: -30, maxZ: 24, height: 0 },
  { minX: 28, maxX: 36, minZ: -30, maxZ: 24, height: 0 },
  { minX: -4, maxX: 4, minZ: -60, maxZ: -30, height: 0 },
  { minX: -4, maxX: 4, minZ: 6, maxZ: 16, height: 0 },
];

/** City blocks north of the loop and a campus to the west. */
export const BUILDINGS: Box[] = [
  { minX: -26, maxX: -12, minZ: -58, maxZ: -46, height: 16, color: '#4a5a78' },
  { minX: 12, maxX: 22, minZ: -60, maxZ: -48, height: 22, color: '#3d4b66' },
  { minX: 24, maxX: 34, minZ: -56, maxZ: -44, height: 12, color: '#56688a' },
  { minX: -40, maxX: -30, minZ: -62, maxZ: -50, height: 10, color: '#5a6782' },
  { minX: -62, maxX: -48, minZ: -14, maxZ: -2, height: 8, color: '#6c7fa0' },
  { minX: -62, maxX: -50, minZ: 6, maxZ: 16, height: 6, color: '#7b8db0' },
  { minX: 48, maxX: 60, minZ: -40, maxZ: -28, height: 9, color: '#59607a' },
];

export const RAMPS: Ramp[] = [
  { x: 6, z: 20, dir: 'e', length: 7, width: 5, height: 1.6 },
  { x: -18, z: -26, dir: 'w', length: 6, width: 5, height: 1.2 },
  { x: 44, z: 30, dir: 'n', length: 6, width: 4, height: 1.8 },
  { x: 52, z: 30, dir: 'n', length: 5, width: 4, height: 1.2 },
];

/** Billboards: one per software project, keyed by order (featured first). */
export const BILLBOARD_SPOTS = [
  { x: 0, z: -40, label: 'Downtown screen' },
  { x: 44, z: -10, label: 'East billboard' },
  { x: -44, z: -24, label: 'Campus billboard' },
  { x: -44, z: 32, label: 'South billboard' },
];
export const BILLBOARD_POST_HALF = 6;

export const PORTAL_SPOT = { x: -15, z: 11 };
export const SPAWN = { x: -9, z: 11 };

export const TREES: Circle[] = (() => {
  const out: Circle[] = [];
  let seed = 9;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 160 && out.length < 70; i++) {
    const x = (rand() * 2 - 1) * (WORLD_HALF - 4);
    const z = (rand() * 2 - 1) * (WORLD_HALF - 4);
    const blocked =
      [...ROADS, ...BUILDINGS, GARAGE].some((b) => x > b.minX - 3 && x < b.maxX + 3 && z > b.minZ - 3 && z < b.maxZ + 3) ||
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
  for (const r of RAMPS) {
    const [dx, dz] = DIRS[r.dir];
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
  const circles: Circle[] = [...TREES];
  for (const s of BILLBOARD_SPOTS) {
    circles.push({ x: s.x - BILLBOARD_POST_HALF, z: s.z, r: 0.5 }, { x: s.x + BILLBOARD_POST_HALF, z: s.z, r: 0.5 });
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
