// The dimensional portal. Instead of a second render pass, the disc runs a shader
// that paints a parallax "window" onto the destination (an optimized illusion, one
// draw call) inside a swirling, distorted rim.
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import { AdditiveBlending, BufferAttribute, BufferGeometry, Color, DoubleSide, Group, Quaternion, ShaderMaterial, Vector3 } from 'three';
import { useSettings, qualityProfile } from '../../stores/settingsStore';

export type PortalPreview = 'space' | 'hub' | 'room' | 'road' | 'generic';

const PREVIEW_ID: Record<PortalPreview, number> = { generic: 0, space: 1, hub: 2, room: 3, road: 4 };

const vertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragment = /* glsl */ `
  uniform float uTime;
  uniform float uOpen;
  uniform vec3 uColor;
  uniform vec3 uColor2;
  uniform vec2 uParallax;
  uniform int uPreview;
  varying vec2 vUv;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
  }
  float fbm(vec2 p) {
    float v = 0.0, a = 0.5;
    for (int i = 0; i < 5; i++) { v += a * noise(p); p *= 2.03; a *= 0.5; }
    return v;
  }
  float stars(vec2 q, float density, float size) {
    vec2 cell = floor(q * density);
    vec2 f = fract(q * density) - 0.5;
    float h = hash(cell);
    float on = step(0.93, h);
    return on * smoothstep(size, 0.0, length(f - (vec2(hash(cell + 3.1), hash(cell + 7.7)) - 0.5) * 0.6));
  }

  vec3 spacePreview(vec2 q) {
    vec3 col = vec3(0.005, 0.01, 0.03);
    float n = fbm(q * 1.6 + vec2(uTime * 0.01, 0.0));
    col += vec3(0.15, 0.05, 0.35) * pow(n, 3.0) * 1.6 + vec3(0.02, 0.12, 0.3) * pow(fbm(q * 2.4 + 9.0), 4.0) * 2.0;
    col += stars(q + uParallax * 0.2, 22.0, 0.12) * 0.9 + stars(q + uParallax * 0.5, 9.0, 0.09) * 1.2;
    // Earth's limb rising from the bottom of the window.
    vec2 c = vec2(0.35, -1.55) + uParallax * 1.2;
    float d = length(q - c);
    float earth = smoothstep(1.2, 1.19, d);
    float lat = (q.y - c.y);
    float land = smoothstep(0.52, 0.6, fbm((q - c) * 3.0 + vec2(uTime * 0.02, 0.0)));
    vec3 surface = mix(vec3(0.03, 0.18, 0.5), vec3(0.12, 0.35, 0.16), land) * (0.4 + 0.6 * lat);
    surface += vec3(1.0) * smoothstep(0.6, 0.75, fbm((q - c) * 4.0 - uTime * 0.03)) * 0.35;
    col = mix(col, surface, earth);
    col += vec3(0.25, 0.55, 1.0) * exp(-abs(d - 1.2) * 18.0) * 0.9;
    return col;
  }

  vec3 hubPreview(vec2 q) {
    q += uParallax;
    vec3 col = vec3(0.03, 0.02, 0.06);
    vec2 g = abs(fract(q * vec2(4.0, 3.0)) - 0.5);
    float grid = smoothstep(0.47, 0.5, max(g.x, g.y));
    col += vec3(0.5, 0.35, 1.0) * grid * 0.35;
    col += vec3(0.7, 0.55, 1.0) * exp(-length(q - vec2(0.0, -0.1)) * 3.0) * 0.8;
    return col;
  }

  // A dark bedroom at night: wallpaper stripes, a moonlit window and a glowing CRT.
  vec3 roomPreview(vec2 q) {
    q += uParallax * 0.8;
    vec3 col = mix(vec3(0.05, 0.02, 0.07), vec3(0.12, 0.05, 0.14), smoothstep(-1.0, 0.6, q.y));
    col += vec3(0.04, 0.01, 0.05) * step(0.5, fract(q.x * 6.0));
    // floor
    col = mix(col, vec3(0.06, 0.03, 0.04) + 0.02 * noise(q * 30.0), smoothstep(-0.42, -0.45, q.y));
    // window with moon and stars
    vec2 w = q - vec2(-0.55, 0.38);
    float win = step(abs(w.x), 0.26) * step(abs(w.y), 0.2);
    vec3 night = vec3(0.04, 0.06, 0.18) + stars(q * 0.8, 30.0, 0.1) + vec3(0.9, 0.9, 0.75) * smoothstep(0.07, 0.06, length(w - vec2(0.1, 0.06)));
    col = mix(col, night, win);
    col = mix(col, vec3(0.2, 0.1, 0.12), win * (step(abs(w.x), 0.012) + step(abs(w.y), 0.012)));
    // CRT on a stand
    vec2 t = q - vec2(0.3, -0.18);
    float body = step(abs(t.x), 0.3) * step(abs(t.y), 0.24);
    col = mix(col, vec3(0.13, 0.12, 0.13), body);
    vec2 s = t / vec2(0.24, 0.18);
    float screen = smoothstep(1.0, 0.96, max(abs(s.x), abs(s.y)));
    vec3 glow = mix(vec3(0.2, 0.35, 1.0), vec3(1.0, 0.25, 0.7), 0.5 + 0.5 * sin(uTime * 0.7 + t.x * 4.0));
    glow *= 0.55 + 0.25 * sin(t.y * 220.0);
    col = mix(col, glow, screen);
    col += vec3(1.0, 0.3, 0.75) * exp(-length(t) * 3.0) * 0.25;
    col = mix(col, vec3(0.08, 0.07, 0.08), step(abs(t.x), 0.36) * step(-0.6, t.y) * step(t.y, -0.26));
    return col;
  }

  // Daytime town: sky, hills, a road running to the horizon and a cyan billboard.
  vec3 roadPreview(vec2 q) {
    q += uParallax;
    float horizon = -0.05;
    vec3 col = mix(vec3(0.75, 0.88, 1.0), vec3(0.35, 0.6, 0.95), smoothstep(horizon, 1.0, q.y));
    float hills = horizon + 0.08 * sin(q.x * 3.0 + 1.0) + 0.05 * sin(q.x * 7.0);
    col = mix(col, vec3(0.25, 0.5, 0.25), step(q.y, hills));
    if (q.y < horizon) {
      float depth = (horizon - q.y);
      col = vec3(0.3, 0.55, 0.25) + 0.04 * noise(q * 40.0);
      float hw = depth * 0.9 + 0.01;
      float road = step(abs(q.x - 0.1), hw);
      col = mix(col, vec3(0.22, 0.23, 0.26), road);
      float dash = step(0.5, fract(1.0 / (depth + 0.02) * 0.6 - uTime * 1.5));
      col = mix(col, vec3(1.0, 0.85, 0.2), road * dash * step(abs(q.x - 0.1), depth * 0.04));
    }
    vec2 b = q - vec2(-0.5, 0.25);
    float board = step(abs(b.x), 0.28) * step(abs(b.y), 0.15);
    col = mix(col, mix(vec3(0.05, 0.6, 0.75), vec3(0.6, 1.0, 1.0), 0.5 + 0.5 * sin(uTime * 2.0 + b.x * 10.0)), board);
    col = mix(col, vec3(0.3), step(abs(b.x), 0.012) * step(b.y, -0.15) * step(horizon - 0.02, q.y));
    return col;
  }

  void main() {
    vec2 p = (vUv * 2.0 - 1.0) * 1.25;
    float r = length(p);
    float ang = atan(p.y, p.x);
    float edge = uOpen;
    float wobble = (fbm(vec2(ang * 2.0 + uTime * 1.3, r * 3.0 - uTime * 2.2)) - 0.5) * 0.18 * uOpen;
    float rr = r + wobble;

    vec2 swirl = p * mat2(cos(r * 2.0 - uTime), -sin(r * 2.0 - uTime), sin(r * 2.0 - uTime), cos(r * 2.0 - uTime));
    vec2 q = mix(p, swirl, smoothstep(edge * 0.55, edge, rr) * 0.6) * 0.9;

    vec3 inside = uPreview == 1 ? spacePreview(q) : uPreview == 2 ? hubPreview(q) : uPreview == 3 ? roomPreview(q) : uPreview == 4 ? roadPreview(q) : mix(uColor * 0.2, uColor2 * 0.4, fbm(q * 3.0 + uTime * 0.2));

    float rimBand = smoothstep(edge - 0.28, edge, rr);
    float flow = fbm(vec2(ang * 3.0 - uTime * 3.0, rr * 7.0 - uTime));
    vec3 rimCol = mix(uColor, uColor2, flow) * (1.2 + flow);
    vec3 col = mix(inside, rimCol, rimBand * 0.85);

    float body = 1.0 - smoothstep(edge - 0.015, edge + 0.015, rr);
    float glow = exp(-max(rr - edge, 0.0) * 9.0) * uOpen * (1.0 - body);
    col += uColor * glow;
    float alpha = max(body, glow * 0.7);
    if (alpha < 0.01) discard;
    gl_FragColor = vec4(col, alpha);
  }
`;

