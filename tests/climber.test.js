import test from 'node:test';
import assert from 'node:assert/strict';
import { UNITS, BUILDINGS, TERRAIN } from '../src/config.js';
import { reachable, moveCost } from '../src/logic/movement.js';
import { attackTargets, damage, attackRange } from '../src/logic/combat.js';
import { visibleTiles } from '../src/logic/vision.js';
import { gameFrom, place, exploreAll } from './helpers.js';

const setup = rows => { const s = gameFrom(rows); exploreAll(s, 0); return s; };
const canHit = (rows, from, to) => {
  const s = setup(rows); const c = place(s, 'climber', 0, from); const t = place(s, 'tennis', 1, to);
  place(s, 'jogger', 0, from === '0,0' ? '0,1' : '0,0');   // spotter so range never fails on sight
  return attackTargets(s, c.id).includes(t.id);
};

test('config: climber stats and outdoor shop', () => {
  const c = UNITS.climber;
  assert.equal(c.move, UNITS.jogger.move - 2);
  assert.equal(c.atk, UNITS.tennis.atk - 1);
  assert.ok(c.climb);
  assert.deepEqual(BUILDINGS.outdoor.produces, ['climber']);
  assert.deepEqual(['mountain', 'hill', 'hillgrass', 'hillforest', 'dunes', 'grass'].map(t => TERRAIN[t].height), [2, 1, 1, 1, 1, 0]);
});

test('hills, hilly forest and mountains cost the climber 1; others pay normal', () => {
  for (const t of ['hill', 'hillgrass', 'hillforest', 'mountain']) {
    assert.equal(moveCost({ terrain: t, road: false }, { type: 'climber' }), 1, t);
  }
  assert.equal(moveCost({ terrain: 'forest', road: false }, { type: 'climber' }), 2);
  assert.equal(moveCost({ terrain: 'mountain', road: false }, { type: 'tennis' }), 3);
  assert.equal(moveCost({ terrain: 'mountain', road: false }), 3);
});
test('climber crosses a mountain range at full speed', () => {
  const s = setup(['GMMMMG']); const c = place(s, 'climber', 0, '0,0');
  assert.ok(reachable(s, c.id)['4,0']);
  const s2 = setup(['GMMMMG']); const t = place(s2, 'tennis', 0, '0,0');
  assert.ok(reachable(s2, t.id)['1,0']); assert.equal(reachable(s2, t.id)['2,0'], undefined);
});

test('on a mountain the climber sees 2 further', () => {
  const s = setup(['G'.repeat(12)]); const c = place(s, 'climber', 0, '0,0');
  const base = UNITS.climber.sight;
  assert.ok(visibleTiles(s, 0).has(`${base},0`)); assert.ok(!visibleTiles(s, 0).has(`${base + 1},0`));
  s.tiles['0,0'].terrain = 'mountain';
  assert.ok(visibleTiles(s, 0).has(`${base + 2},0`)); assert.ok(!visibleTiles(s, 0).has(`${base + 3},0`));
});

test('downhill: +1 range and +1 attack (mountain > hill/dunes > rest)', () => {
  const s = setup(['MGGGGG', 'GGGGGG']); const c = place(s, 'climber', 0, '0,0'); const t = place(s, 'tennis', 1, '3,0');
  assert.equal(attackRange(s, c, '3,0'), UNITS.climber.range + 1);
  assert.equal(damage(s, c, t), Math.max(1, UNITS.climber.atk + 1 - UNITS.tennis.def));
  assert.ok(canHit(['MGGGGG', 'GGGGGG'], '0,0', '3,0'));
  assert.ok(!canHit(['GGGGGG', 'GGGGGG'], '0,0', '3,0'));        // flat: range 2 only
  assert.ok(canHit(['DGGGGG', 'GGGGGG'], '0,0', '3,0'));         // dunes over flat
  assert.ok(canHit(['hGGGGG', 'GGGGGG'], '0,0', '3,0'));         // hilly forest counts as hill
  assert.ok(!canHit(['HGGHGG', 'GGGGGG'], '0,0', '3,0'));        // hill to hill: no bonus
  const s2 = setup(['GGG', 'GGG']); const c2 = place(s2, 'climber', 0, '0,0'); const t2 = place(s2, 'tennis', 1, '2,0');
  assert.equal(damage(s2, c2, t2), Math.max(1, UNITS.climber.atk - UNITS.tennis.def));
});

test('throws are blocked by mountains, unless the climber stands on a mountain', () => {
  assert.ok(!canHit(['GMG', 'GGG'], '0,0', '2,0'));
  assert.ok(canHit(['MMG', 'GGG'], '0,0', '2,0'));
  assert.ok(canHit(['GHG', 'GGG'], '0,0', '2,0'));                // hills do not block stones
});
