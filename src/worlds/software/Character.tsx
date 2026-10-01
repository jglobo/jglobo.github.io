// The visitor's avatar in the Software world: a small blocky figure that walks, and
// a seated version for the bicycle. Original design, primitives only.
import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import { Group, MeshStandardMaterial } from 'three';

function useMats() {
  const mats = useMemo(
    () => ({
      skin: new MeshStandardMaterial({ color: '#c68863', roughness: 0.8 }),
      shirt: new MeshStandardMaterial({ color: '#19e6ff', roughness: 0.7 }),
      pants: new MeshStandardMaterial({ color: '#2b3550', roughness: 0.8 }),
      hair: new MeshStandardMaterial({ color: '#2a1d14', roughness: 0.9 }),
      shoes: new MeshStandardMaterial({ color: '#f2f2f2', roughness: 0.6 }),
    }),
    [],
  );
  useEffect(() => () => Object.values(mats).forEach((m) => m.dispose()), [mats]);
  return mats;
}

export interface WalkerPose { x: number; z: number; heading: number; speed: number; visible: boolean }

export function Walker({ pose }: { pose: WalkerPose }) {
  const root = useRef<Group>(null);
  const legs = useRef<(Group | null)[]>([]);
  const arms = useRef<(Group | null)[]>([]);
  const phase = useRef(0);
  const m = useMats();
  useFrame((state, dt) => {
    const g = root.current;
    if (!g) return;
    g.visible = pose.visible;
    g.position.set(pose.x, 0, pose.z);
    g.rotation.y = -pose.heading;
    phase.current += pose.speed * dt * 2.4;
    const swing = Math.sin(phase.current) * Math.min(1, pose.speed / 3) * 0.7;
    legs.current.forEach((l, i) => l && (l.rotation.x = i ? swing : -swing));
    arms.current.forEach((a, i) => a && (a.rotation.x = i ? -swing : swing));
    g.position.y = pose.speed > 0.2 ? Math.abs(Math.sin(phase.current)) * 0.06 : Math.sin(state.clock.elapsedTime * 2) * 0.01;
  });
  return (
    <group ref={root}>
      {[-0.13, 0.13].map((x, i) => (
        <group key={x} position={[x, 0.82, 0]} ref={(el) => void (legs.current[i] = el)}>
          <mesh material={m.pants} position-y={-0.38} castShadow>
            <boxGeometry args={[0.2, 0.76, 0.22]} />
          </mesh>
          <mesh material={m.shoes} position={[0, -0.78, -0.05]}>
            <boxGeometry args={[0.22, 0.1, 0.32]} />
          </mesh>
        </group>
      ))}
      <mesh material={m.shirt} position-y={1.15} castShadow>
        <boxGeometry args={[0.55, 0.66, 0.3]} />
      </mesh>
      {[-0.36, 0.36].map((x, i) => (
        <group key={x} position={[x, 1.42, 0]} ref={(el) => void (arms.current[i] = el)}>
          <mesh material={m.shirt} position-y={-0.15}>
            <boxGeometry args={[0.16, 0.32, 0.18]} />
          </mesh>
          <mesh material={m.skin} position-y={-0.45}>
            <boxGeometry args={[0.13, 0.3, 0.14]} />
          </mesh>
        </group>
      ))}
      <mesh material={m.skin} position-y={1.68} castShadow>
        <boxGeometry args={[0.36, 0.38, 0.34]} />
      </mesh>
      <mesh material={m.hair} position={[0, 1.88, 0.02]}>
        <boxGeometry args={[0.38, 0.1, 0.38]} />
      </mesh>
      {/* Face direction marker: eyes on the -z side */}
      {[-0.08, 0.08].map((x) => (
        <mesh key={x} position={[x, 1.72, -0.171]}>
          <boxGeometry args={[0.05, 0.05, 0.01]} />
          <meshBasicMaterial color="#111" />
        </mesh>
      ))}
    </group>
  );
}

/** Seated figure for the bicycle; `seat` is where the hips go. */
export function Rider({ seat }: { seat: [number, number, number] }) {
  const m = useMats();
  const [x, y, z] = seat;
  return (
    <group position={[x, y, z]}>
      <mesh material={m.pants} position={[0, -0.05, -0.15]} rotation-x={1.2}>
        <boxGeometry args={[0.36, 0.42, 0.2]} />
      </mesh>
      {[-0.12, 0.12].map((lx) => (
        <mesh key={lx} material={m.pants} position={[lx, -0.4, -0.3]} rotation-x={0.2}>
          <boxGeometry args={[0.15, 0.55, 0.16]} />
        </mesh>
      ))}
      <mesh material={m.shirt} position={[0, 0.32, -0.12]} rotation-x={-0.5}>
        <boxGeometry args={[0.5, 0.6, 0.28]} />
      </mesh>
      {[-0.27, 0.27].map((ax) => (
        <mesh key={ax} material={m.shirt} position={[ax, 0.3, -0.4]} rotation-x={-1.1}>
          <boxGeometry args={[0.13, 0.5, 0.14]} />
        </mesh>
      ))}
      <mesh material={m.skin} position={[0, 0.72, -0.32]}>
        <boxGeometry args={[0.34, 0.36, 0.32]} />
      </mesh>
      <mesh material={m.hair} position={[0, 0.91, -0.3]}>
        <boxGeometry args={[0.36, 0.09, 0.36]} />
      </mesh>
    </group>
  );
}
