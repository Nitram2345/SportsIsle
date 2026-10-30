// Game state and the single entry point for changes: apply(state, action).
import { UNITS, BUILDINGS, SKINS, TERRAIN, RULES } from '../config.js';
import { distance, neighbors } from './hex.js';
import { random } from './rng.js';
import { effective, updateMemory } from './vision.js';
import { doMove } from './movement.js';
import { doAttack } from './combat.js';

const pick = (state, list) => list[Math.floor(random(state) * list.length)];

export function spawnUnit(state, type, owner, at) {
  const id = 'u' + state.nextId++;
  const skin = {
    variant: pick(state, SKINS.variants),
    tone: Math.floor(random(state) * SKINS.tones.length),
    hair: Math.floor(random(state) * SKINS.hairPerVariant),
  };
  const unit = { id, type, owner, at, hp: UNITS[type].hp, movesLeft: UNITS[type].move, hasMoved: false, hasAttacked: false, skin, buffs: [] };
  state.units[id] = unit;
  return unit;
}

export function createGame(map, players, { seed, startSlots }) {
  // only what would corrupt the state; full playability check is validateMap (UI)
  for (const slot of startSlots) for (const k of map.starts[slot].facilities)
    if (!BUILDINGS[map.tiles[k]?.building]?.capturable) throw new Error(`Startpunkt ${slot + 1}: Feld ${k} ist keine Sportstätte.`);
  const { width, height } = map.meta;
  const state = {
    version: 1, rng: seed | 0, mapId: map.meta.id, width, height,
    tiles: structuredClone(map.tiles),
    players: players.map(p => ({ name: p.name, color: p.color, alive: true })),
    current: 0, round: 1, winner: null,
    units: {}, nextId: 1, facilities: {},
    explored: players.map(() => ({})), lastSeen: players.map(() => ({})),
  };
  for (const [k, t] of Object.entries(state.tiles))
    if (BUILDINGS[t.building]?.capturable) state.facilities[k] = { type: t.building, owner: null, producing: null, progress: 0, needed: 0 };
  startSlots.forEach((slot, pid) => {
    const s = map.starts[slot];
    for (const k of s.facilities) state.facilities[k].owner = pid;
    const free = freeTilesNear(state, s.at, s.units.length);
    s.units.forEach((type, i) => { if (free[i]) spawnUnit(state, type, pid, free[i]); });
  });
  startTurn(state, 0, []);
  return state;
}

// Passable, unoccupied tiles ordered by distance from `at` (start point first).
export function freeTilesNear(state, at, n) {
  const occupied = new Set(Object.values(state.units).map(u => u.at));
  return Object.keys(state.tiles)
    .filter(k => !occupied.has(k) && isPassable(state, k))
    .sort((a, b) => distance(at, a) - distance(at, b) || a.localeCompare(b))
    .slice(0, n);
}

export const isPassable = (state, k) => !!state.tiles[k] && TERRAIN[state.tiles[k].terrain].passable;

// ponytail: greedy, not optimal; fine for <=16 starts
export function suggestStarts(map, n, seed) {
  const holder = { rng: seed | 0 }, at = i => map.starts[i].at;
  const chosen = [Math.floor(random(holder) * map.starts.length)];
  while (chosen.length < n) {
    let best = -1, bestD = -1;
    map.starts.forEach((_, i) => {
      if (chosen.includes(i)) return;
      const d = Math.min(...chosen.map(j => distance(at(i), at(j))));
      if (d > bestD) { best = i; bestD = d; }
    });
    chosen.push(best);
  }
  return chosen;
}

export function startTurn(state, pid, events) {
  for (const [at, f] of Object.entries(state.facilities)) if (f.owner === pid) tickProduction(state, at, f, events);
  for (const u of Object.values(state.units)) if (u.owner === pid) {
    const move = effective(u, 'move');
    // dazed (hit since last turn) -> this turn: half move, no attack
    u.dazedNow = !!u.dazed; u.dazed = false;
    u.movesLeft = u.dazedNow ? Math.floor(move / 2) : move;
    u.hasMoved = false; u.hasAttacked = false; u.retreatTo = null;
  }
  updateMemory(state, pid);
}

const countUnits = (state, pid) => Object.values(state.units).filter(u => u.owner === pid).length;

