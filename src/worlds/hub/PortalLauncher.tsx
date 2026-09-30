// The dimensional rift launcher, held in first person. An original design: a compact
// emitter with three energy rings and a holographic destination selector that floats
// above it. Its energy colour AND the selector symbol change with the destination.
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import { AdditiveBlending, Color, Group, MeshBasicMaterial, MeshStandardMaterial, Vector3 } from 'three';
import { DESTINATIONS, destination } from '../../engine/portals/destinations';
import { useGame } from '../../stores/gameStore';
import { useSettings } from '../../stores/settingsStore';
import { makeTextTexture } from '../../utils/textTexture';

/** Shared between the controller and the launcher each frame. */
export const launcherRuntime = {
  speed: 0,
  recoil: 0,
  muzzle: new Vector3(),
};

export function PortalLauncher() {
  const root = useRef<Group>(null);
  const model = useRef<Group>(null);
  const muzzleRef = useRef<Group>(null);
  const selectorRef = useRef<Group>(null);
  const camera = useThree((s) => s.camera);
  const dest = useGame((s) => s.portalDestination);
  const reducedMotion = useSettings((s) => s.reducedMotion);
  const bob = useRef(0);

  const mats = useMemo(
    () => ({
      energy: new MeshBasicMaterial({ color: '#3d7bff', toneMapped: false }),
      core: new MeshBasicMaterial({ color: '#9fd0ff', toneMapped: false }),
      glow: new MeshBasicMaterial({ color: '#3d7bff', transparent: true, opacity: 0.35, blending: AdditiveBlending, depthWrite: false }),
      body: new MeshStandardMaterial({ color: '#e8e6f0', roughness: 0.35, metalness: 0.2 }),
      dark: new MeshStandardMaterial({ color: '#2a2838', roughness: 0.5, metalness: 0.6 }),
    }),
    [],
  );

  const icons = useMemo(
    () =>
      DESTINATIONS.map((d) =>
        makeTextTexture([{ text: d.symbol, size: 180, weight: '800', color: '#fff' }, { text: d.key, size: 60, color: d.color2 }], {
          width: 256,
          height: 320,
          glow: d.color,
        }),
      ),
    [],
  );
  useEffect(() => () => icons.forEach((t) => t.dispose()), [icons]);
  useEffect(() => () => Object.values(mats).forEach((m) => m.dispose()), [mats]);

  useEffect(() => {
    const d = destination(dest);
    if (!d) return;
    mats.energy.color.set(d.color);
    mats.glow.color.set(d.color);
    mats.core.color.set(new Color(d.color2));
  }, [dest, mats]);

  useFrame((state, dt) => {
    if (!root.current || !model.current) return;
    root.current.position.copy(camera.position);
    root.current.quaternion.copy(camera.quaternion);
    const t = state.clock.elapsedTime;
    const motion = reducedMotion ? 0.3 : 1;
    bob.current += dt * (4 + launcherRuntime.speed * 1.4);
    const walk = Math.min(1, launcherRuntime.speed / 4) * motion;
    launcherRuntime.recoil = Math.max(0, launcherRuntime.recoil - dt * 4);
    const r = launcherRuntime.recoil;
    model.current.position.set(
      0.24 + Math.sin(bob.current) * 0.01 * walk,
      -0.21 + Math.abs(Math.cos(bob.current)) * 0.012 * walk + Math.sin(t * 1.5) * 0.003 * motion,
      -0.5 + r * 0.08,
    );
    model.current.rotation.set(r * 0.25, 0.06, 0);
    if (selectorRef.current) {
      const idx = DESTINATIONS.findIndex((d) => d.id === dest);
      selectorRef.current.children.forEach((c, i) => {
        const target = i === idx ? 1.25 : 0.8;
        c.scale.setScalar(c.scale.x + (target - c.scale.x) * Math.min(1, dt * 10));
        const m = (c as unknown as { material: MeshBasicMaterial }).material;
        m.opacity = i === idx ? 1 : 0.45;
      });
    }
    muzzleRef.current?.getWorldPosition(launcherRuntime.muzzle);
    const pulse = 0.3 + Math.sin(t * 6) * 0.08 + r * 0.5;
    mats.glow.opacity = pulse;
  });

  return (
    <group ref={root}>
      <group ref={model} scale={0.6}>
        {/* Grip + body */}
        <mesh material={mats.dark} position={[0, -0.09, 0.12]} rotation-x={0.35}>
          <boxGeometry args={[0.07, 0.16, 0.08]} />
        </mesh>
        <mesh material={mats.body} rotation-x={Math.PI / 2}>
          <capsuleGeometry args={[0.065, 0.3, 6, 16]} />
        </mesh>
        <mesh material={mats.dark} position={[0, 0.05, 0.02]}>
          <boxGeometry args={[0.05, 0.05, 0.26]} />
        </mesh>
        {/* Energy rings along the barrel */}
        {[-0.05, -0.13, -0.21].map((z, i) => (
          <mesh key={i} material={mats.energy} position-z={z}>
            <torusGeometry args={[0.075 - i * 0.006, 0.012, 8, 32]} />
          </mesh>
        ))}
        {/* Emitter */}
        <mesh material={mats.dark} position-z={-0.27} rotation-x={Math.PI / 2}>
          <cylinderGeometry args={[0.05, 0.075, 0.08, 20]} />
        </mesh>
        <group ref={muzzleRef} position-z={-0.33}>
          <mesh material={mats.core}>
            <sphereGeometry args={[0.03, 16, 16]} />
          </mesh>
          <mesh material={mats.glow}>
            <sphereGeometry args={[0.06, 16, 16]} />
          </mesh>
        </group>
        {/* Holographic selector */}
        <group ref={selectorRef} position={[0, 0.14, -0.08]}>
          {icons.map((tex, i) => (
            <mesh key={i} position={[(i - 1.5) * 0.055, 0, 0]} rotation-x={-0.25}>
              <planeGeometry args={[0.045, 0.056]} />
              <meshBasicMaterial map={tex} transparent depthWrite={false} toneMapped={false} />
            </mesh>
          ))}
        </group>
      </group>
    </group>
  );
}
