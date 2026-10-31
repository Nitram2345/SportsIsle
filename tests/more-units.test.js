import test from 'node:test';
import assert from 'node:assert/strict';
import { UNITS, BUILDINGS } from '../src/config.js';
import { apply } from '../src/logic/game.js';
import { reachable, moveCost } from '../src/logic/movement.js';
import { healTargets } from '../src/logic/combat.js';
import { gameFrom, place, exploreAll } from './helpers.js';

const setup = rows => { const s = gameFrom(rows); exploreAll(s, 0); return s; };
const act = (s, a) => apply(s, a).state;
const end = s => apply(s, { type: 'endTurn' }).state;

test('config: swimmer, table tennis player, physio and their facilities', () => {
  assert.ok(UNITS.swimmer.swim);
  assert.equal(UNITS.tabletennis.attacks, 2);
  assert.equal(UNITS.tabletennis.range, 1);
  assert.equal(UNITS.physio.heal, 3);
  assert.equal(UNITS.physio.range, 0);
  assert.deepEqual(BUILDINGS.pool.produces, ['swimmer']);
  assert.deepEqual(BUILDINGS.tabletennis.produces, ['tabletennis']);
  assert.deepEqual(BUILDINGS.physio.produces, ['physio']);
});

// ---------- swimmer ----------
test('only the swimmer enters water; water costs it 1, land 2, road 1', () => {
  assert.equal(moveCost({ terrain: 'sea', road: false }, { type: 'swimmer' }), 1);
  assert.equal(moveCost({ terrain: 'lake', road: false }, { type: 'swimmer' }), 1);
  assert.equal(moveCost({ terrain: 'river', road: false }, { type: 'swimmer' }), 1);
  assert.equal(moveCost({ terrain: 'grass', road: false }, { type: 'swimmer' }), 2);
  assert.equal(moveCost({ terrain: 'mountain', road: false }, { type: 'swimmer' }), 2);
  assert.equal(moveCost({ terrain: 'grass', road: true }, { type: 'swimmer' }), 1);
  assert.equal(moveCost({ terrain: 'sea', road: false }, { type: 'tennis' }), Infinity);
});
test('swimmer crosses open water, slow on land', () => {
  const s = setup(['GWWWGG']); const w = place(s, 'swimmer', 0, '0,0');
  const r = reachable(s, w.id);
  assert.ok(r['3,0']); assert.equal(r['4,0'], undefined);
  const s2 = setup(['GGGG']); const w2 = place(s2, 'swimmer', 0, '0,0');
  assert.ok(reachable(s2, w2.id)['2,0']); assert.equal(reachable(s2, w2.id)['3,0'], undefined);
});

// ---------- table tennis: two attacks per turn ----------
test('table tennis player attacks twice per turn, then is done; resets next turn', () => {
  let s = setup(['GGGGGGGG']); const p = place(s, 'tabletennis', 0, '1,0');
  const a = place(s, 'tennis', 1, '0,0'); const b = place(s, 'tennis', 1, '2,0');
  s = act(s, { type: 'attack', unitId: p.id, targetId: a.id });
  assert.equal(s.units[p.id].hasAttacked, false); assert.equal(s.units[p.id].movesLeft, 0);
  s = act(s, { type: 'attack', unitId: p.id, targetId: b.id });
  assert.equal(s.units[p.id].hasAttacked, true);
  assert.throws(() => act(s, { type: 'attack', unitId: p.id, targetId: a.id }), /schon/);
  assert.throws(() => act(s, { type: 'move', unitId: p.id, path: ['3,0'] }));   // attacked -> no move
  s = end(end(s));
  assert.equal(s.units[p.id].hasAttacked, false); assert.equal(s.units[p.id].attacksUsed, 0);
});
test('table tennis may hit the same target twice; other units still attack once', () => {
  let s = setup(['GGGGGG']); const p = place(s, 'tabletennis', 0, '1,0'); const a = place(s, 'tennis', 1, '2,0');
  s = act(s, { type: 'attack', unitId: p.id, targetId: a.id });
  s = act(s, { type: 'attack', unitId: p.id, targetId: a.id });
  assert.equal(s.units[a.id].hp, UNITS.tennis.hp - 2 * Math.max(1, UNITS.tabletennis.atk - UNITS.tennis.def));
  let s2 = setup(['GGGGGG']); const g = place(s2, 'golfer', 0, '0,0'); const t = place(s2, 'tennis', 1, '2,0');
  s2 = act(s2, { type: 'attack', unitId: g.id, targetId: t.id });
  assert.equal(s2.units[g.id].hasAttacked, true);
});

// ---------- physio: heal one adjacent own unit ----------
test('physio heals an adjacent own unit by 3, capped at max, and ends its action', () => {
  let s = setup(['GGGGGGGG']); const ph = place(s, 'physio', 0, '1,0'); const t = place(s, 'tennis', 0, '2,0'); t.hp = 4;
  const full = place(s, 'golfer', 0, '0,0'); place(s, 'jogger', 1, '7,0');
  assert.deepEqual(healTargets(s, ph.id), [t.id]);            // full-HP golfer is no target
  const r = apply(s, { type: 'heal', unitId: ph.id, targetId: t.id }); s = r.state;
  assert.equal(s.units[t.id].hp, 7);
  assert.ok(r.events.some(e => e.type === 'healed' && e.amount === 3));
  assert.equal(s.units[ph.id].hasAttacked, true); assert.equal(s.units[ph.id].movesLeft, 0);
  assert.throws(() => act(s, { type: 'heal', unitId: ph.id, targetId: t.id }), /Behandeln/);
  s.units[t.id].hp = 9;
  s = end(end(s));
  s = act(s, { type: 'heal', unitId: ph.id, targetId: t.id });
  assert.equal(s.units[t.id].hp, UNITS.tennis.hp);
  assert.ok(full);
});
test('physio cures a dazed soccer player', () => {
  let s = setup(['GGGGGG']); const ph = place(s, 'physio', 0, '1,0'); const f = place(s, 'soccer', 0, '2,0');
  place(s, 'jogger', 1, '5,0'); f.dazedNow = true; f.dazed = true;
  assert.deepEqual(healTargets(s, ph.id), [f.id]);
  s = act(s, { type: 'heal', unitId: ph.id, targetId: f.id });
  assert.equal(s.units[f.id].dazedNow, false); assert.equal(s.units[f.id].dazed, false);
});
test('physio cannot heal enemies, non-adjacent units, or after moving', () => {
  const s = setup(['GGGGGGGG', 'GGGGGGGG']); const ph = place(s, 'physio', 0, '1,0');
  const e = place(s, 'tennis', 1, '2,0'); e.hp = 3;
  const far = place(s, 'tennis', 0, '5,0'); far.hp = 3;
  assert.deepEqual(healTargets(s, ph.id), []);
  assert.throws(() => act(s, { type: 'heal', unitId: ph.id, targetId: e.id }));
  assert.throws(() => act(s, { type: 'heal', unitId: ph.id, targetId: far.id }));
  const t = place(s, 'golfer', 0, '0,0'); t.hp = 2;
  assert.deepEqual(healTargets(s, ph.id), [t.id]);
  const moved = act(s, { type: 'move', unitId: ph.id, path: ['0,1'] });   // 0,0 still adjacent
  assert.deepEqual(healTargets(moved, ph.id), []);
  assert.throws(() => act(moved, { type: 'heal', unitId: ph.id, targetId: t.id }), /Behandeln/);
});
