// Movement: reachable tiles and step-by-step moves with discovery stop.
import { TERRAIN, ROAD_MOVE, SPECIALS } from '../config.js';
import { neighbors } from './hex.js';
import { visibleTiles, visibleUnits, updateMemory } from './vision.js';

export function moveCost(tile) {
  const t = TERRAIN[tile.terrain];
  if (!t.passable) return Infinity;
  return tile.road ? ROAD_MOVE : t.move;
}

// Unit positions split into own and foreign-but-visible (hidden enemies are ignored).
function occupancy(state, unit) {
  const own = new Set(), enemy = new Set(), vis = visibleTiles(state, unit.owner);
  for (const u of Object.values(state.units)) {
    if (u.id === unit.id) continue;
    if (u.owner === unit.owner) own.add(u.at);
    else if (vis.has(u.at)) enemy.add(u.at);
  }
  return { own, enemy };
}

// Destination -> path (excluding start). Dijkstra over movesLeft.
export function reachable(state, unitId) {
  const unit = state.units[unitId], { own, enemy } = occupancy(state, unit);
  const best = { [unit.at]: 0 }, prev = {}, queue = [[0, unit.at]];
  while (queue.length) {
    queue.sort((a, b) => a[0] - b[0]);
    const [cost, at] = queue.shift();
    if (cost > best[at]) continue;
    for (const n of neighbors(at, state.width, state.height)) {
      if (enemy.has(n) || !state.explored[unit.owner][n]) continue;
      const c = cost + moveCost(state.tiles[n]);
      if (c > unit.movesLeft || c >= (best[n] ?? Infinity)) continue;
      best[n] = c; prev[n] = at; queue.push([c, n]);
    }
  }
  const out = {};
  for (const k of Object.keys(prev)) {
    if (own.has(k)) continue;
    const p = [];
    for (let at = k; at !== unit.at; at = prev[at]) p.unshift(at);
    out[k] = p;
  }
  return out;
}

export function doMove(state, unit, path, events) {
  if (unit.owner !== state.current) throw new Error('Diese Einheit gehört nicht dir.');
  if (unit.hasAttacked) throw new Error('Diese Einheit hat schon geschlagen.');
  if (!Array.isArray(path) || !path.length) throw new Error('Kein Weg angegeben.');
  const { own, enemy } = occupancy(state, unit);
  let at = unit.at, total = 0;
  for (const k of path) {
    if (!state.tiles[k] || !neighbors(at, state.width, state.height).includes(k)) throw new Error('Ungültiger Weg.');
    if (!state.explored[unit.owner][k]) throw new Error('Dieses Feld ist noch unerkundet.');
    if (enemy.has(k)) throw new Error('Dort steht eine gegnerische Einheit.');
    total += moveCost(state.tiles[k]);
    at = k;
  }
  if (total > unit.movesLeft) throw new Error('Nicht genug Bewegungspunkte.');
  if (own.has(at)) throw new Error('Dort steht schon eine eigene Einheit.');

  const seenBefore = new Set(visibleUnits(state, unit.owner).filter(u => u.owner !== unit.owner).map(u => u.id));
  const unitAt = k => Object.values(state.units).find(u => u.at === k && u.id !== unit.id);
  const walked = [];  // [{ from, cost }]
  let stopped = null;
  for (const k of path) {
    const other = unitAt(k);
    if (other && other.owner !== unit.owner) { stopped = [other.id]; break; }  // hidden enemy in the way
    const cost = moveCost(state.tiles[k]);
    walked.push({ from: unit.at, cost });
    unit.at = k; unit.movesLeft -= cost;
    const sp = SPECIALS[state.tiles[k].special];
    if (sp) {
      unit.buffs = unit.buffs.filter(b => b.special !== state.tiles[k].special);
      unit.buffs.push({ special: state.tiles[k].special, stat: sp.stat, amount: sp.amount, turns: sp.turns, fresh: true });
      events.push({ type: 'buff', unitId: unit.id, special: state.tiles[k].special });
    }
    updateMemory(state, unit.owner);
    const fresh = visibleUnits(state, unit.owner).filter(u => u.owner !== unit.owner && !seenBefore.has(u.id)).map(u => u.id);
    if (fresh.length) { stopped = fresh; break; }
  }
  if (stopped) {
    // Never stop on an own unit: back up and refund.
    while (unitAt(unit.at)) { const w = walked.pop(); unit.at = w.from; unit.movesLeft += w.cost; }
    const seen = [...new Set([...stopped, ...visibleUnits(state, unit.owner).filter(u => u.owner !== unit.owner && !seenBefore.has(u.id)).map(u => u.id)])];
    events.push({ type: 'discovered', unitId: unit.id, seen });
  }
  unit.hasMoved = true;
}
