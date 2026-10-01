import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import { AdditiveBlending, Group, Mesh, Quaternion, Vector3 } from 'three';
import { Portal } from '../../engine/portals/Portal';
import { destination } from '../../engine/portals/destinations';
import { useInteractable } from '../../engine/interaction/interactions';
import { audio } from '../../engine/audio/AudioManager';
import { preloadWorld } from '../../engine/loading/worlds';
import { releaseLock } from '../../engine/input/pointerLock';
import { track } from '../../analytics/track';
import { useGame } from '../../stores/gameStore';
import { qualityProfile } from '../../stores/settingsStore';
import { makeTextTexture } from '../../utils/textTexture';
import { HubEnvironment, type HubEnvironmentHandle } from './HubEnvironment';
import { HubFirstPersonController } from './HubFirstPersonController';
import { PortalLauncher } from './PortalLauncher';
import { hubAim } from './hubAim';
import { useHubTutorial } from './useHubTutorial';

export default function HubWorld() {
  const env = useRef<HubEnvironmentHandle>(null);
  const shadows = qualityProfile().shadows;
  useHubTutorial();

  return (
    <>
      <color attach="background" args={['#07060c']} />
      <fog attach="fog" args={['#07060c', 18, 42]} />
      <hemisphereLight args={['#8f86c9', '#141020', 0.7]} />
      <ambientLight intensity={0.15} />
      <directionalLight
        position={[6, 12, 4]}
        intensity={0.9}
        castShadow={shadows}
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-15}
        shadow-camera-right={15}
        shadow-camera-top={15}
        shadow-camera-bottom={-15}
      />
      <HubEnvironment ref={env} />
      <Terminal
        id="resume-terminal"
        position={[9.5, 0, 11.8]}
        rotationY={Math.PI + 0.5}
        title="PERSONNEL FILE"
        subtitle="Résumé · Experience · Education"
        color="#7fe0ff"
        prompt="[E] Open résumé terminal"
        onUse={() => {
          track('resume_opened', { from: 'hub-terminal' });
          releaseLock();
          useGame.getState().openOverlay('quick', 'resume');
        }}
      />
      <Terminal
        id="contact-terminal"
        position={[-9.5, 0, 11.8]}
        rotationY={Math.PI - 0.5}
        title="COMMS RELAY"
        subtitle="Email · GitHub · LinkedIn"
        color="#ffcf7f"
        prompt="[E] Open contact relay"
        onUse={() => {
          track('contact_clicked', { from: 'hub-terminal' });
          releaseLock();
          useGame.getState().openOverlay('quick', 'contact');
        }}
      />
      <HubFirstPersonController env={env} />
      <PortalLauncher />
      <AimMarker />
      <ActivePortal />
    </>
  );
}

/** Faint ring on the wall where the portal would open. */
function AimMarker() {
  const ref = useRef<Mesh>(null);
  const dest = useGame((s) => s.portalDestination);
  const color = destination(dest)?.color ?? '#fff';
  const q = useMemo(() => new Quaternion(), []);
  const z = useMemo(() => new Vector3(0, 0, 1), []);
  useFrame((state) => {
    const m = ref.current;
    if (!m) return;
    const hit = hubAim.hit;
    const portal = useGame.getState().portal;
    m.visible = !!hit && !portal;
    if (hit) {
      m.position.copy(hit.position);
      m.quaternion.copy(q.setFromUnitVectors(z, hit.normal));
      const s = 1 + Math.sin(state.clock.elapsedTime * 4) * 0.03;
      m.scale.set(s, s * 1.3, 1);
    }
  });
  return (
    <mesh ref={ref} visible={false} renderOrder={4}>
      <ringGeometry args={[1.18, 1.28, 64]} />
      <meshBasicMaterial color={color} transparent opacity={0.55} depthWrite={false} blending={AdditiveBlending} />
    </mesh>
  );
}

