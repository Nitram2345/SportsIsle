import test from 'node:test';
import assert from 'node:assert/strict';
import { UNITS, BUILDINGS } from '../src/config.js';
import { apply } from '../src/logic/game.js';
import { reachable } from '../src/logic/movement.js';
import { attackTargets } from '../src/logic/combat.js';
import { gameFrom, place, exploreAll } from './helpers.js';

const row = (n = 14) => ['G'.repeat(n)];
const two = () => ['G'.repeat(14), 'G'.repeat(14)];
const move = (s, unitId, path) => apply(s, { type: 'move', unitId, path });
const attack = (s, unitId, targetId) => apply(s, { type: 'attack', unitId, targetId });
const end = s => apply(s, { type: 'endTurn' }).state;

test('config: new units and their facilities', () => {
  assert.ok(UNITS.soccer.dazeOnHit && UNITS.soccer.zoc);
  assert.ok(UNITS.hockey.zoc);
  assert.ok(UNITS.karate.counter);
  assert.equal(UNITS.karate.range, 1);
  assert.deepEqual(BUILDINGS.soccer.produces, ['soccer']);
  assert.deepEqual(BUILDINGS.dojo.produces, ['karate']);
});

// ---------- soccer: dazed after taking damage ----------
test('hit soccer player is dazed: next own turn half move (floor), no attack, then normal', () => {
  let s = gameFrom(row()); exploreAll(s, 0); exploreAll(s, 1);
  const g = place(s, 'golfer', 0, '0,0'); const f = place(s, 'soccer', 1, '3,0'); place(s, 'jogger', 0, '2,0');
  s = attack(s, g.id, f.id).state;
  assert.equal(s.units[f.id].dazed, true);
  s = end(s);                                   // player 1's turn
  const u = s.units[f.id];
  assert.equal(u.movesLeft, Math.floor(UNITS.soccer.move / 2));
  assert.deepEqual(attackTargets(s, f.id), []);
  assert.throws(() => attack(s, f.id, Object.values(s.units).find(x => x.owner === 0 && x.type === 'jogger').id), /angeschlagen/);
  s = end(end(s));                              // back to player 1, recovered
  assert.equal(s.units[f.id].movesLeft, UNITS.soccer.move);
  assert.ok(!s.units[f.id].dazed);
});
test('other units are not dazed by damage', () => {
  let s = gameFrom(row()); const g = place(s, 'golfer', 0, '0,0'); const t = place(s, 'tennis', 1, '2,0');
  s = attack(s, g.id, t.id).state;
  assert.ok(!s.units[t.id].dazed);
});

// ---------- karate: range 1, counter only adjacent ----------
test('karate attacks only adjacent tiles', () => {
  const s = gameFrom(row()); const k = place(s, 'karate', 0, '0,0');
  const near = place(s, 'tennis', 1, '1,0'); const far = place(s, 'tennis', 1, '2,0');
  assert.deepEqual(attackTargets(s, k.id), [near.id]); assert.ok(far);
});
test('karate counters an adjacent attacker once, without using its own attack', () => {
  let s = gameFrom(row()); const h = place(s, 'hockey', 0, '0,0'); const k = place(s, 'karate', 1, '1,0');
  const r = attack(s, h.id, k.id); s = r.state;
  assert.ok(s.units[h.id].hp < UNITS.hockey.hp);
  assert.deepEqual(r.events.map(e => e.type), ['damage', 'counter', 'damage']);
  s = end(s);
  assert.equal(s.units[k.id].hasAttacked, false);
});
test('karate does not counter a ranged attacker', () => {
  let s = gameFrom(row()); const g = place(s, 'golfer', 0, '0,0'); const k = place(s, 'karate', 1, '3,0'); place(s, 'jogger', 0, '2,0');
  s = attack(s, g.id, k.id).state;
  assert.equal(s.units[g.id].hp, UNITS.golfer.hp);
});
test('karate killed by the attack does not counter', () => {
  let s = gameFrom(row()); const h = place(s, 'hockey', 0, '0,0'); const k = place(s, 'karate', 1, '1,0'); k.hp = 1;
  place(s, 'jogger', 1, '13,0');
  s = attack(s, h.id, k.id).state;
  assert.equal(s.units[h.id].hp, UNITS.hockey.hp);
});
test('counter can kill the attacker', () => {
  let s = gameFrom(row()); const h = place(s, 'hockey', 0, '0,0'); h.hp = 1; place(s, 'jogger', 0, '13,0');
  const k = place(s, 'karate', 1, '1,0');
  const r = attack(s, h.id, k.id);
  assert.equal(r.state.units[h.id], undefined);
  assert.ok(r.events.some(e => e.type === 'killed' && e.unitId === h.id));
});

