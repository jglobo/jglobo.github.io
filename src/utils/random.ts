/** Small deterministic PRNG (mulberry32) so procedural worlds look the same every visit. */
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Deterministic correlated scatter points in 0..1 for a visualization. */
export function correlatedPoints(seed: number, count: number, r: number) {
  const rand = rng(seed);
  const gauss = () => Math.sqrt(-2 * Math.log(rand() + 1e-9)) * Math.cos(2 * Math.PI * rand());
  const pts: [number, number, number][] = [];
  for (let i = 0; i < count; i++) {
    const x = gauss();
    const y = r * x + Math.sqrt(1 - r * r) * gauss();
    pts.push([0.5 + x * 0.18, 0.5 + y * 0.18, rand()]);
  }
  return pts.map(([x, y, z]) => [Math.min(1, Math.max(0, x)), Math.min(1, Math.max(0, y)), z] as [number, number, number]);
}
