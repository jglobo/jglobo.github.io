// The timeline town: ground that shifts from village green to a modern district,
// the cobbled path, walkways to each building, trees, lamps, year signposts and
// the plaza at the end of the road.
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import {
  AdditiveBlending, BufferAttribute, BufferGeometry, CircleGeometry, Color, ConeGeometry, Group, IcosahedronGeometry, InstancedMesh, Mesh,
  MeshStandardMaterial, Object3D, OctahedronGeometry, PlaneGeometry, RepeatWrapping, SpriteMaterial,
} from 'three';
import { journey } from '../../content';
import { useGame } from '../../stores/gameStore';
import { qualityProfile } from '../../stores/settingsStore';
import { rng } from '../../utils/random';
import { Building, Sign, type Kit } from './Buildings';
import { PATH_HALF, districtAt, pathX, type TownLayout } from './layout';
import { cobbleDetail, glowTexture, groundDetail } from './textures';
import { useOwned } from './useOwned';

const GROUND: Record<string, string> = {
  home: '#86b553', 'old-town': '#93b04f', island: '#9cb957', market: '#98a852', healthcare: '#86ab68', data: '#7fa076', tech: '#7a9a9c',
};
const PATH: Record<string, string> = {
  home: '#c9a878', 'old-town': '#cdb48e', island: '#e3d1a4', market: '#c2ae92', healthcare: '#c9c7bd', data: '#b4b8bd', tech: '#a9b6c8',
};
const FOLIAGE: Record<string, string[]> = {
  home: ['#5d9a3a', '#6fae44', '#e0a43a'],
  'old-town': ['#d98c2e', '#c8622a', '#e7b440'],
  island: ['#4f9a3a', '#63a845', '#7cba4a'],
  market: ['#5f9a3c', '#d9a23a', '#7aa844'],
  healthcare: ['#4f8f52', '#5e9e5a', '#79b060'],
  data: ['#4a8a62', '#5a9a70', '#6aa880'],
  tech: ['#3f8a7a', '#4f9a8a', '#6fb3a0'],
};

/** Blends the district colour over a few metres so districts fade into each other. */
function tint(layout: TownLayout, table: Record<string, string>, z: number, out: Color) {
  const c = new Color();
  out.setRGB(0, 0, 0);
  for (const dz of [-4, 0, 4]) out.add(c.set(table[districtAt(layout, z + dz)] ?? table.home));
  return out.multiplyScalar(1 / 3);
}

