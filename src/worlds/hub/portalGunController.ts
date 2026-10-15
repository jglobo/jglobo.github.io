// Jose's portal gun loader (originally portal-gun.js), with TypeScript types added, the orb
// returned so the Hub can tint it, and the skeleton disposed too. Loads the gun and portal
// GLBs; fire() plays the gun's Fire clip, sends a cyan orb from the Muzzle socket and opens
// the portal (its Open clip) on the surface the shot hits.
import {
  AnimationClip,
  AnimationMixer,
  LoopOnce,
  Matrix3,
  Mesh,
  MeshBasicMaterial,
  Raycaster,
  SphereGeometry,
  Vector3,
  type AnimationAction,
  type BufferGeometry,
  type Material,
  type Object3D,
  type SkinnedMesh,
} from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { loadGltf } from '../../utils/loadGltf';

export interface FireOptions {
  direction?: Vector3;
  targets?: Object3D[];
  maxDistance?: number;
}

export interface PortalGun {
  object: Object3D;
  mixer: AnimationMixer;
  fireAction: AnimationAction;
  muzzle: Object3D;
  effect: Object3D;
  portalMixer: AnimationMixer;
  orb: Mesh;
  fire: (options?: FireOptions) => boolean;
  update: (dt: number) => void;
  clearPortal: () => void;
  dispose: () => void;
  readonly readyToFire: boolean;
  readonly stats: { fired: number; hits: number; opened: number };
}

interface Shot {
  start: Vector3;
  end: Vector3;
  normal: Vector3 | null;
  time: number;
  delay: number;
  duration: number;
  hit: boolean;
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
  const effect = portal.scene;
  effect.visible = false;
  effectScene.add(effect);
  const portalMixer = new AnimationMixer(effect);
  const openClip = AnimationClip.findByName(portal.animations, 'Open');
  if (!openClip) throw new Error('The portal GLB is missing its Open clip.');
  const openAction = portalMixer.clipAction(openClip).setLoop(LoopOnce, 1);
  openAction.clampWhenFinished = true;
  const orb = new Mesh(new SphereGeometry(0.045, 12, 8), new MeshBasicMaterial({ color: 0x67dfff, toneMapped: false }));
  const halo = new Mesh(
    new SphereGeometry(0.085, 12, 8),
    new MeshBasicMaterial({ color: 0x009dff, transparent: true, opacity: 0.22, depthWrite: false, toneMapped: false }),
  );
  orb.add(halo);
  orb.visible = false;
  effectScene.add(orb);
  const ray = new Raycaster();
  let shot: Shot | null = null;
  let cooldown = 0;
  let disposed = false;
  const stats = { fired: 0, hits: 0, opened: 0 };
  const worldZ = new Vector3(0, 0, 1);

  function fire({ direction, targets = [], maxDistance = 50 }: FireOptions = {}) {
    if (disposed || cooldown > 0) return false;
    object.updateWorldMatrix(true, true);
    const start = muzzle!.getWorldPosition(new Vector3());
    const dir = direction ? direction.clone() : worldZ.clone().transformDirection(object.matrixWorld);
    if (dir.lengthSq() < 1e-8) return false;
    dir.normalize();
    ray.set(start, dir);
    ray.far = maxDistance;
    const hit = ray.intersectObjects(targets, true)[0];
    const end = hit ? hit.point.clone() : start.clone().addScaledVector(dir, maxDistance);
    const normal = hit?.face ? hit.face.normal.clone().applyNormalMatrix(new Matrix3().getNormalMatrix(hit.object.matrixWorld)) : null;
    if (normal && normal.dot(dir) > 0) normal.negate();
    shot = { start, end, normal, time: 0, delay: 0.12, duration: Math.max(0.1, start.distanceTo(end) / 16), hit: !!normal };
    orb.position.copy(start);
    orb.visible = false;
    fireAction.reset().setEffectiveWeight(1).play();
    cooldown = fireClip!.duration;
    stats.fired++;
    if (shot.hit) stats.hits++;
    return true;
  }

  function update(dt: number) {
    if (disposed) return;
    dt = Math.max(0, dt);
    mixer.update(dt);
    portalMixer.update(dt);
    cooldown = Math.max(0, cooldown - dt);
    if (!shot) return;
    shot.time += dt;
    const t = (shot.time - shot.delay) / shot.duration;
    orb.visible = t >= 0 && t < 1;
    if (t >= 0) orb.position.lerpVectors(shot.start, shot.end, Math.min(1, t));
    if (t >= 1) {
      if (shot.hit && shot.normal) {
        effect.position.copy(shot.end).addScaledVector(shot.normal, 0.026);
        effect.quaternion.setFromUnitVectors(worldZ, shot.normal);
        effect.visible = true;
        openAction.reset().play();
        stats.opened++;
      }
      shot = null;
      orb.visible = false;
    }
  }

  function clearPortal() {
    effect.visible = false;
    orb.visible = false;
    shot = null;
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    mixer.stopAllAction();
    portalMixer.stopAllAction();
    mixer.uncacheRoot(object);
    portalMixer.uncacheRoot(effect);
    object.removeFromParent();
    effect.removeFromParent();
    orb.removeFromParent();
    for (const root of [object, effect, orb])
      root.traverse((o) => {
        const mesh = o as Mesh & Partial<SkinnedMesh>;
        (mesh.geometry as BufferGeometry | undefined)?.dispose();
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
    effect,
    portalMixer,
    orb,
    fire,
    update,
    clearPortal,
    dispose,
    get readyToFire() {
      return !disposed && cooldown <= 0;
    },
    get stats() {
      return { ...stats };
    },
  };
}
