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
  { id: 'probe', name: 'Autopilot Test Range', x: -15, y: -12, collide: 2.8, reach: 7.5, symbol: '✦' },
  { id: 'fuel-depot', name: 'Orbital Fuel Depot', x: 31, y: -13, collide: 2.8, reach: 7.5, symbol: '◈' },
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
      {site.id === 'probe' && <AutopilotRange />}
      {site.id === 'fuel-depot' && <FuelDepot />}
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

/** Floating pipe gates with a little bird-shaped probe that flies itself through them. */
function AutopilotRange() {
  const bird = useRef<Group>(null);
  const wing = useRef<Mesh>(null);
  const reducedMotion = useSettings((s) => s.reducedMotion);
  const pipe = useMemo(() => new MeshStandardMaterial({ color: '#3cb043', roughness: 0.45, metalness: 0.2 }), []);
  const lip = useMemo(() => new MeshStandardMaterial({ color: '#2a8a31', roughness: 0.45, metalness: 0.2 }), []);
  const body = useMemo(() => new MeshStandardMaterial({ color: '#ffcc33', roughness: 0.35, metalness: 0.3, emissive: '#5a3a00', emissiveIntensity: 0.4 }), []);
  useEffect(() => () => { pipe.dispose(); lip.dispose(); body.dispose(); }, [pipe, lip, body]);
  // Two gates with their openings at different heights.
  const gates = [
    { x: -1.6, gap: 0.5 },
    { x: 1.6, gap: -0.6 },
  ];
  useFrame((state) => {
    const t = reducedMotion ? 0 : state.clock.elapsedTime;
    if (bird.current) {
      // Loop left to right, easing toward each gate's opening.
      const u = (t * 0.25) % 1;
      const x = -3 + u * 6;
      const y = x < 0 ? gates[0].gap : gates[1].gap;
      bird.current.position.x = x;
      bird.current.position.y += (y + Math.sin(t * 6) * 0.08 - bird.current.position.y) * 0.08;
      bird.current.rotation.z = Math.sin(t * 6) * 0.15;
    }
    if (wing.current) wing.current.rotation.x = Math.sin(t * 18) * 0.7;
  });
  return (
    <group>
      {gates.map((g) => (
        <group key={g.x} position-x={g.x}>
          {[1, -1].map((s) => {
            const len = 2.6 - s * g.gap;
            const y = g.gap + s * (0.85 + len / 2);
            return (
              <group key={s}>
                <mesh material={pipe} position-y={y}>
                  <cylinderGeometry args={[0.45, 0.45, len, 16]} />
                </mesh>
                <mesh material={lip} position-y={g.gap + s * 0.95}>
                  <cylinderGeometry args={[0.56, 0.56, 0.22, 16]} />
                </mesh>
              </group>
            );
          })}
        </group>
      ))}
      <group ref={bird} position={[-3, gates[0].gap, 0.2]}>
        <mesh material={body} scale={[1.25, 1, 1]}>
          <sphereGeometry args={[0.32, 16, 12]} />
        </mesh>
        <mesh position={[0.36, -0.04, 0]} rotation-z={-Math.PI / 2}>
          <coneGeometry args={[0.1, 0.24, 8]} />
          <meshStandardMaterial color="#ff7a29" />
        </mesh>
        <mesh position={[0.2, 0.1, 0.24]}>
          <sphereGeometry args={[0.08, 8, 8]} />
          <meshBasicMaterial color="#62f2ff" toneMapped={false} />
        </mesh>
        <mesh ref={wing} material={body} position={[-0.06, 0.05, 0]}>
          <boxGeometry args={[0.3, 0.04, 0.7]} />
        </mesh>
        <pointLight color="#ffd27f" intensity={2.5} distance={5} />
      </group>
    </group>
  );
}

/** A floating fuel tank with a pump, a price board and a slowly turning docking ring. */
function FuelDepot() {
  const ring = useRef<Group>(null);
  const reducedMotion = useSettings((s) => s.reducedMotion);
  const tank = useMemo(() => new MeshStandardMaterial({ color: '#d9dde3', roughness: 0.35, metalness: 0.6 }), []);
  const band = useMemo(() => new MeshStandardMaterial({ color: '#e0453a', roughness: 0.4, metalness: 0.3 }), []);
  const dark = useMemo(() => new MeshStandardMaterial({ color: '#2a2f38', roughness: 0.5, metalness: 0.5 }), []);
  const board = useMemo(
    () =>
      makeTextTexture(
        [
          { text: 'GAS PRICES', size: 54, weight: '800', color: '#ffd27f' },
          { text: 'FORECAST', size: 64, weight: '800', color: '#ffffff' },
          { text: 'LIVE APP · PRESS E', size: 30, weight: '600', color: '#7fe0ff' },
        ],
        { width: 640, height: 320, background: '#0b1420', glow: '#ffd27f' },
      ),
    [],
  );
  useEffect(() => () => { tank.dispose(); band.dispose(); dark.dispose(); board.dispose(); }, [tank, band, dark, board]);
  useFrame((_, dt) => {
    if (ring.current && !reducedMotion) ring.current.rotation.z += dt * 0.4;
  });
  return (
    <group rotation-z={-0.12}>
      {/* Tank */}
      <mesh material={tank} rotation-z={Math.PI / 2} position={[-0.6, 0, 0]}>
        <capsuleGeometry args={[1.1, 2.2, 8, 24]} />
      </mesh>
      {[-1.4, 0.2].map((x) => (
        <mesh key={x} material={band} rotation-z={Math.PI / 2} position={[x, 0, 0]}>
          <cylinderGeometry args={[1.14, 1.14, 0.22, 24]} />
        </mesh>
      ))}
      {/* Pump with hose */}
      <mesh material={dark} position={[1.9, -0.2, 0]}>
        <boxGeometry args={[0.9, 1.8, 0.7]} />
      </mesh>
      <mesh material={band} position={[1.9, 0.75, 0.36]}>
        <boxGeometry args={[0.7, 0.18, 0.02]} />
      </mesh>
      <mesh material={dark} position={[2.45, -0.4, 0]} rotation-z={0.5}>
        <torusGeometry args={[0.45, 0.06, 8, 24, Math.PI]} />
      </mesh>
      {/* Price board on a mast */}
      <mesh material={dark} position={[1.9, 1.5, -0.1]}>
        <cylinderGeometry args={[0.06, 0.06, 1.2, 8]} />
      </mesh>
      <mesh position={[1.9, 2.55, 0]}>
        <planeGeometry args={[2.2, 1.1]} />
        <meshBasicMaterial map={board} toneMapped={false} />
      </mesh>
      {/* Docking ring */}
      <group ref={ring} position={[-0.6, 0, 0]}>
        <mesh>
          <torusGeometry args={[1.9, 0.05, 8, 48]} />
          <meshBasicMaterial color="#ffd27f" transparent opacity={0.55} blending={AdditiveBlending} depthWrite={false} />
        </mesh>
      </group>
    </group>
  );
}
