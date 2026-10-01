import type { Quality } from '../stores/settingsStore';

export interface Capabilities {
  webgl: boolean;
  webgl2: boolean;
  touch: boolean;
  mobile: boolean;
  suggestedQuality: Quality;
}

/** Detects WebGL support and picks a starting quality preset from simple hardware hints. */
export function detectCapabilities(): Capabilities {
  let webgl = false;
  let webgl2 = false;
  let renderer = '';
  try {
    const canvas = document.createElement('canvas');
    const gl2 = canvas.getContext('webgl2');
    const gl = gl2 ?? canvas.getContext('webgl');
    webgl = !!gl;
    webgl2 = !!gl2;
    if (gl) {
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      renderer = ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : '';
      gl.getExtension('WEBGL_lose_context')?.loseContext();
    }
  } catch {
    webgl = false;
  }
  const touch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  const mobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) || (touch && Math.min(screen.width, screen.height) < 820);
  const cores = navigator.hardwareConcurrency ?? 4;
  const memory = (navigator as unknown as { deviceMemory?: number }).deviceMemory ?? 8;
  const software = /SwiftShader|llvmpipe|Software/i.test(renderer);
  const discrete = /NVIDIA|GeForce|Radeon RX|RTX|Apple M\d (Pro|Max|Ultra)/i.test(renderer);

  let suggestedQuality: Quality = 'medium';
  if (!webgl2 || software || mobile || memory <= 2 || cores <= 2) suggestedQuality = 'low';
  else if (discrete && cores >= 8) suggestedQuality = 'high';
  return { webgl, webgl2, touch, mobile, suggestedQuality };
}
