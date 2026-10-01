// The bookcase of Jose's games. Each game in src/content/games becomes a box with
// its own cover; boxes can be picked up, turned over and inserted into the console.
import { useFrame, useThree } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import { Euler, Group, MeshStandardMaterial, Quaternion, Vector3 } from 'three';
import { projectsByCategory, type PortfolioProject } from '../../content';
import { releaseLock } from '../../engine/input/pointerLock';
import { audio } from '../../engine/audio/AudioManager';
import { track } from '../../analytics/track';
import { useGame } from '../../stores/gameStore';
import { FURNITURE, TV } from './layout';
import { useLookTarget } from './lookTargets';
import { roomRuntime, useRoom } from './roomStore';
import { boxBackTexture, boxCoverTexture, boxSpineTexture } from './textures';
import { useOwnedTexture } from './useTexture';

const BOX = { w: 0.19, h: 0.26, d: 0.035 };
const SHELF_X = FURNITURE.shelf.minX;
const SHELF_DEPTH = FURNITURE.shelf.maxX - FURNITURE.shelf.minX;
const SHELF_Z0 = FURNITURE.shelf.minZ;
const SHELF_LEN = FURNITURE.shelf.maxZ - FURNITURE.shelf.minZ;
const BOARDS = [0.06, 0.48, 0.9, 1.32, 1.86];
const GAME_BOARD = BOARDS[3];
/** Where a box ends up when it goes into the console. */
export const CONSOLE_SLOT = new Vector3(TV.x - 0.2, 0.3, -2.25);

/** Featured games first, so they sit in the middle of the shelf. */
export const shelfGames = () =>
  [...projectsByCategory('games')].sort((a, b) => Number(b.featured) - Number(a.featured)).slice(0, 6);

export function pickUp(p: PortfolioProject) {
  const room = useRoom.getState();
  if (room.mode !== 'walk') return;
  audio.play('pickup');
  releaseLock();
  roomRuntime.inspectYaw = 0;
  roomRuntime.inspectPitch = 0;
  useGame.setState({ freeCursor: true });
  room.set({ mode: 'inspect', heldId: p.id });
  track('project_viewed', { project: p.id, from: 'game-room-shelf' });
}

export function openManual(p: PortfolioProject) {
  releaseLock();
  useGame.getState().openProject(p.id);
}

export function GameShelf() {
  const games = useMemo(shelfGames, []);
  const step = Math.min(0.36, (SHELF_LEN - 0.3) / Math.max(1, games.length));
  const start = SHELF_Z0 + SHELF_LEN / 2 - (step * (games.length - 1)) / 2;
  return (
    <group>
      <Bookcase />
      {games.map((p, i) => (
        <GameBox key={p.id} project={p} rest={new Vector3(SHELF_X + 0.14, GAME_BOARD + 0.02 + BOX.h / 2, start + i * step)} lean={(i % 2 ? -1 : 1) * 0.04} />
      ))}
    </group>
  );
}

function Bookcase() {
  const wood = useMemo(() => new MeshStandardMaterial({ color: '#6b4c35', roughness: 0.7 }), []);
  const cx = SHELF_X + SHELF_DEPTH / 2;
  const cz = SHELF_Z0 + SHELF_LEN / 2;
  const height = BOARDS[BOARDS.length - 1];
  return (
    <group position={[cx, 0, cz]}>
      <mesh material={wood} position={[SHELF_DEPTH / 2 - 0.01, height / 2, 0]}>
        <boxGeometry args={[0.02, height, SHELF_LEN]} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} material={wood} position={[0, height / 2, s * (SHELF_LEN / 2 - 0.015)]}>
          <boxGeometry args={[SHELF_DEPTH, height, 0.03]} />
        </mesh>
      ))}
      {BOARDS.map((y) => (
        <mesh key={y} material={wood} position={[0, y, 0]}>
          <boxGeometry args={[SHELF_DEPTH, 0.03, SHELF_LEN]} />
        </mesh>
      ))}
      {/* Label strip on the games shelf */}
      <mesh position={[-SHELF_DEPTH / 2 - 0.001, GAME_BOARD - 0.005, 0]} rotation-y={-Math.PI / 2}>
        <planeGeometry args={[SHELF_LEN - 0.1, 0.022]} />
        <meshBasicMaterial color="#ff3fb4" toneMapped={false} />
      </mesh>
      <ShelfClutter />
    </group>
  );
}

