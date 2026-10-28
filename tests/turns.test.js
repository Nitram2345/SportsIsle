import test from 'node:test';
import assert from 'node:assert/strict';
import { apply, productionTime } from '../src/logic/game.js';
import { gameFrom, place } from './helpers.js';

const end = s => apply(s, { type: 'endTurn' }).state;
const unitsOf = (s, pid) => Object.values(s.units).filter(u => u.owner === pid);

test('endTurn resets units of next player and increments round on wrap', () => {
  let s = gameFrom(['GGGGGG']); const a = place(s, 'golfer', 0, '0,0'); const b = place(s, 'golfer', 1, '5,0');
  s.units[b.id].hasMoved = true; s.units[b.id].movesLeft = 0;
  s = end(s);
  assert.equal(s.current, 1); assert.equal(s.round, 1);
  assert.equal(s.units[b.id].hasMoved, false); assert.equal(s.units[b.id].movesLeft, 3);
  s = end(s);
  assert.equal(s.current, 0); assert.equal(s.round, 2);
  assert.ok(s.units[a.id]);
});
// Review Focus 5
test('16 players: eliminated players are skipped, winner when one left', () => {
  let s = gameFrom(['G'.repeat(16)], {}, { players: 16 });
  for (let p = 0; p < 16; p++) place(s, 'jogger', p, `${p},0`);
  for (const u of Object.values(s.units)) if ([3, 4, 5].includes(u.owner)) delete s.units[u.id];
  s.current = 2;
  const r = apply(s, { type: 'endTurn' });
  assert.equal(r.state.current, 6);
  assert.deepEqual(r.events.filter(e => e.type === 'eliminated').map(e => e.player), [3, 4, 5]);
  s = r.state;
  for (const u of Object.values(s.units)) if (u.owner !== 9) delete s.units[u.id];
  s = end(s);
  assert.equal(s.winner, 9);
  assert.throws(() => end(s), /vorbei/);
});
test('buff lasts exactly 3 own turns after pickup turn', () => {
  let s = gameFrom(['GGGGGGGGGGGGGGGGGGGG'], { specials: { '1,0': 'sprint' } });
  const j = place(s, 'jogger', 0, '0,0'); place(s, 'jogger', 1, '19,0');
  s = apply(s, { type: 'move', unitId: j.id, path: ['1,0'] }).state;
  const moves = [];
  for (let i = 0; i < 4; i++) { s = end(end(s)); moves.push(s.units[j.id].movesLeft); }
  assert.deepEqual(moves, [8, 8, 8, 6]);
  assert.deepEqual(s.units[j.id].buffs, []);
});
test('capture when move ends on facility', () => {
  const s = gameFrom(['GGGGGGGGG'], { buildings: { '2,0': 'tennis' } }); const j = place(s, 'jogger', 0, '0,0'); place(s, 'jogger', 1, '8,0');
  const { state, events } = apply(s, { type: 'move', unitId: j.id, path: ['1,0', '2,0'] });
  assert.equal(state.facilities['2,0'].owner, 0);
  assert.ok(events.some(e => e.type === 'captured' && e.at === '2,0' && e.player === 0));
});
test('passing over facility does not capture', () => {
  const s = gameFrom(['GGGGGGGGG'], { buildings: { '2,0': 'park' } }); const j = place(s, 'jogger', 0, '0,0'); place(s, 'jogger', 1, '8,0');
  assert.equal(apply(s, { type: 'move', unitId: j.id, path: ['1,0', '2,0', '3,0'] }).state.facilities['2,0'].owner, null);
});
test('capture at endTurn when unit started on facility', () => {
  const s = gameFrom(['GGGGGGGGG'], { buildings: { '2,0': 'golf' } }); place(s, 'jogger', 0, '2,0'); place(s, 'jogger', 1, '8,0');
  s.facilities['2,0'].owner = 1;
  assert.equal(end(s).facilities['2,0'].owner, 0);
});
test('capture cancels production', () => {
  const s = gameFrom(['GGGGGGGGG'], { buildings: { '2,0': 'tennis' } }); const j = place(s, 'jogger', 0, '0,0'); place(s, 'jogger', 1, '8,0');
  Object.assign(s.facilities['2,0'], { owner: 1, producing: 'tennis', progress: 1, needed: 2 });
  const f = apply(s, { type: 'move', unitId: j.id, path: ['1,0', '2,0'] }).state.facilities['2,0'];
  assert.deepEqual([f.owner, f.producing, f.progress], [0, null, 0]);
});
test('produce: unit appears after build turns and repeats', () => {
  let s = gameFrom(['GGGGGGGGGGGG'], { buildings: { '5,0': 'tennis' } }); s.facilities['5,0'].owner = 0; place(s, 'jogger', 1, '11,0');
  s = apply(s, { type: 'produce', at: '5,0', unitType: 'tennis' }).state;
  assert.equal(s.facilities['5,0'].needed, 2);
  s = end(end(s)); assert.equal(unitsOf(s, 0).length, 0);
  const r = apply(apply(s, { type: 'endTurn' }).state, { type: 'endTurn' });
  s = r.state; assert.equal(unitsOf(s, 0).length, 1); assert.equal(unitsOf(s, 0)[0].at, '5,0');
  assert.ok(r.events.some(e => e.type === 'produced'));
  s = end(end(s)); s = end(end(s));
  assert.equal(unitsOf(s, 0).length, 2);
});
// Review Focus 3
test('spawn waits when facility and all neighbours are blocked', () => {
  let s = gameFrom(['WGGGW', 'WWWWW'], { buildings: { '2,0': 'park' } }); s.facilities['2,0'].owner = 0;
  for (const at of ['1,0', '2,0', '3,0']) place(s, 'tennis', 0, at);
  const e = place(s, 'jogger', 1, '0,1'); s.tiles['0,1'].terrain = 'grass';
  s = apply(s, { type: 'produce', at: '2,0', unitType: 'jogger' }).state;
  s = end(end(s));
  assert.equal(unitsOf(s, 0).length, 3);
  const blocker = unitsOf(s, 0).find(u => u.at === '3,0'); delete s.units[blocker.id];
  s = end(end(s));
  assert.equal(unitsOf(s, 0).length, 3); assert.ok(unitsOf(s, 0).some(u => u.at === '3,0'));
  assert.ok(e);
});
test('slowdown table', () => {
  const s = gameFrom(Array(8).fill('GGGGGGGG'));
  const withCount = n => { for (const u of unitsOf(s, 0)) delete s.units[u.id]; for (let i = 0; i < n; i++) place(s, 'jogger', 0, `${i % 8},${Math.floor(i / 8)}`); return productionTime(s, 0, 'tennis'); };
  assert.deepEqual([29, 30, 34, 35, 40, 45, 49, 50].map(withCount), [2, 3, 3, 4, 5, 6, 6, null]);
});
test('cap pauses production', () => {
  let s = gameFrom(Array(8).fill('GGGGGGGG'), { buildings: { '7,7': 'park' } }); s.facilities['7,7'].owner = 0;
  for (let i = 0; i < 50; i++) place(s, 'jogger', 0, `${i % 8},${Math.floor(i / 8)}`);
  place(s, 'jogger', 1, '6,7');
  s = apply(s, { type: 'produce', at: '7,7', unitType: 'jogger' }).state;
  for (let i = 0; i < 5; i++) s = end(end(s));
  assert.equal(unitsOf(s, 0).length, 50);
});
test('produce invalid: foreign facility, wrong unit type; null stops', () => {
  let s = gameFrom(['GGG'], { buildings: { '1,0': 'tennis' } }); place(s, 'jogger', 1, '2,0');
  assert.throws(() => apply(s, { type: 'produce', at: '1,0', unitType: 'tennis' }));
  s.facilities['1,0'].owner = 0;
  assert.throws(() => apply(s, { type: 'produce', at: '1,0', unitType: 'golfer' }));
  s = apply(s, { type: 'produce', at: '1,0', unitType: 'tennis' }).state;
  s = apply(s, { type: 'produce', at: '1,0', unitType: null }).state;
  assert.equal(s.facilities['1,0'].producing, null);
});
test('no endless loop when everybody is gone', () => {
  const s = gameFrom(['GGG']);
  const r = apply(s, { type: 'endTurn' });
  assert.ok(r.state.players.every(p => !p.alive));
});
