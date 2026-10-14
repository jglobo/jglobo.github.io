// HD-2D "miniature" depth of field: a cheap two-pass tilt-shift blur that keeps a
// horizontal band around the visitor sharp and softens the foreground and the
// distance. Replaces the default render while the Journey world is mounted.
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { HorizontalTiltShiftShader } from 'three/examples/jsm/shaders/HorizontalTiltShiftShader.js';
import { VerticalTiltShiftShader } from 'three/examples/jsm/shaders/VerticalTiltShiftShader.js';

/** Focus line in screen space (0 = bottom, 1 = top); the visitor stands a little below centre. */
const FOCUS = 0.46;

export function TiltShift({ strength }: { strength: number }) {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  const fx = useMemo(() => {
    const composer = new EffectComposer(gl);
    const render = new RenderPass(scene, camera);
    const h = new ShaderPass(HorizontalTiltShiftShader);
    const v = new ShaderPass(VerticalTiltShiftShader);
    h.uniforms.r.value = FOCUS;
    v.uniforms.r.value = FOCUS;
    const out = new OutputPass();
    composer.addPass(render);
    composer.addPass(h);
    composer.addPass(v);
    composer.addPass(out);
    return { composer, passes: [render, h, v, out], h, v };
  }, [gl, scene, camera]);

  useEffect(() => {
    const dpr = gl.getPixelRatio();
    fx.composer.setPixelRatio(dpr);
    fx.composer.setSize(size.width, size.height);
    fx.h.uniforms.h.value = strength / (size.width * dpr);
    fx.v.uniforms.v.value = strength / (size.height * dpr);
  }, [fx, gl, size, strength]);

  useEffect(
    () => () => {
      fx.passes.forEach((p) => p.dispose());
      fx.composer.dispose();
    },
    [fx],
  );

  // Priority 1 takes over rendering from R3F for as long as this is mounted.
  useFrame((_, dt) => fx.composer.render(dt), 1);
  return null;
}
