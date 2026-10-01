// The TV, its stand and the console. The screen is a canvas texture (CrtSystem)
// run through a small shader for tube curvature, scanlines and vignette.
import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import { ShaderMaterial, type Mesh, type PointLight } from 'three';
import { projectById } from '../../content';
import { useGame } from '../../stores/gameStore';
import { releaseLock } from '../../engine/input/pointerLock';
import { useSettings } from '../../stores/settingsStore';
import { FURNITURE, TV } from './layout';
import { useLookTarget } from './lookTargets';
import { useRoom } from './roomStore';
import type { CrtSystem } from './crt/CrtSystem';

const SCREEN = { w: 0.6, h: 0.45 };
const BODY = { w: 0.8, h: 0.64, d: 0.52 };

const vertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragment = /* glsl */ `
  uniform sampler2D map;
  uniform float uTime;
  uniform float uFlicker;
  uniform float uPower;
  varying vec2 vUv;
  vec2 curve(vec2 uv) {
    uv = uv * 2.0 - 1.0;
    vec2 o = abs(uv.yx) / vec2(5.5, 4.5);
    uv += uv * o * o;
    return uv * 0.5 + 0.5;
  }
  void main() {
    vec2 uv = curve(vUv);
    vec3 col = vec3(0.0);
    if (uv.x >= 0.0 && uv.x <= 1.0 && uv.y >= 0.0 && uv.y <= 1.0) {
      // Slight RGB offset like a real tube.
      col.r = texture2D(map, uv + vec2(0.0012, 0.0)).r;
      col.g = texture2D(map, uv).g;
      col.b = texture2D(map, uv - vec2(0.0012, 0.0)).b;
      col *= 0.95 + 0.05 * sin(uv.y * 480.0 * 3.14159);
      vec2 v = uv * (1.0 - uv);
      col *= pow(v.x * v.y * 16.0, 0.22);
      col *= 1.0 + uFlicker * 0.04 * sin(uTime * 55.0);
      col *= 1.15;
    }
    col *= uPower;
    col += vec3(0.004, 0.005, 0.007) * (1.0 - uPower);
    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
  }
`;

