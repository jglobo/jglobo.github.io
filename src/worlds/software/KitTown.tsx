// Everything in the town built from Jose's kit models: his garage with its sign, bays,
// lamps, bollards and verges (laid out as in his scene_layout.json, see kit.ts), and
// the roads, street lamps, grass verges and jumps across the whole town (roads.ts and
// layout.ts). The repeated pieces are instanced, so hundreds of them stay cheap.
import { useEffect, useRef } from 'react';
import { Group, InstancedMesh, Matrix4, Quaternion, Vector3, type Material, type Mesh, type Object3D } from 'three';
import { loadGltf } from '../../utils/loadGltf';
import { KIT_ORIGIN, KIT_PIECES, KIT_SIZES, type KitFile } from './kit';
import { RAMPS, type Ramp } from './layout';
import { LAMPS, STRAIGHTS, T_JUNCTIONS, VERGES, type Placed } from './roads';
import garageShell from './assets/garage_shell.glb?url';
import garageSign from './assets/garage_sign.glb?url';
import sportsCarBay from './assets/sports_car_bay.glb?url';
import bicycleBay from './assets/bicycle_bay.glb?url';
import utilityCabinet from './assets/utility_cabinet.glb?url';
import bollard from './assets/bollard.glb?url';
import streetLamp from './assets/street_lamp.glb?url';
import roadJunction from './assets/road_t_junction.glb?url';
import roadStraight from './assets/road_straight.glb?url';
import boostRamp from './assets/boost_ramp.glb?url';
import grassVerge from './assets/grass_verge.glb?url';

type ModelFile = KitFile | 'road_straight' | 'road_t_junction';

const URLS: Record<ModelFile, string> = {
  garage_shell: garageShell,
  garage_sign: garageSign,
  sports_car_bay: sportsCarBay,
  bicycle_bay: bicycleBay,
  utility_cabinet: utilityCabinet,
  bollard,
  street_lamp: streetLamp,
  road_t_junction: roadJunction,
  road_straight: roadStraight,
  boost_ramp: boostRamp,
  grass_verge: grassVerge,
};

const FLAT = new Set<ModelFile>(['road_straight', 'road_t_junction', 'sports_car_bay', 'bicycle_bay', 'grass_verge']);

const up = new Vector3(0, 1, 0);
function placedMatrix(p: Placed, scale = new Vector3(1, 1, p.stretch ?? 1)) {
  return new Matrix4().compose(new Vector3(p.x, 0, p.z), new Quaternion().setFromAxisAngle(up, p.rotationY), scale);
}

/** A ramp drawn with Jose's boost ramp, scaled to its size. The model rises towards -z. */
function rampMatrix(r: Ramp) {
  const dx = r.heading === undefined ? { n: 0, s: 0, e: 1, w: -1 }[r.dir] : Math.sin(r.heading);
  const dz = r.heading === undefined ? { n: -1, s: 1, e: 0, w: 0 }[r.dir] : -Math.cos(r.heading);
  const k = KIT_SIZES.ramp;
  return placedMatrix(
    { x: r.x + (dx * r.length) / 2, z: r.z + (dz * r.length) / 2, rotationY: Math.atan2(-dx, -dz) },
    new Vector3(r.width / k.width, r.height / k.height, r.length / k.length),
  );
}

/** One instanced mesh per mesh in the model, placed at every matrix. */
function instance(model: Object3D, matrices: Matrix4[], flat: boolean) {
  const group = new Group();
  model.updateMatrixWorld(true);
  const m = new Matrix4();
  model.traverse((o) => {
    const mesh = o as Mesh;
    if (!mesh.isMesh) return;
    const inst = new InstancedMesh(mesh.geometry, mesh.material, matrices.length);
    matrices.forEach((mat, i) => inst.setMatrixAt(i, m.multiplyMatrices(mat, mesh.matrixWorld)));
    inst.instanceMatrix.needsUpdate = true;
    inst.computeBoundingSphere();
    inst.castShadow = !flat;
    inst.receiveShadow = true;
    group.add(inst);
  });
  return group;
}

export function KitTown() {
  const garage = useRef<Group>(null);
  const town = useRef<Group>(null);

  useEffect(() => {
    let alive = true;
    const garageGroup = garage.current;
    const townGroup = town.current;
    const originals: Object3D[] = [];
    const files = Object.keys(URLS) as ModelFile[];
    Promise.all(files.map((f) => loadGltf(URLS[f]))).then(
      (loaded) => {
        loaded.forEach((g) => originals.push(g.scene));
        if (!alive) return dispose(originals);
        const model = new Map<ModelFile, Object3D>(files.map((f, i) => [f, loaded[i].scene]));
        // The garage: clones share geometry and materials with the loaded models.
        for (const p of KIT_PIECES) {
          const o = model.get(p.file)!.clone(true);
          o.position.fromArray(p.position);
          o.rotation.y = p.rotationY;
          o.traverse((m) => {
            if (!(m as Mesh).isMesh) return;
            m.castShadow = !FLAT.has(p.file);
            m.receiveShadow = true;
          });
          garageGroup?.add(o);
        }
        // The town.
        const add = (f: ModelFile, matrices: Matrix4[]) => townGroup?.add(instance(model.get(f)!, matrices, FLAT.has(f)));
        add('road_straight', STRAIGHTS.map((p) => placedMatrix(p)));
        add('road_t_junction', T_JUNCTIONS.map((p) => placedMatrix(p)));
        add('street_lamp', LAMPS.map((p) => placedMatrix(p)));
        add('grass_verge', VERGES.map((p) => placedMatrix({ ...p, stretch: 1 }).setPosition(p.x, -0.005, p.z)));
        add('boost_ramp', RAMPS.map(rampMatrix));
      },
      (err) => console.error('Kit models failed to load', err),
    );
    return () => {
      alive = false;
      garageGroup?.clear();
      townGroup?.traverse((o) => (o as InstancedMesh).isInstancedMesh && (o as InstancedMesh).dispose());
      townGroup?.clear();
      dispose(originals);
    };
  }, []);

  return (
    <>
      <group ref={garage} position={[KIT_ORIGIN.x, 0, KIT_ORIGIN.z]} />
      <group ref={town} />
    </>
  );
}

function dispose(scenes: Object3D[]) {
  for (const s of scenes) {
    s.traverse((o) => {
      const mesh = o as Mesh;
      if (!mesh.isMesh) return;
      mesh.geometry.dispose();
      for (const m of ([] as Material[]).concat(mesh.material)) m.dispose();
    });
  }
}
