// Bicycle built from primitives, with an optional rider. Faces -z at heading 0.
import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import { Group, MeshStandardMaterial } from 'three';
import { Rider } from '../Character';
import type { VehiclePose } from './pose';

const WHEEL_R = 0.34;

export function Bicycle({ pose, color = '#19b8e6' }: { pose: VehiclePose; color?: string }) {
  const root = useRef<Group>(null);
  const lean = useRef<Group>(null);
  const front = useRef<Group>(null);
  const wheels = useRef<(Group | null)[]>([]);
  const rider = useRef<Group>(null);
  const spin = useRef(0);
  const pedal = useRef<Group>(null);
  const mats = useMemo(
    () => ({
      frame: new MeshStandardMaterial({ color, metalness: 0.5, roughness: 0.35 }),
      tyre: new MeshStandardMaterial({ color: '#1a1a1e', roughness: 0.8 }),
      metal: new MeshStandardMaterial({ color: '#c9ced8', metalness: 0.9, roughness: 0.3 }),
    }),
    [color],
  );
  useEffect(() => () => Object.values(mats).forEach((m) => m.dispose()), [mats]);

  useFrame((_, dt) => {
    const g = root.current;
    if (!g) return;
    g.position.set(pose.x, pose.y, pose.z);
    g.rotation.y = -pose.heading;
    if (lean.current) lean.current.rotation.z = -pose.roll;
    spin.current -= (pose.speed / WHEEL_R) * dt;
    wheels.current.forEach((w) => w && (w.rotation.x = spin.current));
    if (pedal.current) pedal.current.rotation.x = spin.current * 0.5;
    if (front.current) front.current.rotation.y = -pose.steer * 0.6;
    if (rider.current) rider.current.visible = pose.ridden;
  });

  const tube = (from: [number, number, number], to: [number, number, number], r = 0.03, key?: string) => {
    const dx = to[0] - from[0];
    const dy = to[1] - from[1];
    const dz = to[2] - from[2];
    const len = Math.hypot(dx, dy, dz);
    return (
      <mesh key={key} material={mats.frame} position={[(from[0] + to[0]) / 2, (from[1] + to[1]) / 2, (from[2] + to[2]) / 2]} rotation={[Math.atan2(dz, dy), 0, 0]} castShadow>
        <cylinderGeometry args={[r, r, len, 6]} />
      </mesh>
    );
  };
  const wheel = (z: number, i: number) => (
    <group position={[0, WHEEL_R, z]} ref={(el) => void (wheels.current[i] = el)}>
      <mesh material={mats.tyre} rotation-y={Math.PI / 2} castShadow>
        <torusGeometry args={[WHEEL_R, 0.035, 8, 24]} />
      </mesh>
      {[0, 1, 2].map((k) => (
        <mesh key={k} material={mats.metal} rotation-x={(k * Math.PI) / 3}>
          <boxGeometry args={[0.01, WHEEL_R * 2, 0.01]} />
        </mesh>
      ))}
    </group>
  );

  return (
    <group ref={root}>
      <group ref={lean}>
        {wheel(0.55, 0)}
        <group ref={front} position={[0, 0, -0.55]}>
          <group position={[0, 0, 0]}>
            <group position={[0, WHEEL_R, 0]} ref={(el) => void (wheels.current[1] = el)}>
              <mesh material={mats.tyre} rotation-y={Math.PI / 2} castShadow>
                <torusGeometry args={[WHEEL_R, 0.035, 8, 24]} />
              </mesh>
              {[0, 1, 2].map((k) => (
                <mesh key={k} material={mats.metal} rotation-x={(k * Math.PI) / 3}>
                  <boxGeometry args={[0.01, WHEEL_R * 2, 0.01]} />
                </mesh>
              ))}
            </group>
            {tube([0, WHEEL_R, 0], [0, 0.95, 0.12], 0.025, 'fork')}
            <mesh material={mats.metal} position={[0, 0.98, 0.12]} rotation-z={Math.PI / 2}>
              <cylinderGeometry args={[0.02, 0.02, 0.6, 6]} />
            </mesh>
          </group>
        </group>
        {/* Frame: down tube, top tube, seat tube, chain stays */}
        {tube([0, 0.38, 0.05], [0, 0.9, -0.43], 0.035, 'down')}
        {tube([0, 0.85, 0.2], [0, 0.9, -0.43], 0.03, 'top')}
        {tube([0, 0.38, 0.05], [0, 0.95, 0.24], 0.032, 'seat')}
        {tube([0, 0.38, 0.05], [0, WHEEL_R, 0.55], 0.025, 'stay')}
        {tube([0, 0.85, 0.2], [0, WHEEL_R, 0.55], 0.022, 'stay2')}
        <mesh position={[0, 0.98, 0.26]}>
          <boxGeometry args={[0.12, 0.05, 0.24]} />
          <meshStandardMaterial color="#222" />
        </mesh>
        <group ref={pedal} position={[0, 0.38, 0.05]}>
          <mesh material={mats.metal}>
            <boxGeometry args={[0.3, 0.03, 0.03]} />
          </mesh>
        </group>
        <group ref={rider} visible={false}>
          <Rider seat={[0, 0.98, 0.26]} />
        </group>
      </group>
    </group>
  );
}
