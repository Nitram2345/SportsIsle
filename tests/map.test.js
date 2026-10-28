import test from 'node:test';
import assert from 'node:assert/strict';
import { TERRAIN, UNITS, BUILDINGS, SPECIALS, PLAYER_COLORS, RULES } from '../src/config.js';
import { loadMap, saveMap, validateMap, canPlace, createEmptyMap } from '../src/logic/map.js';
import { mapFrom } from './helpers.js';

test('config: every unit blockedBy flag exists on some terrain or is "building"', () => {
  const flags = new Set(Object.values(TERRAIN).flatMap(t => t.flags));
  for (const u of Object.values(UNITS)) for (const f of u.blockedBy) assert.ok(f === 'building' || flags.has(f), f);
});
test('config: produced unit types exist, 16 distinct colors, rules from spec', () => {
  for (const b of Object.values(BUILDINGS)) for (const u of b.produces) assert.ok(UNITS[u], u);
  assert.equal(new Set(PLAYER_COLORS).size, 16);
  assert.deepEqual(RULES, { unitCap: 50, slowdownFrom: 30, slowdownStep: 5, maxPlayers: 16 });
  for (const s of Object.values(SPECIALS)) assert.equal(s.turns, 3);
});
test('createEmptyMap is all grass without starts', () => {
  const m = createEmptyMap({ id: 'x', name: 'X', author: 'a', width: 3, height: 2 });
  assert.equal(Object.keys(m.tiles).length, 6);
  assert.ok(Object.values(m.tiles).every(t => t.terrain === 'grass' && !t.road && !t.building && !t.special));
  assert.deepEqual(m.starts, []);
});
test('saveMap/loadMap round trip', () => {
  const m = mapFrom(['GGFM', 'GHGW'], { roads: ['1,0'], buildings: { '2,1': 'golf' }, specials: { '0,1': 'sprint' },
    starts: [{ at: '0,0', units: ['golfer'], facilities: ['2,1'] }, { at: '3,0', units: ['jogger'], facilities: [] }] });
  assert.deepEqual(loadMap(JSON.parse(JSON.stringify(saveMap(m)))), m);
});
test('saveMap writes terrain rows as chars', () => assert.deepEqual(saveMap(mapFrom(['GF', 'MW'])).terrain, ['GF', 'MW']));
test('validateMap ok', () => assert.deepEqual(validateMap(mapFrom(['GGGG'])), []));
test('validateMap: fewer than 2 starts', () => assert.ok(validateMap(mapFrom(['GG'], { starts: [{ at: '0,0', units: ['jogger'], facilities: [] }] })).length));
test('validateMap: start without units and facilities', () => {
  assert.ok(validateMap(mapFrom(['GGG'], { starts: [{ at: '0,0', units: [], facilities: [] }, { at: '2,0', units: ['jogger'], facilities: [] }] })).length);
});
test('validateMap: building on mountain/sea/moor/river', () => {
  for (const ch of 'MWBR') assert.ok(validateMap(mapFrom(['G' + ch + 'G'], { buildings: { '1,0': 'park' } })).length, ch);
});
test('validateMap: start facility must be a capturable building', () => {
  assert.ok(validateMap(mapFrom(['GGG'], { buildings: { '1,0': 'house' },
    starts: [{ at: '0,0', units: [], facilities: ['1,0'] }, { at: '2,0', units: ['jogger'], facilities: [] }] })).length);
});
test('canPlace', () => { assert.equal(canPlace({ terrain: 'mountain' }, 'golf'), false); assert.equal(canPlace({ terrain: 'grass' }, 'park'), true); });
// Review Focus 4
test('loadMap rejects broken files with messages', () => {
  const ok = saveMap(mapFrom(['GG']));
  for (const bad of [{}, { format: 2 }, { ...ok, terrain: ['G'] }, { ...ok, terrain: ['GX'] },
    { ...ok, buildings: [{ at: [9, 9], type: 'golf' }] }, { ...ok, buildings: [{ at: [0, 0], type: 'castle' }] },
    { ...ok, specials: [{ at: [0, 0], type: 'nope' }] }, { ...ok, starts: [{ at: [0, 0], units: ['ninja'], facilities: [] }] }, null, 'x'])
    assert.throws(() => loadMap(bad), /./, JSON.stringify(bad));
});
