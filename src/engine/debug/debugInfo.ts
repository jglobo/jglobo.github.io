// Mutable debug readouts written by controllers and read by the debug overlay.
export const debugInfo = {
  player: [0, 0, 0] as [number, number, number],
  camera: [0, 0, 0] as [number, number, number],
  fps: 0,
  frameMs: 0,
  calls: 0,
  triangles: 0,
  geometries: 0,
  textures: 0,
};
