// The bedroom shell and furniture: walls, carpet, window, bed, desk with an old PC,
// dresser, posters, LED strip, rug and beanbag. All primitive geometry.
import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import { BackSide, MeshBasicMaterial, type Mesh, type PointLight } from 'three';
import { useSettings } from '../../stores/settingsStore';
import { audio } from '../../engine/audio/AudioManager';
import { BEANBAG, FURNITURE, ROOM, type Rect } from './layout';
import { useLookTarget } from './lookTargets';
import { useRoom } from './roomStore';
import { carpetTexture, monitorTexture, nightWindowTexture, posterTexture, rugTexture, wallpaperTexture, type PosterKind } from './textures';
import { useOwnedTexture } from './useTexture';

const center = (r: Rect) => [(r.minX + r.maxX) / 2, (r.minZ + r.maxZ) / 2] as const;
const size = (r: Rect) => [r.maxX - r.minX, r.maxZ - r.minZ] as const;

export function RoomEnvironment() {
  const wall = useOwnedTexture(wallpaperTexture);
  const carpet = useOwnedTexture(carpetTexture);
  const rug = useOwnedTexture(rugTexture);
  const { halfX, halfZ, height } = ROOM;

  return (
    <group>
      {/* Walls: an inside-out box, wallpaper on the sides */}
      <mesh position={[0, height / 2, 0]}>
        <boxGeometry args={[halfX * 2, height, halfZ * 2]} />
        <meshStandardMaterial map={wall} side={BackSide} roughness={0.9} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position-y={0.002}>
        <planeGeometry args={[halfX * 2, halfZ * 2]} />
        <meshStandardMaterial map={carpet} roughness={1} />
      </mesh>
      <mesh rotation-x={Math.PI / 2} position-y={height - 0.002}>
        <planeGeometry args={[halfX * 2, halfZ * 2]} />
        <meshStandardMaterial color="#1c1424" roughness={1} />
      </mesh>
      {/* Skirting boards */}
      {[[0, -halfZ + 0.01, halfX * 2, 0], [0, halfZ - 0.01, halfX * 2, 0], [-halfX + 0.01, 0, halfZ * 2, 1], [halfX - 0.01, 0, halfZ * 2, 1]].map(([x, z, len, rot], i) => (
        <mesh key={i} position={[x, 0.05, z]} rotation-y={rot ? Math.PI / 2 : 0}>
          <boxGeometry args={[len, 0.1, 0.02]} />
          <meshStandardMaterial color="#e8e0f0" roughness={0.6} />
        </mesh>
      ))}
      <LedStrip />
      <Window />
      <Bed />
      <Desk />
      <Dresser />
      <Poster kind="press-start" position={[-1.05, 1.62, -halfZ + 0.01]} rotationY={0} />
      <Poster kind="pixel-pirates" position={[halfX - 0.01, 1.55, 1.35]} rotationY={-Math.PI / 2} />
      <Poster kind="debug" position={[-1.95, 1.6, halfZ - 0.01]} rotationY={Math.PI} />
      {/* Rug and beanbag in front of the TV */}
      <mesh rotation-x={-Math.PI / 2} position={[0.6, 0.006, -1.0]}>
        <circleGeometry args={[1.05, 48]} />
        <meshStandardMaterial map={rug} roughness={1} />
      </mesh>
      <mesh position={[BEANBAG.x, 0.26, BEANBAG.z]} scale={[1, 0.62, 1]}>
        <sphereGeometry args={[BEANBAG.r + 0.04, 24, 16]} />
        <meshStandardMaterial color="#7a2a8a" roughness={0.8} />
      </mesh>
      <mesh position={[BEANBAG.x, 0.5, BEANBAG.z + 0.22]} rotation-x={0.5} scale={[1, 0.5, 0.6]}>
        <sphereGeometry args={[0.32, 20, 12]} />
        <meshStandardMaterial color="#6a2379" roughness={0.8} />
      </mesh>
    </group>
  );
}

function LedStrip() {
  const material = useMemo(() => new MeshBasicMaterial({ color: '#ff3fb4', toneMapped: false }), []);
  useEffect(() => () => material.dispose(), [material]);
  const reducedMotion = useSettings((s) => s.reducedMotion);
  const { halfX, halfZ, height } = ROOM;
  useFrame((state) => {
    if (!reducedMotion) material.color.setHSL(0.88 + Math.sin(state.clock.elapsedTime * 0.2) * 0.06, 1, 0.6);
  });
  // One emissive frame just under the ceiling.
  return (
    <group position-y={height - 0.06}>
      {[[0, -halfZ + 0.03, halfX * 2, 0], [0, halfZ - 0.03, halfX * 2, 0], [-halfX + 0.03, 0, halfZ * 2, 1], [halfX - 0.03, 0, halfZ * 2, 1]].map(([x, z, len, rot], i) => (
        <mesh key={i} material={material} position={[x, 0, z]} rotation-y={rot ? Math.PI / 2 : 0}>
          <boxGeometry args={[len, 0.025, 0.025]} />
        </mesh>
      ))}
    </group>
  );
}

