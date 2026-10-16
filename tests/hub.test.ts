import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Vector3 } from 'three';
import {
  BASIN, BRIDGE_EMITTER, CHASM, DROPPER, LASER, PIT, PORTAL_CENTER_Y, SURFACES, TARGET, bridgeSpans, collidePlayer, dropBall, floorAt,
  mapDir, mapPoint, overlaps, snapPortal, stepBall, surfaceById, traceBeam, v3, type Portals,
} from '../src/worlds/hub/chamber.ts';

const place = (id: string, at: [number, number, number]) => snapPortal(surfaceById(id)!, new Vector3(...at))!;

test('every portal surface can hold a portal', () => {
  for (const s of SURFACES) {
    const f = snapPortal(s, v3(s.center));
    assert.ok(f, s.id);
    if (s.kind === 'wall') assert.ok(Math.abs(f.pos.y - PORTAL_CENTER_Y) < 1e-6, `${s.id} portal stands on the floor`);
  }
});

test('portals map points and directions mirror-wise, and round-trip', () => {
  const a = place('north-e', [6, 2, -14]);
  const b = place('west-s', [-14, 2, 5]);
  const p = new Vector3(6.3, 1.1, -13.5);
  const back = mapPoint(b, a, mapPoint(a, b, p));
  assert.ok(back.distanceTo(p) < 1e-9);
  // Walking north into the north wall comes out of the west wall heading east.
  const d = mapDir(a, b, new Vector3(0, 0, -1));
  assert.ok(d.distanceTo(new Vector3(1, 0, 0)) < 1e-9);
});

test('two portals cannot overlap on one panel', () => {
  const a = place('north-e', [6, 2, -14]);
  assert.ok(overlaps(place('north-e', [6.5, 2, -14]), a));
  assert.ok(!overlaps(place('north-e', [9.5, 2, -14]), a));
});

test('applications puzzle: the laser reaches the target only through the portals', () => {
  const none: Portals = { blue: null, orange: null };
  assert.equal(traceBeam(v3(LASER.origin), v3(LASER.dir), none, { target: true }).hitTarget, false);
  const solved: Portals = { blue: place('west-n', [-14, 1, LASER.origin[2]]), orange: place('west-s', [-14, 1, TARGET.center[2]]) };
  const beam = traceBeam(v3(LASER.origin), v3(LASER.dir), solved, { target: true });
  assert.equal(beam.hitTarget, true);
  assert.equal(beam.segments.length, 2);
  // Swapping the colours works too: the portals are a linked pair.
  assert.equal(traceBeam(v3(LASER.origin), v3(LASER.dir), { blue: solved.orange, orange: solved.blue }, { target: true }).hitTarget, true);
});

test('journey puzzle: the light bridge spans the chasm from the bridge wall', () => {
  const portals: Portals = { blue: place('east-s', [14, 1, BRIDGE_EMITTER.origin[2]]), orange: place('bridge-wall', [-4, 1, 8.2]) };
  const spans = bridgeSpans(traceBeam(v3(BRIDGE_EMITTER.origin), v3(BRIDGE_EMITTER.dir), portals));
  const x = portals.orange!.pos.x;
  for (let z = CHASM.minZ + 0.05; z < CHASM.maxZ; z += 0.25) assert.ok(floorAt(x, z, portals, spans) > -1, `bridge at z=${z.toFixed(2)}`);
  assert.equal(floorAt(x + 2, 10.5, portals, spans), -Infinity, 'beside the bridge is still the chasm');
  assert.equal(floorAt(x, 10.5, portals, []), -Infinity, 'no bridge, no crossing');
});

test('games puzzle: the ball lands in the basin through a wall or ceiling portal, and misses without', () => {
  const run = (portals: Portals) => {
    const b = dropBall();
    for (let i = 0; i < 1200 && b.state === 'flying'; i++) if (stepBall(b, 1 / 120, portals)) return true;
    return false;
  };
  assert.equal(run({ blue: null, orange: null }), false);
  const floor = place('platform', [DROPPER.x, 0, DROPPER.z]);
  assert.equal(run({ blue: floor, orange: place('north-e', [BASIN.x, 1, -14]) }), true, 'wall portal behind the basin');
  assert.equal(run({ blue: floor, orange: place('ceiling-basin', [BASIN.x, 9, BASIN.z]) }), true, 'ceiling portal above the basin');
  assert.equal(run({ blue: floor, orange: place('north-e', [10, 1, -14]) }), false, 'portal off to the side');
});

test('data science puzzle: the ceiling portal is over the pit', () => {
  const f = place('ceiling-pit', [12, 9, 2]);
  assert.ok(f.pos.x > PIT.minX && f.pos.x < PIT.maxX && f.pos.z > PIT.minZ && f.pos.z < PIT.maxZ);
  assert.equal(floorAt(f.pos.x, f.pos.z, { blue: null, orange: null }), -Infinity);
});

test('the pit rails and the room walls hold the player in, a wall portal lets them through', () => {
  const none: Portals = { blue: null, orange: null };
  const [x] = collidePlayer(11, 0, { feet: 0, portals: none, openDoors: [] });
  assert.ok(x < PIT.minX, 'rail keeps you out of the pit');
  const [xf] = collidePlayer(12, 0, { feet: 0.5, portals: none, openDoors: [], falling: true });
  assert.equal(xf, 12, 'someone dropping in from the ceiling is not pushed back out');
  const [, z] = collidePlayer(6, -14.3, { feet: 0, portals: none, openDoors: [] });
  assert.ok(z > -14);
  const portals: Portals = { blue: place('north-e', [6, 1, -14]), orange: place('west-s', [-14, 1, 5]) };
  const [, z2] = collidePlayer(portals.blue!.pos.x, -14.3, { feet: 0, portals, openDoors: [] });
  assert.ok(z2 < -14, 'the wall gives way inside the portal');
});
