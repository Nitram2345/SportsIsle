import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { UNITS, TERRAIN } from '../src/config.js';
import { apply } from '../src/logic/game.js';
import { reachable } from '../src/logic/movement.js';
import { applyShallows, loadMap } from '../src/logic/map.js';
import { neighbors } from '../src/logic/hex.js';
import { gameFrom, mapFrom, place, exploreAll } from './helpers.js';

const setup = (rows, opts) => { const s = gameFrom(rows, opts); exploreAll(s, 0); return s; };
const act = (s, a) => apply(s, a);
const end = s => apply(s, { type: 'endTurn' }).state;
const foe = (s, at) => place(s, 'golfer', 1, at);

// ---------- shallow water ----------
test('config: shallow water is passable water, not buildable', () => {
  const t = TERRAIN.shallow;
  assert.equal(t.char, 'U'); assert.ok(t.passable); assert.ok(!t.buildable);
  assert.ok(t.flags.includes('water') && t.flags.includes('shallow'));
});
test('entering shallow water ends the move', () => {
  const s = setup(['GGUGGGGG']); const t = place(s, 'tennis', 0, '0,0'); foe(s, '7,0');
  const r = reachable(s, t.id);
  assert.ok(r['2,0']); assert.equal(r['3,0'], undefined);
  const u = act(s, { type: 'move', unitId: t.id, path: ['1,0', '2,0'] }).state.units[t.id];
  assert.equal(u.at, '2,0'); assert.equal(u.movesLeft, 0);
});
test('from shallow water exactly one tile, into water or onto land', () => {
  const s = setup(['GUUUGGGG']); const t = place(s, 'tennis', 0, '1,0'); foe(s, '7,0');
  assert.deepEqual(Object.keys(reachable(s, t.id)).sort(), ['0,0', '2,0']);
  const j = place(s, 'jogger', 0, '3,0');
  assert.deepEqual(Object.keys(reachable(s, j.id)).sort(), ['2,0', '4,0']);
  const u = act(s, { type: 'move', unitId: j.id, path: ['4,0'] }).state.units[j.id];
  assert.equal(u.movesLeft, 0);   // even the jogger is done
});
test('paths through shallow water or longer exits are rejected', () => {
  const s = setup(['GUGGGGGG']); const t = place(s, 'tennis', 0, '0,0'); foe(s, '7,0');
  assert.throws(() => act(s, { type: 'move', unitId: t.id, path: ['1,0', '2,0'] }), /seichten/);
  const s2 = setup(['GUGGGGGG']); const w = place(s2, 'tennis', 0, '1,0'); foe(s2, '7,0');
  assert.throws(() => act(s2, { type: 'move', unitId: w.id, path: ['2,0', '3,0'] }), /1 Feld/);
});
test('stepping out of shallow water works even onto expensive ground', () => {
  const s = setup(['UMGGGG']); const k = place(s, 'karate', 0, '0,0'); foe(s, '5,0');   // karate move 2, mountain 3
  assert.ok(reachable(s, k.id)['1,0']);
});
test('swimmers are not slowed by shallow water', () => {
  const s = setup(['GUUUGGGG']); const w = place(s, 'swimmer', 0, '0,0'); foe(s, '7,0');
  assert.ok(reachable(s, w.id)['3,0']);
});
test('applyShallows rings land with shallow water and reverts isolated shallows', () => {
  const m = mapFrom(['WWWWW', 'WWGWW', 'WWWWW', 'WWWWU']);
  applyShallows(m);
  const at = k => m.tiles[k].terrain;
  for (const k of neighbors('2,1', 5, 4)) assert.equal(at(k), 'shallow', k);
  assert.equal(at('0,3'), 'sea'); assert.equal(at('4,3'), 'sea');
});
test('bundled maps: every sea/lake tile next to land is shallow, no stray shallows', () => {
  for (const e of JSON.parse(readFileSync('maps/index.json', 'utf8'))) {
    const m = loadMap(JSON.parse(readFileSync(`maps/${e.file}`, 'utf8')));
    const land = k => !TERRAIN[m.tiles[k].terrain].flags.includes('water');
    for (const [k, t] of Object.entries(m.tiles)) {
      const nearLand = neighbors(k, m.meta.width, m.meta.height).some(land);
      if (t.terrain === 'sea' || t.terrain === 'lake') assert.ok(!nearLand, `${e.id} ${k} should be shallow`);
      if (t.terrain === 'shallow') assert.ok(nearLand, `${e.id} ${k} stray shallow`);
    }
  }
});

