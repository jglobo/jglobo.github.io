import type { Vector3 } from 'three';

/** Current aim result, written by the controller each frame, read by HUD/preview. */
export const hubAim: { hit: { position: Vector3; normal: Vector3 } | null; surface: number } = { hit: null, surface: 0 };