function Window() {
  const night = useOwnedTexture(nightWindowTexture);
  const x = -ROOM.halfX + 0.012;
  return (
    <group position={[x, 1.6, 0.95]} rotation-y={Math.PI / 2}>
      <mesh>
        <planeGeometry args={[1.3, 0.95]} />
        <meshBasicMaterial map={night} toneMapped={false} />
      </mesh>
      {/* Frame and cross bars */}
      {[[0, 0.5, 1.4, 0.06], [0, -0.5, 1.4, 0.06], [-0.67, 0, 0.06, 1.06], [0.67, 0, 0.06, 1.06], [0, 0, 0.035, 0.95], [0, 0, 1.3, 0.035]].map(([px, py, w, h], i) => (
        <mesh key={i} position={[px, py, 0.02]}>
          <boxGeometry args={[w, h, 0.04]} />
          <meshStandardMaterial color="#e8e0f0" roughness={0.5} />
        </mesh>
      ))}
      {/* Curtains */}
      {[-0.82, 0.82].map((px) => (
        <mesh key={px} position={[px, -0.05, 0.06]}>
          <boxGeometry args={[0.28, 1.3, 0.05]} />
          <meshStandardMaterial color="#3d2a7a" roughness={0.9} />
        </mesh>
      ))}
    </group>
  );
}

function Bed() {
  const [cx, cz] = center(FURNITURE.bed);
  const [w, d] = size(FURNITURE.bed);
  return (
    <group position={[cx, 0, cz]}>
      <mesh position-y={0.18}>
        <boxGeometry args={[w, 0.36, d]} />
        <meshStandardMaterial color="#5a3b28" roughness={0.7} />
      </mesh>
      <mesh position-y={0.44}>
        <boxGeometry args={[w - 0.06, 0.18, d - 0.06]} />
        <meshStandardMaterial color="#e9e4f2" roughness={0.9} />
      </mesh>
      {/* Blanket with a stripe, pillow at the back-wall end */}
      <mesh position={[0, 0.545, -0.3]}>
        <boxGeometry args={[w - 0.02, 0.04, d - 0.6]} />
        <meshStandardMaterial color="#1f6fb8" roughness={0.95} />
      </mesh>
      <mesh position={[0, 0.568, -0.3]}>
        <boxGeometry args={[w, 0.005, 0.18]} />
        <meshStandardMaterial color="#ffd23f" roughness={0.95} />
      </mesh>
      <mesh position={[0, 0.6, d / 2 - 0.28]}>
        <boxGeometry args={[w - 0.35, 0.12, 0.34]} />
        <meshStandardMaterial color="#ffffff" roughness={1} />
      </mesh>
      <mesh position={[0, 0.6, d / 2 - 0.02]}>
        <boxGeometry args={[w, 1.2, 0.06]} />
        <meshStandardMaterial color="#4a2f20" roughness={0.7} />
      </mesh>
    </group>
  );
}

