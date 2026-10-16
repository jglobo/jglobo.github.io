// Orbital backdrop: procedural Earth with clouds, city lights and atmosphere glow,
// stars, nebula, an instanced asteroid belt and distant satellites. No textures are
// downloaded; everything is generated on the GPU or once at load.
import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import {
  AdditiveBlending, BackSide, BufferAttribute, BufferGeometry, Color, DynamicDrawUsage, Group, IcosahedronGeometry, InstancedMesh,
  MeshStandardMaterial, Object3D, ShaderMaterial, Vector3,
} from 'three';
import { qualityProfile, useSettings } from '../../stores/settingsStore';
import { rng } from '../../utils/random';

export const SUN_DIR = new Vector3(-0.6, 0.35, 0.7).normalize();

const noiseGlsl = /* glsl */ `
  vec3 hash3(vec3 p) {
    p = vec3(dot(p, vec3(127.1, 311.7, 74.7)), dot(p, vec3(269.5, 183.3, 246.1)), dot(p, vec3(113.5, 271.9, 124.6)));
    return -1.0 + 2.0 * fract(sin(p) * 43758.5453123);
  }
  float noise3(vec3 p) {
    vec3 i = floor(p), f = fract(p);
    vec3 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(dot(hash3(i), f), dot(hash3(i + vec3(1,0,0)), f - vec3(1,0,0)), u.x),
                   mix(dot(hash3(i + vec3(0,1,0)), f - vec3(0,1,0)), dot(hash3(i + vec3(1,1,0)), f - vec3(1,1,0)), u.x), u.y),
               mix(mix(dot(hash3(i + vec3(0,0,1)), f - vec3(0,0,1)), dot(hash3(i + vec3(1,0,1)), f - vec3(1,0,1)), u.x),
                   mix(dot(hash3(i + vec3(0,1,1)), f - vec3(0,1,1)), dot(hash3(i + vec3(1,1,1)), f - vec3(1,1,1)), u.x), u.y), u.z);
  }
  float fbm3(vec3 p, int oct) {
    float v = 0.0, a = 0.5;
    for (int i = 0; i < 6; i++) { if (i >= oct) break; v += a * noise3(p); p *= 2.02; a *= 0.5; }
    return v;
  }
`;

function Earth() {
  const group = useRef<Group>(null);
  const segments = qualityProfile().earthSegments;
  const octaves = segments >= 96 ? 6 : 4;
  const reducedMotion = useSettings((s) => s.reducedMotion);

  const surface = useMemo(
    () =>
      new ShaderMaterial({
        uniforms: { uTime: { value: 0 }, uSun: { value: SUN_DIR.clone() } },
        vertexShader: /* glsl */ `
          varying vec3 vNormal; varying vec3 vObj; varying vec3 vView;
          void main() {
            vObj = normalize(position);
            vNormal = normalize(mat3(modelMatrix) * normal);
            vec4 wp = modelMatrix * vec4(position, 1.0);
            vView = normalize(cameraPosition - wp.xyz);
            gl_Position = projectionMatrix * viewMatrix * wp;
          }`,
        fragmentShader: /* glsl */ `
          uniform float uTime; uniform vec3 uSun;
          varying vec3 vNormal; varying vec3 vObj; varying vec3 vView;
          ${noiseGlsl}
          void main() {
            vec3 p = vObj;
            float h = fbm3(p * 2.2, ${octaves}) + 0.15 * fbm3(p * 9.0, 3);
            float lat = abs(p.y);
            float land = smoothstep(0.02, 0.06, h);
            vec3 ocean = mix(vec3(0.01, 0.06, 0.22), vec3(0.02, 0.2, 0.42), smoothstep(-0.25, 0.02, h));
            vec3 ground = mix(vec3(0.16, 0.33, 0.12), vec3(0.45, 0.38, 0.22), smoothstep(0.1, 0.3, h));
            ground = mix(ground, vec3(0.92), smoothstep(0.72, 0.85, lat));
            vec3 col = mix(ocean, ground, land);
            // Clouds drift with time.
            vec3 cp = p * 3.0 + vec3(uTime * 0.01, 0.0, uTime * 0.006);
            float clouds = smoothstep(0.08, 0.45, fbm3(cp, ${octaves}));
            float light = max(dot(vNormal, uSun), 0.0);
            float spec = pow(max(dot(reflect(-uSun, vNormal), vView), 0.0), 40.0) * (1.0 - land) * 0.6;
            vec3 day = mix(col, vec3(1.0), clouds * 0.85) * (0.08 + light * 1.1) + spec;
            // City lights on the night side, only on land and under thin clouds.
            float city = smoothstep(0.55, 0.8, fbm3(p * 30.0, 3) + 0.5) * land * (1.0 - clouds);
            vec3 night = vec3(1.0, 0.72, 0.35) * city * 0.9 * smoothstep(0.15, -0.05, dot(vNormal, uSun));
            float rim = pow(1.0 - max(dot(vNormal, vView), 0.0), 3.0);
            vec3 atmo = vec3(0.35, 0.6, 1.0) * rim * (0.25 + light);
            gl_FragColor = vec4(day + night + atmo, 1.0);
          }`,
      }),
    [octaves],
  );

  const atmosphere = useMemo(
    () =>
      new ShaderMaterial({
        uniforms: { uSun: { value: SUN_DIR.clone() } },
        transparent: true,
        blending: AdditiveBlending,
        side: BackSide,
        depthWrite: false,
        vertexShader: /* glsl */ `
          varying vec3 vNormal; varying vec3 vView;
          void main() {
            vNormal = normalize(mat3(modelMatrix) * normal);
            vec4 wp = modelMatrix * vec4(position, 1.0);
            vView = normalize(cameraPosition - wp.xyz);
            gl_Position = projectionMatrix * viewMatrix * wp;
          }`,
        fragmentShader: /* glsl */ `
          uniform vec3 uSun; varying vec3 vNormal; varying vec3 vView;
          void main() {
            float rim = pow(1.0 - abs(dot(vNormal, vView)), 2.2);
            float lit = 0.35 + 0.65 * max(dot(vNormal, uSun) + 0.3, 0.0);
            gl_FragColor = vec4(vec3(0.3, 0.6, 1.0) * rim * lit * 1.6, rim);
          }`,
      }),
    [],
  );

  useEffect(() => () => { surface.dispose(); atmosphere.dispose(); }, [surface, atmosphere]);

  useFrame((state, dt) => {
    surface.uniforms.uTime.value = state.clock.elapsedTime;
    if (group.current) group.current.rotation.y += dt * (reducedMotion ? 0.002 : 0.008);
  });

  return (
    <group position={[-230, -205, -400]}>
      <group ref={group} rotation={[0.35, 0, 0.2]}>
        <mesh material={surface}>
          <sphereGeometry args={[150, segments, segments]} />
        </mesh>
      </group>
      <mesh material={atmosphere} scale={1.06}>
        <sphereGeometry args={[150, 64, 64]} />
      </mesh>
    </group>
  );
}

