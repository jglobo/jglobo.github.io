// The dimensional research chamber: an original lab with four portal-compatible wall
// panels, a floating dimensional core and signage. Primitives + emissive materials +
// canvas-texture signs only, so it costs nothing to download.
import { useFrame } from '@react-three/fiber';
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from 'react';
import {
  AdditiveBlending, BufferAttribute, BufferGeometry, CanvasTexture, Group, Mesh, MeshStandardMaterial, RepeatWrapping, SRGBColorSpace,
} from 'three';
import { DESTINATIONS } from '../../engine/portals/destinations';
import { qualityProfile, useSettings } from '../../stores/settingsStore';
import { makeTextTexture } from '../../utils/textTexture';
import { rng } from '../../utils/random';
import { profile } from '../../content';

export const ROOM = { half: 14, height: 9 };
export const CORE_RADIUS = 3.4;

/** Wall panel layout: centre, facing normal, width. Portal-compatible surfaces. */
export const PANELS = [
  { id: 'north', pos: [0, 3, -ROOM.half + 0.05] as const, rotY: 0, width: 12 },
  { id: 'south', pos: [0, 3, ROOM.half - 0.05] as const, rotY: Math.PI, width: 12 },
  { id: 'west', pos: [-ROOM.half + 0.05, 3, 0] as const, rotY: Math.PI / 2, width: 12 },
  { id: 'east', pos: [ROOM.half - 0.05, 3, 0] as const, rotY: -Math.PI / 2, width: 12 },
];

function gridTexture(size: number, lines: number, bg: string, line: string, lineWidth = 2) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, size, size);
  ctx.strokeStyle = line;
  ctx.lineWidth = lineWidth;
  const step = size / lines;
  for (let i = 0; i <= lines; i++) {
    ctx.beginPath();
    ctx.moveTo(i * step, 0);
    ctx.lineTo(i * step, size);
    ctx.moveTo(0, i * step);
    ctx.lineTo(size, i * step);
    ctx.stroke();
  }
  const t = new CanvasTexture(c);
  t.wrapS = t.wrapT = RepeatWrapping;
  t.colorSpace = SRGBColorSpace;
  return t;
}

export interface HubEnvironmentHandle {
  surfaces: Mesh[];
  /** Things that block portal aim (the core column). */
  occluders: Mesh[];
}

