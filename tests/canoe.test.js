import test from 'node:test';
import assert from 'node:assert/strict';
import { UNITS, BUILDINGS } from '../src/config.js';
import { apply } from '../src/logic/game.js';
import { reachable } from '../src/logic/movement.js';
import { ramTargets } from '../src/logic/ram.js';
import { mergeTargets } from '../src/logic/canoe.js';
import { canPlace } from '../src/logic/map.js';
import { gameFrom, place, exploreAll } from './helpers.js';

const setup = rows => { const s = gameFrom(rows); exploreAll(s, 0); exploreAll(s, 1); return s; };
const act = (s, a) => apply(s, a).state;
const end = s => apply(s, { type: 'endTurn' }).state;
const LEVELS = ['canoe1', 'canoe2', 'canoe4', 'canoe8'];

test('config: canoe levels, boathouse', () => {
  assert.deepEqual(LEVELS.map(t => UNITS[t].move), [5, 6, 7, 8]);
  assert.equal(UNITS.canoe1.move, UNITS.swimmer.move + 1);
  assert.deepEqual(LEVELS.map(t => UNITS[t].hp), [6, 8, 12, 16]);
  assert.deepEqual(LEVELS.map(t => UNITS[t].atk), [3, 4, 6, 8]);
  assert.deepEqual(LEVELS.map(t => UNITS[t].def), [2, 2, 2, 2]);
  assert.deepEqual(LEVELS.map(t => UNITS[t].mergeInto ?? null), ['canoe2', 'canoe4', 'canoe8', null]);
  for (const t of LEVELS) assert.ok(UNITS[t].boat && UNITS[t].ram, t);
  assert.deepEqual(BUILDINGS.boathouse.produces, ['canoe1']);
  assert.ok(canPlace({ terrain: 'beach' }, 'boathouse') && canPlace({ terrain: 'shallow' }, 'boathouse'));
  assert.ok(!canPlace({ terrain: 'grass' }, 'boathouse'));
});

test('canoe moves only on water, shallow water does not slow it', () => {
  const s = setup(['UUUUUUGG']); const c = place(s, 'canoe1', 0, '0,0'); place(s, 'golfer', 1, '7,0');
  const r = reachable(s, c.id);
  assert.ok(r['5,0']); assert.equal(r['6,0'], undefined);
});

test('boathouse on the beach launches the canoe onto neighbouring water', () => {
  let s = setup(['GSWWWG'.replace('G', 'S')]); s.tiles['0,0'].terrain = 'beach';
  s.tiles['1,0'].building = 'boathouse'; s.facilities['1,0'] = { type: 'boathouse', owner: 0, producing: null, progress: 0, needed: 0 };
  place(s, 'golfer', 1, '5,0'); s.tiles['5,0'].terrain = 'grass';
  s = act(s, { type: 'produce', at: '1,0', unitType: 'canoe1' });
  s = end(end(s)); s = end(end(s));
  const canoe = Object.values(s.units).find(u => u.type === 'canoe1');
  assert.ok(canoe); assert.equal(s.tiles[canoe.at].terrain, 'sea');
});

