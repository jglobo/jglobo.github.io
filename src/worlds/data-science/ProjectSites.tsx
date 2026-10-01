// Project locations that physically exist in orbit. Each site hosts the project
// whose `location` matches its id in the content files; a site with no project is
// simply not built.
import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import { AdditiveBlending, Group, Mesh, MeshStandardMaterial, Vector3 } from 'three';
import { projectAtLocation, publishedUrl, type PortfolioProject } from '../../content';
import { activeInteractable, useInteractable } from '../../engine/interaction/interactions';
import { wasPressed } from '../../engine/input/input';
import { openProjectSite } from '../../portfolio/openProjectSite';
import { releaseLock } from '../../engine/input/pointerLock';
import { track } from '../../analytics/track';
import { gameplayBlocked, useGame } from '../../stores/gameStore';
import { useSettings } from '../../stores/settingsStore';
import { makeTextTexture } from '../../utils/textTexture';
import { rockGeometry } from './SpaceEnvironment';
import { DataHologram } from './DataHologram';
import type { AstronautRuntime } from './Astronaut';

export interface SiteDef {
  id: string;
  name: string;
  x: number;
  y: number;
  /** Collision radius for the astronaut. */
  collide: number;
  /** Distance at which the hologram activates and E works. */
  reach: number;
  symbol: string;
}

export const SITES: SiteDef[] = [
  { id: 'asteroid-lab', name: 'Asteroid Research Base', x: 24, y: 3, collide: 3.9, reach: 8, symbol: '◆' },
  { id: 'station', name: 'Orbital Station', x: -26, y: 13, collide: 3.2, reach: 9, symbol: '◎' },
  { id: 'satellite', name: 'Research Satellite', x: 5, y: 27, collide: 2.2, reach: 7, symbol: '✧' },
];

export const activeSites = () =>
  SITES.map((site) => ({ site, project: projectAtLocation('data-science', site.id) })).filter(
    (s): s is { site: SiteDef; project: PortfolioProject } => !!s.project,
  );

export function ProjectSites({ runtime }: { runtime: React.RefObject<AstronautRuntime> }) {
  const sites = useMemo(activeSites, []);
  return (
    <>
      {sites.map(({ site, project }) => (
        <ProjectSite key={site.id} site={site} project={project} runtime={runtime} />
      ))}
    </>
  );
}

