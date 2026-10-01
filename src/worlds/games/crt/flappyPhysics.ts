// Flappy Bird physics, kept free of imports so it can be unit tested.
export const FLAPPY = { W: 640, H: 480, GROUND: 480 - 56, GRAVITY: 1250, FLAP: -390, PIPE_W: 70, PIPE_SPEED: 150, SPACING: 230 };
const { GROUND, GRAVITY, FLAP, PIPE_W, PIPE_SPEED } = FLAPPY;
export interface FlappyState {
  y: number;
  vy: number;
  pipes: { x: number; gapY: number; gap: number; scored?: boolean }[];
  score: number;
  dead: boolean;
}

/** Pure physics step, exported for tests. Returns true when a pipe was passed. */
export function stepFlappy(s: FlappyState, dt: number, flap: boolean, birdX = 160, radius = 14): boolean {
  if (s.dead) return false;
  if (flap) s.vy = FLAP;
  s.vy += GRAVITY * dt;
  s.y += s.vy * dt;
  let scored = false;
  for (const p of s.pipes) {
    p.x -= PIPE_SPEED * dt;
    if (!p.scored && p.x + PIPE_W < birdX - radius) {
      p.scored = true;
      s.score++;
      scored = true;
    }
    const inX = birdX + radius > p.x && birdX - radius < p.x + PIPE_W;
    const inGap = s.y - radius > p.gapY - p.gap / 2 && s.y + radius < p.gapY + p.gap / 2;
    if (inX && !inGap) s.dead = true;
  }
  if (s.y + radius >= GROUND || s.y - radius <= 0) s.dead = true;
  return scored;
}

