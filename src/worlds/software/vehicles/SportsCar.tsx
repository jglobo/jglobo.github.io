// Low-poly sports car built from primitives. Faces -z at heading 0.
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import { Group, MeshStandardMaterial } from 'three';
import { useEffect } from 'react';
import type { VehiclePose } from './pose';

const WHEEL_R = 0.36;

export function SportsCar({ pose, color = '#e63946' }: { pose: VehiclePose; color?: string }) {
  const root = useRef<Group>(null);
  const body = useRef<Group>(null);
  const wheels = useRef<(Group | null)[]>([]);
  const fronts = useRef<(Group | null)[]>([]);
  const spin = useRef(0);
  const mats = useMemo(
    () => ({
      paint: new MeshStandardMaterial({ color, metalness: 0.6, roughness: 0.3 }),
      glass: new MeshStandardMaterial({ color: '#1a2230', metalness: 0.8, roughness: 0.1 }),
      dark: new MeshStandardMaterial({ color: '#16161a', roughness: 0.8 }),
      rim: new MeshStandardMaterial({ color: '#c9ced8', metalness: 0.9, roughness: 0.25 }),
      head: new MeshStandardMaterial({ color: '#fffbe6', emissive: '#fff4c2', emissiveIntensity: 1.5 }),
      tail: new MeshStandardMaterial({ color: '#ff2a2a', emissive: '#ff1a1a', emissiveIntensity: 1.2 }),
    }),
    [color],
  );
  useEffect(() => () => Object.values(mats).forEach((m) => m.dispose()), [mats]);

  useFrame((_, dt) => {
    const g = root.current;
    if (!g) return;
    g.position.set(pose.x, pose.y, pose.z);
    g.rotation.y = -pose.heading;
    if (body.current) {
      body.current.rotation.z = -pose.roll;
      body.current.rotation.x = -pose.pitch;
    }
    spin.current -= (pose.speed / WHEEL_R) * dt;
    wheels.current.forEach((w) => w && (w.rotation.x = spin.current));
    fronts.current.forEach((f) => f && (f.rotation.y = -pose.steer * 0.5));
  });

  const wheelPos: [number, number, number][] = [[-0.85, WHEEL_R, -1.3], [0.85, WHEEL_R, -1.3], [-0.85, WHEEL_R, 1.3], [0.85, WHEEL_R, 1.3]];
  return (
    <group ref={root}>
      <group ref={body}>
        <mesh material={mats.paint} position={[0, 0.62, 0]} castShadow>
          <boxGeometry args={[1.8, 0.45, 4.2]} />
        </mesh>
        <mesh material={mats.paint} position={[0, 0.58, -1.75]} rotation-x={0.25} castShadow>
          <boxGeometry args={[1.78, 0.3, 0.9]} />
        </mesh>
        <mesh material={mats.glass} position={[0, 1.05, 0.2]} castShadow>
          <boxGeometry args={[1.5, 0.45, 1.9]} />
        </mesh>
        <mesh material={mats.paint} position={[0, 1.29, 0.35]}>
          <boxGeometry args={[1.45, 0.05, 1.3]} />
        </mesh>
        <mesh material={mats.dark} position={[0, 0.95, 2.0]}>
          <boxGeometry args={[1.7, 0.08, 0.35]} />
        </mesh>
        {[-0.6, 0.6].map((x) => (
          <mesh key={`h${x}`} material={mats.head} position={[x, 0.66, -2.11]}>
            <boxGeometry args={[0.4, 0.12, 0.04]} />
          </mesh>
        ))}
        {[-0.6, 0.6].map((x) => (
          <mesh key={`t${x}`} material={mats.tail} position={[x, 0.7, 2.11]}>
            <boxGeometry args={[0.45, 0.1, 0.04]} />
          </mesh>
        ))}
        {/* Racing stripe */}
        <mesh position={[0, 0.851, -0.4]}>
          <boxGeometry args={[0.3, 0.005, 3.2]} />
          <meshStandardMaterial color="#ffffff" />
        </mesh>
      </group>
      {wheelPos.map((p, i) => (
        <group key={i} position={p} ref={(el) => void (i < 2 ? (fronts.current[i] = el) : null)}>
          <group ref={(el) => void (wheels.current[i] = el)}>
            <mesh material={mats.dark} rotation-z={Math.PI / 2} castShadow>
              <cylinderGeometry args={[WHEEL_R, WHEEL_R, 0.28, 16]} />
            </mesh>
            <mesh material={mats.rim} rotation-z={Math.PI / 2}>
              <cylinderGeometry args={[WHEEL_R * 0.6, WHEEL_R * 0.6, 0.3, 8]} />
            </mesh>
          </group>
        </group>
      ))}
    </group>
  );
}
