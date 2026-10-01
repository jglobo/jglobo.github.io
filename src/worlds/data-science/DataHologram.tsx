// Floating 3D chart generated from a project's `visualization` data. It unfolds when
// the astronaut approaches the site.
import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import {
  AdditiveBlending, BufferGeometry, Color, Float32BufferAttribute, Group, InstancedMesh, Line, LineBasicMaterial, MeshBasicMaterial, Object3D, SphereGeometry,
  BoxGeometry,
} from 'three';
import type { ProjectVisualization } from '../../content';
import { correlatedPoints } from '../../utils/random';
import { makeTextTexture } from '../../utils/textTexture';

const W = 5;
const H = 3.4;

export function DataHologram({ viz, proximity, offset }: { viz: ProjectVisualization; proximity: React.RefObject<number>; offset: [number, number, number] }) {
  const root = useRef<Group>(null);
  const bars = useRef<InstancedMesh>(null);
  const dots = useRef<InstancedMesh>(null);

  const data = useMemo(() => {
    if (viz.kind === 'scatter') return correlatedPoints(viz.seed ?? 1, viz.count ?? 60, viz.correlation ?? 0.5);
    return (viz.values ?? []).map((v, i, arr) => [i / Math.max(1, arr.length - 1), v, 0] as [number, number, number]);
  }, [viz]);

  const resources = useMemo(() => {
    const frame = new BufferGeometry();
    // Axes + light grid.
    const pts: number[] = [0, 0, 0, W, 0, 0, 0, 0, 0, 0, H, 0];
    for (let i = 1; i <= 4; i++) pts.push(0, (H * i) / 4, 0, W, (H * i) / 4, 0);
    frame.setAttribute('position', new Float32BufferAttribute(pts, 3));
    const line = new BufferGeometry();
    if (viz.kind === 'line') {
      line.setAttribute('position', new Float32BufferAttribute(data.flatMap(([x, y]) => [x * W, y * H, 0.05]), 3));
    } else if (viz.kind === 'scatter') {
      // Regression line through the generated points.
      const n = data.length;
      const mx = data.reduce((s, p) => s + p[0], 0) / n;
      const my = data.reduce((s, p) => s + p[1], 0) / n;
      const b = data.reduce((s, p) => s + (p[0] - mx) * (p[1] - my), 0) / data.reduce((s, p) => s + (p[0] - mx) ** 2, 0);
      const a = my - b * mx;
      const y0 = Math.max(0, Math.min(1, a));
      const y1 = Math.max(0, Math.min(1, a + b));
      line.setAttribute('position', new Float32BufferAttribute([0, y0 * H, 0.3, W, y1 * H, 0.3], 3));
    }
    const label = makeTextTexture(
      [
        { text: viz.label, size: 40, weight: '700', color: '#cfe8ff' },
        ...(viz.illustrative ? [{ text: 'Shape of the result · real figures in the project panel', size: 26, weight: '500', color: '#8fb8e6' }] : []),
      ],
      { width: 1200, height: 150, glow: '#3d7bff' },
    );
    const lineMat = new LineBasicMaterial({ color: '#ffd27f', transparent: true, opacity: 0.95 });
    return {
      frame,
      line,
      lineObject: new Line(line, lineMat),
      label,
      frameMat: new LineBasicMaterial({ color: '#5fa8ff', transparent: true, opacity: 0.5 }),
      lineMat,
      dotGeo: new SphereGeometry(0.07, 8, 8),
      barGeo: new BoxGeometry(1, 1, 0.4),
      holoMat: new MeshBasicMaterial({ color: '#7fc8ff', transparent: true, opacity: 0.85, blending: AdditiveBlending, depthWrite: false }),
    };
  }, [viz, data]);

  useEffect(
    () => () => {
      const r = resources;
      [r.frame, r.line, r.dotGeo, r.barGeo].forEach((g) => g.dispose());
      [r.frameMat, r.lineMat, r.holoMat].forEach((m) => m.dispose());
      r.label.dispose();
    },
    [resources],
  );

  const dummy = useMemo(() => new Object3D(), []);
  const color = useMemo(() => new Color(), []);

  useFrame((state) => {
    const k = proximity.current ?? 0;
    const g = root.current;
    if (!g) return;
    g.visible = k > 0.02;
    if (!g.visible) return;
    const t = state.clock.elapsedTime;
    g.scale.set(k, k, k);
    g.rotation.y = Math.sin(t * 0.3) * 0.25;
    resources.holoMat.opacity = 0.6 + Math.sin(t * 8) * 0.05;

    if (viz.kind === 'scatter' && dots.current) {
      data.forEach(([x, y, z], i) => {
        dummy.position.set(x * W, y * H, (z - 0.5) * 1.2 + Math.sin(t + i) * 0.03);
        dummy.scale.setScalar(Math.min(1, k * 1.5 - (i / data.length) * 0.5));
        dummy.updateMatrix();
        dots.current!.setMatrixAt(i, dummy.matrix);
        dots.current!.setColorAt(i, color.setHSL(0.58 - y * 0.12, 0.8, 0.55 + z * 0.2));
      });
      dots.current.instanceMatrix.needsUpdate = true;
      if (dots.current.instanceColor) dots.current.instanceColor.needsUpdate = true;
    }
    if (viz.kind === 'bars' && bars.current) {
      const n = data.length;
      const bw = (W / n) * 0.6;
      data.forEach(([, v], i) => {
        const h = Math.max(0.01, v * H * Math.min(1, k * 1.4 - i * 0.05));
        dummy.position.set((i + 0.5) * (W / n), h / 2, 0);
        dummy.scale.set(bw, h, 1);
        dummy.updateMatrix();
        bars.current!.setMatrixAt(i, dummy.matrix);
        bars.current!.setColorAt(i, color.setHSL(0.58 - i * 0.03, 0.8, 0.6));
      });
      bars.current.instanceMatrix.needsUpdate = true;
      if (bars.current.instanceColor) bars.current.instanceColor.needsUpdate = true;
    }
  });

  return (
    <group position={offset}>
      <group ref={root} visible={false}>
        <group position={[-W / 2, -H / 2, 0]}>
          <lineSegments geometry={resources.frame} material={resources.frameMat} />
          {viz.kind !== 'bars' && <primitive object={resources.lineObject} />}
          {viz.kind === 'line' &&
            data.map(([x, y], i) => (
              <mesh key={i} geometry={resources.dotGeo} material={resources.holoMat} position={[x * W, y * H, 0.05]} scale={1.6} />
            ))}
          {viz.kind === 'scatter' && <instancedMesh ref={dots} args={[resources.dotGeo, resources.holoMat, data.length]} />}
          {viz.kind === 'bars' && <instancedMesh ref={bars} args={[resources.barGeo, resources.holoMat, data.length]} />}
          <mesh position={[W / 2, H / 2, -0.4]}>
            <planeGeometry args={[W + 0.8, H + 0.8]} />
            <meshBasicMaterial color="#0a2a5a" transparent opacity={0.25} blending={AdditiveBlending} depthWrite={false} />
          </mesh>
        </group>
        <mesh position={[0, H / 2 + 0.6, 0]}>
          <planeGeometry args={[6, 0.75]} />
          <meshBasicMaterial map={resources.label} transparent depthWrite={false} toneMapped={false} />
        </mesh>
      </group>
    </group>
  );
}
