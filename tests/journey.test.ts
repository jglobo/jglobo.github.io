import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildLayout, collide, pathX, HOUSE, SPAWN, JOSE_SPOT, PORTAL_SPOT, type StopInput } from '../src/worlds/journey/layout.ts';
import { HUMAN_FRAMES, HUMAN_H, HUMAN_W, LOOKS, OUTLINE, humanAtlas, humanGrid, robotAtlas, robotGrid, stylize, dogAtlas, DOG_LOOK, DOG_FRAMES, DOG_W } from '../src/worlds/journey/sprites/pixelArt.ts';
import { GOODBYE, menuFor, moveSelection, visibleChars } from '../src/worlds/journey/dialogue.ts';

const json = (p: string) => JSON.parse(readFileSync(new URL(`../src/content/${p}`, import.meta.url), 'utf8'));
const journey = json('journey.json');
const education = json('education.json');
const experience = json('experience.json');
const dialogue = json('dialogue.json');
const layout = buildLayout(journey.stops as StopInput[]);

test('timeline stops run north in content order, alternating sides of the path', () => {
  for (let i = 1; i < layout.stops.length; i++) {
    assert.ok(layout.stops[i].door.z < layout.stops[i - 1].door.z, 'later chapters are further up the path');
    assert.notEqual(layout.stops[i].side, layout.stops[i - 1].side);
  }
  assert.ok(layout.plaza.z < layout.stops.at(-1)!.door.z, 'the plaza is past the last chapter');
});

test('every chapter points at real education and experience entries', () => {
  const ids = new Set([...education, ...experience].map((e: { id: string }) => e.id));
  const used = new Set<string>();
  for (const s of journey.stops) {
    for (const id of [...(s.education ?? []), ...(s.experience ?? [])]) {
      assert.ok(ids.has(id), `${s.id} -> ${id}`);
      used.add(id);
    }
    assert.ok(s.story.length > 20);
  }
  assert.equal(used.size, ids.size, 'every job and school appears somewhere in the town');
});

test('doors, spawn, Jose and the portal are reachable (not inside anything)', () => {
  for (const p of [SPAWN, JOSE_SPOT, PORTAL_SPOT, ...layout.stops.map((s) => s.door), layout.plaza]) {
    const c = collide(layout, p.x, p.z, 0.38);
    assert.ok(Math.hypot(c.x - p.x, c.z - p.z) < 0.05, `${p.x},${p.z} pushed to ${c.x},${c.z}`);
  }
});

test('collision keeps the visitor out of buildings and inside the town', () => {
  const inHouse = collide(layout, HOUSE.cx, HOUSE.cz, 0.38);
  assert.ok(inHouse.hit);
  assert.ok(Math.abs(inHouse.x - HOUSE.cx) >= HOUSE.w / 2 || Math.abs(inHouse.z - HOUSE.cz) >= HOUSE.d / 2);
  const s = layout.stops[2];
  const inside = collide(layout, s.cx, s.cz, 0.38);
  assert.ok(inside.hit && (Math.abs(inside.x - s.cx) >= s.w / 2 || Math.abs(inside.z - s.cz) >= s.d / 2));
  const edge = collide(layout, pathX(-40) + 60, -40, 0.38);
  assert.ok(edge.hit && edge.x < pathX(-40) + 25);
  // Walking straight up the path from home to the plaza never gets blocked.
  let x = pathX(10);
  for (let z = 10; z > layout.plaza.z; z -= 0.25) {
    const c = collide(layout, pathX(z), z, 0.38);
    assert.ok(Math.abs(c.x - pathX(z)) < 0.01 && Math.abs(c.z - z) < 0.01, `blocked at z=${z}`);
    x = c.x;
  }
  assert.ok(Number.isFinite(x));
});

test('pixel-art sprites: atlas size, outline and readable frames', () => {
  const a = robotAtlas();
  assert.ok(stylize(robotGrid('down1'))[HUMAN_H - 1].some((c) => c !== null), 'robot stands on the bottom row');
  assert.equal(humanAtlas(LOOKS.wife).width, HUMAN_W * HUMAN_FRAMES.length);
  assert.equal(a.width, HUMAN_W * HUMAN_FRAMES.length);
  assert.equal(a.height, HUMAN_H);
  const g = stylize(humanGrid(LOOKS.jose, 'down0'));
  assert.ok(g.flat().includes(OUTLINE));
  assert.ok(g[HUMAN_H - 1].some((c) => c !== null), 'feet touch the bottom row');
  assert.notDeepEqual(humanGrid(LOOKS.jose, 'side1'), humanGrid(LOOKS.jose, 'side2'), 'walk frames differ');
  const d = dogAtlas(DOG_LOOK);
  assert.equal(d.width, DOG_W * DOG_FRAMES.length);
  // Fully transparent pixels exist around the character (alpha test works).
  assert.ok(a.data.some((v, i) => i % 4 === 3 && v === 0));
});

test('dialogue menu lists every question then goodbye, and the typewriter finishes', () => {
  const menu = menuFor(dialogue, [dialogue[0].question]);
  assert.equal(menu.length, dialogue.length + 1);
  assert.equal(menu.at(-1)!.id, GOODBYE);
  assert.ok(menu[0].asked && !menu[1].asked);
  assert.equal(moveSelection(0, -1, menu.length), menu.length - 1);
  assert.equal(moveSelection(menu.length - 1, 1, menu.length), 0);
  const text = dialogue[1].answer;
  assert.equal(visibleChars(text, 0), 0);
  assert.equal(visibleChars(text, 100), text.length);
});