export interface PortalProps {
  position: Vector3 | [number, number, number];
  normal: Vector3 | [number, number, number];
  color: string;
  color2: string;
  preview: PortalPreview;
  /** 0..1 target; the portal eases toward it. */
  open: number;
  scale?: number;
}

export function Portal({ position, normal, color, color2, preview, open, scale = 1 }: PortalProps) {
  const group = useRef<Group>(null);
  const openRef = useRef(0);
  const camera = useThree((s) => s.camera);
  const reducedMotion = useSettings((s) => s.reducedMotion);
  const particleCount = qualityProfile().particles;

  const material = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader: vertex,
        fragmentShader: fragment,
        transparent: true,
        depthWrite: false,
        side: DoubleSide,
        uniforms: {
          uTime: { value: 0 },
          uOpen: { value: 0 },
          uColor: { value: new Color(color) },
          uColor2: { value: new Color(color2) },
          uParallax: { value: [0, 0] },
          uPreview: { value: PREVIEW_ID[preview] },
        },
      }),
    [color, color2, preview],
  );

  const particles = useMemo(() => {
    const g = new BufferGeometry();
    const pos = new Float32Array(particleCount * 3);
    const seeds = new Float32Array(particleCount);
    for (let i = 0; i < particleCount; i++) seeds[i] = Math.random();
    g.setAttribute('position', new BufferAttribute(pos, 3));
    return { g, seeds };
  }, [particleCount]);

  const pos = useMemo(() => (position instanceof Vector3 ? position.clone() : new Vector3(...position)), [position]);
  const quat = useMemo(() => {
    const n = normal instanceof Vector3 ? normal.clone() : new Vector3(...normal);
    return new Quaternion().setFromUnitVectors(new Vector3(0, 0, 1), n.normalize());
  }, [normal]);

  useEffect(() => () => material.dispose(), [material]);
  useEffect(() => () => particles.g.dispose(), [particles]);
  const tmp = useMemo(() => new Vector3(), []);

  useFrame((state, dt) => {
    const t = state.clock.elapsedTime;
    openRef.current += (open - openRef.current) * Math.min(1, dt * (open > openRef.current ? 2.6 : 5));
    const o = openRef.current;
    material.uniforms.uTime.value = reducedMotion ? t * 0.3 : t;
    material.uniforms.uOpen.value = o;
    // Parallax: offset of the camera relative to the portal, in the portal's plane.
    tmp.copy(camera.position).sub(pos).applyQuaternion(quat.clone().invert());
    material.uniforms.uParallax.value = [-tmp.x * 0.04, -tmp.y * 0.04];

    const arr = particles.g.attributes.position.array as Float32Array;
    for (let i = 0; i < particleCount; i++) {
      const s = particles.seeds[i];
      const a = s * Math.PI * 2 + t * (0.6 + s);
      const life = (t * 0.5 + s) % 1;
      const rad = (1.0 + life * 0.5) * o;
      arr[i * 3] = Math.cos(a) * rad;
      arr[i * 3 + 1] = Math.sin(a) * rad * 1.3;
      arr[i * 3 + 2] = life * 0.8;
    }
    particles.g.attributes.position.needsUpdate = true;
    if (group.current) group.current.visible = o > 0.01;
  });

  return (
    <group ref={group} position={pos} quaternion={quat} scale={scale}>
      <mesh material={material} renderOrder={5}>
        <planeGeometry args={[3.2, 4.2]} />
      </mesh>
      <points geometry={particles.g} renderOrder={6}>
        <pointsMaterial color={color2} size={0.06} transparent opacity={0.9} blending={AdditiveBlending} depthWrite={false} />
      </points>
      <pointLight color={color} intensity={6 * open} distance={9} decay={1.6} position={[0, 0, 0.6]} />
    </group>
  );
}
