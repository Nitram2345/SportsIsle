import test from 'node:test';
import assert from 'node:assert/strict';
import { reachable, moveCost } from '../src/logic/movement.js';
import { apply } from '../src/logic/game.js';
import { gameFrom, place, exploreAll } from './helpers.js';

const row = (n = 14, ch = 'G') => [ch.repeat(n)];
const path = (from, to) => Array.from({ length: to - from + 1 }, (_, i) => `${from + i},0`);
const move = (s, unitId, p) => apply(s, { type: 'move', unitId, path: p });

test('moveCost: terrain, road, impassable', () => {
  assert.equal(moveCost({ terrain: 'forest', road: false }), 2);
  assert.equal(moveCost({ terrain: 'forest', road: true }), 1);
  assert.equal(moveCost({ terrain: 'river', road: true }), 1);
  assert.equal(moveCost({ terrain: 'sea', road: true }), Infinity);
});
test('jogger reaches 6 on known ground', () => {
  const s = gameFrom(row()); const j = place(s, 'jogger', 0, '0,0'); exploreAll(s, 0);
  const r = reachable(s, j.id);
  assert.deepEqual(r['6,0'], path(1, 6)); assert.equal(r['7,0'], undefined); assert.equal(r['0,0'], undefined);
});
test('on new ground the jogger walks to its sight edge, then spends the rest after seeing more', () => {
  let s = gameFrom([...row(), ...row()]); const j = place(s, 'jogger', 0, '0,0');
  s.facilities = {}; s.units.foe = { ...j, id: 'foe', owner: 1, at: '13,1' };  // keeps player 1 alive, out of sight
  const first = reachable(s, j.id);
  assert.ok(first['4,0']); assert.equal(first['5,0'], undefined);   // sight 4 = edge of known ground
  s = move(s, j.id, path(1, 4)).state;
  assert.equal(s.units[j.id].movesLeft, 2);
  const r = reachable(s, j.id);
  assert.ok(r['6,0']); assert.ok(r['2,0']); assert.equal(r['7,0'], undefined);
  s = move(s, j.id, ['3,0', '2,0']).state;   // run back after looking
  assert.equal(s.units[j.id].at, '2,0'); assert.equal(s.units[j.id].movesLeft, 0);
});
test('forest costs 2, road makes it 1', () => {
  const s = gameFrom(['GFFFFFFG']); const g = place(s, 'golfer', 0, '0,0');
  assert.ok(reachable(s, g.id)['1,0']); assert.equal(reachable(s, g.id)['2,0'], undefined);
  const s2 = gameFrom(['GFFFFFFG'], { roads: ['1,0', '2,0', '3,0'] }); const g2 = place(s2, 'golfer', 0, '0,0');
  assert.ok(reachable(s2, g2.id)['3,0']);
});
test('water impassable', () => {
  const s = gameFrom(['GWGG']); const j = place(s, 'jogger', 0, '0,0');
  assert.deepEqual(Object.keys(reachable(s, j.id)), []);
});
test('own unit passable, not a destination', () => {
  const s = gameFrom(row()); const j = place(s, 'jogger', 0, '0,0'); place(s, 'tennis', 0, '2,0');
  const r = reachable(s, j.id);
  assert.equal(r['2,0'], undefined); assert.deepEqual(r['3,0'], path(1, 3));
});
test('visible enemy blocks', () => {
  const s = gameFrom(row()); const j = place(s, 'jogger', 0, '0,0'); place(s, 'tennis', 1, '3,0');
  const r = reachable(s, j.id);
  assert.ok(r['2,0']); assert.equal(r['3,0'], undefined); assert.equal(r['4,0'], undefined);
});
// Review Focus 2
test('hidden enemy tile still shows as reachable', () => {
  // Jogger sight 4, movesLeft 8 (as with sprint buff); enemy at distance 6 = hidden
  const s = gameFrom(row()); const j = place(s, 'jogger', 0, '0,0'); j.movesLeft = 8; exploreAll(s, 0);
  place(s, 'tennis', 1, '6,0');
  assert.ok(reachable(s, j.id)['6,0']);
  assert.ok(reachable(s, j.id)['8,0']);
});
test('move stops when enemy discovered, keeps remaining points', () => {
  const s = gameFrom(row()); const j = place(s, 'jogger', 0, '0,0'); const e = place(s, 'tennis', 1, '9,0'); exploreAll(s, 0);
  const { state, events } = move(s, j.id, path(1, 6));
  const u = state.units[j.id];
  assert.equal(u.at, '5,0'); assert.equal(u.movesLeft, 1); assert.equal(u.hasMoved, true);
  assert.deepEqual(events.find(ev => ev.type === 'discovered'), { type: 'discovered', unitId: j.id, seen: [e.id] });
  assert.ok(state.explored[0]['9,0']);
});
test('enemy already visible does not stop the move', () => {
  const s = gameFrom(['GGGGGGGG', 'GGGGGGGG']); const j = place(s, 'jogger', 0, '0,0'); place(s, 'tennis', 1, '3,1'); exploreAll(s, 0);
  const { state } = move(s, j.id, path(1, 5));
  assert.equal(state.units[j.id].at, '5,0');
});
test('after stop the unit can move again', () => {
  const s = gameFrom(row()); const j = place(s, 'jogger', 0, '0,0'); place(s, 'tennis', 1, '9,0'); exploreAll(s, 0);
  const s2 = move(s, j.id, path(1, 6)).state;
  const s3 = move(s2, j.id, ['4,0']).state;
  assert.equal(s3.units[j.id].at, '4,0'); assert.equal(s3.units[j.id].movesLeft, 0);
});
// Review Focus 1
test('stop on own-occupied tile backs up to last free tile and refunds', () => {
  const s = gameFrom(row()); const j = place(s, 'jogger', 0, '0,0'); place(s, 'tennis', 0, '5,0'); place(s, 'tennis', 1, '9,0');
  const { state, events } = move(s, j.id, path(1, 6));
  assert.equal(state.units[j.id].at, '4,0'); assert.equal(state.units[j.id].movesLeft, 2);
  assert.ok(events.some(ev => ev.type === 'discovered'));
});
test('special gives buff; move bonus not in current movesLeft', () => {
  const s = gameFrom(row(), { specials: { '2,0': 'sprint' } }); const j = place(s, 'jogger', 0, '0,0');
  const { state, events } = move(s, j.id, path(1, 3));
  const u = state.units[j.id];
  assert.equal(u.movesLeft, 3);
  assert.deepEqual(u.buffs, [{ special: 'sprint', stat: 'move', amount: 2, turns: 3, fresh: true }]);
  assert.deepEqual(events.find(ev => ev.type === 'buff'), { type: 'buff', unitId: j.id, special: 'sprint' });
});
test('re-entering same special resets turns', () => {
  const s = gameFrom(row(), { specials: { '1,0': 'sprint' } }); const j = place(s, 'jogger', 0, '0,0');
  j.buffs.push({ special: 'sprint', stat: 'move', amount: 2, turns: 1, fresh: false });
  const u = move(s, j.id, path(1, 2)).state.units[j.id];
  assert.equal(u.buffs.length, 1); assert.equal(u.buffs[0].turns, 3);
});
test('invalid paths throw', () => {
  const s = gameFrom(row()); const j = place(s, 'jogger', 0, '0,0'); place(s, 'tennis', 0, '2,0'); const e = place(s, 'golfer', 1, '4,0');
  assert.throws(() => move(s, j.id, ['2,0']));                 // ends on own unit
  assert.throws(() => move(s, j.id, ['3,0']));                 // not adjacent
  assert.throws(() => move(s, j.id, ['1,0', '2,0', '3,0', '4,0'])); // visible enemy
  assert.throws(() => move(s, e.id, ['5,0']));                 // not current player
  assert.throws(() => move(s, j.id, []));                       // empty
});
test('too expensive and after attack throw', () => {
  const s = gameFrom(row()); const g = place(s, 'golfer', 0, '0,0');
  assert.throws(() => move(s, g.id, path(1, 4)));
  g.hasAttacked = true;
  assert.throws(() => move(s, g.id, ['1,0']));
});
test('reachable never includes or routes through unexplored tiles (fog stage 1)', () => {
  const s = gameFrom(['G'.repeat(14)]); const j = place(s, 'jogger', 0, '0,0');
  s.explored[0] = { '0,0': true, '1,0': true, '2,0': true, '3,0': true, '4,0': true };
  assert.deepEqual(Object.keys(reachable(s, j.id)).sort(), ['1,0', '2,0', '3,0', '4,0']);
});
test('move into unexplored tile is rejected', () => {
  const s = gameFrom(['G'.repeat(14)]); const j = place(s, 'jogger', 0, '0,0');
  s.explored[0] = { '0,0': true, '1,0': true };
  assert.throws(() => apply(s, { type: 'move', unitId: j.id, path: ['1,0', '2,0'] }), /unerkundet/);
});
