// HD-2D camera: a narrow lens looking down at the town from the south, following
// the visitor with a little lag, easing toward a building when the visitor stands
// at its door, and opening with a slow reveal from high above.
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import { Vector3 } from 'three';
import { debugInfo } from '../../engine/debug/debugInfo';
import { useSettings } from '../../stores/settingsStore';
import { journeyRuntime } from './journeyStore';

const HEIGHT = 10.5;
const BACK = 17;
const INTRO = 3.2;

export function HD2DCamera() {
  const camera = useThree((s) => s.camera);
  const target = useMemo(() => new Vector3(journeyRuntime.x, 0, journeyRuntime.z), []);
  const reduced = useSettings((s) => s.reducedMotion);
  const zoom = useMemo(() => ({ v: 1 }), []);

  useEffect(() => {
    target.set(journeyRuntime.x, 0, journeyRuntime.z);
  }, [target]);

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    const f = journeyRuntime.focus;
    const gx = f ? journeyRuntime.x * 0.55 + f.x * 0.45 : journeyRuntime.x;
    const gz = f ? journeyRuntime.z * 0.55 + (f.z - 1.5) * 0.45 : journeyRuntime.z - 1;
    const k = Math.min(1, dt * (reduced ? 6 : 2.6));
    target.x += (gx - target.x) * k;
    target.z += (gz - target.z) * k;
    zoom.v += ((f ? 0.82 : 1) - zoom.v) * Math.min(1, dt * 1.5);

    // Intro: start high over the town and settle behind the visitor.
    const t = reduced ? 1 : Math.min(1, journeyRuntime.time / INTRO);
    const ease = 1 - Math.pow(1 - t, 3);
    const lift = 1 + (1 - ease) * 1.6;
    camera.position.set(target.x, HEIGHT * zoom.v * lift, target.z + BACK * zoom.v * (1 + (1 - ease) * 0.4));
    camera.lookAt(target.x, 0.6, target.z - (1 - ease) * 10);
    debugInfo.camera = [camera.position.x, camera.position.y, camera.position.z];
  });
  return null;
}
