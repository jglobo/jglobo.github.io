// The test chamber: a bright, original lab built from primitives and canvas textures.
// White tiled panels take portals; grey concrete and dark metal do not. The pit (data
// science), the chasm and ledge (journey) and the door openings are cut out of the
// floor and walls. Puzzle props live in Puzzles.tsx.
import { useEffect, useMemo } from 'react';
import { BackSide, CanvasTexture, MeshStandardMaterial, PlaneGeometry, RepeatWrapping, SRGBColorSpace, type Texture } from 'three';
import { profile } from '../../content';
import { qualityProfile } from '../../stores/settingsStore';
import { makeTextTexture } from '../../utils/textTexture';
import { rng } from '../../utils/random';
import { CHASM, DOORS, PIT, ROOM, SURFACES, type DoorWorld, type Surface } from './chamber';
import { aimTarget } from './hubAim';

const H = ROOM.half;

function canvasTexture(size: number, draw: (g: CanvasRenderingContext2D, s: number) => void) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  draw(c.getContext('2d')!, size);
  const t = new CanvasTexture(c);
  t.wrapS = t.wrapT = RepeatWrapping;
  t.colorSpace = SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/** Square tiles with grout and a faint per-tile shade, `n` tiles across the texture. */
function tiles(base: [number, number, number], grout: string, n: number, seed: number, vary = 6) {
  const r = rng(seed);
  return canvasTexture(512, (g, s) => {
    const step = s / n;
    for (let i = 0; i < n; i++)
      for (let j = 0; j < n; j++) {
        const k = (r() - 0.5) * vary;
        g.fillStyle = `rgb(${base[0] + k},${base[1] + k},${base[2] + k})`;
        g.fillRect(i * step, j * step, step, step);
      }
    g.strokeStyle = grout;
    g.lineWidth = 5;
    for (let i = 0; i <= n; i++) {
      g.beginPath();
      g.moveTo(i * step, 0);
      g.lineTo(i * step, s);
      g.moveTo(0, i * step);
      g.lineTo(s, i * step);
      g.stroke();
    }
  });
}

/** Concrete: speckled grey with large panel seams. */
function concrete(seed: number) {
  const r = rng(seed);
  return canvasTexture(512, (g, s) => {
    g.fillStyle = '#a3a8ac';
    g.fillRect(0, 0, s, s);
    for (let i = 0; i < 2600; i++) {
      const v = 140 + r() * 50;
      g.fillStyle = `rgba(${v},${v + 2},${v + 4},0.35)`;
      g.fillRect(r() * s, r() * s, 1 + r() * 3, 1 + r() * 3);
    }
    g.strokeStyle = 'rgba(70,76,82,0.55)';
    g.lineWidth = 4;
    g.strokeRect(2, 2, s - 4, s - 4);
    g.beginPath();
    g.moveTo(s / 2, 0);
    g.lineTo(s / 2, s);
    g.stroke();
  });
}

/** A plane whose UVs are in tiles, so one shared texture tiles at the same scale everywhere. */
function tiledPlane(w: number, h: number, tileMeters: number) {
  const geo = new PlaneGeometry(w, h);
  const uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) * w) / tileMeters, (uv.getY(i) * h) / tileMeters);
  return geo;
}

