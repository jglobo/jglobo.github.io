// The Portal Hub test chamber as data and maths (no React, no rendering), so the
// puzzles can be unit tested: the room layout, the portal-compatible surfaces, how a
// point or direction passes from one portal to the other, the laser and light-bridge
// beams, the floor (with its pit, chasm and bridge), player collision and the ball.
import { Vector3 } from 'three';

export const ROOM = { half: 14, height: 9 };
export const EYE = 1.7;
/** Body centre above the feet, where portal crossings are tested. */
export const BODY = 0.9;
export const PLAYER_R = 0.4;
export const GRAVITY = 18;

/** Jose's portal model is about 1.1 × 2.1 m; this makes a walk-through doorway. */
export const PORTAL_SCALE = 1.3;
export const PORTAL_HALF = { w: 0.554 * PORTAL_SCALE, h: 1.05 * PORTAL_SCALE };
/** Wall portals sit on the floor. */
export const PORTAL_CENTER_Y = PORTAL_HALF.h + 0.04;

export type PortalColor = 'blue' | 'orange';
export const PORTAL_COLORS: Record<PortalColor, { main: string; light: string }> = {
  blue: { main: '#2f8cff', light: '#a8d4ff' },
  orange: { main: '#ff8a1f', light: '#ffd29a' },
};
export const other = (c: PortalColor): PortalColor => (c === 'blue' ? 'orange' : 'blue');

export type Vec3 = [number, number, number];
export type SurfaceKind = 'wall' | 'floor' | 'ceiling';

/** A portal-compatible rectangle. Its right axis is up × normal. */
export interface Surface {
  id: string;
  kind: SurfaceKind;
  center: Vec3;
  normal: Vec3;
  up: Vec3;
  halfU: number;
  halfV: number;
}

const H = ROOM.half;
const E = 0.02; // panels sit just in front of the walls

// Puzzle props.
export const PIT = { minX: 10, maxX: 13.8, minZ: -3, maxZ: 3, depth: 3 };
export const CHASM = { minZ: 9.5, maxZ: 11.8 };
export const LEDGE_Z = CHASM.maxZ;
export const PLATFORM = { x: -6, z: -10, halfX: 1.1, halfZ: 1.7, top: 0.15 };
export const DROPPER = { x: -6, z: -10, y: ROOM.height - 0.6 };
export const BASIN = { x: 6, z: -12, rim: 0.7, catch: 1.1, top: 0.3 };
export const LASER = { origin: [-9, 1.3, -6] as Vec3, dir: [-1, 0, 0] as Vec3 };
export const TARGET = { center: [-10, 1.3, 6] as Vec3, normal: [-1, 0, 0] as Vec3, half: 0.45 };
export const BRIDGE_EMITTER = { origin: [7.2, 0.12, 6.8] as Vec3, dir: [1, 0, 0] as Vec3 };
export const BRIDGE_HALF_W = 0.8;
export const BRIDGE_Y = 0.12;
/** Free-standing white wall at the chasm's edge: the light bridge leaves from its face. */
export const BRIDGE_WALL = { minX: -5.6, maxX: -2.4, minZ: 7.6, maxZ: 8.2, height: 3.6 };
export const CONSOLE = { x: 0, z: 0, r: 1.25 };
export const SPAWN = { x: 0, z: 6.4 };
/** Résumé and contact terminals, turned toward the spawn point. */
export const TERMINALS = [
  { id: 'resume', x: -6.5, z: 1.8, yaw: Math.atan2(6.5, 4.6) },
  { id: 'contact', x: 6.5, z: 1.8, yaw: Math.atan2(-6.5, 4.6) },
];
export const BUTTONS = {
  ball: { x: -3.6, z: -8 },
  bridge: { x: 8.6, z: 4.8 },
};

export type DoorWorld = 'games' | 'software' | 'journey';
/** World doors: centre on the wall, inward normal, right axis. */
export const DOORS: Record<DoorWorld, { center: Vec3; normal: Vec3; halfW: number; height: number; depth: number }> = {
  games: { center: [0, 0, -H], normal: [0, 0, 1], halfW: 1.3, height: 3.2, depth: 2.6 },
  software: { center: [-H, 0, 0], normal: [1, 0, 0], halfW: 1.3, height: 3.2, depth: 2.6 },
  journey: { center: [0, 0, H], normal: [0, 0, -1], halfW: 1.3, height: 3.2, depth: 2.6 },
};

