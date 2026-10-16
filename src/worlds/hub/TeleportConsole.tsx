// The teleport console in the middle of the chamber: one screen per world, each facing
// the wall whose puzzle leads there. Press E at a screen to go straight to that world.
import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import { Group, Vector3 } from 'three';
import { useInteractable } from '../../engine/interaction/interactions';
import { travelTo } from '../../engine/loading/travel';
import { DESTINATIONS, type Destination } from '../../engine/portals/destinations';
import { useGame } from '../../stores/gameStore';
import { useSettings } from '../../stores/settingsStore';
import { makeTextTexture } from '../../utils/textTexture';
import { CONSOLE } from './chamber';

/** Which way each world's screen faces (yaw): east, north, west, south. */
const FACING: Record<Destination['id'], number> = {
  'data-science': Math.PI / 2,
  games: 0,
  software: -Math.PI / 2,
  journey: Math.PI,
};

export function TeleportConsole() {
  const ring = useRef<Group>(null);
  const reducedMotion = useSettings((s) => s.reducedMotion);
  useFrame((state, dt) => {
    if (!ring.current) return;
    ring.current.rotation.y += dt * (reducedMotion ? 0.1 : 0.4);
    ring.current.position.y = 2.6 + Math.sin(state.clock.elapsedTime * 1.4) * 0.05;
  });
  return (
    <group position={[CONSOLE.x, 0, CONSOLE.z]}>
      <mesh position-y={0.06} receiveShadow>
        <cylinderGeometry args={[CONSOLE.r + 0.35, CONSOLE.r + 0.45, 0.12, 48]} />
        <meshStandardMaterial color="#3a4046" metalness={0.5} roughness={0.4} />
      </mesh>
      <mesh position-y={0.55} castShadow>
        <cylinderGeometry args={[0.55, 0.8, 1.0, 32]} />
        <meshStandardMaterial color="#eef1f3" roughness={0.4} />
      </mesh>
      <mesh position-y={1.07}>
        <cylinderGeometry args={[0.95, 0.6, 0.12, 32]} />
        <meshStandardMaterial color="#e3e7ea" roughness={0.4} />
      </mesh>
      <mesh position-y={1.14} rotation-x={-Math.PI / 2}>
        <ringGeometry args={[0.7, 0.8, 48]} />
        <meshBasicMaterial color="#38d6ff" toneMapped={false} />
      </mesh>
      {DESTINATIONS.map((d) => (
        <Screen key={d.id} d={d} />
      ))}
      {/* Holographic ring of world symbols */}
      <group ref={ring} position-y={2.6}>
        {DESTINATIONS.map((d, i) => (
          <mesh key={d.id} rotation={[Math.PI / 2, 0, (i * Math.PI) / 2]}>
            <torusGeometry args={[0.55 + i * 0.07, 0.015, 6, 64]} />
            <meshBasicMaterial color={d.color} toneMapped={false} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

function Screen({ d }: { d: Destination }) {
  const yaw = FACING[d.id];
  const tex = useMemo(
    () =>
      makeTextTexture(
        [
          { text: d.symbol, size: 120, weight: '800', color: d.color },
          { text: d.label.toUpperCase(), size: 46, weight: '800', color: '#1f2a37' },
          { text: 'TELEPORT · PRESS E', size: 30, weight: '700', color: '#55606c' },
        ],
        { width: 640, height: 400, background: '#f6f7f8' },
      ),
    [d],
  );
  useEffect(() => () => tex.dispose(), [tex]);
  const dir = useMemo(() => new Vector3(Math.sin(yaw), 0, Math.cos(yaw)), [yaw]);
  const pos = useMemo(() => new Vector3(CONSOLE.x, 1.2, CONSOLE.z).addScaledVector(dir, 1.6), [dir]);
  const item = useMemo(
    () => ({
      id: `console-${d.id}`,
      label: `[E] Teleport to ${d.label}`,
      position: () => pos,
      radius: 1.5,
      onInteract: () => {
        useGame.getState().completeInteraction('console-used');
        void travelTo(d.id);
      },
    }),
    [d, pos],
  );
  useInteractable(item);
  return (
    <group rotation-y={yaw}>
      <mesh position={[0, 1.42, 0.72]} rotation-x={-0.55}>
        <boxGeometry args={[0.82, 0.54, 0.05]} />
        <meshStandardMaterial color="#3a4046" metalness={0.4} roughness={0.4} />
      </mesh>
      <mesh position={[0, 1.43, 0.75]} rotation-x={-0.55}>
        <planeGeometry args={[0.74, 0.46]} />
        <meshStandardMaterial map={tex} emissive="#ffffff" emissiveMap={tex} emissiveIntensity={0.35} roughness={0.5} />
      </mesh>
      <mesh position={[0, 1.08, 0.86]}>
        <boxGeometry args={[0.6, 0.04, 0.04]} />
        <meshBasicMaterial color={d.color} toneMapped={false} />
      </mesh>
    </group>
  );
}
