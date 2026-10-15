import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { BILLBOARD_POST_HALF, BILLBOARD_SPOTS, BUILDINGS, ROADS } from '../src/worlds/software/layout.ts';

const dir = new URL('../src/content/', import.meta.url);
const projects = ['data-science', 'games', 'software', 'journey']
  .filter((c) => existsSync(new URL(c, dir)))
  .flatMap((c) => readdirSync(new URL(c, dir)).filter((f) => f.endsWith('.json')).map((f) => JSON.parse(readFileSync(new URL(`${c}/${f}`, dir), 'utf8'))));

test('every project has a unique id, a place to read about it, and real screenshot files', () => {
  const ids = new Set<string>();
  for (const p of projects) {
    assert.ok(!ids.has(p.id), `duplicate id ${p.id}`);
    ids.add(p.id);
    assert.equal(p.category, p.world, p.id);
    assert.ok(p.githubUrl || p.demoUrl || p.downloadUrl || p.id === 'zelda-rpg' || p.id === 'portal-hub', `${p.id} has no link`);
    for (const s of p.screenshots) assert.ok(existsSync(new URL(`../${s}`, import.meta.url)), `${p.id}: missing ${s}`);
  }
});

test('every world has room for all of its projects', () => {
  const count = (c: string) => projects.filter((p) => p.category === c).length;
  // GameShelf: 4 boxes per board, 2 boards.
  assert.ok(count('games') <= 8, `${count('games')} games`);
  assert.ok(count('software') <= BILLBOARD_SPOTS.length, `${count('software')} software projects`);
  // Data science: each project names a site that exists.
  const src = readFileSync(new URL('../src/worlds/data-science/ProjectSites.tsx', import.meta.url), 'utf8');
  for (const p of projects.filter((p) => p.category === 'data-science')) {
    assert.ok(src.includes(`id: '${p.location}'`), `${p.id}: no site ${p.location}`);
  }
});

test('billboard posts stand clear of roads and buildings, and their pads are reachable', () => {
  const inside = (x: number, z: number, b: { minX: number; maxX: number; minZ: number; maxZ: number }, pad = 0) =>
    x > b.minX - pad && x < b.maxX + pad && z > b.minZ - pad && z < b.maxZ + pad;
  for (const s of BILLBOARD_SPOTS) {
    for (const px of [s.x - BILLBOARD_POST_HALF, s.x + BILLBOARD_POST_HALF]) {
      for (const b of [...ROADS, ...BUILDINGS]) assert.ok(!inside(px, s.z, b, 0.5), `${s.label}: post at ${px} hits a road or building`);
    }
    for (const b of BUILDINGS) assert.ok(!inside(s.x, s.z + 3, b, 2.6), `${s.label}: pad inside a building`);
  }
});
