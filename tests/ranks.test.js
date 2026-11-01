import test from 'node:test';
import assert from 'node:assert/strict';
import { UNITS, RANKS } from '../src/config.js';
import { apply } from '../src/logic/game.js';
import { effective, maxHp } from '../src/logic/vision.js';
import { promoteTargets } from '../src/logic/merge.js';
import { damage } from '../src/logic/combat.js';
import { gameFrom, place, exploreAll } from './helpers.js';

const setup = rows => { const s = gameFrom(rows); exploreAll(s, 0); exploreAll(s, 1); return s; };
const act = (s, a) => apply(s, a).state;
const end = s => apply(s, { type: 'endTurn' }).state;
const RANKED = ['tennis', 'soccer', 'golfer', 'karate', 'swimmer', 'hockey', 'rugby', 'climber', 'tabletennis'];

test('config: four ranks with names and x1.4 per rank', () => {
  assert.deepEqual(RANKS.map(r => r.short), ['Freizeit', 'Club', 'National', 'Profi']);
  assert.deepEqual(RANKS.map(r => r.name), ['Freizeitspieler', 'Fortgeschrittene Clubspieler', 'Nationale Spitzenamateure', 'Profi']);
  for (const t of RANKED) assert.ok(UNITS[t].ranked, t);
  for (const t of ['jogger', 'physio', 'lifeguard', 'canoe1']) assert.ok(!UNITS[t].ranked, t);
});
test('rank scales max hp and attack (rounded from the base), not move/def/range', () => {
  const s = setup(['GGGG']); const t = place(s, 'tennis', 0, '0,0');
  const at = r => { t.rank = r; return [maxHp(t), effective(t, 'atk'), effective(t, 'move'), effective(t, 'def'), effective(t, 'range')]; };
  assert.deepEqual(at(0), [10, 5, 3, 2, 2]);
  assert.deepEqual(at(1), [14, 7, 3, 2, 2]);
  assert.deepEqual(at(2), [20, 10, 3, 2, 2]);
  assert.deepEqual(at(3), [27, 14, 3, 2, 2]);
});
test('rank adds up with buffs', () => {
  const s = setup(['GGGG']); const t = place(s, 'tennis', 0, '0,0'); t.rank = 1;
  t.buffs.push({ special: 'power', stat: 'atk', amount: 2, turns: 3, fresh: false });
  assert.equal(effective(t, 'atk'), 9);
});
test('produced units start as Freizeit (rank 0)', () => {
  const s = setup(['GGGG']); const t = place(s, 'golfer', 0, '0,0');
  assert.equal(t.rank ?? 0, 0);
});

// ---------- promote (merge two of the same kind and rank) ----------
const two = (type = 'tennis', rank = 0) => {
  const s = setup(['GGGGGGGG']); const a = place(s, type, 0, '0,0'); const b = place(s, type, 0, '1,0');
  a.rank = rank; b.rank = rank; place(s, 'golfer', 1, '7,0'); return { s, a, b };
};
test('promoteTargets: adjacent own fresh unit of the same type and rank', () => {
  const { s, a, b } = two();
  assert.deepEqual(promoteTargets(s, a.id), [b.id]);
  b.rank = 1; assert.deepEqual(promoteTargets(s, a.id), []);
});
test('promote: partner gets the next rank, hp share kept, locked like the canoe', () => {
  let { s, a, b } = two(); s.units[a.id].hp = 5;   // 15 of 20 = 75 %
  const r = apply(s, { type: 'promote', unitId: a.id, withId: b.id }); s = r.state;
  assert.equal(s.units[a.id], undefined);
  const u = s.units[b.id];
  assert.equal(u.rank, 1); assert.equal(u.type, 'tennis'); assert.equal(u.hp, Math.round(14 * 0.75));
  assert.ok(u.hasMoved && u.hasAttacked); assert.equal(u.movesLeft, 0);
  assert.ok(r.events.some(e => e.type === 'promoted' && e.intoId === b.id && e.rank === 1));
  s = end(end(s)); assert.equal(s.units[b.id].movesLeft, 0);
  s = end(end(s)); assert.equal(s.units[b.id].movesLeft, UNITS.tennis.move);
});
test('profi is the top rank', () => {
  const { s, a } = two('karate', 3);
  assert.deepEqual(promoteTargets(s, a.id), []);
});
test('no promote: different type, not adjacent, after acting, helpers', () => {
  const s = setup(['GGGGGGGG']); place(s, 'golfer', 1, '7,0');
  const a = place(s, 'tennis', 0, '0,0'), g = place(s, 'golfer', 0, '1,0'), far = place(s, 'tennis', 0, '3,0');
  assert.deepEqual(promoteTargets(s, a.id), []); assert.ok(g && far);
  const j1 = place(s, 'jogger', 0, '4,0'), j2 = place(s, 'jogger', 0, '5,0');
  assert.deepEqual(promoteTargets(s, j1.id), []); assert.ok(j2);
  const x = place(s, 'tennis', 0, '6,0'.replace('6', '2')); x.hasMoved = true;
  assert.deepEqual(promoteTargets(s, far.id), []);
});
test('a profi hits much harder', () => {
  const s = setup(['GGGG']); const t = place(s, 'tennis', 0, '0,0'); const k = place(s, 'karate', 1, '2,0');
  assert.equal(damage(s, t, k), 1); t.rank = 3; assert.equal(damage(s, t, k), 10);
});
test('physio heals up to the ranked max hp', () => {
  let s = setup(['GGGGGG']); const ph = place(s, 'physio', 0, '1,0'); const t = place(s, 'tennis', 0, '2,0'); place(s, 'golfer', 1, '5,0');
  t.rank = 2; t.hp = 10;   // max 20
  s = act(s, { type: 'heal', unitId: ph.id, targetId: t.id });
  assert.equal(s.units[t.id].hp, 13);
});
