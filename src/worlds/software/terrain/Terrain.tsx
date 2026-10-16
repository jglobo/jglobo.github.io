// The ground, the dirt park and the hills at the edge. Everything standing on it is
// one of Jose's models (KitTown.tsx).
import { useEffect, useMemo } from 'react';
import { type Texture } from 'three';
import { WORLD_HALF } from '../layout';
import { dirtTexture } from './textures';

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