/** Books, cartridges and a trophy on the other shelves. */
function ShelfClutter() {
  const books = useMemo(() => {
    const colors = ['#c0392b', '#2c3e8f', '#e1b12c', '#16a085', '#8e44ad', '#d35400', '#2d3436'];
    const out: { z: number; h: number; t: number; c: string; y: number }[] = [];
    [BOARDS[1], BOARDS[2]].forEach((y, row) => {
      let z = -SHELF_LEN / 2 + 0.08;
      let i = row * 3;
      while (z < (row ? 0.1 : SHELF_LEN / 2 - 0.1)) {
        const t = 0.03 + ((i * 7) % 4) * 0.01;
        const h = 0.2 + ((i * 5) % 5) * 0.025;
        out.push({ z: z + t / 2, h, t, c: colors[i % colors.length], y });
        z += t + 0.004;
        i++;
      }
    });
    return out;
  }, []);
  return (
    <group>
      {books.map((b, i) => (
        <mesh key={i} position={[0.02, b.y + 0.015 + b.h / 2, b.z]}>
          <boxGeometry args={[0.2, b.h, b.t]} />
          <meshStandardMaterial color={b.c} roughness={0.8} />
        </mesh>
      ))}
      {/* Trophy */}
      <group position={[0, BOARDS[2] + 0.015, 0.55]}>
        <mesh position-y={0.03}>
          <boxGeometry args={[0.1, 0.06, 0.1]} />
          <meshStandardMaterial color="#2d2d2d" />
        </mesh>
        <mesh position-y={0.15}>
          <cylinderGeometry args={[0.06, 0.03, 0.14, 16]} />
          <meshStandardMaterial color="#f1c40f" metalness={0.8} roughness={0.25} />
        </mesh>
      </group>
      {/* Loose cartridges */}
      {[0, 1, 2, 3, 4].map((i) => (
        <mesh key={i} position={[-0.02, BOARDS[0] + 0.015 + 0.06, -0.6 + i * 0.09]}>
          <boxGeometry args={[0.1, 0.12, 0.025]} />
          <meshStandardMaterial color={['#555', '#3a3a7a', '#7a3a3a', '#3a6a3a', '#666'][i]} roughness={0.6} />
        </mesh>
      ))}
      {/* Controller resting on the bottom shelf */}
      <mesh position={[0.02, BOARDS[0] + 0.035, 0.45]} scale={[1, 0.4, 1.6]}>
        <sphereGeometry args={[0.06, 16, 10]} />
        <meshStandardMaterial color="#3b3b44" roughness={0.5} />
      </mesh>
    </group>
  );
}

function GameBox({ project, rest, lean }: { project: PortfolioProject; rest: Vector3; lean: number }) {
  const group = useRef<Group>(null);
  const camera = useThree((s) => s.camera);
  const cover = useOwnedTexture(() => boxCoverTexture(project), [project]);
  const back = useOwnedTexture(() => boxBackTexture(project), [project]);
  const spine = useOwnedTexture(() => boxSpineTexture(project), [project]);
  const tmp = useMemo(
    () => ({
      restQuat: new Quaternion().setFromEuler(new Euler(lean, -Math.PI / 2, 0, 'YXZ')),
      quat: new Quaternion(),
      spin: new Quaternion(),
      euler: new Euler(),
      pos: new Vector3(),
      fwd: new Vector3(),
      started: false,
    }),
    [lean],
  );

  const target = useMemo(
    () => ({
      id: `box-${project.id}`,
      object: () => group.current,
      prompt: () => `[E] Pick up ${project.title}   [I] Manual`,
      use: () => pickUp(project),
      inspect: () => openManual(project),
      reach: 2.4,
    }),
    [project],
  );
  useLookTarget(target);

  useFrame((_, dt) => {
    const g = group.current;
    if (!g) return;
    const room = useRoom.getState();
    const held = room.heldId === project.id;
    if (!tmp.started) {
      g.position.copy(rest);
      g.quaternion.copy(tmp.restQuat);
      tmp.started = true;
    }
    let k = 1 - Math.exp(-dt * 12);
    g.visible = true;
    if (held && room.mode === 'inspect') {
      camera.getWorldDirection(tmp.fwd);
      tmp.pos.copy(camera.position).addScaledVector(tmp.fwd, 0.36);
      tmp.euler.set(roomRuntime.inspectPitch, roomRuntime.inspectYaw, 0, 'XYZ');
      tmp.spin.setFromEuler(tmp.euler);
      tmp.quat.copy(camera.quaternion).multiply(tmp.spin);
    } else if (held && room.mode === 'inserting') {
      // Fly into the console slot, turning flat as it goes in.
      tmp.pos.copy(CONSOLE_SLOT);
      tmp.quat.setFromEuler(tmp.euler.set(-Math.PI / 2, 0, 0));
      k = 1 - Math.exp(-dt * 7);
      const s = Math.max(0.25, 1 - roomRuntime.insertT);
      g.scale.setScalar(s);
    } else if (room.insertedId === project.id) {
      g.visible = false;
      g.position.copy(CONSOLE_SLOT);
      g.scale.setScalar(1);
      return;
    } else {
      tmp.pos.copy(rest);
      tmp.quat.copy(tmp.restQuat);
      g.scale.setScalar(1);
    }
    g.position.lerp(tmp.pos, k);
    g.quaternion.slerp(tmp.quat, k);
  });

  return (
    <group ref={group} userData={{ lookId: `box-${project.id}` }}>
      <mesh>
        <boxGeometry args={[BOX.w, BOX.h, BOX.d]} />
        <meshStandardMaterial attach="material-0" map={spine} roughness={0.45} />
        <meshStandardMaterial attach="material-1" map={spine} roughness={0.45} />
        <meshStandardMaterial attach="material-2" color={project.boxColor ?? '#4a2a6a'} roughness={0.45} />
        <meshStandardMaterial attach="material-3" color={project.boxColor ?? '#4a2a6a'} roughness={0.45} />
        <meshStandardMaterial attach="material-4" map={cover} roughness={0.35} />
        <meshStandardMaterial attach="material-5" map={back} roughness={0.45} />
      </mesh>
    </group>
  );
}
