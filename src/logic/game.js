// Game state and the single entry point for changes: apply(state, action).
import { UNITS, BUILDINGS, SKINS, TERRAIN } from '../config.js';
import { distance } from './hex.js';
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
  for (const u of Object.values(state.units)) if (u.owner === pid) {
    u.movesLeft = effective(u, 'move'); u.hasMoved = false; u.hasAttacked = false;
  }
  updateMemory(state, pid);
}

const getUnit = (s, id) => s.units[id] ?? (() => { throw new Error('Einheit nicht gefunden.'); })();

export function apply(state, action) {
  const s = structuredClone(state), events = [];
  switch (action?.type) {
    case 'move': doMove(s, getUnit(s, action.unitId), action.path, events); break;
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