export function Town({ kit, layout }: { kit: Kit; layout: TownLayout }) {
  const shadows = qualityProfile().shadows;
  const { bounds } = layout;

  const ground = useOwned(() => {
    const len = bounds.maxZ - bounds.minZ + 60;
    const geo = new PlaneGeometry(bounds.halfWidth * 2 + 70, len, 24, 90);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position as BufferAttribute;
    const colors = new Float32Array(pos.count * 3);
    const c = new Color();
    const r = rng(3);
    const midZ = (bounds.maxZ + bounds.minZ) / 2;
    for (let i = 0; i < pos.count; i++) {
      const z = pos.getZ(i) + midZ;
      const x = pos.getX(i);
      pos.setX(i, x + pathX(z));
      tint(layout, GROUND, z, c);
      const n = 0.94 + r() * 0.1;
      colors.set([c.r * n, c.g * n, c.b * n], i * 3);
    }
    geo.setAttribute('color', new BufferAttribute(colors, 3));
    geo.translate(0, 0, midZ);
    const map = groundDetail();
    return { geo, map, mat: new MeshStandardMaterial({ map, vertexColors: true, roughness: 1 }) };
  }, [layout]);

  const path = useOwned(() => {
    const start = bounds.maxZ - 2;
    const end = layout.endZ - 2;
    const pts: number[] = [];
    const uvs: number[] = [];
    const cols: number[] = [];
    const idx: number[] = [];
    const c = new Color();
    let v = 0;
    let i = 0;
    for (let z = start; z >= end; z -= 1, i++) {
      const x = pathX(z);
      const dx = (pathX(z - 0.5) - pathX(z + 0.5));
      const len = Math.hypot(dx, 1);
      const nx = 1 / len;
      const nz = dx / len;
      pts.push(x - nx * PATH_HALF, 0.02, z - nz * PATH_HALF, x + nx * PATH_HALF, 0.02, z + nz * PATH_HALF);
      uvs.push(0, v, PATH_HALF * 2, v);
      tint(layout, PATH, z, c);
      cols.push(c.r, c.g, c.b, c.r, c.g, c.b);
      if (i > 0) {
        const a = (i - 1) * 2;
        idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
      v += 1;
    }
    const geo = new BufferGeometry();
    geo.setAttribute('position', new BufferAttribute(new Float32Array(pts), 3));
    geo.setAttribute('uv', new BufferAttribute(new Float32Array(uvs), 2));
    geo.setAttribute('color', new BufferAttribute(new Float32Array(cols), 3));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    const map = cobbleDetail();
    map.wrapS = map.wrapT = RepeatWrapping;
    const mat = new MeshStandardMaterial({ map, vertexColors: true, roughness: 0.95 });
    // Walkways from the path to each door share one plain material per district.
    const walk = new Map<string, MeshStandardMaterial>();
    for (const s of layout.stops) if (!walk.has(s.district)) walk.set(s.district, new MeshStandardMaterial({ color: PATH[s.district], roughness: 0.95 }));
    const plaza = new MeshStandardMaterial({ map, color: '#c9d2de', roughness: 0.9 });
    const plazaGeo = new CircleGeometry(8, 40);
    plazaGeo.rotateX(-Math.PI / 2);
    const sandGeo = new CircleGeometry(1, 32);
    sandGeo.rotateX(-Math.PI / 2);
    const sand = new MeshStandardMaterial({ color: '#ead9a8', roughness: 1 });
    const water = new MeshStandardMaterial({ color: '#3f9ac0', roughness: 0.15, metalness: 0.2, emissive: '#1a4a66', emissiveIntensity: 0.4, transparent: true, opacity: 0.9 });
    return { geo, map, mat, walk: [...walk.values()], walkByDistrict: walk, plaza, plazaGeo, sandGeo, sand, water };
  }, [layout]);

  return (
    <group>
      <mesh geometry={ground.geo} material={ground.mat} receiveShadow />
      <mesh geometry={path.geo} material={path.mat} receiveShadow />
      {layout.sand.map((s, i) => (
        <mesh key={i} geometry={path.sandGeo} material={path.sand} position={[s.x, 0.012, s.z]} scale={s.r} receiveShadow />
      ))}
      {layout.ponds.map((p, i) => (
        <mesh key={i} geometry={path.sandGeo} material={path.water} position={[p.x, 0.05, p.z]} scale={p.r} />
      ))}
      {layout.stops.map((s) => {
        const px = pathX(s.door.z);
        const len = Math.abs(s.cx - px);
        return (
          <mesh key={s.id} geometry={kit.box} material={path.walkByDistrict.get(s.district)!} position={[(s.cx + px) / 2, 0.015, s.door.z - 0.2]} scale={[len, 0.03, 2.2]} receiveShadow />
        );
      })}
      <mesh geometry={path.plazaGeo} material={path.plaza} position={[layout.plaza.x, 0.03, layout.plaza.z]} receiveShadow />
      <Trees layout={layout} kit={kit} shadows={shadows} />
      <Hills layout={layout} />
      <Lamps layout={layout} kit={kit} />
      {layout.stops.map((place) => {
        const stop = journey.stops.find((s) => s.id === place.id)!;
        return (
          <group key={place.id}>
            <Building kit={kit} place={place} stop={stop} />
            <group position={[place.sign.x, 0, place.sign.z]}>
              <mesh geometry={kit.box} material={kit.wood} position={[0, 0.8, 0]} scale={[0.14, 1.6, 0.14]} castShadow={shadows} />
              <Sign kit={kit} title={stop.year} sub="" p={[0, 1.55, 0.09]} width={1.7} bg="#5a3a22" />
            </group>
            <StopBeacon id={place.id} x={place.door.x} z={place.door.z - 1.6} kit={kit} />
          </group>
        );
      })}
      <Plaza layout={layout} kit={kit} />
    </group>
  );
}

/** Floating gold diamond over buildings the visitor has not visited yet. */
function StopBeacon({ id, x, z, kit }: { id: string; x: number; z: number; kit: Kit }) {
  const visited = useGame((s) => s.completedInteractions.includes(`journey:${id}`));
  const ref = useRef<Mesh>(null);
  const geo = useOwned(() => new OctahedronGeometry(0.3, 0));
  useFrame((state) => {
    if (!ref.current) return;
    const t = state.clock.elapsedTime;
    ref.current.rotation.y = t * 1.6;
    ref.current.position.y = 2.9 + Math.sin(t * 2 + x) * 0.12;
  });
  if (visited) return null;
  return <mesh ref={ref} geometry={geo} material={kit.lampGlow} position={[x, 2.9, z + 1.7]} />;
}

function Trees({ layout, kit, shadows }: { layout: TownLayout; kit: Kit; shadows: boolean }) {
  const res = useOwned(() => {
    const n = layout.trees.length;
    const trunk = new InstancedMesh(kit.cyl, kit.wood, n);
    const round = new IcosahedronGeometry(1, 0);
    const cone = new ConeGeometry(1, 2.4, 7);
    const leafMat = new MeshStandardMaterial({ roughness: 0.85, flatShading: true });
    const rounds = new InstancedMesh(round, leafMat, n);
    const cones = new InstancedMesh(cone, leafMat, n);
    const o = new Object3D();
    const c = new Color();
    let ri = 0;
    let ci = 0;
    layout.trees.forEach((t, i) => {
      o.position.set(t.x, 0.7 * t.s, t.z);
      o.rotation.set(0, 0, 0);
      o.scale.set(0.32 * t.s, 1.4 * t.s, 0.32 * t.s);
      o.updateMatrix();
      trunk.setMatrixAt(i, o.matrix);
      const palette = FOLIAGE[districtAt(layout, t.z)] ?? FOLIAGE.home;
      c.set(palette[t.kind % palette.length]);
      o.rotation.set(0, t.x * 3.1, 0);
      if (t.kind === 1) {
        o.position.set(t.x, 2.4 * t.s, t.z);
        o.scale.setScalar(t.s);
        o.updateMatrix();
        cones.setMatrixAt(ci, o.matrix);
        cones.setColorAt(ci++, c);
      } else {
        o.position.set(t.x, 2.1 * t.s, t.z);
        o.scale.set(1.25 * t.s, 1.1 * t.s, 1.25 * t.s);
        o.updateMatrix();
        rounds.setMatrixAt(ri, o.matrix);
        rounds.setColorAt(ri++, c);
      }
    });
    rounds.count = ri;
    cones.count = ci;
    for (const m of [trunk, rounds, cones]) {
      m.castShadow = shadows;
      m.receiveShadow = true;
    }
    return { trunk, rounds, cones, round, cone, leafMat, dispose: () => [trunk, rounds, cones, round, cone, leafMat].forEach((x) => x.dispose()) };
  }, [layout, kit, shadows]);
  return (
    <>
      <primitive object={res.trunk} />
      <primitive object={res.rounds} />
      <primitive object={res.cones} />
    </>
  );
}

/** Soft hills just past the town edge so the world feels enclosed. */
function Hills({ layout }: { layout: TownLayout }) {
  const res = useOwned(() => {
    const spots: { x: number; z: number; s: number }[] = [];
    const r = rng(41);
    for (let z = layout.bounds.maxZ + 10; z > layout.bounds.minZ - 20; z -= 11) {
      for (const side of [-1, 1]) spots.push({ x: pathX(z) + side * (layout.bounds.halfWidth + 9 + r() * 6), z, s: 8 + r() * 6 });
    }
    for (let x = -30; x <= 30; x += 12) spots.push({ x, z: layout.bounds.minZ - 18 - r() * 6, s: 12 + r() * 8 });
    const geo = new IcosahedronGeometry(1, 1);
    const mat = new MeshStandardMaterial({ roughness: 1, flatShading: true });
    const m = new InstancedMesh(geo, mat, spots.length);
    const o = new Object3D();
    const c = new Color();
    spots.forEach((p, i) => {
      o.position.set(p.x, -p.s * 0.45, p.z);
      o.scale.set(p.s * 1.3, p.s, p.s);
      o.updateMatrix();
      m.setMatrixAt(i, o.matrix);
      m.setColorAt(i, c.set(GROUND[districtAt(layout, p.z)] ?? GROUND.home).multiplyScalar(0.85 + r() * 0.15));
    });
    m.receiveShadow = true;
    return { m, geo, mat, dispose: () => [m, geo, mat].forEach((x) => x.dispose()) };
  }, [layout]);
  return <primitive object={res.m} />;
}

function Lamps({ layout, kit }: { layout: TownLayout; kit: Kit }) {
  const res = useOwned(() => {
    const n = layout.lamps.length;
    const posts = new InstancedMesh(kit.box, kit.iron, n);
    const lights = new InstancedMesh(kit.box, kit.lampGlow, n);
    const o = new Object3D();
    layout.lamps.forEach((l, i) => {
      o.position.set(l.x, 1.3, l.z);
      o.scale.set(0.1, 2.6, 0.1);
      o.updateMatrix();
      posts.setMatrixAt(i, o.matrix);
      o.position.set(l.x, 2.75, l.z);
      o.scale.set(0.34, 0.42, 0.34);
      o.updateMatrix();
      lights.setMatrixAt(i, o.matrix);
    });
    posts.castShadow = qualityProfile().shadows;
    const glow = glowTexture();
    const sprite = new SpriteMaterial({ map: glow, color: '#ffc46b', blending: AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.8 });
    return { posts, lights, glow, sprite, dispose: () => [posts, lights, glow, sprite].forEach((x) => x.dispose()) };
  }, [layout, kit]);
  return (
    <>
      <primitive object={res.posts} />
      <primitive object={res.lights} />
      {layout.lamps.map((l, i) => (
        <sprite key={i} material={res.sprite} position={[l.x, 2.75, l.z]} scale={1.8} />
      ))}
    </>
  );
}

/** End of the road: the current chapter (this portfolio) and the way home. */
function Plaza({ layout, kit }: { layout: TownLayout; kit: Kit }) {
  const ring = useRef<Group>(null);
  const gold = useOwned(() => new MeshStandardMaterial({ color: '#ffcf6a', emissive: '#ffb52e', emissiveIntensity: 1.4, metalness: 0.4, roughness: 0.3 }));
  const core = useOwned(() => new OctahedronGeometry(0.6, 0));
  useFrame((state) => {
    if (!ring.current) return;
    const t = state.clock.elapsedTime;
    ring.current.rotation.y = t * 0.6;
    ring.current.position.y = 2.4 + Math.sin(t * 1.4) * 0.15;
  });
  const { x, z } = layout.plaza;
  const pedestal = useMemo(() => [x, 0.5, z] as [number, number, number], [x, z]);
  return (
    <group>
      <mesh geometry={kit.cyl} material={kit.concrete} position={pedestal} scale={[2.4, 1, 2.4]} castShadow={qualityProfile().shadows} receiveShadow />
      <group ref={ring} position={[x, 2.4, z]}>
        <mesh geometry={kit.torus} material={gold} rotation-x={Math.PI / 2} scale={0.9} />
        <mesh geometry={kit.torus} material={gold} rotation-x={0.6} scale={0.7} />
        <mesh geometry={core} material={gold} />
      </group>
      <Sign kit={kit} title="Today" sub="Building this portfolio" p={[x, 1.3, z + 1.25]} width={2.4} bg="#1d2a3f" accent="#ffd27a" />
    </group>
  );
}
