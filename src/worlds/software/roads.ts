// The town's road network, built only from Jose's kit pieces: his straight road and
// T-junction, with his street lamps and grass verges along the roads. Pure data so
// the collision map and the tests can use it; KitTown.tsx draws it.
// x runs east, z runs south, y is up. Rotations are three.js rotation.y.

export type RoadFile = 'road_straight' | 'road_t_junction';

/** A placed model: position, turn, and a stretch along its length (straights only). */
export interface Placed { x: number; z: number; rotationY: number; stretch?: number }

export interface Rect { minX: number; maxX: number; minZ: number; maxZ: number }

/** Road piece sizes, measured from the models. */
export const ROAD_HALF_W = 1.96;
const STRAIGHT_LEN = 4;
/** T-junction: the bar runs along local x through the origin, the stem leaves along local -z. */
const T = { halfW: 3.8, barHalf: 1.94, stemEnd: 5.5 };

/** A junction: the bar runs east-west (stem 'n' or 's') or north-south (stem 'e' or 'w'). */
interface Junction { x: number; z: number; stem: 'n' | 's' | 'e' | 'w' }
/** A straight run of road between two points on one axis. */
interface Run { x0: number; z0: number; x1: number; z1: number }

const STEM_ROT = { n: 0, s: Math.PI, w: Math.PI / 2, e: -Math.PI / 2 } as const;
const DIR = { n: [0, -1], s: [0, 1], e: [1, 0], w: [-1, 0] } as const;

/** The garage junction is part of Jose's kit layout (garage at z 2, junction at z 9.8). */
const AVENUE_Z = 9.8;
const JUNCTIONS: Record<string, Junction> = {
  garage: { x: 0, z: AVENUE_Z, stem: 'n' },
  south: { x: -20, z: AVENUE_Z, stem: 's' },
  west: { x: -34, z: AVENUE_Z, stem: 'n' },
  northWest: { x: -34, z: -26, stem: 'e' },
  downtown: { x: 0, z: -26, stem: 'n' },
  northEast: { x: 30, z: -26, stem: 'w' },
};

/** End of a junction's bar on one side, or of its stem. */
function barEnd(j: Junction, side: 'n' | 's' | 'e' | 'w') {
  const [dx, dz] = DIR[side];
  return { x: j.x + dx * T.halfW, z: j.z + dz * T.halfW };
}
function stemEnd(j: Junction) {
  const [dx, dz] = DIR[j.stem];
  return { x: j.x + dx * T.stemEnd, z: j.z + dz * T.stemEnd };
}
const run = (a: { x: number; z: number }, b: { x: number; z: number }): Run => ({ x0: a.x, z0: a.z, x1: b.x, z1: b.z });

const J = JUNCTIONS;
const RUNS: Run[] = [
  // The avenue west from the garage (Jose's ramp ends it on the east).
  run(barEnd(J.garage, 'w'), barEnd(J.south, 'e')),
  run(barEnd(J.south, 'w'), barEnd(J.west, 'e')),
  // South to the jump, north to the cross street and on to a dead end.
  run(stemEnd(J.south), { x: J.south.x, z: 34 }),
  run(stemEnd(J.west), barEnd(J.northWest, 's')),
  run(barEnd(J.northWest, 'n'), { x: J.northWest.x, z: -40 }),
  // The cross street, downtown boulevard and the east road.
  run(stemEnd(J.northWest), barEnd(J.downtown, 'w')),
  run(barEnd(J.downtown, 'e'), stemEnd(J.northEast)),
  run(stemEnd(J.downtown), { x: J.downtown.x, z: -60 }),
  run(barEnd(J.northEast, 'n'), { x: J.northEast.x, z: -40 }),
  run(barEnd(J.northEast, 's'), { x: J.northEast.x, z: 40 }),
];

