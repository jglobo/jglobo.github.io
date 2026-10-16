// Jose's coastal garage kit (assets/*.glb, his own models): where each piece goes,
// copied from his scene_layout.json, plus extra road pieces that join his junction to
// the town's ring road. Pure data so the collision map can use it in tests.
// Positions are kit coordinates; KIT_ORIGIN moves the whole kit into the world.

export type KitFile =
  | 'garage_shell' | 'garage_sign' | 'sports_car_bay' | 'bicycle_bay' | 'utility_cabinet' | 'bollard'
  | 'street_lamp' | 'road_t_junction' | 'road_straight' | 'boost_ramp' | 'grass_verge';

export interface KitPiece { file: KitFile; position: [number, number, number]; rotationY: number }

/** The garage sits just inside the ring road, open to the south. */
export const KIT_ORIGIN = { x: 0, z: 2 };

const piece = (file: KitFile, x: number, y: number, z: number, rotationY = 0): KitPiece => ({ file, position: [x, y, z], rotationY });

export const KIT_PIECES: KitPiece[] = [
  piece('garage_shell', 0, 0, 0),
  piece('garage_sign', 0, 2.45, 2.43),
  piece('sports_car_bay', -1.7, 0.025, 0.18),
  piece('bicycle_bay', 1.7, 0.025, 0.2),
  piece('utility_cabinet', 3.28, 0.02, -1.8, -0.1),
  ...[-3.15, -1.9, -0.64, 0.64, 1.9, 3.15].map((x) => piece('bollard', x, 0.02, -2)),
  piece('street_lamp', -2.35, 0, 6.55),
  piece('street_lamp', 3.85, 0, 2.8),
  piece('road_t_junction', 0, 0, 7.8),
  // Jose's extension, then more of the same road west to the ring road (x = -28).
  ...[-5.8, -9.8, -13.8, -17.8, -21.8, -25.8].map((x) => piece('road_straight', x, 0, 7.8, Math.PI / 2)),
  piece('boost_ramp', 4.5, 0, 7.2, -0.15),
  ...[[-3, 3.8], [-3, 5.8], [3, 3.8], [3, 5.8], [-5, 0], [5.1, 0], [5.1, 2]].map(([x, z]) => piece('grass_verge', x, -0.005, z)),
];

/** Where the car and the bike are parked (kit coordinates; both face out, +z). */
export const KIT_PARKED = {
  'sports-car': { x: -1.7, z: 0.3 },
  bicycle: { x: 1.7, z: 0.2 },
};

/** Footprints in kit coordinates, measured from the models. */
export const KIT_SIZES = {
  garage: { halfW: 4.2, back: -2.47, front: 2.47, height: 3.5, wall: 0.35 },
  roadHalfW: 1.96,
  junction: { halfW: 3.8, barMinZ: -1.94, barMaxZ: 1.94, stemMinZ: -5.5 },
  ramp: { length: 2.3, width: 1.8, height: 0.44 },
  bollardR: 0.2,
  lampR: 0.2,
  cabinetR: 0.5,
};
