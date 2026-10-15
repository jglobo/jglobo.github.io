// Jose's flight-character loader for his astronaut.glb (originally astronaut-controller.js),
// with TypeScript types added (and the skeleton disposed too). Loads the GLB, and crossfades between its flight clips.
import { AnimationMixer, LoopRepeat, type AnimationAction, type Material, type Mesh, type BufferGeometry, type Object3D, type SkinnedMesh } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export type FlightState = 'hover' | 'up' | 'down' | 'left' | 'right' | 'boost';

export interface FlightCharacter {
  object: Object3D;
  mixer: AnimationMixer;
  clips: Record<string, AnimationAction>;
  setFlightState: (state?: FlightState | string, fadeSeconds?: number) => void;
  update: (deltaSeconds: number) => void;
  dispose: () => void;
}

/** Load a flight character. Add `object` to your scene and call update(dt) each frame. */
export async function loadAstronaut(url: string): Promise<FlightCharacter> {
  const gltf = await new GLTFLoader().loadAsync(url);
  const object = gltf.scene;
  const mixer = new AnimationMixer(object);
  const clips: Record<string, AnimationAction> = Object.fromEntries(gltf.animations.map((clip) => [clip.name, mixer.clipAction(clip)]));
  const names: Record<string, string> = { hover: 'Hover', up: 'Fly_Up', down: 'Fly_Down', left: 'Fly_Left', right: 'Fly_Right', boost: 'Boost' };
  let active: AnimationAction | undefined;

  function setFlightState(state: string = 'hover', fadeSeconds = 0.2) {
    const name = names[state] || state;
    const next = clips[name];
    if (!next) throw new Error(`Unknown astronaut animation: ${state}`);
    if (active === next) return;
    next.reset().setLoop(LoopRepeat, Infinity).setEffectiveTimeScale(1).setEffectiveWeight(1).play();
    if (active) active.crossFadeTo(next, fadeSeconds, false);
    active = next;
  }

  setFlightState('hover');
  return {
    object, mixer, clips, setFlightState,
    update(deltaSeconds) { mixer.update(deltaSeconds); },
    dispose() {
      mixer.stopAllAction();
      mixer.uncacheRoot(object);
      const geometries = new Set<BufferGeometry>(), materials = new Set<Material>();
      object.traverse((node) => {
        const mesh = node as Mesh;
        if (!mesh.isMesh) return;
        // Added for the portfolio: a skinned mesh's skeleton owns a bone texture on the GPU.
        (node as SkinnedMesh).skeleton?.dispose();
        geometries.add(mesh.geometry);
        for (const mat of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) materials.add(mat);
      });
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
      object.removeFromParent();
    },
  };
}