function runInfo(r: Run) {
  const alongX = r.z0 === r.z1;
  const len = alongX ? Math.abs(r.x1 - r.x0) : Math.abs(r.z1 - r.z0);
  return { alongX, len, cx: (r.x0 + r.x1) / 2, cz: (r.z0 + r.z1) / 2 };
}

/** Straights tile each run; a run that is not a whole number of pieces stretches them slightly. */
export const STRAIGHTS: Placed[] = RUNS.flatMap((r) => {
  const { alongX, len } = runInfo(r);
  const n = Math.max(1, Math.round(len / STRAIGHT_LEN));
  const step = len / n;
  return Array.from({ length: n }, (_, i) => {
    const t = (i + 0.5) / n;
    return {
      x: r.x0 + (r.x1 - r.x0) * t,
      z: r.z0 + (r.z1 - r.z0) * t,
      // The straight's length runs along its local z.
      rotationY: alongX ? Math.PI / 2 : 0,
      stretch: step / STRAIGHT_LEN,
    };
  });
});

export const T_JUNCTIONS: Placed[] = Object.values(JUNCTIONS).map((j) => ({ x: j.x, z: j.z, rotationY: STEM_ROT[j.stem] }));

/** Driveable road areas (for top speed and keeping trees off). */
export const ROAD_RECTS: Rect[] = [
  ...RUNS.map((r) => {
    const { alongX, cx, cz, len } = runInfo(r);
    const hx = alongX ? len / 2 : ROAD_HALF_W;
    const hz = alongX ? ROAD_HALF_W : len / 2;
    return { minX: cx - hx, maxX: cx + hx, minZ: cz - hz, maxZ: cz + hz };
  }),
  ...Object.values(JUNCTIONS).flatMap((j) => {
    const ns = j.stem === 'n' || j.stem === 's';
    const bar = ns
      ? { minX: j.x - T.halfW, maxX: j.x + T.halfW, minZ: j.z - T.barHalf, maxZ: j.z + T.barHalf }
      : { minX: j.x - T.barHalf, maxX: j.x + T.barHalf, minZ: j.z - T.halfW, maxZ: j.z + T.halfW };
    const e = stemEnd(j);
    const stem = ns
      ? { minX: j.x - ROAD_HALF_W, maxX: j.x + ROAD_HALF_W, minZ: Math.min(e.z, j.z), maxZ: Math.max(e.z, j.z) }
      : { minX: Math.min(e.x, j.x), maxX: Math.max(e.x, j.x), minZ: j.z - ROAD_HALF_W, maxZ: j.z + ROAD_HALF_W };
    return [bar, stem];
  }),
];

/** Street lamps along every run, alternating sides, clear of the junctions. */
export const LAMPS: Placed[] = RUNS.flatMap((r, ri) => {
  const { alongX, len } = runInfo(r);
  const n = Math.floor(len / 14);
  return Array.from({ length: n }, (_, i) => {
    const t = (i + 0.5) / n;
    const side = (i + ri) % 2 ? 1 : -1;
    const off = (ROAD_HALF_W + 0.55) * side;
    return {
      x: r.x0 + (r.x1 - r.x0) * t + (alongX ? 0 : off),
      z: r.z0 + (r.z1 - r.z0) * t + (alongX ? off : 0),
      rotationY: 0,
    };
  });
});

/** Grass verges lining both sides of every run. */
export const VERGES: Placed[] = RUNS.flatMap((r) => {
  const { alongX, len } = runInfo(r);
  const n = Math.max(1, Math.round(len / 2));
  return Array.from({ length: n }, (_, i) => i).flatMap((i) => {
    const t = (i + 0.5) / n;
    const x = r.x0 + (r.x1 - r.x0) * t;
    const z = r.z0 + (r.z1 - r.z0) * t;
    return [-1, 1].map((side) => {
      const off = (ROAD_HALF_W + 1.05) * side;
      return { x: x + (alongX ? 0 : off), z: z + (alongX ? off : 0), rotationY: 0 };
    });
  });
});
