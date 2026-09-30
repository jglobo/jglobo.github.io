import { useFrame, useThree } from '@react-three/fiber';
import { useRef } from 'react';
import { debugInfo } from './debugInfo';

/** Lives inside the Canvas and samples renderer stats. */
export function DebugProbe() {
  const gl = useThree((s) => s.gl);
  const frames = useRef(0);
  const acc = useRef(0);
  useFrame((_, dt) => {
    frames.current++;
    acc.current += dt;
    if (acc.current >= 0.5) {
      debugInfo.fps = Math.round(frames.current / acc.current);
      debugInfo.frameMs = (acc.current / frames.current) * 1000;
      frames.current = 0;
      acc.current = 0;
    }
    debugInfo.calls = gl.info.render.calls;
    debugInfo.triangles = gl.info.render.triangles;
    debugInfo.geometries = gl.info.memory.geometries;
    debugInfo.textures = gl.info.memory.textures;
  });
  return null;
}