export function CrtTv({ crt }: { crt: CrtSystem }) {
  const glow = useRef<PointLight>(null);
  const screenMesh = useRef<Mesh>(null);
  const body = useRef<Mesh>(null);
  const reducedMotion = useSettings((s) => s.reducedMotion);
  const material = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader: vertex,
        fragmentShader: fragment,
        uniforms: { map: { value: crt.texture }, uTime: { value: 0 }, uFlicker: { value: 1 }, uPower: { value: 0 } },
        toneMapped: false,
      }),
    [crt],
  );
  useEffect(() => () => material.dispose(), [material]);

  const target = useMemo(
    () => ({
      id: 'tv',
      object: () => body.current,
      prompt: () => {
        const id = useRoom.getState().insertedId;
        const p = id ? projectById(id) : undefined;
        return p ? `[E] Sit down and play ${p.title}` : 'Pick a game from the shelf to play it here';
      },
      use: () => sitDown(crt),
      reach: 3,
    }),
    [crt],
  );
  useLookTarget(target);

  useFrame((state, dt) => {
    const u = material.uniforms;
    u.uTime.value = state.clock.elapsedTime;
    u.uFlicker.value = reducedMotion ? 0 : 1;
    u.uPower.value = Math.min(1, u.uPower.value + dt * 1.5);
    if (glow.current) glow.current.intensity = 1.6 + (reducedMotion ? 0 : Math.sin(state.clock.elapsedTime * 7) * 0.15);
  });

  const stand = FURNITURE.tvStand;
  const standW = stand.maxX - stand.minX;
  const standD = stand.maxZ - stand.minZ;
  const standTop = 0.56;
  const bodyZ = TV.screenZ - BODY.d / 2;
  const bodyY = standTop + BODY.h / 2;

  return (
    <group>
      {/* Stand with an open shelf for the console */}
      <group position={[(stand.minX + stand.maxX) / 2, 0, (stand.minZ + stand.maxZ) / 2]}>
        <mesh position-y={standTop - 0.02}>
          <boxGeometry args={[standW, 0.04, standD]} />
          <meshStandardMaterial color="#2a2530" roughness={0.6} />
        </mesh>
        <mesh position-y={0.04}>
          <boxGeometry args={[standW, 0.04, standD]} />
          <meshStandardMaterial color="#2a2530" roughness={0.6} />
        </mesh>
        {[-1, 1].map((s) => (
          <mesh key={s} position={[s * (standW / 2 - 0.02), standTop / 2, 0]}>
            <boxGeometry args={[0.04, standTop, standD]} />
            <meshStandardMaterial color="#2a2530" roughness={0.6} />
          </mesh>
        ))}
      </group>
      {/* Console: a chunky original design with a power LED and a slot */}
      <group position={[TV.x - 0.2, 0.12, stand.maxZ - 0.2]}>
        <mesh>
          <boxGeometry args={[0.42, 0.13, 0.3]} />
          <meshStandardMaterial color="#8f8aa3" roughness={0.5} />
        </mesh>
        <mesh position={[0, 0.066, 0]}>
          <boxGeometry args={[0.2, 0.004, 0.04]} />
          <meshStandardMaterial color="#222" />
        </mesh>
        <mesh position={[-0.16, 0.02, 0.151]}>
          <boxGeometry args={[0.02, 0.02, 0.004]} />
          <meshBasicMaterial color="#ff3a3a" toneMapped={false} />
        </mesh>
        <mesh position={[0.06, -0.02, 0.151]}>
          <boxGeometry args={[0.16, 0.02, 0.004]} />
          <meshStandardMaterial color="#ff3fb4" />
        </mesh>
      </group>
      {/* Controller and cable on the floor in front of the stand */}
      <group position={[TV.x + 0.15, 0.03, -1.85]} rotation-y={0.4}>
        <mesh scale={[1.6, 0.45, 1]}>
          <sphereGeometry args={[0.06, 16, 10]} />
          <meshStandardMaterial color="#3b3b44" roughness={0.5} />
        </mesh>
        <mesh position={[0.05, 0.026, 0]}>
          <cylinderGeometry args={[0.012, 0.012, 0.01, 10]} />
          <meshStandardMaterial color="#ff3fb4" />
        </mesh>
        <mesh position={[-0.05, 0.026, 0]}>
          <boxGeometry args={[0.03, 0.01, 0.01]} />
          <meshStandardMaterial color="#222" />
        </mesh>
      </group>
      {/* TV body */}
      <group position={[TV.x, bodyY, bodyZ]}>
        <mesh ref={body} userData={{ lookId: 'tv' }}>
          <boxGeometry args={[BODY.w, BODY.h, BODY.d]} />
          <meshStandardMaterial color="#1e1c22" roughness={0.5} />
        </mesh>
        <mesh position={[0, 0, -BODY.d / 2 - 0.12]}>
          <boxGeometry args={[BODY.w * 0.7, BODY.h * 0.75, 0.25]} />
          <meshStandardMaterial color="#1e1c22" roughness={0.5} />
        </mesh>
        <mesh position={[0.3, -0.27, BODY.d / 2 + 0.002]}>
          <circleGeometry args={[0.012, 12]} />
          <meshBasicMaterial color="#5dff9a" toneMapped={false} />
        </mesh>
      </group>
      <mesh
        ref={screenMesh}
        material={material}
        position={[TV.x, TV.screenY, TV.screenZ + 0.002]}
        userData={{ lookId: 'tv' }}
        onClick={(e) => {
          if (useRoom.getState().mode !== 'crt' || !e.uv) return;
          e.stopPropagation();
          crt.click(e.uv.x, e.uv.y);
        }}
      >
        <planeGeometry args={[SCREEN.w, SCREEN.h]} />
      </mesh>
      <pointLight ref={glow} position={[TV.x, TV.screenY, TV.screenZ + 0.5]} color="#9fb6ff" intensity={1.6} distance={4} decay={1.8} />
    </group>
  );
}

/** Sit on the beanbag in front of the TV (needs a game in the console). */
export function sitDown(crt: CrtSystem) {
  const room = useRoom.getState();
  if (!room.insertedId) {
    useGame.getState().setHint('Pick up a game from the shelf on the right, then press E to play it on the TV.');
    return;
  }
  releaseLock();
  useGame.setState({ freeCursor: true });
  room.set({ mode: 'crt' });
  crt.resume();
}