// ---------- jogger builds roads ----------
test('config: road build turns by terrain; only the jogger builds', () => {
  assert.deepEqual(['mountain', 'hill', 'hillforest', 'hillgrass', 'dunes', 'forest', 'grass', 'steppe', 'moor'].map(t => TERRAIN[t].roadTurns), [7, 4, 4, 4, 4, 3, 2, 2, 2]);
  assert.equal(TERRAIN.shallow.roadTurns, null); assert.equal(TERRAIN.sea.roadTurns, null);
  assert.deepEqual(Object.entries(UNITS).filter(([, u]) => u.roadBuild).map(([id]) => id), ['jogger']);
});
test('jogger builds a road on its tile: grass takes 2 turns, locked meanwhile', () => {
  let s = setup(['GGGGGGGG']); const j = place(s, 'jogger', 0, '1,0'); foe(s, '7,0');
  s = act(s, { type: 'buildRoad', unitId: j.id }).state;
  let u = s.units[j.id];
  assert.deepEqual(u.building, { at: '1,0', left: 2 }); assert.equal(u.movesLeft, 0); assert.ok(u.hasMoved && u.hasAttacked);
  s = end(end(s)); u = s.units[j.id];
  assert.equal(u.building.left, 1); assert.equal(u.movesLeft, 0); assert.equal(s.tiles['1,0'].road, false);
  assert.throws(() => act(s, { type: 'move', unitId: j.id, path: ['2,0'] }));
  const r = apply(end(s), { type: 'endTurn' }); s = r.state; u = s.units[j.id];
  assert.equal(s.tiles['1,0'].road, true); assert.equal(u.building, null); assert.equal(u.movesLeft, UNITS.jogger.move);
  assert.ok(r.events.some(e => e.type === 'roadBuilt' && e.at === '1,0'));
});
test('mountain takes 7 turns', () => {
  let s = setup(['GMGGGGGG']); const j = place(s, 'jogger', 0, '1,0'); foe(s, '7,0');
  s = act(s, { type: 'buildRoad', unitId: j.id }).state;
  for (let i = 0; i < 6; i++) { s = end(end(s)); assert.equal(s.tiles['1,0'].road, false, `turn ${i}`); }
  s = end(end(s));
  assert.equal(s.tiles['1,0'].road, true);
});
test('no road on water, existing road, building, after acting, or by other units', () => {
  const s = setup(['GUGGGGGG'], { roads: ['2,0'], buildings: { '3,0': 'park' } }); foe(s, '7,0');
  const build = id => act(s, { type: 'buildRoad', unitId: id });
  assert.throws(() => build(place(s, 'jogger', 0, '1,0').id), /Weg/);
  assert.throws(() => build(place(s, 'jogger', 0, '2,0').id), /Weg/);
  assert.throws(() => build(place(s, 'jogger', 0, '3,0').id), /Weg/);
  assert.throws(() => build(place(s, 'tennis', 0, '4,0').id), /Weg/);
  const j = place(s, 'jogger', 0, '5,0');
  const moved = act(s, { type: 'move', unitId: j.id, path: ['6,0'] }).state;
  assert.throws(() => act(moved, { type: 'buildRoad', unitId: j.id }), /Weg/);
});
test('cancel: progress is lost, jogger stays busy this turn, free next turn', () => {
  let s = setup(['GGGGGGGG']); const j = place(s, 'jogger', 0, '1,0'); foe(s, '7,0');
  s = act(s, { type: 'buildRoad', unitId: j.id }).state;
  s = act(s, { type: 'cancelRoad', unitId: j.id }).state;
  assert.equal(s.units[j.id].building, null); assert.equal(s.units[j.id].movesLeft, 0);
  s = end(end(s));
  assert.equal(s.units[j.id].movesLeft, UNITS.jogger.move); assert.equal(s.tiles['1,0'].road, false);
});
