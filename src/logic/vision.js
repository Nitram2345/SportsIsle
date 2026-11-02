// Fog of sight: what a player sees now, and what they remember.
import { UNITS, BUILDINGS, TERRAIN, RANK_FACTOR, RANK_BONUS } from '../config.js';
import { hexesInRange } from './hex.js';

// Base value scaled by rank (hp always, attack only for non-helpers), plus rank bonuses
// for helpers (move/sight/range from RANK_BONUS), plus buffs.
const ranked = (unit, stat) => {
  const base = UNITS[unit.type][stat];
  const scale = stat === 'hp' || (stat === 'atk' && !UNITS[unit.type].helper);
  return (scale && unit.rank ? Math.round(base * RANK_FACTOR ** unit.rank) : base) + (stat === 'hp' || stat === 'atk' ? 0 : bonus(unit, stat));
};
// Rank bonus up to the unit's rank: numbers add up, flags (true) switch on.
export function bonus(unit, key) {
  let sum = 0;
  for (const level of (RANK_BONUS[unit.type] ?? []).slice(0, (unit.rank ?? 0) + 1)) {
    const v = level[key];
    if (v === true) return true;
    if (typeof v === 'number') sum += v;
  }
  return sum;
}
export const effective = (unit, stat) =>
  ranked(unit, stat) + unit.buffs.reduce((sum, b) => sum + (b.stat === stat ? b.amount : 0), 0);
export const maxHp = unit => ranked(unit, 'hp');

export function visibleTiles(state, pid) {
  const seen = new Set(), { width, height } = state;
  const add = (at, n) => { for (const k of hexesInRange(at, n, width, height)) seen.add(k); };
  for (const u of Object.values(state.units)) if (u.owner === pid) add(u.at, effective(u, 'sight') + (UNITS[u.type].climb && TERRAIN[state.tiles[u.at]?.terrain]?.height === 2 ? 2 : 0));
  for (const [at, f] of Object.entries(state.facilities)) if (f.owner === pid) add(at, BUILDINGS[f.type].sight);
  return seen;
}

export function visibleUnits(state, pid, tiles = visibleTiles(state, pid)) {
  return Object.values(state.units).filter(u => u.owner === pid || tiles.has(u.at));
}

export function updateMemory(state, pid) {
  for (const k of visibleTiles(state, pid)) {
    state.explored[pid][k] = true;
    if (state.facilities[k]) state.lastSeen[pid][k] = state.facilities[k].owner;
  }
}

// Owner as the player knows it: live if the tile is in sight, else last seen.
export const knownOwner = (state, pid, k) =>
  visibleTiles(state, pid).has(k) ? state.facilities[k]?.owner ?? null : state.lastSeen[pid][k] ?? null;
