import test from 'node:test';
import assert from 'node:assert/strict';
import { UNITS, BUILDINGS } from '../src/config.js';
import { apply } from '../src/logic/game.js';
import { attackTargets } from '../src/logic/combat.js';
import { buildAnim } from '../src/render/anim.js';
import { gameFrom, place, exploreAll } from './helpers.js';

const setup = rows => { const s = gameFrom(rows); exploreAll(s, 0); exploreAll(s, 1); return s; };
const attack = (s, a, t) => apply(s, { type: 'attack', unitId: a.id, targetId: t.id });

test('config: shot putter – slow, sturdy, range 1, splash; athletics stadium', () => {
  const u = UNITS.shotput;
  assert.equal(u.range, 1); assert.ok(u.splash); assert.ok(u.ranked);
  assert.ok(u.move <= 2); assert.ok(u.hp > UNITS.tennis.hp);
  assert.deepEqual(BUILDINGS.stadium.produces, ['shotput']);
});
test('attacks only adjacent tiles', () => {
  const s = setup(['GGGGGG']); const k = place(s, 'shotput', 0, '0,0');
  const near = place(s, 'tennis', 1, '1,0'), far = place(s, 'tennis', 1, '2,0');
  assert.deepEqual(attackTargets(s, k.id), [near.id]); assert.ok(far);
});
test('hits the target and the enemy right behind it with half the attack', () => {
  const s = setup(['GGGGGG']); const k = place(s, 'shotput', 0, '0,0');
  const a = place(s, 'tennis', 1, '1,0'), b = place(s, 'golfer', 1, '2,0');
  const r = attack(s, k, a);
  const full = Math.max(1, UNITS.shotput.atk - UNITS.tennis.def);
  const half = Math.max(1, Math.floor(UNITS.shotput.atk / 2) - UNITS.golfer.def);
  assert.equal(r.state.units[a.id].hp, UNITS.tennis.hp - full);
  assert.equal(r.state.units[b.id].hp, UNITS.golfer.hp - half);
  assert.ok(r.events.some(e => e.type === 'splash' && e.targetId === b.id));
});
test('splash follows the line (also diagonal), not the other neighbours', () => {
  const s = setup(['GGGG', 'GGGG', 'GGGG']); const k = place(s, 'shotput', 0, '1,1');
  const a = place(s, 'tennis', 1, '1,0');                 // NW/NE neighbour above
  const side = place(s, 'golfer', 1, '2,1');
  const r = attack(s, k, a);
  assert.equal(r.state.units[side.id].hp, UNITS.golfer.hp);
});
test('no friendly fire behind; empty tile or map edge behind is fine', () => {
  const s = setup(['GGGG']); const k = place(s, 'shotput', 0, '0,0');
  const a = place(s, 'tennis', 1, '1,0'), own = place(s, 'golfer', 0, '2,0');
  const r = attack(s, k, a);
  assert.equal(r.state.units[own.id].hp, UNITS.golfer.hp);
  const s2 = setup(['GG']); const k2 = place(s2, 'shotput', 0, '0,0'); const e2 = place(s2, 'tennis', 1, '1,0');
  assert.ok(attack(s2, k2, e2).state.units[e2.id].hp < UNITS.tennis.hp);
});
test('splash also hits hidden enemies and uses terrain defence; can knock out', () => {
  const s = setup(['GGF']); const k = place(s, 'shotput', 0, '0,0');
  const a = place(s, 'tennis', 1, '1,0'), b = place(s, 'jogger', 1, '2,0'); b.hp = 1;
  const r = attack(s, k, a);
  assert.equal(r.state.units[b.id], undefined);
  assert.ok(r.events.some(e => e.type === 'killed' && e.unitId === b.id));
});
test('animation: one throw, two damage numbers', () => {
  const s = setup(['GGGGGG']); const k = place(s, 'shotput', 0, '0,0');
  const a = place(s, 'tennis', 1, '1,0'), b = place(s, 'golfer', 1, '2,0');
  const r = attack(s, k, a);
  const anim = buildAnim(s, r.state, { type: 'attack', unitId: k.id, targetId: a.id }, r.events, { size: 32 });
  const texts = [...Array(40)].flatMap((_, i) => anim.frame(i * anim.duration / 40).texts.map(t => t.text));
  assert.ok(new Set(texts.filter(t => t.startsWith('−'))).size >= 1);
  const flashed = id => [...Array(40)].some((_, i) => anim.frame(i * anim.duration / 40).flash[id]);
  assert.ok(flashed(a.id) && flashed(b.id));
});
