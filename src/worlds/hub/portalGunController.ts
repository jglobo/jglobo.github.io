// Jose's portal gun loader (originally portal-gun.js), with TypeScript types added and
// reworked for a blue and an orange portal. Loads the gun and portal GLBs; fire() plays
// the gun's Fire clip and sends an orb from the Muzzle socket to where the shot lands.
// Each colour gets its own copy of the portal, which plays its Open clip when placed.
import {
  AnimationClip,
  AnimationMixer,
  LoopOnce,
  Mesh,
  MeshBasicMaterial,
  SphereGeometry,
  Vector3,
  type AnimationAction,
  type BufferGeometry,
  type Material,
  type MeshStandardMaterial,
  type Object3D,
  type SkinnedMesh,
} from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { loadGltf } from '../../utils/loadGltf';
import type { PortalColor } from './chamber';

export interface PortalEffect {
  object: Object3D;
  /** The portal's dark inner surface (its material is replaced by the see-through view). */
  inner: Mesh | null;
  /** The spiral arcs over the surface, hidden while it shows the view. */
  arcs: Object3D[];
  mixer: AnimationMixer;
  open: () => void;
  close: () => void;
}

export interface PortalGun {
  object: Object3D;
  mixer: AnimationMixer;
  fireAction: AnimationAction;
  muzzle: Object3D;
  orb: Mesh;
  portals: Record<PortalColor, PortalEffect>;
  fire: (end: Vector3, onArrive?: () => void) => boolean;
  update: (dt: number) => void;
  dispose: () => void;
  readonly readyToFire: boolean;
}

interface Shot {
  start: Vector3;
  end: Vector3;
  time: number;
  delay: number;
  duration: number;
  onArrive?: () => void;
}

/** Load once per player. +Z muzzle axis, Y up, meters. Call update(dt) every frame. */
export async function loadPortalGun(gunURL: string, portalURL: string, effectScene: Object3D): Promise<PortalGun> {
  const loader = new GLTFLoader();
  const [gun, portal] = await Promise.all([loadGltf(gunURL, loader), loadGltf(portalURL, loader)]);
  const object = gun.scene;
  const mixer = new AnimationMixer(object);
  const fireClip = AnimationClip.findByName(gun.animations, 'Fire');
  if (!fireClip) throw new Error('The gun GLB is missing its Fire clip.');
  const fireAction = mixer.clipAction(fireClip).setLoop(LoopOnce, 1);
  fireAction.clampWhenFinished = true;
  // Evaluate the bind-time flash scale, which is hidden at frame zero.
  fireAction.play();
  mixer.setTime(0);
  fireAction.paused = true;
  const muzzle = object.getObjectByName('Muzzle');
  if (!muzzle) throw new Error('The gun GLB is missing its Muzzle socket.');
  const openClip = AnimationClip.findByName(portal.animations, 'Open');
  if (!openClip) throw new Error('The portal GLB is missing its Open clip.');

  // One copy of the portal per colour, with its own materials so each can be tinted.
  const makePortal = (): PortalEffect => {
    const root = portal.scene.clone(true);
    root.traverse((o) => {
      const m = o as Mesh;
      if (m.isMesh) m.material = Array.isArray(m.material) ? m.material.map((x) => x.clone()) : (m.material as Material).clone();
    });
    const arcs: Object3D[] = [];
    root.traverse((o) => o.name.startsWith('Portal_spiral_arc') && arcs.push(o));
    root.visible = false;
    effectScene.add(root);
    const pm = new AnimationMixer(root);
    const action = pm.clipAction(openClip).setLoop(LoopOnce, 1);
    action.clampWhenFinished = true;
    return {
      object: root,
      // GLTFLoader turns spaces in node names into underscores.
      inner: (root.getObjectByName('Portal_dark_surface') as Mesh | undefined) ?? null,
      arcs,
      mixer: pm,
      open: () => {
        root.visible = true;
        action.reset().play();
      },
      close: () => {
        root.visible = false;
      },
    };
  };
  const portals = { blue: makePortal(), orange: makePortal() };

  const orb = new Mesh(new SphereGeometry(0.045, 12, 8), new MeshBasicMaterial({ color: 0x67dfff, toneMapped: false }));
  const halo = new Mesh(
    new SphereGeometry(0.085, 12, 8),
    new MeshBasicMaterial({ color: 0x009dff, transparent: true, opacity: 0.22, depthWrite: false, toneMapped: false }),
  );
  orb.add(halo);
  orb.visible = false;
  effectScene.add(orb);
  let shot: Shot | null = null;
  let cooldown = 0;
  let disposed = false;

  function fire(end: Vector3, onArrive?: () => void) {
    if (disposed || cooldown > 0) return false;
    object.updateWorldMatrix(true, true);
    const start = muzzle!.getWorldPosition(new Vector3());
    // A shot already in flight lands at once.
    shot?.onArrive?.();
    shot = { start, end: end.clone(), time: 0, delay: 0.12, duration: Math.max(0.1, start.distanceTo(end) / 16), onArrive };
    orb.position.copy(start);
    orb.visible = false;
    fireAction.reset().setEffectiveWeight(1).play();
    // A little quicker than the full clip, so the two portals can be fired back to back.
    cooldown = Math.min(fireClip!.duration, 0.45);
    return true;
  }

  function update(dt: number) {
    if (disposed) return;
    dt = Math.max(0, dt);
    mixer.update(dt);
    portals.blue.mixer.update(dt);
    portals.orange.mixer.update(dt);
    cooldown = Math.max(0, cooldown - dt);
    if (!shot) return;
    shot.time += dt;
    const t = (shot.time - shot.delay) / shot.duration;
    orb.visible = t >= 0 && t < 1;
    if (t >= 0) orb.position.lerpVectors(shot.start, shot.end, Math.min(1, t));
    if (t >= 1) {
      const done = shot;
      shot = null;
      orb.visible = false;
      done.onArrive?.();
    }
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    mixer.stopAllAction();
    mixer.uncacheRoot(object);
    object.removeFromParent();
    orb.removeFromParent();
    const roots: Object3D[] = [object, orb];
    for (const p of Object.values(portals)) {
      p.mixer.stopAllAction();
      p.mixer.uncacheRoot(p.object);
      p.object.removeFromParent();
      roots.push(p.object);
    }
    const seen = new Set<unknown>();
    for (const root of roots)
      root.traverse((o) => {
        const mesh = o as Mesh & Partial<SkinnedMesh>;
        const g = mesh.geometry as BufferGeometry | undefined;
        if (g && !seen.has(g)) {
          seen.add(g);
          g.dispose();
        }
        const mats = mesh.material ? (Array.isArray(mesh.material) ? mesh.material : [mesh.material]) : [];
        for (const m of mats as Material[]) m.dispose();
        mesh.skeleton?.dispose();
      });
  }

  return {
    object,
    mixer,
    fireAction,
    muzzle,
    orb,
    portals,
    fire,
    update,
    dispose,
    get readyToFire() {
      return !disposed && cooldown <= 0;
    },
  };
}

/** Energy materials take a colour; the dark portal surface is left alone. */
export function tintEnergy(root: Object3D, main: string, light: string) {
  root.traverse((o) => {
    const mat = (o as { material?: Material | Material[] }).material;
    for (const m of (Array.isArray(mat) ? mat : mat ? [mat] : []) as MeshStandardMaterial[]) {
      const c = m.name === 'Energy | ice white' ? light : m.name === 'Energy | electric blue' || m.name === 'Portal | saturated rim' ? main : null;
      if (!c) continue;
      m.color.set(c);
      m.emissive?.set(c);
    }
  });
}
