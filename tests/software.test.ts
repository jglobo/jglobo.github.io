import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BUILDINGS, RAMPS, collide, groundAt } from '../src/worlds/software/layout.ts';
import { SPECS, initialVehicle, speedOf, stepVehicle, type VehicleInput, type VehicleState } from '../src/worlds/software/vehicles/vehiclePhysics.ts';

const none: VehicleInput = { throttle: 0, steer: 0, handbrake: false, jump: false };
const run = (s: VehicleState, spec: string, input: Partial<VehicleInput>, seconds: number, dt = 1 / 60) => {
  for (let t = 0; t < seconds; t += dt) s = stepVehicle(s, SPECS[spec], { ...none, ...input }, dt);
  return s;
};

test('car accelerates on the road up to its top speed and coasts down', () => {
  // The north road of the loop runs along z = -26.
  let s = initialVehicle(-20, -26, Math.PI / 2); // facing east
  s = run(s, 'sports-car', { throttle: 1 }, 2);
  assert.ok(speedOf(s) > 15, `speed ${speedOf(s)}`);
  assert.ok(s.x > -20);
  s = run(s, 'sports-car', {}, 6);
  assert.ok(speedOf(s) < 12);
});

test('steering turns the car and the handbrake makes it slide', () => {
  let s = initialVehicle(-20, -26, Math.PI / 2);
  s = run(s, 'sports-car', { throttle: 1 }, 1.5);
  const grip = run({ ...s }, 'sports-car', { throttle: 1, steer: 1 }, 0.6);
  const drift = run({ ...s }, 'sports-car', { throttle: 1, steer: 1, handbrake: true }, 0.6);
  assert.ok(grip.heading > s.heading + 0.3);
  assert.ok(drift.drifting, 'handbrake turn should drift');
});

test('bicycle jumps and lands; a full spin in the air counts as a trick', () => {
  let s = initialVehicle(-20, -26, Math.PI / 2);
  s = stepVehicle(s, SPECS.bicycle, { ...none, jump: true }, 1 / 60);
  assert.equal(s.grounded, false);
  let spins = 0;
  for (let i = 0; i < 120 && !s.grounded; i++) {
    s = stepVehicle(s, SPECS.bicycle, { ...none, steer: 1 }, 1 / 60);
    spins = Math.max(spins, s.landedSpins);
  }
  assert.equal(s.grounded, true);
  assert.ok(spins >= 1, 'expected a 360');
});

test('ramps raise the ground and launch fast vehicles', () => {
  const r = RAMPS[0];
  assert.equal(groundAt(r.x - 1, r.z), 0);
  assert.ok(Math.abs(groundAt(r.x + r.length, r.z) - r.height) < 1e-9);
  let s = initialVehicle(r.x - 12, r.z, Math.PI / 2);
  let flew = false;
  for (let i = 0; i < 240; i++) {
    s = stepVehicle(s, SPECS['sports-car'], { ...none, throttle: 1 }, 1 / 60);
    if (!s.grounded && s.y > r.height * 0.5) flew = true;
  }
  assert.ok(flew, 'car should leave the ramp top');
});

test('buildings block movement', () => {
  const b = BUILDINGS[0];
  const p = collide((b.minX + b.maxX) / 2, b.maxZ - 0.2, 1);
  assert.ok(p.hit);
  assert.ok(p.z >= b.maxZ + 1 - 1e-9);
});