export const HubEnvironment = forwardRef<HubEnvironmentHandle>(function HubEnvironment(_, ref) {
  const panelRefs = useRef<Mesh[]>([]);
  const occluder = useRef<Mesh>(null);
  useImperativeHandle(ref, () => ({ surfaces: panelRefs.current, occluders: occluder.current ? [occluder.current] : [] }), []);
  const shadows = qualityProfile().shadows;

  const textures = useMemo(() => {
    const floor = gridTexture(512, 4, '#14121c', '#2a2540', 3);
    floor.repeat.set(7, 7);
    const wall = gridTexture(256, 2, '#1b1926', '#262236', 4);
    wall.repeat.set(10, 3);
    const panel = gridTexture(256, 4, '#cfd3e6', '#b3b8d4', 3);
    panel.repeat.set(6, 3);
    const title = makeTextTexture(
      [
        { text: profile.name.toUpperCase(), size: 110, weight: '800', color: '#f1ecff' },
        { text: 'DIMENSIONAL RESEARCH LAB', size: 52, weight: '600', color: '#b48cff' },
      ],
      { width: 1400, height: 400, glow: '#8a5cff' },
    );
    const surfaceLabel = makeTextTexture([{ text: '◌  PORTAL-COMPATIBLE SURFACE  ◌', size: 44, weight: '700', color: '#dfe3ff' }], {
      width: 1200,
      height: 120,
      glow: '#7f9cff',
    });
    const signs = DESTINATIONS.map((d) =>
      makeTextTexture(
        [
          { text: `${d.key}  ${d.symbol}`, size: 90, weight: '800', color: d.color2 },
          { text: d.label.toUpperCase(), size: 54, weight: '800', color: '#ffffff' },
          { text: d.status === 'playable' ? d.world : `${d.world} · coming soon`, size: 36, weight: '500', color: d.color2 },
        ],
        { width: 800, height: 400, background: 'rgba(8,6,20,0.85)', glow: d.color },
      ),
    );
    return { floor, wall, panel, title, surfaceLabel, signs };
  }, []);

  useEffect(
    () => () => {
      const { signs, ...rest } = textures;
      [...signs, ...Object.values(rest)].forEach((t) => t.dispose());
    },
    [textures],
  );

  return (
    <group>
      {/* Floor, ceiling, walls */}
      <mesh rotation-x={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[ROOM.half * 2, ROOM.half * 2]} />
        <meshStandardMaterial map={textures.floor} roughness={0.55} metalness={0.4} />
      </mesh>
      <mesh rotation-x={Math.PI / 2} position-y={ROOM.height}>
        <planeGeometry args={[ROOM.half * 2, ROOM.half * 2]} />
        <meshStandardMaterial color="#0d0b14" roughness={0.9} />
      </mesh>
      {PANELS.map((p) => (
        <group key={p.id} position={[p.pos[0], 0, p.pos[2]]} rotation-y={p.rotY}>
          <mesh position={[0, ROOM.height / 2, -0.06]} receiveShadow>
            <planeGeometry args={[ROOM.half * 2, ROOM.height]} />
            <meshStandardMaterial map={textures.wall} roughness={0.8} metalness={0.3} />
          </mesh>
          {/* Portal-compatible panel */}
          <mesh
            ref={(m) => {
              if (m && !panelRefs.current.includes(m)) panelRefs.current.push(m);
            }}
            position={[0, 3, 0]}
            userData={{ portalSurface: true, halfWidth: p.width / 2 }}
            receiveShadow
          >
            <planeGeometry args={[p.width, 6]} />
            <meshStandardMaterial map={textures.panel} roughness={0.35} metalness={0.1} emissive="#5a6cff" emissiveIntensity={0.06} />
          </mesh>
          {/* Frame + label */}
          <mesh position={[0, 6.12, 0.02]}>
            <boxGeometry args={[p.width + 0.4, 0.24, 0.1]} />
            <meshStandardMaterial color="#1c1a2a" emissive="#7f6cff" emissiveIntensity={0.9} />
          </mesh>
          <mesh position={[0, 6.6, 0.03]}>
            <planeGeometry args={[6, 0.6]} />
            <meshBasicMaterial map={textures.surfaceLabel} transparent depthWrite={false} />
          </mesh>
          <mesh position={[0, 0.06, 0.02]}>
            <boxGeometry args={[p.width + 0.4, 0.12, 0.1]} />
            <meshStandardMaterial color="#1c1a2a" emissive="#7f6cff" emissiveIntensity={0.5} />
          </mesh>
        </group>
      ))}

      {/* Title above the north panel */}
      <mesh position={[0, 7.9, -ROOM.half + 0.1]}>
        <planeGeometry args={[7, 2]} />
        <meshBasicMaterial map={textures.title} transparent depthWrite={false} />
      </mesh>

      {/* Corner pillars with world-colour light strips */}
      {DESTINATIONS.map((d, i) => {
        const sx = i % 2 === 0 ? -1 : 1;
        const sz = i < 2 ? -1 : 1;
        const x = sx * (ROOM.half - 0.8);
        const z = sz * (ROOM.half - 0.8);
        return (
          <group key={d.id} position={[x, 0, z]}>
            <mesh position-y={ROOM.height / 2} castShadow={shadows}>
              <boxGeometry args={[1.2, ROOM.height, 1.2]} />
              <meshStandardMaterial color="#1a1826" metalness={0.6} roughness={0.4} />
            </mesh>
            <mesh position={[-sx * 0.61, ROOM.height / 2, -sz * 0.61]} rotation-y={Math.PI / 4}>
              <boxGeometry args={[0.12, ROOM.height - 1, 0.12]} />
              <meshBasicMaterial color={d.color} toneMapped={false} />
            </mesh>
            <pointLight color={d.color} intensity={5} distance={10} decay={1.5} position={[-sx * 1.5, 4, -sz * 1.5]} />
          </group>
        );
      })}

      <DimensionalCore signs={textures.signs} />
      {/* Invisible column so you cannot aim a portal through the core */}
      <mesh ref={occluder} position-y={ROOM.height / 2} visible={false}>
        <cylinderGeometry args={[1.4, 1.4, ROOM.height, 16]} />
      </mesh>
      <CeilingRing />
      <Dust />
    </group>
  );
});