export const SURFACES: Surface[] = [
  // North wall (games): either side of the door.
  { id: 'north-w', kind: 'wall', center: [-6.75, 3, -H + E], normal: [0, 0, 1], up: [0, 1, 0], halfU: 4.25, halfV: 3 },
  { id: 'north-e', kind: 'wall', center: [6.75, 3, -H + E], normal: [0, 0, 1], up: [0, 1, 0], halfU: 4.25, halfV: 3 },
  // East wall (data science): north of the pit and beside the bridge emitter.
  { id: 'east-n', kind: 'wall', center: [H - E, 3, -7], normal: [-1, 0, 0], up: [0, 1, 0], halfU: 3, halfV: 3 },
  { id: 'east-s', kind: 'wall', center: [H - E, 3, 6.4], normal: [-1, 0, 0], up: [0, 1, 0], halfU: 2.4, halfV: 3 },
  // West wall (applications): either side of the door.
  { id: 'west-n', kind: 'wall', center: [-H + E, 3, -6.25], normal: [1, 0, 0], up: [0, 1, 0], halfU: 3.75, halfV: 3 },
  { id: 'west-s', kind: 'wall', center: [-H + E, 3, 5.65], normal: [1, 0, 0], up: [0, 1, 0], halfU: 3.15, halfV: 3 },
  // The bridge wall's south face.
  {
    id: 'bridge-wall', kind: 'wall', center: [(BRIDGE_WALL.minX + BRIDGE_WALL.maxX) / 2, BRIDGE_WALL.height / 2, BRIDGE_WALL.maxZ + 0.01],
    normal: [0, 0, 1], up: [0, 1, 0], halfU: (BRIDGE_WALL.maxX - BRIDGE_WALL.minX) / 2, halfV: BRIDGE_WALL.height / 2,
  },
  // Ceiling over the pit, ceiling over the basin, and the floor of the ball platform.
  { id: 'ceiling-pit', kind: 'ceiling', center: [(PIT.minX + PIT.maxX) / 2, ROOM.height - E, 0], normal: [0, -1, 0], up: [0, 0, 1], halfU: (PIT.maxX - PIT.minX) / 2, halfV: 3 },
  { id: 'ceiling-basin', kind: 'ceiling', center: [BASIN.x, ROOM.height - E, BASIN.z], normal: [0, -1, 0], up: [0, 0, 1], halfU: 1.1, halfV: 1.7 },
  { id: 'platform', kind: 'floor', center: [PLATFORM.x, PLATFORM.top + 0.01, PLATFORM.z], normal: [0, 1, 0], up: [0, 0, -1], halfU: PLATFORM.halfX, halfV: PLATFORM.halfZ },
];

export const surfaceById = (id: string) => SURFACES.find((s) => s.id === id);
export const v3 = (a: Vec3) => new Vector3(a[0], a[1], a[2]);

/** A placed portal: position and an orthonormal frame (right, up, normal). */
export interface PortalFrame {
  surface: string;
  kind: SurfaceKind;
  pos: Vector3;
  normal: Vector3;
  up: Vector3;
  right: Vector3;
}

export function makeFrame(surface: string, kind: SurfaceKind, pos: Vector3, normal: Vector3, up: Vector3): PortalFrame {
  const n = normal.clone().normalize();
  const u = up.clone().normalize();
  return { surface, kind, pos: pos.clone(), normal: n, up: u, right: new Vector3().crossVectors(u, n).normalize() };
}

/** Where a portal aimed at `hit` on a surface lands: kept inside the panel, wall portals on the floor. */
export function snapPortal(s: Surface, hit: Vector3): PortalFrame | null {
  const c = v3(s.center);
  const n = v3(s.normal);
  const up = v3(s.up);
  const right = new Vector3().crossVectors(up, n);
  const maxU = s.halfU - PORTAL_HALF.w - 0.05;
  if (maxU < 0) return null;
  const rel = hit.clone().sub(c);
  const u = Math.max(-maxU, Math.min(maxU, rel.dot(right)));
  let v: number;
  if (s.kind === 'wall') {
    v = PORTAL_CENTER_Y - c.y;
    if (c.y - s.halfV > 0.1 || PORTAL_CENTER_Y + PORTAL_HALF.h > c.y + s.halfV + 0.01) return null;
  } else {
    const maxV = s.halfV - PORTAL_HALF.h - 0.05;
    if (maxV < 0) return null;
    v = Math.max(-maxV, Math.min(maxV, rel.dot(up)));
  }
  const pos = c.addScaledVector(right, u).addScaledVector(up, v).addScaledVector(n, 0.02);
  return makeFrame(s.id, s.kind, pos, n, up);
}

