// The four wall puzzles and the world doors they open.
//  East  · Data science: a pit under a portal-compatible ceiling; fall in from above.
//  North · Games: a button drops a ball onto a floor panel; send it into the basin.
//  West  · Applications: a laser hits the wall; redirect it onto the target.
//  South · Journey: a button starts a light bridge; send it across the chasm.
import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import {
  AdditiveBlending, Color, CylinderGeometry, Group, InstancedMesh, Mesh, MeshBasicMaterial, MeshStandardMaterial, Object3D, Quaternion, Vector3,
} from 'three';
import { audio } from '../../engine/audio/AudioManager';
import { useInteractable } from '../../engine/interaction/interactions';
import { Portal, type PortalPreview } from '../../engine/portals/Portal';
import { DESTINATIONS, destination } from '../../engine/portals/destinations';
import { preloadWorld } from '../../engine/loading/worlds';
import { useGame } from '../../stores/gameStore';
import { makeTextTexture } from '../../utils/textTexture';
import {
  BALL_R, BASIN, BRIDGE_EMITTER, BRIDGE_HALF_W, BRIDGE_WALL, BUTTONS, CHASM, DOORS, DROPPER, LASER, PIT, PLATFORM, ROOM, TARGET, bridgeSpans,
  dropBall, stepBall, traceBeam, v3, type Ball, type DoorWorld, type Vec3,
} from './chamber';
import { aimTarget, hubAim } from './hubAim';
import { isSolved, puzzleKey, readyPortals, useHub, useSolved, type PuzzleWorld } from './hubStore';

const PREVIEW: Record<PuzzleWorld, PortalPreview> = { 'data-science': 'space', games: 'room', software: 'road', journey: 'town' };
const UP = new Vector3(0, 1, 0);

function solve(w: PuzzleWorld) {
  if (isSolved(w)) return;
  useGame.getState().completeInteraction(puzzleKey(w));
  audio.play('door');
  preloadWorld(w).catch(() => {});
}

export function Puzzles() {
  return (
    <>
      <PitPortal />
      <BallPuzzle />
      <LaserPuzzle />
      <BridgePuzzle />
      {(Object.keys(DOORS) as DoorWorld[]).map((w) => (
        <WorldDoor key={w} world={w} />
      ))}
      <PuzzleSign world="data-science" pos={[ROOM.half - 0.04, 6.4, 0]} rotY={-Math.PI / 2} hint="Portal on the ceiling over the pit, then step through" />
      <PuzzleSign world="games" pos={[0, 4.4, -ROOM.half + 0.04]} rotY={0} hint="Drop the ball and get it into the basin" />
      <PuzzleSign world="software" pos={[-ROOM.half + 0.04, 4.4, 0]} rotY={Math.PI / 2} hint="Guide the laser onto the target" />
      <PuzzleSign world="journey" pos={[0, 4.4, ROOM.half - 0.04]} rotY={Math.PI} hint="Bridge the gap with light" />
    </>
  );
}

// ---------------------------------------------------------------------------
// Shared props.

function useMat(params: ConstructorParameters<typeof MeshStandardMaterial>[0]) {
  const m = useMemo(() => new MeshStandardMaterial(params), []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => m.dispose(), [m]);
  return m;
}

/** White pedestal with a red cap, pressed with E. */
function PedestalButton({ id, x, z, label, onPress, lit }: { id: string; x: number; z: number; label: string; onPress: () => void; lit?: boolean }) {
  const cap = useRef<Mesh>(null);
  const pressed = useRef(0);
  const pos = useMemo(() => new Vector3(x, 1.1, z), [x, z]);
  const item = useMemo(
    () => ({
      id,
      label,
      position: () => pos,
      radius: 2,
      onInteract: () => {
        pressed.current = 0.25;
        audio.play('click');
        onPress();
      },
    }),
    [id, label, pos, onPress],
  );
  useInteractable(item);
  useFrame((_, dt) => {
    pressed.current = Math.max(0, pressed.current - dt);
    if (cap.current) cap.current.position.y = 1.08 - (pressed.current > 0 ? 0.05 : 0);
  });
  return (
    <group position={[x, 0, z]}>
      <mesh position-y={0.04}>
        <cylinderGeometry args={[0.45, 0.5, 0.08, 24]} />
        <meshStandardMaterial color="#3a4046" metalness={0.5} roughness={0.4} />
      </mesh>
      <mesh position-y={0.52} castShadow>
        <cylinderGeometry args={[0.16, 0.2, 0.96, 20]} />
        <meshStandardMaterial color="#eef1f3" roughness={0.4} />
      </mesh>
      <mesh ref={cap} position-y={1.08}>
        <cylinderGeometry args={[0.14, 0.15, 0.1, 20]} />
        <meshStandardMaterial color={lit ? '#38d27a' : '#e2412f'} emissive={lit ? '#38d27a' : '#e2412f'} emissiveIntensity={0.6} />
      </mesh>
    </group>
  );
}

