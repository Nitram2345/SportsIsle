import test from 'node:test';
import assert from 'node:assert/strict';
import { visibleTiles, visibleUnits, updateMemory, effective } from '../src/logic/vision.js';
import { gameFrom, place } from './helpers.js';

const field = (n = 12) => Array(n).fill('G'.repeat(n));

test('golfer sight 3', () => {
  const s = gameFrom(field()); place(s, 'golfer', 0, '5,5');
  const v = visibleTiles(s, 0); assert.ok(v.has('8,5')); assert.ok(!v.has('9,5'));
});
test('own facility gives sight, neutral does not', () => {
  const s = gameFrom(field(), { buildings: { '5,5': 'golf' } });
  assert.ok(!visibleTiles(s, 0).has('5,5'));
  s.facilities['5,5'].owner = 0;
  const v = visibleTiles(s, 0); assert.ok(v.has('7,5')); assert.ok(!v.has('8,5'));
});
test('foreign unit outside sight is not in visibleUnits', () => {
  const s = gameFrom(field()); place(s, 'tennis', 0, '2,5'); const near = place(s, 'golfer', 1, '4,5'); const far = place(s, 'golfer', 1, '9,5');
  const ids = visibleUnits(s, 0).map(u => u.id);
  assert.ok(ids.includes(near.id)); assert.ok(!ids.includes(far.id));
});
test('explored stays after unit leaves', () => {
  const s = gameFrom(field()); const u = place(s, 'jogger', 0, '2,2');
  updateMemory(s, 0); assert.ok(s.explored[0]['5,2']);
  u.at = '11,11'; updateMemory(s, 0);
  assert.ok(s.explored[0]['5,2']); assert.ok(!visibleTiles(s, 0).has('5,2'));
});
test('lastSeen keeps old owner while unseen', () => {
  const s = gameFrom(field(), { buildings: { '4,2': 'tennis' } }); const u = place(s, 'jogger', 0, '2,2');
  updateMemory(s, 0); assert.equal(s.lastSeen[0]['4,2'], null);
  u.at = '11,11'; s.facilities['4,2'].owner = 1; updateMemory(s, 0);
  assert.equal(s.lastSeen[0]['4,2'], null);
  u.at = '3,2'; updateMemory(s, 0);
  assert.equal(s.lastSeen[0]['4,2'], 1);
});
test('effective adds buffs', () => {
  const s = gameFrom(field()); const u = place(s, 'golfer', 0, '1,1');
  assert.equal(effective(u, 'atk'), 4);
  u.buffs.push({ special: 'power', stat: 'atk', amount: 2, turns: 3, fresh: false });
  assert.equal(effective(u, 'atk'), 6); assert.equal(effective(u, 'move'), 3);
});
