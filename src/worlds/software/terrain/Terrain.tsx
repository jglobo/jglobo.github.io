// Ground, roads, ramps, trees, city blocks and street lights. Trees and lights are
// instanced; textures are drawn in code.
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { Color, InstancedMesh, MeshStandardMaterial, Object3D, RepeatWrapping, type Texture } from 'three';
import { qualityProfile } from '../../../stores/settingsStore';
import { BUILDINGS, RAMPS, ROADS, TREES, WORLD_HALF, type Box, type Ramp } from '../layout';
import { dirtTexture, grassTexture, roadTexture, windowsTexture } from './textures';

function useOwned<T extends Texture>(make: () => T, deps: unknown[] = []) {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const t = useMemo(make, deps);
  useEffect(() => () => t.dispose(), [t]);
  return t;
}

export function Terrain() {
  const grass = useOwned(grassTexture);
  const dirt = useOwned(dirtTexture);
  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[WORLD_HALF * 2 + 60, WORLD_HALF * 2 + 60]} />
        <meshStandardMaterial map={grass} roughness={1} />
      </mesh>
      {/* Dirt jump park in the south-east corner */}
      <mesh rotation-x={-Math.PI / 2} position={[49, 0.01, 30]} receiveShadow>
        <planeGeometry args={[22, 20]} />
        <meshStandardMaterial map={dirt} roughness={1} />
      </mesh>
      {ROADS.map((r, i) => (
        <Road key={i} road={r} />
      ))}
      {RAMPS.map((r, i) => (
        <RampMesh key={i} ramp={r} />
      ))}
      {BUILDINGS.map((b, i) => (
        <Building key={i} b={b} seed={i + 1} />
      ))}
      <Trees />
      <StreetLights />
      {/* Low hills at the map edge so the world does not end at a line */}
      {[[-WORLD_HALF - 14, 0], [WORLD_HALF + 14, 0], [0, -WORLD_HALF - 14], [0, WORLD_HALF + 14]].map(([x, z], i) => (
        <mesh key={i} position={[x, -2, z]} scale={[i < 2 ? 1 : 9, 1, i < 2 ? 9 : 1]}>
          <sphereGeometry args={[18, 16, 8]} />
          <meshStandardMaterial color="#3f7a34" roughness={1} />
        </mesh>
      ))}
    </group>
  );
}

function Road({ road }: { road: Box }) {
  const w = road.maxX - road.minX;
  const d = road.maxZ - road.minZ;
  const alongX = w >= d;
  const tex = useOwned(() => {
    const t = roadTexture();
    t.wrapS = RepeatWrapping;
    t.repeat.set((alongX ? w : d) / 8, 1);
    return t;
  }, [w, d]);
  return (
    <mesh rotation-x={-Math.PI / 2} rotation-z={alongX ? 0 : Math.PI / 2} position={[(road.minX + road.maxX) / 2, 0.02, (road.minZ + road.maxZ) / 2]} receiveShadow>
      <planeGeometry args={alongX ? [w, d] : [d, w]} />
      <meshStandardMaterial map={tex} roughness={0.9} polygonOffset polygonOffsetFactor={-1} />
    </mesh>
  );
}

function RampMesh({ ramp }: { ramp: Ramp }) {
  // A wedge: rises along its local +x from 0 to height over `length`.
  const rotY = { e: 0, n: Math.PI / 2, w: Math.PI, s: -Math.PI / 2 }[ramp.dir];
  const slope = Math.atan2(ramp.height, ramp.length);
  const hyp = Math.hypot(ramp.height, ramp.length);
  return (
    <group position={[ramp.x, 0, ramp.z]} rotation-y={rotY}>
      <group position={[ramp.length / 2, ramp.height / 2, 0]} rotation-z={slope}>
        <mesh castShadow receiveShadow>
          <boxGeometry args={[hyp, 0.15, ramp.width]} />
          <meshStandardMaterial color="#d98a2b" roughness={0.7} />
        </mesh>
        {/* Chevrons */}
        {[-0.25, 0, 0.25].map((t) => (
          <mesh key={t} position={[hyp * t, 0.08, 0]} rotation-x={-Math.PI / 2}>
            <planeGeometry args={[0.5, ramp.width * 0.7]} />
            <meshBasicMaterial color="#ffffff" />
          </mesh>
        ))}
      </group>
      <mesh position={[ramp.length, ramp.height / 2, 0]}>
        <boxGeometry args={[0.2, ramp.height, ramp.width]} />
        <meshStandardMaterial color="#9a5a1a" />
      </mesh>
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

function StreetLights() {
  const poles = useRef<InstancedMesh>(null);
  const lamps = useRef<InstancedMesh>(null);
  const spots = useMemo(() => {
    const out: [number, number][] = [];
    for (let x = -32; x <= 32; x += 16) out.push([x, 25.2], [x, -31.2]);
    for (let z = -14; z <= 10; z += 12) out.push([-37.2, z], [37.2, z]);
    for (let z = -56; z <= -36; z += 10) out.push([5.2, z], [-5.2, z]);
    return out;
  }, []);
  const lampMat = useMemo(() => new MeshStandardMaterial({ color: '#fff2c4', emissive: '#ffe08a', emissiveIntensity: 1.2 }), []);
  useEffect(() => () => lampMat.dispose(), [lampMat]);
  useLayoutEffect(() => {
    const o = new Object3D();
    spots.forEach(([x, z], i) => {
      o.position.set(x, 2.5, z);
      o.updateMatrix();
      poles.current!.setMatrixAt(i, o.matrix);
      o.position.y = 5.1;
      o.updateMatrix();
      lamps.current!.setMatrixAt(i, o.matrix);
    });
    poles.current!.instanceMatrix.needsUpdate = true;
    lamps.current!.instanceMatrix.needsUpdate = true;
  }, [spots]);
  return (
    <group>
      <instancedMesh ref={poles} args={[undefined, undefined, spots.length]}>
        <cylinderGeometry args={[0.1, 0.14, 5, 6]} />
        <meshStandardMaterial color="#555b66" metalness={0.5} roughness={0.5} />
      </instancedMesh>
      <instancedMesh ref={lamps} args={[undefined, undefined, spots.length]} material={lampMat}>
        <boxGeometry args={[0.5, 0.25, 0.5]} />
      </instancedMesh>
    </group>
  );
}