function useChamberMaterials() {
  const m = useMemo(() => {
    const white = tiles([238, 241, 243], '#c4cad0', 4, 3, 7);
    const floorTex = tiles([92, 98, 104], '#474c52', 4, 5, 10);
    const ceilingTex = tiles([120, 126, 132], '#596066', 2, 9, 6);
    const wallTex = concrete(7);
    return {
      textures: [white, floorTex, ceilingTex, wallTex] as Texture[],
      white: new MeshStandardMaterial({ map: white, roughness: 0.55, metalness: 0 }),
      floor: new MeshStandardMaterial({ map: floorTex, roughness: 0.7, metalness: 0.15 }),
      ceiling: new MeshStandardMaterial({ map: ceilingTex, roughness: 0.9 }),
      wall: new MeshStandardMaterial({ map: wallTex, roughness: 0.92 }),
      metal: new MeshStandardMaterial({ color: '#3a4046', roughness: 0.45, metalness: 0.6 }),
      trim: new MeshStandardMaterial({ color: '#e9ecee', roughness: 0.5 }),
      light: new MeshStandardMaterial({ color: '#ffffff', emissive: '#f4f8ff', emissiveIntensity: 1.6, toneMapped: false }),
      cyan: new MeshStandardMaterial({ color: '#7fe9ff', emissive: '#3fd8ff', emissiveIntensity: 1.4, toneMapped: false }),
      pit: new MeshStandardMaterial({ color: '#1d2a3a', roughness: 0.8, side: BackSide }),
      chasm: new MeshStandardMaterial({ color: '#20262c', roughness: 1, side: BackSide }),
      glass: new MeshStandardMaterial({ color: '#cfefff', transparent: true, opacity: 0.25, roughness: 0.05, metalness: 0.1, depthWrite: false }),
    };
  }, []);
  useEffect(
    () => () => {
      m.textures.forEach((t) => t.dispose());
      Object.values(m).forEach((x) => (x as { isMaterial?: boolean }).isMaterial && (x as MeshStandardMaterial).dispose());
    },
    [m],
  );
  return m;
}
export type ChamberMaterials = ReturnType<typeof useChamberMaterials>;

/** Wall pieces around a door opening (or the whole wall). Each wall is listed from its own left to right. */
function wallPieces(door?: DoorWorld) {
  const L = H * 2;
  if (!door) return [{ cx: 0, cy: ROOM.height / 2, w: L, h: ROOM.height }];
  const d = DOORS[door];
  const side = (L / 2 - d.halfW) / 2 + d.halfW;
  return [
    { cx: -side, cy: ROOM.height / 2, w: L / 2 - d.halfW, h: ROOM.height },
    { cx: side, cy: ROOM.height / 2, w: L / 2 - d.halfW, h: ROOM.height },
    { cx: 0, cy: (d.height + ROOM.height) / 2, w: d.halfW * 2, h: ROOM.height - d.height },
  ];
}

const WALLS: { id: string; pos: [number, number, number]; rotY: number; door?: DoorWorld }[] = [
  { id: 'north', pos: [0, 0, -H], rotY: 0, door: 'games' },
  { id: 'south', pos: [0, 0, H], rotY: Math.PI, door: 'journey' },
  { id: 'west', pos: [-H, 0, 0], rotY: Math.PI / 2, door: 'software' },
  { id: 'east', pos: [H, 0, 0], rotY: -Math.PI / 2 },
];

/** Floor pieces around the pit and the chasm: [minX, maxX, minZ, maxZ]. */
const FLOOR: [number, number, number, number][] = [
  [-H, H, -H, PIT.minZ],
  [-H, PIT.minX, PIT.minZ, PIT.maxZ],
  [PIT.maxX, H, PIT.minZ, PIT.maxZ],
  [-H, H, PIT.maxZ, CHASM.minZ],
  [-H, H, CHASM.maxZ, H],
];