/** Projectile flight, then the portal expands on the wall. */
function ActivePortal() {
  const portal = useGame((s) => s.portal);
  const projectile = useRef<Group>(null);
  const t = useRef(0);

  useEffect(() => {
    t.current = 0;
    if (portal?.state === 'projectile') preloadWorld(portal.destination).catch(() => {});
  }, [portal?.id, portal?.state, portal?.destination]);

  useFrame((_, dt) => {
    if (!portal || portal.state === 'open') return;
    t.current += dt;
    const game = useGame.getState();
    if (portal.state === 'projectile') {
      const k = Math.min(1, t.current / 0.22);
      projectile.current?.position.lerpVectors(new Vector3(...portal.from), new Vector3(...portal.position), k);
      if (k >= 1) {
        audio.play('portalOpen');
        game.setPortal({ ...portal, state: 'opening' });
      }
    } else if (portal.state === 'opening' && t.current > 1.1) {
      game.setPortal({ ...portal, state: 'open' });
    }
  });

  if (!portal) return null;
  const d = destination(portal.destination)!;
  return (
    <>
      {portal.state === 'projectile' && (
        <group ref={projectile} position={portal.from}>
          <mesh>
            <sphereGeometry args={[0.07, 12, 12]} />
            <meshBasicMaterial color={d.color2} toneMapped={false} />
          </mesh>
          <mesh>
            <sphereGeometry args={[0.2, 12, 12]} />
            <meshBasicMaterial color={d.color} transparent opacity={0.5} blending={AdditiveBlending} depthWrite={false} />
          </mesh>
          <pointLight color={d.color} intensity={4} distance={6} />
        </group>
      )}
      <Portal
        key={portal.id}
        position={portal.position}
        normal={portal.normal}
        color={d.color}
        color2={d.color2}
        preview={d.id === 'data-science' ? 'space' : d.id === 'games' ? 'room' : d.id === 'software' ? 'road' : 'generic'}
        open={portal.state === 'projectile' ? 0 : 1}
      />
    </>
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
          { text: subtitle, size: 34, weight: '500', color: '#d9e6ff' },
          { text: 'PRESS [E]', size: 30, weight: '700', color: '#ffffff' },
        ],
        { width: 800, height: 420, background: '#050a14', glow: color },
      ),
    [title, subtitle, color],
  );
  useEffect(() => () => screen.dispose(), [screen]);
  const pos = useMemo(() => new Vector3(position[0], 1.2, position[2]), [position]);
  const item = useMemo(() => ({ id, label: prompt, position: () => pos, radius: 2.6, onInteract: onUse }), [id, prompt, pos, onUse]);
  useInteractable(item);
  const glow = useRef<Mesh>(null);
  useFrame((state) => {
    if (glow.current) (glow.current.material as { opacity: number }).opacity = 0.25 + Math.sin(state.clock.elapsedTime * 2) * 0.08;
  });

  return (
    <group position={position} rotation-y={rotationY}>
      <mesh position-y={0.55}>
        <boxGeometry args={[1.4, 1.1, 0.7]} />
        <meshStandardMaterial color="#1e1c2b" metalness={0.6} roughness={0.4} />
      </mesh>
      <mesh position={[0, 1.45, -0.05]} rotation-x={-0.35}>
        <boxGeometry args={[1.5, 0.9, 0.08]} />
        <meshStandardMaterial color="#12101c" metalness={0.5} roughness={0.5} />
      </mesh>
      <mesh position={[0, 1.465, -0.005]} rotation-x={-0.35}>
        <planeGeometry args={[1.36, 0.76]} />
        <meshBasicMaterial map={screen} toneMapped={false} />
      </mesh>
      <mesh ref={glow} position={[0, 0.02, 0]} rotation-x={-Math.PI / 2}>
        <ringGeometry args={[0.9, 1.1, 48]} />
        <meshBasicMaterial color={color} transparent opacity={0.3} blending={AdditiveBlending} depthWrite={false} />
      </mesh>
      <pointLight color={color} intensity={2.5} distance={4} position={[0, 1.8, 0.6]} />
    </group>
  );
}

