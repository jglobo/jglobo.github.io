import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import { Matrix4, Mesh, Quaternion, Vector3 } from 'three';
import { useInteractable } from '../../engine/interaction/interactions';
import { releaseLock } from '../../engine/input/pointerLock';
import { track } from '../../analytics/track';
import { useGame } from '../../stores/gameStore';
import { qualityProfile } from '../../stores/settingsStore';
import { makeTextTexture } from '../../utils/textTexture';
import { PORTAL_HALF, ROOM, TERMINALS } from './chamber';
import { HubEnvironment } from './HubEnvironment';
import { HubFirstPersonController } from './HubFirstPersonController';
import { PortalLauncher } from './PortalLauncher';
import { Puzzles } from './Puzzles';
import { TeleportConsole } from './TeleportConsole';
import { aimTarget, hubAim } from './hubAim';
import { useHubTutorial } from './useHubTutorial';

export default function HubWorld() {
  const shadows = qualityProfile().shadows;
  useHubTutorial();

  return (
    <>
      <color attach="background" args={['#dfe4e8']} />
      <fog attach="fog" args={['#dfe4e8', 30, 60]} />
      <hemisphereLight args={['#ffffff', '#8a939b', 1.25]} />
      <ambientLight intensity={0.35} />
      <directionalLight
        position={[5, 14, 6]}
        intensity={1.3}
        castShadow={shadows}
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-15}
        shadow-camera-right={15}
        shadow-camera-top={15}
        shadow-camera-bottom={-15}
      />
      {[[-7, -7], [7, -7], [-7, 7], [7, 7]].map(([x, z]) => (
        <pointLight key={`${x}${z}`} position={[x, ROOM.height - 0.8, z]} intensity={6} distance={16} decay={1.4} color="#f4f8ff" />
      ))}
      <HubEnvironment />
      <TeleportConsole />
      <Puzzles />
      <Terminal
        id="resume-terminal"
        position={[TERMINALS[0].x, 0, TERMINALS[0].z]}
        rotationY={TERMINALS[0].yaw}
        title="PERSONNEL FILE"
        subtitle="Résumé · Experience · Education"
        color="#2f6f73"
        prompt="[E] Open résumé terminal"
        onUse={() => {
          track('resume_opened', { from: 'hub-terminal' });
          releaseLock();
          useGame.getState().openOverlay('quick', 'resume');
        }}
      />
      <Terminal
        id="contact-terminal"
        position={[TERMINALS[1].x, 0, TERMINALS[1].z]}
        rotationY={TERMINALS[1].yaw}
        title="COMMS RELAY"
        subtitle="Email · GitHub · LinkedIn"
        color="#96600f"
        prompt="[E] Open contact relay"
        onUse={() => {
          track('contact_clicked', { from: 'hub-terminal' });
          releaseLock();
          useGame.getState().openOverlay('quick', 'contact');
        }}
      />
      <HubFirstPersonController />
      <PortalLauncher />
      <AimMarker />
    </>
  );
}

/** Outline on the panel where the portal would open. */
function AimMarker() {
  const ref = useRef<Mesh>(null);
  const m = useMemo(() => new Matrix4(), []);
  const s = useMemo(() => new Vector3(), []);
  const q = useMemo(() => new Quaternion(), []);
  useFrame((state) => {
    const mesh = ref.current;
    if (!mesh) return;
    const f = hubAim.hit?.frame;
    mesh.visible = !!f;
    if (!f) return;
    m.makeBasis(f.right, f.up, f.normal).setPosition(f.pos).decompose(mesh.position, q, s);
    mesh.quaternion.copy(q);
    mesh.position.addScaledVector(f.normal, 0.015);
    const k = 1 + Math.sin(state.clock.elapsedTime * 4) * 0.02;
    mesh.scale.set(k * PORTAL_HALF.w, k * PORTAL_HALF.h, 1);
  });
  return (
    <mesh ref={ref} visible={false} renderOrder={4}>
      <ringGeometry args={[0.94, 1, 64]} />
      <meshBasicMaterial color="#56616c" transparent opacity={0.5} depthWrite={false} />
    </mesh>
  );
}

function Terminal(props: {
  id: string;
  position: [number, number, number];
  rotationY: number;
  title: string;
  subtitle: string;
  color: string;
  prompt: string;
  onUse: () => void;
}) {
  const { id, position, rotationY, title, subtitle, color, prompt, onUse } = props;
  const screen = useMemo(
    () =>
      makeTextTexture(
        [
          { text: title, size: 64, weight: '800', color },
          { text: subtitle, size: 34, weight: '600', color: '#1f2a37' },
          { text: 'PRESS [E]', size: 30, weight: '700', color: '#55606c' },
        ],
        { width: 800, height: 420, background: '#f6f7f8' },
      ),
    [title, subtitle, color],
  );
  useEffect(() => () => screen.dispose(), [screen]);
  const pos = useMemo(() => new Vector3(position[0], 1.2, position[2]), [position]);
  const item = useMemo(() => ({ id, label: prompt, position: () => pos, radius: 2.2, onInteract: onUse }), [id, prompt, pos, onUse]);
  useInteractable(item);

  return (
    <group position={position} rotation-y={rotationY}>
      <mesh ref={aimTarget} position-y={0.55} castShadow>
        <boxGeometry args={[1.2, 1.1, 0.6]} />
        <meshStandardMaterial color="#eef1f3" roughness={0.45} />
      </mesh>
      <mesh position={[0, 1.4, -0.05]} rotation-x={-0.35}>
        <boxGeometry args={[1.3, 0.8, 0.08]} />
        <meshStandardMaterial color="#3a4046" metalness={0.4} roughness={0.4} />
      </mesh>
      <mesh position={[0, 1.415, -0.005]} rotation-x={-0.35}>
        <planeGeometry args={[1.18, 0.68]} />
        <meshStandardMaterial map={screen} emissive="#ffffff" emissiveMap={screen} emissiveIntensity={0.3} roughness={0.5} />
      </mesh>
    </group>
  );
}