function Stars() {
  const count = qualityProfile().stars;
  const ref = useRef<Group>(null);
  const reducedMotion = useSettings((s) => s.reducedMotion);
  const { geo, mat } = useMemo(() => {
    const r = rng(3);
    const g = new BufferGeometry();
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);
    const size = new Float32Array(count);
    const c = new Color();
    for (let i = 0; i < count; i++) {
      const u = r() * 2 - 1;
      const th = r() * Math.PI * 2;
      const rad = 380 + r() * 80;
      const s = Math.sqrt(1 - u * u);
      pos.set([Math.cos(th) * s * rad, u * rad, Math.sin(th) * s * rad], i * 3);
      c.setHSL(0.55 + (r() - 0.5) * 0.25, 0.4 * r(), 0.7 + r() * 0.3);
      col.set([c.r, c.g, c.b], i * 3);
      size[i] = Math.pow(r(), 6) * 5 + 1;
    }
    g.setAttribute('position', new BufferAttribute(pos, 3));
    g.setAttribute('color', new BufferAttribute(col, 3));
    g.setAttribute('size', new BufferAttribute(size, 1));
    const m = new ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      uniforms: { uTime: { value: 0 } },
      vertexShader: /* glsl */ `
        attribute float size; attribute vec3 color; varying vec3 vColor; varying float vTw; uniform float uTime;
        void main() {
          vColor = color;
          vTw = 0.75 + 0.25 * sin(uTime * (1.0 + size) + position.x);
          gl_PointSize = size * 1.4;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: /* glsl */ `
        varying vec3 vColor; varying float vTw;
        void main() {
          float d = length(gl_PointCoord - 0.5);
          float a = smoothstep(0.5, 0.0, d);
          gl_FragColor = vec4(vColor * vTw, a);
        }`,
    });
    return { geo: g, mat: m };
  }, [count]);
  useEffect(() => () => { geo.dispose(); mat.dispose(); }, [geo, mat]);
  useFrame((state, dt) => {
    mat.uniforms.uTime.value = state.clock.elapsedTime;
    if (ref.current && !reducedMotion) ref.current.rotation.y += dt * 0.002;
  });
  return (
    <group ref={ref}>
      <points geometry={geo} material={mat} />
    </group>
  );
}

function Nebula() {
  const mat = useMemo(
    () =>
      new ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
        uniforms: { uTime: { value: 0 } },
        vertexShader: /* glsl */ `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
        fragmentShader: /* glsl */ `
          uniform float uTime; varying vec2 vUv;
          ${noiseGlsl}
          void main() {
            vec2 p = vUv * 2.0 - 1.0;
            float fall = smoothstep(1.0, 0.2, length(p));
            float n = fbm3(vec3(p * 1.8, uTime * 0.01), 5);
            float m = fbm3(vec3(p * 3.0 + 4.0, uTime * 0.008), 4);
            vec3 col = vec3(0.35, 0.12, 0.6) * smoothstep(-0.1, 0.5, n) + vec3(0.05, 0.25, 0.55) * smoothstep(0.0, 0.5, m);
            gl_FragColor = vec4(col * fall * 0.35, 1.0);
          }`,
      }),
    [],
  );
  useEffect(() => () => mat.dispose(), [mat]);
  useFrame((s) => (mat.uniforms.uTime.value = s.clock.elapsedTime));
  return (
    <mesh material={mat} position={[120, 90, -330]} rotation-z={0.4}>
      <planeGeometry args={[420, 300]} />
    </mesh>
  );
}

