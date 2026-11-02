import test from 'node:test';
import assert from 'node:assert/strict';
import { apply } from '../src/logic/game.js';
import { reachable } from '../src/logic/movement.js';
import { ramTargets } from '../src/logic/ram.js';
import { gameFrom, place, exploreAll } from './helpers.js';

// row 0: W W G G G G / row 1: W W W G G G – 2,0 is at the water, 4,0 is one tile inland
const setup = (buildings = { '2,0': 'tennis', '4,0': 'golf' }) => {
  const s = gameFrom(['WWGGGG', 'WWWGGG'], { buildings }); exploreAll(s, 0); exploreAll(s, 1); return s;
};

test('canoe lands on a facility right at the water and captures it; the trip ends there', () => {
  let s = setup(); const c = place(s, 'canoe1', 0, '0,0'); place(s, 'swimmer', 1, '5,1');
  assert.deepEqual(reachable(s, c.id)['2,0'], ['1,0', '2,0']);
  const r = apply(s, { type: 'move', unitId: c.id, path: ['1,0', '2,0'] }); s = r.state;
  assert.equal(s.units[c.id].at, '2,0'); assert.equal(s.units[c.id].movesLeft, 0);
  assert.equal(s.facilities['2,0'].owner, 0);
  assert.ok(r.events.some(e => e.type === 'captured' && e.at === '2,0'));
});
test('no landing on plain shore, inland facilities or houses', () => {
  const s = setup({ '2,0': 'house', '4,0': 'golf' }); const c = place(s, 'canoe1', 0, '0,0'); place(s, 'swimmer', 1, '5,1');
  const r = reachable(s, c.id);
  assert.equal(r['2,0'], undefined); assert.equal(r['4,0'], undefined);
  const s2 = setup({ '4,0': 'golf' }); const c2 = place(s2, 'canoe1', 0, '0,0'); place(s2, 'swimmer', 1, '5,1');
  assert.equal(reachable(s2, c2.id)['2,0'], undefined);   // shore without facility
  assert.equal(reachable(s2, c2.id)['4,0'], undefined);   // facility one tile inland
});
test('the canoe cannot sail through a landing tile', () => {
  const s = gameFrom(['WWGWWW', 'GGGGGG'], { buildings: { '2,0': 'park' } }); exploreAll(s, 0);
  const c = place(s, 'canoe1', 0, '0,0'); place(s, 'swimmer', 1, '5,0');
  assert.equal(reachable(s, c.id)['3,0'], undefined);
  assert.throws(() => apply(s, { type: 'move', unitId: c.id, path: ['1,0', '2,0', '3,0'] }), /Ufer/);
});
test('next turn the canoe sails back from the facility onto the water', () => {
  let s = setup(); const c = place(s, 'canoe1', 0, '1,0'); place(s, 'swimmer', 1, '5,1');
  s = apply(s, { type: 'move', unitId: c.id, path: ['2,0'] }).state;
  s = apply(apply(s, { type: 'endTurn' }).state, { type: 'endTurn' }).state;
  const r = reachable(s, c.id);
  assert.ok(r['1,0'] && r['2,1']); assert.equal(r['3,0'], undefined);   // back to water, not inland
});
test('a canoe ramming a unit off a shore facility takes the tile and captures it', () => {
  let s = setup(); s.facilities['2,0'].owner = 1;
  const c = place(s, 'canoe1', 0, '0,0'); const t = place(s, 'tennis', 1, '2,0');
  assert.ok(ramTargets(s, c.id)[t.id]);
  s = apply(s, { type: 'ram', unitId: c.id, path: ramTargets(s, c.id)[t.id] }).state;
  assert.equal(s.units[c.id].at, '2,0'); assert.equal(s.facilities['2,0'].owner, 0);
});
test('other units are unaffected (swimmer still pays land cost; walkers ignore the rule)', () => {
  const s = setup(); const w = place(s, 'swimmer', 0, '1,0'); place(s, 'golfer', 1, '5,1');
  assert.ok(reachable(s, w.id)['3,0']);   // swimmer walks on land (2 per tile) as before
  assert.equal(reachable(s, w.id)['2,0'].length, 1);
});
