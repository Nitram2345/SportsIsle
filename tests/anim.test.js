import test from 'node:test';
import assert from 'node:assert/strict';
import { buildAnim, STEP_MS } from '../src/render/anim.js';
import { apply } from '../src/logic/game.js';
import { hexToPixel, parseKey } from '../src/logic/hex.js';
import { gameFrom, place, exploreAll } from './helpers.js';

const S = 32;
const px = k => { const [c, r] = parseKey(k); return hexToPixel(c, r, S); };
const close = (a, b, msg) => { assert.ok(Math.abs(a.x - b.x) < 0.01 && Math.abs(a.y - b.y) < 0.01, `${msg}: ${JSON.stringify(a)} vs ${JSON.stringify(b)}`); };
const run = (s, action) => { const r = apply(s, action); return { anim: buildAnim(s, r.state, action, r.events, { size: S }), next: r.state, events: r.events }; };
const setup = rows => { const s = gameFrom(rows); exploreAll(s, 0); return s; };

// ---------- movement: glide along the path ----------
test('move glides tile by tile, STEP_MS per tile', () => {
  const s = setup(['GGGGGGGGGGGG']); const j = place(s, 'jogger', 0, '0,0'); place(s, 'golfer', 1, '11,0');
  const { anim } = run(s, { type: 'move', unitId: j.id, path: ['1,0', '2,0', '3,0'] });
  assert.equal(anim.duration, 3 * STEP_MS);
  close(anim.frame(0).pos[j.id], px('0,0'), 'start');
  close(anim.frame(STEP_MS).pos[j.id], px('1,0'), 'after one step');
  close(anim.frame(anim.duration).pos[j.id], px('3,0'), 'end');
});
test('gliding unit bobs up mid-step (looks like running)', () => {
  const s = setup(['GGGGGG']); const j = place(s, 'jogger', 0, '0,0'); place(s, 'golfer', 1, '5,0');
  const { anim } = run(s, { type: 'move', unitId: j.id, path: ['1,0'] });
  const mid = anim.frame(STEP_MS / 2).pos[j.id], line = (px('0,0').y + px('1,0').y) / 2;
  assert.ok(mid.y < line - 1);
});
test('move cut short by discovery only animates the tiles actually walked', () => {
  const s = setup(['G'.repeat(14)]); const j = place(s, 'jogger', 0, '0,0'); place(s, 'tennis', 1, '9,0');
  const { anim, next } = run(s, { type: 'move', unitId: j.id, path: ['1,0', '2,0', '3,0', '4,0', '5,0', '6,0'] });
  assert.equal(next.units[j.id].at, '5,0');
  assert.equal(anim.duration, 5 * STEP_MS);
  close(anim.frame(anim.duration).pos[j.id], px('5,0'), 'end');
});

// ---------- attacks ----------
test('ranged attack: projectile in flight, then red damage number and flash on the target', () => {
  const s = setup(['GGGGG']); const g = place(s, 'golfer', 0, '0,0'); const t = place(s, 'tennis', 1, '3,0'); place(s, 'jogger', 0, '1,0');
  const { anim, events } = run(s, { type: 'attack', unitId: g.id, targetId: t.id });
  const amount = events.find(e => e.type === 'damage').amount;
  const shots = [...Array(20)].map((_, i) => anim.frame(i * anim.duration / 20).shots.length);
  assert.ok(shots.some(n => n === 1)); assert.equal(anim.frame(anim.duration).shots.length, 0);
  const texts = [...Array(30)].flatMap((_, i) => anim.frame(i * anim.duration / 30).texts);
  assert.ok(texts.some(x => x.text === `−${amount}` && x.color === '#ff3b30'));
  assert.ok([...Array(30)].some((_, i) => anim.frame(i * anim.duration / 30).flash[t.id]?.color === '#ff3b30'));
});
test('melee attack lunges toward the target and has no projectile', () => {
  const s = setup(['GGGG']); const k = place(s, 'karate', 0, '0,0'); const t = place(s, 'tennis', 1, '1,0');
  const { anim } = run(s, { type: 'attack', unitId: k.id, targetId: t.id });
  assert.ok([...Array(20)].every((_, i) => anim.frame(i * anim.duration / 20).shots.length === 0));
  const lunge = [...Array(20)].map((_, i) => anim.frame(i * anim.duration / 20).pos[k.id]).filter(Boolean);
  assert.ok(lunge.some(p => p.x > px('0,0').x + 2));
  close(anim.frame(anim.duration).pos[k.id] ?? px('0,0'), px('0,0'), 'back home');
});
test('counter strike: the attacker gets hit afterwards', () => {
  const s = setup(['GGGG']); const h = place(s, 'hockey', 0, '0,0'); const k = place(s, 'karate', 1, '1,0');
  const { anim } = run(s, { type: 'attack', unitId: h.id, targetId: k.id });
  const flashAt = id => [...Array(60)].findIndex((_, i) => anim.frame(i * anim.duration / 60).flash[id]);
  assert.ok(flashAt(k.id) >= 0 && flashAt(h.id) > flashAt(k.id));
});
test('heal shows a green plus number on the patient', () => {
  const s = setup(['GGGGGG']); const ph = place(s, 'physio', 0, '1,0'); const t = place(s, 'tennis', 0, '2,0'); t.hp = 4; place(s, 'jogger', 1, '5,0');
  const { anim } = run(s, { type: 'heal', unitId: ph.id, targetId: t.id });
  const texts = [...Array(30)].flatMap((_, i) => anim.frame(i * anim.duration / 30).texts);
  assert.ok(texts.some(x => x.text === '+3' && x.color === '#34c759'));
});

