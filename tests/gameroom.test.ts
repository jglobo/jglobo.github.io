import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BEANBAG, FURNITURE, PLAYER_RADIUS, ROOM, collide, inReturnPortal } from '../src/worlds/games/layout.ts';
import { stepFlappy, type FlappyState } from '../src/worlds/games/crt/flappyPhysics.ts';

test('player stays inside the room walls', () => {
  const p = collide({ x: 10, z: -10 });
  assert.equal(p.x, ROOM.halfX - PLAYER_RADIUS);
  assert.equal(p.z, -ROOM.halfZ + PLAYER_RADIUS);
});

test('player is pushed out of furniture', () => {
  const bed = FURNITURE.bed;
  const p = collide({ x: bed.maxX - 0.05, z: (bed.minZ + bed.maxZ) / 2 });
  assert.ok(p.x >= bed.maxX + PLAYER_RADIUS - 1e-9, `x=${p.x}`);
  const q = collide({ x: BEANBAG.x + 0.1, z: BEANBAG.z });
  assert.ok(Math.hypot(q.x - BEANBAG.x, q.z - BEANBAG.z) >= BEANBAG.r + PLAYER_RADIUS - 1e-9);
});

test('only the portal lane reaches the back wall', () => {
  const lane = collide({ x: 0, z: ROOM.halfZ });
  assert.ok(inReturnPortal(lane));
  const side = collide({ x: -1.5, z: ROOM.halfZ });
  assert.ok(!inReturnPortal(side));
});

test('flappy: gravity pulls down, flap goes up, pipes score and kill', () => {
  const s: FlappyState = { y: 200, vy: 0, pipes: [], score: 0, dead: false };
  stepFlappy(s, 0.1, false);
  assert.ok(s.y > 200);
  const y = s.y;
  stepFlappy(s, 0.05, true);
  assert.ok(s.y < y);

  const pass: FlappyState = { y: 200, vy: 0, pipes: [{ x: 60, gapY: 200, gap: 200 }], score: 0, dead: false };
  assert.equal(stepFlappy(pass, 0.01, false), true);
  assert.equal(pass.score, 1);

  const crash: FlappyState = { y: 60, vy: 0, pipes: [{ x: 150, gapY: 300, gap: 120 }], score: 0, dead: false };
  stepFlappy(crash, 0.01, false);
  assert.equal(crash.dead, true);
});
