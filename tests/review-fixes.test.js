import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, apply } from '../src/logic/game.js';
import { validateMap, uniqueMapId } from '../src/logic/map.js';
import { knownOwner } from '../src/logic/vision.js';
import { mapFrom, gameFrom, place } from './helpers.js';

const two = [{ name: 'A', color: '#e63946' }, { name: 'B', color: '#2f6fd6' }];

test('createGame rejects a semantically broken map with a readable message', () => {
  const m = mapFrom(['GGG'], { starts: [{ at: '0,0', units: ['jogger'], facilities: ['1,0'] }, { at: '2,0', units: ['jogger'], facilities: [] }] });
  assert.throws(() => createGame(m, two, { seed: 1, startSlots: [0, 1] }), /Sportstätte/);
});
test('validateMap: start point on impassable terrain', () => {
  const m = mapFrom(['WGG'], { starts: [{ at: '0,0', units: ['jogger'], facilities: [] }, { at: '2,0', units: ['jogger'], facilities: [] }] });
  assert.ok(validateMap(m).some(e => /begehbar/.test(e)));
});
test('knownOwner: fogged facility shows last seen owner, visible shows live owner', () => {
  const s = gameFrom(Array(12).fill('G'.repeat(12)), { buildings: { '4,2': 'tennis' } });
  const u = place(s, 'jogger', 0, '2,2');
  s.lastSeen[0]['4,2'] = null;
  s.facilities['4,2'].owner = 1;
  assert.equal(knownOwner(s, 0, '4,2'), 1);       // visible: live
  u.at = '11,11';
  s.facilities['4,2'].owner = 0; s.facilities['4,2'].owner = 1; s.lastSeen[0]['4,2'] = null;
  assert.equal(knownOwner(s, 0, '4,2'), null);    // fogged: last seen
});
test('produce with the type already running keeps progress', () => {
  let s = gameFrom(['GGG'], { buildings: { '1,0': 'tennis' } }); s.facilities['1,0'].owner = 0; place(s, 'jogger', 1, '2,0');
  s = apply(s, { type: 'produce', at: '1,0', unitType: 'tennis' }).state;
  s.facilities['1,0'].progress = 1;
  s = apply(s, { type: 'produce', at: '1,0', unitType: 'tennis' }).state;
  assert.equal(s.facilities['1,0'].progress, 1);
});
test('uniqueMapId appends a suffix when taken', () => {
  assert.equal(uniqueMapId('insel', []), 'insel');
  assert.equal(uniqueMapId('insel', ['insel']), 'insel-2');
  assert.equal(uniqueMapId('insel', ['insel', 'insel-2']), 'insel-3');
});
