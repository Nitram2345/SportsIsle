import test from 'node:test';
import assert from 'node:assert/strict';
import { UNITS, SPECIALS } from '../src/config.js';
import { apply, roadTurns } from '../src/logic/game.js';
import { effective, maxHp } from '../src/logic/vision.js';
import { promoteTargets } from '../src/logic/merge.js';
import { healTargets } from '../src/logic/combat.js';
import { boardTargets, cargoOf } from '../src/logic/transport.js';
import { gameFrom, place, exploreAll } from './helpers.js';

const setup = rows => { const s = gameFrom(rows); exploreAll(s, 0); exploreAll(s, 1); return s; };
const act = (s, a) => apply(s, a).state;

test('helpers can be promoted like the other units', () => {
  const s = setup(['GGGGGG']); const a = place(s, 'jogger', 0, '0,0'); const b = place(s, 'jogger', 0, '1,0'); place(s, 'golfer', 1, '5,0');
  assert.deepEqual(promoteTargets(s, a.id), [b.id]);
  assert.equal(act(s, { type: 'promote', unitId: a.id, withId: b.id }).units[b.id].rank, 1);
});
test('helpers gain hp per rank, but no attack', () => {
  const s = setup(['GG']); const j = place(s, 'jogger', 0, '0,0');
  assert.deepEqual([0, 1, 2, 3].map(r => { j.rank = r; return [maxHp(j), effective(j, 'atk')]; }), [[6, 1], [8, 1], [12, 1], [16, 1]]);
});

// ---------- jogger ----------
test('jogger: Club +1 sight +1 move; Profi another +1 move', () => {
  const s = setup(['GG']); const j = place(s, 'jogger', 0, '0,0');
  const at = r => { j.rank = r; return [effective(j, 'sight'), effective(j, 'move')]; };
  assert.deepEqual([0, 1, 2, 3].map(at), [[4, 6], [5, 7], [5, 7], [5, 8]]);
});
test('jogger road turns: National -1 on hills/dunes/hilly forest/mountain, Profi -1 everywhere (min 1)', () => {
  const s = setup(['GG']); const j = place(s, 'jogger', 0, '0,0');
  const turns = r => { j.rank = r; return ['grass', 'forest', 'hill', 'dunes', 'hillforest', 'mountain'].map(t => roadTurns(j, { terrain: t })); };
  assert.deepEqual(turns(0), [2, 3, 4, 4, 4, 7]);
  assert.deepEqual(turns(1), [2, 3, 4, 4, 4, 7]);
  assert.deepEqual(turns(2), [2, 3, 3, 3, 3, 6]);
  assert.deepEqual(turns(3), [1, 2, 2, 2, 2, 5]);
});
test('a Profi jogger finishes a grass road after one turn', () => {
  let s = setup(['GGGGGG']); const j = place(s, 'jogger', 0, '1,0'); j.rank = 3; place(s, 'golfer', 1, '5,0');
  s = act(s, { type: 'buildRoad', unitId: j.id });
  assert.equal(s.units[j.id].building.left, 1);
  s = act(act(s, { type: 'endTurn' }), { type: 'endTurn' });
  assert.equal(s.tiles['1,0'].road, true);
});

// ---------- physio ----------
test('physio: Club heals 4', () => {
  let s = setup(['GGGGGG']); const ph = place(s, 'physio', 0, '1,0'); ph.rank = 1;
  const t = place(s, 'tennis', 0, '2,0'); t.hp = 2; place(s, 'golfer', 1, '5,0');
  s = act(s, { type: 'heal', unitId: ph.id, targetId: t.id });
  assert.equal(s.units[t.id].hp, 6);
});
test('physio: promotion to National rolls a random power which healed units receive', () => {
  let s = setup(['GGGGGG']); const a = place(s, 'physio', 0, '0,0'); const b = place(s, 'physio', 0, '1,0'); a.rank = 1; b.rank = 1;
  const t = place(s, 'tennis', 0, '2,0'); t.hp = 2; place(s, 'golfer', 1, '5,0');
  s = act(s, { type: 'promote', unitId: a.id, withId: b.id });
  const gift = s.units[b.id].gift;
  assert.ok(Object.keys(SPECIALS).includes(gift), gift);
  s = act(act(s, { type: 'endTurn' }), { type: 'endTurn' });   // locked turn
  s = act(act(s, { type: 'endTurn' }), { type: 'endTurn' });
  const r = apply(s, { type: 'heal', unitId: b.id, targetId: t.id });
  const buff = r.state.units[t.id].buffs.find(x => x.special === gift);
  assert.ok(buff); assert.equal(buff.turns, SPECIALS[gift].turns);
  assert.ok(r.events.some(e => e.type === 'buff' && e.unitId === t.id));
});
test('physio: Profi treats two different units per turn, then is done', () => {
  let s = setup(['GGGGGG', 'GGGGGG']); const ph = place(s, 'physio', 0, '1,0'); ph.rank = 3; ph.gift = 'shield';
  const a = place(s, 'tennis', 0, '2,0'), b = place(s, 'tennis', 0, '0,0'); a.hp = 2; b.hp = 2; place(s, 'golfer', 1, '5,1');
  s = act(s, { type: 'heal', unitId: ph.id, targetId: a.id });
  assert.deepEqual(healTargets(s, ph.id), [b.id]);       // not the same unit twice
  s = act(s, { type: 'heal', unitId: ph.id, targetId: b.id });
  assert.deepEqual(healTargets(s, ph.id), []);
  assert.ok(s.units[ph.id].hasAttacked);
  assert.throws(() => act(s, { type: 'move', unitId: ph.id, path: ['1,1'] }));
});
test('physio below Profi treats only one unit', () => {
  let s = setup(['GGGGGG']); const ph = place(s, 'physio', 0, '1,0'); ph.rank = 2; ph.gift = 'power';
  const a = place(s, 'tennis', 0, '2,0'), b = place(s, 'tennis', 0, '0,0'); a.hp = 2; b.hp = 2; place(s, 'golfer', 1, '5,0');
  s = act(s, { type: 'heal', unitId: ph.id, targetId: a.id });
  assert.deepEqual(healTargets(s, ph.id), []);
});