// ---------- ram ----------
test('ram: rugby runs up and takes the tile, the target slides one tile on', () => {
  const s = setup(['GGGGGGGG', 'WWWWWWWW']); s.tiles['1,1'].terrain = 'grass'; place(s, 'jogger', 0, '1,1');
  const r = place(s, 'rugby', 0, '0,0'); const t = place(s, 'tennis', 1, '3,0');
  const { anim } = run(s, { type: 'ram', unitId: r.id, path: ['1,0', '2,0', '3,0'] });
  const end = anim.frame(anim.duration);
  close(end.pos[r.id], px('3,0'), 'rugby'); close(end.pos[t.id], px('4,0'), 'target');
});
test('ram blocked: rugby bumps and ends in front of the target', () => {
  const s = setup(['GGGGW', 'WWWWW']); s.tiles['1,1'].terrain = 'grass'; place(s, 'jogger', 0, '1,1');
  const r = place(s, 'rugby', 0, '0,0'); const t = place(s, 'tennis', 1, '3,0');
  const { anim } = run(s, { type: 'ram', unitId: r.id, path: ['1,0', '2,0', '3,0'] });
  const end = anim.frame(anim.duration);
  close(end.pos[r.id], px('2,0'), 'rugby'); close(end.pos[t.id] ?? px('3,0'), px('3,0'), 'target stays');
});

// ---------- no animation ----------
test('reduced motion and non-visual actions have duration 0', () => {
  const s = setup(['GGGGGG']); const j = place(s, 'jogger', 0, '0,0'); place(s, 'golfer', 1, '5,0');
  const r = apply(s, { type: 'move', unitId: j.id, path: ['1,0'] });
  assert.equal(buildAnim(s, r.state, { type: 'move', unitId: j.id, path: ['1,0'] }, r.events, { size: S, reduced: true }).duration, 0);
  const e = apply(s, { type: 'endTurn' });
  assert.equal(buildAnim(s, e.state, { type: 'endTurn' }, e.events, { size: S }).duration, 0);
});
test('board: unit walks onto the carrier (drawn as ghost), unload: steps off', () => {
  const s = setup(['GWWWGGGG']); const t = place(s, 'tennis', 0, '0,0'); const l = place(s, 'lifeguard', 0, '1,0'); place(s, 'golfer', 1, '7,0');
  const b = run(s, { type: 'board', unitId: t.id, carrierId: l.id });
  assert.ok(b.anim.duration > 0);
  const mid = b.anim.frame(b.anim.duration / 2);
  assert.equal(mid.ghost.id, t.id); assert.ok(mid.pos[t.id].x > px('0,0').x && mid.pos[t.id].x < px('1,0').x);
  let n = apply(b.next, { type: 'endTurn' }).state; n = apply(n, { type: 'endTurn' }).state;
  n.tiles['2,0'].terrain = 'shallow';
  const u = run(n, { type: 'unload', unitId: l.id, to: '2,0' });
  close(u.anim.frame(u.anim.duration).pos[t.id], px('2,0'), 'stepped off');
});
test('whistle shows a yellow whistle mark on the target, no damage number', () => {
  const s = setup(['GGGGGG']); const l = place(s, 'lifeguard', 0, '0,0'); const t = place(s, 'tennis', 1, '2,0');
  const { anim } = run(s, { type: 'attack', unitId: l.id, targetId: t.id });
  const texts = [...Array(30)].flatMap((_, i) => anim.frame(i * anim.duration / 30).texts);
  assert.ok(texts.some(x => x.text === '📣')); assert.ok(!texts.some(x => x.text.startsWith('−')));
});
test('merge: first canoe glides onto its partner (ghost), then a marker pops', () => {
  const s = setup(['WWWWWW']); const a = place(s, 'canoe1', 0, '0,0'); const b = place(s, 'canoe1', 0, '1,0'); place(s, 'swimmer', 1, '5,0');
  const { anim } = run(s, { type: 'merge', unitId: a.id, withId: b.id });
  const mid = anim.frame(STEP_MS / 2);   // during the glide
  assert.equal(mid.ghost.id, a.id);
  assert.ok([...Array(30)].flatMap((_, i) => anim.frame(i * anim.duration / 30).texts).some(t => t.text === '🛶'));
});
