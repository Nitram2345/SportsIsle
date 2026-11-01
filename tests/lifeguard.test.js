import test from 'node:test';
import assert from 'node:assert/strict';
import { UNITS, BUILDINGS } from '../src/config.js';
import { apply, idleUnits, productionTime } from '../src/logic/game.js';
import { reachable } from '../src/logic/movement.js';
import { attackTargets } from '../src/logic/combat.js';
import { boardTargets, unloadTargets } from '../src/logic/transport.js';
import { visibleUnits } from '../src/logic/vision.js';
import { canPlace } from '../src/logic/map.js';
import { gameFrom, place, exploreAll } from './helpers.js';

const setup = (rows, opts) => { const s = gameFrom(rows, opts); exploreAll(s, 0); exploreAll(s, 1); return s; };
const act = (s, a) => apply(s, a).state;
const end = s => apply(s, { type: 'endTurn' }).state;

test('config: lifeguard and beach tower', () => {
  const l = UNITS.lifeguard;
  assert.ok(l.swim && l.whistle); assert.equal(l.carry, 1); assert.equal(l.range, 2);
  assert.deepEqual(BUILDINGS.tower.produces, ['lifeguard']);
  assert.equal(canPlace({ terrain: 'beach' }, 'tower'), true);
  assert.equal(canPlace({ terrain: 'shallow' }, 'tower'), true);
  assert.equal(canPlace({ terrain: 'grass' }, 'tower'), false);
  assert.equal(canPlace({ terrain: 'shallow' }, 'park'), false);
});

test('lifeguard crosses deep water like the swimmer', () => {
  const s = setup(['GWWWGG']); const l = place(s, 'lifeguard', 0, '0,0'); place(s, 'golfer', 1, '5,0');
  assert.ok(reachable(s, l.id)['3,0']);
});

// ---------- whistle ----------
test('whistle: range 2, no damage, target dazed next turn (half move, no attack)', () => {
  let s = setup(['GGGGGGGG']); const l = place(s, 'lifeguard', 0, '0,0');
  const t = place(s, 'tennis', 1, '2,0'); const far = place(s, 'tennis', 1, '3,0');
  assert.deepEqual(attackTargets(s, l.id), [t.id]); assert.ok(far);
  const r = apply(s, { type: 'attack', unitId: l.id, targetId: t.id }); s = r.state;
  assert.equal(s.units[t.id].hp, UNITS.tennis.hp);
  assert.ok(r.events.some(e => e.type === 'whistle' && e.targetId === t.id));
  assert.ok(!r.events.some(e => e.type === 'damage'));
  s = end(s);
  assert.equal(s.units[t.id].movesLeft, Math.floor(UNITS.tennis.move / 2));
  assert.deepEqual(attackTargets(s, t.id), []);
});

