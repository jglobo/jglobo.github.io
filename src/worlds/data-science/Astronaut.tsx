// Small astronaut built from primitives: suit, helmet with visor, jetpack with two
// nozzles, idle float, tilt toward thrust, and pooled exhaust particles.
import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import { AdditiveBlending, BufferAttribute, BufferGeometry, Group, ShaderMaterial, Vector3 } from 'three';
import { qualityProfile, useSettings } from '../../stores/settingsStore';

export interface AstronautRuntime {
  x: number;
  y: number;
  vx: number;
  vy: number;
  thrustX: number;
  thrustY: number;
  boosting: boolean;
}

export function Astronaut({ runtime }: { runtime: React.RefObject<AstronautRuntime> }) {
  const root = useRef<Group>(null);
  const body = useRef<Group>(null);
  const armL = useRef<Group>(null);
  const armR = useRef<Group>(null);
  const legL = useRef<Group>(null);
  const legR = useRef<Group>(null);
  const nozzleL = useRef<Group>(null);
  const nozzleR = useRef<Group>(null);
  const flameL = useRef<Group>(null);
  const flameR = useRef<Group>(null);
  const reducedMotion = useSettings((s) => s.reducedMotion);

  const exhaust = useExhaust();

  useFrame((state, dt) => {
    const r = runtime.current;
    if (!r || !root.current || !body.current) return;
    const t = state.clock.elapsedTime;
    const motion = reducedMotion ? 0.3 : 1;
    root.current.position.set(r.x, r.y + Math.sin(t * 1.6) * 0.12 * motion, 0);

    // Face mostly toward the viewer, turning a little toward travel direction.
    const targetYaw = Math.max(-0.7, Math.min(0.7, r.vx * 0.09));
    body.current.rotation.y += (targetYaw - body.current.rotation.y) * Math.min(1, dt * 4);
    const targetRoll = -r.vx * 0.035;
    const targetPitch = r.vy * 0.02 + Math.sin(t * 0.9) * 0.04 * motion;
    body.current.rotation.z += (targetRoll - body.current.rotation.z) * Math.min(1, dt * 3);
    body.current.rotation.x += (-targetPitch - body.current.rotation.x) * Math.min(1, dt * 3);

    const swim = Math.sin(t * 2.2) * 0.25 * motion;
    const thrusting = Math.hypot(r.thrustX, r.thrustY) > 0;
    if (armL.current) armL.current.rotation.z = 0.5 + swim * 0.4 + (thrusting ? 0.3 : 0);
    if (armR.current) armR.current.rotation.z = -0.5 - swim * 0.4 - (thrusting ? 0.3 : 0);
    if (legL.current) legL.current.rotation.x = 0.15 + swim * 0.3 + r.vy * -0.02;
    if (legR.current) legR.current.rotation.x = 0.15 - swim * 0.3 + r.vy * -0.02;

    // Flames scale with thrust; boost makes them long and bright.
    const power = thrusting ? (r.boosting ? 1.8 : 1) : 0.15;
    for (const f of [flameL.current, flameR.current]) {
      if (!f) continue;
      const s = power * (0.85 + Math.random() * 0.3);
      f.scale.set(1, s, 1);
    }

    if (thrusting && nozzleL.current && nozzleR.current) {
      const rate = r.boosting ? 3 : 1.5;
      exhaust.emit(nozzleL.current, r, rate);
      exhaust.emit(nozzleR.current, r, rate);
    }
    exhaust.update(dt);
  });

  const suit = <meshStandardMaterial color="#f2f2f5" roughness={0.6} metalness={0.05} />;
  const trim = <meshStandardMaterial color="#ff7a2e" roughness={0.5} />;
  const dark = <meshStandardMaterial color="#3a3d4a" roughness={0.5} metalness={0.4} />;

  return (
    <>
      <group ref={root}>
        <group ref={body}>
          {/* Torso */}
          <mesh position-y={0.05}>
            <capsuleGeometry args={[0.42, 0.45, 6, 16]} />
            {suit}
          </mesh>
          <mesh position={[0, 0.2, 0.36]}>
            <boxGeometry args={[0.36, 0.22, 0.1]} />
            {dark}
          </mesh>
          <mesh position={[0.1, 0.22, 0.415]}>
            <sphereGeometry args={[0.035, 8, 8]} />
            <meshBasicMaterial color="#4dff9a" toneMapped={false} />
          </mesh>
          <mesh position={[0, -0.3, 0]} rotation-x={Math.PI / 2}>
            <torusGeometry args={[0.4, 0.05, 8, 24]} />
            {trim}
          </mesh>
          {/* Helmet */}
          <group position-y={0.78}>
            <mesh>
              <sphereGeometry args={[0.42, 24, 24]} />
              {suit}
            </mesh>
            <mesh position-z={0.12} scale={[0.85, 0.7, 0.8]}>
              <sphereGeometry args={[0.4, 24, 24, 0, Math.PI * 2, 0, Math.PI / 1.7]} />
              <meshStandardMaterial color="#10214a" roughness={0.05} metalness={0.9} emissive="#1a3a8a" emissiveIntensity={0.35} />
            </mesh>
            <mesh position={[-0.12, 0.14, 0.4]}>
              <sphereGeometry args={[0.06, 8, 8]} />
              <meshBasicMaterial color="#cfe4ff" transparent opacity={0.7} />
            </mesh>
            <mesh position={[0.36, 0.05, 0]} rotation-z={Math.PI / 2}>
              <cylinderGeometry args={[0.08, 0.08, 0.1, 12]} />
              {trim}
            </mesh>
          </group>
          {/* Jetpack */}
          <group position={[0, 0.15, -0.42]}>
            <mesh>
              <boxGeometry args={[0.7, 0.8, 0.32]} />
              <meshStandardMaterial color="#d8dae3" roughness={0.4} metalness={0.3} />
            </mesh>
            <mesh position={[0, 0.2, -0.17]}>
              <boxGeometry args={[0.5, 0.12, 0.04]} />
              <meshBasicMaterial color="#3d7bff" toneMapped={false} />
            </mesh>
            {[-0.2, 0.2].map((x, i) => (
              <group key={x} ref={i === 0 ? nozzleL : nozzleR} position={[x, -0.5, -0.02]}>
                <mesh>
                  <cylinderGeometry args={[0.08, 0.12, 0.2, 12]} />
                  {dark}
                </mesh>
                <group ref={i === 0 ? flameL : flameR} position-y={-0.1}>
                  <mesh position-y={-0.25}>
                    <coneGeometry args={[0.1, 0.5, 12, 1, true]} />
                    <meshBasicMaterial color="#7fc4ff" transparent opacity={0.75} blending={AdditiveBlending} depthWrite={false} />
                  </mesh>
                </group>
              </group>
            ))}
          </group>
          {/* Arms */}
          {[-1, 1].map((side) => (
            <group key={side} ref={side < 0 ? armL : armR} position={[side * 0.45, 0.35, 0]}>
              <mesh position={[side * 0.12, -0.28, 0]}>
                <capsuleGeometry args={[0.13, 0.35, 4, 12]} />
                {suit}
              </mesh>
              <mesh position={[side * 0.16, -0.58, 0]}>
                <sphereGeometry args={[0.13, 12, 12]} />
                {trim}
              </mesh>
            </group>
          ))}
          {/* Legs */}
          {[-1, 1].map((side) => (
            <group key={side} ref={side < 0 ? legL : legR} position={[side * 0.2, -0.45, 0]}>
              <mesh position-y={-0.3}>
                <capsuleGeometry args={[0.15, 0.35, 4, 12]} />
                {suit}
              </mesh>
              <mesh position={[0, -0.62, 0.05]}>
                <boxGeometry args={[0.28, 0.16, 0.36]} />
                {dark}
              </mesh>
            </group>
          ))}
        </group>
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
    emit(nozzle: Group, r: AstronautRuntime, rate: number) {
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
