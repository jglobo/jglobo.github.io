// Ground, trees and city blocks. The roads, lamps, verges and jumps are Jose's kit
// pieces (KitTown.tsx). Trees are instanced; textures are drawn in code.
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { Color, InstancedMesh, Object3D, RepeatWrapping, type Texture } from 'three';
import { qualityProfile } from '../../../stores/settingsStore';
import { BUILDINGS, TREES, WORLD_HALF, type Box } from '../layout';
import { dirtTexture, windowsTexture } from './textures';

/** Jose's grass verge base colour (Kit / muted olive grass). */
const GRASS = '#859d76';

function useOwned<T extends Texture>(make: () => T, deps: unknown[] = []) {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const t = useMemo(make, deps);
  useEffect(() => () => t.dispose(), [t]);
  return t;
}

export function Terrain() {
  const dirt = useOwned(dirtTexture);
  return (
    <group>
      {/* The colour of Jose's grass verges. A little below y = 0 so his road surfaces,
          which sit within a centimetre of 0, never fight it for depth (flicker). */}
      <mesh rotation-x={-Math.PI / 2} position-y={-0.04} receiveShadow>
        <planeGeometry args={[WORLD_HALF * 2 + 60, WORLD_HALF * 2 + 60]} />
        <meshStandardMaterial color={GRASS} roughness={1} />
      </mesh>
      {/* Dirt jump park in the south-east corner */}
      <mesh rotation-x={-Math.PI / 2} position={[49, 0.01, 30]} receiveShadow>
        <planeGeometry args={[22, 20]} />
        <meshStandardMaterial map={dirt} roughness={1} />
      </mesh>
      {BUILDINGS.map((b, i) => (
        <Building key={i} b={b} seed={i + 1} />
      ))}
      <Trees />
      {/* Low hills at the map edge so the world does not end at a line */}
      {[[-WORLD_HALF - 14, 0], [WORLD_HALF + 14, 0], [0, -WORLD_HALF - 14], [0, WORLD_HALF + 14]].map(([x, z], i) => (
        <mesh key={i} position={[x, -2, z]} scale={[i < 2 ? 1 : 9, 1, i < 2 ? 9 : 1]}>
          <sphereGeometry args={[18, 16, 8]} />
          <meshStandardMaterial color={GRASS} roughness={1} />
        </mesh>
      ))}
    </group>
  );
}

function Building({ b, seed }: { b: Box; seed: number }) {
  const w = b.maxX - b.minX;
  const d = b.maxZ - b.minZ;
  const tex = useOwned(() => {
    const t = windowsTexture(seed);
    t.wrapS = t.wrapT = RepeatWrapping;
    t.repeat.set(Math.max(1, Math.round(w / 6)), Math.max(1, Math.round(b.height / 6)));
    return t;
  }, [seed]);
  return (
    <group position={[(b.minX + b.maxX) / 2, 0, (b.minZ + b.maxZ) / 2]}>
      <mesh position-y={b.height / 2} castShadow receiveShadow>
        <boxGeometry args={[w, b.height, d]} />
        <meshStandardMaterial map={tex} color={b.color} emissiveMap={tex} emissive="#ffffff" emissiveIntensity={0.25} roughness={0.6} />
      </mesh>
      <mesh position-y={b.height + 0.2}>
        <boxGeometry args={[w + 0.4, 0.4, d + 0.4]} />
        <meshStandardMaterial color="#2a3142" />
      </mesh>
    </group>
  );
}

function Trees() {
  const trunks = useRef<InstancedMesh>(null);
  const crowns = useRef<InstancedMesh>(null);
  const count = Math.round(TREES.length * Math.min(1, qualityProfile().particles / 90));
  useLayoutEffect(() => {
    const o = new Object3D();
    const c = new Color();
    for (let i = 0; i < count; i++) {
      const t = TREES[i];
      const s = 0.8 + ((i * 37) % 10) / 20;
      o.position.set(t.x, 1.2 * s, t.z);
      o.scale.setScalar(s);
      o.updateMatrix();
      trunks.current!.setMatrixAt(i, o.matrix);
      o.position.y = 3.6 * s;
      o.rotation.y = i;
      o.updateMatrix();
      crowns.current!.setMatrixAt(i, o.matrix);
      crowns.current!.setColorAt(i, c.setHSL(0.27 + ((i * 13) % 10) / 120, 0.5, 0.28 + ((i * 7) % 10) / 80));
    }
    trunks.current!.instanceMatrix.needsUpdate = true;
    crowns.current!.instanceMatrix.needsUpdate = true;
    if (crowns.current!.instanceColor) crowns.current!.instanceColor.needsUpdate = true;
  }, [count]);
  return (
    <group>
      <instancedMesh ref={trunks} args={[undefined, undefined, count]} castShadow>
        <cylinderGeometry args={[0.25, 0.35, 2.4, 6]} />
        <meshStandardMaterial color="#6b4a2b" roughness={1} />
      </instancedMesh>
      <instancedMesh ref={crowns} args={[undefined, undefined, count]} castShadow>
        <coneGeometry args={[1.8, 4, 7]} />
        <meshStandardMaterial roughness={0.9} />
      </instancedMesh>
    </group>
  );
}