// ---------- zone of control (hockey, soccer) ----------
// Map: 2 rows. Enemy hockey on 3,1 controls 2,1 3,0 4,0 4,1 — a wall nobody can walk around.
test('zone tile is reachable, nothing behind it', () => {
  const s = gameFrom(two()); exploreAll(s, 0);
  const j = place(s, 'jogger', 0, '0,0'); place(s, 'hockey', 1, '3,1');
  const r = reachable(s, j.id);
  assert.ok(r['3,0']); assert.ok(r['2,1']);
  assert.equal(r['5,0'], undefined); assert.equal(r['5,1'], undefined);
});
test('entering a zone stops the move and drops leftover points (non-jogger)', () => {
  let s = gameFrom(two()); exploreAll(s, 0);
  const g = place(s, 'golfer', 0, '1,0'); place(s, 'hockey', 1, '3,1');
  s = move(s, g.id, ['2,0', '3,0']).state;
  assert.equal(s.units[g.id].at, '3,0'); assert.equal(s.units[g.id].movesLeft, 0);
});
test('path through a zone tile is rejected', () => {
  const s = gameFrom(two()); exploreAll(s, 0);
  const j = place(s, 'jogger', 0, '0,0'); place(s, 'soccer', 1, '3,1');
  assert.throws(() => move(s, j.id, ['1,0', '2,0', '3,0', '4,0', '5,0']), /Zone/);
});
test('unit starting its turn in a zone may leave freely', () => {
  const s = gameFrom(two()); exploreAll(s, 0);
  const g = place(s, 'tennis', 0, '3,0'); place(s, 'hockey', 1, '3,1');
  assert.ok(reachable(s, g.id)['1,0']);
});
test('own zone units do not block; hidden enemy blockers do not block', () => {
  const s = gameFrom(two()); exploreAll(s, 0);
  const j = place(s, 'jogger', 0, '0,0'); place(s, 'hockey', 0, '3,1');
  assert.ok(reachable(s, j.id)['5,0']);
  const s2 = gameFrom(two()); exploreAll(s2, 0);
  const j2 = place(s2, 'jogger', 0, '0,0');
  s2.units.h = { ...j2, id: 'h', type: 'hockey', owner: 1, at: '7,1', buffs: [] };   // distance 8 > sight 4: hidden
  assert.ok(reachable(s2, j2.id)['6,0']);
});
test('jogger in a zone keeps points, but first step must go straight back', () => {
  let s = gameFrom(two()); exploreAll(s, 0);
  const j = place(s, 'jogger', 0, '0,0'); place(s, 'hockey', 1, '3,1');
  s = move(s, j.id, ['1,0', '2,0', '3,0']).state;
  const u = s.units[j.id];
  assert.equal(u.at, '3,0'); assert.equal(u.movesLeft, 3); assert.equal(u.retreatTo, '2,0');
  const r = reachable(s, j.id);
  assert.ok(Object.keys(r).length);
  assert.ok(Object.values(r).every(p => p[0] === '2,0'));
  assert.throws(() => move(s, j.id, ['4,0']), /zurück/);
  s = move(s, j.id, ['2,0', '1,0']).state;
  assert.equal(s.units[j.id].at, '1,0'); assert.equal(s.units[j.id].retreatTo, null);
});
test('zone stop and retreat reset at the start of the next own turn', () => {
  let s = gameFrom(two()); exploreAll(s, 0);
  const j = place(s, 'jogger', 0, '0,0'); place(s, 'hockey', 1, '3,1');
  s = move(s, j.id, ['1,0', '2,0', '3,0']).state;
  s = end(end(s));
  assert.equal(s.units[j.id].retreatTo, null);
  assert.ok(reachable(s, j.id)['1,0']);
});
