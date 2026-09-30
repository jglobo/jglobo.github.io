// Zero-g movement on the 2.5D play plane. Pure functions so it can be unit tested
// and reused; the Astronaut component just feeds it input and renders the result.

export interface JetpackParams {
  thrust: number; // acceleration while a direction is held (units/s²)
  maxSpeed: number; // soft cap
  boostSpeed: number; // soft cap while boosting
  boostThrust: number;
  damping: number; // exponential velocity decay per second (inertia feel)
  boostTime: number;
  boostCooldown: number;
  bounds: { minX: number; maxX: number; minY: number; maxY: number };
}

export const DEFAULT_JETPACK: JetpackParams = {
  thrust: 20,
  maxSpeed: 9,
  boostSpeed: 17,
  boostThrust: 42,
  damping: 1.1,
  boostTime: 0.55,
  boostCooldown: 1.4,
  bounds: { minX: -48, maxX: 48, minY: -22, maxY: 40 },
};

export interface JetpackState {
  x: number;
  y: number;
  vx: number;
  vy: number;
  boostLeft: number; // seconds of boost remaining
  cooldown: number; // seconds until boost is available
}

export interface JetpackInput {
  x: number; // -1..1
  y: number; // -1..1
  boost: boolean; // boost key currently held
}

export const initialJetpack = (x = 0, y = 0): JetpackState => ({ x, y, vx: 0, vy: 0, boostLeft: 0, cooldown: 0 });

export function stepJetpack(s: JetpackState, input: JetpackInput, dt: number, p: JetpackParams = DEFAULT_JETPACK): JetpackState {
  let { x, y, vx, vy, boostLeft, cooldown } = s;
  cooldown = Math.max(0, cooldown - dt);
  boostLeft = Math.max(0, boostLeft - dt);
  if (input.boost && cooldown === 0 && boostLeft === 0 && (input.x || input.y)) {
    boostLeft = p.boostTime;
    cooldown = p.boostTime + p.boostCooldown;
  }
  const boosting = boostLeft > 0;

  // Normalize diagonal input so diagonals are not faster.
  let ix = input.x;
  let iy = input.y;
  const len = Math.hypot(ix, iy);
  if (len > 1) {
    ix /= len;
    iy /= len;
  }
  const accel = boosting ? p.boostThrust : p.thrust;
  vx += ix * accel * dt;
  vy += iy * accel * dt;

  // Inertia: velocity decays smoothly, a little faster when no thrust is applied.
  const decay = Math.exp(-p.damping * (len > 0 ? 0.6 : 1) * dt);
  vx *= decay;
  vy *= decay;

  // Soft speed cap.
  const cap = boosting ? p.boostSpeed : p.maxSpeed;
  const speed = Math.hypot(vx, vy);
  if (speed > cap) {
    const k = 1 - Math.min(1, 6 * dt) * (1 - cap / speed);
    vx *= k;
    vy *= k;
  }

  x += vx * dt;
  y += vy * dt;

  // Soft world bounds: push back instead of an invisible hard wall.
  const b = p.bounds;
  if (x < b.minX) vx += (b.minX - x) * 4 * dt;
  if (x > b.maxX) vx -= (x - b.maxX) * 4 * dt;
  if (y < b.minY) vy += (b.minY - y) * 4 * dt;
  if (y > b.maxY) vy -= (y - b.maxY) * 4 * dt;

  return { x, y, vx, vy, boostLeft, cooldown };
}

/** Pushes the state out of a circle (asteroid, station hull) and removes inward velocity. */
export function collideCircle(s: JetpackState, cx: number, cy: number, r: number): JetpackState {
  const dx = s.x - cx;
  const dy = s.y - cy;
  const d = Math.hypot(dx, dy);
  if (d >= r || d === 0) return s;
  const nx = dx / d;
  const ny = dy / d;
  const inward = s.vx * nx + s.vy * ny;
  return {
    ...s,
    x: cx + nx * r,
    y: cy + ny * r,
    vx: inward < 0 ? s.vx - inward * nx * 1.3 : s.vx,
    vy: inward < 0 ? s.vy - inward * ny * 1.3 : s.vy,
  };
}
