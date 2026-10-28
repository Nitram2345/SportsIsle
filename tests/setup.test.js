import test from 'node:test';
import assert from 'node:assert/strict';
import { SKINS } from '../src/config.js';
import { createGame, suggestStarts, apply } from '../src/logic/game.js';
import { distance } from '../src/logic/hex.js';
import { mapFrom, gameFrom, place } from './helpers.js';

const two = [{ name: 'A', color: '#e63946' }, { name: 'B', color: '#2f6fd6' }];
const bigMap = () => mapFrom(['GGGGGGGGG', 'GGGGGGGGG', 'GGGGGGGGG', 'GGGGGGGGG', 'GGGGGGGGG'], {
  buildings: { '1,0': 'tennis', '4,3': 'golf' },
  starts: [{ at: '0,0', units: ['golfer', 'jogger'], facilities: ['1,0'] },
           { at: '8,0', units: ['hockey'], facilities: [] },
           { at: '4,4', units: ['tennis'], facilities: ['4,3'] }] });

test('createGame: chosen slots get units, unused dropped, facilities neutral', () => {
  const s = createGame(bigMap(), two, { seed: 1, startSlots: [0, 1] });
  assert.equal(Object.keys(s.units).length, 3);
  assert.equal(s.facilities['1,0'].owner, 0);
  assert.equal(s.facilities['4,3'].owner, null);
  for (const u of Object.values(s.units)) assert.ok(SKINS.variants.includes(u.skin.variant));
  const p0 = Object.values(s.units).filter(u => u.owner === 0).map(u => u.at);
  assert.equal(new Set(p0).size, 2);
  assert.ok(p0.includes('0,0'));
});
test('createGame: slot order maps to players', () => {
  const s = createGame(bigMap(), two, { seed: 1, startSlots: [2, 0] });
  assert.equal(s.facilities['4,3'].owner, 0);
  assert.equal(s.facilities['1,0'].owner, 1);
  assert.equal(s.current, 0); assert.equal(s.round, 1); assert.equal(s.winner, null);
});
test('same seed gives same skins, other seed differs somewhere', () => {
  const skins = seed => Object.values(createGame(bigMap(), two, { seed, startSlots: [0, 1] }).units).map(u => JSON.stringify(u.skin)).join();
  assert.equal(skins(5), skins(5));
  assert.ok([1, 2, 3, 4, 6, 7].some(seed => skins(seed) !== skins(5)));
});
test('suggestStarts spreads players', () => {
  const m = mapFrom(['GGGGGGGGGGG'], { starts: ['0,0', '1,0', '9,0', '10,0'].map(at => ({ at, units: ['jogger'], facilities: [] })) });
  for (let seed = 1; seed < 20; seed++) { const [a, b] = suggestStarts(m, 2, seed).map(i => m.starts[i].at); assert.ok(distance(a, b) >= 9); }
});
test('suggestStarts returns n distinct slots', () => {
  const m = mapFrom(['GGGGGGGGGGG'], { starts: ['0,0', '3,0', '6,0', '10,0'].map(at => ({ at, units: ['jogger'], facilities: [] })) });
  assert.equal(new Set(suggestStarts(m, 3, 7)).size, 3);
});
test('apply rejects unknown action', () => assert.throws(() => apply(gameFrom(['GG']), { type: 'dance' })));
// Review Focus: Speichern/Laden (endTurn arrives in Task 6)
test('state survives JSON round trip and still plays', () => {
  const s = gameFrom(['GGGG']); place(s, 'jogger', 0, '0,0'); place(s, 'jogger', 1, '3,0');
  const copy = JSON.parse(JSON.stringify(s));
  assert.deepEqual(copy, s);
  assert.equal(apply(copy, { type: 'endTurn' }).state.current, 1);
});