export function HubEnvironment() {
  const m = useChamberMaterials();
  const shadows = qualityProfile().shadows;
  const geos = useMemo(() => {
    const walls = WALLS.map((w) => wallPieces(w.door).map((p) => ({ ...p, geo: tiledPlane(p.w, p.h, 4) })));
    const floor = FLOOR.map(([x0, x1, z0, z1]) => ({ x: (x0 + x1) / 2, z: (z0 + z1) / 2, geo: tiledPlane(x1 - x0, z1 - z0, 4) }));
    const panels = SURFACES.filter((s) => s.id !== 'platform').map((s) => ({ s, geo: tiledPlane(s.halfU * 2, s.halfV * 2, 4) }));
    const ceiling = tiledPlane(H * 2, H * 2, 4);
    return { walls, floor, panels, ceiling };
  }, []);
  useEffect(
    () => () => {
      geos.walls.flat().forEach((p) => p.geo.dispose());
      geos.floor.forEach((p) => p.geo.dispose());
      geos.panels.forEach((p) => p.geo.dispose());
      geos.ceiling.dispose();
    },
    [geos],
  );
  const title = useMemo(
    () =>
      makeTextTexture(
        [
          { text: profile.name.toUpperCase(), size: 120, weight: '800', color: '#1f2a37' },
          { text: 'PORTAL HUB · TEST CHAMBER 01', size: 50, weight: '700', color: '#55606c' },
        ],
        { width: 1400, height: 380, background: '#f4f6f7' },
      ),
    [],
  );
  useEffect(() => () => title.dispose(), [title]);

  return (
    <group>
      {/* Floor (with the pit and chasm cut out) and ceiling */}
      {geos.floor.map((f, i) => (
        <mesh key={i} ref={aimTarget} geometry={f.geo} material={m.floor} position={[f.x, 0, f.z]} rotation-x={-Math.PI / 2} receiveShadow />
      ))}
      <mesh ref={aimTarget} geometry={geos.ceiling} material={m.ceiling} position-y={ROOM.height} rotation-x={Math.PI / 2} />
      <CeilingLights m={m} />

      {/* Concrete walls, open where the doors are */}
      {WALLS.map((w, i) => (
        <group key={w.id} position={w.pos} rotation-y={w.rotY}>
          {geos.walls[i].map((p, j) => (
            <mesh key={j} ref={aimTarget} geometry={p.geo} material={m.wall} position={[p.cx, p.cy, 0]} receiveShadow />
          ))}
          {/* Skirting and a light strip near the top */}
          <mesh position={[0, 0.08, 0.04]} material={m.metal}>
            <boxGeometry args={[H * 2, 0.16, 0.08]} />
          </mesh>
          <mesh position={[0, ROOM.height - 0.5, 0.05]} material={m.light}>
            <boxGeometry args={[H * 2 - 2, 0.08, 0.06]} />
          </mesh>
        </group>
      ))}

      {/* Portal-compatible white panels, with a thin metal frame */}
      {geos.panels.map(({ s, geo }) => (
        <PanelMesh key={s.id} s={s} geo={geo} m={m} />
      ))}

      {/* Title above the games door */}
      <mesh position={[0, 6.6, -H + 0.04]}>
        <planeGeometry args={[6.2, 1.68]} />
        <meshStandardMaterial map={title} roughness={0.6} />
      </mesh>

      {/* Corner light columns */}
      {[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sz]) => (
        <group key={`${sx}${sz}`} position={[sx * (H - 0.35), 0, sz * (H - 0.35)]}>
          <mesh position-y={ROOM.height / 2} material={m.metal} castShadow={shadows}>
            <boxGeometry args={[0.7, ROOM.height, 0.7]} />
          </mesh>
          <mesh position={[-sx * 0.36, ROOM.height / 2, -sz * 0.36]} rotation-y={Math.PI / 4} material={m.light}>
            <boxGeometry args={[0.1, ROOM.height - 1.2, 0.1]} />
          </mesh>
        </group>
      ))}

      <Pit m={m} />
      <Chasm m={m} />
    </group>
  );
}

