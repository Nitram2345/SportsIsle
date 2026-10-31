import test from 'node:test';
import assert from 'node:assert/strict';
import { UNITS } from '../src/config.js';
import { apply, idleUnits } from '../src/logic/game.js';
import { attackTargets } from '../src/logic/combat.js';
import { gameFrom, place, exploreAll } from './helpers.js';

test('jogger takes 2 turns to produce', () => assert.equal(UNITS.jogger.build, 2));

test('jogger kicks: range 1, very weak, only before moving', () => {
  let s = gameFrom(['GGGGGG']); exploreAll(s, 0);
  const j = place(s, 'jogger', 0, '1,0'); const t = place(s, 'golfer', 1, '2,0'); const far = place(s, 'golfer', 1, '4,0');
  assert.equal(UNITS.jogger.range, 1); assert.equal(UNITS.jogger.atk, 1);
  assert.deepEqual(attackTargets(s, j.id), [t.id]); assert.ok(far);
  const hit = apply(s, { type: 'attack', unitId: j.id, targetId: t.id }).state;
  assert.equal(hit.units[t.id].hp, UNITS.golfer.hp - 1);
  const moved = apply(s, { type: 'move', unitId: j.id, path: ['0,0'] }).state;
  assert.deepEqual(attackTargets(moved, j.id), []);   // multi-move jogger still loses its kick once it moved
});

test('idleUnits lists own units that have neither moved nor attacked', () => {
  let s = gameFrom(['GGGGGGGG']); exploreAll(s, 0); exploreAll(s, 1);
  const a = place(s, 'tennis', 0, '0,0'); const b = place(s, 'golfer', 0, '2,0'); const e = place(s, 'tennis', 1, '7,0');
  assert.deepEqual(idleUnits(s), [a.id, b.id]);
  s = apply(s, { type: 'move', unitId: a.id, path: ['1,0'] }).state;
  assert.deepEqual(idleUnits(s), [b.id]);
  s = apply(s, { type: 'move', unitId: b.id, path: ['3,0'] }).state;
  assert.deepEqual(idleUnits(s), []);
  s = apply(s, { type: 'endTurn' }).state;
  assert.deepEqual(idleUnits(s), [e.id]);
});