/** A dotted indicator line on the floor that lights up when its puzzle is solved. */
function Dots({ from, to, lit }: { from: [number, number]; to: [number, number]; lit: boolean }) {
  const ref = useRef<InstancedMesh>(null);
  const n = Math.max(2, Math.round(Math.hypot(to[0] - from[0], to[1] - from[1]) / 0.55));
  const geo = useMemo(() => new CylinderGeometry(0.09, 0.09, 0.02, 12), []);
  const mat = useMemo(() => new MeshStandardMaterial({ color: '#8fa2b0', emissive: '#000000', toneMapped: false }), []);
  useEffect(
    () => () => {
      geo.dispose();
      mat.dispose();
    },
    [geo, mat],
  );
  useEffect(() => {
    mat.color.set(lit ? '#8ff0ff' : '#7f8f9a');
    mat.emissive.set(lit ? '#38d6ff' : '#000000');
    mat.emissiveIntensity = lit ? 1.6 : 0;
  }, [lit, mat]);
  useEffect(() => {
    const o = new Object3D();
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1);
      o.position.set(from[0] + (to[0] - from[0]) * t, 0.012, from[1] + (to[1] - from[1]) * t);
      o.updateMatrix();
      ref.current?.setMatrixAt(i, o.matrix);
    }
    if (ref.current) ref.current.instanceMatrix.needsUpdate = true;
  }, [from, to, n]);
  return <instancedMesh ref={ref} args={[geo, mat, n]} />;
}

/** Thin beam segments (laser or bridge edge), reused every frame. */
function useBeamMeshes(count: number, color: string, radius: number) {
  return useMemo(() => {
    const geo = new CylinderGeometry(radius, radius, 1, 8, 1, true);
    const core = new MeshBasicMaterial({ color, toneMapped: false });
    const glow = new MeshBasicMaterial({ color, transparent: true, opacity: 0.25, blending: AdditiveBlending, depthWrite: false, toneMapped: false });
    return { geo, core, glow, count };
  }, [count, color, radius]);
}

const q = new Quaternion();
const dir = new Vector3();
function placeSegment(m: Object3D, a: Vector3, b: Vector3, width = 1) {
  dir.copy(b).sub(a);
  const len = dir.length();
  m.position.copy(a).addScaledVector(dir, 0.5);
  m.quaternion.copy(q.setFromUnitVectors(UP, dir.normalize()));
  m.scale.set(width, len, width);
  m.visible = true;
}

// ---------------------------------------------------------------------------
// Data science: the pit.

function PitPortal() {
  const d = destination('data-science')!;
  return (
    <Portal
      position={[(PIT.minX + PIT.maxX) / 2, -PIT.depth + 0.05, (PIT.minZ + PIT.maxZ) / 2]}
      normal={[0, 1, 0]}
      color={d.color}
      color2={d.color2}
      preview="space"
      open={1}
      scale={1.1}
    />
  );
}

// ---------------------------------------------------------------------------
// Games: ball, platform and basin.

