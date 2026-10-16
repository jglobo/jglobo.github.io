// Jose's coastal neighbourhood (assets/*.glb, his own models): houses and buildings
// lining the town's roads, and his trees. Footprints are copied from his
// neighborhood_manifest.json. Pure data so the collision map can use it in tests.
// Every model faces +z (its front door); rotationY turns it towards its road.

export type HouseFile = 'house_fisher_cottage' | 'house_sage_veranda' | 'house_courtyard_villa';
export type BuildingFile = 'building_corner_shop' | 'building_civic_hall' | 'building_terrace_apartments';
export type TreeFile = 'tree_coastal_pine' | 'tree_broadleaf' | 'tree_cypress' | 'tree_windswept_palm';
export type NeighborhoodFile = HouseFile | BuildingFile;

/** Model bounds on the ground (x, z) and height, from the manifest. */
export const FOOTPRINTS: Record<NeighborhoodFile, { minX: number; maxX: number; minZ: number; maxZ: number; height: number }> = {
  house_fisher_cottage: { minX: -2.14, maxX: 2.14, minZ: -1.83, maxZ: 1.96, height: 3.84 },
  house_sage_veranda: { minX: -2.02, maxX: 2.02, minZ: -1.98, maxZ: 3.07, height: 4.87 },
  house_courtyard_villa: { minX: -2.4, maxX: 2.4, minZ: -1.88, maxZ: 2.69, height: 3.74 },
  building_corner_shop: { minX: -2.4, maxX: 2.4, minZ: -2.0, maxZ: 2.87, height: 5.21 },
  building_civic_hall: { minX: -2.75, maxX: 2.75, minZ: -2.1, maxZ: 2.74, height: 5.31 },
  building_terrace_apartments: { minX: -2.55, maxX: 2.55, minZ: -2.1, maxZ: 2.46, height: 8.55 },
};

/** Which way the front faces. */
const FACE = { s: 0, e: Math.PI / 2, n: Math.PI, w: -Math.PI / 2 } as const;

export interface Lot { file: NeighborhoodFile; x: number; z: number; rotationY: number }
const lot = (file: NeighborhoodFile, x: number, z: number, face: keyof typeof FACE): Lot => ({ file, x, z, rotationY: FACE[face] });

const HOUSES: HouseFile[] = ['house_fisher_cottage', 'house_sage_veranda', 'house_courtyard_villa'];
const house = (i: number) => HOUSES[i % HOUSES.length];

export const LOTS: Lot[] = [
  // Downtown: shops, the civic hall and apartments face the boulevard and sit on the old city blocks.
  lot('building_corner_shop', -5.9, -46, 'e'),
  lot('building_civic_hall', -5.9, -52.5, 'e'),
  lot('building_terrace_apartments', -5.9, -59, 'e'),
  lot('building_terrace_apartments', 5.9, -46, 'w'),
  lot('building_corner_shop', 5.9, -52.5, 'w'),
  lot('building_civic_hall', 5.9, -59, 'w'),
  lot('building_civic_hall', -22, -52, 's'),
  lot('building_terrace_apartments', -15.5, -52, 's'),
  lot('building_corner_shop', 14.5, -54, 's'),
  lot('building_terrace_apartments', 20.5, -54, 's'),
  lot('building_civic_hall', 29, -50, 's'),
  lot('building_corner_shop', -35, -56, 's'),
  lot('building_terrace_apartments', 54, -34, 's'),
  lot('building_corner_shop', 54, -27, 's'),
  // Houses along the avenue, the south road, the west road and the east road.
  ...[-13, -27].map((x, i) => lot(house(i), x, 3.8, 's')),
  ...[-8, -31].map((x, i) => lot(house(i + 2), x, 15.5, 'n')),
  ...[17.5, 24].map((z, i) => lot(house(i + 1), -26, z, 'e')),
  ...[17.5, 24].map((z, i) => lot(house(i), -14, z, 'w')),
  ...[-14, -6, 2].map((z, i) => lot(house(i + 1), -40, z, 'e')),
  ...[0, 8, 16].map((z, i) => lot(house(i + 2), 36, z, 'w')),
  ...[4, 12].map((z, i) => lot(house(i), 24, z, 'e')),
  // Out west, where the campus was.
  lot('house_courtyard_villa', -55, -8, 'e'),
  lot('house_sage_veranda', -55, 11, 'e'),
];

/** A lot's footprint in world space (rotations are quarter turns). */
export function lotRect(l: Lot) {
  const f = FOOTPRINTS[l.file];
  const c = Math.round(Math.cos(l.rotationY));
  const s = Math.round(Math.sin(l.rotationY));
  // three.js rotation.y maps local (x, z) to (x c + z s, -x s + z c).
  const xs = [f.minX * c + f.minZ * s, f.maxX * c + f.maxZ * s];
  const zs = [-f.minX * s + f.minZ * c, -f.maxX * s + f.maxZ * c];
  return {
    minX: l.x + Math.min(...xs), maxX: l.x + Math.max(...xs),
    minZ: l.z + Math.min(...zs), maxZ: l.z + Math.max(...zs),
    height: f.height,
  };
}

/** Trees take turns through his four kinds. */
export const TREE_KINDS: TreeFile[] = ['tree_coastal_pine', 'tree_broadleaf', 'tree_cypress', 'tree_windswept_palm'];

/** His billboard, scaled up so its screen reads from the follow camera. */
export const BILLBOARD = {
  scale: 1.6,
  /** Legs stand on footings centred near x = ±2.1 (model units). */
  legX: 2.1,
  /** The screen (Billboard_Display) is 5.8 × 2.55 and spans y 3.39 to 5.95. */
  screen: { w: 5.8, h: 2.55, top: 5.95 },
};
