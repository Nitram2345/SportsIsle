import test from 'node:test';
import assert from 'node:assert/strict';
import { attackRange, pathBlocked, damage, attackTargets } from '../src/logic/combat.js';
import { apply } from '../src/logic/game.js';
import { gameFrom, place } from './helpers.js';

const canHit = (rows, type, target, opts = {}, from = '0,0', spotter = null) => {
  const s = gameFrom(rows, opts); const a = place(s, type, 0, from); const t = place(s, 'tennis', 1, target);
  if (spotter) place(s, 'jogger', 0, spotter);
  return attackTargets(s, a.id).includes(t.id);
};

test('golfer hits over hill, not over mountain', () => {
  assert.ok(canHit(['GHGG'], 'golfer', '3,0'));
  assert.ok(!canHit(['GMGG'], 'golfer', '3,0'));
  assert.ok(!canHit(['GGGGG'], 'golfer', '4,0'));
});
test('target tile itself never blocks', () => assert.ok(canHit(['GGM'], 'tennis', '2,0')));
test('tennis blocked by hill and by building, golfer not by building', () => {
  assert.ok(!canHit(['GHG'], 'tennis', '2,0'));
  assert.ok(!canHit(['GgG'], 'tennis', '2,0'));
  assert.ok(!canHit(['GGG'], 'tennis', '2,0', { buildings: { '1,0': 'house' } }));
  assert.ok(canHit(['GGG'], 'golfer', '2,0', { buildings: { '1,0': 'house' } }));
  assert.ok(canHit(['GFG'], 'tennis', '2,0'));
});
test('hockey blocked by forest, dunes, building; not by park', () => {
  for (const ch of 'FDHhgM') assert.ok(!canHit(['G' + ch + 'G'], 'hockey', '2,0'), ch);
  assert.ok(!canHit(['GGG'], 'hockey', '2,0', { buildings: { '1,0': 'tennis' } }));
  assert.ok(canHit(['GGG'], 'hockey', '2,0', { buildings: { '1,0': 'park' } }));
  assert.ok(canHit(['GWG'], 'hockey', '2,0'));
});
test('hockey in forest has range 1', () => {
  assert.ok(!canHit(['FGG'], 'hockey', '2,0'));
  assert.ok(canHit(['FGG'], 'hockey', '1,0'));
  assert.ok(!canHit(['hGG'], 'hockey', '2,0'));
});
test('road bonus when target on road', () => {
  assert.ok(!canHit(['GGGG'], 'tennis', '3,0', {}, '0,0', '1,0'));
  assert.ok(canHit(['GGGG'], 'tennis', '3,0', { roads: ['3,0'] }, '0,0', '1,0'));
  assert.ok(!canHit(['GGGG'], 'tennis', '3,0', { roads: ['0,0'] }, '0,0', '1,0'));
  assert.ok(!canHit(['GGGG'], 'tennis', '3,0', { roads: ['3,0'] }));  // not visible without spotter
});
test('edge line blocked only if both hexes block', () => {
  // line 0,0 -> 1,1 runs along the edge of 1,0 and 0,1
  assert.ok(canHit(['GH', 'GG'], 'tennis', '1,1'));
  assert.ok(!canHit(['GH', 'HG'], 'tennis', '1,1'));
});
test('damage uses terrain defence and min 1', () => {
  const s = gameFrom(['GFh']);
  const h = place(s, 'hockey', 0, '0,0'), t = place(s, 'tennis', 1, '1,0'), g = place(s, 'golfer', 0, '1,0'), h2 = place(s, 'hockey', 1, '2,0');
  assert.equal(damage(s, h, t), 4);
  assert.equal(damage(s, g, h2), 1);
});
test('jogger cannot attack', () => {
  const s = gameFrom(['GG']); const j = place(s, 'jogger', 0, '0,0'); place(s, 'tennis', 1, '1,0');
  assert.deepEqual(attackTargets(s, j.id), []);
});
test('attack applies damage and uses the unit', () => {
  const s = gameFrom(['GGG']); const t = place(s, 'tennis', 0, '0,0'); const e = place(s, 'tennis', 1, '2,0');
  const { state, events } = apply(s, { type: 'attack', unitId: t.id, targetId: e.id });
  assert.equal(state.units[e.id].hp, 7);
  assert.equal(state.units[t.id].hasAttacked, true); assert.equal(state.units[t.id].movesLeft, 0);
  assert.deepEqual(events[0], { type: 'damage', targetId: e.id, amount: 3 });
});
test('cannot attack after moving / twice / hidden target / own unit', () => {
  const s = gameFrom(['GGGGGGGG']); const g = place(s, 'golfer', 0, '0,0'); const e = place(s, 'tennis', 1, '2,0');
  const far = place(s, 'tennis', 1, '7,0'); const own = place(s, 'tennis', 0, '1,0');
  const atk = (st, tid) => apply(st, { type: 'attack', unitId: g.id, targetId: tid });
  assert.throws(() => atk(s, far.id)); assert.throws(() => atk(s, own.id));
  const s2 = atk(s, e.id).state; assert.throws(() => atk(s2, e.id));
  const s4 = structuredClone(s); s4.units[g.id].hasMoved = true; assert.throws(() => atk(s4, e.id));
});
test('kill removes unit; last player standing wins', () => {
  const s = gameFrom(['GGG']); const h = place(s, 'hockey', 0, '0,0'); const j = place(s, 'jogger', 1, '1,0'); j.hp = 2;
  const { state, events } = apply(s, { type: 'attack', unitId: h.id, targetId: j.id });
  assert.equal(state.units[j.id], undefined);
  assert.equal(state.players[1].alive, false); assert.equal(state.winner, 0);
  assert.deepEqual(events.map(e => e.type), ['damage', 'killed', 'eliminated', 'won']);
});
test('player with facility but no units stays alive', () => {
  const s = gameFrom(['GGG'], { buildings: { '2,0': 'park' } }); s.facilities['2,0'].owner = 1;
  const h = place(s, 'hockey', 0, '0,0'); const j = place(s, 'jogger', 1, '1,0'); j.hp = 1;
  const { state } = apply(s, { type: 'attack', unitId: h.id, targetId: j.id });
  assert.equal(state.players[1].alive, true); assert.equal(state.winner, null);
});
