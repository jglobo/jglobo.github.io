import { test } from 'node:test';
import assert from 'node:assert/strict';
import { collideCircle, DEFAULT_JETPACK, flightStateFor, initialJetpack, stepJetpack } from '../src/worlds/data-science/JetpackController.ts';
import { readFileSync } from 'node:fs';

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

test('flight input picks the astronaut clip, and the model has every clip', () => {
  assert.equal(flightStateFor({ thrustX: 0, thrustY: 0, boosting: false }), 'hover');
  assert.equal(flightStateFor({ thrustX: 1, thrustY: 0, boosting: false }), 'right');
  assert.equal(flightStateFor({ thrustX: -1, thrustY: 0, boosting: false }), 'left');
  assert.equal(flightStateFor({ thrustX: 0, thrustY: 1, boosting: false }), 'up');
  assert.equal(flightStateFor({ thrustX: 0, thrustY: -1, boosting: false }), 'down');
  assert.equal(flightStateFor({ thrustX: 1, thrustY: 1, boosting: false }), 'right');
  assert.equal(flightStateFor({ thrustX: 1, thrustY: 0, boosting: true }), 'boost');
  assert.equal(flightStateFor({ thrustX: 0, thrustY: 0, boosting: true }), 'hover');
  // The GLB's JSON chunk lists its animations.
  const glb = readFileSync(new URL('../src/worlds/data-science/assets/astronaut.glb', import.meta.url));
  const json = JSON.parse(glb.subarray(20, 20 + glb.readUInt32LE(12)).toString('utf8'));
  const clips = json.animations.map((a: { name: string }) => a.name);
  for (const c of ['Hover', 'Fly_Up', 'Fly_Down', 'Fly_Left', 'Fly_Right', 'Boost']) assert.ok(clips.includes(c), c);
});

test("Jose's portal gun has its Fire clip and Muzzle socket, and the portal its Open clip", () => {
  const read = (name: string) => {
    const glb = readFileSync(new URL(`../src/worlds/hub/assets/${name}`, import.meta.url));
    return JSON.parse(glb.subarray(20, 20 + glb.readUInt32LE(12)).toString('utf8'));
  };
  const gun = read('portal_gun.glb');
  assert.ok(gun.animations.some((a: { name: string }) => a.name === 'Fire'));
  assert.ok(gun.nodes.some((n: { name: string }) => n.name === 'Muzzle'));
  assert.ok(read('portal.glb').animations.some((a: { name: string }) => a.name === 'Open'));
});