// ---------- transport ----------
const ferry = () => {
  // 0,0 land with tennis, 1,0 lifeguard in deep water, 2,0..3,0 deep, 4,0 land
  const s = setup(['GWWWGGGG']); const t = place(s, 'tennis', 0, '0,0'); const l = place(s, 'lifeguard', 0, '1,0');
  place(s, 'golfer', 1, '7,0');
  return { s, t, l };
};
test('board: own unit next to an empty lifeguard climbs aboard and disappears from the map', () => {
  const { s, t, l } = ferry();
  assert.deepEqual(boardTargets(s, t.id), [l.id]);
  const n = act(s, { type: 'board', unitId: t.id, carrierId: l.id });
  assert.equal(n.units[t.id], undefined);
  assert.equal(n.units[l.id].cargo.id, t.id);
  assert.ok(!visibleUnits(n, 0).some(u => u.id === t.id));
  assert.ok(!visibleUnits(n, 1).some(u => u.id === t.id));
});
test('lifeguard carries the cargo across deep water in the same turn', () => {
  const { s, t, l } = ferry();
  let n = act(s, { type: 'board', unitId: t.id, carrierId: l.id });
  n = act(n, { type: 'move', unitId: l.id, path: ['2,0', '3,0'] });
  assert.equal(n.units[l.id].at, '3,0'); assert.equal(n.units[l.id].cargo.id, t.id);
});
test('no boarding: full carrier, not adjacent, enemy carrier, lifeguard onto lifeguard, after moving', () => {
  const { s, t, l } = ferry();
  const full = act(s, { type: 'board', unitId: t.id, carrierId: l.id });
  const g = place(full, 'golfer', 0, '0,0');
  assert.deepEqual(boardTargets(full, g.id), []);
  const s2 = setup(['GGWWWG', 'GGGGGG']); const a = place(s2, 'tennis', 0, '0,0'); const far = place(s2, 'lifeguard', 0, '4,0');
  const e = place(s2, 'lifeguard', 1, '1,0'); place(s2, 'golfer', 1, '5,1');
  assert.deepEqual(boardTargets(s2, a.id), []); assert.ok(far && e);
  const l2 = place(s2, 'lifeguard', 0, '3,0'); const l3 = place(s2, 'lifeguard', 0, '2,0');
  assert.deepEqual(boardTargets(s2, l3.id), []); assert.ok(l2);
  const moved = act(s2, { type: 'move', unitId: a.id, path: ['0,1'] });
  assert.throws(() => act(moved, { type: 'board', unitId: a.id, carrierId: e.id }));
});
test('unload: not in the boarding turn; next turn one tile onto land/shallow, then done', () => {
  const { s, t, l } = ferry();
  let n = act(s, { type: 'board', unitId: t.id, carrierId: l.id });
  n = act(n, { type: 'move', unitId: l.id, path: ['2,0', '3,0'] });
  assert.deepEqual(unloadTargets(n, l.id), []);
  assert.throws(() => act(n, { type: 'unload', unitId: l.id, to: '4,0' }), /nächsten Zug/);
  n = end(end(n));
  assert.deepEqual(unloadTargets(n, l.id), ['4,0']);        // deep water 2,0 is not allowed
  const r = apply(n, { type: 'unload', unitId: l.id, to: '4,0' }); n = r.state;
  assert.equal(n.units[t.id].at, '4,0'); assert.equal(n.units[t.id].movesLeft, 0); assert.equal(n.units[t.id].hasMoved, true);
  assert.equal(n.units[l.id].cargo, null);
  assert.ok(r.events.some(e => e.type === 'unloaded' && e.to === '4,0'));
});
test('cargo is not idle, but counts for the unit cap; state survives JSON', () => {
  const { s, t, l } = ferry();
  const n = act(s, { type: 'board', unitId: t.id, carrierId: l.id });
  assert.deepEqual(idleUnits(n).includes(t.id), false);
  const before = productionTime(s, 0, 'jogger'), after = productionTime(n, 0, 'jogger');
  assert.equal(after, before);
  assert.deepEqual(JSON.parse(JSON.stringify(n)), n);
});
test('carrier knocked out in deep water: cargo drowns; in shallow water: cargo survives', () => {
  let { s, t, l } = ferry();
  let n = act(s, { type: 'board', unitId: t.id, carrierId: l.id });
  n.units[l.id].hp = 1; n.units[l.id].at = '2,0';
  const h = place(n, 'hockey', 1, '3,0'); n.current = 1;
  let r = apply(n, { type: 'attack', unitId: h.id, targetId: l.id });
  assert.equal(r.state.units[l.id], undefined); assert.equal(r.state.units[t.id], undefined);
  assert.ok(r.events.some(e => e.type === 'drowned' && e.unitId === t.id));

  const s2 = setup(['GUGGGGGG']); const t2 = place(s2, 'tennis', 0, '0,0'); const l2 = place(s2, 'lifeguard', 0, '1,0'); place(s2, 'golfer', 1, '7,0');
  let m = act(s2, { type: 'board', unitId: t2.id, carrierId: l2.id });
  m.units[l2.id].hp = 1; const h2 = place(m, 'hockey', 1, '2,0'); m.current = 1;
  r = apply(m, { type: 'attack', unitId: h2.id, targetId: l2.id });
  assert.equal(r.state.units[t2.id].at, '1,0');
});
test('elimination counts carried units: carrier alive with cargo = still in the game', () => {
  const { s, t, l } = ferry();
  const n = act(s, { type: 'board', unitId: t.id, carrierId: l.id });
  const r = apply(n, { type: 'endTurn' });
  assert.equal(r.state.players[0].alive, true);
  assert.ok(t);
});
test('player is out when the carrier drowns with its cargo and nothing else is left', () => {
  const { s, t, l } = ferry();
  let n = act(s, { type: 'board', unitId: t.id, carrierId: l.id });
  for (const id of Object.keys(n.facilities)) n.facilities[id].owner = null;
  n.units[l.id].hp = 1; n.units[l.id].at = '2,0';
  const h = place(n, 'hockey', 1, '3,0'); n.current = 1;
  const r = apply(n, { type: 'attack', unitId: h.id, targetId: l.id });
  assert.equal(r.state.players[0].alive, false);
  assert.ok(t);
});
