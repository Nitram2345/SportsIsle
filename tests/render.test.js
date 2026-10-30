import test from 'node:test';
import assert from 'node:assert/strict';
import { addHex, hexPath } from '../src/render/terrain.js';

// Recording fake of the few CanvasRenderingContext2D calls the hex helpers use.
const fakeCtx = () => { const calls = []; return { calls, beginPath: () => calls.push('begin'), moveTo: () => calls.push('move'), lineTo: () => calls.push('line'), closePath: () => calls.push('close') }; };

test('addHex appends a subpath without resetting the path (fog fills many hexes at once)', () => {
  const ctx = fakeCtx();
  ctx.beginPath(); addHex(ctx, 0, 0, 10); addHex(ctx, 20, 0, 10); addHex(ctx, 40, 0, 10);
  assert.equal(ctx.calls.filter(c => c === 'begin').length, 1);
  assert.equal(ctx.calls.filter(c => c === 'move').length, 3);
});
test('hexPath still starts a fresh single-hex path', () => {
  const ctx = fakeCtx(); hexPath(ctx, 0, 0, 10);
  assert.equal(ctx.calls[0], 'begin');
});