function ProjectSite({ site, project, runtime }: { site: SiteDef; project: PortfolioProject; runtime: React.RefObject<AstronautRuntime> }) {
  const pos = useMemo(() => new Vector3(site.x, site.y, 0), [site]);
  const proximity = useRef(0);
  const beacon = useRef<Mesh>(null);
  const discovered = useGame((s) => s.discoveredProjects.includes(project.id));

  const hasSite = !!publishedUrl(project);
  const showDetails = () => {
    track('project_viewed', { project: project.id, from: 'data-science-world' });
    releaseLock();
    useGame.getState().openProject(project.id);
  };
  // E goes straight to the published project; I opens the in-world details panel.
  const item = useMemo(
    () => ({
      id: `site-${site.id}`,
      label: hasSite ? `[E] Visit ${project.title} ↗   [I] Details` : `[E] Access research data: ${project.title}`,
      position: () => pos,
      radius: site.reach,
      onInteract: () => (hasSite ? openProjectSite(project, 'data-science-world') : showDetails()),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [site, project, pos, hasSite],
  );
  useInteractable(item);

  const label = useMemo(
    () =>
      makeTextTexture(
        [
          { text: `${site.symbol} ${site.name.toUpperCase()}`, size: 44, weight: '800', color: '#bfe1ff' },
          { text: project.title, size: 38, weight: '600', color: '#ffffff' },
        ],
        { width: 1024, height: 170, glow: '#3d7bff' },
      ),
    [site, project],
  );
  useEffect(() => () => label.dispose(), [label]);

  useFrame((state, dt) => {
    if (activeInteractable() === item.id && !gameplayBlocked() && wasPressed('inspect')) showDetails();
    const r = runtime.current;
    const d = r ? Math.hypot(r.x - site.x, r.y - site.y) : 99;
    const target = d < site.reach + 3 ? 1 : 0;
    proximity.current += (target - proximity.current) * Math.min(1, dt * 3);
    if (beacon.current) {
      const m = beacon.current.material as { opacity: number };
      m.opacity = 0.35 + Math.sin(state.clock.elapsedTime * 3) * 0.2;
    }
  });

  const clickable = hasSite
    ? {
        onClick: (e: { stopPropagation: () => void }) => {
          e.stopPropagation();
          openProjectSite(project, 'data-science-click');
        },
        onPointerOver: () => (document.body.style.cursor = 'pointer'),
        onPointerOut: () => (document.body.style.cursor = ''),
      }
    : {};
  useEffect(() => () => void (document.body.style.cursor = ''), []);

  return (
    <group position={pos}>
      {/* Clicking the site itself also opens the published project */}
      <group {...clickable}>
      {site.id === 'asteroid-lab' && <AsteroidLab />}
      {site.id === 'station' && <OrbitalStation />}
      {site.id === 'satellite' && <ResearchSatellite />}
      {/* Name plate above the site */}
      <mesh position={[0, site.collide + 2.4, 0]}>
        <planeGeometry args={[6, 1]} />
        <meshBasicMaterial map={label} transparent depthWrite={false} toneMapped={false} />
      </mesh>
      </group>
      {/* Beacon ring: dims once the project has been viewed */}
      <mesh ref={beacon} rotation-x={0} position-z={-0.5}>
        <ringGeometry args={[site.reach - 0.15, site.reach, 96]} />
        <meshBasicMaterial color={discovered ? '#4a6a9a' : '#6fb6ff'} transparent opacity={0.4} blending={AdditiveBlending} depthWrite={false} />
      </mesh>
      {project.visualization && (
        <DataHologram viz={project.visualization} proximity={proximity} offset={[site.x > 0 ? -7.5 : 7.5, 1.5, 1]} />
      )}
    </group>
  );
}

function AsteroidLab() {
  const geo = useMemo(() => rockGeometry(3.4, 42, 3), []);
  useEffect(() => () => geo.dispose(), [geo]);
  const spin = useRef<Group>(null);
  const reducedMotion = useSettings((s) => s.reducedMotion);
  useFrame((_, dt) => {
    if (spin.current && !reducedMotion) spin.current.rotation.z += dt * 0.03;
  });
  return (
    <group ref={spin}>
      <mesh geometry={geo}>
        <meshStandardMaterial color="#7a7068" roughness={0.95} flatShading />
      </mesh>
      {/* Lab dome and module on the surface */}
      <group position={[0.4, 3.0, 0.3]} rotation-z={-0.1}>
        <mesh>
          <sphereGeometry args={[1.25, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshStandardMaterial color="#9fd0ff" transparent opacity={0.35} roughness={0.05} metalness={0.2} emissive="#3d7bff" emissiveIntensity={0.4} />
        </mesh>
        <mesh position={[1.7, 0.35, 0]}>
          <boxGeometry args={[1.6, 0.7, 0.9]} />
          <meshStandardMaterial color="#e3e5ee" roughness={0.4} metalness={0.3} />
        </mesh>
        {[-0.3, 0.2, 0.7].map((x) => (
          <mesh key={x} position={[1.7 + x - 0.2, 0.4, 0.46]}>
            <planeGeometry args={[0.3, 0.2]} />
            <meshBasicMaterial color="#ffe6a0" toneMapped={false} />
          </mesh>
        ))}
        <mesh position={[-0.6, 1.7, 0]}>
          <cylinderGeometry args={[0.03, 0.03, 1.4]} />
          <meshStandardMaterial color="#cccccc" />
        </mesh>
        <mesh position={[-0.6, 2.45, 0]}>
          <sphereGeometry args={[0.1, 8, 8]} />
          <meshBasicMaterial color="#ff5050" toneMapped={false} />
        </mesh>
        <pointLight color="#9fd0ff" intensity={4} distance={8} position={[0, 1, 1.2]} />
      </group>
    </group>
  );
}

function OrbitalStation() {
  const ring = useRef<Group>(null);
  const reducedMotion = useSettings((s) => s.reducedMotion);
  const hull = useMemo(() => new MeshStandardMaterial({ color: '#dfe2ea', roughness: 0.4, metalness: 0.5 }), []);
  const panel = useMemo(() => new MeshStandardMaterial({ color: '#1d3478', emissive: '#0b1a44', roughness: 0.3, metalness: 0.7 }), []);
  useEffect(() => () => { hull.dispose(); panel.dispose(); }, [hull, panel]);
  useFrame((_, dt) => {
    if (ring.current) ring.current.rotation.z += dt * (reducedMotion ? 0.02 : 0.12);
  });
  return (
    <group rotation={[0.35, -0.4, 0]}>
      <group ref={ring}>
        <mesh material={hull}>
          <torusGeometry args={[3.4, 0.38, 12, 64]} />
        </mesh>
        {[0, 1, 2, 3].map((i) => (
          <mesh key={i} material={hull} rotation-z={(i * Math.PI) / 4}>
            <boxGeometry args={[6.8, 0.14, 0.14]} />
          </mesh>
        ))}
        {Array.from({ length: 16 }, (_, i) => {
          const a = (i / 16) * Math.PI * 2;
          return (
            <mesh key={i} position={[Math.cos(a) * 3.4, Math.sin(a) * 3.4, 0.39]}>
              <planeGeometry args={[0.28, 0.18]} />
              <meshBasicMaterial color="#aee3ff" toneMapped={false} />
            </mesh>
          );
        })}
      </group>
      <mesh material={hull} rotation-x={Math.PI / 2}>
        <cylinderGeometry args={[0.8, 0.8, 2.6, 20]} />
      </mesh>
      <mesh position-z={1.4}>
        <sphereGeometry args={[0.5, 16, 16]} />
        <meshBasicMaterial color="#6fb6ff" toneMapped={false} />
      </mesh>
      {[-1, 1].map((s) => (
        <group key={s} position={[0, 0, s * 2.3]}>
          <mesh material={hull} rotation-x={Math.PI / 2}>
            <cylinderGeometry args={[0.1, 0.1, 1.2, 8]} />
          </mesh>
          <mesh material={panel} position={[0, 0, s * 0.8]} rotation-y={Math.PI / 2}>
            <boxGeometry args={[0.05, 1.6, 4.5]} />
          </mesh>
        </group>
      ))}
      <pointLight color="#9fd0ff" intensity={5} distance={10} position={[0, 0, 3]} />
    </group>
  );
}

function ResearchSatellite() {
  const dish = useRef<Group>(null);
  useFrame((state) => {
    if (dish.current) dish.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.4) * 0.5;
  });
  return (
    <group rotation={[0.2, 0.5, -0.2]}>
      <mesh>
        <boxGeometry args={[1.3, 1.3, 1.8]} />
        <meshStandardMaterial color="#c9a95a" roughness={0.3} metalness={0.9} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * 2.3, 0, 0]}>
          <boxGeometry args={[3, 0.06, 1.3]} />
          <meshStandardMaterial color="#1d3478" emissive="#0b1a44" roughness={0.3} metalness={0.7} />
        </mesh>
      ))}
      <group ref={dish} position={[0, 1.1, 0]}>
        <mesh rotation-x={-0.6}>
          <sphereGeometry args={[0.9, 24, 12, 0, Math.PI * 2, 0, 0.9]} />
          <meshStandardMaterial color="#eeeeee" side={2} roughness={0.5} />
        </mesh>
        <mesh position={[0, 0.25, 0.3]}>
          <sphereGeometry args={[0.08, 8, 8]} />
          <meshBasicMaterial color="#7fe0ff" toneMapped={false} />
        </mesh>
      </group>
      <pointLight color="#ffd27f" intensity={3} distance={7} position={[0, 0, 2]} />
    </group>
  );
}