function Desk() {
  const [cx, cz] = center(FURNITURE.desk);
  const [w, d] = size(FURNITURE.desk);
  const screen = useOwnedTexture(monitorTexture);
  const lamp = useRef<PointLight>(null);
  const lampOn = useRoom((s) => s.lampOn);
  const lampHead = useRef<Mesh>(null);

  // Easter egg: the desk lamp really switches off.
  const target = useMemo(
    () => ({
      id: 'desk-lamp',
      object: () => lampHead.current,
      prompt: () => (useRoom.getState().lampOn ? '[E] Turn off the lamp' : '[E] Turn on the lamp'),
      use: () => {
        audio.play('click');
        useRoom.getState().set({ lampOn: !useRoom.getState().lampOn });
      },
      reach: 2.6,
    }),
    [],
  );
  useLookTarget(target);

  return (
    <group position={[cx, 0, cz]}>
      <mesh position-y={0.74}>
        <boxGeometry args={[w, 0.04, d]} />
        <meshStandardMaterial color="#8a6a4a" roughness={0.6} />
      </mesh>
      {[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sz], i) => (
        <mesh key={i} position={[sx * (w / 2 - 0.04), 0.36, sz * (d / 2 - 0.04)]}>
          <boxGeometry args={[0.05, 0.72, 0.05]} />
          <meshStandardMaterial color="#5a4330" />
        </mesh>
      ))}
      {/* Beige tower and monitor, a very 2001 setup */}
      <mesh position={[-0.5, 0.97, -0.05]}>
        <boxGeometry args={[0.2, 0.42, 0.42]} />
        <meshStandardMaterial color="#d9d2bf" roughness={0.6} />
      </mesh>
      <mesh position={[-0.42, 1.06, 0.157]}>
        <boxGeometry args={[0.02, 0.02, 0.005]} />
        <meshBasicMaterial color="#5dff9a" toneMapped={false} />
      </mesh>
      <group position={[0.05, 0.98, -0.05]}>
        <mesh>
          <boxGeometry args={[0.46, 0.38, 0.4]} />
          <meshStandardMaterial color="#d9d2bf" roughness={0.6} />
        </mesh>
        <mesh position-z={0.201}>
          <planeGeometry args={[0.38, 0.29]} />
          <meshBasicMaterial map={screen} toneMapped={false} />
        </mesh>
      </group>
      <mesh position={[0.05, 0.765, 0.2]}>
        <boxGeometry args={[0.42, 0.02, 0.14]} />
        <meshStandardMaterial color="#cfc8b4" />
      </mesh>
      {/* Lamp */}
      <group position={[0.55, 0.76, -0.12]}>
        <mesh position-y={0.01}>
          <cylinderGeometry args={[0.07, 0.08, 0.02, 16]} />
          <meshStandardMaterial color="#222" />
        </mesh>
        <mesh position={[0, 0.2, 0]} rotation-z={0.3}>
          <cylinderGeometry args={[0.012, 0.012, 0.4, 8]} />
          <meshStandardMaterial color="#222" />
        </mesh>
        <mesh ref={lampHead} userData={{ lookId: 'desk-lamp' }} position={[-0.08, 0.4, 0.02]} rotation-z={-0.9}>
          <coneGeometry args={[0.09, 0.14, 16, 1, true]} />
          <meshStandardMaterial color="#ff3fb4" emissive={lampOn ? '#ffcf8a' : '#000'} emissiveIntensity={0.5} side={2} />
        </mesh>
        <pointLight ref={lamp} position={[-0.05, 0.3, 0.1]} color="#ffcf8a" intensity={lampOn ? 3.2 : 0} distance={5} decay={1.6} />
      </group>
    </group>
  );
}

function Dresser() {
  const [cx, cz] = center(FURNITURE.dresser);
  const [w, d] = size(FURNITURE.dresser);
  return (
    <group position={[cx, 0, cz]}>
      <mesh position-y={0.45}>
        <boxGeometry args={[w, 0.9, d]} />
        <meshStandardMaterial color="#6b4c35" roughness={0.7} />
      </mesh>
      {[0.2, 0.47, 0.74].map((y) => (
        <mesh key={y} position={[0, y, -d / 2 - 0.005]}>
          <boxGeometry args={[w - 0.1, 0.2, 0.01]} />
          <meshStandardMaterial color="#7d5a40" roughness={0.6} />
        </mesh>
      ))}
      {/* A stack of game magazines and a figurine-ish robot */}
      {[0, 1, 2].map((i) => (
        <mesh key={i} position={[-0.3, 0.915 + i * 0.012, 0]} rotation-y={i * 0.2}>
          <boxGeometry args={[0.24, 0.01, 0.3]} />
          <meshStandardMaterial color={['#ff3fb4', '#19e6ff', '#ffd23f'][i]} />
        </mesh>
      ))}
      <group position={[0.35, 0.9, 0]}>
        <mesh position-y={0.08}>
          <boxGeometry args={[0.1, 0.12, 0.07]} />
          <meshStandardMaterial color="#b8c0d0" metalness={0.5} roughness={0.4} />
        </mesh>
        <mesh position-y={0.19}>
          <boxGeometry args={[0.08, 0.08, 0.07]} />
          <meshStandardMaterial color="#b8c0d0" metalness={0.5} roughness={0.4} />
        </mesh>
        <mesh position={[0, 0.2, -0.036]}>
          <boxGeometry args={[0.05, 0.015, 0.005]} />
          <meshBasicMaterial color="#19e6ff" toneMapped={false} />
        </mesh>
      </group>
    </group>
  );
}

function Poster({ kind, position, rotationY }: { kind: PosterKind; position: [number, number, number]; rotationY: number }) {
  const tex = useOwnedTexture(() => posterTexture(kind), [kind]);
  return (
    <mesh position={position} rotation-y={rotationY}>
      <planeGeometry args={[0.62, 0.88]} />
      <meshStandardMaterial map={tex} roughness={0.7} />
    </mesh>
  );
}