function BallPuzzle() {
  const solved = useSolved('games');
  const ball = useRef<Ball | null>(null);
  const mesh = useRef<Group>(null);
  const basinGlow = useMat({ color: '#9aa8b2', emissive: '#000000', roughness: 0.5 });
  const shell = useMat({ color: '#f2f4f5', roughness: 0.35, metalness: 0.1 });
  const band = useMat({ color: '#ff8a1f', emissive: '#ff8a1f', emissiveIntensity: 1.2, toneMapped: false });
  useEffect(() => {
    basinGlow.color.set(solved ? '#9ff3ff' : '#9aa8b2');
    basinGlow.emissive.set(solved ? '#3fd8ff' : '#000000');
    basinGlow.emissiveIntensity = solved ? 1.4 : 0;
  }, [solved, basinGlow]);

  const press = useMemo(
    () => () => {
      if (ball.current?.state === 'flying') return;
      ball.current = dropBall();
      audio.play('summon');
    },
    [],
  );

  useFrame((state, rawDt) => {
    const b = ball.current;
    const m = mesh.current;
    if (!m) return;
    if (!b || b.state === 'gone') {
      m.visible = !!(solved && isSolved('games'));
      if (m.visible) m.position.set(BASIN.x, BASIN.top, BASIN.z);
      return;
    }
    const dt = Math.min(rawDt, 0.05);
    const portals = readyPortals();
    // Small sub-steps so a fast ball cannot skip through a portal or the floor.
    for (let i = 0; i < 4; i++) {
      if (stepBall(b, dt / 4, portals)) {
        audio.play('point');
        solve('games');
      }
    }
    m.visible = true;
    m.position.copy(b.p);
    m.rotation.x += dt * 4;
    m.rotation.z = state.clock.elapsedTime;
  });

  const dropperY = DROPPER.y;
  return (
    <group>
      {/* Ceiling dropper */}
      <group position={[DROPPER.x, 0, DROPPER.z]}>
        <mesh position-y={dropperY + 0.25}>
          <cylinderGeometry args={[0.42, 0.42, 1.0, 24, 1, true]} />
          <meshStandardMaterial color="#3a4046" metalness={0.6} roughness={0.35} side={2} />
        </mesh>
        <mesh position-y={dropperY - 0.25}>
          <torusGeometry args={[0.42, 0.05, 8, 32]} />
          <meshStandardMaterial color="#ff8a1f" emissive="#ff8a1f" emissiveIntensity={0.8} toneMapped={false} />
        </mesh>
      </group>
      {/* Platform with its white floor panel */}
      <mesh position={[PLATFORM.x, PLATFORM.top / 2, PLATFORM.z]} receiveShadow>
        <boxGeometry args={[PLATFORM.halfX * 2 + 0.3, PLATFORM.top, PLATFORM.halfZ * 2 + 0.3]} />
        <meshStandardMaterial color="#3a4046" metalness={0.5} roughness={0.4} />
      </mesh>
      <FloorPanel />
      {/* Basin */}
      <group position={[BASIN.x, 0, BASIN.z]}>
        <mesh position-y={BASIN.top / 2}>
          <cylinderGeometry args={[BASIN.rim + 0.15, BASIN.rim + 0.25, BASIN.top, 32]} />
          <meshStandardMaterial color="#e9ecee" roughness={0.5} />
        </mesh>
        <mesh position-y={BASIN.top + 0.005} rotation-x={-Math.PI / 2} material={basinGlow}>
          <circleGeometry args={[BASIN.rim, 32]} />
        </mesh>
        <mesh position-y={BASIN.top + 0.02} rotation-x={-Math.PI / 2}>
          <ringGeometry args={[BASIN.rim, BASIN.rim + 0.12, 40]} />
          <meshStandardMaterial color="#3a4046" />
        </mesh>
      </group>
      <group ref={mesh} visible={false}>
        <mesh material={shell} castShadow>
          <sphereGeometry args={[BALL_R, 24, 16]} />
        </mesh>
        <mesh material={band} rotation-x={Math.PI / 2}>
          <torusGeometry args={[BALL_R * 1.01, 0.025, 8, 32]} />
        </mesh>
      </group>
      <PedestalButton id="ball-button" x={BUTTONS.ball.x} z={BUTTONS.ball.z} label="[E] Drop the ball" onPress={press} lit={solved} />
      <Dots from={[BUTTONS.ball.x - 0.4, BUTTONS.ball.z - 0.4]} to={[PLATFORM.x + 1.3, PLATFORM.z + 1.4]} lit />
      <Dots from={[BASIN.x - 1.2, BASIN.z - 0.6]} to={[DOORS.games.halfW + 0.4, -ROOM.half + 0.4]} lit={solved} />
    </group>
  );
}

function FloorPanel() {
  const white = useMat({ color: '#eef1f3', roughness: 0.55 });
  return (
    <mesh ref={aimTarget} position={[PLATFORM.x, PLATFORM.top + 0.01, PLATFORM.z]} rotation-x={-Math.PI / 2} material={white} userData={{ surfaceId: 'platform' }} receiveShadow>
      <planeGeometry args={[PLATFORM.halfX * 2, PLATFORM.halfZ * 2]} />
    </mesh>
  );
}

