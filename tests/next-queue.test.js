import test from 'node:test';
import assert from 'node:assert/strict';
import { nextInQueue } from '../src/ui/next-queue.js';

// items are keys like 'unit:u1' / 'facility:3,4'
test('first press picks the first item', () => {
  assert.deepEqual(nextInQueue(['a', 'b', 'c'], [], null), { pick: 'a', skipped: [] });
});
test('pressing again skips the current item to the back', () => {
  let r = nextInQueue(['a', 'b', 'c'], [], 'a');
  assert.deepEqual(r, { pick: 'b', skipped: ['a'] });
  r = nextInQueue(['a', 'b', 'c'], r.skipped, 'b');
  assert.deepEqual(r, { pick: 'c', skipped: ['a', 'b'] });
  r = nextInQueue(['a', 'b', 'c'], r.skipped, 'c');
  assert.deepEqual(r, { pick: 'a', skipped: ['b', 'c'] });
});
test('after the selected unit acted, the skipped one does not come back first', () => {
  let r = nextInQueue(['a', 'b', 'c'], [], 'a');        // skip a -> b
  // b moved: no longer in the list, still selected
  r = nextInQueue(['a', 'c'], r.skipped, 'b');
  assert.equal(r.pick, 'c');
});
test('a unit picked by hand (not via the button) and then skipped also goes to the back', () => {
  const r = nextInQueue(['a', 'b', 'c'], [], 'b');
  assert.deepEqual(r, { pick: 'a', skipped: ['b'] });
  assert.equal(nextInQueue(['a', 'b', 'c'], r.skipped, 'a').pick, 'c');
});
test('skipped entries that are done are dropped; single item stays', () => {
  assert.deepEqual(nextInQueue(['c'], ['a', 'b'], null), { pick: 'c', skipped: [] });
  assert.deepEqual(nextInQueue(['a'], [], 'a'), { pick: 'a', skipped: [] });
  assert.deepEqual(nextInQueue([], ['a'], 'a'), { pick: null, skipped: [] });
});
