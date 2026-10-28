import test from 'node:test';
import assert from 'node:assert/strict';
import { key, parseKey, distance, neighbors, hexesInRange, lineBetween, hexToPixel, pixelToHex } from '../src/logic/hex.js';

test('key/parseKey', () => { assert.equal(key(3, 4), '3,4'); assert.deepEqual(parseKey('3,4'), [3, 4]); });
test('distance', () => {
  assert.equal(distance('0,0', '2,0'), 2);
  assert.equal(distance('0,0', '3,2'), 4);
  assert.equal(distance('1,1', '2,2'), 1);
});
test('neighbors odd and even row', () => {
  assert.deepEqual(neighbors('1,1', 5, 5), ['2,1', '2,0', '1,0', '0,1', '1,2', '2,2']);
  assert.deepEqual(neighbors('2,2', 5, 5), ['3,2', '2,1', '1,1', '1,2', '1,3', '2,3']);
  assert.deepEqual(neighbors('0,0', 5, 5).sort(), ['0,1', '1,0']);
});
test('hexesInRange', () => { assert.equal(hexesInRange('5,5', 1, 20, 20).length, 7); assert.equal(hexesInRange('5,5', 2, 20, 20).length, 19); });
test('lineBetween straight', () => { assert.deepEqual(lineBetween('0,0', '3,0'), [['1,0'], ['2,0']]); });
test('lineBetween on edge gives both hexes', () => {
  const l = lineBetween('0,0', '1,1');
  assert.equal(l.length, 1);
  assert.deepEqual([...l[0]].sort(), ['0,1', '1,0']);
});
test('lineBetween neighbours is empty', () => { assert.deepEqual(lineBetween('0,0', '1,0'), []); });
test('pixel round trip', () => {
  for (const k of ['0,0', '3,4', '7,1']) { const [c, r] = parseKey(k); const p = hexToPixel(c, r, 32); assert.equal(pixelToHex(p.x, p.y, 32), k); }
});