// ---------- lifeguard ----------
test('lifeguard: whistle range 2/3/3/4', () => {
  const s = setup(['GG']); const l = place(s, 'lifeguard', 0, '0,0');
  assert.deepEqual([0, 1, 2, 3].map(r => { l.rank = r; return effective(l, 'range'); }), [2, 3, 3, 4]);
});
test('lifeguard: National carries two units', () => {
  let s = setup(['GWWWGGGG', 'GGGGGGGG']); const l = place(s, 'lifeguard', 0, '1,0'); l.rank = 2;
  const a = place(s, 'tennis', 0, '0,0'), b = place(s, 'golfer', 0, '1,1'), c = place(s, 'jogger', 0, '0,1');
  place(s, 'golfer', 1, '7,1');
  s = act(s, { type: 'board', unitId: a.id, carrierId: l.id });
  s = act(s, { type: 'board', unitId: b.id, carrierId: l.id });
  assert.deepEqual(cargoOf(s.units[l.id]).map(u => u.id), [a.id, b.id]);
  assert.deepEqual(boardTargets(s, c.id), []);
});
test('lifeguard: Profi whistle also hurts (1 damage) an adjacent enemy, not a farther one', () => {
  const s = setup(['GGGGGG']); const l = place(s, 'lifeguard', 0, '0,0'); l.rank = 3;
  const near = place(s, 'tennis', 1, '1,0'), far = place(s, 'tennis', 1, '3,0');
  let r = apply(s, { type: 'attack', unitId: l.id, targetId: near.id });
  assert.equal(r.state.units[near.id].hp, UNITS.tennis.hp - 1); assert.ok(r.state.units[near.id].dazed);
  r = apply(s, { type: 'attack', unitId: l.id, targetId: far.id });
  assert.equal(r.state.units[far.id].hp, UNITS.tennis.hp); assert.ok(r.state.units[far.id].dazed);
  const s2 = setup(['GGGG']); const l2 = place(s2, 'lifeguard', 0, '0,0'); l2.rank = 2; const n2 = place(s2, 'tennis', 1, '1,0');
  assert.equal(apply(s2, { type: 'attack', unitId: l2.id, targetId: n2.id }).state.units[n2.id].hp, UNITS.tennis.hp);
});
test('two loaded lifeguards only promote if all passengers fit afterwards', () => {
  const s = setup(['GWWG', 'GWWG']); const a = place(s, 'lifeguard', 0, '1,0'), b = place(s, 'lifeguard', 0, '2,0');
  place(s, 'golfer', 1, '3,1');
  a.cargo = [{ ...a, id: 'p1', type: 'tennis', cargo: undefined }]; b.cargo = [{ ...b, id: 'p2', type: 'tennis', cargo: undefined }];
  assert.deepEqual(promoteTargets(s, a.id), []);        // rank 1 lifeguard has 1 seat, 2 passengers
  a.rank = 1; b.rank = 1;
  assert.deepEqual(promoteTargets(s, a.id), [b.id]);    // rank 2 has 2 seats
  const n = apply(s, { type: 'promote', unitId: a.id, withId: b.id }).state;
  assert.deepEqual(n.units[b.id].cargo.map(c => c.id).sort(), ['p1', 'p2']);
});
