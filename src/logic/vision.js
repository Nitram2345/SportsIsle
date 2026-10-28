// Fog of sight: what a player sees now, and what they remember.
import { UNITS, BUILDINGS } from '../config.js';
import { hexesInRange } from './hex.js';

export const effective = (unit, stat) =>
  UNITS[unit.type][stat] + unit.buffs.reduce((sum, b) => sum + (b.stat === stat ? b.amount : 0), 0);

export function visibleTiles(state, pid) {
  const seen = new Set(), { width, height } = state;
  const add = (at, n) => { for (const k of hexesInRange(at, n, width, height)) seen.add(k); };
  for (const u of Object.values(state.units)) if (u.owner === pid) add(u.at, effective(u, 'sight'));
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