/** Floating core in the middle of the room: platform, rotating rings, world directory. */
function DimensionalCore({ signs }: { signs: CanvasTexture[] }) {
  const rings = useRef<Group>(null);
  const core = useRef<Mesh>(null);
  const directory = useRef<Group>(null);
  const reducedMotion = useSettings((s) => s.reducedMotion);
  const coreMat = useMemo(() => new MeshStandardMaterial({ color: '#2a1f55', emissive: '#9b7bff', emissiveIntensity: 1.6, roughness: 0.2 }), []);
  useEffect(() => () => coreMat.dispose(), [coreMat]);

  useFrame((state, dt) => {
    const t = state.clock.elapsedTime;
    const k = reducedMotion ? 0.25 : 1;
    if (rings.current) {
      rings.current.children.forEach((r, i) => {
        r.rotation.x += dt * 0.3 * k * (i % 2 ? 1 : -1);
        r.rotation.y += dt * (0.2 + i * 0.12) * k;
      });
    }
    if (core.current) {
      core.current.rotation.y += dt * 0.5 * k;
      core.current.position.y = 3.2 + Math.sin(t * 1.2) * 0.15 * k;
      coreMat.emissiveIntensity = 1.4 + Math.sin(t * 2.4) * 0.3;
    }
    if (directory.current) directory.current.rotation.y += dt * 0.12 * k;
  });

  return (
    <group>
      <mesh position-y={0.2} receiveShadow castShadow>
        <cylinderGeometry args={[CORE_RADIUS - 0.2, CORE_RADIUS, 0.4, 48]} />
        <meshStandardMaterial color="#201d30" metalness={0.7} roughness={0.35} />
      </mesh>
      <mesh position-y={0.41} rotation-x={-Math.PI / 2}>
        <ringGeometry args={[CORE_RADIUS - 0.6, CORE_RADIUS - 0.45, 64]} />
        <meshBasicMaterial color="#b48cff" toneMapped={false} />
      </mesh>
      <mesh ref={core} position-y={3.2} material={coreMat}>
        <icosahedronGeometry args={[0.7, 1]} />
      </mesh>
      <group ref={rings} position-y={3.2}>
        {DESTINATIONS.map((d, i) => (
          <mesh key={d.id} rotation={[i * 0.7, i * 0.4, 0]}>
            <torusGeometry args={[1.2 + i * 0.28, 0.035, 8, 96]} />
            <meshBasicMaterial color={d.color} toneMapped={false} />
          </mesh>
        ))}
      </group>
      {/* Beam from floor to core */}
      <mesh position-y={1.6}>
        <cylinderGeometry args={[0.25, 0.5, 2.6, 24, 1, true]} />
        <meshBasicMaterial color="#8f6bff" transparent opacity={0.18} blending={AdditiveBlending} depthWrite={false} />
      </mesh>
      {/* Rotating world directory: one sign per destination */}
      <group ref={directory} position-y={5.6}>
        {signs.map((tex, i) => (
          <mesh key={i} rotation-y={(i * Math.PI) / 2} position={[Math.sin((i * Math.PI) / 2) * 2.2, 0, Math.cos((i * Math.PI) / 2) * 2.2]}>
            <planeGeometry args={[2.4, 1.2]} />
            <meshBasicMaterial map={tex} transparent depthWrite={false} toneMapped={false} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

function CeilingRing() {
  return (
    <group position-y={ROOM.height - 0.05}>
      <mesh rotation-x={Math.PI / 2}>
        <ringGeometry args={[6, 6.4, 96]} />
        <meshBasicMaterial color="#cbb8ff" toneMapped={false} />
      </mesh>
      <mesh rotation-x={Math.PI / 2}>
        <ringGeometry args={[2.2, 2.35, 64]} />
        <meshBasicMaterial color="#cbb8ff" toneMapped={false} />
      </mesh>
    </group>
  );
}

function Dust() {
  const count = qualityProfile().particles * 2;
  const ref = useRef<Group>(null);
  const geo = useMemo(() => {
    const r = rng(11);
    const g = new BufferGeometry();
    const p = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      p[i * 3] = (r() - 0.5) * ROOM.half * 2;
      p[i * 3 + 1] = r() * ROOM.height;
      p[i * 3 + 2] = (r() - 0.5) * ROOM.half * 2;
    }
    g.setAttribute('position', new BufferAttribute(p, 3));
    return g;
  }, [count]);
  useEffect(() => () => geo.dispose(), [geo]);
  useFrame((_, dt) => {
    if (ref.current) ref.current.rotation.y += dt * 0.01;
  });
  return (
    <group ref={ref}>
      <points geometry={geo}>
        <pointsMaterial color="#c9b8ff" size={0.035} transparent opacity={0.6} blending={AdditiveBlending} depthWrite={false} />
      </points>
    </group>
  );
}