/** Two portals on one surface may not overlap. */
export function overlaps(a: PortalFrame, b: PortalFrame | null) {
  if (!b || a.surface !== b.surface) return false;
  const d = a.pos.clone().sub(b.pos);
  return Math.abs(d.dot(a.right)) < PORTAL_HALF.w * 2 + 0.1 && Math.abs(d.dot(a.up)) < PORTAL_HALF.h * 2 + 0.1;
}

/** Portal-local coordinates: x along right, y along up, z along the normal. */
export function toLocal(f: PortalFrame, p: Vector3) {
  const r = p.clone().sub(f.pos);
  return new Vector3(r.dot(f.right), r.dot(f.up), r.dot(f.normal));
}

/** A point entering portal `a` comes out of `b`: mirrored left-right and front-back. */
export function mapPoint(a: PortalFrame, b: PortalFrame, p: Vector3) {
  const l = toLocal(a, p);
  return b.pos.clone().addScaledVector(b.right, -l.x).addScaledVector(b.up, l.y).addScaledVector(b.normal, -l.z);
}

export function mapDir(a: PortalFrame, b: PortalFrame, d: Vector3) {
  return new Vector3()
    .addScaledVector(b.right, -d.dot(a.right))
    .addScaledVector(b.up, d.dot(a.up))
    .addScaledVector(b.normal, -d.dot(a.normal));
}

/** Inside the passable opening (a rounded rectangle a little smaller than the rim). */
export function insideHole(f: PortalFrame, p: Vector3, margin = 0.92) {
  const l = toLocal(f, p);
  const x = l.x / (PORTAL_HALF.w * margin);
  const y = l.y / (PORTAL_HALF.h * margin);
  return x ** 4 + y ** 4 <= 1;
}

export interface Portals {
  blue: PortalFrame | null;
  orange: PortalFrame | null;
}
/** Both portals, or none: a single portal leads nowhere. */
export function linked(p: Portals): [PortalFrame, PortalFrame][] {
  return p.blue && p.orange ? [[p.blue, p.orange], [p.orange, p.blue]] : [];
}

// ---------------------------------------------------------------------------
// Beams: the laser and the light bridge.

interface Box3D { min: Vec3; max: Vec3 }
/** Things beams stop on (approximate, generous boxes). */
export const BEAM_BLOCKERS: Box3D[] = [
  { min: [BRIDGE_WALL.minX, 0, BRIDGE_WALL.minZ], max: [BRIDGE_WALL.maxX, BRIDGE_WALL.height, BRIDGE_WALL.maxZ] },
  { min: [CONSOLE.x - 1, 0, CONSOLE.z - 1], max: [CONSOLE.x + 1, 1.3, CONSOLE.z + 1] },
];

function rayBox(o: Vector3, d: Vector3, b: Box3D) {
  let t0 = 0;
  let t1 = Infinity;
  for (let i = 0; i < 3; i++) {
    const oi = o.getComponent(i);
    const di = d.getComponent(i);
    if (Math.abs(di) < 1e-9) {
      if (oi < b.min[i] || oi > b.max[i]) return Infinity;
      continue;
    }
    let a = (b.min[i] - oi) / di;
    let c = (b.max[i] - oi) / di;
    if (a > c) [a, c] = [c, a];
    t0 = Math.max(t0, a);
    t1 = Math.min(t1, c);
    if (t0 > t1) return Infinity;
  }
  return t0 > 1e-4 ? t0 : Infinity;
}

/** Distance along the ray to the room's inside faces. */
function rayRoom(o: Vector3, d: Vector3) {
  let t = Infinity;
  const planes: [number, number][] = [
    [0, H], [0, -H], [2, H], [2, -H], [1, ROOM.height], [1, 0],
  ];
  for (const [axis, value] of planes) {
    const di = d.getComponent(axis);
    if (Math.abs(di) < 1e-9) continue;
    const ti = (value - o.getComponent(axis)) / di;
    if (ti > 1e-4) t = Math.min(t, ti);
  }
  return t;
}

