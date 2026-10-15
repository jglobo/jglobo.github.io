// The portal gun, held in first person: Jose's model (assets/portal_gun.glb) and portal
// (assets/portal.glb), played through his controller. Firing plays the gun's Fire clip,
// sends an orb from its Muzzle socket and opens the portal with its Open clip where the
// shot lands. A holographic destination selector floats above the gun, and the gun's
// energy, the orb and the portal take the selected destination's colours.
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import { Group, Vector3, type Material, type MeshBasicMaterial, type MeshStandardMaterial, type Object3D } from 'three';
import { audio } from '../../engine/audio/AudioManager';
import { DESTINATIONS, destination } from '../../engine/portals/destinations';
import type { WorldId } from '../../content';
import { useGame } from '../../stores/gameStore';
import { useSettings } from '../../stores/settingsStore';
import { makeTextTexture } from '../../utils/textTexture';
import gunUrl from './assets/portal_gun.glb?url';
import portalUrl from './assets/portal.glb?url';
import { loadPortalGun, type PortalGun } from './portalGunController';

/** The gun model is about 1.85 m long; this makes it a ~30 cm hand-held launcher. */
const GUN_SCALE = 0.16;
/** The portal model is about 1.1 × 2.1 m; this makes it a walk-through doorway. */
export const PORTAL_SCALE = 1.6;
/** Half the width of the scaled portal, for snapping and the walk-in zone. */
export const PORTAL_HALF_W = 0.554 * PORTAL_SCALE;

/** Shared between the controller and the launcher each frame. */
export const launcherRuntime = {
  speed: 0,
  muzzle: new Vector3(),
  gun: null as PortalGun | null,
};

export function PortalLauncher() {
  const root = useRef<Group>(null);
  const model = useRef<Group>(null);
  const effects = useRef<Group>(null);
  const selectorRef = useRef<Group>(null);
  const camera = useThree((s) => s.camera);
  const dest = useGame((s) => s.portalDestination);
  const reducedMotion = useSettings((s) => s.reducedMotion);
  const bob = useRef(0);
  const opened = useRef(0);

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

  useEffect(() => {
    let alive = true;
    let loaded: PortalGun | null = null;
    loadPortalGun(gunUrl, portalUrl, effects.current!)
      .then((gun) => {
        if (!alive) return gun.dispose();
        loaded = gun;
        gun.object.scale.setScalar(GUN_SCALE);
        gun.object.rotation.y = Math.PI; // its muzzle is +Z; the camera looks down -Z
        gun.object.traverse((o) => (o.frustumCulled = false));
        gun.effect.scale.set(PORTAL_SCALE, PORTAL_SCALE, 1);
        model.current?.add(gun.object);
        opened.current = gun.stats.opened;
        tint(gun, useGame.getState().portalDestination);
        launcherRuntime.gun = gun;
      })
      .catch((e) => console.error('Portal gun failed to load:', e));
    return () => {
      alive = false;
      if (launcherRuntime.gun === loaded) launcherRuntime.gun = null;
      loaded?.dispose();
    };
  }, []);

  useEffect(() => {
    if (launcherRuntime.gun) tint(launcherRuntime.gun, dest);
  }, [dest]);

  useFrame((state, rawDt) => {
    if (!root.current || !model.current) return;
    const dt = Math.min(rawDt, 0.1);
    root.current.position.copy(camera.position);
    root.current.quaternion.copy(camera.quaternion);
    const t = state.clock.elapsedTime;
    const motion = reducedMotion ? 0.3 : 1;
    bob.current += dt * (4 + launcherRuntime.speed * 1.4);
    const walk = Math.min(1, launcherRuntime.speed / 4) * motion;
    model.current.position.set(
      0.17 + Math.sin(bob.current) * 0.01 * walk,
      -0.165 + Math.abs(Math.cos(bob.current)) * 0.012 * walk + Math.sin(t * 1.5) * 0.003 * motion,
      -0.4,
    );
    model.current.rotation.set(0, 0.06, 0);
    if (selectorRef.current) {
      const idx = DESTINATIONS.findIndex((d) => d.id === dest);
      selectorRef.current.children.forEach((c, i) => {
        const target = i === idx ? 1.25 : 0.8;
        c.scale.setScalar(c.scale.x + (target - c.scale.x) * Math.min(1, dt * 10));
        const m = (c as unknown as { material: MeshBasicMaterial }).material;
        m.opacity = i === idx ? 1 : 0.45;
      });
    }

    const gun = launcherRuntime.gun;
    if (!gun) {
      model.current.getWorldPosition(launcherRuntime.muzzle);
      return;
    }
    gun.update(dt);
    gun.muzzle.getWorldPosition(launcherRuntime.muzzle);

    // The orb reached the wall and the portal began to open.
    const game = useGame.getState();
    const s = gun.stats;
    if (s.opened !== opened.current) {
      opened.current = s.opened;
      if (game.portal?.state === 'projectile') {
        audio.play('portalOpen');
        game.setPortal({ ...game.portal, state: 'opening' });
      }
    }
    // The portal was closed elsewhere (travel, reset).
    if (!game.portal && gun.effect.visible) gun.clearPortal();
  });

  return (
    <>
      <group ref={effects} />
      <group ref={root}>
        <group ref={model}>
          {/* Holographic selector */}
          <group ref={selectorRef} position={[0, 0.085, -0.05]}>
            {icons.map((tex, i) => (
              <mesh key={i} position={[(i - 1.5) * 0.034, 0, 0]} rotation-x={-0.25}>
                <planeGeometry args={[0.027, 0.034]} />
                <meshBasicMaterial map={tex} transparent depthWrite={false} toneMapped={false} />
              </mesh>
            ))}
          </group>
        </group>
      </group>
    </>
  );
}

/** Fire the gun at an aimed surface point. Returns false while the Fire clip is still playing. */
export function fireGun(target: Vector3, surface: Object3D): 'fired' | 'missed' | 'busy' | 'unloaded' {
  const gun = launcherRuntime.gun;
  if (!gun) return 'unloaded';
  const hits = gun.stats.hits;
  const dir = target.clone().sub(launcherRuntime.muzzle);
  if (!gun.fire({ direction: dir, targets: [surface], maxDistance: 40 })) return 'busy';
  return gun.stats.hits > hits ? 'fired' : 'missed';
}

/** Energy materials take the destination's colours; the dark portal surface keeps Jose's blue. */
function tint(gun: PortalGun, id: WorldId) {
  const d = destination(id);
  if (!d) return;
  const paint = (root: Object3D) =>
    root.traverse((o) => {
      const mat = (o as { material?: Material | Material[] }).material;
      for (const m of (Array.isArray(mat) ? mat : mat ? [mat] : []) as MeshStandardMaterial[]) {
        const c = m.name === 'Energy | ice white' ? d.color2 : m.name === 'Energy | electric blue' || m.name === 'Portal | saturated rim' ? d.color : null;
        if (!c) continue;
        m.color.set(c);
        m.emissive?.set(c);
      }
    });
  paint(gun.object);
  paint(gun.effect);
  (gun.orb.material as MeshBasicMaterial).color.set(d.color2);
  (gun.orb.children[0] as unknown as { material: MeshBasicMaterial }).material.color.set(d.color);
}
