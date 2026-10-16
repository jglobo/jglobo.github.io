// Jose's garage kit: the garage, its sign and bays, lamps, bollards, verges, his road
// junction and boost ramp, laid out as in his scene_layout.json (see kit.ts).
import { useEffect, useRef } from 'react';
import { Group, type Material, type Mesh, type Object3D } from 'three';
import { loadGltf } from '../../utils/loadGltf';
import { KIT_ORIGIN, KIT_PIECES, type KitFile } from './kit';
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

const URLS: Record<KitFile, string> = {
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

export function CoastalKit() {
  const root = useRef<Group>(null);

  useEffect(() => {
    let alive = true;
    const group = root.current;
    const originals: Object3D[] = [];
    const files = Object.keys(URLS) as KitFile[];
    Promise.all(files.map((f) => loadGltf(URLS[f]))).then(
      (loaded) => {
        loaded.forEach((g) => originals.push(g.scene));
        if (!alive) return dispose(originals);
        const byFile = new Map<KitFile, Object3D>(files.map((f, i) => [f, loaded[i].scene]));
        for (const p of KIT_PIECES) {
          // Clones share geometry and materials with the loaded scene.
          const o = byFile.get(p.file)!.clone(true);
          o.position.fromArray(p.position);
          o.rotation.y = p.rotationY;
          const flat = p.file.startsWith('road') || p.file.endsWith('_bay') || p.file === 'grass_verge';
          o.traverse((m) => {
            if (!(m as Mesh).isMesh) return;
            m.castShadow = !flat;
            m.receiveShadow = true;
          });
          group?.add(o);
        }
      },
      (err) => console.error('Garage kit failed to load', err),
    );
    return () => {
      alive = false;
      group?.clear();
      dispose(originals);
    };
  }, []);

  return <group ref={root} position={[KIT_ORIGIN.x, 0, KIT_ORIGIN.z]} />;
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
