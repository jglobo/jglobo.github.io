// Jose's astronaut (assets/astronaut.glb, his own model and flight animations), played
// through his controller: the player's thrust picks Hover, Fly_Up/Down/Left/Right or
// Boost, and pooled exhaust particles stream from the jetpack's exhaust bones.
import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import { AdditiveBlending, BufferAttribute, BufferGeometry, Group, ShaderMaterial, Vector3, type Object3D } from 'three';
import { qualityProfile, useSettings } from '../../stores/settingsStore';
import astronautUrl from './assets/astronaut.glb?url';
import { loadAstronaut, type FlightCharacter } from './astronautController';
import { flightStateFor } from './JetpackController';

export interface AstronautRuntime {
  x: number;
  y: number;
  vx: number;
  vy: number;
  thrustX: number;
  thrustY: number;
  boosting: boolean;
}

/** The model is about 3.8 units tall with its feet near y = 0.18; this makes it ~2.6 tall,
 *  centred on the runtime position like the old primitive astronaut. */
const SCALE = 0.68;
const CENTER_Y = 2.09;

export function Astronaut({ runtime }: { runtime: React.RefObject<AstronautRuntime> }) {
  const root = useRef<Group>(null);
  const character = useRef<FlightCharacter | null>(null);
  const nozzles = useRef<Object3D[]>([]);
  const reducedMotion = useSettings((s) => s.reducedMotion);
  const exhaust = useExhaust();

  useEffect(() => {
    let alive = true;
    let loaded: FlightCharacter | null = null;
    loadAstronaut(astronautUrl).then((c) => {
      if (!alive) return c.dispose();
      loaded = c;
      c.object.scale.setScalar(SCALE);
      c.object.position.y = -CENTER_Y * SCALE;
      c.object.traverse((o) => {
        // Skinned meshes move away from their bind-pose bounds; never cull them.
        o.frustumCulled = false;
      });
      // GLTFLoader drops the dots from node names: exhaust.L is loaded as exhaustL.
      nozzles.current = ['exhaustL', 'exhaustR'].map((n) => c.object.getObjectByName(n)).filter((o): o is Object3D => !!o);
      root.current?.add(c.object);
      character.current = c;
    }, (err) => console.error('Astronaut model failed to load', err));
    return () => {
      alive = false;
      character.current = null;
      loaded?.dispose();
    };
  }, []);

  useFrame((_, dt) => {
    const r = runtime.current;
    if (!r || !root.current) return;
    // The clips carry their own bob and lean; reduced motion only keeps the position.
    root.current.position.set(r.x, r.y, 0);
    const c = character.current;
    if (c) {
      c.setFlightState(flightStateFor(r));
      c.update(reducedMotion ? dt * 0.4 : dt);
    }
    if ((r.thrustX || r.thrustY) && nozzles.current.length) {
      const rate = r.boosting ? 3 : 1.5;
      for (const n of nozzles.current) exhaust.emit(n, r, rate);
    }
    exhaust.update(dt);
  });

  return (
    <>
      <group ref={root}>
        <pointLight color="#9fd0ff" intensity={1.2} distance={4} position={[0, 0.8, 1.2]} />
      </group>
      <points geometry={exhaust.geometry} material={exhaust.material} frustumCulled={false} />
    </>
  );
}

/** Pooled exhaust particles in world space (no allocations per frame). */
function useExhaust() {
  const max = qualityProfile().particles * 3;
  const pool = useMemo(() => {
    const geometry = new BufferGeometry();
    const pos = new Float32Array(max * 3);
    const life = new Float32Array(max);
    geometry.setAttribute('position', new BufferAttribute(pos, 3));
    geometry.setAttribute('life', new BufferAttribute(life, 1));
    const vel = new Float32Array(max * 3);
    const material = new ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      vertexShader: /* glsl */ `
        attribute float life; varying float vLife;
        void main() {
          vLife = life;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = (life > 0.0 ? (8.0 + (1.0 - life) * 26.0) : 0.0) * (10.0 / -mv.z);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */ `
        varying float vLife;
        void main() {
          float d = length(gl_PointCoord - 0.5);
          if (vLife <= 0.0 || d > 0.5) discard;
          vec3 hot = vec3(0.85, 0.95, 1.0), cool = vec3(0.25, 0.45, 1.0);
          gl_FragColor = vec4(mix(cool, hot, vLife), smoothstep(0.5, 0.0, d) * vLife * 0.8);
        }`,
    });
    return { geometry, material, pos, life, vel, next: 0, carry: 0 };
  }, [max]);

  useEffect(() => () => { pool.geometry.dispose(); pool.material.dispose(); }, [pool]);
  const tmp = useMemo(() => new Vector3(), []);

  return {
    geometry: pool.geometry,
    material: pool.material,
    emit(nozzle: Object3D, r: AstronautRuntime, rate: number) {
      pool.carry += rate;
      nozzle.getWorldPosition(tmp);
      while (pool.carry >= 1) {
        pool.carry -= 1;
        const i = pool.next;
        pool.next = (pool.next + 1) % max;
        pool.pos.set([tmp.x, tmp.y - 0.25, tmp.z], i * 3);
        // Exhaust goes opposite to the thrust direction, plus a downward bias from the nozzles.
        const spread = 0.8;
        pool.vel.set(
          [-r.thrustX * 5 + (Math.random() - 0.5) * spread + r.vx * 0.5, -r.thrustY * 5 - 2.5 + (Math.random() - 0.5) * spread + r.vy * 0.5, (Math.random() - 0.5) * spread - 1],
          i * 3,
        );
        pool.life[i] = 1;
      }
    },
    update(dt: number) {
      for (let i = 0; i < max; i++) {
        if (pool.life[i] <= 0) continue;
        pool.life[i] -= dt * 2.2;
        pool.pos[i * 3] += pool.vel[i * 3] * dt;
        pool.pos[i * 3 + 1] += pool.vel[i * 3 + 1] * dt;
        pool.pos[i * 3 + 2] += pool.vel[i * 3 + 2] * dt;
      }
      pool.geometry.attributes.position.needsUpdate = true;
      pool.geometry.attributes.life.needsUpdate = true;
    },
  };
}