// ---------------------------------------------------------------------------
// Applications: laser and target.

function LaserPuzzle() {
  const solved = useSolved('software');
  const beams = useBeamMeshes(4, '#ff3a2a', 0.02);
  const group = useRef<Group>(null);
  const spark = useRef<Mesh>(null);
  const targetMat = useMat({ color: '#e2412f', emissive: '#e2412f', emissiveIntensity: 0.5 });
  const origin = useMemo(() => v3(LASER.origin), []);
  const direction = useMemo(() => v3(LASER.dir), []);
  useEffect(() => {
    targetMat.color.set(solved ? '#38d27a' : '#e2412f');
    targetMat.emissive.set(solved ? '#38d27a' : '#e2412f');
  }, [solved, targetMat]);
  useEffect(
    () => () => {
      beams.geo.dispose();
      beams.core.dispose();
      beams.glow.dispose();
    },
    [beams],
  );

  useFrame((state) => {
    const g = group.current;
    if (!g) return;
    const beam = traceBeam(origin, direction, readyPortals(), { target: true });
    g.children.forEach((c, i) => {
      const s = beam.segments[i >> 1];
      if (s) placeSegment(c, s[0], s[1], i % 2 ? 3 : 1);
      else c.visible = false;
    });
    const end = beam.segments[beam.segments.length - 1][1];
    if (spark.current) {
      spark.current.position.copy(end);
      spark.current.scale.setScalar(0.12 + Math.sin(state.clock.elapsedTime * 30) * 0.03);
    }
    if (beam.hitTarget) solve('software');
  });

  const [tx, ty, tz] = TARGET.center;
  return (
    <group>
      {/* Emitter on a stand, firing west */}
      <group position={[LASER.origin[0], 0, LASER.origin[2]]}>
        <mesh position-y={0.6}>
          <cylinderGeometry args={[0.12, 0.2, 1.2, 16]} />
          <meshStandardMaterial color="#3a4046" metalness={0.5} roughness={0.4} />
        </mesh>
        <mesh position-y={LASER.origin[1]} castShadow>
          <boxGeometry args={[0.6, 0.4, 0.4]} />
          <meshStandardMaterial color="#eef1f3" roughness={0.4} />
        </mesh>
        <mesh position={[-0.31, LASER.origin[1], 0]} rotation-z={Math.PI / 2}>
          <cylinderGeometry args={[0.1, 0.1, 0.04, 16]} />
          <meshBasicMaterial color="#ff5040" toneMapped={false} />
        </mesh>
      </group>
      <group ref={group}>
        {Array.from({ length: beams.count }, (_, i) => [
          <mesh key={`c${i}`} geometry={beams.geo} material={beams.core} visible={false} />,
          <mesh key={`g${i}`} geometry={beams.geo} material={beams.glow} visible={false} />,
        ]).flat()}
      </group>
      <mesh ref={spark}>
        <sphereGeometry args={[1, 10, 8]} />
        <meshBasicMaterial color="#ffb0a0" transparent opacity={0.8} blending={AdditiveBlending} depthWrite={false} toneMapped={false} />
      </mesh>
      {/* Target receptor facing the west wall */}
      <group position={[tx, 0, tz]}>
        <mesh position-y={ty / 2}>
          <cylinderGeometry args={[0.1, 0.18, ty, 12]} />
          <meshStandardMaterial color="#3a4046" metalness={0.5} roughness={0.4} />
        </mesh>
        <mesh position={[0.1, ty, 0]}>
          <boxGeometry args={[0.2, TARGET.half * 2 + 0.1, TARGET.half * 2 + 0.1]} />
          <meshStandardMaterial color="#eef1f3" roughness={0.4} />
        </mesh>
        <mesh position={[-0.01, ty, 0]} rotation-y={-Math.PI / 2} material={targetMat}>
          <ringGeometry args={[0.18, 0.36, 32]} />
        </mesh>
        <mesh position={[-0.01, ty, 0]} rotation-y={-Math.PI / 2} material={targetMat}>
          <circleGeometry args={[0.1, 20]} />
        </mesh>
      </group>
      <Dots from={[tx - 0.7, tz - 0.8]} to={[-ROOM.half + 0.4, DOORS.software.halfW + 0.4]} lit={solved} />
    </group>
  );
}

// ---------------------------------------------------------------------------
// Journey: light bridge.