/** Rocky belt in the mid/background. One InstancedMesh = one draw call. */
function AsteroidBelt() {
  const count = qualityProfile().asteroids;
  const ref = useRef<InstancedMesh>(null);
  const reducedMotion = useSettings((s) => s.reducedMotion);
  const data = useMemo(() => {
    const r = rng(21);
    return Array.from({ length: count }, () => {
      const layer = r();
      return {
        x: (r() - 0.5) * 220,
        y: -30 + r() * 90 - layer * 20,
        z: -18 - layer * 90 - r() * 10,
        s: 0.3 + Math.pow(r(), 3) * 3.5,
        rx: r() * 6,
        ry: r() * 6,
        spin: (r() - 0.5) * 0.6,
        drift: (r() - 0.5) * 0.4,
      };
    });
  }, [count]);
  const geo = useMemo(() => rockGeometry(1, 7), []);
  const mat = useMemo(() => new MeshStandardMaterial({ color: '#6d6a72', roughness: 0.95, metalness: 0.05, flatShading: true }), []);
  useEffect(() => () => { geo.dispose(); mat.dispose(); }, [geo, mat]);
  const dummy = useMemo(() => new Object3D(), []);

  useFrame((state) => {
    const m = ref.current;
    if (!m) return;
    const t = reducedMotion ? 0 : state.clock.elapsedTime;
    for (let i = 0; i < data.length; i++) {
      const a = data[i];
      dummy.position.set(a.x + Math.sin(t * 0.05 + i) * a.drift * 4, a.y + Math.cos(t * 0.04 + i) * a.drift * 2, a.z);
      dummy.rotation.set(a.rx + t * a.spin, a.ry + t * a.spin * 0.7, 0);
      dummy.scale.setScalar(a.s);
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
    }
    m.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={ref} args={[geo, mat, count]} frustumCulled={false} />
  );
}

/** Lumpy asteroid geometry: displaced icosahedron. */
export function rockGeometry(radius: number, seed: number, detail = 2) {
  const g = new IcosahedronGeometry(radius, detail);
  const r = rng(seed);
  const pos = g.attributes.position as BufferAttribute;
  const v = new Vector3();
  const offsets = Array.from({ length: 6 }, () => new Vector3(r() - 0.5, r() - 0.5, r() - 0.5).normalize());
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const n = v.clone().normalize();
    let k = 1;
    offsets.forEach((o, j) => (k += Math.max(0, n.dot(o)) ** 3 * (j % 2 ? -0.25 : 0.2)));
    k += (r() - 0.5) * 0.08;
    v.multiplyScalar(k);
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  pos.setUsage(DynamicDrawUsage);
  g.computeVertexNormals();
  return g;
}

function DistantSatellites() {
  const refs = useRef<Group>(null);
  useFrame((state) => {
    const t = state.clock.elapsedTime;
    refs.current?.children.forEach((c, i) => {
      c.position.x = ((t * (1.2 + i * 0.5) + i * 60) % 240) - 120;
      c.rotation.z = t * 0.2 + i;
    });
  });
  return (
    <group ref={refs}>
      {[[-60, 50, -120], [30, 60, -150], [80, -10, -110]].map((p, i) => (
        <group key={i} position={p as [number, number, number]}>
          <mesh>
            <boxGeometry args={[1.2, 1.2, 2]} />
            <meshStandardMaterial color="#c9c9d6" metalness={0.8} roughness={0.3} />
          </mesh>
          <mesh position-x={2.2}>
            <boxGeometry args={[3, 0.05, 1.2]} />
            <meshStandardMaterial color="#223a8a" emissive="#10205a" metalness={0.6} roughness={0.3} />
          </mesh>
          <mesh position-x={-2.2}>
            <boxGeometry args={[3, 0.05, 1.2]} />
            <meshStandardMaterial color="#223a8a" emissive="#10205a" metalness={0.6} roughness={0.3} />
          </mesh>
          <mesh position-y={0.8}>
            <sphereGeometry args={[0.15, 8, 8]} />
            <meshBasicMaterial color={i === 1 ? '#ff5050' : '#50ff9a'} toneMapped={false} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

export function SpaceEnvironment() {
  return (
    <>
      <color attach="background" args={['#010208']} />
      <ambientLight intensity={0.12} color="#8fa6ff" />
      <hemisphereLight args={['#9fb6ff', '#0a0a18', 0.25]} />
      <directionalLight position={SUN_DIR.clone().multiplyScalar(100)} intensity={2.4} color="#fff4e0" />
      <Stars />
      <Nebula />
      <Earth />
      <AsteroidBelt />
      <DistantSatellites />
    </>
  );
}
