import test from 'node:test';
import assert from 'node:assert/strict';
import { UNITS, BUILDINGS } from '../src/config.js';
import { apply } from '../src/logic/game.js';
import { reachable } from '../src/logic/movement.js';
import { ramTargets } from '../src/logic/ram.js';
import { extend } from '../src/logic/hex.js';
import { gameFrom, place, exploreAll } from './helpers.js';

const row = (s = 'G'.repeat(10)) => [s];
const ram = (s, unitId, path) => apply(s, { type: 'ram', unitId, path });
// rugby sight is only 2: tests that charge 3 tiles get an own jogger (sight 4) on row 1 as spotter
const setup = (rows, opts) => {
  const s = gameFrom(rows.length > 1 ? rows : [rows[0], 'W'.repeat(rows[0].length)], opts);
  exploreAll(s, 0); s.tiles['1,1'].terrain = 'grass'; place(s, 'jogger', 0, '1,1');
  return s;
};

test('config: rugby rams, ignores zones, moves like tennis, high defence', () => {
  const r = UNITS.rugby;
  assert.ok(r.ram && r.ignoresZoc);
  assert.equal(r.move, UNITS.tennis.move);
  assert.ok(r.def >= 4);
  assert.deepEqual(BUILDINGS.rugby.produces, ['rugby']);
});
test('extend continues a direction by one tile', () => {
  assert.equal(extend('2,0', '3,0'), '4,0');
  assert.equal(extend('3,0', '2,0'), '1,0');
});

test('ram pushes the target one tile on and takes its place', () => {
  const s = setup(row()); const r = place(s, 'rugby', 0, '0,0'); const t = place(s, 'tennis', 1, '3,0');
  assert.deepEqual(ramTargets(s, r.id)[t.id], ['1,0', '2,0', '3,0']);
  const { state, events } = ram(s, r.id, ['1,0', '2,0', '3,0']);
  assert.equal(state.units[r.id].at, '3,0'); assert.equal(state.units[t.id].at, '4,0');
  assert.equal(state.units[t.id].hp, UNITS.tennis.hp - Math.max(1, UNITS.rugby.atk - UNITS.tennis.def));
  assert.equal(state.units[r.id].hasAttacked, true); assert.equal(state.units[r.id].movesLeft, 0);
  assert.ok(events.some(e => e.type === 'pushed'));
});
test('target that cannot give way: rugby stops in front of it (water, unit, map edge)', () => {
  for (const [rows, extra] of [[row('GGGGW'), null], [row('GGGGG'), '4,0'], [row('GGGG'), null]]) {
    const s = setup(rows); const r = place(s, 'rugby', 0, '0,0'); const t = place(s, 'tennis', 1, '3,0');
    if (extra) place(s, 'golfer', 1, extra);
    const { state, events } = ram(s, r.id, ['1,0', '2,0', '3,0']);
    assert.equal(state.units[r.id].at, '2,0', rows[0]); assert.equal(state.units[t.id].at, '3,0');
    assert.ok(state.units[t.id].hp < UNITS.tennis.hp);
    assert.ok(events.some(e => e.type === 'blocked'));
  }
});
test('no ram from a standstill: at least 2 tiles run-up', () => {
  const s = setup(row()); const r = place(s, 'rugby', 0, '2,0'); place(s, 'tennis', 1, '3,0');
  assert.deepEqual(ramTargets(s, r.id), {});
  assert.throws(() => ram(s, r.id, ['3,0']), /Anlauf/);
});
test('stepping aside and charging back counts as a run-up', () => {
  const s = setup(['G'.repeat(10), 'G'.repeat(10)]); const r = place(s, 'rugby', 0, '2,0'); const t = place(s, 'tennis', 1, '3,0');
  assert.ok(ramTargets(s, r.id)[t.id]);
});
test('rugby ignores zones of control', () => {
  const s = setup(['G'.repeat(10), 'G'.repeat(10)]); const r = place(s, 'rugby', 0, '2,0'); place(s, 'hockey', 1, '3,1');
  assert.ok(reachable(s, r.id)['5,0']);
});
test('rammed karateka strikes back; rammed soccer player is dazed', () => {
  let s = setup(row()); let r = place(s, 'rugby', 0, '0,0'); const k = place(s, 'karate', 1, '3,0');
  let res = ram(s, r.id, ['1,0', '2,0', '3,0']);
  assert.ok(res.events.some(e => e.type === 'counter'));
  assert.ok(res.state.units[r.id].hp < UNITS.rugby.hp);
  assert.ok(k);
  s = setup(row()); r = place(s, 'rugby', 0, '0,0'); const f = place(s, 'soccer', 1, '3,0');
  res = ram(s, r.id, ['1,0', '2,0', '3,0']);
  assert.equal(res.state.units[f.id].dazed, true);
});
test('killed target: rugby takes the tile', () => {
  const s = setup(row()); const r = place(s, 'rugby', 0, '0,0'); const t = place(s, 'jogger', 1, '3,0'); t.hp = 1;
  place(s, 'jogger', 1, '9,0');
  const { state } = ram(s, r.id, ['1,0', '2,0', '3,0']);
  assert.equal(state.units[t.id], undefined); assert.equal(state.units[r.id].at, '3,0');
});
test('ending on an enemy facility after the push captures it', () => {
  const s = setup(row(), { buildings: { '3,0': 'tennis' } }); s.facilities['3,0'].owner = 1;
  const r = place(s, 'rugby', 0, '0,0'); place(s, 'tennis', 1, '3,0');
  assert.equal(ram(s, r.id, ['1,0', '2,0', '3,0']).state.facilities['3,0'].owner, 0);
});
test('ram not possible after moving, for other units, or without a visible target', () => {
  const s = setup(row()); const r = place(s, 'rugby', 0, '0,0'); place(s, 'tennis', 1, '3,0');
  const g = place(s, 'golfer', 0, '0,0'.replace('0,0', '9,0'));
  assert.throws(() => ram(s, g.id, ['8,0', '7,0']), /rammen/);
  assert.throws(() => ram(s, r.id, ['1,0', '2,0']), /Gegner/);
  const moved = apply(s, { type: 'move', unitId: r.id, path: ['1,0'] }).state;
  assert.throws(() => ram(moved, r.id, ['2,0', '3,0']), /Zug/);
});
test('target tile terrain does not count against the run-up points', () => {
  const s = setup(row('GGGgGGGGGG')); const r = place(s, 'rugby', 0, '0,0'); const t = place(s, 'tennis', 1, '3,0');
  // run-up 1,0 + 2,0 = 2 points of 3; target on hilly grass (cost 2) must not matter
  assert.ok(ramTargets(s, r.id)[t.id]);
  assert.equal(ram(s, r.id, ['1,0', '2,0', '3,0']).state.units[t.id].at, '4,0');
});
