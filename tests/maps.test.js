import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadMap, validateMap } from '../src/logic/map.js';
import { createGame, suggestStarts } from '../src/logic/game.js';
import { reachable } from '../src/logic/movement.js';
import { updateMemory } from '../src/logic/vision.js';
import { PLAYER_COLORS } from '../src/config.js';

const index = JSON.parse(readFileSync('maps/index.json', 'utf8'));
const load = e => loadMap(JSON.parse(readFileSync(`maps/${e.file}`, 'utf8')));

test('every indexed map loads, validates and matches index', () => {
  assert.equal(index.length, 3);
  for (const e of index) {
    const m = load(e);
    assert.deepEqual(validateMap(m), [], e.id);
    assert.equal(m.meta.id, e.id); assert.equal(m.starts.length, e.players.max);
    assert.equal(m.meta.width, e.width); assert.equal(m.meta.height, e.height);
  }
});
test('player counts 2 / 4 / 16', () => assert.deepEqual(index.map(e => e.players.max), [2, 4, 16]));
test('archipel supports 16 players: game starts, every player has units', () => {
  const m = load(index.find(e => e.id === 'archipel'));
  const players = PLAYER_COLORS.map((color, i) => ({ name: 'P' + i, color }));
  const s = createGame(m, players, { seed: 1, startSlots: suggestStarts(m, 16, 1) });
  for (let p = 0; p < 16; p++) assert.ok(Object.values(s.units).some(u => u.owner === p), 'player ' + p);
});
test('every start can move somewhere (not walled in)', () => {
  for (const e of index) {
    const m = load(e);
    const players = m.starts.map((_, i) => ({ name: 'P' + i, color: PLAYER_COLORS[i] }));
    const s = createGame(m, players, { seed: 1, startSlots: m.starts.map((_, i) => i) });
    for (const u of Object.values(s.units)) { s.current = u.owner; updateMemory(s, u.owner); assert.ok(Object.keys(reachable(s, u.id)).length, `${e.id} ${u.type}@${u.at}`); }
  }
});
test('every bundled map offers soccer field, dojo, rugby field and outdoor shop', () => {
  for (const e of index) {
    const types = Object.values(load(e).tiles).map(t => t.building);
    assert.ok(types.includes('soccer'), `${e.id}: Fußballplatz fehlt`);
    assert.ok(types.includes('dojo'), `${e.id}: Dojo fehlt`);
    assert.ok(types.includes('rugby'), `${e.id}: Rugbyplatz fehlt`);
    assert.ok(types.includes('outdoor'), `${e.id}: Outdoor-Geschäft fehlt`);
    for (const b of ['pool', 'physio', 'tabletennis']) assert.ok(types.includes(b), `${e.id}: ${b} fehlt`);
  }
});
test('every pool is on the coast (next to water) so swimmers can reach it', async () => {
  const { neighbors } = await import('../src/logic/hex.js');
  const { TERRAIN } = await import('../src/config.js');
  let pools = 0;
  for (const e of index) {
    const m = load(e);
    for (const [k, t] of Object.entries(m.tiles)) if (t.building === 'pool') {
      pools++;
      assert.ok(neighbors(k, m.meta.width, m.meta.height).some(n => TERRAIN[m.tiles[n].terrain].flags.includes('water')), `${e.id} pool@${k}`);
    }
  }
  assert.ok(pools >= 3);
});