function PanelMesh({ s, geo, m }: { s: Surface; geo: PlaneGeometry; m: ChamberMaterials }) {
  // Orient the plane: +Z to the surface normal, +Y to its up.
  const rot = useMemo(() => {
    const [nx, ny, nz] = s.normal;
    if (ny < -0.5) return [Math.PI / 2, 0, 0] as const; // ceiling, up = +z
    if (ny > 0.5) return [-Math.PI / 2, 0, 0] as const; // floor, up = -z
    return [0, Math.atan2(nx, nz), 0] as const;
  }, [s]);
  const w = s.halfU * 2;
  const h = s.halfV * 2;
  return (
    <group position={s.center} rotation={rot}>
      <mesh ref={aimTarget} geometry={geo} material={m.white} userData={{ surfaceId: s.id }} receiveShadow />
      {[
        [0, h / 2 + 0.04, w + 0.16, 0.08],
        [0, -h / 2 - 0.04, w + 0.16, 0.08],
        [w / 2 + 0.04, 0, 0.08, h],
        [-w / 2 - 0.04, 0, 0.08, h],
      ].map(([x, y, bw, bh], i) => (
        <mesh key={i} position={[x, y, 0.01]} material={m.metal}>
          <boxGeometry args={[bw, bh, 0.04]} />
        </mesh>
      ))}
    </group>
  );
}

function CeilingLights({ m }: { m: ChamberMaterials }) {
  const spots: [number, number][] = [];
  for (let x = -9; x <= 9; x += 6) for (let z = -9; z <= 9; z += 6) if (!(Math.abs(x - 6) < 2 && Math.abs(z + 12) < 3)) spots.push([x, z]);
  return (
    <group>
      {spots.map(([x, z]) => (
        <mesh key={`${x}${z}`} position={[x, ROOM.height - 0.03, z]} rotation-x={Math.PI / 2} material={m.light}>
          <planeGeometry args={[2.4, 0.6]} />
        </mesh>
      ))}
    </group>
  );
}

/** The data science pit: inward-facing walls, glass rails and a blue glow at the bottom. */
function Pit({ m }: { m: ChamberMaterials }) {
  const w = PIT.maxX - PIT.minX;
  const d = PIT.maxZ - PIT.minZ;
  const cx = (PIT.minX + PIT.maxX) / 2;
  const cz = (PIT.minZ + PIT.maxZ) / 2;
  const rails: [number, number, number, number][] = [
    [PIT.minX - 0.05, cz, 0.06, d + 0.1],
    [cx + 0.1, PIT.minZ - 0.05, w + 0.2, 0.06],
    [cx + 0.1, PIT.maxZ + 0.05, w + 0.2, 0.06],
  ];
  return (
    <group>
      <mesh position={[cx, -PIT.depth / 2, cz]} material={m.pit}>
        <boxGeometry args={[w, PIT.depth, d]} />
      </mesh>
      {rails.map(([x, z, rw, rd], i) => (
        <group key={i}>
          <mesh position={[x, 0.55, z]} material={m.glass}>
            <boxGeometry args={[rw, 1.1, rd]} />
          </mesh>
          <mesh position={[x, 1.12, z]} material={m.metal}>
            <boxGeometry args={[Math.max(rw, 0.08), 0.06, Math.max(rd, 0.08)]} />
          </mesh>
        </group>
      ))}
      {/* Edge lights */}
      <mesh position={[PIT.minX + 0.02, -0.15, cz]} material={m.cyan}>
        <boxGeometry args={[0.04, 0.06, d]} />
      </mesh>
    </group>
  );
}

/** The journey chasm across the south end, in front of the ledge. */
function Chasm({ m }: { m: ChamberMaterials }) {
  const d = CHASM.maxZ - CHASM.minZ;
  const cz = (CHASM.minZ + CHASM.maxZ) / 2;
  return (
    <group>
      <mesh position={[0, -3, cz]} material={m.chasm}>
        <boxGeometry args={[H * 2, 6, d]} />
      </mesh>
      <mesh position={[0, -5.9, cz]} rotation-x={-Math.PI / 2}>
        <planeGeometry args={[H * 2, d]} />
        <meshBasicMaterial color="#4fb6c9" transparent opacity={0.35} toneMapped={false} />
      </mesh>
      {[CHASM.minZ, CHASM.maxZ].map((z) => (
        <mesh key={z} position={[0, 0.01, z]} material={m.trim}>
          <boxGeometry args={[H * 2, 0.04, 0.12]} />
        </mesh>
      ))}
    </group>
  );
}
