// Jose's robot, red coupe and bicycle (assets/*.glb, his own models and animations).
// The robot walks and runs on foot, rides the bike (the bike and the robot each carry
// the matching cycling clips, played in step, which is his robot_cycling pairing), and
// disappears into the car. Clips and their rates come from animationStates.
import { useFrame } from '@react-three/fiber';
import { useEffect, useRef, useState } from 'react';
import { Group, type Material, type Mesh, type Object3D } from 'three';
import { loadGltf } from '../../utils/loadGltf';
import { carClip, cyclingClip, footClip } from './animationStates';
import { ClipSet } from './clipSet';
import { useSoftware } from './softwareStore';
import robotUrl from './assets/athletic_robot.glb?url';
import bikeUrl from './assets/bicycle.glb?url';
import carUrl from './assets/red_car_animated.glb?url';
import type { VehiclePose, WalkerPose } from './vehicles/pose';

interface Rig { object: Object3D; clips: ClipSet }
interface Models { robot: Rig; bike: Rig; car: Rig }

const CYCLING = ['CycleIdle', 'Cycle', 'CycleFast', 'Coast'];

async function loadModels(): Promise<Models> {
  const [robot, bike, car] = await Promise.all([loadGltf(robotUrl), loadGltf(bikeUrl), loadGltf(carUrl)]);
  const rig = (scene: Object3D, clips: ClipSet): Rig => {
    scene.traverse((o) => {
      o.frustumCulled = false; // skinned meshes leave their bind-pose bounds
      if ((o as Mesh).isMesh) o.castShadow = o.receiveShadow = true;
    });
    // His models face +z; ours face -z at heading 0.
    scene.rotation.y = Math.PI;
    return { object: scene, clips };
  };
  return {
    robot: rig(robot.scene, new ClipSet(robot.scene, robot.animations, ['Idle', 'Walk', 'Run', ...CYCLING])),
    bike: rig(bike.scene, new ClipSet(bike.scene, bike.animations, ['Park', ...CYCLING])),
    car: rig(car.scene, new ClipSet(car.scene, car.animations, ['Car_Idle', 'Car_Drive', 'Car_DriveFast', 'Car_TurnLeft', 'Car_TurnRight', 'Car_Reverse'])),
  };
}

function disposeModels(m: Models) {
  for (const r of [m.robot, m.bike, m.car]) {
    r.clips.dispose();
    r.object.traverse((o) => {
      const mesh = o as Mesh;
      if (!mesh.isMesh) return;
      mesh.geometry.dispose();
      for (const mat of ([] as Material[]).concat(mesh.material)) mat.dispose();
    });
  }
}

/** Places a vehicle: heading on the root, lean and pitch on the inner group. */
function placeVehicle(root: Group, lean: Group, pose: VehiclePose) {
  root.position.set(pose.x, pose.y, pose.z);
  root.rotation.y = -pose.heading;
  lean.rotation.set(-pose.pitch, 0, -pose.roll);
}

export function Characters({ walker, poses }: { walker: WalkerPose; poses: Record<string, VehiclePose> }) {
  const [models, setModels] = useState<Models | null>(null);
  const walkerRoot = useRef<Group>(null);
  const bikeRoot = useRef<Group>(null);
  const bikeLean = useRef<Group>(null);
  const carRoot = useRef<Group>(null);
  const carLean = useRef<Group>(null);

  useEffect(() => {
    let alive = true;
    let loaded: Models | null = null;
    loadModels().then(
      (m) => {
        if (!alive) return disposeModels(m);
        loaded = m;
        m.bike.clips.play('Park');
        m.car.clips.play('Car_Idle');
        m.robot.clips.play('Idle');
        setModels(m);
      },
      (err) => console.error('Software world models failed to load', err),
    );
    return () => {
      alive = false;
      if (loaded) disposeModels(loaded);
    };
  }, []);

  // Attach the models to their groups once loaded.
  useEffect(() => {
    if (!models) return;
    bikeLean.current?.add(models.bike.object);
    carLean.current?.add(models.car.object);
    walkerRoot.current?.add(models.robot.object);
  }, [models]);

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.1);
    const w = walkerRoot.current;
    const bike = poses.bicycle;
    const car = poses['sports-car'];
    if (bikeRoot.current && bikeLean.current) placeVehicle(bikeRoot.current, bikeLean.current, bike);
    if (carRoot.current && carLean.current) placeVehicle(carRoot.current, carLean.current, car);
    if (w) {
      w.position.set(walker.x, 0, walker.z);
      w.rotation.y = -walker.heading;
    }
    if (!models || !w || !bikeLean.current) return;
    const riding = useSoftware.getState().riding;
    const robot = models.robot;

    // The bike: parked on its stand, or pedalled / coasting with the robot on it.
    if (riding === 'bicycle') models.bike.clips.set(cyclingClip(bike.speed, bike.throttle > 0 && bike.grounded));
    else models.bike.clips.play('Park', 0.3);
    models.bike.clips.update(dt);

    // The car: idle, driving, turning or reversing, at the speed the wheels need.
    models.car.clips.set(carClip(car.speed, car.steer), 0.25);
    models.car.clips.update(dt);

    // The robot: on the bike, inside the car (hidden), or on foot.
    const parent = riding === 'bicycle' ? bikeLean.current : w;
    if (robot.object.parent !== parent) parent.add(robot.object);
    robot.object.visible = riding !== 'sports-car';
    if (riding === 'bicycle') robot.clips.follow(models.bike.clips);
    else robot.clips.set(footClip(walker.speed), 0.2);
    robot.clips.update(dt);
  });

  return (
    <>
      <group ref={walkerRoot} />
      <group ref={bikeRoot}>
        <group ref={bikeLean} />
      </group>
      <group ref={carRoot}>
        <group ref={carLean} />
      </group>
    </>
  );
}