function BridgePuzzle() {
  const solved = useSolved('journey');
  const on = useHub((s) => s.bridgeOn);
  const group = useRef<Group>(null);
  const origin = useMemo(() => v3(BRIDGE_EMITTER.origin), []);
  const direction = useMemo(() => v3(BRIDGE_EMITTER.dir), []);
  const bridgeMat = useMemo(
    () => new MeshBasicMaterial({ color: '#7fd6ff', transparent: true, opacity: 0.45, depthWrite: false, toneMapped: false, side: 2 }),
    [],
  );
  const edgeMat = useMemo(() => new MeshBasicMaterial({ color: new Color('#bff0ff'), toneMapped: false }), []);
  useEffect(
    () => () => {
      bridgeMat.dispose();
      edgeMat.dispose();
    },
    [bridgeMat, edgeMat],
  );
  useEffect(() => () => void (hubAim.bridge = []), []);

  const toggle = useMemo(
    () => () => {
      const next = !useHub.getState().bridgeOn;
      useHub.getState().set({ bridgeOn: next });
      audio.play(next ? 'boot' : 'putdown');
    },
    [],
  );

  useFrame(() => {
    const g = group.current;
    if (!g) return;
    const spans = on ? bridgeSpans(traceBeam(origin, direction, readyPortals())) : [];
    hubAim.bridge = spans;
    g.children.forEach((c, i) => {
      const s = spans[i];
      if (!s) {
        c.visible = false;
        return;
      }
      const [a, b] = s;
      dir.copy(b).sub(a);
      c.visible = true;
      c.position.copy(a).addScaledVector(dir, 0.5);
      c.rotation.set(0, Math.atan2(dir.x, dir.z), 0);
      c.scale.set(1, 1, dir.length());
    });
  });

  const [ex, , ez] = BRIDGE_EMITTER.origin;
  const wallX = (BRIDGE_WALL.minX + BRIDGE_WALL.maxX) / 2;
  const wallZ = (BRIDGE_WALL.minZ + BRIDGE_WALL.maxZ) / 2;
  return (
    <group>
      {/* Emitter block, projecting east */}
      <mesh position={[ex - 0.15, 0.35, ez]} castShadow>
        <boxGeometry args={[0.5, 0.7, BRIDGE_HALF_W * 2 + 0.3]} />
        <meshStandardMaterial color="#eef1f3" roughness={0.4} />
      </mesh>
      <mesh position={[ex + 0.11, 0.18, ez]}>
        <boxGeometry args={[0.02, 0.1, BRIDGE_HALF_W * 2]} />
        <meshBasicMaterial color={on ? '#9fe8ff' : '#5a6a76'} toneMapped={false} />
      </mesh>
      {/* Free-standing bridge wall: concrete with a white portal face toward the chasm */}
      <mesh ref={aimTarget} position={[wallX, BRIDGE_WALL.height / 2, wallZ]} castShadow>
        <boxGeometry args={[BRIDGE_WALL.maxX - BRIDGE_WALL.minX, BRIDGE_WALL.height, BRIDGE_WALL.maxZ - BRIDGE_WALL.minZ]} />
        <meshStandardMaterial color="#9ea4a9" roughness={0.9} />
      </mesh>
      <group ref={group}>
        {Array.from({ length: 4 }, (_, i) => (
          <group key={i} visible={false}>
            <mesh position-y={0.005} rotation-x={-Math.PI / 2} material={bridgeMat}>
              <planeGeometry args={[BRIDGE_HALF_W * 2, 1]} />
            </mesh>
            {[-1, 1].map((s) => (
              <mesh key={s} position={[s * BRIDGE_HALF_W, 0.02, 0]} material={edgeMat}>
                <boxGeometry args={[0.04, 0.04, 1]} />
              </mesh>
            ))}
          </group>
        ))}
      </group>
      <PedestalButton id="bridge-button" x={BUTTONS.bridge.x} z={BUTTONS.bridge.z} label={on ? '[E] Turn off the light bridge' : '[E] Turn on the light bridge'} onPress={toggle} lit={on} />
      <Dots from={[BUTTONS.bridge.x + 0.4, BUTTONS.bridge.z + 0.4]} to={[ex - 0.5, ez - 0.4]} lit={on} />
      <Dots from={[-ROOM.half + 1, CHASM.maxZ + 1.1]} to={[-DOORS.journey.halfW - 0.4, CHASM.maxZ + 1.1]} lit={solved} />
      <Dots from={[ROOM.half - 1, CHASM.maxZ + 1.1]} to={[DOORS.journey.halfW + 0.4, CHASM.maxZ + 1.1]} lit={solved} />
    </group>
  );
}

