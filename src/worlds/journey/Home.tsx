// Home: a warm little house with a porch, a fenced yard, a garden, a doghouse and
// a mailbox. Deliberately generic: no house number, street name or real likeness.
import { useMemo } from 'react';
import { InstancedMesh, MeshStandardMaterial, Object3D } from 'three';
import { qualityProfile } from '../../stores/settingsStore';
import { rng } from '../../utils/random';
import type { Kit } from './Buildings';
import { Sign } from './Buildings';
import { prismGeometry } from './geometry';
import { DOGHOUSE, HOUSE, MAILBOX, PORCH, type TownLayout } from './layout';
import { shingleTexture, sidingTexture, windowTiles } from './textures';
import { useOwned } from './useOwned';

export function Home({ kit, layout }: { kit: Kit; layout: TownLayout }) {
  const shadows = qualityProfile().shadows;
  const h = HOUSE;
  const res = useOwned(() => {
    const siding = sidingTexture('#f1dcb4', 4, 3);
    const win = windowTiles('#f1dcb4', '#ffffff', 1, 5, 3, 1);
    const roofMap = shingleTexture('#a4442e', 1, 1);
    const front = new MeshStandardMaterial({ map: win.color, emissive: '#ffffff', emissiveMap: win.glow, emissiveIntensity: 1, roughness: 0.9 });
    const walls = new MeshStandardMaterial({ map: siding, roughness: 0.9 });
    const roof = new MeshStandardMaterial({ map: roofMap, roughness: 0.85 });
    const gable = prismGeometry(h.w + 0.8, 2.4, h.d + 1);
    const smallGable = prismGeometry(PORCH.w + 0.4, 0.9, PORCH.d + 0.5);
    const dogRoof = prismGeometry(DOGHOUSE.w + 0.3, 0.7, DOGHOUSE.d + 0.3);
    const paint = new MeshStandardMaterial({ color: '#c94f3d', roughness: 0.8 });
    const mailBlue = new MeshStandardMaterial({ color: '#3a5a8a', roughness: 0.5, metalness: 0.3 });
    return { siding, win, roofMap, front, walls, roof, gable, smallGable, dogRoof, paint, mailBlue,
      dispose: () => [siding, win.color, win.glow, roofMap, front, walls, roof, gable, smallGable, dogRoof, paint, mailBlue].forEach((x) => x.dispose()) };
  });

  // Picket fence along the yard's fence lines, one instanced mesh.
  const pickets = useMemo(() => {
    const spots: [number, number][] = [];
    for (const f of layout.fences) {
      const alongX = f.maxX - f.minX > f.maxZ - f.minZ;
      const len = alongX ? f.maxX - f.minX : f.maxZ - f.minZ;
      for (let t = 0; t <= len; t += 0.42) spots.push(alongX ? [f.minX + t, (f.minZ + f.maxZ) / 2] : [(f.minX + f.maxX) / 2, f.minZ + t]);
    }
    return spots;
  }, [layout]);
  const picketMesh = useOwned(() => {
    const m = new InstancedMesh(kit.box, kit.trim, pickets.length);
    const o = new Object3D();
    pickets.forEach(([x, z], i) => {
      o.position.set(x, 0.45, z);
      o.scale.set(0.12, 0.9, 0.12);
      o.updateMatrix();
      m.setMatrixAt(i, o.matrix);
    });
    m.castShadow = shadows;
    return { m, dispose: () => m.dispose() };
  }, [pickets, kit]);

  // Garden beds: rows of flowers in front of the porch.
  const flowers = useOwned(() => {
    const r = rng(19);
    const n = 46;
    const m = new InstancedMesh(kit.ball, kit.produce[0], n);
    const o = new Object3D();
    const colors = ['#ff6f91', '#ffd23f', '#ffffff', '#c38bff', '#ff8c42'];
    const c = new MeshStandardMaterial();
    for (let i = 0; i < n; i++) {
      const bed = i % 2 ? 1 : -1;
      o.position.set(h.cx + bed * 3.6 + (r() - 0.5) * 2.2, 0.22, h.cz + h.d / 2 + 1.2 + r() * 1.4);
      o.scale.setScalar(0.22 + r() * 0.12);
      o.updateMatrix();
      m.setMatrixAt(i, o.matrix);
      m.setColorAt(i, c.color.set(colors[Math.floor(r() * colors.length)]));
    }
    c.dispose();
    const mat = new MeshStandardMaterial({ roughness: 0.7 });
    m.material = mat;
    return { m, mat, dispose: () => { m.dispose(); mat.dispose(); } };
  }, [kit]);

  const fz = h.cz + h.d / 2;
  return (
    <group>
      {/* House body: windowed front, sided walls, gable roof and chimney. */}
      <mesh geometry={kit.box} material={[res.walls, res.walls, res.roof, res.roof, res.front, res.walls]} position={[h.cx, h.h / 2 - 0.6, h.cz]} scale={[h.w, h.h - 1.2, h.d]} castShadow={shadows} receiveShadow />
      <mesh geometry={res.gable} material={res.roof} position={[h.cx, h.h - 1.2, h.cz]} castShadow={shadows} />
      <mesh geometry={kit.box} material={kit.concrete} position={[h.cx + 2.4, h.h + 0.6, h.cz - 0.8]} scale={[0.7, 1.6, 0.7]} castShadow={shadows} />
      {/* Porch with posts, a little roof, the front door and a lamp. */}
      <mesh geometry={kit.box} material={kit.wood} position={[PORCH.cx, 0.12, PORCH.cz - 0.2]} scale={[PORCH.w, 0.24, PORCH.d + 0.4]} receiveShadow />
      {[-1, 1].map((s) => (
        <mesh key={s} geometry={kit.box} material={kit.trim} position={[PORCH.cx + s * (PORCH.w / 2 - 0.2), 1.3, PORCH.cz + PORCH.d / 2 - 0.3]} scale={[0.16, 2.4, 0.16]} castShadow={shadows} />
      ))}
      <mesh geometry={res.smallGable} material={res.roof} position={[PORCH.cx, 2.5, PORCH.cz - 0.1]} castShadow={shadows} />
      <mesh geometry={kit.box} material={res.paint} position={[h.cx, 1.1, fz + 0.06]} scale={[1.2, 2.0, 0.1]} />
      <mesh geometry={kit.ball} material={kit.lampGlow} position={[h.cx + 1, 1.9, fz + 0.2]} scale={0.2} />
      <Sign kit={kit} title="Home" sub="Start here" p={[h.cx, 3.05, fz + 0.12]} width={2.4} />
      {/* Fence, garden, doghouse. */}
      <primitive object={picketMesh.m} />
      {layout.fences.map((f, i) => (
        <mesh key={i} geometry={kit.box} material={kit.trim} position={[(f.minX + f.maxX) / 2, 0.62, (f.minZ + f.maxZ) / 2]} scale={[Math.max(0.06, f.maxX - f.minX), 0.08, Math.max(0.06, f.maxZ - f.minZ)]} />
      ))}
      <primitive object={flowers.m} />
      {[-1, 1].map((s) => (
        <mesh key={s} geometry={kit.box} material={kit.darkWood} position={[h.cx + s * 3.6, 0.08, fz + 1.9]} scale={[2.6, 0.16, 1.8]} receiveShadow />
      ))}
      <mesh geometry={kit.box} material={res.paint} position={[DOGHOUSE.cx, 0.5, DOGHOUSE.cz]} scale={[DOGHOUSE.w, 1, DOGHOUSE.d]} castShadow={shadows} />
      <mesh geometry={res.dogRoof} material={res.roof} position={[DOGHOUSE.cx, 1, DOGHOUSE.cz]} castShadow={shadows} />
      <mesh geometry={kit.box} material={kit.darkWood} position={[DOGHOUSE.cx, 0.35, DOGHOUSE.cz + DOGHOUSE.d / 2 + 0.01]} scale={[0.5, 0.6, 0.02]} />
      {/* Mailbox: post, box and a red flag. */}
      <group position={[MAILBOX.x, 0, MAILBOX.z]}>
        <mesh geometry={kit.box} material={kit.wood} position={[0, 0.55, 0]} scale={[0.12, 1.1, 0.12]} castShadow={shadows} />
        <mesh geometry={kit.box} material={res.mailBlue} position={[0, 1.2, 0]} scale={[0.42, 0.36, 0.62]} castShadow={shadows} />
        <mesh geometry={kit.box} material={res.paint} position={[0.24, 1.36, -0.1]} scale={[0.04, 0.24, 0.12]} />
      </group>
    </group>
  );
}