/** Beam crossing a portal's plane from the front, inside its rim. Beams use the outer rim so a floor-level bridge still enters. */
function rayPortal(o: Vector3, d: Vector3, f: PortalFrame) {
  const dn = d.dot(f.normal);
  if (dn >= -1e-6) return Infinity;
  const t = f.pos.clone().sub(o).dot(f.normal) / dn;
  if (t <= 1e-4) return Infinity;
  const l = toLocal(f, o.clone().addScaledVector(d, t));
  return Math.abs(l.x) <= PORTAL_HALF.w * 0.85 && Math.abs(l.y) <= PORTAL_HALF.h * 0.98 ? t : Infinity;
}

function rayTarget(o: Vector3, d: Vector3) {
  const n = v3(TARGET.normal);
  const c = v3(TARGET.center);
  const dn = d.dot(n);
  if (dn >= -1e-6) return Infinity;
  const t = c.clone().sub(o).dot(n) / dn;
  if (t <= 1e-4) return Infinity;
  const p = o.clone().addScaledVector(d, t).sub(c);
  return Math.abs(p.y) <= TARGET.half && Math.abs(p.z) <= TARGET.half && Math.abs(p.x) <= TARGET.half ? t : Infinity;
}

export interface BeamResult {
  segments: [Vector3, Vector3][];
  hitTarget: boolean;
}

/**
 * Traces a beam through up to three portal hops. A beam leaves the far portal at the same
 * height in the portal (so a floor-level bridge stays on the floor) but centred left to
 * right, which keeps the puzzles forgiving.
 */
export function traceBeam(origin: Vector3, dir: Vector3, portals: Portals, opts: { target?: boolean; blockers?: Box3D[] } = {}): BeamResult {
  const segments: [Vector3, Vector3][] = [];
  const pairs = linked(portals);
  const blockers = opts.blockers ?? BEAM_BLOCKERS;
  let o = origin.clone();
  let d = dir.clone().normalize();
  for (let hop = 0; hop < 4; hop++) {
    let best = rayRoom(o, d);
    let kind: 'end' | 'target' | 'portal' = 'end';
    let via: [PortalFrame, PortalFrame] | null = null;
    for (const b of blockers) {
      const t = rayBox(o, d, b);
      if (t < best) [best, kind] = [t, 'end'];
    }
    if (opts.target) {
      const t = rayTarget(o, d);
      if (t < best) [best, kind] = [t, 'target'];
    }
    for (const pair of pairs) {
      const t = rayPortal(o, d, pair[0]);
      if (t < best) [best, kind, via] = [t, 'portal', pair];
    }
    if (!Number.isFinite(best)) best = 40;
    const end = o.clone().addScaledVector(d, best);
    segments.push([o, end]);
    if (kind === 'target') return { segments, hitTarget: true };
    if (kind !== 'portal' || !via) break;
    const [a, b] = via;
    const l = toLocal(a, end);
    o = b.pos.clone().addScaledVector(b.up, l.y).addScaledVector(b.normal, 0.03);
    d = mapDir(a, b, d).normalize();
  }
  return { segments, hitTarget: false };
}

/** The walkable parts of a light bridge: horizontal segments at floor height. */
export function bridgeSpans(beam: BeamResult) {
  return beam.segments.filter(([a, b]) => Math.abs(a.y - b.y) < 0.01 && a.y < 0.5 && a.distanceTo(b) > 0.3);
}

// ---------------------------------------------------------------------------
// Floor and collision.

export const inPit = (x: number, z: number) => x > PIT.minX && x < PIT.maxX && z > PIT.minZ && z < PIT.maxZ;
export const inChasm = (z: number) => z > CHASM.minZ && z < CHASM.maxZ;
export const onPlatform = (x: number, z: number) => Math.abs(x - PLATFORM.x) < PLATFORM.halfX && Math.abs(z - PLATFORM.z) < PLATFORM.halfZ;

function distToSegment2D(x: number, z: number, a: Vector3, b: Vector3) {
  const abx = b.x - a.x;
  const abz = b.z - a.z;
  const len = abx * abx + abz * abz || 1;
  const t = Math.max(0, Math.min(1, ((x - a.x) * abx + (z - a.z) * abz) / len));
  return Math.hypot(x - (a.x + abx * t), z - (a.z + abz * t));
}

/** Floor height under a point; -Infinity over a hole (pit, chasm, a floor portal). */
export function floorAt(x: number, z: number, portals: Portals, bridge: [Vector3, Vector3][] = []) {
  if (inPit(x, z)) return -Infinity;
  if (inChasm(z)) return bridge.some(([a, b]) => distToSegment2D(x, z, a, b) < BRIDGE_HALF_W) ? BRIDGE_Y : -Infinity;
  if (onPlatform(x, z)) {
    const p = new Vector3(x, PLATFORM.top, z);
    for (const [a] of linked(portals)) if (a.kind === 'floor' && insideHole(a, p)) return -Infinity;
    return PLATFORM.top;
  }
  return 0;
}

