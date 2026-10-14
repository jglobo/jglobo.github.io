// Golden-hour mood: gradient sky, warm fog, a low sun whose shadow box follows the
// visitor (crisp shadows without a huge shadow map) and drifting light motes.
import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import {
  AdditiveBlending, BackSide, BufferAttribute, BufferGeometry, DirectionalLight, Object3D, Points, PointsMaterial, ShaderMaterial, SphereGeometry,
} from 'three';
import { qualityProfile, useSettings } from '../../stores/settingsStore';
import { journeyRuntime } from './journeyStore';
import { glowTexture } from './textures';
import { useOwned } from './useOwned';

const SUN = { x: 14, y: 22, z: 16 };

export function Atmosphere() {
  const profile = qualityProfile();
  const sun = useRef<DirectionalLight>(null);
  const target = useOwned(() => new Object3D(), []);
  const sky = useOwned(
    () => ({
      geo: new SphereGeometry(400, 24, 12),
      mat: new ShaderMaterial({
        side: BackSide,
        depthWrite: false,
        fog: false,
        uniforms: {},
        vertexShader: /* glsl */ `
          varying vec3 vDir;
          void main() {
            vDir = normalize(position);
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }`,
        fragmentShader: /* glsl */ `
          varying vec3 vDir;
          void main() {
            float h = vDir.y;
            vec3 horizon = vec3(1.0, 0.82, 0.58);
            vec3 mid = vec3(0.96, 0.62, 0.45);
            vec3 top = vec3(0.32, 0.42, 0.72);
            vec3 col = mix(horizon, mid, smoothstep(0.0, 0.18, h));
            col = mix(col, top, smoothstep(0.15, 0.7, h));
            gl_FragColor = vec4(col, 1.0);
            #include <colorspace_fragment>
          }`,
      }),
    }),
    [],
  );

  useFrame(() => {
    const l = sun.current;
    if (!l) return;
    // Keep the shadow camera centred on the visitor.
    const x = journeyRuntime.x;
    const z = journeyRuntime.z - 6;
    l.position.set(x + SUN.x, SUN.y, z + SUN.z);
    target.position.set(x, 0, z);
    target.updateMatrixWorld();
  });

  return (
    <>
      <color attach="background" args={['#f2b98a']} />
      <fog attach="fog" args={['#efc39b', 34, 90]} />
      <mesh geometry={sky.geo} material={sky.mat} renderOrder={-1} />
      <hemisphereLight args={['#ffe2c0', '#5a6b3a', 0.85]} />
      <ambientLight color="#ffd9b0" intensity={0.15} />
      <primitive object={target} />
      <directionalLight
        ref={sun}
        target={target}
        intensity={2.1}
        color="#ffcf98"
        castShadow={profile.shadows}
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-26}
        shadow-camera-right={26}
        shadow-camera-top={26}
        shadow-camera-bottom={-26}
        shadow-camera-near={1}
        shadow-camera-far={80}
        shadow-bias={-0.0006}
        shadow-normalBias={0.04}
      />
      <Motes />
    </>
  );
}

/** Golden pixel motes floating around the visitor. */
function Motes() {
  const reduced = useSettings((s) => s.reducedParticles);
  const count = reduced ? 0 : Math.min(200, qualityProfile().particles);
  const points = useRef<Points>(null);
  const res = useOwned(() => {
    const geo = new BufferGeometry();
    const pos = new Float32Array(count * 3);
    const seed = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 40;
      pos[i * 3 + 1] = Math.random() * 6;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 40;
      seed[i] = Math.random() * 100;
    }
    geo.setAttribute('position', new BufferAttribute(pos, 3));
    const map = glowTexture();
    const mat = new PointsMaterial({ map, size: 0.28, color: '#ffd27a', transparent: true, depthWrite: false, blending: AdditiveBlending, sizeAttenuation: true });
    return { geo, mat, map, seed };
  }, [count]);

  useFrame((state, dt) => {
    if (!count || !points.current) return;
    const pos = res.geo.attributes.position as BufferAttribute;
    const a = pos.array as Float32Array;
    const t = state.clock.elapsedTime;
    const cx = journeyRuntime.x;
    const cz = journeyRuntime.z - 4;
    for (let i = 0; i < count; i++) {
      const s = res.seed[i];
      a[i * 3] += Math.sin(t * 0.4 + s) * dt * 0.3;
      a[i * 3 + 1] += dt * (0.15 + (s % 1) * 0.2);
      a[i * 3 + 2] += Math.cos(t * 0.3 + s) * dt * 0.3;
      // Wrap around the visitor so the motes always surround them.
      if (a[i * 3 + 1] > 6) a[i * 3 + 1] = 0;
      if (a[i * 3] - cx > 20) a[i * 3] -= 40;
      if (a[i * 3] - cx < -20) a[i * 3] += 40;
      if (a[i * 3 + 2] - cz > 20) a[i * 3 + 2] -= 40;
      if (a[i * 3 + 2] - cz < -20) a[i * 3 + 2] += 40;
    }
    pos.needsUpdate = true;
  });

  if (!count) return null;
  return <points ref={points} geometry={res.geo} material={res.mat} frustumCulled={false} />;
}
