// Animations: pure description of what to draw over time for one applied action.
// buildAnim(before, after, action, events) -> { duration, frame(t) }
// frame(t) = { pos: {unitId: {x,y}}, shots: [{x,y,kind}], texts: [{x,y,text,color,alpha}], flash: {unitId: {color,alpha}} }
// Game logic is untouched: the renderer draws `after` and only overrides positions/effects.
import { parseKey, hexToPixel } from '../logic/hex.js';
import { UNITS } from '../config.js';

export const STEP_MS = 110;      // per tile when gliding
const LUNGE_MS = 160, FLIGHT_MS = 260, HIT_MS = 520, BOB = 3;
const RED = '#ff3b30', GREEN = '#34c759';

const ease = t => t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
const lerp = (a, b, t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
const clamp01 = t => Math.max(0, Math.min(1, t));

// Projectile arc height (in hex sizes) for ranged attackers.
const ARC = { golfer: 1.2, tennis: 0.5, hockey: 0, soccer: 0.35, climber: 0.8 };

export function buildAnim(before, after, action, events, { size, reduced = false } = {}) {
  const P = k => { const [c, r] = parseKey(k); return hexToPixel(c, r, size); };
  const tracks = [];   // { start, end, fn(u, out) }
  const rest = {};     // unitId -> { from, to }: where a unit is drawn before/after its tracks
  let t = 0;
  const seq = (dur, fn) => { tracks.push({ start: t, end: t + dur, fn }); t += dur; };
  const par = (dur, fn) => tracks.push({ start: t, end: t + dur, fn });   // starts now, does not advance t
  const at = id => (after.units[id] ?? before.units[id])?.at;

  const glide = (id, tiles) => {
    rest[id] = { from: P(tiles[0]), to: P(tiles[tiles.length - 1]), since: t + STEP_MS * (tiles.length - 1) };
    for (let i = 1; i < tiles.length; i++) {
      const a = P(tiles[i - 1]), b = P(tiles[i]);
      seq(STEP_MS, (u, out) => { const p = lerp(a, b, u); out.pos[id] = { x: p.x, y: p.y - Math.sin(Math.PI * u) * BOB }; });
    }
  };
  // floating number + flash (+ shake for damage), half overlapping the next step
  const pop = (id, tile, text, color) => {
    const p = P(tile);
    par(HIT_MS, (u, out) => {
      out.texts.push({ x: p.x, y: p.y - size * (0.9 + 0.8 * u), text, color, alpha: 1 - clamp01((u - 0.6) / 0.4) });
      out.flash[id] = { color, alpha: 0.6 * (1 - u) };
      if (color === RED && !out.pos[id]) out.pos[id] = { x: p.x + Math.sin(u * Math.PI * 6) * 2.5 * (1 - u), y: p.y };
    });
    t += HIT_MS / 2;
  };
  // ranged: projectile on an arc; melee: short lunge toward the target and back
  const strike = (id, fromTile, toTile) => {
    const type = before.units[id]?.type, a = P(fromTile), b = P(toTile);
    if ((UNITS[type]?.range ?? 0) > 1) {
      const arc = (ARC[type] ?? 0.5) * size * 1.5;
      seq(FLIGHT_MS, (u, out) => { const p = lerp(a, b, u); out.shots.push({ x: p.x, y: p.y - size * 0.6 - Math.sin(Math.PI * u) * arc, kind: type }); });
    } else seq(LUNGE_MS, (u, out) => { out.pos[id] = lerp(a, b, Math.sin(Math.PI * u) * 0.35); });
  };

  if (!reduced) switch (action.type) {
    case 'move': {
      const ev = events.find(e => e.type === 'moved');
      if (ev) glide(ev.unitId, [ev.from, ...ev.path]);
      break;
    }
    case 'attack': {
      // first damage = the attack itself; a damage after 'counter' = the counter strike
      let striker = action.unitId, victimFallback = action.targetId;
      for (const e of events) {
        if (e.type === 'counter') { striker = e.unitId; victimFallback = e.targetId; }
        if (e.type === 'whistle') pop(e.targetId, before.units[e.targetId].at, '📣', '#ffcc00');
        if (e.type === 'damage') {
          strike(striker, before.units[striker].at, before.units[e.targetId]?.at ?? at(victimFallback));
          pop(e.targetId, before.units[e.targetId].at, `−${e.amount}`, RED);
        }
      }
      break;
    }
    case 'board': {
      const ev = events.find(e => e.type === 'boarded');
      if (ev) { const a = P(ev.from), b = P(at(ev.carrierId)); seq(STEP_MS * 1.5, (u, out) => { out.pos[ev.unitId] = lerp(a, b, ease(u)); out.ghost = { id: ev.unitId, unit: before.units[ev.unitId], p: lerp(a, b, ease(u)) }; }); }
      break;
    }
    case 'unload': {
      const ev = events.find(e => e.type === 'unloaded');
      if (ev) { const a = P(ev.from), b = P(ev.to); rest[ev.unitId] = { from: a, to: b, since: t + STEP_MS * 1.5 }; seq(STEP_MS * 1.5, (u, out) => { out.pos[ev.unitId] = lerp(a, b, ease(u)); }); }
      break;
    }
    case 'heal': {
      const e = events.find(x => x.type === 'healed');
      if (e) { strike(action.unitId, before.units[action.unitId].at, at(e.unitId)); pop(e.unitId, at(e.unitId), `+${e.amount}`, GREEN); }
      break;
    }
    case 'ram': {
      const id = action.unitId, run = action.path.slice(0, -1), targetAt = action.path[action.path.length - 1];
      const targetId = events.find(e => e.type === 'ram')?.targetId;
      glide(id, [before.units[id].at, ...run]);
      const pushed = events.find(e => e.type === 'pushed');
      const from = P(run[run.length - 1]), to = P(targetAt);
      if (pushed) {
        const dest = P(pushed.to);
        rest[targetId] = { from: to, to: dest, since: t + STEP_MS * 1.4 };
        rest[id].to = to; rest[id].since = t + STEP_MS * 1.4;
        seq(STEP_MS * 1.4, (u, out) => { out.pos[id] = lerp(from, to, ease(u)); out.pos[targetId] = lerp(to, dest, ease(u)); });
      } else {
        if (!after.units[targetId]) { rest[id].to = to; rest[id].since = t + LUNGE_MS; }   // knocked out: take the tile
        seq(LUNGE_MS, (u, out) => { out.pos[id] = lerp(from, to, Math.sin(Math.PI * u) * 0.4); });
      }
      for (const e of events) {
        if (e.type === 'damage' && e.targetId === targetId) pop(targetId, pushed ? pushed.to : targetAt, `−${e.amount}`, RED);
        if (e.type === 'damage' && e.targetId === id) { strike(targetId, at(targetId), at(id)); pop(id, at(id), `−${e.amount}`, RED); }
      }
      break;
    }
  }

  const duration = reduced ? 0 : Math.max(t, ...tracks.map(k => k.end), 0);
  return {
    duration,
    frame(now) {
      const out = { pos: {}, shots: [], texts: [], flash: {} };
      for (const k of tracks) if (now >= k.start && now <= k.end) k.fn(clamp01((now - k.start) / (k.end - k.start)), out);
      // between/after its own steps a unit rests at its last tile
      for (const [id, r] of Object.entries(rest)) if (!out.pos[id]) out.pos[id] = now >= r.since ? r.to : r.from;
      return out;
    },
  };
}