interface Circle { x: number; z: number; r: number }
interface Rect { minX: number; maxX: number; minZ: number; maxZ: number }
export const PLAYER_CIRCLES: Circle[] = [
  { x: CONSOLE.x, z: CONSOLE.z, r: CONSOLE.r },
  { x: BUTTONS.ball.x, z: BUTTONS.ball.z, r: 0.35 },
  { x: BUTTONS.bridge.x, z: BUTTONS.bridge.z, r: 0.35 },
  { x: LASER.origin[0], z: LASER.origin[2], r: 0.45 },
  { x: TARGET.center[0], z: TARGET.center[2], r: 0.45 },
  { x: BRIDGE_EMITTER.origin[0] + 0.2, z: BRIDGE_EMITTER.origin[2], r: 0.5 },
  { x: BASIN.x, z: BASIN.z, r: BASIN.rim + 0.15 },
  ...TERMINALS.map((t) => ({ x: t.x, z: t.z, r: 0.75 })),
];
export const PLAYER_RECTS: Rect[] = [BRIDGE_WALL];
/** Glass rails around the pit, so you can only reach it by falling in from above. */
export const PIT_RAIL: Rect = { minX: PIT.minX - 0.1, maxX: H, minZ: PIT.minZ - 0.1, maxZ: PIT.maxZ + 0.1 };

function pushCircle(x: number, z: number, r: number, c: Circle) {
  const dx = x - c.x;
  const dz = z - c.z;
  const d = Math.hypot(dx, dz);
  const min = r + c.r;
  if (d >= min) return [x, z];
  const k = min / (d || 1);
  return [c.x + (d ? dx * k : min), c.z + dz * k];
}

function pushRect(x: number, z: number, r: number, b: Rect) {
  const cx = Math.max(b.minX, Math.min(b.maxX, x));
  const cz = Math.max(b.minZ, Math.min(b.maxZ, z));
  const dx = x - cx;
  const dz = z - cz;
  const d = Math.hypot(dx, dz);
  if (d >= r) return [x, z];
  if (d > 1e-6) return [cx + (dx / d) * r, cz + (dz / d) * r];
  // Centre inside the rectangle: leave by the nearest side.
  const opts = [[b.minX - r, z, x - b.minX], [b.maxX + r, z, b.maxX - x], [x, b.minZ - r, z - b.minZ], [x, b.maxZ + r, b.maxZ - z]];
  opts.sort((p, q) => p[2] - q[2]);
  return [opts[0][0], opts[0][1]];
}

export interface CollideOpts {
  /** Feet height: props only block someone standing at floor level. */
  feet: number;
  portals: Portals;
  openDoors: DoorWorld[];
  /** Dropping in from above (out of a ceiling portal) rather than walking. */
  falling?: boolean;
}

/**
 * Keeps the player in the room and out of the props. The wall gives way inside a wall
 * portal's opening (so you can step into it) and inside an open doorway.
 */
export function collidePlayer(x: number, z: number, o: CollideOpts) {
  const lim = H - PLAYER_R;
  let limX0 = -lim, limX1 = lim, limZ0 = -lim, limZ1 = lim;
  const centre = new Vector3(x, o.feet + BODY, z);
  for (const [a] of linked(o.portals)) {
    if (a.kind !== 'wall' || !insideHole(a, centre.clone().setComponent(a.normal.x !== 0 ? 0 : 2, a.normal.x !== 0 ? a.pos.x : a.pos.z))) continue;
    if (a.normal.x > 0.5 && a.pos.x < -H + 1) limX0 = -H - 1;
    if (a.normal.x < -0.5 && a.pos.x > H - 1) limX1 = H + 1;
    if (a.normal.z > 0.5 && a.pos.z < -H + 1) limZ0 = -H - 1;
    if (a.normal.z < -0.5 && a.pos.z > H - 1) limZ1 = H + 1;
  }
  for (const w of o.openDoors) {
    const d = DOORS[w];
    const lateral = d.normal[0] !== 0 ? z - d.center[2] : x - d.center[0];
    if (Math.abs(lateral) > d.halfW - PLAYER_R || o.feet > 0.5) continue;
    if (d.normal[2] > 0) limZ0 = -H - d.depth;
    if (d.normal[2] < 0) limZ1 = H + d.depth;
    if (d.normal[0] > 0) limX0 = -H - d.depth;
  }
  x = Math.max(limX0, Math.min(limX1, x));
  z = Math.max(limZ0, Math.min(limZ1, z));
  if (o.feet > -0.3 && o.feet < 1.5) {
    for (const c of PLAYER_CIRCLES) [x, z] = pushCircle(x, z, PLAYER_R, c);
    for (const r of PLAYER_RECTS) [x, z] = pushRect(x, z, PLAYER_R, r);
    // The rail stops people walking into the pit, not someone dropping into it from above.
    if (o.feet > -0.2 && !(o.falling && inPit(x, z))) [x, z] = pushRect(x, z, PLAYER_R, PIT_RAIL);
  }
  return [x, z] as const;
}

