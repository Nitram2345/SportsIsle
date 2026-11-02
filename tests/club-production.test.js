import test from 'node:test';
import assert from 'node:assert/strict';
import { UNITS } from '../src/config.js';
import { apply, productionTime, canProduceRank } from '../src/logic/game.js';
import { maxHp } from '../src/logic/vision.js';
import { gameFrom, place, exploreAll } from './helpers.js';

const setup = (rows, opts) => { const s = gameFrom(rows, opts); exploreAll(s, 0); exploreAll(s, 1); return s; };
const act = (s, a) => apply(s, a).state;
const end = s => apply(s, { type: 'endTurn' }).state;
const own = (s, at, type) => { s.facilities[at] = { type, owner: 0, producing: null, progress: 0, needed: 0 }; s.tiles[at].building = type; };

test('Club production is locked until the player has promoted that unit type once', () => {
  let s = setup(['GGGGGGGG']); own(s, '0,0', 'tennis'); place(s, 'golfer', 1, '7,0');
  assert.equal(canProduceRank(s, 0, 'tennis', 1), false);
  assert.throws(() => act(s, { type: 'produce', at: '0,0', unitType: 'tennis', rank: 1 }), /freigeschaltet/);
  const a = place(s, 'tennis', 0, '2,0'), b = place(s, 'tennis', 0, '3,0');
  s = act(s, { type: 'promote', unitId: a.id, withId: b.id });
  assert.equal(canProduceRank(s, 0, 'tennis', 1), true);
  assert.equal(canProduceRank(s, 0, 'golfer', 1), false);   // per unit type
  assert.equal(canProduceRank(s, 1, 'tennis', 1), false);   // per player
  assert.equal(canProduceRank(s, 0, 'tennis', 2), false);   // only Club
});
test('Club production takes twice as long and the unit is ready at once (no training lock)', () => {
  let s = setup(['GGGGGGGG']); own(s, '0,0', 'tennis'); place(s, 'golfer', 1, '7,0');
  s.unlocked = { 0: { tennis: true } };
  assert.equal(productionTime(s, 0, 'tennis', 1), 2 * UNITS.tennis.build);
  s = act(s, { type: 'produce', at: '0,0', unitType: 'tennis', rank: 1 });
  assert.equal(s.facilities['0,0'].needed, 4); assert.equal(s.facilities['0,0'].rank, 1);
  for (let i = 0; i < 3; i++) s = end(end(s));
  assert.ok(!Object.values(s.units).some(u => u.owner === 0 && u.type === 'tennis'));
  s = end(end(s));
  const u = Object.values(s.units).find(x => x.owner === 0 && x.type === 'tennis');
  assert.equal(u.rank, 1); assert.equal(u.hp, maxHp(u)); assert.equal(u.hp, 14);
  assert.equal(u.movesLeft, UNITS.tennis.move); assert.ok(!u.locked && !u.mergeLock);
});
test('slowdown from many units still adds on top of the doubled time', () => {
  const s = setup(Array(8).fill('GGGGGGGG')); s.unlocked = { 0: { golfer: true } };
  for (let i = 0; i < 30; i++) place(s, 'jogger', 0, `${i % 8},${Math.floor(i / 8)}`);
  assert.equal(productionTime(s, 0, 'golfer', 1), 2 * UNITS.golfer.build + 1);
});
test('Freizeit production is unchanged; repeating keeps the chosen rank', () => {
  let s = setup(['GGGGGGGG']); own(s, '0,0', 'tennis'); place(s, 'golfer', 1, '7,0'); s.unlocked = { 0: { tennis: true } };
  s = act(s, { type: 'produce', at: '0,0', unitType: 'tennis' });
  assert.equal(s.facilities['0,0'].needed, UNITS.tennis.build); assert.equal(s.facilities['0,0'].rank ?? 0, 0);
  s = act(s, { type: 'produce', at: '0,0', unitType: 'tennis', rank: 1 });   // switch to Club
  assert.equal(s.facilities['0,0'].rank, 1); assert.equal(s.facilities['0,0'].needed, 4);
  for (let i = 0; i < 8; i++) s = end(end(s));
  const ranks = Object.values(s.units).filter(u => u.owner === 0 && u.type === 'tennis').map(u => u.rank);
  assert.deepEqual(ranks, [1, 1]);
});
test('helpers and canoes: helpers unlock too, canoes never (they merge sizes)', () => {
  let s = setup(['GGGGGGGG']); own(s, '0,0', 'park'); place(s, 'golfer', 1, '7,0');
  const a = place(s, 'jogger', 0, '2,0'), b = place(s, 'jogger', 0, '3,0');
  s = act(s, { type: 'promote', unitId: a.id, withId: b.id });
  assert.equal(canProduceRank(s, 0, 'jogger', 1), true);
  assert.equal(canProduceRank(s, 0, 'canoe1', 1), false);
});
test('capturing a facility does not carry over a rank the new owner has not unlocked', () => {
  let s = setup(['GGGGGGGG'], { buildings: { '2,0': 'tennis' } }); place(s, 'golfer', 1, '7,0');
  Object.assign(s.facilities['2,0'], { owner: 1, producing: 'tennis', rank: 1, progress: 1, needed: 4 });
  const j = place(s, 'jogger', 0, '0,0');
  s = act(s, { type: 'move', unitId: j.id, path: ['1,0', '2,0'] });
  assert.equal(s.facilities['2,0'].producing, null); assert.equal(s.facilities['2,0'].rank ?? 0, 0);
});
