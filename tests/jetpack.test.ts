import { test } from 'node:test';
import assert from 'node:assert/strict';
import { collideCircle, DEFAULT_JETPACK, initialJetpack, stepJetpack } from '../src/worlds/data-science/JetpackController.ts';

const run = (input: { x: number; y: number; boost: boolean }, seconds: number, s = initialJetpack()) => {
  for (let t = 0; t < seconds; t += 1 / 60) s = stepJetpack(s, input, 1 / 60);
  return s;
};

test('thrust accelerates and speed stays near the cap', () => {
  const s = run({ x: 1, y: 0, boost: false }, 5);
  assert.ok(s.vx > DEFAULT_JETPACK.maxSpeed * 0.8, `vx ${s.vx}`);
  assert.ok(s.vx <= DEFAULT_JETPACK.maxSpeed * 1.1, `vx ${s.vx}`);
});

test('inertia: the astronaut keeps drifting, then slows down', () => {
  const moving = run({ x: 1, y: 0, boost: false }, 2);
  const drift = run({ x: 0, y: 0, boost: false }, 0.3, moving);
  assert.ok(drift.vx > moving.vx * 0.5, 'still drifting shortly after release');
  const stopped = run({ x: 0, y: 0, boost: false }, 6, moving);
  assert.ok(Math.abs(stopped.vx) < 0.1, `eventually nearly stops (${stopped.vx})`);
});

test('diagonals are not faster than straight lines', () => {
  const straight = run({ x: 1, y: 0, boost: false }, 1);
  const diag = run({ x: 1, y: 1, boost: false }, 1);
  assert.ok(Math.hypot(diag.vx, diag.vy) <= Math.hypot(straight.vx, straight.vy) * 1.01);
});

test('boost is faster and has a cooldown', () => {
  let s = stepJetpack(initialJetpack(), { x: 1, y: 0, boost: true }, 1 / 60);
  assert.ok(s.boostLeft > 0 && s.cooldown > 0);
  s = run({ x: 1, y: 0, boost: true }, 0.4, s);
  assert.ok(s.vx > DEFAULT_JETPACK.maxSpeed, `boosted vx ${s.vx}`);
  const after = run({ x: 1, y: 0, boost: false }, 0.5, s);
  const retry = stepJetpack(after, { x: 1, y: 0, boost: true }, 1 / 60);
  assert.equal(retry.boostLeft, 0, 'boost unavailable during cooldown');
});

test('soft bounds push the astronaut back', () => {
  const s = run({ x: 0, y: 0, boost: false }, 1, { ...initialJetpack(80, 0) });
  assert.ok(s.vx < 0);
});

test('circle collision pushes out and cancels inward velocity', () => {
  const s = collideCircle({ ...initialJetpack(1, 0), vx: -5 }, 0, 0, 3);
  assert.equal(s.x, 3);
  assert.ok(s.vx >= 0);
});