export function productionTime(state, pid, unitType) {
  const n = countUnits(state, pid);
  if (n >= RULES.unitCap) return null;
  const extra = n < RULES.slowdownFrom ? 0 : Math.floor((n - RULES.slowdownFrom) / RULES.slowdownStep) + 1;
  return UNITS[unitType].build + extra;
}

function tickProduction(state, at, f, events) {
  if (!f.producing) return;
  if (!f.needed) { f.needed = productionTime(state, f.owner, f.producing); if (f.needed === null) { f.needed = 0; return; } }
  if (countUnits(state, f.owner) >= RULES.unitCap) return;
  if (f.progress < f.needed) f.progress++;
  if (f.progress < f.needed) return;
  const occupied = new Set(Object.values(state.units).map(u => u.at));
  const spot = [at, ...neighbors(at, state.width, state.height)].find(k => !occupied.has(k) && isPassable(state, k));
  if (!spot) return;  // wait, progress stays
  const u = spawnUnit(state, f.producing, f.owner, spot);
  events.push({ type: 'produced', unitId: u.id, at: spot });
  f.progress = 0;
  f.needed = productionTime(state, f.owner, f.producing) ?? 0;
}

function capture(state, at, pid, events) {
  const f = state.facilities[at];
  if (!f || f.owner === pid) return;
  Object.assign(f, { owner: pid, producing: null, progress: 0, needed: 0 });
  events.push({ type: 'captured', at, player: pid });
  updateMemory(state, pid);
}

function doProduce(state, at, unitType) {
  const f = state.facilities[at];
  if (!f || f.owner !== state.current) throw new Error('Das ist nicht deine Sportstätte.');
  if (unitType === null) { Object.assign(f, { producing: null, progress: 0, needed: 0 }); return; }
  if (!BUILDINGS[f.type].produces.includes(unitType)) throw new Error('Diese Sportstätte stellt das nicht her.');
  if (f.producing === unitType) return;
  Object.assign(f, { producing: unitType, progress: 0, needed: productionTime(state, f.owner, unitType) ?? 0 });
}

function endTurn(state, events) {
  const pid = state.current;
  for (const u of Object.values(state.units)) if (u.owner === pid) {
    capture(state, u.at, pid, events);
    u.dazedNow = false;  // the dazed turn is over; a hit taken this turn stays pending in u.dazed
    for (const b of u.buffs) if (b.fresh) b.fresh = false; else b.turns--;
    u.buffs = u.buffs.filter(b => b.turns > 0);
  }
  checkElimination(state, events);
  if (state.winner !== null || !state.players.some(p => p.alive)) return;
  let next = pid;
  do {
    next = (next + 1) % state.players.length;
    if (next === 0) state.round++;
  } while (!state.players[next].alive);
  state.current = next;
  startTurn(state, next, events);
}

const getUnit = (s, id) => s.units[id] ?? (() => { throw new Error('Einheit nicht gefunden.'); })();

export function apply(state, action) {
  if (state.winner !== null) throw new Error('Das Spiel ist vorbei.');
  const s = structuredClone(state), events = [];
  switch (action?.type) {
    case 'move': {
      const u = getUnit(s, action.unitId);
      doMove(s, u, action.path, events);
      capture(s, u.at, u.owner, events);
      break;
    }
    case 'produce': doProduce(s, action.at, action.unitType); break;
    case 'endTurn': endTurn(s, events); break;
    case 'attack': doAttack(s, getUnit(s, action.unitId), action.targetId, events); break;
    default: throw new Error(`Unbekannte Aktion: ${action?.type}`);
  }
  checkElimination(s, events);
  return { state: s, events };
}

export function checkElimination(state, events) {
  state.players.forEach((p, pid) => {
    if (!p.alive) return;
    const hasUnit = Object.values(state.units).some(u => u.owner === pid);
    const hasFacility = Object.values(state.facilities).some(f => f.owner === pid);
    if (!hasUnit && !hasFacility) { p.alive = false; events.push({ type: 'eliminated', player: pid }); }
  });
  const alive = state.players.map((p, i) => p.alive ? i : -1).filter(i => i >= 0);
  if (alive.length === 1 && state.winner === null) { state.winner = alive[0]; events.push({ type: 'won', player: alive[0] }); }
}