/** How far past a door's wall the player has walked (positive inside the doorway). */
export function doorDepth(w: DoorWorld, x: number, z: number) {
  const d = DOORS[w];
  const n = d.normal;
  return -((x - d.center[0]) * n[0] + (z - d.center[2]) * n[2]);
}

// ---------------------------------------------------------------------------
// The ball for the games puzzle.

export const BALL_R = 0.18;
export interface Ball {
  p: Vector3;
  v: Vector3;
  age: number;
  rest: number;
  state: 'flying' | 'caught' | 'gone';
}

export const dropBall = (): Ball => ({ p: new Vector3(DROPPER.x, DROPPER.y, DROPPER.z), v: new Vector3(0, -1, 0), age: 0, rest: 0, state: 'flying' });

/** Portals hand the ball on at a gentle speed so it can land in the basin. */
const BALL_EXIT = { min: 3, max: 5.5 };

/** One physics step. Returns true when the ball has just landed in the basin. */
export function stepBall(b: Ball, dt: number, portals: Portals): boolean {
  if (b.state !== 'flying') return false;
  b.age += dt;
  const prev = b.p.clone();
  b.v.y -= GRAVITY * dt;
  b.p.addScaledVector(b.v, dt);

  for (const [a, c] of linked(portals)) {
    const d0 = prev.clone().sub(a.pos).dot(a.normal);
    const d1 = b.p.clone().sub(a.pos).dot(a.normal);
    if (d0 < 0 || d1 > 0) continue;
    const t = d0 / (d0 - d1 || 1);
    const at = prev.clone().lerp(b.p, t);
    if (!insideHole(a, at)) continue;
    const speed = Math.max(BALL_EXIT.min, Math.min(BALL_EXIT.max, b.v.length()));
    b.p.copy(mapPoint(a, c, at)).addScaledVector(c.normal, BALL_R + 0.05);
    b.v.copy(mapDir(a, c, b.v).normalize().multiplyScalar(speed));
    return false;
  }

  // Walls and ceiling.
  const lim = H - BALL_R;
  if (Math.abs(b.p.x) > lim) [b.p.x, b.v.x] = [Math.sign(b.p.x) * lim, -b.v.x * 0.5];
  if (Math.abs(b.p.z) > lim) [b.p.z, b.v.z] = [Math.sign(b.p.z) * lim, -b.v.z * 0.5];
  if (b.p.y > ROOM.height - BALL_R) [b.p.y, b.v.y] = [ROOM.height - BALL_R, -Math.abs(b.v.y) * 0.3];

  // The basin catches anything that comes down inside its funnel.
  if (b.p.y < BASIN.top + BALL_R && b.v.y < 0 && Math.hypot(b.p.x - BASIN.x, b.p.z - BASIN.z) < BASIN.catch) {
    b.state = 'caught';
    b.p.set(BASIN.x, BASIN.top, BASIN.z);
    b.v.set(0, 0, 0);
    return true;
  }

  const floor = floorAt(b.p.x, b.p.z, portals);
  if (b.p.y < floor + BALL_R) {
    b.p.y = floor + BALL_R;
    if (b.v.y < -1.5) {
      b.v.y = -b.v.y * 0.45;
      b.v.x *= 0.7;
      b.v.z *= 0.7;
    } else {
      b.v.y = 0;
      b.v.x *= 1 - Math.min(1, dt * 2);
      b.v.z *= 1 - Math.min(1, dt * 2);
    }
  }
  if (b.v.lengthSq() < 0.04 && b.p.y <= floor + BALL_R + 0.01) b.rest += dt;
  if (b.age > 9 || b.rest > 1.2 || b.p.y < -4) b.state = 'gone';
  return false;
}