// ---------------------------------------------------------------------------
// Doors and signs.

function WorldDoor({ world }: { world: DoorWorld }) {
  const solved = useSolved(world);
  const d = DOORS[world];
  const dest = destination(world)!;
  const left = useRef<Mesh>(null);
  const right = useRef<Mesh>(null);
  const open = useRef(solved ? 1 : 0);
  const rotY = Math.atan2(d.normal[0], d.normal[2]);
  useFrame((_, dt) => {
    open.current += ((solved ? 1 : 0) - open.current) * Math.min(1, dt * 2.5);
    const o = open.current * (d.halfW + 0.05);
    if (left.current) left.current.position.x = -d.halfW / 2 - o;
    if (right.current) right.current.position.x = d.halfW / 2 + o;
  });
  return (
    <group position={d.center} rotation-y={rotY}>
      {/* Corridor behind the opening, seen from inside only */}
      <mesh position={[0, d.height / 2, -d.depth / 2]}>
        <boxGeometry args={[d.halfW * 2, d.height, d.depth]} />
        <meshStandardMaterial color="#d9dee2" roughness={0.7} side={1} />
      </mesh>
      <Portal position={[0, d.height / 2, -d.depth + 0.05]} normal={[0, 0, 1]} color={dest.color} color2={dest.color2} preview={PREVIEW[world]} open={solved ? 1 : 0} scale={0.72} />
      {/* Sliding door halves (they slide into the wall) */}
      <mesh ref={left} position={[-d.halfW / 2, d.height / 2, -0.06]}>
        <boxGeometry args={[d.halfW, d.height, 0.1]} />
        <meshStandardMaterial color="#e9ecee" roughness={0.45} metalness={0.1} />
      </mesh>
      <mesh ref={right} position={[d.halfW / 2, d.height / 2, -0.06]}>
        <boxGeometry args={[d.halfW, d.height, 0.1]} />
        <meshStandardMaterial color="#e9ecee" roughness={0.45} metalness={0.1} />
      </mesh>
      {/* Frame */}
      {[
        [-d.halfW - 0.12, d.height / 2, 0.24, d.height + 0.24],
        [d.halfW + 0.12, d.height / 2, 0.24, d.height + 0.24],
        [0, d.height + 0.12, d.halfW * 2 + 0.48, 0.24],
      ].map(([x, y, w, h], i) => (
        <mesh key={i} position={[x, y, 0.02]}>
          <boxGeometry args={[w, h, 0.16]} />
          <meshStandardMaterial color="#3a4046" metalness={0.5} roughness={0.4} />
        </mesh>
      ))}
      <mesh position={[0, d.height + 0.3, 0.11]}>
        <boxGeometry args={[d.halfW * 2, 0.06, 0.02]} />
        <meshBasicMaterial color={solved ? '#5fe08f' : '#ff6a4a'} toneMapped={false} />
      </mesh>
    </group>
  );
}

function PuzzleSign({ world, pos, rotY, hint }: { world: PuzzleWorld; pos: Vec3; rotY: number; hint: string }) {
  const solved = useSolved(world);
  const d = DESTINATIONS.find((x) => x.id === world)!;
  const tex = useMemo(
    () =>
      makeTextTexture(
        [
          { text: `${d.symbol}  ${d.label.toUpperCase()}`, size: 84, weight: '800', color: '#1f2a37' },
          { text: solved ? 'Solved · the way is open' : hint, size: 40, weight: '600', color: solved ? '#2f7d4f' : '#55606c' },
        ],
        { width: 1400, height: 300, background: '#f6f7f8' },
      ),
    [d, hint, solved],
  );
  useEffect(() => () => tex.dispose(), [tex]);
  return (
    <group position={pos} rotation-y={rotY}>
      <mesh position-z={0.01}>
        <planeGeometry args={[5.6, 1.2]} />
        <meshStandardMaterial map={tex} roughness={0.6} />
      </mesh>
      <mesh position={[-2.8, 0, 0.02]}>
        <boxGeometry args={[0.08, 1.2, 0.04]} />
        <meshBasicMaterial color={d.color} toneMapped={false} />
      </mesh>
    </group>
  );
}
