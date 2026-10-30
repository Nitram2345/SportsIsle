import { TERRAIN_BY_CHAR } from '../src/config.js';
import { key } from '../src/logic/hex.js';

// Build MapData directly from terrain char rows (one string per row r).
export function mapFrom(rows, { roads = [], buildings = {}, specials = {}, starts } = {}) {
  const height = rows.length, width = rows[0].length, tiles = {};
  rows.forEach((row, r) => [...row].forEach((ch, c) => {
    const k = key(c, r);
    tiles[k] = { terrain: TERRAIN_BY_CHAR[ch], road: roads.includes(k), building: buildings[k] ?? null, special: specials[k] ?? null };
  }));
  starts ??= [
    { at: '0,0', units: ['jogger'], facilities: [] },
    { at: key(width - 1, height - 1), units: ['jogger'], facilities: [] },
  ];
  return { meta: { format: 1, id: 'test', name: 'Test', author: 'test', width, height, players: { min: 2, max: starts.length } }, tiles, starts };
}

import { createGame, spawnUnit } from '../src/logic/game.js';
import { updateMemory } from '../src/logic/vision.js';
import { PLAYER_COLORS } from '../src/config.js';

// Game from char rows. Default: n start points without units (tests place their own).
export function gameFrom(rows, opts = {}, { players = 2, seed = 1 } = {}) {
  const w = rows[0].length;
  const starts = opts.starts ?? Array.from({ length: players }, (_, i) => ({ at: key(i % w, Math.floor(i / w)), units: [], facilities: [] }));
  const m = mapFrom(rows, { ...opts, starts });
  const ps = Array.from({ length: players }, (_, i) => ({ name: `P${i}`, color: PLAYER_COLORS[i] }));
  return createGame(m, ps, { seed, startSlots: ps.map((_, i) => i) });
}

// Player has seen the whole map before (remembered terrain, no current sight).
export const exploreAll = (state, pid) => { for (const k of Object.keys(state.tiles)) state.explored[pid][k] = true; };

// Put a unit directly into the state (full movesLeft) and let its owner see around it,
// as happens at the start of every real turn.
export const place = (state, type, owner, at) => { const u = spawnUnit(state, type, owner, at); updateMemory(state, owner); return u; };