// ---------- merge ----------
const pair = () => {
  const s = setup(['WWWWWWWW']); const a = place(s, 'canoe1', 0, '0,0'); const b = place(s, 'canoe1', 0, '1,0');
  place(s, 'swimmer', 1, '7,0'); return { s, a, b };
};
test('mergeTargets: adjacent own fresh canoe of the same size', () => {
  const { s, a, b } = pair();
  assert.deepEqual(mergeTargets(s, a.id), [b.id]);
  const c4 = place(s, 'canoe2', 0, '2,0');
  assert.deepEqual(mergeTargets(s, b.id), [a.id]); assert.ok(c4);
});
test('merge: one bigger canoe on the partner tile, hp kept proportionally, locked for the next own turn', () => {
  let { s, a, b } = pair(); s.units[a.id].hp = 3;   // 9 of 12 hp = 75 %
  const r = apply(s, { type: 'merge', unitId: a.id, withId: b.id }); s = r.state;
  assert.equal(s.units[a.id], undefined);
  const c = s.units[b.id];
  assert.equal(c.type, 'canoe2'); assert.equal(c.at, '1,0'); assert.equal(c.hp, 6);
  assert.equal(c.movesLeft, 0); assert.ok(c.hasMoved && c.hasAttacked);
  assert.ok(r.events.some(e => e.type === 'merged' && e.unitId === a.id && e.intoId === b.id));
  s = end(end(s));
  assert.equal(s.units[b.id].movesLeft, 0); assert.deepEqual(reachable(s, b.id), {});
  s = end(end(s));
  assert.equal(s.units[b.id].movesLeft, UNITS.canoe2.move);
});
test('merge chain 2+2 -> 4, 4+4 -> 8; 8 cannot merge', () => {
  const s = setup(['WWWWWW']); place(s, 'swimmer', 1, '5,0');
  const a = place(s, 'canoe4', 0, '0,0'), b = place(s, 'canoe4', 0, '1,0');
  const n = act(s, { type: 'merge', unitId: a.id, withId: b.id });
  assert.equal(n.units[b.id].type, 'canoe8'); assert.equal(n.units[b.id].hp, UNITS.canoe8.hp);
  const e8 = place(s, 'canoe8', 0, '3,0'), f8 = place(s, 'canoe8', 0, '4,0');
  assert.deepEqual(mergeTargets(s, e8.id), []); assert.ok(f8);
});
test('no merge: different sizes, not adjacent, after acting, enemy, other units', () => {
  const s = setup(['WWWWWWWW']); place(s, 'swimmer', 1, '7,0');
  const a = place(s, 'canoe1', 0, '0,0'), b2 = place(s, 'canoe2', 0, '1,0'), far = place(s, 'canoe1', 0, '3,0');
  assert.deepEqual(mergeTargets(s, a.id), []);
  assert.throws(() => act(s, { type: 'merge', unitId: a.id, withId: far.id }), /Kanu/);
  const e = place(s, 'canoe1', 1, '4,0'); assert.deepEqual(mergeTargets(s, far.id), []); assert.ok(b2 && e);
  const c = place(s, 'canoe1', 0, '5,0'), d = place(s, 'canoe1', 0, '6,0');
  assert.deepEqual(mergeTargets(s, c.id), [d.id]);
  s.units[c.id].hasMoved = true;
  assert.deepEqual(mergeTargets(s, c.id), []); assert.deepEqual(mergeTargets(s, d.id), []);
  const tennis = place(s, 'tennis', 0, '2,0'); assert.deepEqual(mergeTargets(s, tennis.id), []);
});

// ---------- ram (like rugby) ----------
test('canoe rams a unit in deep water: pushed one tile on, canoe takes its place', () => {
  const s = setup(['WWWWWW']); const c = place(s, 'canoe1', 0, '0,0'); const t = place(s, 'swimmer', 1, '3,0');
  assert.deepEqual(ramTargets(s, c.id)[t.id], ['1,0', '2,0', '3,0']);
  const n = act(s, { type: 'ram', unitId: c.id, path: ['1,0', '2,0', '3,0'] });
  assert.equal(n.units[c.id].at, '3,0'); assert.equal(n.units[t.id].at, '4,0');
  assert.ok(n.units[t.id].hp < UNITS.swimmer.hp);
});
test('canoe rams a unit on the shore: target pushed inland, canoe stays on the water', () => {
  const s = setup(['UUUGGG']); const c = place(s, 'canoe1', 0, '0,0'); const t = place(s, 'tennis', 1, '3,0');
  assert.ok(ramTargets(s, c.id)[t.id]);
  const r = apply(s, { type: 'ram', unitId: c.id, path: ['1,0', '2,0', '3,0'] });
  assert.equal(r.state.units[t.id].at, '4,0'); assert.equal(r.state.units[c.id].at, '2,0');
  assert.ok(r.events.some(e => e.type === 'pushed' && e.took === false));
});
test('canoe needs a run-up of 2 tiles', () => {
  const s = setup(['WWWWWW']); const c = place(s, 'canoe1', 0, '2,0'); place(s, 'swimmer', 1, '3,0');
  assert.throws(() => act(s, { type: 'ram', unitId: c.id, path: ['3,0'] }), /Anlauf/);
});
test('canoe cannot ram units inland (not next to water)', () => {
  const s = setup(['UUUGGG']); const c = place(s, 'canoe1', 0, '0,0'); const t = place(s, 'tennis', 1, '4,0');
  place(s, 'jogger', 0, '5,0');   // spotter
  assert.equal(ramTargets(s, c.id)[t.id], undefined);
});
