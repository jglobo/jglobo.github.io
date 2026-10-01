// Bedroom floor plan and player collision. Pure (no three.js) so it can be unit tested.
// x runs left to right, z towards the back wall where the portal is; y is up.

export const ROOM = { halfX: 3.2, halfZ: 2.8, height: 2.7 };
export const EYE = 1.6;
export const PLAYER_RADIUS = 0.3;

export interface Rect { minX: number; maxX: number; minZ: number; maxZ: number }
export interface Circle { x: number; z: number; r: number }

export const FURNITURE: Record<string, Rect> = {
  bed: { minX: -3.2, maxX: -1.75, minZ: -0.4, maxZ: 2.3 },
  desk: { minX: -3.2, maxX: -1.75, minZ: -2.8, maxZ: -2.15 },
  tvStand: { minX: -0.05, maxX: 1.25, minZ: -2.8, maxZ: -2.22 },
  shelf: { minX: 2.82, maxX: 3.2, minZ: -1.55, maxZ: 0.35 },
  dresser: { minX: 1.9, maxX: 3.2, minZ: 2.3, maxZ: 2.8 },
};
export const BEANBAG: Circle = { x: 0.6, z: -1.2, r: 0.42 };

/** The return portal on the back wall. Walking into this strip goes back to the Hub. */
export const PORTAL = { x: 0, halfWidth: 0.8, y: 1.3, triggerZ: ROOM.halfZ - 0.42 };

export const TV = { x: 0.6, screenY: 0.9, screenZ: -2.215 };
export const TV_SEAT = { x: 0.6, y: 0.98, z: -1.48 };

/** Pushes a point out of walls and furniture. Mutates and returns `p`. */
export function collide(p: { x: number; z: number }, r = PLAYER_RADIUS) {
  const inPortalLane = Math.abs(p.x - PORTAL.x) < PORTAL.halfWidth;
  const maxZ = inPortalLane ? ROOM.halfZ - 0.1 : ROOM.halfZ - r;
  p.x = Math.max(-ROOM.halfX + r, Math.min(ROOM.halfX - r, p.x));
  p.z = Math.max(-ROOM.halfZ + r, Math.min(maxZ, p.z));
  for (const f of Object.values(FURNITURE)) {
    const cx = Math.max(f.minX, Math.min(f.maxX, p.x));
    const cz = Math.max(f.minZ, Math.min(f.maxZ, p.z));
    const dx = p.x - cx;
    const dz = p.z - cz;
    const d2 = dx * dx + dz * dz;
    if (d2 >= r * r) continue;
    if (d2 > 1e-9) {
      const d = Math.sqrt(d2);
      p.x = cx + (dx / d) * r;
      p.z = cz + (dz / d) * r;
    } else {
      // Centre inside the box: leave by the nearest side.
      const exits = [p.x - f.minX + r, f.maxX - p.x + r, p.z - f.minZ + r, f.maxZ - p.z + r];
      const i = exits.indexOf(Math.min(...exits));
      if (i === 0) p.x = f.minX - r;
      else if (i === 1) p.x = f.maxX + r;
      else if (i === 2) p.z = f.minZ - r;
      else p.z = f.maxZ + r;
    }
  }
  const dx = p.x - BEANBAG.x;
  const dz = p.z - BEANBAG.z;
  const d = Math.hypot(dx, dz);
  const min = BEANBAG.r + r;
  if (d < min) {
    const k = min / (d || 1);
    p.x = BEANBAG.x + (d ? dx * k : min);
    p.z = BEANBAG.z + dz * (d ? k : 0);
  }
  return p;
}

export const inReturnPortal = (p: { x: number; z: number }) => Math.abs(p.x - PORTAL.x) < PORTAL.halfWidth * 0.85 && p.z > PORTAL.triggerZ;
