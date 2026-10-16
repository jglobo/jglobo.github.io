// The portal gun, held in first person: Jose's model (assets/portal_gun.glb) and portal
// (assets/portal.glb), played through his controller. Left click fires the blue portal,
// right click the orange one. Once both are open, each portal shows the view out of the
// other one (rendered to a texture from a camera moved through the pair); on Low quality
// they show a swirl instead.
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import {
  Color, DoubleSide, Group, HalfFloatType, Matrix4, PerspectiveCamera, ShaderMaterial, Vector2, Vector3, WebGLRenderTarget, type Material, type Mesh,
} from 'three';
import { audio } from '../../engine/audio/AudioManager';
import { useSettings } from '../../stores/settingsStore';
import gunUrl from './assets/portal_gun.glb?url';
import portalUrl from './assets/portal.glb?url';
import { PORTAL_COLORS, PORTAL_SCALE, type PortalColor, type PortalFrame } from './chamber';
import { useHub, type PlacedPortal } from './hubStore';
import { loadPortalGun, tintEnergy, type PortalGun } from './portalGunController';

/** The gun model is about 1.85 m long; this makes it a ~30 cm hand-held launcher. */
const GUN_SCALE = 0.16;
const COLORS: PortalColor[] = ['blue', 'orange'];

/** Shared between the controller and the launcher each frame. */
export const launcherRuntime = {
  speed: 0,
  muzzle: new Vector3(),
  gun: null as PortalGun | null,
};

const viewVertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
const viewFragment = /* glsl */ `
  uniform sampler2D uView;
  uniform vec2 uRes;
  uniform float uHasView;
  uniform vec3 uColor;
  uniform vec3 uColor2;
  uniform float uTime;
  varying vec2 vUv;
  void main() {
    vec2 p = vUv * 2.0 - 1.0;
    float r = length(p);
    float a = atan(p.y, p.x);
    float s = sin(a * 3.0 + r * 9.0 - uTime * 3.0) * 0.5 + 0.5;
    vec3 swirl = mix(uColor * 0.55, uColor2 * 1.2, s * 0.6 + 0.2);
    vec3 view = texture2D(uView, gl_FragCoord.xy / uRes).rgb;
    gl_FragColor = vec4(mix(swirl, view, uHasView), 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

function frameMatrix(f: PortalFrame, out = new Matrix4()) {
  return out.makeBasis(f.right, f.up, f.normal).setPosition(f.pos);
}

export function PortalLauncher() {
  const root = useRef<Group>(null);
  const model = useRef<Group>(null);
  const effects = useRef<Group>(null);
  const { camera, gl, scene } = useThree();
  const reducedMotion = useSettings((s) => s.reducedMotion);
  const quality = useSettings((s) => s.quality);
  const bob = useRef(0);
  const shownIds = useRef<Record<PortalColor, number>>({ blue: 0, orange: 0 });
  const tinted = useRef<PortalColor | null>(null);

  // See-through views: one material, render target and camera per portal.
  const views = useMemo(() => {
    const make = (c: PortalColor) => ({
      material: new ShaderMaterial({
        vertexShader: viewVertex,
        fragmentShader: viewFragment,
        side: DoubleSide,
        uniforms: {
          uView: { value: null },
          uRes: { value: new Vector2(1, 1) },
          uHasView: { value: 0 },
          uColor: { value: new Color(PORTAL_COLORS[c].main) },
          uColor2: { value: new Color(PORTAL_COLORS[c].light) },
          uTime: { value: 0 },
        },
      }),
      target: null as WebGLRenderTarget | null,
      camera: new PerspectiveCamera(),
    });
    return { blue: make('blue'), orange: make('orange') };
  }, []);
  useEffect(
    () => () => {
      for (const v of Object.values(views)) {
        v.material.dispose();
        v.target?.dispose();
      }
    },
    [views],
  );
  const tmp = useMemo(() => ({ a: new Matrix4(), b: new Matrix4(), flip: new Matrix4().makeRotationY(Math.PI), size: new Vector2(), fwd: new Vector3(), to: new Vector3() }), []);

  useEffect(() => {
    let alive = true;
    let loaded: PortalGun | null = null;
    loadPortalGun(gunUrl, portalUrl, effects.current!)
      .then((gun) => {
        if (!alive) return gun.dispose();
        loaded = gun;
        gun.object.scale.setScalar(GUN_SCALE);
        gun.object.rotation.y = Math.PI; // its muzzle is +Z; the camera looks down -Z
        gun.object.traverse((o) => (o.frustumCulled = false));
        for (const c of COLORS) {
          const p = gun.portals[c];
          p.object.scale.set(PORTAL_SCALE, PORTAL_SCALE, 1);
          tintEnergy(p.object, PORTAL_COLORS[c].main, PORTAL_COLORS[c].light);
          if (p.inner) {
            (p.inner.material as Material).dispose();
            p.inner.material = views[c].material;
            p.inner.renderOrder = 2;
          }
        }
        model.current?.add(gun.object);
        launcherRuntime.gun = gun;
      })
      .catch((e) => console.error('Portal gun failed to load:', e));
    return () => {
      alive = false;
      if (launcherRuntime.gun === loaded) launcherRuntime.gun = null;
      loaded?.dispose();
    };
  }, [views]);

  useFrame((state, rawDt) => {
    if (!root.current || !model.current) return;
    const dt = Math.min(rawDt, 0.1);
    root.current.position.copy(camera.position);
    root.current.quaternion.copy(camera.quaternion);
    const t = state.clock.elapsedTime;
    const motion = reducedMotion ? 0.3 : 1;
    bob.current += dt * (4 + launcherRuntime.speed * 1.4);
    const walk = Math.min(1, launcherRuntime.speed / 4) * motion;
    model.current.position.set(
      0.17 + Math.sin(bob.current) * 0.01 * walk,
      -0.165 + Math.abs(Math.cos(bob.current)) * 0.012 * walk + Math.sin(t * 1.5) * 0.003 * motion,
      -0.4,
    );
    model.current.rotation.set(0, 0.06, 0);

    const hub = useHub.getState();
    for (const c of COLORS) {
      const p = hub[c];
      if (p) p.age += dt;
    }
    const gun = launcherRuntime.gun;
    if (!gun) {
      model.current.getWorldPosition(launcherRuntime.muzzle);
      return;
    }
    gun.update(dt);
    gun.muzzle.getWorldPosition(launcherRuntime.muzzle);
    if (tinted.current !== hub.lastFired) {
      tinted.current = hub.lastFired;
      const col = PORTAL_COLORS[hub.lastFired];
      tintEnergy(gun.object, col.main, col.light);
      (gun.orb.material as unknown as { color: Color }).color.set(col.light);
      ((gun.orb.children[0] as Mesh).material as unknown as { color: Color }).color.set(col.main);
    }

    // Place, open and close the two portal models.
    for (const c of COLORS) {
      const p = hub[c];
      const fx = gun.portals[c];
      if (!p) {
        if (fx.object.visible) fx.close();
        shownIds.current[c] = 0;
        continue;
      }
      if (shownIds.current[c] !== p.id) {
        shownIds.current[c] = p.id;
        frameMatrix(p, tmp.a).decompose(fx.object.position, fx.object.quaternion, tmp.to);
        fx.object.position.addScaledVector(p.normal, 0.01);
        fx.open();
        audio.play('portalOpen');
      }
    }

    // See-through views.
    gl.getDrawingBufferSize(tmp.size);
    const res = quality === 'low' ? 0 : quality === 'medium' ? 0.5 : quality === 'high' ? 0.75 : 1;
    const both = hub.blue && hub.orange;
    for (const c of COLORS) {
      const v = views[c];
      v.material.uniforms.uTime.value = t;
      v.material.uniforms.uRes.value.copy(tmp.size);
      const src = hub[c] as PlacedPortal | null;
      const dst = hub[c === 'blue' ? 'orange' : 'blue'] as PlacedPortal | null;
      const open = both && src && dst ? Math.min(1, Math.min(src.age, dst.age) / 0.6) : 0;
      v.material.uniforms.uHasView.value = res ? open : 0;
      launcherRuntime.gun?.portals[c].arcs.forEach((a) => (a.visible = !res || open < 1));
      if (!res || !src || !dst || open <= 0) continue;
      // Skip portals behind the camera or far away.
      camera.getWorldDirection(tmp.fwd);
      tmp.to.copy(src.pos).sub(camera.position);
      if (tmp.to.length() > 40 || tmp.to.dot(tmp.fwd) < -2) continue;
      const w = Math.max(1, Math.floor(tmp.size.x * res));
      const h = Math.max(1, Math.floor(tmp.size.y * res));
      if (!v.target || v.target.width !== w || v.target.height !== h) {
        v.target?.dispose();
        v.target = new WebGLRenderTarget(w, h, { type: HalfFloatType });
        v.material.uniforms.uView.value = v.target.texture;
      }
      const cam = v.camera;
      const main = camera as PerspectiveCamera;
      main.updateMatrixWorld();
      cam.fov = main.fov;
      cam.aspect = main.aspect;
      cam.near = main.near;
      cam.far = main.far;
      cam.updateProjectionMatrix();
      // Looking into `src` is looking out of `dst`, turned around.
      const m = frameMatrix(dst, tmp.b).multiply(tmp.flip).multiply(frameMatrix(src, tmp.a).invert()).multiply(main.matrixWorld);
      cam.matrixAutoUpdate = false;
      cam.matrixWorldAutoUpdate = false;
      cam.matrixWorld.copy(m);
      cam.matrixWorldInverse.copy(m).invert();
      m.decompose(cam.position, cam.quaternion, cam.scale);
      const hidden = [root.current, effects.current];
      hidden.forEach((o) => o && (o.visible = false));
      gl.setRenderTarget(v.target);
      gl.render(scene, cam);
      gl.setRenderTarget(null);
      hidden.forEach((o) => o && (o.visible = true));
    }
  });

  return (
    <>
      <group ref={effects} />
      <group ref={root}>
        <group ref={model} />
      </group>
    </>
  );
}

/** Fire a portal. Returns false while the Fire clip is still playing. */
export function fireGun(color: PortalColor, frame: PortalFrame | null, missAt?: Vector3): boolean {
  const gun = launcherRuntime.gun;
  const place = () => frame && useHub.getState().place(color, frame);
  useHub.getState().set({ lastFired: color });
  if (!gun) {
    place();
    return true;
  }
  const end = frame?.pos ?? missAt;
  if (!end) return false;
  return gun.fire(end, place);
}
