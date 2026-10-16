import type { Object3D, Vector3 } from 'three';
import type { PortalFrame } from './chamber';

/** Shared per-frame hub state, written by the controller and puzzles, read by the HUD and props. */
export const hubAim: {
  /** What the crosshair is on: a portal spot (frame) or a surface that refuses portals. */
  hit: { point: Vector3; frame: PortalFrame | null } | null;
  /** Meshes the aim ray tests; portal-compatible ones carry userData.surfaceId. */
  targets: Set<Object3D>;
  /** Walkable light-bridge spans, from the journey puzzle. */
  bridge: [Vector3, Vector3][];
} = { hit: null, targets: new Set(), bridge: [] };

/** Ref callback that registers a mesh with the aim ray. */
export const aimTarget = (o: Object3D | null) => {
  if (o) hubAim.targets.add(o);
};
